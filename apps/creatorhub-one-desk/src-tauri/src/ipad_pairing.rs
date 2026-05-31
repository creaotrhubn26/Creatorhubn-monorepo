//! iPad-paring via Bonjour-discovery på LAN.
//!
//! Mac browser-er etter `_creatorhubcap._tcp.local.` — iPad-CaptureApp
//! annonserer denne service-typen når den kjører. Hver tjeneste har en
//! TXT-record med:
//!   - `device_id=<uuid>`  — stabil ID på iPad-en (fra UIDevice.identifierForVendor)
//!   - `device_name=<string>` — visningsnavn (f.eks. "Daniels iPad Pro")
//!   - `app_version=<x.y.z>` — CaptureApp-versjon
//!
//! Paring-flow (krever iPad-endring — se docs/capture/desk-pairing.md):
//!   1. Mac discoverer iPad via Bonjour
//!   2. Bruker klikker "Par" → Mac genererer 4-sifret PIN, viser
//!   3. Bruker går til iPad → CaptureApp viser "Enter Desk PIN"-prompt
//!   4. iPad sender PIN + sin device_id til Mac's lokale paring-endepunkt
//!      (F5+ legger til local HTTP server; per nå er PIN-confirmation
//!      manuell på Mac-siden)
//!   5. Mac lagrer device_id i paired.json
//!
//! Paired-state lagres i `~/.creatorhub-one-desk/paired.json`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use mdns_sd::{ServiceDaemon, ServiceEvent};
use rand::Rng;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

const SERVICE_TYPE: &str = "_creatorhubcap._tcp.local.";
const PIN_EXPIRY_SECS: u64 = 300; // 5 min

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredIpad {
    pub fullname: String, // mdns-sd fullname, brukt som dedup-nøkkel
    pub device_id: Option<String>,
    pub device_name: String,
    pub app_version: Option<String>,
    pub addresses: Vec<String>, // IPv4-strenger
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairedIpad {
    pub device_id: String,
    pub device_name: String,
    pub paired_at_iso: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PendingPin {
    pub pin: String,
    pub fullname: String,
    pub device_name: String,
    pub expires_at_unix_ms: u128,
}

#[derive(Default)]
pub struct IpadPairingState {
    discovered: Mutex<HashMap<String, DiscoveredIpad>>,
    pending_pin: Mutex<Option<PendingPin>>,
    daemon: Mutex<Option<Arc<ServiceDaemon>>>,
}

impl IpadPairingState {
    pub fn list_discovered(&self) -> Vec<DiscoveredIpad> {
        self.discovered.lock().unwrap().values().cloned().collect()
    }

    pub fn current_pin(&self) -> Option<PendingPin> {
        let mut guard = self.pending_pin.lock().unwrap();
        if let Some(p) = guard.as_ref() {
            let now = unix_ms();
            if p.expires_at_unix_ms < now {
                *guard = None;
                return None;
            }
        }
        guard.clone()
    }

    /// Genererer en ny 4-sifret PIN for den oppgitte iPad (Bonjour-fullname).
    /// Erstatter eventuell tidligere pending PIN — kun én aktiv om gangen.
    pub fn generate_pin(&self, fullname: &str, device_name: &str) -> PendingPin {
        let pin: u32 = rand::thread_rng().gen_range(1000..=9999);
        let pending = PendingPin {
            pin: format!("{:04}", pin),
            fullname: fullname.to_string(),
            device_name: device_name.to_string(),
            expires_at_unix_ms: unix_ms() + (PIN_EXPIRY_SECS as u128 * 1000),
        };
        *self.pending_pin.lock().unwrap() = Some(pending.clone());
        pending
    }

    pub fn clear_pin(&self) {
        *self.pending_pin.lock().unwrap() = None;
    }
}

fn unix_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn paired_path() -> PathBuf {
    crate::helper_client::config_dir().join("paired.json")
}

pub fn load_paired() -> Vec<PairedIpad> {
    let path = paired_path();
    let Ok(raw) = std::fs::read(&path) else {
        return Vec::new();
    };
    serde_json::from_slice(&raw).unwrap_or_default()
}

pub fn save_paired(list: &[PairedIpad]) -> Result<(), String> {
    let dir = crate::helper_client::config_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Opprett config-mappe: {}", e))?;
    let path = paired_path();
    let json = serde_json::to_vec_pretty(list).map_err(|e| format!("Serialiser: {}", e))?;
    std::fs::write(&path, &json).map_err(|e| format!("Skriv {}: {}", path.display(), e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// Starter Bonjour-browser i bakgrunnen. mdns-sd-eventer pulles fra
/// daemonens receiver i en egen tråd; oppdaget/forsvunnet iPader
/// oppdaterer staten og emit'es som `ipads-discovered`-event.
pub fn spawn_browser(app: AppHandle, state: Arc<IpadPairingState>) -> Result<(), String> {
    let daemon = ServiceDaemon::new().map_err(|e| format!("ServiceDaemon: {}", e))?;
    let daemon_arc = Arc::new(daemon);
    let receiver = daemon_arc
        .browse(SERVICE_TYPE)
        .map_err(|e| format!("Browse {}: {}", SERVICE_TYPE, e))?;

    *state.daemon.lock().unwrap() = Some(daemon_arc.clone());

    let app_for_browser = app.clone();
    let state_for_browser = state.clone();
    std::thread::spawn(move || {
        let mut last_emit = Instant::now();
        let mut dirty = false;
        loop {
            match receiver.recv_timeout(Duration::from_millis(500)) {
                Ok(event) => match event {
                    ServiceEvent::ServiceResolved(info) => {
                        let fullname = info.get_fullname().to_string();
                        let mut device_id = None;
                        let mut device_name = info.get_hostname().to_string();
                        let mut app_version = None;
                        for prop in info.get_properties().iter() {
                            match prop.key() {
                                "device_id" => device_id = Some(prop.val_str().to_string()),
                                "device_name" => device_name = prop.val_str().to_string(),
                                "app_version" => app_version = Some(prop.val_str().to_string()),
                                _ => {}
                            }
                        }
                        let addresses: Vec<String> = info
                            .get_addresses()
                            .iter()
                            .map(|a| a.to_string())
                            .collect();
                        let entry = DiscoveredIpad {
                            fullname: fullname.clone(),
                            device_id,
                            device_name,
                            app_version,
                            addresses,
                            port: info.get_port(),
                        };
                        state_for_browser
                            .discovered
                            .lock()
                            .unwrap()
                            .insert(fullname, entry);
                        dirty = true;
                    }
                    ServiceEvent::ServiceRemoved(_, fullname) => {
                        if state_for_browser
                            .discovered
                            .lock()
                            .unwrap()
                            .remove(&fullname)
                            .is_some()
                        {
                            dirty = true;
                        }
                    }
                    _ => {}
                },
                Err(_) => {
                    // Timeout (mdns-sd recv_timeout returnerer flume-feil) — fortsett
                }
            }

            if dirty && last_emit.elapsed() >= Duration::from_millis(500) {
                let payload: Vec<DiscoveredIpad> = state_for_browser.list_discovered();
                let _ = app_for_browser.emit("ipads-discovered", &payload);
                last_emit = Instant::now();
                dirty = false;
            }
        }
    });

    Ok(())
}

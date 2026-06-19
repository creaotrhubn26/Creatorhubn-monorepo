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

    /// Legg til en iPad manuelt — for nettverk der Bonjour er blokkert
    /// (bedrifts-VLAN, WiFi-isolasjon, IPv6-loops). Bruker oppgir IP +
    /// port + visningsnavn fra iPad-appens "Settings → Vis pairing-info"-
    /// skjerm. Vi konstruerer en fullname-key som ikke kolliderer med
    /// ekte Bonjour-oppføringer (suffiks "—manual").
    pub fn add_manual(&self, device_name: String, ip: String, port: u16, device_id: Option<String>) -> DiscoveredIpad {
        let fullname = format!("{}._creatorhubcap._tcp.local.—manual", device_name);
        let entry = DiscoveredIpad {
            fullname: fullname.clone(),
            device_id,
            device_name,
            app_version: None,
            addresses: vec![ip],
            port,
        };
        self.discovered.lock().unwrap().insert(fullname, entry.clone());
        entry
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

/// Status-event som emit'es periodisk (hver 5s) selv om ingen iPad
/// oppdages, så UI kan vise "Søker… (N funnet etter X sek)" og
/// brukeren får tilbakemelding på at appen er aktiv.
#[derive(Debug, Clone, Serialize)]
pub struct BonjourStatus {
    pub discovered_count: usize,
    pub elapsed_secs: u64,
}

/// Starter Bonjour-browser i bakgrunnen. mdns-sd-eventer pulles fra
/// daemonens receiver i en egen tråd; oppdaget/forsvunnet iPader
/// oppdaterer staten og emit'es som `ipads-discovered`-event.
///
/// Emitter også `bonjour-status` hvert 5. sekund med antall oppdaget +
/// elapsed-tid, så UI kan vise "fortsatt søker"-feedback når Bonjour
/// er trege (bedrifts-nettverk, IPv6-loops) — uten det ser det ut som
/// appen henger.
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
        let started_at = Instant::now();
        let mut last_emit = Instant::now();
        let mut last_status_emit = Instant::now();
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

            // Periodisk "fortsatt søker"-status. Tikker hvert 5. sekund
            // uavhengig av om noe nytt er oppdaget, så UI kan vise
            // "0 funnet etter 30 sek — prøv manuell input?".
            if last_status_emit.elapsed() >= Duration::from_secs(5) {
                let discovered_count = state_for_browser.discovered.lock().unwrap().len();
                let elapsed_secs = started_at.elapsed().as_secs();
                let _ = app_for_browser.emit(
                    "bonjour-status",
                    BonjourStatus { discovered_count, elapsed_secs },
                );
                last_status_emit = Instant::now();
            }
        }
    });

    Ok(())
}

// ── Auto-pair via TCP (F5c Desk-side) ────────────────────────────────

/// Resultatet av en send_pair_request — enten OK med iPad-ens
/// device_id, eller ERR med årsak. Brukt internt av
/// `generate_pairing_pin_and_send`.
#[derive(Debug, Clone)]
pub enum PairResponse {
    Ok { ipad_device_id: String },
    Err(String),
}

/// Sender PAIR-kommandoen til iPad-en, leser én response-linje,
/// parser OK/ERR. 65s timeout for hele runden (5s mer enn iPad-ens
/// promptTimeout så vi ikke timer ut FØR brukeren har sjansen).
///
/// Prøver hver adresse i `addresses` i rekkefølge til vi får
/// connection — Bonjour annonserer ofte både IPv6 + IPv4, og noen
/// kan være ureachable på vårt LAN.
pub async fn send_pair_request(
    addresses: &[String],
    port: u16,
    desk_id: &str,
    desk_name: &str,
    pin: &str,
) -> PairResponse {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;
    use tokio::time::timeout;

    if addresses.is_empty() {
        return PairResponse::Err("no_addresses".into());
    }
    // Sanitiser felter — \t og \n må ikke krasje protokollen.
    let safe_id = sanitize_field(desk_id);
    let safe_name = sanitize_field(desk_name);
    let safe_pin = sanitize_field(pin);
    let payload = format!("PAIR\t{}\t{}\t{}\n", safe_id, safe_name, safe_pin);

    let mut last_err = String::from("no_connect");
    for addr in addresses {
        // Skip link-local IPv6 hvis vi ikke vet hvilket interface å bruke
        if addr.contains('%') || addr.contains(':') && addr.split(':').count() > 3 {
            // IPv6 — kan funke, prøv likevel men ikke prioritert
        }
        let target = format!("{}:{}", addr, port);
        let connect_res = timeout(Duration::from_secs(5), TcpStream::connect(&target)).await;
        let mut stream = match connect_res {
            Ok(Ok(s)) => s,
            Ok(Err(e)) => {
                last_err = format!("connect {}: {}", target, e);
                continue;
            }
            Err(_) => {
                last_err = format!("connect {}: timeout", target);
                continue;
            }
        };

        // Skriv payload
        if let Err(e) = stream.write_all(payload.as_bytes()).await {
            return PairResponse::Err(format!("write: {}", e));
        }
        if let Err(e) = stream.flush().await {
            return PairResponse::Err(format!("flush: {}", e));
        }

        // Les response — opp til 256 bytes, 65s timeout
        let mut buf = vec![0u8; 256];
        let read_res = timeout(Duration::from_secs(65), stream.read(&mut buf)).await;
        let n = match read_res {
            Ok(Ok(0)) => return PairResponse::Err("connection_closed_before_response".into()),
            Ok(Ok(n)) => n,
            Ok(Err(e)) => return PairResponse::Err(format!("read: {}", e)),
            Err(_) => return PairResponse::Err("timeout".into()),
        };
        let line = String::from_utf8_lossy(&buf[..n]).trim_end_matches('\n').to_string();
        let parts: Vec<&str> = line.split('\t').collect();
        match parts.as_slice() {
            ["OK", device_id, ..] => {
                return PairResponse::Ok {
                    ipad_device_id: device_id.to_string(),
                };
            }
            ["ERR", reason, ..] => return PairResponse::Err(reason.to_string()),
            _ => return PairResponse::Err(format!("malformed_response: {}", line)),
        }
    }

    PairResponse::Err(last_err)
}

fn sanitize_field(s: &str) -> String {
    s.chars()
        .filter(|c| *c != '\t' && *c != '\n' && *c != '\r')
        .take(200)
        .collect()
}

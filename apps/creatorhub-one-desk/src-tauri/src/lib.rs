//! Creatorhub One Desk — Tauri backend.
//!
//! F1: helper-token-auth + project-info-fetch.
//! F2: mount-deteksjon + emit av `mounts-changed`-event.
//! F3: copy-engine (xxHash64 + parallell kopi til N destinasjoner).
//! F4+ legger til backend-rapportering, iPad-paring, live mirror.

mod b2_uploader;
mod capture_mirror;
mod capture_subscriber;
mod copy_engine;
mod copy_session;
mod device_auth;
mod dit_reporter;
mod helper_client;
mod ipad_pairing;
mod mount_watcher;
mod prefs;
mod projects;
mod session_log;

use std::sync::Arc;

use capture_mirror::{MirrorDestination, MirrorState};
use capture_subscriber::CaptureSubscriberState;
use copy_session::{CopySessionState, DestinationSpec, SessionSpec, SessionStatus};
use helper_client::{CaptureSessionSummary, Config, ProjectInfo};
use ipad_pairing::{DiscoveredIpad, IpadPairingState, PairedIpad, PendingPin};
use mount_watcher::{DetectedMount, MountWatcherState};
use serde::Serialize;
use tauri::{Emitter, Manager};

#[derive(Serialize)]
struct StoredConfig {
    api_base: String,
    project_id: String,
    has_token: bool,
}

impl StoredConfig {
    fn from(cfg: &Config) -> Self {
        Self {
            api_base: cfg.api_base.clone(),
            project_id: cfg.project_id.clone(),
            has_token: !cfg.token.is_empty(),
        }
    }
}

#[tauri::command]
fn default_api_base() -> String {
    helper_client::default_api_base().to_string()
}

#[tauri::command]
fn load_stored_config() -> Result<Option<StoredConfig>, String> {
    Ok(helper_client::load_config()?.as_ref().map(StoredConfig::from))
}

#[tauri::command]
fn save_helper_config(
    api_base: String,
    token: String,
    project_id: String,
) -> Result<StoredConfig, String> {
    let api_base = api_base.trim().to_string();
    let token = token.trim().to_string();
    let project_id = project_id.trim().to_string();
    if api_base.is_empty() {
        return Err("api_base mangler".into());
    }
    if token.is_empty() {
        return Err("token mangler".into());
    }
    if project_id.is_empty() {
        return Err("project_id mangler".into());
    }
    let cfg = Config {
        api_base,
        token,
        project_id,
    };
    helper_client::save_config(&cfg)?;
    Ok(StoredConfig::from(&cfg))
}

#[tauri::command]
fn clear_helper_config() -> Result<(), String> {
    helper_client::clear_config()
}

// ── Google-OAuth device-auth commands ──────────────────────────────

#[derive(Serialize)]
struct DeviceTokenStatus {
    user_email: String,
    user_name: String,
    api_base: String,
}

#[tauri::command]
fn device_token_status() -> Result<Option<DeviceTokenStatus>, String> {
    Ok(device_auth::load_device_token()?.map(|t| DeviceTokenStatus {
        user_email: t.user_email,
        user_name: t.user_name,
        api_base: t.api_base,
    }))
}

#[tauri::command]
async fn start_google_login(api_base: Option<String>) -> Result<String, String> {
    let base = api_base.unwrap_or_else(|| helper_client::default_api_base().to_string());
    device_auth::start_google_login(&base).await
}

#[derive(Serialize)]
struct StartLoginResponse {
    authorization_url: String,
    state: String,
}

#[tauri::command]
async fn start_google_login_v2(api_base: Option<String>) -> Result<StartLoginResponse, String> {
    let base = api_base.unwrap_or_else(|| helper_client::default_api_base().to_string());
    let r = device_auth::start_google_login_v2(&base).await?;
    Ok(StartLoginResponse {
        authorization_url: r.authorization_url,
        state: r.state,
    })
}

/// Polles av frontend mens brukeren er i Google-OAuth-flyten i
/// nettleseren. Returnerer Some(_) når completion er klar, None ellers.
/// Etter Some(_): lagrer device-token + henter prosjekter + emitter
/// desktop-auth-completed-event (samme post-callback-flyt som
/// deep-link-handleren).
#[tauri::command]
async fn poll_oauth_completion(
    app: tauri::AppHandle,
    api_base: String,
    state: String,
) -> Result<bool, String> {
    let Some(dt) = device_auth::poll_oauth_completion(&api_base, &state).await? else {
        return Ok(false);
    };
    device_auth::save_device_token(&dt)?;
    let store: tauri::State<Arc<projects::ProjectStore>> = app.state();
    match device_auth::fetch_projects_for_token(&dt.api_base, &dt.token).await {
        Ok(entries) => {
            store.replace_all(entries)?;
            let _ = app.emit("desktop-auth-completed", &dt.user_email);
            Ok(true)
        }
        Err(e) => {
            // Token er lagret — la frontend rendre login-screen om igjen
            // som mottok device-token og kjør deretter refresh
            let _ = app.emit("desktop-auth-failed", &e);
            Err(e)
        }
    }
}

#[tauri::command]
async fn refresh_projects_from_api(
    store: tauri::State<'_, Arc<projects::ProjectStore>>,
) -> Result<usize, String> {
    let token = device_auth::load_device_token()?
        .ok_or_else(|| "Ikke logget inn med Google".to_string())?;
    let entries = device_auth::fetch_projects_for_token(&token.api_base, &token.token).await?;
    let count = entries.len();
    store.replace_all(entries)?;
    Ok(count)
}

#[tauri::command]
fn desktop_logout(store: tauri::State<Arc<projects::ProjectStore>>) -> Result<(), String> {
    device_auth::clear_device_token()?;
    store.clear_all()?;
    Ok(())
}

// ── Multi-project commands ─────────────────────────────────────────

#[tauri::command]
fn list_projects(
    store: tauri::State<Arc<projects::ProjectStore>>,
) -> Result<Vec<projects::ProjectEntry>, String> {
    store.list()
}

#[tauri::command]
fn active_project_id(
    store: tauri::State<Arc<projects::ProjectStore>>,
) -> Result<Option<String>, String> {
    store.active_id()
}

#[tauri::command]
fn set_active_project(
    store: tauri::State<Arc<projects::ProjectStore>>,
    project_id: String,
) -> Result<(), String> {
    store.set_active(&project_id)
}

#[tauri::command]
fn remove_project(
    store: tauri::State<Arc<projects::ProjectStore>>,
    project_id: String,
) -> Result<(), String> {
    store.remove(&project_id)
}

#[tauri::command]
fn update_project_label(
    store: tauri::State<Arc<projects::ProjectStore>>,
    project_id: String,
    label: String,
) -> Result<(), String> {
    store.update_label(&project_id, label)
}

#[tauri::command]
async fn fetch_project_info() -> Result<ProjectInfo, String> {
    let cfg = helper_client::load_config()?
        .ok_or_else(|| "Ingen lagret config — paste token først".to_string())?;
    helper_client::get_project_info(&cfg).await
}

/// Henter destinasjoner med dekrypterte cloud-creds. Brukes ved
/// backup-start så cloud-destinasjoner får riktige B2-credentials
/// in-memory før copy_session router dem til b2_uploader.
#[tauri::command]
async fn fetch_destinations_with_creds() -> Result<serde_json::Value, String> {
    let cfg = helper_client::load_config()?
        .ok_or_else(|| "Ingen lagret config — paste token først".to_string())?;
    helper_client::get_destinations_with_creds(&cfg).await
}

/// Test B2-creds + bucket-eksistens for «Test connection»-knappen i
/// CloudDestinationActivator. Brukes etter at user har valgt bucket
/// men FØR vi committer destinasjonen til backend, slik at vi catcher
/// permission-issues / bucket-fjerning før første backup.
#[tauri::command]
async fn test_b2_connection(
    key_id: String,
    application_key: String,
    bucket_id: String,
) -> Result<String, String> {
    b2_uploader::test_connection(&key_id, &application_key, &bucket_id).await
}

/// Henter bytes brukt + filtelling for ett bucket. Krever B2-creds.
/// Brukes av UI for å vise «12.3 GB av X TB brukt» som forhåndsvarsel
/// før Backblaze-fakturaen blir overraskende. Kan være treg for
/// buckets med mange filer — UI bør cache.
#[tauri::command]
async fn fetch_bucket_usage(
    key_id: String,
    application_key: String,
    bucket_id: String,
    bucket_name: String,
) -> Result<b2_uploader::BucketUsage, String> {
    let auth = b2_uploader::authorize(&key_id, &application_key).await?;
    b2_uploader::bucket_usage(&auth, &bucket_id, bucket_name).await
}

#[tauri::command]
fn list_detected_mounts(state: tauri::State<MountWatcherState>) -> Vec<DetectedMount> {
    mount_watcher::list_mounts(&state)
}

#[tauri::command]
fn rescan_mounts(state: tauri::State<MountWatcherState>) -> Vec<DetectedMount> {
    mount_watcher::rescan(&state)
}

/// Eject et volum trygt via macOS' `diskutil eject`. Brukes etter
/// vellykket backup når Fredrik har enabled "auto-eject"-preferansen.
/// Validerer at path peker til /Volumes/* så vi ikke kan trigge eject
/// på vilkårlig disk via UI-injection.
#[tauri::command]
async fn eject_volume(mount_path: String) -> Result<(), String> {
    use std::path::Path;
    let path = Path::new(&mount_path);
    if !path.starts_with("/Volumes/") {
        return Err(format!(
            "Tryggetssjekk: kun /Volumes/* tillates, fikk {}",
            mount_path
        ));
    }
    let segments: Vec<&std::ffi::OsStr> = path.iter().collect();
    if segments.len() != 3 {
        return Err(format!("Forventet /Volumes/<navn>, fikk {}", mount_path));
    }
    let output = tokio::process::Command::new("/usr/sbin/diskutil")
        .args(["eject", &mount_path])
        .output()
        .await
        .map_err(|e| format!("Kjøre diskutil: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "diskutil eject feilet (exit {}): {}{}",
            output.status.code().unwrap_or(-1),
            stderr,
            stdout
        ));
    }
    Ok(())
}

/// macOS-native notification via osascript. Validerer streng-input for
/// å hindre AppleScript-injection: double-quotes og backslashes escapes.
#[tauri::command]
async fn macos_notification(title: String, body: String) -> Result<(), String> {
    let esc = |s: &str| s.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        "display notification \"{}\" with title \"{}\" sound name \"Glass\"",
        esc(&body),
        esc(&title)
    );
    let output = tokio::process::Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .await
        .map_err(|e| format!("osascript: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "osascript feilet (exit {}): {}",
            output.status.code().unwrap_or(-1),
            stderr
        ));
    }
    Ok(())
}

/// Returnerer auto_eject-preferansen fra ~/.creatorhub-one-desk/prefs.json.
/// Hvis fila eller feltet ikke fins, returnerer false (opt-in).
#[tauri::command]
fn get_auto_eject_pref() -> Result<bool, String> {
    prefs::load().map(|p| p.auto_eject)
}

#[tauri::command]
fn set_auto_eject_pref(auto_eject: bool) -> Result<(), String> {
    let mut p = prefs::load().unwrap_or_default();
    p.auto_eject = auto_eject;
    prefs::save(&p)
}

/// Pre-flight kapasitets-sjekk: gitt dest-paths + bytes som skal skrives,
/// returner status per dest. Brukes av BackupDialog FØR start_copy_session.
#[derive(serde::Serialize)]
struct DestCapacity {
    path: String,
    total_bytes: Option<u64>,
    free_bytes: Option<u64>,
    needed_bytes: u64,
    sufficient: bool,
    safe_margin: bool,
}

#[tauri::command]
fn check_destinations_capacity(
    dest_paths: Vec<String>,
    bytes_needed: u64,
) -> Vec<DestCapacity> {
    dest_paths
        .into_iter()
        .map(|path| {
            let stats = mount_watcher::capacity_for_path(std::path::Path::new(&path));
            let (total, free) = match stats {
                Some((t, f)) => (Some(t), Some(f)),
                None => (None, None),
            };
            let sufficient = match free {
                Some(f) => f >= bytes_needed,
                None => true,
            };
            let safe_margin = match free {
                Some(f) => (bytes_needed as f64) <= (f as f64) * 0.95,
                None => true,
            };
            DestCapacity {
                path,
                total_bytes: total,
                free_bytes: free,
                needed_bytes: bytes_needed,
                sufficient,
                safe_margin,
            }
        })
        .collect()
}

#[tauri::command]
fn get_prefs() -> Result<prefs::Prefs, String> {
    prefs::load()
}

#[tauri::command]
fn save_default_dest_ids(dest_ids: Vec<String>) -> Result<(), String> {
    let mut p = prefs::load().unwrap_or_default();
    p.default_dest_ids = dest_ids;
    prefs::save(&p)
}

#[tauri::command]
async fn start_copy_session(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<CopySessionState>>,
    mount_path: String,
    volume_label: String,
    destinations: Vec<DestinationSpec>,
) -> Result<String, String> {
    let spec = SessionSpec {
        mount_path,
        volume_label,
        destinations,
    };
    copy_session::start_session(app, state.inner().clone(), spec).await
}

#[tauri::command]
fn cancel_copy_session(
    state: tauri::State<Arc<CopySessionState>>,
    session_id: String,
) -> bool {
    state.cancel(&session_id)
}

#[tauri::command]
fn list_copy_sessions(state: tauri::State<Arc<CopySessionState>>) -> Vec<SessionStatus> {
    state.list()
}

// ── Crash-recovery (session_log) ─────────────────────────────────────
// Tre Tauri-commands som lar UI vise interrupted-sessions ved app-
// startup, og enten resume eller forkaste dem.

#[tauri::command]
fn list_interrupted_sessions() -> Result<Vec<session_log::InterruptedSession>, String> {
    // Best-effort cleanup samtidig — sletter logger >30d gamle slik at
    // sessions-mappen ikke vokser over tid. Kjøres lazy så vi ikke
    // blokker app-startup på filsystem-IO.
    session_log::cleanup_old_logs();
    session_log::list_interrupted_sessions()
}

#[tauri::command]
async fn resume_interrupted_session(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<CopySessionState>>,
    session_id: String,
) -> Result<String, String> {
    copy_session::resume_session(app, state.inner().clone(), session_id).await
}

#[tauri::command]
fn discard_interrupted_session(session_id: String) -> Result<(), String> {
    session_log::discard_session(&session_id)
}

#[tauri::command]
fn list_discovered_ipads(state: tauri::State<Arc<IpadPairingState>>) -> Vec<DiscoveredIpad> {
    state.list_discovered()
}

/// Legg til en iPad manuelt (når Bonjour ikke fungerer pga bedrifts-
/// nettverk eller WiFi-isolasjon). Bruker oppgir IP + port + visnings-
/// navn fra iPad-appens "Vis pairing-info"-skjerm.
#[tauri::command]
fn add_manual_ipad(
    state: tauri::State<Arc<IpadPairingState>>,
    device_name: String,
    ip: String,
    port: u16,
    device_id: Option<String>,
) -> DiscoveredIpad {
    state.add_manual(device_name, ip, port, device_id)
}

#[tauri::command]
fn list_paired_ipads() -> Vec<PairedIpad> {
    ipad_pairing::load_paired()
}

#[tauri::command]
fn current_pairing_pin(state: tauri::State<Arc<IpadPairingState>>) -> Option<PendingPin> {
    state.current_pin()
}

/// Henter Desk's egen stabile identitet. Genereres ved første kall.
/// Brukt av UI for å vise "denne Desk-en heter X" + av paring-flowen
/// så iPad-en kan kjenne igjen oss på tvers av token-rotering.
#[tauri::command]
fn current_desk_identity() -> Result<desk_identity::DeskIdentity, String> {
    desk_identity::load_or_create()
}

#[derive(serde::Serialize, Clone)]
struct PairResultEvent {
    fullname: String,
    success: bool,
    ipad_device_id: Option<String>,
    error: Option<String>,
}

#[tauri::command]
fn generate_pairing_pin(
    app: tauri::AppHandle,
    state: tauri::State<Arc<IpadPairingState>>,
    fullname: String,
    device_name: String,
) -> Result<PendingPin, String> {
    let pin = state.generate_pin(&fullname, &device_name);

    // Slå opp iPad's adresser/port for å kunne sende TCP PAIR-request
    let target = state.list_discovered().into_iter().find(|d| d.fullname == fullname);
    let Some(target) = target else {
        return Err(format!("iPad ikke i discovered-state: {}", fullname));
    };
    let identity = desk_identity::load_or_create()?;
    let app_clone = app.clone();
    let state_clone: Arc<IpadPairingState> = state.inner().clone();
    let pin_value = pin.pin.clone();
    let target_name = target.device_name.clone();
    let target_addresses = target.addresses.clone();
    let target_port = target.port;
    let fullname_clone = fullname.clone();

    // Spawn auto-send. Når iPad svarer OK: confirm_pair_ipad-logikken
    // kjøres inline + pair-result-event emit'es. Frontend trenger ikke
    // gjøre noe annet enn å lytte på event-et.
    tokio::spawn(async move {
        let response = ipad_pairing::send_pair_request(
            &target_addresses,
            target_port,
            &identity.desk_id,
            &identity.desk_name,
            &pin_value,
        )
        .await;
        match response {
            ipad_pairing::PairResponse::Ok { ipad_device_id } => {
                // Upsert in paired.json
                let mut list = ipad_pairing::load_paired();
                if !list.iter().any(|p| p.device_id == ipad_device_id) {
                    list.push(PairedIpad {
                        device_id: ipad_device_id.clone(),
                        device_name: target_name,
                        paired_at_iso: chrono_now_iso(),
                    });
                    if let Err(err) = ipad_pairing::save_paired(&list) {
                        eprintln!("[pair] save_paired failed: {}", err);
                    }
                }
                state_clone.clear_pin();
                let _ = app_clone.emit(
                    "pair-result",
                    PairResultEvent {
                        fullname: fullname_clone,
                        success: true,
                        ipad_device_id: Some(ipad_device_id),
                        error: None,
                    },
                );
            }
            ipad_pairing::PairResponse::Err(err) => {
                let _ = app_clone.emit(
                    "pair-result",
                    PairResultEvent {
                        fullname: fullname_clone,
                        success: false,
                        ipad_device_id: None,
                        error: Some(err),
                    },
                );
            }
        }
    });

    Ok(pin)
}

#[tauri::command]
fn cancel_pairing_pin(state: tauri::State<Arc<IpadPairingState>>) {
    state.clear_pin();
}

/// Manuell paring uten iPad-confirmation — for F5 (Mac-only). I F5+ vil
/// iPad selv kalle dette endepunktet via lokal HTTP-server etter at
/// brukeren har tastet PIN på iPad-en.
#[tauri::command]
fn confirm_pair_ipad(device_id: String, device_name: String) -> Result<Vec<PairedIpad>, String> {
    if device_id.trim().is_empty() {
        return Err("device_id mangler".into());
    }
    let mut list = ipad_pairing::load_paired();
    if !list.iter().any(|p| p.device_id == device_id) {
        list.push(PairedIpad {
            device_id,
            device_name,
            paired_at_iso: chrono_now_iso(),
        });
        ipad_pairing::save_paired(&list)?;
    }
    Ok(list)
}

#[tauri::command]
async fn list_capture_sessions() -> Result<Vec<CaptureSessionSummary>, String> {
    let cfg = helper_client::load_config()?
        .ok_or_else(|| "Ingen lagret config".to_string())?;
    helper_client::list_capture_sessions(&cfg).await
}

#[tauri::command]
fn start_capture_subscription(
    app: tauri::AppHandle,
    state: tauri::State<Arc<CaptureSubscriberState>>,
    mirror_state: tauri::State<Arc<MirrorState>>,
    session_id: String,
) -> Result<(), String> {
    let cfg = helper_client::load_config()?
        .ok_or_else(|| "Ingen lagret config — paste token først".to_string())?;
    capture_subscriber::start_subscription(
        app,
        state.inner().clone(),
        mirror_state.inner().clone(),
        cfg.api_base,
        cfg.token,
        session_id,
    )
}

#[tauri::command]
fn enable_mirror_for_session(
    state: tauri::State<Arc<MirrorState>>,
    session_id: String,
    destinations: Vec<MirrorDestination>,
) {
    state.enable(session_id, destinations);
}

#[tauri::command]
fn disable_mirror_for_session(
    state: tauri::State<Arc<MirrorState>>,
    session_id: String,
) -> bool {
    state.disable(&session_id)
}

#[tauri::command]
fn enabled_mirror_sessions(state: tauri::State<Arc<MirrorState>>) -> Vec<String> {
    state.enabled_sessions()
}

#[tauri::command]
fn stop_capture_subscription(
    state: tauri::State<Arc<CaptureSubscriberState>>,
    session_id: String,
) -> bool {
    state.stop(&session_id)
}

#[tauri::command]
fn list_active_capture_subscriptions(
    state: tauri::State<Arc<CaptureSubscriberState>>,
) -> Vec<String> {
    state.list_active()
}

#[tauri::command]
fn unpair_ipad(device_id: String) -> Result<Vec<PairedIpad>, String> {
    let list: Vec<PairedIpad> = ipad_pairing::load_paired()
        .into_iter()
        .filter(|p| p.device_id != device_id)
        .collect();
    ipad_pairing::save_paired(&list)?;
    Ok(list)
}

fn chrono_now_iso() -> String {
    // Bruk samme ISO-formatter som dit_reporter, men inline her for å unngå
    // public re-export. SystemTime → UTC, sekund-presisjon er nok.
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let total_secs = now.as_secs();
    let secs_today = total_secs % 86400;
    let days = total_secs / 86400;
    let hours = secs_today / 3600;
    let minutes = (secs_today % 3600) / 60;
    let seconds = secs_today % 60;
    let z = days as i64 + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hours, minutes, seconds
    )
}

// ── Menu bar mini-tray ────────────────────────────────────────────
// Bruker Tauri 2's TrayIconBuilder. Tooltip oppdateres via
// set_tray_status-command som frontend kaller når backup-økter
// endrer state (start/progress/done).
//
// Click på tray = focus hovedvindu (eller åpne hvis lukket).
const TRAY_ICON_ID: &str = "main-tray";

fn setup_tray(handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    let show_main = MenuItem::with_id(handle, "show-main", "Vis Creatorhub One Desk", true, None::<&str>)?;
    let quit = MenuItem::with_id(handle, "quit", "Avslutt", true, None::<&str>)?;
    let menu = Menu::with_items(handle, &[&show_main, &quit])?;

    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .tooltip("Creatorhub One Desk")
        .icon(handle.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show-main" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Click på selve ikonet (utenom menu) → focus hovedvindu.
            if let tauri::tray::TrayIconEvent::Click { button, button_state, .. } = event {
                if matches!(button, tauri::tray::MouseButton::Left)
                    && matches!(button_state, tauri::tray::MouseButtonState::Up)
                {
                    let app = tray.app_handle();
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
        })
        .build(handle)?;
    Ok(())
}

/// Oppdater tray-tooltip dynamisk fra frontend. Kalles av
/// CopyProgressView når sesjoner endrer state, så Fredrik kan se
/// "2 aktive · 87 av 240 filer" uten å åpne hovedvinduet.
#[tauri::command]
fn set_tray_status(app: tauri::AppHandle, tooltip: String) -> Result<(), String> {
    use tauri::tray::TrayIcon;
    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        TrayIcon::set_tooltip(&tray, Some(tooltip))
            .map_err(|e| format!("set_tooltip: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .manage(MountWatcherState::default())
        .manage(Arc::new(CopySessionState::default()))
        .manage(Arc::new(IpadPairingState::default()))
        .manage(Arc::new(CaptureSubscriberState::default()))
        .manage(Arc::new(MirrorState::new_loaded()))
        .manage(Arc::new(projects::ProjectStore::default()))
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(err) = mount_watcher::spawn_watcher(handle.clone()) {
                eprintln!("Mount-watcher kunne ikke starte: {err}");
            }
            let pairing_state: tauri::State<Arc<IpadPairingState>> = app.state();
            if let Err(err) = ipad_pairing::spawn_browser(handle.clone(), pairing_state.inner().clone()) {
                eprintln!("iPad Bonjour-browser kunne ikke starte: {err}");
            }

            // Deep-link-handler: når macOS sender appen
            // creatorhub-one-desk://oauth-callback?token=...&email=... så
            // lagrer vi tokenet, henter prosjekter fra backend og emitter
            // event så frontend rerendrer.
            use tauri_plugin_deep_link::DeepLinkExt;
            let handle_clone = handle.clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let url_str = url.as_str();
                    let Some(dt) = device_auth::parse_oauth_callback_url(url_str) else {
                        continue;
                    };
                    if let Err(err) = device_auth::save_device_token(&dt) {
                        eprintln!("Lagre device-token feilet: {err}");
                        continue;
                    }
                    let h = handle_clone.clone();
                    let dt_clone = dt.clone();
                    tauri::async_runtime::spawn(async move {
                        let store: tauri::State<Arc<projects::ProjectStore>> = h.state();
                        match device_auth::fetch_projects_for_token(&dt_clone.api_base, &dt_clone.token).await {
                            Ok(entries) => {
                                if let Err(e) = store.replace_all(entries) {
                                    eprintln!("Lagre prosjekter feilet: {e}");
                                    return;
                                }
                                let _ = h.emit("desktop-auth-completed", &dt_clone.user_email);
                                // Bring vinduet til front så Fredrik ser at det funket
                                if let Some(window) = h.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            Err(e) => {
                                eprintln!("Hent prosjekter feilet: {e}");
                                let _ = h.emit("desktop-auth-failed", &e);
                            }
                        }
                    });
                }
            });

            // Menu bar / status bar mini-tray. Vises kun på macOS som
            // en liten ikon i status-baren ved siden av batterien.
            // Tooltip oppdateres dynamisk fra frontend via
            // set_tray_status-command når backup-økter starter/stopper.
            if let Err(err) = setup_tray(&handle) {
                eprintln!("Tray-icon kunne ikke starte: {err}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            default_api_base,
            load_stored_config,
            save_helper_config,
            clear_helper_config,
            device_token_status,
            start_google_login,
            start_google_login_v2,
            poll_oauth_completion,
            refresh_projects_from_api,
            desktop_logout,
            list_projects,
            active_project_id,
            set_active_project,
            remove_project,
            update_project_label,
            fetch_project_info,
            fetch_destinations_with_creds,
            test_b2_connection,
            fetch_bucket_usage,
            list_detected_mounts,
            get_prefs,
            save_default_dest_ids,
            rescan_mounts,
            eject_volume,
            get_auto_eject_pref,
            set_auto_eject_pref,
            check_destinations_capacity,
            macos_notification,
            start_copy_session,
            cancel_copy_session,
            list_copy_sessions,
            list_interrupted_sessions,
            resume_interrupted_session,
            discard_interrupted_session,
            list_discovered_ipads,
            add_manual_ipad,
            list_paired_ipads,
            current_pairing_pin,
            generate_pairing_pin,
            cancel_pairing_pin,
            confirm_pair_ipad,
            current_desk_identity,
            unpair_ipad,
            list_capture_sessions,
            start_capture_subscription,
            stop_capture_subscription,
            list_active_capture_subscriptions,
            enable_mirror_for_session,
            disable_mirror_for_session,
            enabled_mirror_sessions,
            set_tray_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Creatorhub One Desk");
}

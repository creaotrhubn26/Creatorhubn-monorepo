//! Creatorhub One Desk — Tauri backend.
//!
//! F1: helper-token-auth + project-info-fetch.
//! F2: mount-deteksjon + emit av `mounts-changed`-event.
//! F3: copy-engine (xxHash64 + parallell kopi til N destinasjoner).
//! F4+ legger til backend-rapportering, iPad-paring, live mirror.

mod capture_mirror;
mod capture_subscriber;
mod copy_engine;
mod copy_session;
mod dit_reporter;
mod helper_client;
mod ipad_pairing;
mod mount_watcher;
mod session_log;

use std::sync::Arc;

use capture_mirror::{MirrorDestination, MirrorState};
use capture_subscriber::CaptureSubscriberState;
use copy_session::{CopySessionState, DestinationSpec, SessionSpec, SessionStatus};
use helper_client::{CaptureSessionSummary, Config, ProjectInfo};
use ipad_pairing::{DiscoveredIpad, IpadPairingState, PairedIpad, PendingPin};
use mount_watcher::{DetectedMount, MountWatcherState};
use serde::Serialize;
use tauri::Manager;

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

#[tauri::command]
async fn fetch_project_info() -> Result<ProjectInfo, String> {
    let cfg = helper_client::load_config()?
        .ok_or_else(|| "Ingen lagret config — paste token først".to_string())?;
    helper_client::get_project_info(&cfg).await
}

#[tauri::command]
fn list_detected_mounts(state: tauri::State<MountWatcherState>) -> Vec<DetectedMount> {
    mount_watcher::list_mounts(&state)
}

#[tauri::command]
fn rescan_mounts(state: tauri::State<MountWatcherState>) -> Vec<DetectedMount> {
    mount_watcher::rescan(&state)
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

#[tauri::command]
fn list_paired_ipads() -> Vec<PairedIpad> {
    ipad_pairing::load_paired()
}

#[tauri::command]
fn current_pairing_pin(state: tauri::State<Arc<IpadPairingState>>) -> Option<PendingPin> {
    state.current_pin()
}

#[tauri::command]
fn generate_pairing_pin(
    state: tauri::State<Arc<IpadPairingState>>,
    fullname: String,
    device_name: String,
) -> PendingPin {
    state.generate_pin(&fullname, &device_name)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(MountWatcherState::default())
        .manage(Arc::new(CopySessionState::default()))
        .manage(Arc::new(IpadPairingState::default()))
        .manage(Arc::new(CaptureSubscriberState::default()))
        .manage(Arc::new(MirrorState::default()))
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(err) = mount_watcher::spawn_watcher(handle.clone()) {
                eprintln!("Mount-watcher kunne ikke starte: {err}");
            }
            let pairing_state: tauri::State<Arc<IpadPairingState>> = app.state();
            if let Err(err) = ipad_pairing::spawn_browser(handle, pairing_state.inner().clone()) {
                eprintln!("iPad Bonjour-browser kunne ikke starte: {err}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            default_api_base,
            load_stored_config,
            save_helper_config,
            clear_helper_config,
            fetch_project_info,
            list_detected_mounts,
            rescan_mounts,
            start_copy_session,
            cancel_copy_session,
            list_copy_sessions,
            list_interrupted_sessions,
            resume_interrupted_session,
            discard_interrupted_session,
            list_discovered_ipads,
            list_paired_ipads,
            current_pairing_pin,
            generate_pairing_pin,
            cancel_pairing_pin,
            confirm_pair_ipad,
            unpair_ipad,
            list_capture_sessions,
            start_capture_subscription,
            stop_capture_subscription,
            list_active_capture_subscriptions,
            enable_mirror_for_session,
            disable_mirror_for_session,
            enabled_mirror_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Creatorhub One Desk");
}

//! Creatorhub One Desk — Tauri backend.
//!
//! F1: helper-token-auth + project-info-fetch.
//! F2: mount-deteksjon + emit av `mounts-changed`-event.
//! F3: copy-engine (xxHash64 + parallell kopi til N destinasjoner).
//! F4+ legger til backend-rapportering, iPad-paring, live mirror.

mod copy_engine;
mod copy_session;
mod helper_client;
mod mount_watcher;

use std::sync::Arc;

use copy_session::{CopySessionState, DestinationSpec, SessionSpec, SessionStatus};
use helper_client::{Config, ProjectInfo};
use mount_watcher::{DetectedMount, MountWatcherState};
use serde::Serialize;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(MountWatcherState::default())
        .manage(Arc::new(CopySessionState::default()))
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(err) = mount_watcher::spawn_watcher(handle) {
                eprintln!("Mount-watcher kunne ikke starte: {err}");
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Creatorhub One Desk");
}

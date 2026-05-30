//! Creatorhub One Desk — Tauri backend.
//!
//! F1: helper-token-auth + project-info-fetch.
//! F2: mount-deteksjon + emit av `mounts-changed`-event.
//! F3+ legger til copy-engine, iPad-paring, live mirror.

mod helper_client;
mod mount_watcher;

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

/// Returnerer lagret config UTEN selve tokenet — bare metadata (api_base,
/// project_id, has_token-flag). Tokenet eksponeres aldri til frontend etter
/// at det er lagret; det brukes kun internt i Rust-prosessen.
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

/// Henter prosjekt-info fra backend ved hjelp av lagret token.
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(MountWatcherState::default())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Creatorhub One Desk");
}

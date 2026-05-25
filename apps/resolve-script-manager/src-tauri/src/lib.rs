//! The Role Room Post Agent — Tauri backend.
//!
//! Exposes commands consumed by the React frontend via `invoke()`.

mod card_watcher;
mod cull;
mod folder_watcher;
mod history;
mod media_probe;
mod python;
mod role_room_api;

use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use card_watcher::{CardWatcherState, MountedCard};
use cull::CullSession;
use folder_watcher::{FolderWatcherState, WatchedFolder};
use history::HistoryRecord;
use std::collections::HashMap;

use python::{python_root, spawn_python, AppSettings, RunSummary, RunningScriptsState};

fn persist_run(app: &AppHandle, summary: &RunSummary) {
    if let Err(err) = history::append(app, summary) {
        eprintln!("Failed to persist run history: {}", err);
    }
}

fn read_json(path: std::path::PathBuf) -> Result<Value, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Read {}: {}", path.display(), e))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("Parse {}: {}", path.display(), e))
}

#[tauri::command]
async fn list_scripts(app: AppHandle) -> Result<Value, String> {
    read_json(python_root(&app)?.join("registry.json"))
}

#[tauri::command]
async fn list_workflows(app: AppHandle) -> Result<Value, String> {
    read_json(python_root(&app)?.join("templates").join("workflows.json"))
}

#[tauri::command]
async fn read_wedding_template(app: AppHandle) -> Result<Value, String> {
    read_json(python_root(&app)?.join("templates").join("wedding_bins.json"))
}

#[tauri::command]
async fn read_look_pack(app: AppHandle, pack_id: Option<String>) -> Result<Value, String> {
    let templates_dir = python_root(&app)?.join("templates");
    // pack_id "norwedfilm_look_pack" → "norwedfilm_look_pack.json", default to that for backwards compat
    let file_name = pack_id
        .filter(|s| !s.is_empty())
        .map(|s| format!("{}.json", s))
        .unwrap_or_else(|| "norwedfilm_look_pack.json".to_string());
    read_json(templates_dir.join(file_name))
}

#[tauri::command]
async fn list_project_templates(app: AppHandle) -> Result<Value, String> {
    read_json(python_root(&app)?.join("templates").join("_index.json"))
}

#[tauri::command]
async fn read_project_template(app: AppHandle, template_id: String) -> Result<Value, String> {
    let templates_dir = python_root(&app)?.join("templates");
    // Look up the file from the index, fall back to <id>.json
    let index = read_json(templates_dir.join("_index.json"))?;
    let templates = index
        .get("templates")
        .and_then(|t| t.as_array())
        .ok_or("templates array missing")?;
    let entry = templates
        .iter()
        .find(|t| t.get("id").and_then(|v| v.as_str()) == Some(&template_id))
        .ok_or_else(|| format!("Project template '{}' not found", template_id))?;
    let file = entry
        .get("file")
        .and_then(|v| v.as_str())
        .ok_or("template entry missing 'file'")?;
    read_json(templates_dir.join(file))
}

#[tauri::command]
async fn list_look_packs(app: AppHandle) -> Result<Value, String> {
    read_json(python_root(&app)?.join("templates").join("look_packs_index.json"))
}

/// Launch DaVinci Resolve.app via `open -a`.
#[tauri::command]
async fn launch_resolve() -> Result<String, String> {
    let candidates = [
        "/Applications/DaVinci Resolve.app",
        "/Applications/DaVinci Resolve/DaVinci Resolve.app",
        "/Applications/DaVinci Resolve Studio.app",
    ];
    let resolve_path = candidates
        .iter()
        .find(|p| std::path::Path::new(p).exists())
        .ok_or("DaVinci Resolve.app not found in /Applications")?;
    let output = std::process::Command::new("open")
        .arg("-a")
        .arg(resolve_path)
        .output()
        .map_err(|e| format!("Failed to spawn open: {}", e))?;
    if !output.status.success() {
        return Err(format!(
            "open -a failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(format!("Launched {}", resolve_path))
}

/// Activate Resolve and send cmd+, via osascript to open the Preferences dialog.
#[tauri::command]
async fn open_resolve_preferences() -> Result<String, String> {
    let script = r#"
tell application "DaVinci Resolve" to activate
delay 0.5
tell application "System Events"
    keystroke "," using command down
end tell
"#;
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Failed to spawn osascript: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not allowed assistive access") || stderr.contains("1002") {
            return Err(
                "macOS Accessibility permission required. Grant 'The Role Room Post Agent' \
                 access in System Settings → Privacy & Security → Accessibility, then retry."
                    .to_string(),
            );
        }
        return Err(format!("osascript failed: {}", stderr));
    }
    Ok("Resolve activated and Preferences opened (cmd+,)".to_string())
}

/// Cancel a running Python script by run_id — sends SIGKILL to the underlying child PID.
#[tauri::command]
fn cancel_script(state: tauri::State<RunningScriptsState>, run_id: String) -> Result<bool, String> {
    let pid = state.take(&run_id);
    let Some(pid) = pid else {
        return Ok(false);
    };
    let output = std::process::Command::new("kill")
        .arg("-9")
        .arg(pid.to_string())
        .output()
        .map_err(|e| format!("Failed to send SIGKILL: {}", e))?;
    if !output.status.success() {
        return Ok(false);
    }
    Ok(true)
}

#[tauri::command]
fn list_running_scripts(state: tauri::State<RunningScriptsState>) -> Vec<(String, u32)> {
    state.list()
}

/// Replace the env-var map injected into every Python subprocess.
#[tauri::command]
fn update_app_settings(state: tauri::State<AppSettings>, settings: HashMap<String, String>) {
    state.set_all(settings);
}

#[tauri::command]
fn get_app_settings(state: tauri::State<AppSettings>) -> HashMap<String, String> {
    state.snapshot()
}

/// Start watching a folder for new video/audio files. Emits `folder-clips-added` when new clips land.
#[tauri::command]
fn start_watching_folder(
    app: AppHandle,
    state: tauri::State<FolderWatcherState>,
    folder_path: String,
) -> Result<(), String> {
    folder_watcher::start_watching(app, &state, folder_path)
}

#[tauri::command]
fn stop_watching_folder(
    app: AppHandle,
    state: tauri::State<FolderWatcherState>,
    folder_path: String,
) -> Result<(), String> {
    folder_watcher::stop_watching(app, &state, &folder_path)
}

#[tauri::command]
fn list_watched_folders(state: tauri::State<FolderWatcherState>) -> Vec<WatchedFolder> {
    folder_watcher::list_watched(&state)
}

/// Open Finder at the Resolve configs folder (the .config file lives here).
#[tauri::command]
async fn reveal_resolve_configs() -> Result<String, String> {
    let path = std::path::PathBuf::from(std::env::var("HOME").unwrap_or_default())
        .join("Library/Application Support/Blackmagic Design/DaVinci Resolve/configs");
    if !path.exists() {
        return Err(format!(
            "Resolve configs folder not found at {}",
            path.display()
        ));
    }
    let output = std::process::Command::new("open")
        .arg(&path)
        .output()
        .map_err(|e| format!("Failed to spawn open: {}", e))?;
    if !output.status.success() {
        return Err(format!(
            "open failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(path.display().to_string())
}

#[tauri::command]
async fn run_health_check(app: AppHandle) -> Result<RunSummary, String> {
    let script = python_root(&app)?.join("health_check.py");
    let run_id = Uuid::new_v4().to_string();
    let summary = spawn_python(
        app.clone(),
        run_id,
        "health_check".to_string(),
        script,
        Value::Null,
        false,
    )
    .await?;
    persist_run(&app, &summary);
    Ok(summary)
}

#[tauri::command]
async fn execute_script(
    app: AppHandle,
    script_id: String,
    params: Value,
    dry_run: bool,
) -> Result<RunSummary, String> {
    let registry = read_json(python_root(&app)?.join("registry.json"))?;
    let script_meta = registry
        .get("scripts")
        .and_then(|s| s.as_array())
        .ok_or("registry.scripts is missing or not an array")?
        .iter()
        .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(&script_id))
        .ok_or_else(|| format!("Script id '{}' not found in registry", script_id))?
        .clone();

    let rel_path = script_meta
        .get("scriptPath")
        .and_then(|v| v.as_str())
        .ok_or("scriptPath field missing on registry entry")?;

    let script_path = python_root(&app)?.join(rel_path);
    if !script_path.exists() {
        return Err(format!(
            "Script file not found at {}",
            script_path.display()
        ));
    }

    let run_id = Uuid::new_v4().to_string();
    let summary = spawn_python(
        app.clone(),
        run_id,
        script_id,
        script_path,
        params,
        dry_run,
    )
    .await?;
    persist_run(&app, &summary);
    Ok(summary)
}

#[tauri::command]
async fn get_run_history(app: AppHandle) -> Result<Vec<HistoryRecord>, String> {
    history::read_all(&app)
}

#[tauri::command]
async fn clear_run_history(app: AppHandle) -> Result<(), String> {
    history::clear(&app)
}

#[tauri::command]
async fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    history::data_dir_path(&app)
}

#[tauri::command]
fn list_mounted_cards(state: State<CardWatcherState>) -> Vec<MountedCard> {
    card_watcher::list_cards(&state)
}

#[tauri::command]
fn rescan_cards(state: State<CardWatcherState>) -> Vec<MountedCard> {
    card_watcher::rescan(&state)
}

#[tauri::command]
fn scan_folder(path: String) -> Result<MountedCard, String> {
    card_watcher::scan_arbitrary_folder(&PathBuf::from(path))
}

#[tauri::command]
async fn save_cull_session(app: AppHandle, session: CullSession) -> Result<String, String> {
    cull::save_session(&app, &session)
}

#[tauri::command]
async fn load_cull_session(app: AppHandle, session_id: String) -> Result<Option<CullSession>, String> {
    cull::load_session(&app, &session_id)
}

#[tauri::command]
async fn list_cull_sessions(app: AppHandle) -> Result<Vec<cull::CullSessionSummary>, String> {
    cull::list_sessions(&app)
}

#[tauri::command]
async fn open_script_folder(app: AppHandle) -> Result<String, String> {
    use tauri_plugin_opener::OpenerExt;
    let path = python_root(&app)?;
    let path_str = path.display().to_string();
    app.opener()
        .open_path(&path_str, None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(path_str)
}

#[tauri::command]
async fn get_python_root(app: AppHandle) -> Result<String, String> {
    Ok(python_root(&app)?.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(CardWatcherState::default())
        .manage(RunningScriptsState::default())
        .manage(AppSettings::default())
        .manage(FolderWatcherState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(err) = card_watcher::spawn_watcher(handle) {
                eprintln!("Failed to start card watcher: {}", err);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_scripts,
            list_workflows,
            read_wedding_template,
            read_look_pack,
            list_project_templates,
            read_project_template,
            list_look_packs,
            launch_resolve,
            open_resolve_preferences,
            reveal_resolve_configs,
            run_health_check,
            execute_script,
            open_script_folder,
            get_python_root,
            get_run_history,
            clear_run_history,
            get_app_data_dir,
            list_mounted_cards,
            rescan_cards,
            scan_folder,
            save_cull_session,
            load_cull_session,
            list_cull_sessions,
            cancel_script,
            list_running_scripts,
            update_app_settings,
            get_app_settings,
            start_watching_folder,
            stop_watching_folder,
            list_watched_folders,
            role_room_api::role_room_fetch_scenes,
            role_room_api::role_room_fetch_equipment,
            role_room_api::role_room_fetch_live_set_state,
            role_room_api::role_room_my_productions,
            role_room_api::role_room_my_seats,
            role_room_api::role_room_fetch_clip_download_urls,
            role_room_api::role_room_download_clip,
            media_probe::probe_media_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

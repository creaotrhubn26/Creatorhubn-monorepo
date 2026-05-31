//! The Role Room Post Agent — Tauri backend.
//!
//! Exposes commands consumed by the React frontend via `invoke()`.

mod card_watcher;
mod cull;
mod folder_watcher;
mod history;
mod media_probe;
mod photoshop_bridge;
mod psd_indexer;
mod python;
mod role_room_api;

use std::path::PathBuf;

use serde_json::Value;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_deep_link::DeepLinkExt;
use uuid::Uuid;

use card_watcher::{CardWatcherState, MountedCard};
use cull::CullSession;
use folder_watcher::{FolderWatcherState, WatchedFolder};
use history::HistoryRecord;
use photoshop_bridge::PhotoshopBridgeState;
use std::collections::HashMap;
use std::sync::Arc;

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

/// Claude chat — proxies via The Role Room backend (/api/post-agent/anthropic/messages).
/// Backend håndterer entitlement-check, rate-limiting og usage-tracking per
/// bruker. Brukes av CreativeEditorView's Claude Co-Editor panel.
///
/// Auth-prioritet:
///   1. RR_BEARER_TOKEN → proxy via Role Room (tracked usage, foretrukket)
///   2. ANTHROPIC_API_KEY → direkte til api.anthropic.com (dev/admin fallback,
///      hopper over usage-tracking — bør kun brukes lokalt)
#[tauri::command]
async fn claude_chat(
    app: AppHandle,
    messages: Vec<Value>,
    system: Option<String>,
    model: Option<String>,
    max_tokens: Option<u32>,
    tools: Option<Vec<Value>>,
) -> Result<Value, String> {
    let (bearer, base_url, api_key) = if let Some(settings) = app.try_state::<AppSettings>() {
        let snap = settings.snapshot();
        (
            snap.get("RR_BEARER_TOKEN").cloned().unwrap_or_default(),
            snap.get("RR_POST_AGENT_BASE_URL")
                .cloned()
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "https://creatorhubn.com/api/post-agent".to_string()),
            snap.get("ANTHROPIC_API_KEY").cloned().unwrap_or_default(),
        )
    } else {
        (String::new(), "https://creatorhubn.com/api/post-agent".to_string(), String::new())
    };

    if bearer.is_empty() && api_key.is_empty() {
        return Err("Ikke logget inn til The Role Room (RR_BEARER_TOKEN mangler) og ingen ANTHROPIC_API_KEY. Logg inn fra Settings.".into());
    }

    let model = model.unwrap_or_else(|| "claude-opus-4-7".to_string());
    let max_tokens = max_tokens.unwrap_or(1024);
    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages,
    });
    if let Some(sys) = system { body["system"] = Value::String(sys); }
    if let Some(t) = tools { body["tools"] = Value::Array(t); }

    let client = reqwest::Client::new();
    let resp = if !bearer.is_empty() {
        // Proxy via Role Room — usage tracking + entitlement-check skjer på backend
        let trimmed_base = base_url.trim_end_matches('/');
        client
            .post(format!("{}/anthropic/messages", trimmed_base))
            .header("Authorization", format!("Bearer {}", bearer))
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Role Room proxy request failed: {}", e))?
    } else {
        // Fallback: direkte til Anthropic (dev/admin) — NB: hopper over usage-tracking
        client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Anthropic request failed: {}", e))?
    };

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Read Anthropic response: {}", e))?;
    if !status.is_success() {
        return Err(format!("Anthropic API {}: {}", status, text));
    }
    serde_json::from_str(&text).map_err(|e| format!("Parse Anthropic response: {}", e))
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

/// (#614) Reads the user-learning profile from disk so the LearningView
/// UI can display what the system has learned. Returns:
///   { global: <profile>, projects: { name: <profile> }, sessions: [...] }
/// where each profile is the JSON shape written by learn_from_user_edit.py.
#[tauri::command]
async fn read_learning_profile() -> Result<Value, String> {
    let base = std::path::PathBuf::from(
        std::env::var("HOME").map_err(|e| format!("HOME not set: {}", e))?,
    )
    .join("Library/Application Support/no.creatorhubn.roleroom-post-agent/preferences");

    let read_json = |p: &std::path::Path| -> Option<Value> {
        let bytes = std::fs::read(p).ok()?;
        serde_json::from_slice::<Value>(&bytes).ok()
    };

    let global = read_json(&base.join("profile.json"))
        .unwrap_or_else(|| serde_json::json!({}));

    // Per-project profiles
    let mut projects: HashMap<String, Value> = HashMap::new();
    if let Ok(entries) = std::fs::read_dir(base.join("by_project")) {
        for e in entries.flatten() {
            let path = e.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(v) = read_json(&path) {
                        projects.insert(name.to_string(), v);
                    }
                }
            }
        }
    }

    // Recent learning-session records (each session = one learn_from_user_edit run)
    let mut sessions: Vec<Value> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&base) {
        let mut paths: Vec<_> = entries
            .flatten()
            .map(|e| e.path())
            .filter(|p| {
                p.file_name()
                    .and_then(|s| s.to_str())
                    .map(|n| n.starts_with("edit_") && n.ends_with(".json"))
                    .unwrap_or(false)
            })
            .collect();
        paths.sort_by(|a, b| b.cmp(a)); // newest first by name (timestamp)
        for path in paths.into_iter().take(10) {
            if let Some(mut v) = read_json(&path) {
                if let Some(obj) = v.as_object_mut() {
                    obj.insert(
                        "_path".into(),
                        Value::String(path.display().to_string()),
                    );
                    obj.insert(
                        "_filename".into(),
                        Value::String(
                            path.file_name()
                                .and_then(|s| s.to_str())
                                .unwrap_or("")
                                .to_string(),
                        ),
                    );
                }
                sessions.push(v);
            }
        }
    }

    Ok(serde_json::json!({
        "global": global,
        "projects": projects,
        "recentSessions": sessions,
    }))
}

/// (#186 + #187) Build the native macOS menubar with the standard
/// App / File / Edit / View / Window structure. Adds a custom
/// "Re-run last workflow" item under File with cmd+R shortcut that
/// emits a `menu://rerun-last` event to the frontend, which then
/// invokes the actual workflow.
fn build_menu(app: &AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    let app_submenu = SubmenuBuilder::new(app, "The Role Room Post Agent")
        .item(&PredefinedMenuItem::about(app, Some("About"), Some(AboutMetadata::default()))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let rerun_item = MenuItemBuilder::with_id("menu_rerun_last", "Re-run last workflow")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let new_workflow_item = MenuItemBuilder::with_id("menu_new_workflow", "New workflow…")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let check_updates_item = MenuItemBuilder::with_id("menu_check_updates", "Check for updates…")
        .build(app)?;
    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&new_workflow_item)
        .item(&rerun_item)
        .separator()
        .item(&check_updates_item)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::bring_all_to_front(app, None)?)
        .build()?;

    MenuBuilder::new(app)
        .items(&[
            &app_submenu, &file_submenu, &edit_submenu, &view_submenu, &window_submenu,
        ])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .manage(CardWatcherState::default())
        .manage(RunningScriptsState::default())
        .manage(AppSettings::default())
        .manage(FolderWatcherState::default())
        .manage(Arc::new(PhotoshopBridgeState::default()))
        .setup(|app| {
            // (#186/#187) Build + attach native menubar
            let handle = app.handle().clone();
            match build_menu(&handle) {
                Ok(menu) => {
                    if let Err(err) = app.set_menu(menu) {
                        eprintln!("set_menu failed: {}", err);
                    }
                }
                Err(err) => eprintln!("build_menu failed: {}", err),
            }
            // Forward menu events to frontend as "menu://<id>" events
            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                let event_name = format!("menu://{}", id.trim_start_matches("menu_"));
                if let Err(err) = app_handle.emit(&event_name, ()) {
                    eprintln!("Failed to emit menu event {}: {}", event_name, err);
                }
            });
            // Deep-link handler: når /link-siden i web åpner postagent://focus
            // (etter vellykket pairing) skal vi bringe hovedvinduet til front.
            // Plugin håndterer OS-registreringen automatisk basert på
            // plugins.deep-link.desktop.schemes i tauri.conf.json.
            let deep_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                eprintln!("Deep link received: {:?}", urls);
                if let Some(window) = deep_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                // Forward til frontend så den kan reagere (f.eks. polle
                // pairing umiddelbart hvis kode er i URL-en).
                if let Err(err) = deep_handle.emit("deep-link://received", urls) {
                    eprintln!("Failed to emit deep-link event: {}", err);
                }
            });
            if let Err(err) = card_watcher::spawn_watcher(handle.clone()) {
                eprintln!("Failed to start card watcher: {}", err);
            }
            // Start lokal WS-server for Photoshop UXP-plugin (port 1733).
            let bridge_state = app
                .state::<Arc<PhotoshopBridgeState>>()
                .inner()
                .clone();
            photoshop_bridge::spawn_server(handle, bridge_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_scripts,
            list_workflows,
            claude_chat,
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
            read_learning_profile,
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
            photoshop_bridge::photoshop_send_command,
            photoshop_bridge::photoshop_status,
            psd_indexer::psd_index_directory,
            psd_indexer::psd_get_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

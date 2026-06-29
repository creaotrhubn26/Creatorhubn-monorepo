//! Creatorhub Pro Tools Companion — Tauri-backend.
//!
//! Kobler seg til CreatorHub via en paringskode (→ device-token), lar brukeren
//! peke på Pro Tools «Session Info»-eksport + «Bounced Files»-mappe, og pusher
//! markører/metadata/bounces inn i den koblede EaseVerse-låtens Sound Room.

mod api_client;
mod config;
mod processing;
mod ptx_parser;
mod state;
mod watcher;

use std::sync::{Arc, Mutex};

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use processing::{BounceResult, SyncResult};
use state::{snapshot, SharedConfig, SharedWatcher, WatcherCtl};

#[derive(Serialize)]
struct AppStateDto {
    api_base: String,
    paired: bool,
    user_email: Option<String>,
    session_id: Option<String>,
    session_name: Option<String>,
    session_info_path: Option<String>,
    bounce_dir: Option<String>,
    easeverse_track_id: Option<String>,
    audio_room_id: Option<String>,
    watching: bool,
}

#[derive(Serialize)]
struct PairResult {
    user_email: String,
}

#[derive(Serialize)]
struct SessionInfoDto {
    id: String,
    name: String,
    linked_review: Option<String>,
}

#[tauri::command]
fn default_api_base() -> String {
    config::DEFAULT_API_BASE.to_string()
}

#[tauri::command]
fn get_state(cfg: State<'_, SharedConfig>, w: State<'_, SharedWatcher>) -> AppStateDto {
    let c = cfg.lock().unwrap();
    AppStateDto {
        api_base: c.api_base.clone(),
        paired: c.device_token.as_deref().map(|s| !s.is_empty()).unwrap_or(false),
        user_email: c.user_email.clone(),
        session_id: c.session_id.clone(),
        session_name: c.session_name.clone(),
        session_info_path: c.session_info_path.clone(),
        bounce_dir: c.bounce_dir.clone(),
        easeverse_track_id: c.easeverse_track_id.clone(),
        audio_room_id: c.audio_room_id.clone(),
        watching: watcher::is_running(w.inner()),
    }
}

#[tauri::command]
async fn pair(code: String, api_base: String, cfg: State<'_, SharedConfig>) -> Result<PairResult, String> {
    let base = {
        let t = api_base.trim();
        if t.is_empty() { config::DEFAULT_API_BASE.to_string() } else { t.to_string() }
    };
    let (token, email) = api_client::claim_pair(&base, code.trim()).await?;
    {
        let mut c = cfg.lock().unwrap();
        c.api_base = base;
        c.device_token = Some(token);
        c.user_email = Some(email.clone());
        config::save(&c)?;
    }
    Ok(PairResult { user_email: email })
}

#[tauri::command]
fn unpair(app: AppHandle, cfg: State<'_, SharedConfig>, w: State<'_, SharedWatcher>) -> Result<(), String> {
    watcher::stop(&app, w.inner());
    let mut c = cfg.lock().unwrap();
    c.device_token = None;
    c.user_email = None;
    c.session_id = None;
    c.session_name = None;
    c.easeverse_track_id = None;
    c.audio_room_id = None;
    config::save(&c)
}

#[tauri::command]
async fn list_tracks(cfg: State<'_, SharedConfig>) -> Result<Value, String> {
    let snap = snapshot(cfg.inner());
    let token = snap.token.ok_or("Ikke paret")?;
    api_client::list_tracks(&snap.api_base, &token).await
}

#[tauri::command]
async fn setup_session(
    name: String,
    session_type: Option<String>,
    easeverse_track_id: Option<String>,
    audio_room_id: Option<String>,
    session_info_path: Option<String>,
    bounce_dir: Option<String>,
    cfg: State<'_, SharedConfig>,
) -> Result<SessionInfoDto, String> {
    let snap = snapshot(cfg.inner());
    let token = snap.token.ok_or("Ikke paret")?;
    let payload = json!({
        "name": name,
        "sessionType": session_type.unwrap_or_else(|| "mixing".to_string()),
        "easeverseTrackId": easeverse_track_id,
        "audioRoomId": audio_room_id,
        "sessionInfoPath": session_info_path,
        "bounceDir": bounce_dir,
    });
    let s = api_client::create_session(&snap.api_base, &token, payload).await?;
    let id = s.get("id").and_then(|v| v.as_str()).ok_or("Mangler session-id i svar")?.to_string();
    let linked = s.get("audio_review_project_id").and_then(|v| v.as_str()).map(|x| x.to_string());
    {
        let mut c = cfg.lock().unwrap();
        c.session_id = Some(id.clone());
        c.session_name = Some(name.clone());
        c.session_info_path = session_info_path;
        c.bounce_dir = bounce_dir;
        c.easeverse_track_id = easeverse_track_id;
        c.audio_room_id = linked.clone();
        config::save(&c)?;
    }
    Ok(SessionInfoDto { id, name, linked_review: linked })
}

#[tauri::command]
async fn sync_session_info(app: AppHandle, cfg: State<'_, SharedConfig>) -> Result<SyncResult, String> {
    processing::sync_session_info(cfg.inner(), &app).await
}

#[tauri::command]
async fn upload_bounce(path: String, app: AppHandle, cfg: State<'_, SharedConfig>) -> Result<BounceResult, String> {
    processing::upload_bounce(cfg.inner(), &app, std::path::Path::new(&path)).await
}

#[tauri::command]
fn start_watching(app: AppHandle, cfg: State<'_, SharedConfig>, w: State<'_, SharedWatcher>) -> Result<(), String> {
    watcher::start(app, cfg.inner().clone(), w.inner().clone())
}

#[tauri::command]
fn stop_watching(app: AppHandle, w: State<'_, SharedWatcher>) -> Result<(), String> {
    watcher::stop(&app, w.inner());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg: SharedConfig = Arc::new(Mutex::new(config::load()));
    let watcher_ctl: SharedWatcher = Arc::new(Mutex::new(WatcherCtl::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(cfg)
        .manage(watcher_ctl)
        .invoke_handler(tauri::generate_handler![
            default_api_base,
            get_state,
            pair,
            unpair,
            list_tracks,
            setup_session,
            sync_session_info,
            upload_bounce,
            start_watching,
            stop_watching
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

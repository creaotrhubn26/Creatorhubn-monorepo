//! Creatorhub Pro Tools Companion — Tauri-backend.
//!
//! Kobler seg til CreatorHub via en paringskode (→ device-token), lar brukeren
//! peke på Pro Tools «Session Info»-eksport + «Bounced Files»-mappe, og pusher
//! markører/metadata/bounces inn i den koblede EaseVerse-låtens Sound Room.

mod api_client;
mod command_processor;
mod config;
mod intro_preflight;
mod processing;
mod ptsl;
mod ptx_parser;
mod state;
mod watcher;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use processing::{BounceResult, SyncResult};
use state::{emit_activity, snapshot, SharedConfig, SharedWatcher, WatcherCtl};

const COMMAND_POLL_INTERVAL: Duration = Duration::from_secs(10);

fn command_polling_ready(config: &config::AppConfig) -> bool {
    config
        .device_token
        .as_deref()
        .is_some_and(|token| !token.trim().is_empty())
        && config
            .session_id
            .as_deref()
            .is_some_and(|session_id| !session_id.trim().is_empty())
}

fn start_command_polling(app: AppHandle, cfg: SharedConfig) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(COMMAND_POLL_INTERVAL);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            let ready = {
                let current = cfg.lock().unwrap();
                command_polling_ready(&current)
            };
            if !ready {
                continue;
            }
            // Server-side claiming is atomic. The foreground realtime handler
            // may drain at the same time, but each durable command is still
            // handed to at most one caller.
            let _ = command_processor::drain(&cfg, &app).await;
        }
    });
}

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
    workspace_project_id: Option<String>,
    easeverse_project_id: Option<String>,
    suggested_project_name: Option<String>,
    watching: bool,
    pending_bounces: usize,
    pending_session_info: bool,
    last_queue_error: Option<String>,
    protools_tier: String,
    intro_preflight: Option<intro_preflight::IntroPreflight>,
    ptsl: ptsl::PtslStatus,
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
        paired: c
            .device_token
            .as_deref()
            .map(|s| !s.is_empty())
            .unwrap_or(false),
        user_email: c.user_email.clone(),
        session_id: c.session_id.clone(),
        session_name: c.session_name.clone(),
        session_info_path: c.session_info_path.clone(),
        bounce_dir: c.bounce_dir.clone(),
        workspace_project_id: c.workspace_project_id.clone(),
        easeverse_project_id: c.easeverse_project_id.clone(),
        suggested_project_name: c.suggested_project_name.clone(),
        easeverse_track_id: c.easeverse_track_id.clone(),
        audio_room_id: c.audio_room_id.clone(),
        watching: watcher::is_running(w.inner()),
        pending_bounces: c.pending_bounces.len(),
        pending_session_info: c.session_info_pending,
        last_queue_error: c.session_info_last_error.clone().or_else(|| {
            c.pending_bounces
                .iter()
                .rev()
                .find_map(|item| item.last_error.clone())
        }),
        protools_tier: c.protools_tier.clone(),
        intro_preflight: c.intro_preflight.clone(),
        ptsl: ptsl::probe(),
    }
}

#[tauri::command]
async fn pair(
    code: String,
    api_base: String,
    cfg: State<'_, SharedConfig>,
) -> Result<PairResult, String> {
    let base = {
        let t = api_base.trim();
        if t.is_empty() {
            config::DEFAULT_API_BASE.to_string()
        } else {
            t.to_string()
        }
    };
    let (token, email, device_id, context) = api_client::claim_pair(&base, code.trim()).await?;
    {
        let mut c = cfg.lock().unwrap();
        c.api_base = base;
        c.device_token = Some(token);
        c.user_email = Some(email.clone());
        c.device_id = device_id;
        c.workspace_project_id = context
            .get("workspaceProjectId")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        c.audio_room_id = context
            .get("audioReviewProjectId")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        c.easeverse_track_id = context
            .get("easeverseTrackId")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        c.easeverse_project_id = context
            .get("easeverseProjectId")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        c.suggested_project_name = context
            .get("projectName")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        c.uploaded_bounces.clear();
        config::save(&c)?;
    }
    Ok(PairResult { user_email: email })
}

#[tauri::command]
async fn unpair(
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
    w: State<'_, SharedWatcher>,
) -> Result<(), String> {
    watcher::stop(&app, w.inner());
    let snap = snapshot(cfg.inner());
    if let Some(token) = snap.token.as_deref() {
        if let Err(error) = api_client::revoke_device(&snap.api_base, token).await {
            emit_activity(
                &app,
                "error",
                &format!(
                    "Server-frakobling feilet; lokal tilgang ble fjernet: {}",
                    error
                ),
            );
        }
    }
    let mut c = cfg.lock().unwrap();
    c.device_token = None;
    c.user_email = None;
    c.session_id = None;
    c.session_name = None;
    c.easeverse_track_id = None;
    c.device_id = None;
    c.workspace_project_id = None;
    c.audio_room_id = None;
    c.easeverse_project_id = None;
    c.suggested_project_name = None;
    c.uploaded_bounces.clear();
    c.pending_bounces.clear();
    c.auto_watch = false;
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
    protools_tier: Option<String>,
    cfg: State<'_, SharedConfig>,
) -> Result<SessionInfoDto, String> {
    let snap = snapshot(cfg.inner());
    let token = snap.token.ok_or("Ikke paret")?;
    let selected_track_id = easeverse_track_id.or(snap.easeverse_track_id.clone());
    let selected_audio_room_id = audio_room_id.or(snap.audio_room_id.clone());
    let selected_tier = match protools_tier.as_deref() {
        Some(tier @ ("artist" | "studio" | "flex")) => tier.to_string(),
        _ => "intro".to_string(),
    };
    let payload = json!({
        "name": name,
        "sessionType": session_type.unwrap_or_else(|| "mixing".to_string()),
        "easeverseTrackId": selected_track_id,
        "audioRoomId": selected_audio_room_id,
        "workspaceProjectId": snap.workspace_project_id,
        "easeverseProjectId": snap.easeverse_project_id,
        "ptxPath": session_info_path,
        "bounceDir": bounce_dir,
        "proToolsTier": selected_tier.clone(),
    });
    let s = api_client::create_session(&snap.api_base, &token, payload).await?;
    let id = s
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("Mangler session-id i svar")?
        .to_string();
    let linked = s
        .get("audio_review_project_id")
        .and_then(|v| v.as_str())
        .map(|x| x.to_string());
    {
        let mut c = cfg.lock().unwrap();
        c.session_id = Some(id.clone());
        c.session_name = Some(name.clone());
        c.session_info_path = session_info_path;
        c.bounce_dir = bounce_dir;
        c.easeverse_track_id = selected_track_id;
        c.audio_room_id = linked.clone();
        c.protools_tier = selected_tier;
        config::save(&c)?;
    }
    Ok(SessionInfoDto {
        id,
        name,
        linked_review: linked,
    })
}

#[tauri::command]
async fn sync_session_info(
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
) -> Result<SyncResult, String> {
    processing::sync_session_info(cfg.inner(), &app).await
}

#[tauri::command]
async fn upload_bounce(
    path: String,
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
) -> Result<BounceResult, String> {
    processing::upload_bounce(cfg.inner(), &app, std::path::Path::new(&path)).await
}

#[tauri::command]
async fn get_feedback(cfg: State<'_, SharedConfig>) -> Result<Value, String> {
    let snap = snapshot(cfg.inner());
    let token = snap.token.ok_or("Ikke paret")?;
    let session_id = snap.session_id.ok_or("Sesjon mangler")?;
    api_client::get_feedback(&snap.api_base, &token, &session_id).await
}

#[tauri::command]
async fn create_realtime_ticket(cfg: State<'_, SharedConfig>) -> Result<Value, String> {
    let snap = snapshot(cfg.inner());
    let token = snap.token.ok_or("Ikke paret")?;
    let session_id = snap.session_id.ok_or("Sesjon mangler")?;
    api_client::create_realtime_ticket(&snap.api_base, &token, &session_id).await
}

#[tauri::command]
async fn process_commands(
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
) -> Result<command_processor::CommandDrainResult, String> {
    command_processor::drain(cfg.inner(), &app).await
}

#[tauri::command]
async fn locate_feedback(seconds: f64) -> Result<Value, String> {
    if !seconds.is_finite() || seconds < 0.0 || seconds > 86_400.0 {
        return Err("Ugyldig tidskode".into());
    }
    ptsl::execute("locate", json!({ "seconds": seconds })).await
}

#[tauri::command]
async fn resolve_feedback(
    comment_id: String,
    cfg: State<'_, SharedConfig>,
) -> Result<Value, String> {
    let snap = snapshot(cfg.inner());
    let token = snap.token.ok_or("Ikke paret")?;
    let session_id = snap.session_id.ok_or("Sesjon mangler")?;
    api_client::feedback_action(
        &snap.api_base,
        &token,
        &session_id,
        &comment_id,
        json!({ "status": "resolved" }),
    )
    .await
}

#[tauri::command]
async fn reply_feedback(
    comment_id: String,
    body: String,
    cfg: State<'_, SharedConfig>,
) -> Result<Value, String> {
    if body.trim().is_empty() {
        return Err("Svaret er tomt".into());
    }
    let snap = snapshot(cfg.inner());
    let token = snap.token.ok_or("Ikke paret")?;
    let session_id = snap.session_id.ok_or("Sesjon mangler")?;
    api_client::feedback_action(
        &snap.api_base,
        &token,
        &session_id,
        &comment_id,
        json!({ "body": body.trim() }),
    )
    .await
}

#[tauri::command]
fn start_watching(
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
    w: State<'_, SharedWatcher>,
) -> Result<(), String> {
    {
        let mut current = cfg.lock().unwrap();
        current.auto_watch = true;
        config::save(&current)?;
    }
    watcher::start(app, cfg.inner().clone(), w.inner().clone())
}

#[tauri::command]
fn stop_watching(
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
    w: State<'_, SharedWatcher>,
) -> Result<(), String> {
    watcher::stop(&app, w.inner());
    let mut current = cfg.lock().unwrap();
    current.auto_watch = false;
    config::save(&current)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg: SharedConfig = Arc::new(Mutex::new(config::load()));
    let watcher_ctl: SharedWatcher = Arc::new(Mutex::new(WatcherCtl::default()));
    let startup_cfg = cfg.clone();
    let startup_watcher = watcher_ctl.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            start_command_polling(app.handle().clone(), startup_cfg.clone());
            if startup_cfg.lock().unwrap().auto_watch {
                if let Err(error) = watcher::start(
                    app.handle().clone(),
                    startup_cfg.clone(),
                    startup_watcher.clone(),
                ) {
                    emit_activity(
                        app.handle(),
                        "error",
                        &format!("Automatisk overvåking feilet: {}", error),
                    );
                }
            }
            Ok(())
        })
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
            get_feedback,
            create_realtime_ticket,
            process_commands,
            locate_feedback,
            resolve_feedback,
            reply_feedback,
            start_watching,
            stop_watching
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_command_polling_requires_pairing_and_session() {
        let mut config = config::AppConfig::default();
        assert!(!command_polling_ready(&config));

        config.device_token = Some("trr_desk_test".into());
        assert!(!command_polling_ready(&config));

        config.session_id = Some("session-test".into());
        assert!(command_polling_ready(&config));

        config.device_token = Some("  ".into());
        assert!(!command_polling_ready(&config));
    }
}

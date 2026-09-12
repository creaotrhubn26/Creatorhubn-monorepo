//! Creatorhub Pro Tools Companion — Tauri-backend.
//!
//! Kobler seg til CreatorHub via en paringskode (→ device-token), lar brukeren
//! peke på Pro Tools «Session Info»-eksport + «Bounced Files»-mappe, og pusher
//! markører/metadata/bounces inn i den koblede EaseVerse-låtens Sound Room.

mod api_client;
mod command_processor;
mod config;
mod intro_preflight;
mod local_ipc;
mod processing;
mod ptsl;
mod ptx_parser;
mod state;
mod watcher;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;
use tauri_plugin_updater::UpdaterExt;

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
    auto_watch: bool,
    pending_bounces: usize,
    pending_session_info: bool,
    last_queue_error: Option<String>,
    protools_tier: String,
    intro_preflight: Option<intro_preflight::IntroPreflight>,
    ptsl: ptsl::PtslStatus,
    local_ipc: local_ipc::LocalIpcStatus,
    last_feedback_sync_at: Option<String>,
    last_feedback_sync_error: Option<String>,
    last_session_fingerprint: Option<String>,
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
fn get_state(
    cfg: State<'_, SharedConfig>,
    w: State<'_, SharedWatcher>,
    ipc: State<'_, local_ipc::SharedIpcStatus>,
) -> AppStateDto {
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
        auto_watch: c.auto_watch,
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
        local_ipc: ipc.lock().unwrap().clone(),
        last_feedback_sync_at: c.last_feedback_sync_at.clone(),
        last_feedback_sync_error: c.last_feedback_sync_error.clone(),
        last_session_fingerprint: c.last_session_fingerprint.clone(),
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
        let mut next = c.clone();
        next.api_base = base;
        next.device_token = Some(token);
        next.user_email = Some(email.clone());
        next.device_id = device_id;
        next.workspace_project_id = context
            .get("workspaceProjectId")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        next.audio_room_id = context
            .get("audioReviewProjectId")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        next.easeverse_track_id = context
            .get("easeverseTrackId")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        next.easeverse_project_id = context
            .get("easeverseProjectId")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        next.suggested_project_name = context
            .get("projectName")
            .and_then(|v| v.as_str())
            .map(str::to_string);
        next.uploaded_bounces.clear();
        config::save(&next)?;
        *c = next;
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
    config::clear_device_token()?;
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
#[allow(clippy::too_many_arguments)] // Tauri maps these named arguments directly from the setup form.
async fn setup_session(
    app: AppHandle,
    name: String,
    session_type: Option<String>,
    easeverse_track_id: Option<String>,
    audio_room_id: Option<String>,
    session_info_path: Option<String>,
    bounce_dir: Option<String>,
    protools_tier: Option<String>,
    cfg: State<'_, SharedConfig>,
    w: State<'_, SharedWatcher>,
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
    let should_auto_watch = session_info_path
        .as_deref()
        .is_some_and(|path| !path.trim().is_empty())
        || bounce_dir
            .as_deref()
            .is_some_and(|path| !path.trim().is_empty());
    {
        let mut c = cfg.lock().unwrap();
        c.session_id = Some(id.clone());
        c.session_name = Some(name.clone());
        c.session_info_path = session_info_path;
        c.bounce_dir = bounce_dir;
        c.easeverse_track_id = selected_track_id;
        c.audio_room_id = linked.clone();
        c.protools_tier = selected_tier;
        c.auto_watch = should_auto_watch;
        config::save(&c)?;
    }
    if should_auto_watch {
        if let Err(error) = watcher::start(app.clone(), cfg.inner().clone(), w.inner().clone()) {
            emit_activity(
                &app,
                "error",
                &format!("Automatisk overvåking kunne ikke starte: {}", error),
            );
        } else {
            emit_activity(
                &app,
                "info",
                "Automatisk overvåking er aktiv og gjenopptas etter omstart",
            );
        }
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
    match api_client::get_feedback(&snap.api_base, &token, &session_id).await {
        Ok(value) => {
            let mut current = cfg.lock().unwrap();
            current.cached_feedback = Some(value.clone());
            current.last_feedback_sync_at = Some(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
                    .to_string(),
            );
            current.last_feedback_sync_error = None;
            config::save(&current)?;
            Ok(value)
        }
        Err(error) => {
            let mut current = cfg.lock().unwrap();
            current.last_feedback_sync_error = Some(error.clone());
            let cached = current.cached_feedback.clone();
            config::save(&current)?;
            if let Some(mut value) = cached {
                if let Some(object) = value.as_object_mut() {
                    object.insert("offline".into(), json!(true));
                    object.insert("syncError".into(), json!(error));
                }
                Ok(value)
            } else {
                Err(error)
            }
        }
    }
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
    if !seconds.is_finite() || !(0.0..=86_400.0).contains(&seconds) {
        return Err("Ugyldig tidskode".into());
    }
    ptsl::execute("locate", json!({ "seconds": seconds })).await
}

#[tauri::command]
async fn mark_feedback(
    comment_id: String,
    seconds: f64,
    name: String,
    category: Option<String>,
    cfg: State<'_, SharedConfig>,
) -> Result<Value, String> {
    if !seconds.is_finite() || !(0.0..=86_400.0).contains(&seconds) {
        return Err("Ugyldig tidskode".into());
    }
    let color_index = match category.as_deref() {
        Some("timing") => 2,
        Some("performance") => 4,
        Some("arrangement") => 7,
        Some("mix") => 10,
        Some("mastering") => 12,
        _ => 5,
    };
    let marker = ptsl::execute(
        "create_marker",
        json!({
            "seconds": seconds, "name": name, "colorIndex": color_index
        }),
    )
    .await?;
    let marker_id = marker
        .get("markerId")
        .and_then(Value::as_str)
        .ok_or("Pro Tools returnerte ikke markør-ID")?;
    let snap = snapshot(cfg.inner());
    api_client::feedback_action(
        &snap.api_base,
        snap.token.as_deref().ok_or("Ikke paret")?,
        snap.session_id.as_deref().ok_or("Sesjon mangler")?,
        &comment_id,
        json!({ "protoolsMarkerId": marker_id }),
    )
    .await
}

#[tauri::command]
async fn capture_session_snapshot(
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
) -> Result<Value, String> {
    let result = processing::capture_session_snapshot(cfg.inner(), "manual").await?;
    emit_activity(
        &app,
        "info",
        "Session Snapshot er lagret og kan kobles til neste versjon",
    );
    Ok(result)
}

#[tauri::command]
async fn list_session_snapshots(cfg: State<'_, SharedConfig>) -> Result<Value, String> {
    let snap = snapshot(cfg.inner());
    api_client::list_snapshots(
        &snap.api_base,
        snap.token.as_deref().ok_or("Ikke paret")?,
        snap.session_id.as_deref().ok_or("Sesjon mangler")?,
    )
    .await
}

#[tauri::command]
async fn preview_session_recall(snapshot: Value) -> Result<Value, String> {
    ptsl::execute(
        "recall_snapshot",
        json!({ "snapshot": snapshot, "dryRun": true }),
    )
    .await
}

#[tauri::command]
async fn recall_session_snapshot(
    snapshot: Value,
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
) -> Result<Value, String> {
    // Fail closed unless a recovery point exists before Pro Tools is changed.
    let recovery = processing::capture_session_snapshot(cfg.inner(), "pre_recall").await?;
    let mut result = ptsl::execute(
        "recall_snapshot",
        json!({ "snapshot": snapshot, "dryRun": false }),
    )
    .await?;
    let post_recall = processing::capture_session_snapshot(cfg.inner(), "post_recall").await;
    if let Some(object) = result.as_object_mut() {
        object.insert(
            "recoverySnapshotId".into(),
            recovery
                .pointer("/snapshot/id")
                .cloned()
                .unwrap_or(Value::Null),
        );
        if let Err(error) = post_recall {
            object.insert("postRecallSnapshotError".into(), json!(error));
        }
    }
    emit_activity(
        &app,
        "info",
        "Session Recall er utført; et recovery-snapshot ble lagret først",
    );
    Ok(result)
}

#[tauri::command]
async fn list_export_sources() -> Result<Value, String> {
    ptsl::execute("list_export_sources", json!({})).await
}

#[tauri::command]
async fn send_to_review(
    file_name: String,
    source: Option<String>,
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
) -> Result<BounceResult, String> {
    processing::send_to_review(cfg.inner(), &app, file_name.trim(), source).await
}

#[tauri::command]
async fn run_delivery(
    preset: String,
    output_directory: String,
    outputs: Vec<processing::DeliveryOutput>,
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
) -> Result<processing::DeliveryResult, String> {
    processing::run_delivery(cfg.inner(), &app, &preset, &output_directory, outputs).await
}

#[tauri::command]
async fn list_delivery_jobs(cfg: State<'_, SharedConfig>) -> Result<Value, String> {
    let snap = snapshot(cfg.inner());
    api_client::list_delivery_jobs(
        &snap.api_base,
        snap.token.as_deref().ok_or("Ikke paret")?,
        snap.session_id.as_deref().ok_or("Sesjon mangler")?,
    )
    .await
}

#[tauri::command]
async fn make_intro_copy(
    output_directory: String,
    session_name: String,
    app: AppHandle,
    cfg: State<'_, SharedConfig>,
) -> Result<Value, String> {
    let result = ptsl::execute(
        "make_intro_copy",
        json!({
            "outputDirectory": output_directory, "sessionName": session_name
        }),
    )
    .await?;
    let _ = processing::capture_session_snapshot(cfg.inner(), "intro_copy").await;
    emit_activity(
        &app,
        "info",
        "Intro-sikker kopi er opprettet; originalsesjonen er urørt",
    );
    Ok(result)
}

#[tauri::command]
fn autostart_status(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    (if enabled {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    })
    .map_err(|error| error.to_string())?;
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[derive(Serialize)]
struct UpdateInfo {
    available: bool,
    current_version: String,
    version: Option<String>,
    notes: Option<String>,
}

#[tauri::command]
async fn check_for_update(app: AppHandle) -> Result<UpdateInfo, String> {
    let update = app
        .updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?;
    Ok(match update {
        Some(update) => UpdateInfo {
            available: true,
            current_version: update.current_version,
            version: Some(update.version),
            notes: update.body,
        },
        None => UpdateInfo {
            available: false,
            current_version: env!("CARGO_PKG_VERSION").into(),
            version: None,
            notes: None,
        },
    })
}

#[tauri::command]
async fn install_update(app: AppHandle) -> Result<bool, String> {
    let Some(update) = app
        .updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?
    else {
        return Ok(false);
    };
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
fn diagnostics(cfg: State<'_, SharedConfig>, ipc: State<'_, local_ipc::SharedIpcStatus>) -> Value {
    let snap = snapshot(cfg.inner());
    json!({
        "appVersion": env!("CARGO_PKG_VERSION"), "platform": std::env::consts::OS,
        "paired": snap.token.is_some(), "sessionId": snap.session_id, "audioRoomId": snap.audio_room_id,
        "workspaceProjectId": snap.workspace_project_id, "ptsl": ptsl::probe(), "localIpc": ipc.lock().unwrap().clone(),
        "credentialStorage": if cfg!(any(target_os = "macos", target_os = "windows")) { "os_keychain" } else { "restricted_config_fallback" },
        "lastFeedbackSyncAt": cfg.lock().unwrap().last_feedback_sync_at,
        "lastFeedbackSyncError": cfg.lock().unwrap().last_feedback_sync_error,
        "lastSessionFingerprint": cfg.lock().unwrap().last_session_fingerprint,
        "pendingBounces": cfg.lock().unwrap().pending_bounces.len(),
    })
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

const TRAY_ICON_ID: &str = "protools-companion-tray";

fn setup_tray(handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;
    let show = MenuItem::with_id(
        handle,
        "show",
        "Vis Pro Tools Companion",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(handle, "quit", "Avslutt", true, None::<&str>)?;
    let menu = Menu::with_items(handle, &[&show, &quit])?;
    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .tooltip("CreatorHub Pro Tools Companion · overvåker i bakgrunnen")
        .icon(
            handle
                .default_window_icon()
                .expect("bundled app icon")
                .clone(),
        )
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button,
                button_state,
                ..
            } = event
            {
                if matches!(button, tauri::tray::MouseButton::Left)
                    && matches!(button_state, tauri::tray::MouseButtonState::Up)
                {
                    if let Some(window) = tray.app_handle().get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(handle)?;
    Ok(())
}

fn start_session_awareness(app: AppHandle, cfg: SharedConfig) {
    tauri::async_runtime::spawn(async move {
        let mut previous_connected = false;
        let mut previous_snapshot_error: Option<String> = None;
        let mut snapshot_failure_count = 0u32;
        let mut next_snapshot_attempt = std::time::Instant::now();
        let mut interval = tokio::time::interval(Duration::from_secs(12));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            let status = ptsl::probe();
            let connected = status.server_detected && status.helper_installed;
            if connected != previous_connected {
                emit_activity(
                    &app,
                    "info",
                    if connected {
                        "Pro Tools-sesjon oppdaget via PTSL"
                    } else {
                        "Pro Tools er lukket; Companion fortsetter i offline-/filmodus"
                    },
                );
                previous_connected = connected;
            }
            if !connected || !command_polling_ready(&cfg.lock().unwrap()) {
                continue;
            }
            if std::time::Instant::now() < next_snapshot_attempt {
                continue;
            }
            match processing::capture_session_snapshot(
                &cfg,
                if cfg.lock().unwrap().last_session_fingerprint.is_none() {
                    "session_opened"
                } else {
                    "session_changed"
                },
            )
            .await
            {
                Ok(value) if value.get("unchanged").and_then(Value::as_bool) != Some(true) => {
                    if previous_snapshot_error.take().is_some() {
                        emit_activity(&app, "info", "Session-overvåking er tilkoblet igjen");
                    }
                    snapshot_failure_count = 0;
                    next_snapshot_attempt = std::time::Instant::now();
                    emit_activity(
                        &app,
                        "info",
                        "Pro Tools-endring registrert; Session Recall er oppdatert",
                    );
                }
                Ok(_) => {
                    if previous_snapshot_error.take().is_some() {
                        emit_activity(&app, "info", "Session-overvåking er tilkoblet igjen");
                    }
                    snapshot_failure_count = 0;
                    next_snapshot_attempt = std::time::Instant::now();
                }
                Err(error) => {
                    if previous_snapshot_error.as_deref() != Some(&error) {
                        emit_activity(&app, "error", &format!("Session-overvåking: {}", error));
                    }
                    previous_snapshot_error = Some(error);
                    snapshot_failure_count = snapshot_failure_count.saturating_add(1);
                    let backoff_seconds = 30u64
                        .saturating_mul(2u64.saturating_pow(snapshot_failure_count.min(5) - 1))
                        .min(10 * 60);
                    next_snapshot_attempt =
                        std::time::Instant::now() + Duration::from_secs(backoff_seconds);
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut loaded = config::load();
    let ipc_start_error = config::ensure_local_ipc_secret(&mut loaded).err();
    let ipc_ready = ipc_start_error.is_none();
    if let Some(error) = ipc_start_error.as_deref() {
        eprintln!("Local Review Console secret unavailable: {}", error);
    }
    let cfg: SharedConfig = Arc::new(Mutex::new(loaded));
    let watcher_ctl: SharedWatcher = Arc::new(Mutex::new(WatcherCtl::default()));
    let ipc_status: local_ipc::SharedIpcStatus = Arc::new(Mutex::new(local_ipc::LocalIpcStatus {
        port: local_ipc::PORT,
        protocol_version: 1,
        last_error: ipc_start_error.clone(),
        ..Default::default()
    }));
    let startup_cfg = cfg.clone();
    let startup_watcher = watcher_ctl.clone();
    let startup_ipc = ipc_status.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--background"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            setup_tray(app.handle())?;
            start_command_polling(app.handle().clone(), startup_cfg.clone());
            start_session_awareness(app.handle().clone(), startup_cfg.clone());
            if ipc_ready {
                local_ipc::start(
                    app.handle().clone(),
                    startup_cfg.clone(),
                    startup_ipc.clone(),
                );
            } else if let Some(error) = ipc_start_error.as_deref() {
                emit_activity(
                    app.handle(),
                    "error",
                    &format!("AAX Review Console er deaktivert: {}", error),
                );
            }
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .manage(cfg)
        .manage(watcher_ctl)
        .manage(ipc_status)
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
            mark_feedback,
            resolve_feedback,
            reply_feedback,
            capture_session_snapshot,
            list_session_snapshots,
            preview_session_recall,
            recall_session_snapshot,
            list_export_sources,
            send_to_review,
            run_delivery,
            list_delivery_jobs,
            make_intro_copy,
            autostart_status,
            set_autostart,
            check_for_update,
            install_update,
            diagnostics,
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

    #[test]
    fn new_session_can_enable_durable_watching_without_manual_start() {
        let info_path = Some("/sessions/Mix.txt".to_string());
        let bounce_dir: Option<String> = None;
        let should_auto_watch = info_path
            .as_deref()
            .is_some_and(|path| !path.trim().is_empty())
            || bounce_dir
                .as_deref()
                .is_some_and(|path| !path.trim().is_empty());
        assert!(should_auto_watch);
    }
}

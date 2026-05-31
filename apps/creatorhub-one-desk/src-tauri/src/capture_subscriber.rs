//! Capture WebSocket-subscriber (F6a).
//!
//! Subscriber til backend-WebSocket `/api/capture/ws/sessions/:id?token=<helper>`
//! og emit'er hver innkommende JSON-melding som Tauri `capture-event` til UI.
//!
//! Auth: helper-token brukes som query-param. Backend (F6a-extension i
//! `backend/server/capture-websocket.ts`) aksepterer det når token's
//! project_id matcher session's project_id.
//!
//! Auto-reconnect: exponential backoff (1s, 2s, 4s, ..., cap 30s) på drop.
//! Stoppes ved cancel-flag (sett av stop_subscription) eller når
//! sessionen-row markeres ended (ikke implementert her).
//!
//! F6a-SCOPE: vi LOGGER bare innkommende events her. F6b vil parse
//! `capture_event`-payload, hente asset fra backend, og kopiere til lokale
//! destinasjoner.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio_tungstenite::tungstenite::Message;
use url::Url;

use crate::capture_mirror::{self, MirrorState};

#[derive(Default)]
pub struct CaptureSubscriberState {
    active: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl CaptureSubscriberState {
    pub fn list_active(&self) -> Vec<String> {
        self.active.lock().unwrap().keys().cloned().collect()
    }

    pub fn stop(&self, session_id: &str) -> bool {
        if let Some(cancel) = self.active.lock().unwrap().remove(session_id) {
            cancel.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    fn register(&self, session_id: String, cancel: Arc<AtomicBool>) {
        self.active.lock().unwrap().insert(session_id, cancel);
    }

    fn unregister(&self, session_id: &str) {
        self.active.lock().unwrap().remove(session_id);
    }
}

#[derive(Serialize, Clone)]
struct SubscriberStateEvent {
    session_id: String,
    state: String, // "connecting" | "connected" | "disconnected" | "stopped" | "error"
    message: Option<String>,
}

#[derive(Serialize, Clone)]
struct CaptureEventPayload {
    session_id: String,
    raw: serde_json::Value,
}

/// Bygger ws://-URL fra api_base + session_id + token.
/// `https://...` → `wss://...`, `http://...` → `ws://...`
fn build_ws_url(api_base: &str, session_id: &str, token: &str) -> Result<String, String> {
    let parsed = Url::parse(api_base).map_err(|e| format!("Ugyldig api_base: {}", e))?;
    let scheme = match parsed.scheme() {
        "https" => "wss",
        "http" => "ws",
        s => return Err(format!("Uventet scheme: {}", s)),
    };
    let host = parsed.host_str().ok_or("Mangler host")?;
    let port = parsed
        .port()
        .map(|p| format!(":{}", p))
        .unwrap_or_default();
    Ok(format!(
        "{}://{}{}/api/capture/ws/sessions/{}?token={}",
        scheme,
        host,
        port,
        urlencoding::encode(session_id),
        urlencoding::encode(token),
    ))
}

pub fn start_subscription(
    app: AppHandle,
    state: Arc<CaptureSubscriberState>,
    mirror_state: Arc<MirrorState>,
    api_base: String,
    token: String,
    session_id: String,
) -> Result<(), String> {
    if state.active.lock().unwrap().contains_key(&session_id) {
        return Err(format!("Allerede subscriber på session {}", session_id));
    }
    let url = build_ws_url(&api_base, &session_id, &token)?;
    let cancel = Arc::new(AtomicBool::new(false));
    state.register(session_id.clone(), cancel.clone());

    let app_clone = app.clone();
    let state_clone = state.clone();
    let mirror_state_clone = mirror_state.clone();
    let session_id_clone = session_id.clone();
    tokio::spawn(async move {
        run_subscription(
            app_clone,
            state_clone,
            mirror_state_clone,
            session_id_clone,
            url,
            cancel,
        )
        .await;
    });

    Ok(())
}

async fn run_subscription(
    app: AppHandle,
    state: Arc<CaptureSubscriberState>,
    mirror_state: Arc<MirrorState>,
    session_id: String,
    url: String,
    cancel: Arc<AtomicBool>,
) {
    let mut backoff_ms: u64 = 1_000;
    loop {
        if cancel.load(Ordering::SeqCst) {
            break;
        }

        let _ = app.emit(
            "capture-subscriber-state",
            SubscriberStateEvent {
                session_id: session_id.clone(),
                state: "connecting".into(),
                message: None,
            },
        );

        match tokio_tungstenite::connect_async(&url).await {
            Ok((ws_stream, _resp)) => {
                backoff_ms = 1_000; // reset backoff på vellykket connect
                let _ = app.emit(
                    "capture-subscriber-state",
                    SubscriberStateEvent {
                        session_id: session_id.clone(),
                        state: "connected".into(),
                        message: None,
                    },
                );

                let (_write, mut read) = ws_stream.split();
                while let Some(msg) = read.next().await {
                    if cancel.load(Ordering::SeqCst) {
                        break;
                    }
                    match msg {
                        Ok(Message::Text(text)) => {
                            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                                // Trigger mirror hvis aktivert + assetId finnes i payloaden
                                let asset_id = value
                                    .get("payload")
                                    .and_then(|p| p.get("assetId"))
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string());
                                if let Some(asset_id) = asset_id {
                                    capture_mirror::maybe_mirror_asset(
                                        app.clone(),
                                        mirror_state.clone(),
                                        session_id.clone(),
                                        asset_id,
                                    );
                                }
                                let _ = app.emit(
                                    "capture-event",
                                    CaptureEventPayload {
                                        session_id: session_id.clone(),
                                        raw: value,
                                    },
                                );
                            }
                        }
                        Ok(Message::Binary(_)) | Ok(Message::Ping(_)) | Ok(Message::Pong(_)) => {
                            // ignorér
                        }
                        Ok(Message::Close(_)) | Err(_) => break,
                        _ => {}
                    }
                }

                let _ = app.emit(
                    "capture-subscriber-state",
                    SubscriberStateEvent {
                        session_id: session_id.clone(),
                        state: "disconnected".into(),
                        message: None,
                    },
                );
            }
            Err(err) => {
                let _ = app.emit(
                    "capture-subscriber-state",
                    SubscriberStateEvent {
                        session_id: session_id.clone(),
                        state: "error".into(),
                        message: Some(format!("Connect failed: {}", err)),
                    },
                );
            }
        }

        if cancel.load(Ordering::SeqCst) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
        backoff_ms = (backoff_ms * 2).min(30_000);
    }

    state.unregister(&session_id);
    let _ = app.emit(
        "capture-subscriber-state",
        SubscriberStateEvent {
            session_id,
            state: "stopped".into(),
            message: None,
        },
    );
}

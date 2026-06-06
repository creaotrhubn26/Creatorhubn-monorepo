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
use tokio_tungstenite::tungstenite::{Error as WsError, Message};
use url::Url;

use crate::capture_mirror::{self, MirrorState};
use crate::helper_client;

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
    _token_at_start: String,
    session_id: String,
) -> Result<(), String> {
    if state.active.lock().unwrap().contains_key(&session_id) {
        return Err(format!("Allerede subscriber på session {}", session_id));
    }
    // Vi tar IKKE token-en med som parameter mer; subscriber re-leser
    // den fra helper_client::load_config() før hver connect-attempt
    // slik at en oppdatert token (etter rotation) plukkes opp uten
    // re-spawn. Argumentet beholdes for backwards-compat — kan fjernes
    // i en senere PR når vi har flyttet alle callers.
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
            api_base,
            cancel,
        )
        .await;
    });

    Ok(())
}

/// Klassifisering av connect-failure så caller (run_subscription) kan
/// bestemme om backoff-retry har mening, eller om vi skal stoppe og
/// be brukeren rotere token-en.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ConnectFailure {
    /// 401/403 — token er ugyldig/utløpt. Reconnect-loop stopper.
    AuthExpired,
    /// Andre feil (nettverk, DNS, server-down). Reconnect med backoff.
    Transient,
}

fn classify_connect_error(err: &WsError) -> ConnectFailure {
    // tungstenite returnerer HTTP-statusen via Http-varianten når
    // backend svarer på handshake-en med en non-101 status. 401 + 403
    // signaliserer at token-en ble avvist.
    if let WsError::Http(response) = err {
        let status = response.status().as_u16();
        if status == 401 || status == 403 {
            return ConnectFailure::AuthExpired;
        }
    }
    ConnectFailure::Transient
}

async fn run_subscription(
    app: AppHandle,
    state: Arc<CaptureSubscriberState>,
    mirror_state: Arc<MirrorState>,
    session_id: String,
    api_base: String,
    cancel: Arc<AtomicBool>,
) {
    let mut backoff_ms: u64 = 1_000;
    let mut last_token: Option<String> = None;
    loop {
        if cancel.load(Ordering::SeqCst) {
            break;
        }

        // Re-les token før hver connect så en oppdatert token (etter
        // rotation via TokenSetupScreen) plukkes opp uten å re-spawne
        // subscriber. Hvis config mangler eller leser-feiler tolker
        // vi det som "ingen tilgang" → emit auth-expired og stopp.
        let cfg = match helper_client::load_config() {
            Ok(Some(c)) => c,
            Ok(None) => {
                let _ = app.emit(
                    "capture-subscriber-state",
                    SubscriberStateEvent {
                        session_id: session_id.clone(),
                        state: "auth_expired".into(),
                        message: Some("Token mangler — re-autentiser i CreatorHub One Desk".into()),
                    },
                );
                break;
            }
            Err(err) => {
                let _ = app.emit(
                    "capture-subscriber-state",
                    SubscriberStateEvent {
                        session_id: session_id.clone(),
                        state: "error".into(),
                        message: Some(format!("Kunne ikke lese helper-config: {}", err)),
                    },
                );
                // Behandle som transient så vi forsøker igjen — config-fil
                // kan være midlertidig låst av en parallel skriver.
                tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
                backoff_ms = (backoff_ms * 2).min(30_000);
                continue;
            }
        };

        // Bytt API-base hvis brukeren rotert backend-URL også (sjeldent,
        // men billig sjekk). Default: bruk URL-en fra start_subscription.
        let effective_base = if cfg.api_base.is_empty() { api_base.clone() } else { cfg.api_base.clone() };

        let url = match build_ws_url(&effective_base, &session_id, &cfg.token) {
            Ok(u) => u,
            Err(err) => {
                let _ = app.emit(
                    "capture-subscriber-state",
                    SubscriberStateEvent {
                        session_id: session_id.clone(),
                        state: "error".into(),
                        message: Some(format!("Ugyldig URL: {}", err)),
                    },
                );
                break;
            }
        };

        let token_rotated = last_token.as_ref() != Some(&cfg.token);
        last_token = Some(cfg.token.clone());

        let _ = app.emit(
            "capture-subscriber-state",
            SubscriberStateEvent {
                session_id: session_id.clone(),
                state: "connecting".into(),
                message: if token_rotated {
                    Some("Bruker oppdatert token".into())
                } else {
                    None
                },
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
                let failure = classify_connect_error(&err);
                match failure {
                    ConnectFailure::AuthExpired => {
                        // Stopp reconnect-loop helt — token-en duger ikke
                        // og det er ingen poeng å spamme backend. UI får
                        // tydelig signal og kan prompte for token-rotation.
                        let _ = app.emit(
                            "capture-subscriber-state",
                            SubscriberStateEvent {
                                session_id: session_id.clone(),
                                state: "auth_expired".into(),
                                message: Some(format!(
                                    "Backend avviste tokenet ({}). Roter token i CreatorHub Admin Room → DIT Helper Tokens, og lim inn i One Desk for å fortsette live-mirror.",
                                    err
                                )),
                            },
                        );
                        break;
                    }
                    ConnectFailure::Transient => {
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

//! Delte typer + aktivitets-emittering til frontend.

use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::config::AppConfig;

pub type SharedConfig = Arc<Mutex<AppConfig>>;

/// Overvåker-kontroll. Når `watcher` settes til None droppes notify-watcheren,
/// som dropper kanal-senderen → prosesserings-tasken avslutter rent.
#[derive(Default)]
pub struct WatcherCtl {
    pub watcher: Option<notify::RecommendedWatcher>,
}
pub type SharedWatcher = Arc<Mutex<WatcherCtl>>;

#[derive(Clone, Serialize)]
struct ActivityPayload {
    kind: String,
    message: String,
}

/// Sender en aktivitets-linje til frontend. Frontend stempler tidspunkt selv.
pub fn emit_activity(app: &AppHandle, kind: &str, message: &str) {
    let _ = app.emit(
        "companion://activity",
        ActivityPayload { kind: kind.to_string(), message: message.to_string() },
    );
}

/// Øyeblikksbilde av de feltene prosessering trenger (unngår å holde lås over await).
#[derive(Clone)]
pub struct Snapshot {
    pub api_base: String,
    pub token: Option<String>,
    pub session_id: Option<String>,
    pub session_info_path: Option<String>,
    pub bounce_dir: Option<String>,
}

pub fn snapshot(cfg: &SharedConfig) -> Snapshot {
    let c = cfg.lock().unwrap();
    Snapshot {
        api_base: c.api_base.clone(),
        token: c.device_token.clone(),
        session_id: c.session_id.clone(),
        session_info_path: c.session_info_path.clone(),
        bounce_dir: c.bounce_dir.clone(),
    }
}

//! Append-only JSONL-log for copy-sessions.
//!
//! Hver gang en fil ferdig-kopieres skriver vi en linje til
//! ~/.creatorhub-one-desk/sessions/<session_id>.jsonl. Handoff-rapporten
//! leser disse JSONL-filene + projects-state for å bygge ende-på-dagen
//! oversikten Bjarne sender til produsenten.
//!
//! Krav-design:
//!   - Append-only — aldri trunkere/rewrite, så krasj midt i kopi mister
//!     ikke historikk
//!   - Linje-for-linje JSON så filen er trivielt parserbar OG tail-bar
//!     under debugging (`tail -f session.jsonl`)
//!   - Best-effort: hvis disk-write feiler ignorerer vi det (kopien selv
//!     er sannheten — loggen er sekundær for rapport-generering)

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::helper_client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileResult {
    pub source_path: String,
    pub dest_id: String,
    #[serde(default)]
    pub size: u64,
    pub success: bool,
    #[serde(default)]
    pub hash: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub skipped: bool,
    pub ts_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub session_id: String,
    pub mount_path: String,
    pub volume_label: String,
    pub project_id: String,
    pub started_at_ms: u64,
    #[serde(default)]
    pub destinations: Vec<DestSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestSummary {
    pub id: String,
    pub label: String,
    pub path: String,
}

fn sessions_dir() -> PathBuf {
    helper_client::config_dir().join("sessions")
}

fn session_log_path(session_id: &str) -> PathBuf {
    sessions_dir().join(format!("{}.jsonl", session_id))
}

fn session_meta_path(session_id: &str) -> PathBuf {
    sessions_dir().join(format!("{}.meta.json", session_id))
}

fn ensure_dir() -> Result<(), String> {
    fs::create_dir_all(sessions_dir()).map_err(|e| format!("Sessions-dir: {}", e))
}

pub fn write_meta(meta: &SessionMeta) {
    if ensure_dir().is_err() {
        return;
    }
    if let Ok(bytes) = serde_json::to_vec_pretty(meta) {
        let _ = fs::write(session_meta_path(&meta.session_id), bytes);
    }
}

pub fn append_file_result(session_id: &str, result: &FileResult) {
    if ensure_dir().is_err() {
        return;
    }
    let Ok(mut line) = serde_json::to_vec(result) else {
        return;
    };
    line.push(b'\n');
    let _ = OpenOptions::new()
        .create(true)
        .append(true)
        .open(session_log_path(session_id))
        .and_then(|mut f| f.write_all(&line));
}

pub fn read_meta(session_id: &str) -> Option<SessionMeta> {
    let bytes = fs::read(session_meta_path(session_id)).ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub fn read_results(session_id: &str) -> Vec<FileResult> {
    let Ok(bytes) = fs::read(session_log_path(session_id)) else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&bytes);
    text.lines()
        .filter(|l| !l.is_empty())
        .filter_map(|l| serde_json::from_str::<FileResult>(l).ok())
        .collect()
}

pub fn list_session_ids() -> Vec<String> {
    let Ok(read) = fs::read_dir(sessions_dir()) else {
        return Vec::new();
    };
    let mut ids: Vec<String> = read
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            // Bare .meta.json-filer (én per session — JSONL kan mangle hvis 0 filer)
            name.strip_suffix(".meta.json").map(|s| s.to_string())
        })
        .collect();
    ids.sort();
    ids
}

// ── Notater per session (handoff-rapporten redigerer dette) ────

pub fn note_path(session_id: &str) -> PathBuf {
    sessions_dir().join(format!("{}.note.txt", session_id))
}

pub fn save_note(session_id: &str, note: &str) -> Result<(), String> {
    ensure_dir()?;
    fs::write(note_path(session_id), note).map_err(|e| format!("Skriv note: {}", e))
}

pub fn load_note(session_id: &str) -> Option<String> {
    fs::read_to_string(note_path(session_id)).ok()
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// Tester for IO-laget er hoppet over fordi de race'r med projects::tests
// over HOME-env-var. handoff_report-modulen tester ren build()-logikk uten
// IO og dekker rapport-genereringen. Ende-til-ende verifiseres via en
// faktisk backup-økt i app-en.

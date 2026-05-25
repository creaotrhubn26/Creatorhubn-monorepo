//! Append-only run-history persistence.
//!
//! Stores one JSON-Lines record per script run under `~/Library/Application Support/
//! no.creatorhubn.roleroom-post-agent/run_history.jsonl` (or platform equivalent).

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::python::RunSummary;

const HISTORY_FILE: &str = "run_history.jsonl";
const MAX_RECORDS_RETURNED: usize = 200;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryRecord {
    pub run_id: String,
    pub script_id: String,
    pub started_at: String,
    pub finished_at: String,
    pub succeeded: bool,
    pub exit_code: Option<i32>,
    pub dry_run: bool,
    /// Last few events — full event stream lives in the live LogPanel only.
    pub tail_events: Vec<serde_json::Value>,
}

fn history_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data dir: {}", e))?;
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("Create data dir: {}", e))?;
    }
    Ok(dir.join(HISTORY_FILE))
}

pub fn append(app: &AppHandle, summary: &RunSummary) -> Result<(), String> {
    let path = history_path(app)?;
    let tail: Vec<serde_json::Value> = summary
        .events
        .iter()
        .rev()
        .take(10)
        .rev()
        .cloned()
        .collect();
    let record = HistoryRecord {
        run_id: summary.run_id.clone(),
        script_id: summary.script_id.clone(),
        started_at: summary.started_at.clone(),
        finished_at: summary.finished_at.clone(),
        succeeded: summary.succeeded,
        exit_code: summary.exit_code,
        dry_run: summary.dry_run,
        tail_events: tail,
    };
    let line = serde_json::to_string(&record).map_err(|e| e.to_string())?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Open {}: {}", path.display(), e))?;
    writeln!(file, "{}", line).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn read_all(app: &AppHandle) -> Result<Vec<HistoryRecord>, String> {
    let path = history_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut records: Vec<HistoryRecord> = Vec::new();
    for line in reader.lines().flatten() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(rec) = serde_json::from_str::<HistoryRecord>(&line) {
            records.push(rec);
        }
    }
    let len = records.len();
    if len > MAX_RECORDS_RETURNED {
        Ok(records.split_off(len - MAX_RECORDS_RETURNED))
    } else {
        Ok(records)
    }
}

pub fn clear(app: &AppHandle) -> Result<(), String> {
    let path = history_path(app)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn data_dir_path(app: &AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data dir: {}", e))?;
    Ok(dir.display().to_string())
}

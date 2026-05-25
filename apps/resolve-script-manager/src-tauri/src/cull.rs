//! Cull session persistence.
//!
//! A cull session represents the user's review of one folder/card: which clips
//! were kept, rejected, marked maybe, and which scene each belongs to.
//! Survives app restart so Bjarne can leave the app and return later.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const SESSION_DIR: &str = "cull_sessions";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CullPreflight {
    pub multi_camera: bool,
    pub external_audio: bool,
    pub group_by_timecode: bool,
    pub reject_tc_duplicates: bool,
    pub project_template: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CullDecision {
    #[serde(rename = "clipPath")]
    pub clip_path: String,
    #[serde(rename = "clipName")]
    pub clip_name: String,
    pub thumbnails: Vec<String>,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
    #[serde(rename = "durationSeconds")]
    pub duration_seconds: Option<f64>,
    pub decision: String, // "keep" | "reject" | "maybe" | "pending"
    #[serde(rename = "aiSuggestion")]
    pub ai_suggestion: Option<String>,
    pub scene: Option<String>,
    #[serde(rename = "qualityScore")]
    pub quality_score: Option<i32>,
    #[serde(rename = "highlightScore")]
    pub highlight_score: Option<i32>,
    #[serde(rename = "fullFilmScore")]
    pub full_film_score: Option<i32>,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    #[serde(rename = "userOverrode")]
    pub user_overrode: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CullSession {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    #[serde(rename = "sourceLabel")]
    pub source_label: String,
    #[serde(rename = "cardHash", skip_serializing_if = "Option::is_none", default)]
    pub card_hash: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    pub preflight: CullPreflight,
    pub decisions: Vec<CullDecision>,
    #[serde(rename = "similarGroups", skip_serializing_if = "Option::is_none", default)]
    pub similar_groups: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CullSessionSummary {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "sourceLabel")]
    pub source_label: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "totalClips")]
    pub total_clips: usize,
    pub kept: usize,
    pub rejected: usize,
    pub pending: usize,
}

fn sessions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data dir: {}", e))?;
    let dir = base.join(SESSION_DIR);
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("Create cull sessions dir: {}", e))?;
    }
    Ok(dir)
}

pub fn save_session(app: &AppHandle, session: &CullSession) -> Result<String, String> {
    let dir = sessions_dir(app)?;
    let path = dir.join(format!("{}.json", session.session_id));
    let json = serde_json::to_string_pretty(session).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Write session: {}", e))?;
    Ok(path.display().to_string())
}

pub fn load_session(app: &AppHandle, session_id: &str) -> Result<Option<CullSession>, String> {
    let dir = sessions_dir(app)?;
    let path = dir.join(format!("{}.json", session_id));
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let session: CullSession = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    Ok(Some(session))
}

pub fn list_sessions(app: &AppHandle) -> Result<Vec<CullSessionSummary>, String> {
    let dir = sessions_dir(app)?;
    let mut summaries = Vec::new();
    if !dir.exists() {
        return Ok(summaries);
    }
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        let Ok(bytes) = std::fs::read(&path) else { continue };
        let Ok(session) = serde_json::from_slice::<CullSession>(&bytes) else { continue };
        let mut kept = 0usize;
        let mut rejected = 0usize;
        let mut pending = 0usize;
        for d in &session.decisions {
            match d.decision.as_str() {
                "keep" => kept += 1,
                "reject" => rejected += 1,
                _ => pending += 1,
            }
        }
        summaries.push(CullSessionSummary {
            session_id: session.session_id.clone(),
            source_label: session.source_label.clone(),
            source_path: session.source_path.clone(),
            updated_at: session.updated_at.clone(),
            total_clips: session.decisions.len(),
            kept,
            rejected,
            pending,
        });
    }
    summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(summaries)
}

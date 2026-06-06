//! Creations store — persistent state-tracking av hver AI-genererte
//! PSD-template. Lagrer JSON per kreasjon i app-data slik at brukeren
//! kan iterere (endre én tekst eller bytte ett bilde) uten å re-generere
//! alt.
//!
//! Phase 4 av AI-to-editable-PSD-pipelinen.
//!
//! Lokasjon: `~/Library/Application Support/no.creatorhubn.roleroom-post-agent/creations/<uuid>.json`

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

/// En enkelt AI-generert PSD-template. Lagrer alt vi trenger for å
/// re-generere ENKELT-deler uten å miste resten.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Creation {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    /// Brukerens originalprompt — vises i lista.
    pub user_prompt: String,
    /// JSON-spec'en Claude genererte. Full struktur fra Phase 3.
    pub spec: serde_json::Value,
    /// Map fra felt-key til metadata om hvilket bilde som ble brukt.
    /// Tillater re-generation av kun ETT bilde med ny prompt og seed.
    pub images: std::collections::HashMap<String, CreationImage>,
    /// Map fra text-felt-key til faktisk tekst som ble brukt
    /// (slik at vi kan rendre på nytt med ny tekst uten å regenerere bilder).
    #[serde(default)]
    pub text_values: std::collections::HashMap<String, String>,
    /// Hvor PSD-en ligger.
    pub psd_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreationImage {
    pub path: String,
    pub prompt: String,
    pub seed: Option<i64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub model: String,
}

fn creations_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|e| format!("HOME not set: {}", e))?;
    let dir = PathBuf::from(home)
        .join("Library/Application Support/no.creatorhubn.roleroom-post-agent/creations");
    fs::create_dir_all(&dir).map_err(|e| format!("create_dir: {}", e))?;
    Ok(dir)
}

#[tauri::command]
pub async fn creation_save(_app: AppHandle, creation: Creation) -> Result<Creation, String> {
    let dir = creations_dir()?;
    let path = dir.join(format!("{}.json", creation.id));
    let json = serde_json::to_string_pretty(&creation).map_err(|e| format!("serialize: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("write: {}", e))?;
    Ok(creation)
}

#[tauri::command]
pub async fn creation_list(_app: AppHandle) -> Result<Vec<Creation>, String> {
    let dir = creations_dir()?;
    let mut out: Vec<Creation> = Vec::new();
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(out),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        if let Ok(bytes) = fs::read(&path) {
            if let Ok(c) = serde_json::from_slice::<Creation>(&bytes) {
                out.push(c);
            }
        }
    }
    // Nyeste først
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

#[tauri::command]
pub async fn creation_load(_app: AppHandle, id: String) -> Result<Creation, String> {
    let dir = creations_dir()?;
    let path = dir.join(format!("{}.json", id));
    if !path.is_file() {
        return Err(format!("creation '{}' not found", id));
    }
    let bytes = fs::read(&path).map_err(|e| format!("read: {}", e))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("parse: {}", e))
}

#[tauri::command]
pub async fn creation_delete(_app: AppHandle, id: String) -> Result<(), String> {
    let dir = creations_dir()?;
    let path = dir.join(format!("{}.json", id));
    if path.is_file() {
        fs::remove_file(&path).map_err(|e| format!("delete: {}", e))?;
    }
    Ok(())
}

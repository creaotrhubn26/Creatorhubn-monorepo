//! Lagrer Guided Recorder-opptak (per scene) til disk.
//!
//! Frontend tar opp scenen med MediaRecorder (getDisplayMedia), base64-koder
//! webm-blobben, og sender den hit. Vi dekoder og skriver til
//! <app_data_dir>/demo-recordings/<projectId>/<sceneId>.webm og returnerer
//! den absolutte stien — som lagres som scene.recordingPath og senere mates
//! til render-pipelinen (mockup_render_video).

use std::path::PathBuf;

use base64::Engine;
use tauri::{AppHandle, Manager};

fn recordings_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?
        .join("demo-recordings")
        .join(sanitize(project_id));
    std::fs::create_dir_all(&base).map_err(|e| format!("create_dir_all: {}", e))?;
    Ok(base)
}

/// Tillat kun trygge filnavn-tegn (unngå path traversal).
fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

/// Lagre ett scene-opptak. `data_base64` er rå base64 (uten data:-prefiks).
#[tauri::command]
pub async fn save_demo_recording(
    app: AppHandle,
    project_id: String,
    scene_id: String,
    data_base64: String,
) -> Result<String, String> {
    let dir = recordings_dir(&app, &project_id)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|e| format!("base64 decode: {}", e))?;
    if bytes.is_empty() {
        return Err("Tomt opptak".into());
    }
    let path = dir.join(format!("{}.webm", sanitize(&scene_id)));
    std::fs::write(&path, &bytes).map_err(|e| format!("write: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

//! Role Room API client — consumes the Post Agent backend endpoints so the
//! Tauri desktop app can pre-configure DaVinci Resolve from the project
//! state (scenes → bins, equipment → project settings, live-set clips
//! → ingest with scene-metadata).
//!
//! Auth: bearer token read from AppSettings.RR_BEARER_TOKEN (set on sign-in
//! via the RoleRoomSignInDialog).
//! Base URL: AppSettings.RR_API_BASE, falls back to creatorhubn.com prod.
//!
//! All commands return the raw JSON response so the frontend can shape it
//! freely. Errors are stringified for easy display.
use crate::python::AppSettings;
use serde_json::Value;
use tauri::State;

const DEFAULT_BASE: &str = "https://creatorhubn.com/api/post-agent";

fn extract_creds(settings: &State<AppSettings>) -> Result<(String, String), String> {
    let snap = settings.snapshot();
    let token = snap
        .get("RR_BEARER_TOKEN")
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Not signed in — RR_BEARER_TOKEN missing. Sign in via Role Room first.".to_string())?;
    let base = snap
        .get("RR_API_BASE")
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_BASE.to_string());
    Ok((base, token))
}

async fn fetch_json(base: &str, path: &str, token: &str) -> Result<Value, String> {
    let url = format!("{}{}", base, path);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP client init failed: {}", e))?;
    let res = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Request to {} failed: {}", url, e))?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("HTTP {} from {}: {}", status, url, text));
    }
    serde_json::from_str::<Value>(&text)
        .map_err(|e| format!("Parse JSON from {}: {} (body: {})", url, e, text))
}

/// GET /api/post-agent/projects/:project_id/scenes
/// Returns `{ scenes: [{ id, sceneNumber, title, intExt, timeOfDay, characters }] }`.
/// Used by the frontend + Python bridge to pre-create matching bins in Resolve.
#[tauri::command]
pub async fn role_room_fetch_scenes(
    project_id: String,
    settings: State<'_, AppSettings>,
) -> Result<Value, String> {
    let (base, token) = extract_creds(&settings)?;
    fetch_json(&base, &format!("/projects/{}/scenes", project_id), &token).await
}

/// GET /api/post-agent/projects/:project_id/equipment
/// Returns `{ equipment: [...], projectSettings: { resolution, frameRate, colorScience, primaryCamera } }`.
/// projectSettings is derived from the first camera with metadata — Tauri
/// uses it to auto-configure Resolve project resolution/fps/color science.
#[tauri::command]
pub async fn role_room_fetch_equipment(
    project_id: String,
    settings: State<'_, AppSettings>,
) -> Result<Value, String> {
    let (base, token) = extract_creds(&settings)?;
    fetch_json(&base, &format!("/projects/{}/equipment", project_id), &token).await
}

/// GET /api/post-agent/projects/:project_id/live-set-state
/// Returns `{ clips: [...], sceneMarkers: [...] }`.
/// Clips include scene-metadata + R2 media keys so the Tauri app can ingest
/// them into Resolve with proper bin placement.
#[tauri::command]
pub async fn role_room_fetch_live_set_state(
    project_id: String,
    settings: State<'_, AppSettings>,
) -> Result<Value, String> {
    let (base, token) = extract_creds(&settings)?;
    fetch_json(
        &base,
        &format!("/projects/{}/live-set-state", project_id),
        &token,
    )
    .await
}

/// GET /api/post-agent/team/my-productions
/// Returns `{ productions: [{ id, name, projectType, eventDate, activeSeats }] }`.
/// Used to populate a project-picker in the desktop app.
#[tauri::command]
pub async fn role_room_my_productions(
    settings: State<'_, AppSettings>,
) -> Result<Value, String> {
    let (base, token) = extract_creds(&settings)?;
    fetch_json(&base, "/team/my-productions", &token).await
}

/// GET /api/post-agent/team/my-seats
/// Returns `{ seats: [{ projectId, projectName, ...}] }`.
/// For crew members — productions where they've been granted access.
#[tauri::command]
pub async fn role_room_my_seats(settings: State<'_, AppSettings>) -> Result<Value, String> {
    let (base, token) = extract_creds(&settings)?;
    fetch_json(&base, "/team/my-seats", &token).await
}

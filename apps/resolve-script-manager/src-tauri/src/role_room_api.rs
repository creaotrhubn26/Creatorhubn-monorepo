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
        .ok_or_else(|| {
            "Not signed in — RR_BEARER_TOKEN missing. Sign in via Role Room first.".to_string()
        })?;
    // Frontend skriver KUN RR_POST_AGENT_BASE_URL (samme format, inkl. /api/post-agent).
    // Les den først; RR_API_BASE beholdes som legacy-fallback. Uten dette ble en
    // egendefinert backend-URL ignorert (Rust falt alltid til DEFAULT_BASE).
    let base = snap
        .get("RR_POST_AGENT_BASE_URL")
        .or_else(|| snap.get("RR_API_BASE"))
        .map(|s| s.trim().trim_end_matches('/').to_string())
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

fn creatorhub_api_base(post_agent_base: &str) -> String {
    post_agent_base
        .trim_end_matches('/')
        .strip_suffix("/api/post-agent")
        .unwrap_or(post_agent_base.trim_end_matches('/'))
        .to_string()
}

async fn parse_json_response(res: reqwest::Response, url: &str) -> Result<Value, String> {
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("HTTP {} from {}: {}", status, url, body));
    }
    serde_json::from_str::<Value>(&body).map_err(|e| format!("Parse JSON from {}: {}", url, e))
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
    fetch_json(
        &base,
        &format!("/projects/{}/equipment", project_id),
        &token,
    )
    .await
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
pub async fn role_room_my_productions(settings: State<'_, AppSettings>) -> Result<Value, String> {
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

/// Access-scoped Video Room projects and versions for native NLE sync.
#[tauri::command]
pub async fn role_room_video_nle_projects(
    settings: State<'_, AppSettings>,
) -> Result<Value, String> {
    let (post_agent_base, token) = extract_creds(&settings)?;
    let base = creatorhub_api_base(&post_agent_base);
    fetch_json(&base, "/api/video-nle/projects", &token).await
}

/// Pull the canonical review markers for one Video Room version.
#[tauri::command]
pub async fn role_room_video_resolve_markers(
    project_id: String,
    version_id: String,
    settings: State<'_, AppSettings>,
) -> Result<Value, String> {
    let (post_agent_base, token) = extract_creds(&settings)?;
    let base = creatorhub_api_base(&post_agent_base);
    fetch_json(
        &base,
        &format!(
            "/api/projects/{}/video-marker-sync/resolve?versionId={}",
            project_id, version_id
        ),
        &token,
    )
    .await
}

/// Push a complete Resolve marker snapshot into the canonical review model.
#[tauri::command]
pub async fn role_room_push_video_resolve_markers(
    project_id: String,
    version_id: String,
    markers: Value,
    settings: State<'_, AppSettings>,
) -> Result<Value, String> {
    let (post_agent_base, token) = extract_creds(&settings)?;
    let base = creatorhub_api_base(&post_agent_base);
    let url = format!(
        "{}/api/projects/{}/video-marker-sync/resolve",
        base, project_id
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client init failed: {}", e))?;
    let res = client
        .post(&url)
        .bearer_auth(&token)
        .json(&serde_json::json!({ "versionId": version_id, "markers": markers }))
        .send()
        .await
        .map_err(|e| format!("POST {} failed: {}", url, e))?;
    parse_json_response(res, &url).await
}

#[cfg(test)]
mod tests {
    use super::creatorhub_api_base;

    #[test]
    fn derives_root_api_base_from_post_agent_base() {
        assert_eq!(
            creatorhub_api_base("https://creatorhubn.com/api/post-agent/"),
            "https://creatorhubn.com"
        );
        assert_eq!(
            creatorhub_api_base("http://localhost:5000"),
            "http://localhost:5000"
        );
    }
}

/// POST /api/post-agent/projects/:projectId/clips/download-urls
/// Body: { clipIds: [...] }
/// Returns presigned R2 URLs + scene metadata so the desktop app can
/// stream the captured clips locally and then import them into Resolve.
#[tauri::command]
pub async fn role_room_fetch_clip_download_urls(
    project_id: String,
    clip_ids: Vec<String>,
    settings: State<'_, AppSettings>,
) -> Result<Value, String> {
    let (base, token) = extract_creds(&settings)?;
    let url = format!("{}/projects/{}/clips/download-urls", base, project_id);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client init failed: {}", e))?;
    let res = client
        .post(&url)
        .bearer_auth(&token)
        .json(&serde_json::json!({ "clipIds": clip_ids }))
        .send()
        .await
        .map_err(|e| format!("POST {} failed: {}", url, e))?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("HTTP {} from {}: {}", status, url, text));
    }
    serde_json::from_str::<Value>(&text).map_err(|e| format!("Parse JSON: {} (body: {})", e, text))
}

/// Download a single clip from a presigned URL to a local path. Returns
/// the bytes-written count. Used by ingest_captured_clips to stream R2
/// objects to a staging folder before importing into Resolve.
#[tauri::command]
pub async fn role_room_download_clip(
    download_url: String,
    dest_path: String,
) -> Result<u64, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600)) // 10 min for big takes
        .build()
        .map_err(|e| format!("HTTP client init failed: {}", e))?;
    let res = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Download GET failed: {}", e))?;
    let status = res.status();
    if !status.is_success() {
        return Err(format!(
            "HTTP {} downloading {}",
            status,
            &download_url[..download_url.len().min(80)]
        ));
    }
    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Reading body failed: {}", e))?;
    let len = bytes.len() as u64;
    // Ensure parent dir exists
    if let Some(parent) = std::path::Path::new(&dest_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("create_dir_all {} failed: {}", parent.display(), e))?;
    }
    std::fs::write(&dest_path, &bytes).map_err(|e| format!("Write {} failed: {}", dest_path, e))?;
    Ok(len)
}

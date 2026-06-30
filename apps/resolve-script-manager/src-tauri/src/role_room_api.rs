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
    serde_json::from_str::<Value>(&text)
        .map_err(|e| format!("Parse JSON: {} (body: {})", e, text))
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
        return Err(format!("HTTP {} downloading {}", status, &download_url[..download_url.len().min(80)]));
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
    std::fs::write(&dest_path, &bytes)
        .map_err(|e| format!("Write {} failed: {}", dest_path, e))?;
    Ok(len)
}

// ── Device-code pairing (sign-in) ────────────────────────────────────────────
// These proxy the pre-auth pairing endpoints from the Rust side so they are NOT
// subject to browser CORS. The backend does not return Access-Control-Allow-Origin
// on /pairing/*, so a webview `fetch()` rejects with "TypeError: Load failed".
// We return { status, body } so the frontend keeps the 202/410/429/200 semantics.

fn pairing_base(base: Option<String>) -> String {
    base.map(|s| s.trim().trim_end_matches('/').to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_BASE.to_string())
}

async fn pairing_response_json(res: reqwest::Response) -> Value {
    let status = res.status().as_u16();
    let text = res.text().await.unwrap_or_default();
    let body = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);
    serde_json::json!({ "status": status, "body": body })
}

/// POST /api/post-agent/pairing/start → { code, expiresAt, verificationUrl, pollIntervalMs }
/// No auth. Returns { status, body }.
#[tauri::command]
pub async fn pairing_start(base: Option<String>) -> Result<Value, String> {
    let url = format!("{}/pairing/start", pairing_base(base));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP client init failed: {}", e))?;
    let res = client
        .post(&url)
        .send()
        .await
        .map_err(|e| format!("Request to {} failed: {}", url, e))?;
    Ok(pairing_response_json(res).await)
}

// ── Generisk autentisert proxy (utenom WKWebView-CORS) ───────────────────────
// Deployed backend sender ingen Access-Control-Allow-Origin for tauri://localhost,
// så ALLE browser-fetch fra appen blir CORS-blokkert. Disse kommandoene gjør
// kallet fra Rust (reqwest) i stedet. Frontenden sender full URL + bearer-token.
// Returnerer { status, body } så frontenden beholder statuskode-semantikken.

async fn authed_response_json(res: reqwest::Response) -> Value {
    let status = res.status().as_u16();
    let text = res.text().await.unwrap_or_default();
    let body = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);
    serde_json::json!({ "status": status, "body": body })
}

fn authed_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| format!("HTTP client init failed: {}", e))
}

/// GET <url> med Bearer-token. Returnerer { status, body }.
#[tauri::command]
pub async fn authed_get(url: String, token: String) -> Result<Value, String> {
    let client = authed_client()?;
    let mut req = client.get(&url);
    if !token.trim().is_empty() {
        req = req.bearer_auth(token.trim());
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("GET {} feilet: {}", url, e))?;
    Ok(authed_response_json(res).await)
}

/// Generell autentisert request (vilkårlig metode + headers + body som tekst).
/// Brukt av den globale fetch-shimen i frontenden for å rute ALLE backend-kall
/// utenom WKWebView-CORS. Returnerer { status, body } der body er rå tekst
/// (så shimen kan bygge en ekte Response som .json()/.text() fungerer på).
#[tauri::command]
pub async fn authed_request(
    method: String,
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: Option<String>,
) -> Result<Value, String> {
    let client = authed_client()?;
    let m = reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
        .map_err(|e| format!("ugyldig metode {}: {}", method, e))?;
    let mut req = client.request(m, &url);
    for (k, v) in headers.iter() {
        // hopp over headere reqwest setter selv / som ikke skal videresendes
        let lk = k.to_ascii_lowercase();
        if lk == "host" || lk == "content-length" || lk == "origin" {
            continue;
        }
        req = req.header(k.as_str(), v.as_str());
    }
    if let Some(b) = body {
        req = req.body(b);
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("{} {} feilet: {}", method, url, e))?;
    let status = res.status().as_u16();
    let text = res.text().await.unwrap_or_default();
    Ok(serde_json::json!({ "status": status, "body": text }))
}

/// POST <url> (JSON body) med Bearer-token. Returnerer { status, body }.
#[tauri::command]
pub async fn authed_post(url: String, token: String, body: Option<Value>) -> Result<Value, String> {
    let client = authed_client()?;
    let mut req = client.post(&url);
    if !token.trim().is_empty() {
        req = req.bearer_auth(token.trim());
    }
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("POST {} feilet: {}", url, e))?;
    Ok(authed_response_json(res).await)
}

/// POST /api/post-agent/pairing/poll  body { code } → 202 pending / 410 expired / 200 { bearerToken }
/// No auth. Returns { status, body }.
#[tauri::command]
pub async fn pairing_poll(base: Option<String>, code: String) -> Result<Value, String> {
    let url = format!("{}/pairing/poll", pairing_base(base));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP client init failed: {}", e))?;
    let res = client
        .post(&url)
        .json(&serde_json::json!({ "code": code }))
        .send()
        .await
        .map_err(|e| format!("Request to {} failed: {}", url, e))?;
    Ok(pairing_response_json(res).await)
}

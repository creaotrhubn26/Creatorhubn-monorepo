//! HTTP-klient mot CreatorHub-backendens Pro Tools Companion-API.
//! Alle companion-kall autentiserer med device-token (Bearer) fra paring.

use serde_json::{json, Value};

fn base(api_base: &str) -> String {
    api_base.trim_end_matches('/').to_string()
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("CreatorHub-ProTools-Companion/0.1")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

async fn err_body(resp: reqwest::Response) -> String {
    let status = resp.status();
    let txt = resp.text().await.unwrap_or_default();
    format!("HTTP {} — {}", status.as_u16(), txt)
}

/// POST /api/protools/pair/claim — bytt 6-sifret kode mot device-token.
/// Returnerer (token, user_email).
pub async fn claim_pair(api_base: &str, code: &str) -> Result<(String, String), String> {
    let resp = client()
        .post(format!("{}/api/protools/pair/claim", base(api_base)))
        .json(&json!({ "code": code }))
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let v: Value = resp.json().await.map_err(|e| format!("Ugyldig svar: {}", e))?;
    let token = v.get("token").and_then(|t| t.as_str()).ok_or("Mangler token i svar")?;
    let email = v
        .get("user")
        .and_then(|u| u.get("email"))
        .and_then(|e| e.as_str())
        .unwrap_or("")
        .to_string();
    Ok((token.to_string(), email))
}

/// GET /api/protools/me — koblingsbare EaseVerse-tracks. Returnerer rå JSON-array.
pub async fn list_tracks(api_base: &str, token: &str) -> Result<Value, String> {
    let resp = client()
        .get(format!("{}/api/protools/me", base(api_base)))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let v: Value = resp.json().await.map_err(|e| format!("Ugyldig svar: {}", e))?;
    Ok(v.get("tracks").cloned().unwrap_or(Value::Array(vec![])))
}

/// POST /api/protools/sessions — opprett/koble companion-sesjon. Returnerer session-objektet.
pub async fn create_session(api_base: &str, token: &str, payload: Value) -> Result<Value, String> {
    let resp = client()
        .post(format!("{}/api/protools/sessions", base(api_base)))
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let v: Value = resp.json().await.map_err(|e| format!("Ugyldig svar: {}", e))?;
    Ok(v.get("session").cloned().unwrap_or(v))
}

/// POST /api/protools/sessions/:id/markers
pub async fn post_markers(api_base: &str, token: &str, session_id: &str, markers: Value) -> Result<Value, String> {
    let resp = client()
        .post(format!("{}/api/protools/sessions/{}/markers", base(api_base), session_id))
        .bearer_auth(token)
        .json(&json!({ "markers": markers }))
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    resp.json().await.map_err(|e| format!("Ugyldig svar: {}", e))
}

/// POST /api/protools/sessions/:id/metadata
pub async fn post_metadata(api_base: &str, token: &str, session_id: &str, meta: Value) -> Result<(), String> {
    let resp = client()
        .post(format!("{}/api/protools/sessions/{}/metadata", base(api_base), session_id))
        .bearer_auth(token)
        .json(&meta)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    Ok(())
}

/// POST /api/protools/sessions/:id/bounce/presign → (upload_url, file_url, storage_key)
pub async fn presign_bounce(
    api_base: &str,
    token: &str,
    session_id: &str,
    file_name: &str,
    size_bytes: u64,
) -> Result<(String, String, String), String> {
    let resp = client()
        .post(format!("{}/api/protools/sessions/{}/bounce/presign", base(api_base), session_id))
        .bearer_auth(token)
        .json(&json!({ "fileName": file_name, "sizeBytes": size_bytes, "mimeType": "audio/wav" }))
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let v: Value = resp.json().await.map_err(|e| format!("Ugyldig svar: {}", e))?;
    let upload = v.get("uploadUrl").and_then(|x| x.as_str()).ok_or("Mangler uploadUrl")?;
    let file = v.get("fileUrl").and_then(|x| x.as_str()).ok_or("Mangler fileUrl")?;
    let key = v.get("storageKey").and_then(|x| x.as_str()).unwrap_or("").to_string();
    Ok((upload.to_string(), file.to_string(), key))
}

/// PUT bytes til presignert URL.
pub async fn put_bytes(upload_url: &str, bytes: Vec<u8>) -> Result<(), String> {
    let resp = client()
        .put(upload_url)
        .header("Content-Type", "audio/wav")
        .body(bytes)
        .send()
        .await
        .map_err(|e| format!("Opplasting feilet: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    Ok(())
}

/// POST /api/protools/sessions/:id/bounce/complete
pub async fn complete_bounce(api_base: &str, token: &str, session_id: &str, payload: Value) -> Result<Value, String> {
    let resp = client()
        .post(format!("{}/api/protools/sessions/{}/bounce/complete", base(api_base), session_id))
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    resp.json().await.map_err(|e| format!("Ugyldig svar: {}", e))
}

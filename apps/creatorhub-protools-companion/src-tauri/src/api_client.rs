//! HTTP-klient mot CreatorHub-backendens Pro Tools Companion-API.
//! Alle companion-kall autentiserer med device-token (Bearer) fra paring.

use serde_json::{json, Value};

fn base(api_base: &str) -> String {
    api_base.trim_end_matches('/').to_string()
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(format!(
            "CreatorHub-ProTools-Companion/{}",
            env!("CARGO_PKG_VERSION")
        ))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

async fn err_body(resp: reqwest::Response) -> String {
    let status = resp.status();
    let txt = resp.text().await.unwrap_or_default();
    format!("HTTP {} — {}", status.as_u16(), txt)
}

/// POST /api/protools/pair/claim — bytt 6-sifret kode mot device-token.
/// Returnerer (token, user_email, device_id, pairing_context).
pub async fn claim_pair(
    api_base: &str,
    code: &str,
) -> Result<(String, String, Option<String>, Value), String> {
    let resp = client()
        .post(format!("{}/api/protools/pair/claim", base(api_base)))
        .json(&json!({ "code": code }))
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let v: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))?;
    let token = v
        .get("token")
        .and_then(|t| t.as_str())
        .ok_or("Mangler token i svar")?;
    let email = v
        .get("user")
        .and_then(|u| u.get("email"))
        .and_then(|e| e.as_str())
        .unwrap_or("")
        .to_string();
    let device_id = v
        .get("deviceId")
        .and_then(|x| x.as_str())
        .map(|x| x.to_string());
    let context = v.get("context").cloned().unwrap_or_else(|| json!({}));
    Ok((token.to_string(), email, device_id, context))
}

pub async fn revoke_device(api_base: &str, token: &str) -> Result<(), String> {
    let resp = client()
        .post(format!("{}/api/protools/device/revoke", base(api_base)))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    Ok(())
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
    let v: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))?;
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
    let v: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))?;
    Ok(v.get("session").cloned().unwrap_or(v))
}

/// POST /api/protools/sessions/:id/markers
pub async fn post_markers(
    api_base: &str,
    token: &str,
    session_id: &str,
    markers: Value,
    event_id: &str,
) -> Result<Value, String> {
    let resp = client()
        .post(format!(
            "{}/api/protools/sessions/{}/markers",
            base(api_base),
            session_id
        ))
        .bearer_auth(token)
        .json(&json!({ "markers": markers, "eventId": event_id }))
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    resp.json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))
}

/// POST /api/protools/sessions/:id/metadata
pub async fn post_metadata(
    api_base: &str,
    token: &str,
    session_id: &str,
    meta: Value,
) -> Result<(), String> {
    let resp = client()
        .post(format!(
            "{}/api/protools/sessions/{}/metadata",
            base(api_base),
            session_id
        ))
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

pub async fn create_snapshot(
    api_base: &str,
    token: &str,
    session_id: &str,
    snapshot: Value,
    reason: &str,
) -> Result<Value, String> {
    let resp = client()
        .post(format!(
            "{}/api/protools/sessions/{}/snapshots",
            base(api_base),
            session_id
        ))
        .bearer_auth(token)
        .json(&json!({ "snapshot": snapshot, "reason": reason }))
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let value: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))?;
    Ok(value.get("snapshot").cloned().unwrap_or(value))
}

pub async fn list_snapshots(
    api_base: &str,
    token: &str,
    session_id: &str,
) -> Result<Value, String> {
    let resp = client()
        .get(format!(
            "{}/api/protools/sessions/{}/snapshots",
            base(api_base),
            session_id
        ))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let value: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))?;
    Ok(value
        .get("snapshots")
        .cloned()
        .unwrap_or_else(|| Value::Array(vec![])))
}

pub async fn create_delivery_job(
    api_base: &str,
    token: &str,
    session_id: &str,
    preset: &str,
    outputs: Value,
) -> Result<Value, String> {
    let resp = client()
        .post(format!(
            "{}/api/protools/sessions/{}/delivery-jobs",
            base(api_base),
            session_id
        ))
        .bearer_auth(token)
        .json(&json!({ "preset": preset, "outputs": outputs }))
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let value: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))?;
    Ok(value.get("job").cloned().unwrap_or(value))
}

pub async fn update_delivery_job(
    api_base: &str,
    token: &str,
    session_id: &str,
    job_id: &str,
    payload: Value,
) -> Result<Value, String> {
    let resp = client()
        .patch(format!(
            "{}/api/protools/sessions/{}/delivery-jobs/{}",
            base(api_base),
            session_id,
            job_id
        ))
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let value: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))?;
    Ok(value.get("job").cloned().unwrap_or(value))
}

pub async fn list_delivery_jobs(
    api_base: &str,
    token: &str,
    session_id: &str,
) -> Result<Value, String> {
    let resp = client()
        .get(format!(
            "{}/api/protools/sessions/{}/delivery-jobs",
            base(api_base),
            session_id
        ))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let value: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))?;
    Ok(value
        .get("jobs")
        .cloned()
        .unwrap_or_else(|| Value::Array(vec![])))
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
        .post(format!(
            "{}/api/protools/sessions/{}/bounce/presign",
            base(api_base),
            session_id
        ))
        .bearer_auth(token)
        .json(&json!({ "fileName": file_name, "sizeBytes": size_bytes, "mimeType": "audio/wav" }))
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    let v: Value = resp
        .json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))?;
    let upload = v
        .get("uploadUrl")
        .and_then(|x| x.as_str())
        .ok_or("Mangler uploadUrl")?;
    let file = v
        .get("fileUrl")
        .and_then(|x| x.as_str())
        .ok_or("Mangler fileUrl")?;
    let key = v
        .get("storageKey")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
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
pub async fn complete_bounce(
    api_base: &str,
    token: &str,
    session_id: &str,
    payload: Value,
) -> Result<Value, String> {
    let resp = client()
        .post(format!(
            "{}/api/protools/sessions/{}/bounce/complete",
            base(api_base),
            session_id
        ))
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    resp.json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))
}

/// GET /api/protools/sessions/:id/feedback — kommentarer, godkjenninger og tasks.
pub async fn get_feedback(api_base: &str, token: &str, session_id: &str) -> Result<Value, String> {
    let resp = client()
        .get(format!(
            "{}/api/protools/sessions/{}/feedback",
            base(api_base),
            session_id
        ))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    resp.json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))
}

pub async fn feedback_action(
    api_base: &str,
    token: &str,
    session_id: &str,
    comment_id: &str,
    payload: Value,
) -> Result<Value, String> {
    let resp = client()
        .post(format!(
            "{}/api/protools/sessions/{}/feedback/comments/{}",
            base(api_base),
            session_id,
            comment_id
        ))
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    resp.json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))
}

pub async fn create_realtime_ticket(
    api_base: &str,
    token: &str,
    session_id: &str,
) -> Result<Value, String> {
    let resp = client()
        .post(format!(
            "{}/api/protools/sessions/{}/realtime-ticket",
            base(api_base),
            session_id
        ))
        .header("x-creatorhub-client-version", env!("CARGO_PKG_VERSION"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    resp.json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))
}

pub async fn get_commands(api_base: &str, token: &str, session_id: &str) -> Result<Value, String> {
    let resp = client()
        .get(format!(
            "{}/api/protools/sessions/{}/commands",
            base(api_base),
            session_id
        ))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    resp.json()
        .await
        .map_err(|e| format!("Ugyldig svar: {}", e))
}

pub async fn complete_command(
    api_base: &str,
    token: &str,
    session_id: &str,
    command_id: &str,
    status: &str,
    result: Option<Value>,
    error: Option<&str>,
) -> Result<(), String> {
    let resp = client()
        .post(format!(
            "{}/api/protools/sessions/{}/commands/{}/complete",
            base(api_base),
            session_id,
            command_id
        ))
        .bearer_auth(token)
        .json(&json!({ "status": status, "result": result, "error": error }))
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    Ok(())
}

pub async fn download_artifact_to(
    api_base: &str,
    token: &str,
    session_id: &str,
    artifact_id: &str,
    destination: &std::path::Path,
) -> Result<u64, String> {
    use tokio::io::AsyncWriteExt;

    const MAX_ARTIFACT_BYTES: u64 = 2 * 1024 * 1024 * 1024;
    let mut resp = client()
        .get(format!(
            "{}/api/protools/sessions/{}/artifacts/{}/file",
            base(api_base),
            session_id,
            artifact_id
        ))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Nettverksfeil: {}", e))?;
    if !resp.status().is_success() {
        return Err(err_body(resp).await);
    }
    if resp
        .content_length()
        .map(|size| size > MAX_ARTIFACT_BYTES)
        .unwrap_or(false)
    {
        return Err("Artefakten er større enn 2 GB".into());
    }
    let mut file = tokio::fs::File::create(destination)
        .await
        .map_err(|e| format!("Kunne ikke opprette lokal artefakt: {}", e))?;
    let mut total = 0u64;
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| format!("Kunne ikke lese artefakt: {}", e))?
    {
        total += chunk.len() as u64;
        if total > MAX_ARTIFACT_BYTES {
            drop(file);
            let _ = tokio::fs::remove_file(destination).await;
            return Err("Artefakten er større enn 2 GB".into());
        }
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Kunne ikke lagre artefakt: {}", e))?;
    }
    file.flush()
        .await
        .map_err(|e| format!("Kunne ikke ferdigstille artefakt: {}", e))?;
    if total == 0 {
        let _ = tokio::fs::remove_file(destination).await;
        return Err("Artefakten var tom".into());
    }
    Ok(total)
}

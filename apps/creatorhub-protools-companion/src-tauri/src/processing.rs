//! Kjerneflyten: les Pro Tools-eksport → push til backend. Delt av de manuelle
//! kommandoene (Synk nå / last opp) og den automatiske fil-overvåkeren.

use std::path::Path;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::api_client;
use crate::config;
use crate::ptx_parser;
use crate::state::{emit_activity, snapshot, SharedConfig};

#[derive(Serialize, Clone)]
pub struct SyncResult {
    pub markers_stored: i64,
    pub sections_synced: i64,
    pub sample_rate: Option<f64>,
    pub track_count: i64,
}

#[derive(Serialize, Clone)]
pub struct BounceResult {
    pub review_version_id: Option<String>,
    pub version_number: Option<i64>,
    pub sections_synced: i64,
}

fn require<'a>(opt: &'a Option<String>, what: &str) -> Result<&'a str, String> {
    opt.as_deref().filter(|s| !s.is_empty()).ok_or_else(|| format!("{} mangler", what))
}

/// Les «Session Info»-tekstfila, parse markører/metadata, og push til backend.
pub async fn sync_session_info(cfg: &SharedConfig, app: &AppHandle) -> Result<SyncResult, String> {
    let snap = snapshot(cfg);
    let token = require(&snap.token, "device-token")?;
    let session_id = require(&snap.session_id, "sesjon")?;
    let path = require(&snap.session_info_path, "Session Info-fil")?;

    let text = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("Kunne ikke lese {}: {}", path, e))?;
    let parsed = ptx_parser::parse_session_info(&text);

    // Bygg markører med endSeconds = neste markørs start (siste → null).
    let mut marker_json: Vec<Value> = Vec::new();
    for (i, m) in parsed.markers.iter().enumerate() {
        let end = parsed.markers.get(i + 1).map(|nx| nx.start_seconds);
        marker_json.push(json!({
            "name": m.name,
            "startSeconds": m.start_seconds,
            "endSeconds": end,
        }));
    }

    let markers_count = marker_json.len() as i64;
    let mr = api_client::post_markers(&snap.api_base, token, session_id, Value::Array(marker_json)).await?;
    let sections_synced = mr.get("sectionsSynced").and_then(|v| v.as_i64()).unwrap_or(0);

    // Metadata (samplerate/bitdybde/spor).
    let tracks_json: Vec<Value> = parsed
        .tracks
        .iter()
        .map(|t| json!({ "name": t, "type": "audio" }))
        .collect();
    let meta = json!({
        "sampleRate": parsed.sample_rate,
        "bitDepth": parsed.bit_depth,
        "tracks": tracks_json,
    });
    let _ = api_client::post_metadata(&snap.api_base, token, session_id, meta).await;

    emit_activity(
        app,
        "marker",
        &format!("Synket {} markører → {} seksjoner", markers_count, sections_synced),
    );

    Ok(SyncResult {
        markers_stored: markers_count,
        sections_synced,
        sample_rate: parsed.sample_rate,
        track_count: parsed.tracks.len() as i64,
    })
}

fn is_audio_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()) {
        Some(ext) => matches!(ext.as_str(), "wav" | "aif" | "aiff" | "mp3" | "m4a" | "flac"),
        None => false,
    }
}

/// Last opp en ferdig bounce → ny review-versjon. Idempotent på storage-key i config.
pub async fn upload_bounce(cfg: &SharedConfig, app: &AppHandle, path: &Path) -> Result<BounceResult, String> {
    if !is_audio_file(path) {
        return Err("Ikke en lydfil".into());
    }
    let snap = snapshot(cfg);
    let token = require(&snap.token, "device-token")?;
    let session_id = require(&snap.session_id, "sesjon")?;

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("bounce.wav")
        .to_string();

    let bytes = tokio::fs::read(path)
        .await
        .map_err(|e| format!("Kunne ikke lese {}: {}", file_name, e))?;
    let size = bytes.len() as u64;
    if size == 0 {
        return Err("Tom fil".into());
    }

    emit_activity(app, "info", &format!("Laster opp «{}» ({} MB)…", file_name, size / 1_048_576));

    let (upload_url, file_url, storage_key) =
        api_client::presign_bounce(&snap.api_base, token, session_id, &file_name, size).await?;
    api_client::put_bytes(&upload_url, bytes).await?;

    let payload = json!({
        "fileUrl": file_url,
        "storageKey": storage_key,
        "fileName": file_name,
    });
    let res = api_client::complete_bounce(&snap.api_base, token, session_id, payload).await?;
    let review_version_id = res.get("reviewVersionId").and_then(|v| v.as_str()).map(|s| s.to_string());
    let version_number = res.get("versionNumber").and_then(|v| v.as_i64());
    let sections_synced = res.get("sectionsSynced").and_then(|v| v.as_i64()).unwrap_or(0);

    // Marker storage-key som lastet opp (dedup).
    {
        let mut c = cfg.lock().unwrap();
        if !storage_key.is_empty() && !c.uploaded_bounces.contains(&storage_key) {
            c.uploaded_bounces.push(storage_key);
        }
        let _ = config::save(&c);
    }

    emit_activity(
        app,
        "bounce",
        &match version_number {
            Some(n) => format!("«{}» → review-versjon Mix V{}", file_name, n),
            None => format!("«{}» lastet opp", file_name),
        },
    );

    Ok(BounceResult { review_version_id, version_number, sections_synced })
}

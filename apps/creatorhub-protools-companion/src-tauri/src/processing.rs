//! Kjerneflyten: les Pro Tools-eksport → push til backend.

use std::path::Path;
use std::collections::BTreeMap;
use std::io::SeekFrom;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

use crate::api_client;
use crate::config;
use crate::ptx_parser;
use crate::state::{emit_activity, snapshot, SharedConfig};

#[derive(Serialize, Clone)]
pub struct SyncResult {
    pub markers_stored: i64,
    pub sections_synced: i64,
    pub easeverse_synced: bool,
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
    opt.as_deref()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("{} mangler", what))
}

fn safe_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .chars()
        .take(120)
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// Stabil hendelsesidentitet uten å lagre eller sende hele lokalstien.
pub fn file_fingerprint(path: &Path) -> Result<String, String> {
    let meta =
        std::fs::metadata(path).map_err(|e| format!("Kunne ikke lese filmetadata: {}", e))?;
    let modified = meta
        .modified()
        .unwrap_or(UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    Ok(format!(
        "{}:{}:{}",
        safe_file_name(path),
        meta.len(),
        modified
    ))
}

pub fn is_bounce_uploaded(cfg: &SharedConfig, path: &Path) -> bool {
    file_fingerprint(path)
        .map(|fingerprint| cfg.lock().unwrap().uploaded_bounces.contains(&fingerprint))
        .unwrap_or(false)
}

/// Les «Session Info»-tekstfila, parse markører/metadata, og push til backend.
pub async fn sync_session_info(cfg: &SharedConfig, app: &AppHandle) -> Result<SyncResult, String> {
    let snap = snapshot(cfg);
    let token = require(&snap.token, "device-token")?;
    let session_id = require(&snap.session_id, "sesjon")?;
    let path = require(&snap.session_info_path, "Session Info-fil")?;
    let event_id = format!("session-info:{}", file_fingerprint(Path::new(path))?);

    let text = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("Kunne ikke lese {}: {}", path, e))?;
    let parsed = ptx_parser::parse_session_info(&text);

    let marker_json: Vec<Value> = parsed
        .markers
        .iter()
        .enumerate()
        .map(|(index, marker)| {
            let end = parsed.markers.get(index + 1).map(|next| next.start_seconds);
            json!({
                "id": format!("marker-{}", index + 1),
                "name": marker.name,
                "startSeconds": marker.start_seconds,
                "endSeconds": end,
            })
        })
        .collect();

    let markers_count = marker_json.len() as i64;
    let marker_result = api_client::post_markers(
        &snap.api_base,
        token,
        session_id,
        Value::Array(marker_json),
        &event_id,
    )
    .await?;
    let sections_synced = marker_result
        .get("sectionsSynced")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let easeverse_synced = marker_result
        .get("easeverseSync")
        .and_then(|v| v.get("synced"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let tracks_json: Vec<Value> = parsed
        .tracks
        .iter()
        .map(|track| json!({ "name": track, "type": "audio" }))
        .collect();
    api_client::post_metadata(
        &snap.api_base,
        token,
        session_id,
        json!({
            "eventId": event_id,
            "tempo": parsed.tempo,
            "keySignature": parsed.key_signature,
            "timeSignature": parsed.time_signature,
            "sampleRate": parsed.sample_rate,
            "bitDepth": parsed.bit_depth,
            "tracks": tracks_json,
        }),
    )
    .await?;

    emit_activity(
        app,
        "marker",
        &format!(
            "Synket {} markører → {} seksjoner{}",
            markers_count,
            sections_synced,
            if easeverse_synced {
                " · EaseVerse ✓"
            } else {
                " · EaseVerse i kø"
            },
        ),
    );

    Ok(SyncResult {
        markers_stored: markers_count,
        sections_synced,
        easeverse_synced,
        sample_rate: parsed.sample_rate,
        track_count: parsed.tracks.len() as i64,
    })
}

fn is_audio_file(path: &Path) -> bool {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
    {
        Some(ext) => matches!(
            ext.as_str(),
            "wav" | "aif" | "aiff" | "mp3" | "m4a" | "flac"
        ),
        None => false,
    }
}

fn audio_content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|value| value.to_str()).map(str::to_lowercase).as_deref() {
        Some("wav") => "audio/wav",
        Some("aif") | Some("aiff") => "audio/aiff",
        Some("mp3") => "audio/mpeg",
        Some("m4a") => "audio/mp4",
        Some("flac") => "audio/flac",
        _ => "application/octet-stream",
    }
}

fn sha256_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

async fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| format!("Kunne ikke lese fil for checksum: {}", e))?;
    let mut hasher = Sha256::new();
    let mut chunk = vec![0_u8; 4 * 1024 * 1024];
    loop {
        let read = file.read(&mut chunk).await.map_err(|e| format!("Checksum feilet: {}", e))?;
        if read == 0 { break; }
        hasher.update(&chunk[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

async fn read_file_part(
    file: &mut tokio::fs::File,
    offset: u64,
    length: usize,
) -> Result<Vec<u8>, String> {
    file.seek(SeekFrom::Start(offset)).await.map_err(|e| format!("Kunne ikke søke i fil: {}", e))?;
    let mut bytes = vec![0_u8; length];
    file.read_exact(&mut bytes).await.map_err(|e| format!("Kunne ikke lese fildel: {}", e))?;
    Ok(bytes)
}

/// Last opp en ferdig bounce → én idempotent review-versjon.
pub async fn upload_bounce(
    cfg: &SharedConfig,
    app: &AppHandle,
    path: &Path,
) -> Result<BounceResult, String> {
    if !is_audio_file(path) {
        return Err("Ikke en lydfil".into());
    }
    let fingerprint = file_fingerprint(path)?;
    if cfg.lock().unwrap().uploaded_bounces.contains(&fingerprint) {
        return Err("Denne filversjonen er allerede lastet opp".into());
    }
    let snap = snapshot(cfg);
    let token = require(&snap.token, "device-token")?;
    let session_id = require(&snap.session_id, "sesjon")?;
    let file_name = safe_file_name(path);

    let size = tokio::fs::metadata(path)
        .await
        .map_err(|e| format!("Kunne ikke lese {}: {}", file_name, e))?
        .len();
    if size == 0 {
        return Err("Tom fil".into());
    }
    let checksum_sha256 = sha256_file(path).await?;
    let client_event_id = format!("bounce:{}", fingerprint);

    emit_activity(
        app,
        "info",
        &format!("Laster opp «{}» ({} MB)…", file_name, size / 1_048_576),
    );
    let ticket = api_client::presign_bounce(
        &snap.api_base,
        token,
        session_id,
        &file_name,
        size,
        audio_content_type(path),
        &checksum_sha256,
        &client_event_id,
    ).await?;
    let object_id = ticket.get("objectId").and_then(Value::as_str)
        .ok_or("Mangler objectId i opplastingsticket")?;
    let already_uploaded = ticket.get("alreadyUploaded").and_then(Value::as_bool).unwrap_or(false);
    let mut completed_parts: BTreeMap<u64, Value> = BTreeMap::new();

    if !already_uploaded {
        match ticket.get("strategy").and_then(Value::as_str).unwrap_or("") {
            "single" => {
                let upload_url = ticket.get("uploadUrl").and_then(Value::as_str)
                    .ok_or("Mangler uploadUrl")?;
                let bytes = tokio::fs::read(path).await
                    .map_err(|e| format!("Kunne ikke lese {}: {}", file_name, e))?;
                api_client::put_bytes(
                    upload_url,
                    bytes,
                    ticket.get("requiredHeaders").unwrap_or(&Value::Null),
                ).await?;
            }
            "multipart" => {
                let part_size = ticket.get("partSize").and_then(Value::as_u64)
                    .ok_or("Mangler partSize")?;
                let part_count = ticket.get("partCount").and_then(Value::as_u64)
                    .ok_or("Mangler partCount")?;
                let status = api_client::bounce_upload_status(
                    &snap.api_base, token, session_id, object_id,
                ).await?;
                if let Some(parts) = status.get("uploadedParts").and_then(Value::as_array) {
                    for part in parts {
                        let number = part.get("partNumber").and_then(Value::as_u64).unwrap_or(0);
                        let etag = part.get("etag").and_then(Value::as_str).unwrap_or("");
                        let checksum = part.get("checksumSha256").and_then(Value::as_str).unwrap_or("");
                        if number > 0 && !etag.is_empty() && checksum.len() == 64 {
                            completed_parts.insert(number, json!({
                                "partNumber": number,
                                "etag": etag,
                                "checksumSha256": checksum,
                            }));
                        }
                    }
                }
                let mut file = tokio::fs::File::open(path).await
                    .map_err(|e| format!("Kunne ikke åpne {}: {}", file_name, e))?;
                for part_number in 1..=part_count {
                    if completed_parts.contains_key(&part_number) { continue; }
                    let offset = (part_number - 1) * part_size;
                    let length = std::cmp::min(part_size, size - offset) as usize;
                    let bytes = read_file_part(&mut file, offset, length).await?;
                    let part_checksum = sha256_bytes(&bytes);
                    let signed = api_client::presign_bounce_parts(
                        &snap.api_base,
                        token,
                        session_id,
                        object_id,
                        json!([{ "partNumber": part_number, "checksumSha256": part_checksum }]),
                    ).await?;
                    let signed_part = signed.get("parts").and_then(Value::as_array)
                        .and_then(|parts| parts.first()).ok_or("Mangler presignert fildel")?;
                    let upload_url = signed_part.get("uploadUrl").and_then(Value::as_str)
                        .ok_or("Mangler uploadUrl for fildel")?;
                    let etag = api_client::put_bytes(
                        upload_url,
                        bytes,
                        signed_part.get("requiredHeaders").unwrap_or(&Value::Null),
                    ).await?;
                    if etag.is_empty() { return Err("S3 svarte uten ETag for fildel".into()); }
                    completed_parts.insert(part_number, json!({
                        "partNumber": part_number,
                        "etag": etag,
                        "checksumSha256": part_checksum,
                    }));
                }
            }
            _ => return Err("Ukjent opplastingsstrategi".into()),
        }
    }

    let response = api_client::complete_bounce(
        &snap.api_base,
        token,
        session_id,
        json!({
            "objectId": object_id,
            "parts": completed_parts.values().cloned().collect::<Vec<Value>>(),
            "fileName": file_name,
            "clientEventId": client_event_id,
            "contentFingerprint": fingerprint.clone(),
            "sizeBytes": size,
        }),
    )
    .await?;
    let review_version_id = response
        .get("reviewVersionId")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let version_number = response.get("versionNumber").and_then(|v| v.as_i64());
    let sections_synced = response
        .get("sectionsSynced")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    {
        let mut current = cfg.lock().unwrap();
        if !current.uploaded_bounces.contains(&fingerprint) {
            current.uploaded_bounces.push(fingerprint);
            if current.uploaded_bounces.len() > 500 {
                let remove = current.uploaded_bounces.len() - 500;
                current.uploaded_bounces.drain(0..remove);
            }
        }
        config::save(&current)?;
    }

    emit_activity(
        app,
        "bounce",
        &match version_number {
            Some(number) => format!("«{}» → review-versjon Mix V{}", file_name, number),
            None => format!("«{}» lastet opp", file_name),
        },
    );

    Ok(BounceResult {
        review_version_id,
        version_number,
        sections_synced,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn fingerprint_changes_when_file_changes() {
        let dir = std::env::temp_dir().join(format!("ptc-fingerprint-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("Mix One.wav");
        fs::write(&path, b"one").unwrap();
        let first = file_fingerprint(&path).unwrap();
        fs::write(&path, b"a longer bounce").unwrap();
        let second = file_fingerprint(&path).unwrap();
        assert_ne!(first, second);
        assert!(!first.contains(dir.to_string_lossy().as_ref()));
        let _ = fs::remove_file(path);
        let _ = fs::remove_dir(dir);
    }
}

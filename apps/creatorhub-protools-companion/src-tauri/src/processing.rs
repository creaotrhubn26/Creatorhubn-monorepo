//! Kjerneflyten: les Pro Tools-eksport → push til backend.

use std::io::Cursor;
use std::path::Path;
use std::time::UNIX_EPOCH;

use ebur128::{EbuR128, Mode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::AppHandle;

use crate::api_client;
use crate::config;
use crate::intro_preflight::{self, IntroPreflight};
use crate::ptsl;
use crate::ptx_parser;
use crate::state::{emit_activity, snapshot, SharedConfig};

#[derive(Serialize, Clone)]
pub struct SyncResult {
    pub markers_stored: i64,
    pub sections_synced: i64,
    pub easeverse_synced: bool,
    pub sample_rate: Option<f64>,
    pub track_count: i64,
    pub intro_preflight: IntroPreflight,
}

#[derive(Debug, Serialize, Clone)]
pub struct BounceResult {
    pub bounce_id: Option<String>,
    pub artifact_id: Option<String>,
    pub review_version_id: Option<String>,
    pub version_number: Option<i64>,
    pub sections_synced: i64,
    pub file_url: Option<String>,
    pub file_name: String,
    pub size_bytes: u64,
    pub checksum: String,
    pub qc_report: AudioQcReport,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AudioQcIssue {
    pub severity: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AudioQcReport {
    pub analyzable: bool,
    pub passed: bool,
    pub standard: String,
    pub sample_rate: Option<u32>,
    pub bit_depth: Option<u16>,
    pub channels: Option<u16>,
    pub duration_seconds: Option<f64>,
    pub integrated_lufs: Option<f64>,
    pub sample_peak_dbfs: Option<f64>,
    pub true_peak_dbtp: Option<f64>,
    pub clipped_samples: u64,
    pub silence_ratio: Option<f64>,
    pub leading_silence_seconds: Option<f64>,
    pub trailing_silence_seconds: Option<f64>,
    pub issues: Vec<AudioQcIssue>,
}

#[derive(Debug, Clone, Default)]
pub struct UploadContext {
    pub snapshot_id: Option<String>,
    pub delivery_job_id: Option<String>,
    pub delivery_kind: Option<String>,
    pub register_as_review: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryOutput {
    pub kind: String,
    pub file_name: String,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeliveryResult {
    pub job_id: String,
    pub manifest_id: Option<String>,
    pub outputs: Vec<BounceResult>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct WavMetadata {
    pub(crate) sample_rate: u32,
    pub(crate) bit_depth: u16,
    pub(crate) duration_seconds: f64,
}

fn little_u16(bytes: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_le_bytes(
        bytes.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

fn little_u32(bytes: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_le_bytes(
        bytes.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

/// Read the fields needed by Sound Room directly from a RIFF/WAVE bounce.
///
/// A Pro Tools session may use 32-bit float while ExportMix intentionally
/// renders a 24-bit review file. Using session metadata for the bounce would
/// therefore label a valid 24-bit file as 32-bit in Sound Room.
pub(crate) fn wav_metadata(bytes: &[u8]) -> Option<WavMetadata> {
    if bytes.get(0..4)? != b"RIFF" || bytes.get(8..12)? != b"WAVE" {
        return None;
    }

    let mut cursor = 12usize;
    let mut format: Option<(u32, u16, u16)> = None;
    let mut data_size: Option<u32> = None;
    while cursor.checked_add(8)? <= bytes.len() {
        let chunk_id = bytes.get(cursor..cursor + 4)?;
        let chunk_size = little_u32(bytes, cursor + 4)?;
        let data_start = cursor.checked_add(8)?;
        let data_end = data_start.checked_add(chunk_size as usize)?;
        if data_end > bytes.len() {
            return None;
        }

        if chunk_id == b"fmt " && chunk_size >= 16 {
            let sample_rate = little_u32(bytes, data_start + 4)?;
            let block_align = little_u16(bytes, data_start + 12)?;
            let container_bits = little_u16(bytes, data_start + 14)?;
            let valid_bits = if chunk_size >= 20 {
                little_u16(bytes, data_start + 18).unwrap_or(0)
            } else {
                0
            };
            let bit_depth = if valid_bits > 0 && valid_bits <= container_bits {
                valid_bits
            } else {
                container_bits
            };
            if sample_rate == 0 || block_align == 0 || bit_depth == 0 {
                return None;
            }
            format = Some((sample_rate, block_align, bit_depth));
        } else if chunk_id == b"data" {
            data_size = Some(chunk_size);
        }

        let padded_size = (chunk_size as usize).checked_add((chunk_size % 2) as usize)?;
        cursor = data_start.checked_add(padded_size)?;
    }

    let (sample_rate, block_align, bit_depth) = format?;
    let duration_seconds = data_size? as f64 / (sample_rate as f64 * block_align as f64);
    Some(WavMetadata {
        sample_rate,
        bit_depth,
        duration_seconds,
    })
}

fn finite_metric(value: f64) -> Option<f64> {
    value.is_finite().then_some((value * 100.0).round() / 100.0)
}

fn linear_db(value: f64) -> f64 {
    if value > 0.0 {
        20.0 * value.log10()
    } else {
        -120.0
    }
}

/// EBU R128 integrated loudness and oversampled true peak, plus deterministic
/// delivery hygiene checks. This analyzes the actual bounce, not the session.
pub fn analyze_wav(bytes: &[u8]) -> AudioQcReport {
    let fallback = || AudioQcReport {
        analyzable: false,
        passed: false,
        standard: "EBU R128 / ITU-R BS.1770 true peak".into(),
        sample_rate: None,
        bit_depth: None,
        channels: None,
        duration_seconds: None,
        integrated_lufs: None,
        sample_peak_dbfs: None,
        true_peak_dbtp: None,
        clipped_samples: 0,
        silence_ratio: None,
        leading_silence_seconds: None,
        trailing_silence_seconds: None,
        issues: vec![AudioQcIssue {
            severity: "error".into(),
            code: "unreadable_audio".into(),
            message: "Lydfilen kunne ikke analyseres som WAV.".into(),
        }],
    };
    let mut reader = match hound::WavReader::new(Cursor::new(bytes)) {
        Ok(reader) => reader,
        Err(_) => return fallback(),
    };
    let spec = reader.spec();
    if spec.channels == 0 || spec.sample_rate == 0 {
        return fallback();
    }
    let scale = 2_f32.powi(i32::from(spec.bits_per_sample.saturating_sub(1)));
    let samples: Result<Vec<f32>, _> = match spec.sample_format {
        hound::SampleFormat::Float => reader.samples::<f32>().collect(),
        hound::SampleFormat::Int if spec.bits_per_sample <= 16 => reader
            .samples::<i16>()
            .map(|sample| sample.map(|value| value as f32 / scale))
            .collect(),
        hound::SampleFormat::Int => reader
            .samples::<i32>()
            .map(|sample| sample.map(|value| value as f32 / scale))
            .collect(),
    };
    let samples = match samples {
        Ok(samples) if !samples.is_empty() => samples,
        _ => return fallback(),
    };
    let channels = usize::from(spec.channels);
    let frames = samples.len() / channels;
    let duration = frames as f64 / spec.sample_rate as f64;
    let mut meter = match EbuR128::new(
        u32::from(spec.channels),
        spec.sample_rate,
        Mode::I | Mode::SAMPLE_PEAK | Mode::TRUE_PEAK,
    ) {
        Ok(meter) => meter,
        Err(_) => return fallback(),
    };
    if meter.add_frames_f32(&samples).is_err() {
        return fallback();
    }
    let loudness = meter.loudness_global().ok().and_then(finite_metric);
    let sample_peak = (0..u32::from(spec.channels))
        .filter_map(|channel| meter.sample_peak(channel).ok())
        .fold(0.0_f64, f64::max);
    let true_peak = (0..u32::from(spec.channels))
        .filter_map(|channel| meter.true_peak(channel).ok())
        .fold(0.0_f64, f64::max);
    let clipped_samples = samples
        .iter()
        .filter(|sample| sample.abs() >= 0.999_969)
        .count() as u64;
    let silence_threshold = 10_f32.powf(-60.0 / 20.0);
    let silent_frames = samples
        .chunks_exact(channels)
        .filter(|frame| frame.iter().all(|sample| sample.abs() < silence_threshold))
        .count();
    let leading_frames = samples
        .chunks_exact(channels)
        .take_while(|frame| frame.iter().all(|sample| sample.abs() < silence_threshold))
        .count();
    let trailing_frames = samples
        .chunks_exact(channels)
        .rev()
        .take_while(|frame| frame.iter().all(|sample| sample.abs() < silence_threshold))
        .count();
    let sample_peak_dbfs = finite_metric(linear_db(sample_peak));
    let true_peak_dbtp = finite_metric(linear_db(true_peak));
    let mut issues = Vec::new();
    if duration < 0.5 {
        issues.push(AudioQcIssue {
            severity: "error".into(),
            code: "too_short".into(),
            message: "Eksporten er kortere enn 0,5 sekund.".into(),
        });
    }
    if clipped_samples > 0 {
        issues.push(AudioQcIssue {
            severity: "error".into(),
            code: "clipping".into(),
            message: format!("{} samples treffer full skala.", clipped_samples),
        });
    }
    if true_peak_dbtp.is_some_and(|peak| peak > -0.1) {
        issues.push(AudioQcIssue {
            severity: "warning".into(),
            code: "true_peak_headroom".into(),
            message: "True peak er høyere enn −0,1 dBTP.".into(),
        });
    }
    if spec.bits_per_sample < 24 {
        issues.push(AudioQcIssue {
            severity: "warning".into(),
            code: "bit_depth".into(),
            message: format!(
                "{}-bit er lavere enn anbefalt 24-bit for review/leveranse.",
                spec.bits_per_sample
            ),
        });
    }
    if leading_frames as f64 / spec.sample_rate as f64 > 2.0
        || trailing_frames as f64 / spec.sample_rate as f64 > 2.0
    {
        issues.push(AudioQcIssue {
            severity: "warning".into(),
            code: "long_silence".into(),
            message: "Mer enn to sekunder stillhet i starten eller slutten.".into(),
        });
    }
    let passed = !issues.iter().any(|issue| issue.severity == "error");
    AudioQcReport {
        analyzable: true,
        passed,
        standard: "EBU R128 / ITU-R BS.1770 true peak".into(),
        sample_rate: Some(spec.sample_rate),
        bit_depth: Some(spec.bits_per_sample),
        channels: Some(spec.channels),
        duration_seconds: finite_metric(duration),
        integrated_lufs: loudness,
        sample_peak_dbfs,
        true_peak_dbtp,
        clipped_samples,
        silence_ratio: finite_metric(silent_frames as f64 / frames.max(1) as f64),
        leading_silence_seconds: finite_metric(leading_frames as f64 / spec.sample_rate as f64),
        trailing_silence_seconds: finite_metric(trailing_frames as f64 / spec.sample_rate as f64),
        issues,
    }
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
    let intro_preflight = intro_preflight::evaluate(parsed.track_counts.clone());
    let ptsl_status = ptsl::probe();

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
            "proToolsTier": snap.protools_tier,
            "ptslStatus": ptsl_status.state,
            "introPreflight": intro_preflight,
        }),
    )
    .await?;

    {
        let mut current = cfg.lock().unwrap();
        current.intro_preflight = Some(intro_preflight.clone());
        config::save(&current)?;
    }

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
        intro_preflight,
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

/// Last opp en ferdig bounce → én idempotent review-versjon.
pub async fn upload_bounce(
    cfg: &SharedConfig,
    app: &AppHandle,
    path: &Path,
) -> Result<BounceResult, String> {
    upload_bounce_with_context(
        cfg,
        app,
        path,
        UploadContext {
            register_as_review: true,
            ..Default::default()
        },
    )
    .await
}

pub async fn upload_bounce_with_context(
    cfg: &SharedConfig,
    app: &AppHandle,
    path: &Path,
    context: UploadContext,
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

    let bytes = tokio::fs::read(path)
        .await
        .map_err(|e| format!("Kunne ikke lese {}: {}", file_name, e))?;
    let size = bytes.len() as u64;
    if size == 0 {
        return Err("Tom fil".into());
    }
    let audio_metadata = wav_metadata(&bytes);
    let qc_report = analyze_wav(&bytes);
    let checksum = format!("{:x}", Sha256::digest(&bytes));

    emit_activity(
        app,
        "info",
        &format!("Laster opp «{}» ({} MB)…", file_name, size / 1_048_576),
    );
    let (upload_url, file_url, storage_key) =
        api_client::presign_bounce(&snap.api_base, token, session_id, &file_name, size).await?;
    api_client::put_bytes(&upload_url, bytes).await?;

    let response = api_client::complete_bounce(
        &snap.api_base,
        token,
        session_id,
        json!({
            "fileUrl": file_url,
            "storageKey": storage_key,
            "fileName": file_name,
            "clientEventId": format!("bounce:{}", fingerprint),
            "contentFingerprint": fingerprint,
            "sizeBytes": size,
            "durationSeconds": audio_metadata.map(|metadata| metadata.duration_seconds),
            "sampleRate": audio_metadata.map(|metadata| metadata.sample_rate),
            "bitDepth": audio_metadata.map(|metadata| metadata.bit_depth),
            "qcReport": qc_report,
            "snapshotId": context.snapshot_id,
            "deliveryJobId": context.delivery_job_id,
            "deliveryKind": context.delivery_kind,
            "registerAsReview": context.register_as_review,
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
    let bounce_id = response
        .get("bounceId")
        .and_then(Value::as_str)
        .map(str::to_string);
    let artifact_id = response
        .get("artifactId")
        .and_then(Value::as_str)
        .map(str::to_string);

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
        bounce_id,
        artifact_id,
        review_version_id,
        version_number,
        sections_synced,
        file_url: Some(file_url),
        file_name,
        size_bytes: size,
        checksum,
        qc_report,
    })
}

pub async fn capture_session_snapshot(cfg: &SharedConfig, reason: &str) -> Result<Value, String> {
    let snap = snapshot(cfg);
    let token = require(&snap.token, "device-token")?;
    let session_id = require(&snap.session_id, "sesjon")?;
    let mut session_snapshot = ptsl::execute("session_snapshot", json!({})).await?;
    if let Some(object) = session_snapshot.as_object_mut() {
        object.remove("execution");
    }
    let encoded = serde_json::to_vec(&session_snapshot)
        .map_err(|error| format!("Serialiser snapshot: {}", error))?;
    let fingerprint = format!("{:x}", Sha256::digest(&encoded));
    if reason == "session_changed"
        && cfg.lock().unwrap().last_session_fingerprint.as_deref() == Some(&fingerprint)
    {
        return Ok(json!({ "fingerprint": fingerprint, "unchanged": true }));
    }
    if let Some(object) = session_snapshot.as_object_mut() {
        object.insert(
            "capturedAt".into(),
            json!(std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()),
        );
    }
    let stored =
        api_client::create_snapshot(&snap.api_base, token, session_id, session_snapshot, reason)
            .await?;
    {
        let mut current = cfg.lock().unwrap();
        current.last_session_fingerprint = Some(fingerprint.clone());
        config::save(&current)?;
    }
    Ok(json!({ "fingerprint": fingerprint, "snapshot": stored }))
}

async fn wait_for_export(path: &Path) -> Result<(), String> {
    let mut last_size = None;
    let mut stable_reads = 0;
    for _ in 0..360 {
        if let Ok(metadata) = tokio::fs::metadata(path).await {
            if metadata.len() > 0 && Some(metadata.len()) == last_size {
                stable_reads += 1;
                if stable_reads >= 3 {
                    return Ok(());
                }
            } else {
                stable_reads = 0;
                last_size = Some(metadata.len());
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    }
    Err(format!(
        "Pro Tools-eksporten ble ikke ferdig: {}",
        path.display()
    ))
}

pub async fn send_to_review(
    cfg: &SharedConfig,
    app: &AppHandle,
    file_name: &str,
    source: Option<String>,
) -> Result<BounceResult, String> {
    let snap = snapshot(cfg);
    let output_directory = require(&snap.bounce_dir, "Bounced Files-mappe")?;
    emit_activity(app, "info", "Tar session snapshot før review-eksport …");
    let snapshot = capture_session_snapshot(cfg, "pre_publish").await?;
    let result = ptsl::execute(
        "export_review",
        json!({
            "outputDirectory": output_directory, "fileName": file_name, "source": source
        }),
    )
    .await?;
    let output_path = result
        .get("outputPath")
        .and_then(Value::as_str)
        .ok_or("PTSL returnerte ingen eksportsti")?;
    wait_for_export(Path::new(output_path)).await?;
    upload_bounce_with_context(
        cfg,
        app,
        Path::new(output_path),
        UploadContext {
            snapshot_id: snapshot
                .pointer("/snapshot/id")
                .and_then(Value::as_str)
                .map(str::to_string),
            delivery_kind: Some("review".into()),
            register_as_review: true,
            ..Default::default()
        },
    )
    .await
}

async fn fail_delivery_job(
    api_base: &str,
    token: &str,
    session_id: &str,
    job_id: &str,
    progress: usize,
    error: &str,
    qc_reports: Value,
) {
    let _ = api_client::update_delivery_job(
        api_base,
        token,
        session_id,
        job_id,
        json!({
            "status": "failed",
            "progress": progress.min(99),
            "error": error,
            "qcReports": qc_reports,
        }),
    )
    .await;
}

pub async fn run_delivery(
    cfg: &SharedConfig,
    app: &AppHandle,
    preset: &str,
    output_directory: &str,
    outputs: Vec<DeliveryOutput>,
) -> Result<DeliveryResult, String> {
    if outputs.is_empty() || outputs.len() > 32 {
        return Err("Velg mellom 1 og 32 leveranser".into());
    }
    let snap = snapshot(cfg);
    let token = require(&snap.token, "device-token")?;
    let session_id = require(&snap.session_id, "sesjon")?;
    let request_json = serde_json::to_value(&outputs).map_err(|error| error.to_string())?;
    let job = api_client::create_delivery_job(
        &snap.api_base,
        token,
        session_id,
        preset,
        request_json.clone(),
    )
    .await?;
    let job_id = job
        .get("id")
        .and_then(Value::as_str)
        .ok_or("Backend returnerte ingen leveransejobb")?
        .to_string();
    let snapshot_result = match capture_session_snapshot(cfg, "pre_publish").await {
        Ok(value) => value,
        Err(error) => {
            fail_delivery_job(
                &snap.api_base,
                token,
                session_id,
                &job_id,
                0,
                &error,
                json!([]),
            )
            .await;
            return Err(format!(
                "Session Snapshot feilet; leveransen ble stoppet: {}",
                error
            ));
        }
    };
    let snapshot_id = snapshot_result
        .pointer("/snapshot/id")
        .and_then(Value::as_str)
        .map(str::to_string);
    let exported = match ptsl::execute(
        "export_delivery",
        json!({ "outputDirectory": output_directory, "outputs": request_json }),
    )
    .await
    {
        Ok(value) => value,
        Err(error) => {
            fail_delivery_job(
                &snap.api_base,
                token,
                session_id,
                &job_id,
                0,
                &error,
                json!([]),
            )
            .await;
            return Err(error);
        }
    };
    let paths = exported
        .get("outputs")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut completed = Vec::new();
    for (index, exported) in paths.iter().enumerate() {
        let path = match exported.get("path").and_then(Value::as_str) {
            Some(path) => path,
            None => {
                let error = "Pro Tools returnerte ingen eksportsti";
                fail_delivery_job(
                    &snap.api_base,
                    token,
                    session_id,
                    &job_id,
                    index * 100 / paths.len().max(1),
                    error,
                    json!([]),
                )
                .await;
                return Err(error.into());
            }
        };
        if let Err(error) = wait_for_export(Path::new(path)).await {
            fail_delivery_job(
                &snap.api_base,
                token,
                session_id,
                &job_id,
                index * 100 / paths.len().max(1),
                &error,
                json!([]),
            )
            .await;
            return Err(error);
        }
        let bytes = match tokio::fs::read(path).await {
            Ok(bytes) => bytes,
            Err(error) => {
                let message = format!("Les leveranse: {}", error);
                fail_delivery_job(
                    &snap.api_base,
                    token,
                    session_id,
                    &job_id,
                    index * 100 / paths.len().max(1),
                    &message,
                    json!([]),
                )
                .await;
                return Err(message);
            }
        };
        let qc = analyze_wav(&bytes);
        if !qc.passed {
            let message = format!(
                "QC stoppet {}: {}",
                path,
                qc.issues
                    .iter()
                    .map(|issue| issue.message.as_str())
                    .collect::<Vec<_>>()
                    .join(" ")
            );
            fail_delivery_job(
                &snap.api_base,
                token,
                session_id,
                &job_id,
                index * 100 / paths.len().max(1),
                &message,
                json!([qc]),
            )
            .await;
            return Err(message);
        }
        let kind = outputs
            .get(index)
            .map(|output| output.kind.clone())
            .unwrap_or_else(|| "stem".into());
        let upload = match upload_bounce_with_context(
            cfg,
            app,
            Path::new(path),
            UploadContext {
                snapshot_id: snapshot_id.clone(),
                delivery_job_id: Some(job_id.clone()),
                delivery_kind: Some(if kind == "master" {
                    "master".into()
                } else if kind == "mix" {
                    "mix".into()
                } else {
                    "stem".into()
                }),
                register_as_review: false,
            },
        )
        .await
        {
            Ok(upload) => upload,
            Err(error) => {
                fail_delivery_job(
                    &snap.api_base,
                    token,
                    session_id,
                    &job_id,
                    index * 100 / paths.len().max(1),
                    &error,
                    json!([qc]),
                )
                .await;
                return Err(error);
            }
        };
        completed.push(upload);
        let output_files: Vec<Value> = completed.iter().map(|item| json!({
            "bounceId": item.bounce_id, "artifactId": item.artifact_id, "fileName": item.file_name,
            "fileUrl": item.bounce_id.as_ref().map(|id| format!("/api/protools/bounces/{}/file", id)).or_else(|| item.file_url.clone()),
            "format": "wav", "sizeBytes": item.size_bytes, "checksum": item.checksum
        })).collect();
        let qc_reports: Vec<&AudioQcReport> =
            completed.iter().map(|item| &item.qc_report).collect();
        let _ = api_client::update_delivery_job(
            &snap.api_base,
            token,
            session_id,
            &job_id,
            json!({
                "status": "running", "progress": ((index + 1) * 100 / paths.len().max(1)),
                "outputFiles": output_files, "qcReports": qc_reports
            }),
        )
        .await;
    }
    let output_files: Vec<Value> = completed.iter().map(|item| json!({
        "bounceId": item.bounce_id, "artifactId": item.artifact_id, "fileName": item.file_name,
        "fileUrl": item.bounce_id.as_ref().map(|id| format!("/api/protools/bounces/{}/file", id)).or_else(|| item.file_url.clone()),
        "format": "wav", "sizeBytes": item.size_bytes, "checksum": item.checksum
    })).collect();
    let qc_reports: Vec<&AudioQcReport> = completed.iter().map(|item| &item.qc_report).collect();
    let finished = api_client::update_delivery_job(&snap.api_base, token, session_id, &job_id, json!({
        "status": "completed", "progress": 100, "outputFiles": output_files, "qcReports": qc_reports
    })).await?;
    Ok(DeliveryResult {
        job_id,
        manifest_id: finished
            .get("manifest_id")
            .and_then(Value::as_str)
            .map(str::to_string),
        outputs: completed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn mono_pcm16_wav(sample_rate: u32, samples: &[i16]) -> Vec<u8> {
        let data_size = (samples.len() * 2) as u32;
        let mut wav = Vec::with_capacity(44 + data_size as usize);
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_size).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&(sample_rate * 2).to_le_bytes());
        wav.extend_from_slice(&2u16.to_le_bytes());
        wav.extend_from_slice(&16u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_size.to_le_bytes());
        for sample in samples {
            wav.extend_from_slice(&sample.to_le_bytes());
        }
        wav
    }

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

    #[test]
    fn reads_24_bit_wav_metadata_instead_of_session_bit_depth() {
        let sample_rate = 48_000u32;
        let channels = 2u16;
        let bit_depth = 24u16;
        let block_align = channels * (bit_depth / 8);
        let data_size = sample_rate * block_align as u32;
        let mut wav = Vec::new();
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_size).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&channels.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&(sample_rate * block_align as u32).to_le_bytes());
        wav.extend_from_slice(&block_align.to_le_bytes());
        wav.extend_from_slice(&bit_depth.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_size.to_le_bytes());
        wav.resize(wav.len() + data_size as usize, 0);

        assert_eq!(
            wav_metadata(&wav),
            Some(WavMetadata {
                sample_rate,
                bit_depth,
                duration_seconds: 1.0,
            })
        );
    }

    #[test]
    fn qc_measures_loudness_peak_and_delivery_metadata() {
        let sample_rate = 48_000u32;
        let samples: Vec<i16> = (0..sample_rate)
            .map(|index| {
                let phase = index as f64 * 440.0 * std::f64::consts::TAU / sample_rate as f64;
                (phase.sin() * 8_000.0) as i16
            })
            .collect();
        let report = analyze_wav(&mono_pcm16_wav(sample_rate, &samples));
        assert!(report.analyzable);
        assert!(report.passed);
        assert_eq!(report.sample_rate, Some(sample_rate));
        assert_eq!(report.bit_depth, Some(16));
        assert_eq!(report.channels, Some(1));
        assert!(report.integrated_lufs.is_some());
        assert!(report.true_peak_dbtp.is_some());
        assert!(report.issues.iter().any(|issue| issue.code == "bit_depth"));
    }

    #[test]
    fn qc_blocks_full_scale_clipping() {
        let sample_rate = 48_000u32;
        let samples = vec![i16::MAX; sample_rate as usize];
        let report = analyze_wav(&mono_pcm16_wav(sample_rate, &samples));
        assert!(report.analyzable);
        assert!(!report.passed);
        assert!(report.clipped_samples > 0);
        assert!(report
            .issues
            .iter()
            .any(|issue| { issue.code == "clipping" && issue.severity == "error" }));
    }

    #[test]
    fn qc_fails_closed_for_non_wav_input() {
        let report = analyze_wav(b"not audio");
        assert!(!report.analyzable);
        assert!(!report.passed);
        assert_eq!(report.issues[0].code, "unreadable_audio");
    }
}

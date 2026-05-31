//! DIT-jobs reporter mot CreatorHub-backend.
//!
//! Speiler shape-en til `tools/dit-helper/src/cli.ts` (linjer 192-280)
//! men kjører fra Tauri-appen i stedet for CLI-en.
//!
//! Best-effort: backend-feil skal ALDRI aborte en pågående lokal kopi.
//! Hvis backend er nede, fortsetter kopiene; status synes bare ikke i
//! `MemoryCardBackupPanel` i webklienten.
//!
//! Endepunkter (gated på Bearer helper-token):
//!   POST  /api/dit/jobs         → returnerer { job: { id, ... } }
//!   PATCH /api/dit/jobs/:id     → oppdaterer status/bytes/hash/error
//!
//! Tillatte PATCH-felter (jf. backend dit-backup-routes.ts allowed-listen):
//!   status, bytes_copied, dest_path, dest_size_bytes, dest_hash,
//!   started_at, completed_at, error_code, error_message

use serde::Serialize;
use serde_json::Value;

use crate::helper_client::Config;

const HELPER_VERSION: &str = env!("CARGO_PKG_VERSION");

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "creatorhub-one-desk".to_string())
}

#[derive(Serialize)]
struct CreateJobBody<'a> {
    destination_id: &'a str,
    source_path: &'a str,
    source_size_bytes: u64,
    source_hash: &'a str,
    hash_algorithm: &'a str,
    status: &'a str,
    helper_hostname: String,
    helper_version: &'a str,
}

#[derive(Serialize)]
struct PatchProgress {
    bytes_copied: u64,
}

#[derive(Serialize)]
struct PatchVerified<'a> {
    status: &'a str,
    dest_path: &'a str,
    dest_size_bytes: u64,
    dest_hash: &'a str,
    bytes_copied: u64,
    completed_at: String,
}

#[derive(Serialize)]
struct PatchFailed<'a> {
    status: &'a str,
    completed_at: String,
    error_code: &'a str,
    error_message: &'a str,
}

fn build_url(api_base: &str, path: &str) -> String {
    let base = api_base.trim_end_matches('/');
    format!("{}{}", base, path)
}

async fn post(cfg: &Config, path: &str, body: &impl Serialize) -> Result<Value, String> {
    let url = build_url(&cfg.api_base, path);
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", cfg.token))
        .header("User-Agent", format!("creatorhub-one-desk/{}", HELPER_VERSION))
        .json(body)
        .send()
        .await
        .map_err(|e| format!("POST {}: {}", url, e))?;
    let status = resp.status();
    if !status.is_success() {
        let snippet = resp.text().await.unwrap_or_default().chars().take(300).collect::<String>();
        return Err(format!("POST {} → {}: {}", url, status.as_u16(), snippet));
    }
    resp.json::<Value>().await.map_err(|e| format!("Parse POST {} response: {}", url, e))
}

async fn patch(cfg: &Config, path: &str, body: &impl Serialize) -> Result<Value, String> {
    let url = build_url(&cfg.api_base, path);
    let client = reqwest::Client::new();
    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", cfg.token))
        .header("User-Agent", format!("creatorhub-one-desk/{}", HELPER_VERSION))
        .json(body)
        .send()
        .await
        .map_err(|e| format!("PATCH {}: {}", url, e))?;
    let status = resp.status();
    if !status.is_success() {
        let snippet = resp.text().await.unwrap_or_default().chars().take(300).collect::<String>();
        return Err(format!("PATCH {} → {}: {}", url, status.as_u16(), snippet));
    }
    resp.json::<Value>().await.map_err(|e| format!("Parse PATCH {} response: {}", url, e))
}

/// Oppretter en backup-job mot backend. Returnerer backend-generert job_id.
pub async fn create_job(
    cfg: &Config,
    destination_id: &str,
    source_path: &str,
    source_size_bytes: u64,
    source_hash: &str,
) -> Result<String, String> {
    let body = CreateJobBody {
        destination_id,
        source_path,
        source_size_bytes,
        source_hash,
        hash_algorithm: "xxh64",
        status: "copying",
        helper_hostname: hostname(),
        helper_version: HELPER_VERSION,
    };
    let resp = post(cfg, "/api/dit/jobs", &body).await?;
    let job_id = resp
        .get("job")
        .and_then(|j| j.get("id"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Mangler job.id i backend-respons".to_string())?
        .to_string();
    Ok(job_id)
}

/// Fire-and-forget progress-update. Caller bør throttle (f.eks. hver 5s).
pub async fn report_progress(cfg: &Config, job_id: &str, bytes_copied: u64) -> Result<(), String> {
    patch(cfg, &format!("/api/dit/jobs/{}", job_id), &PatchProgress { bytes_copied })
        .await
        .map(|_| ())
}

/// Marker job som verifisert (suksessfull kopi + hash-match).
pub async fn report_verified(
    cfg: &Config,
    job_id: &str,
    dest_path: &str,
    dest_size_bytes: u64,
    dest_hash: &str,
) -> Result<(), String> {
    let body = PatchVerified {
        status: "verified",
        dest_path,
        dest_size_bytes,
        dest_hash,
        bytes_copied: dest_size_bytes,
        completed_at: chrono_now_iso(),
    };
    patch(cfg, &format!("/api/dit/jobs/{}", job_id), &body).await.map(|_| ())
}

/// Marker job som feilet.
pub async fn report_failed(
    cfg: &Config,
    job_id: &str,
    error_code: &str,
    error_message: &str,
) -> Result<(), String> {
    let body = PatchFailed {
        status: "failed",
        completed_at: chrono_now_iso(),
        error_code,
        error_message,
    };
    patch(cfg, &format!("/api/dit/jobs/{}", job_id), &body).await.map(|_| ())
}

/// Returnerer current time som ISO-8601 i UTC. Vi unngår å trekke inn
/// chrono-crate'en bare for dette — manuell formatering er trivielt.
fn chrono_now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let total_secs = now.as_secs();
    let days = total_secs / 86400;
    let secs_today = total_secs % 86400;
    let hours = secs_today / 3600;
    let minutes = (secs_today % 3600) / 60;
    let seconds = secs_today % 60;

    // Days siden epoch (1970-01-01) → year/month/day
    let (year, month, day) = days_to_ymd(days as i64);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

/// Konverter "days since 1970-01-01" til (year, month, day).
/// Civil_from_days algoritme av Howard Hinnant — public domain.
fn days_to_ymd(days_since_epoch: i64) -> (i64, u32, u32) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

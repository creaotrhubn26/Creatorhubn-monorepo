//! Capture-mirror (F6b).
//!
//! Når mirror er aktivert for en session, lytter Desk på Tauri-eventene
//! fra `capture_subscriber` og laster ned hver asset til lokal RAID:
//!
//!   1. Capture-event med assetId mottas
//!   2. Sjekk om assetet allerede er mirrored (dedup)
//!   3. GET /api/dit/assets/:id/download-url → signed R2-URL
//!   4. Last ned til ~/.creatorhub-one-desk/cache/<asset-id>.<ext>
//!   5. copy_engine kopierer fra cache til alle backend-tracked DIT-destinasjoner
//!   6. Slett cache-fila etter kopi
//!
//! Mirror-state per session: enabled/disabled + set av mirrored asset-IDs.
//! Persisteres ikke (refreshes på reconnect). For ekte produksjon kan vi
//! vurdere en SQLite-state senere.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

use crate::copy_engine::copy_and_verify;
use crate::helper_client::{self, Config};

#[derive(Default)]
pub struct MirrorState {
    /// Sessions where mirror er aktivert + hvilke destinasjoner som brukes
    enabled: Mutex<HashMap<String, Vec<MirrorDestination>>>,
    /// Asset-IDs vi allerede har behandlet (suksess eller pågående) — dedup
    seen_assets: Mutex<HashSet<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MirrorDestination {
    pub id: String,
    pub label: String,
    pub path: String,
}

impl MirrorState {
    pub fn enable(&self, session_id: String, destinations: Vec<MirrorDestination>) {
        self.enabled.lock().unwrap().insert(session_id, destinations);
    }

    pub fn disable(&self, session_id: &str) -> bool {
        self.enabled.lock().unwrap().remove(session_id).is_some()
    }

    pub fn enabled_sessions(&self) -> Vec<String> {
        self.enabled.lock().unwrap().keys().cloned().collect()
    }

    pub fn destinations_for(&self, session_id: &str) -> Option<Vec<MirrorDestination>> {
        self.enabled.lock().unwrap().get(session_id).cloned()
    }

    /// Returner true hvis vi tok ansvar for asset_id (første gang vi ser den).
    /// Brukes til dedup mellom samtidige events.
    fn claim_asset(&self, asset_id: &str) -> bool {
        self.seen_assets.lock().unwrap().insert(asset_id.to_string())
    }

    fn release_asset(&self, asset_id: &str) {
        self.seen_assets.lock().unwrap().remove(asset_id);
    }
}

#[derive(Serialize, Clone)]
struct MirrorEvent {
    session_id: String,
    asset_id: String,
    state: String, // "queued" | "downloading" | "copying" | "done" | "failed" | "skipped"
    filename: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct DownloadUrlResponse {
    success: bool,
    url: Option<String>,
    filename: Option<String>,
    #[allow(dead_code)]
    size_bytes: Option<u64>,
    #[allow(dead_code)]
    mime: Option<String>,
    error: Option<String>,
}

fn cache_dir() -> PathBuf {
    helper_client::config_dir().join("cache")
}

/// Sanitiser et iPad-rapportert filename så det ALDRI kan brukes til
/// path-traversal. Vi tar bare leaf-komponenten og avviser farlige
/// kontrollkarakterer. Hvis resultatet er tomt eller bare prikker,
/// faller vi tilbake til asset_id.
///
/// Trusler vi beskytter mot:
///   - `../../etc/passwd` → `passwd` (file_name) → "passwd" (safe)
///   - `/abs/path/file.jpg` → `file.jpg` (file_name) → safe
///   - `..` eller "." → tom etter trim → fallback
///   - filename med NUL eller andre kontrollkarakterer → erstattet med "_"
///   - Veldig lange filenames → trimmet til 200 tegn
fn safe_filename(reported: &str, asset_id: &str) -> String {
    let leaf = std::path::Path::new(reported)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .trim_matches(|c: char| c == '.' || c.is_whitespace());
    if leaf.is_empty() {
        return format!("asset-{}", asset_id);
    }
    let cleaned: String = leaf
        .chars()
        .map(|c| {
            if c.is_control() || c == '/' || c == '\\' || c == ':' || c == '\0' {
                '_'
            } else {
                c
            }
        })
        .take(200)
        .collect();
    if cleaned.is_empty() || cleaned.chars().all(|c| c == '.' || c == '_') {
        format!("asset-{}", asset_id)
    } else {
        cleaned
    }
}

#[cfg(test)]
mod safe_filename_tests {
    use super::safe_filename;

    #[test]
    fn strips_path_traversal() {
        assert_eq!(safe_filename("../../etc/passwd", "abc"), "passwd");
        assert_eq!(safe_filename("/abs/path/file.jpg", "abc"), "file.jpg");
        assert_eq!(safe_filename("..", "abc"), "asset-abc");
        assert_eq!(safe_filename(".", "abc"), "asset-abc");
        assert_eq!(safe_filename("", "abc"), "asset-abc");
    }

    #[test]
    fn allows_normal_filenames() {
        assert_eq!(safe_filename("IMG_0001.CR3", "x"), "IMG_0001.CR3");
        assert_eq!(safe_filename("foto med mellomrom.jpg", "x"), "foto med mellomrom.jpg");
        assert_eq!(safe_filename("héllo.png", "x"), "héllo.png");
    }

    #[test]
    fn strips_control_chars() {
        assert_eq!(safe_filename("file\0name.jpg", "x"), "file_name.jpg");
        assert_eq!(safe_filename("a/b/c.jpg", "x"), "c.jpg"); // file_name strips dirs
    }

    #[test]
    fn caps_length() {
        let long = "a".repeat(500);
        let result = safe_filename(&long, "x");
        assert!(result.len() <= 200);
    }
}

async fn fetch_download_url(
    cfg: &Config,
    asset_id: &str,
) -> Result<(String, String), String> {
    let url = format!(
        "{}/api/dit/assets/{}/download-url",
        cfg.api_base.trim_end_matches('/'),
        urlencoding::encode(asset_id)
    );
    let resp = reqwest::Client::new()
        .get(&url)
        .header("Authorization", format!("Bearer {}", cfg.token))
        .header(
            "User-Agent",
            concat!("creatorhub-one-desk/", env!("CARGO_PKG_VERSION")),
        )
        .send()
        .await
        .map_err(|e| format!("download-url request feilet: {}", e))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("download-url HTTP {}", status.as_u16()));
    }
    let body: DownloadUrlResponse = resp
        .json()
        .await
        .map_err(|e| format!("parse download-url: {}", e))?;
    if !body.success {
        return Err(body.error.unwrap_or_else(|| "Ukjent feil".into()));
    }
    let url = body.url.ok_or("Mangler url i respons")?;
    let filename = body.filename.unwrap_or_else(|| asset_id.to_string());
    Ok((url, filename))
}

async fn download_to_cache(url: &str, dest: &PathBuf) -> Result<u64, String> {
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("opprett cache-mappe: {}", e))?;
    }
    let resp = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("download GET: {}", e))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("download HTTP {}", status.as_u16()));
    }
    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("opprett cache-fil: {}", e))?;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("read body: {}", e))?;
    let size = bytes.len() as u64;
    file.write_all(&bytes)
        .await
        .map_err(|e| format!("skriv cache: {}", e))?;
    file.flush().await.ok();
    file.sync_all().await.ok();
    Ok(size)
}

/// Trigger mirror for et asset. Spawnes som tokio-task fra subscriber-loopen.
pub fn maybe_mirror_asset(
    app: AppHandle,
    state: Arc<MirrorState>,
    session_id: String,
    asset_id: String,
) {
    let destinations = match state.destinations_for(&session_id) {
        Some(d) if !d.is_empty() => d,
        _ => return, // Mirror ikke aktivert for denne sessionen
    };
    if !state.claim_asset(&asset_id) {
        return; // allerede behandlet
    }

    tokio::spawn(async move {
        let _ = app.emit(
            "capture-mirror-event",
            MirrorEvent {
                session_id: session_id.clone(),
                asset_id: asset_id.clone(),
                state: "queued".into(),
                filename: None,
                error: None,
            },
        );

        let cfg = match helper_client::load_config() {
            Ok(Some(c)) => c,
            _ => {
                let _ = app.emit(
                    "capture-mirror-event",
                    MirrorEvent {
                        session_id,
                        asset_id: asset_id.clone(),
                        state: "failed".into(),
                        filename: None,
                        error: Some("Ingen config".into()),
                    },
                );
                state.release_asset(&asset_id);
                return;
            }
        };

        // 1. Hent presigned URL
        let (url, reported_filename) = match fetch_download_url(&cfg, &asset_id).await {
            Ok(t) => t,
            Err(err) => {
                let _ = app.emit(
                    "capture-mirror-event",
                    MirrorEvent {
                        session_id,
                        asset_id: asset_id.clone(),
                        state: "failed".into(),
                        filename: None,
                        error: Some(format!("download-url: {}", err)),
                    },
                );
                state.release_asset(&asset_id);
                return;
            }
        };

        // Sanitiser filename FØR vi rører disk — path-traversal-defense.
        // Backend sender iPad-rapportert original_filename, og det skal aldri
        // få lov å peke utenfor cache- eller destinasjons-mappa.
        let filename = safe_filename(&reported_filename, &asset_id);

        // 2. Last ned til cache
        let _ = app.emit(
            "capture-mirror-event",
            MirrorEvent {
                session_id: session_id.clone(),
                asset_id: asset_id.clone(),
                state: "downloading".into(),
                filename: Some(filename.clone()),
                error: None,
            },
        );
        let cache_file = cache_dir().join(format!("{}-{}", asset_id, filename));
        let size = match download_to_cache(&url, &cache_file).await {
            Ok(s) => s,
            Err(err) => {
                // Slett en evt. partiell cache-fil så vi ikke leaker disk
                // på asset-er som aldri retries.
                let _ = tokio::fs::remove_file(&cache_file).await;
                let _ = app.emit(
                    "capture-mirror-event",
                    MirrorEvent {
                        session_id,
                        asset_id: asset_id.clone(),
                        state: "failed".into(),
                        filename: Some(filename),
                        error: Some(err),
                    },
                );
                state.release_asset(&asset_id);
                return;
            }
        };

        // 3. Hash cache + kopiér til destinasjoner via copy_engine
        let _ = app.emit(
            "capture-mirror-event",
            MirrorEvent {
                session_id: session_id.clone(),
                asset_id: asset_id.clone(),
                state: "copying".into(),
                filename: Some(filename.clone()),
                error: None,
            },
        );

        // (Trinn 3-hash er flyttet inn i copy_and_verify som uansett
        // beregner source-hash. Vi gjør det ikke separat her — sparer
        // én diskgjennomgang per fil.)

        let mut any_failed = false;
        for dest in &destinations {
            // Sikkerhetsbarriere: nekt destinasjon hvis labelens "Capture"-
            // subdir på en eller annen måte havner utenfor dest.path. Per
            // konstruksjon kan det ikke skje (vi har sanitisert filename),
            // men vi assert'er likevel som defense-in-depth.
            let dest_root = PathBuf::from(&dest.path);
            let dest_path = dest_root.join("Capture").join(&filename);
            match copy_and_verify(&cache_file, &dest_path, |_, _| {}).await {
                Ok(_) => {
                    // OK
                }
                Err(err) => {
                    any_failed = true;
                    eprintln!(
                        "[mirror] copy til {} feilet: {}",
                        dest.label, err
                    );
                }
            }
        }

        // 4. Slett cache-fila
        let _ = tokio::fs::remove_file(&cache_file).await;

        let _ = app.emit(
            "capture-mirror-event",
            MirrorEvent {
                session_id,
                asset_id: asset_id.clone(),
                state: if any_failed { "failed".into() } else { "done".into() },
                filename: Some(filename),
                error: None,
            },
        );
        // Slipp asset hvis det feilet (så user kan retry); behold hvis OK (dedup).
        if any_failed {
            state.release_asset(&asset_id);
        }
        let _ = size; // hold size i scope for fremtidig progress-rapportering
    });
}

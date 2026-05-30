//! Copy-session orchestrator: kjører en bakgrunns-tokio-task som walker
//! et mount og kopierer hver media-fil til N destinasjoner parallelt med
//! xxHash64-verifisering.
//!
//! Sequencing-model:
//!   - Per session: filer fra kortet prosesseres SEKVENSIELT (vi vil ikke
//!     hamre kortet med samtidige reads — det bremser totalen).
//!   - Per fil: kilde-hash beregnes EN gang, deretter kopieres til alle
//!     destinasjoner PARALLELT (de er typisk forskjellige fysiske disker).
//!
//! Tauri-events emit'ed til frontend:
//!   - `copy-session-started`   { session_id, mount_path, file_count, total_bytes }
//!   - `copy-file-started`      { session_id, source_path, size }
//!   - `copy-file-progress`     { session_id, source_path, dest_id, bytes_copied, bytes_total }
//!   - `copy-file-completed`    { session_id, source_path, dest_id, success, error?, hash? }
//!   - `copy-session-completed` { session_id, succeeded, failed, cancelled }

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use walkdir::WalkDir;

use crate::copy_engine::{build_dest_path, copy_and_verify, hash_file_xxh64};
use crate::mount_watcher;

const PROGRESS_THROTTLE_MS: u128 = 250;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestinationSpec {
    pub id: String,
    pub label: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSpec {
    pub mount_path: String,
    pub volume_label: String,
    pub destinations: Vec<DestinationSpec>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionStatus {
    pub session_id: String,
    pub mount_path: String,
    pub volume_label: String,
    pub state: String, // "running" | "completed" | "cancelled" | "failed"
    pub file_count: usize,
    pub total_bytes: u64,
    pub succeeded: usize,
    pub failed: usize,
    pub started_at_ms: u128,
}

struct SessionHandle {
    status: SessionStatus,
    cancel: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct CopySessionState {
    sessions: Mutex<HashMap<String, SessionHandle>>,
}

impl CopySessionState {
    pub fn list(&self) -> Vec<SessionStatus> {
        self.sessions.lock().unwrap().values().map(|h| h.status.clone()).collect()
    }

    pub fn cancel(&self, session_id: &str) -> bool {
        if let Some(h) = self.sessions.lock().unwrap().get(session_id) {
            h.cancel.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    fn insert(&self, status: SessionStatus, cancel: Arc<AtomicBool>) {
        self.sessions
            .lock()
            .unwrap()
            .insert(status.session_id.clone(), SessionHandle { status, cancel });
    }

    fn update<F: FnOnce(&mut SessionStatus)>(&self, session_id: &str, f: F) {
        if let Some(h) = self.sessions.lock().unwrap().get_mut(session_id) {
            f(&mut h.status);
        }
    }
}

/// Walker mount-en og samler media-filer (foto + video) som skal kopieres.
fn enumerate_media_files(mount: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let walker = WalkDir::new(mount)
        .max_depth(8)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        if !entry.file_type().is_file() {
            continue;
        }
        let Some(ext) = entry.path().extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase())
        else {
            continue;
        };
        if mount_watcher::is_media_extension(&ext) {
            out.push(entry.path().to_path_buf());
        }
    }
    out
}

#[derive(Serialize, Clone)]
struct SessionStartedEvent {
    session_id: String,
    mount_path: String,
    file_count: usize,
    total_bytes: u64,
}

#[derive(Serialize, Clone)]
struct FileStartedEvent {
    session_id: String,
    source_path: String,
    size: u64,
}

#[derive(Serialize, Clone)]
struct FileProgressEvent {
    session_id: String,
    source_path: String,
    dest_id: String,
    bytes_copied: u64,
    bytes_total: u64,
}

#[derive(Serialize, Clone)]
struct FileCompletedEvent {
    session_id: String,
    source_path: String,
    dest_id: String,
    success: bool,
    hash: Option<String>,
    error: Option<String>,
    skipped: bool,
}

#[derive(Serialize, Clone)]
struct SessionCompletedEvent {
    session_id: String,
    succeeded: usize,
    failed: usize,
    cancelled: bool,
}

pub async fn start_session(
    app: AppHandle,
    state: Arc<CopySessionState>,
    spec: SessionSpec,
) -> Result<String, String> {
    let mount = PathBuf::from(&spec.mount_path);
    if !mount.exists() {
        return Err(format!("Mount finnes ikke: {}", mount.display()));
    }
    if spec.destinations.is_empty() {
        return Err("Minst én destinasjon kreves".into());
    }
    for d in &spec.destinations {
        let p = PathBuf::from(&d.path);
        if !p.exists() {
            // Vi opprett destinasjons-rot hvis den mangler — men ikke andre nivåer.
            std::fs::create_dir_all(&p)
                .map_err(|e| format!("Kunne ikke opprette {}: {}", p.display(), e))?;
        }
    }

    let session_id = format!("sess_{}", Uuid::new_v4());
    let files = enumerate_media_files(&mount);
    let total_bytes: u64 = files
        .iter()
        .filter_map(|p| std::fs::metadata(p).ok().map(|m| m.len()))
        .sum();

    let status = SessionStatus {
        session_id: session_id.clone(),
        mount_path: spec.mount_path.clone(),
        volume_label: spec.volume_label.clone(),
        state: "running".into(),
        file_count: files.len(),
        total_bytes,
        succeeded: 0,
        failed: 0,
        started_at_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
    };

    let cancel = Arc::new(AtomicBool::new(false));
    state.insert(status.clone(), cancel.clone());

    let _ = app.emit(
        "copy-session-started",
        SessionStartedEvent {
            session_id: session_id.clone(),
            mount_path: spec.mount_path.clone(),
            file_count: files.len(),
            total_bytes,
        },
    );

    // Spawn bakgrunns-task
    let app_clone = app.clone();
    let state_clone = state.clone();
    let session_id_clone = session_id.clone();
    tokio::spawn(async move {
        run_session(app_clone, state_clone, session_id_clone, spec, files, cancel).await;
    });

    Ok(session_id)
}

async fn run_session(
    app: AppHandle,
    state: Arc<CopySessionState>,
    session_id: String,
    spec: SessionSpec,
    files: Vec<PathBuf>,
    cancel: Arc<AtomicBool>,
) {
    let mount = PathBuf::from(&spec.mount_path);
    let mut cancelled = false;

    for source in files {
        if cancel.load(Ordering::SeqCst) {
            cancelled = true;
            break;
        }

        let size = std::fs::metadata(&source).map(|m| m.len()).unwrap_or(0);
        let _ = app.emit(
            "copy-file-started",
            FileStartedEvent {
                session_id: session_id.clone(),
                source_path: source.display().to_string(),
                size,
            },
        );

        // Hash kilde EN gang (deles på tvers av destinasjoner)
        let source_hash = match hash_file_xxh64(&source).await {
            Ok(h) => h,
            Err(err) => {
                // Source-hash feilet — marker alle dest som failed for denne fila
                for d in &spec.destinations {
                    state.update(&session_id, |s| s.failed += 1);
                    let _ = app.emit(
                        "copy-file-completed",
                        FileCompletedEvent {
                            session_id: session_id.clone(),
                            source_path: source.display().to_string(),
                            dest_id: d.id.clone(),
                            success: false,
                            hash: None,
                            error: Some(format!("Kunne ikke hashe kilde: {}", err)),
                            skipped: false,
                        },
                    );
                }
                continue;
            }
        };

        // Kopier parallelt til alle destinasjoner
        let mut handles = Vec::new();
        for dest_spec in &spec.destinations {
            let dest_root = PathBuf::from(&dest_spec.path);
            let dest_path = match build_dest_path(&source, &mount, &dest_root, &spec.volume_label)
            {
                Ok(p) => p,
                Err(err) => {
                    let app_em = app.clone();
                    let sid = session_id.clone();
                    let src_disp = source.display().to_string();
                    let dest_id = dest_spec.id.clone();
                    let state_em = state.clone();
                    handles.push(tokio::spawn(async move {
                        state_em.update(&sid, |s| s.failed += 1);
                        let _ = app_em.emit(
                            "copy-file-completed",
                            FileCompletedEvent {
                                session_id: sid,
                                source_path: src_disp,
                                dest_id,
                                success: false,
                                hash: None,
                                error: Some(err),
                                skipped: false,
                            },
                        );
                    }));
                    continue;
                }
            };

            let app_em = app.clone();
            let sid = session_id.clone();
            let src = source.clone();
            let src_disp = source.display().to_string();
            let dest_id = dest_spec.id.clone();
            let src_hash = source_hash.clone();
            let state_em = state.clone();
            let cancel_em = cancel.clone();
            let dest_path_clone = dest_path.clone();

            handles.push(tokio::spawn(async move {
                // Idempotens-sjekk: hvis dest finnes med samme størrelse og hash, hopp over
                if dest_path_clone.exists() {
                    let same_size = std::fs::metadata(&dest_path_clone)
                        .map(|m| m.len() == size)
                        .unwrap_or(false);
                    if same_size {
                        match hash_file_xxh64(&dest_path_clone).await {
                            Ok(existing_hash) if existing_hash == src_hash => {
                                state_em.update(&sid, |s| s.succeeded += 1);
                                let _ = app_em.emit(
                                    "copy-file-completed",
                                    FileCompletedEvent {
                                        session_id: sid,
                                        source_path: src_disp,
                                        dest_id,
                                        success: true,
                                        hash: Some(existing_hash),
                                        error: None,
                                        skipped: true,
                                    },
                                );
                                return;
                            }
                            Ok(other_hash) => {
                                state_em.update(&sid, |s| s.failed += 1);
                                let _ = app_em.emit(
                                    "copy-file-completed",
                                    FileCompletedEvent {
                                        session_id: sid,
                                        source_path: src_disp,
                                        dest_id,
                                        success: false,
                                        hash: Some(other_hash.clone()),
                                        error: Some(format!(
                                            "Eksisterer med ulik hash ({} vs {}); ikke overskrevet",
                                            other_hash, src_hash
                                        )),
                                        skipped: false,
                                    },
                                );
                                return;
                            }
                            Err(_) => {
                                // Kunne ikke hashe eksisterende dest — la copy_and_verify feile på create_new
                            }
                        }
                    }
                }

                // Standard copy + verify
                let mut last_emit = Instant::now();
                let app_for_progress = app_em.clone();
                let sid_for_progress = sid.clone();
                let dest_id_for_progress = dest_id.clone();
                let src_disp_for_progress = src_disp.clone();
                let cancel_check = cancel_em.clone();
                let result = copy_and_verify(&src, &dest_path_clone, |copied, total| {
                    if cancel_check.load(Ordering::SeqCst) {
                        // Vi kan ikke avbryte midt i copy_with_progress fra her uten å
                        // panikkere — det er en kjent F3-begrensning. Cancel respekteres
                        // mellom filer, ikke midt i en fil.
                    }
                    let now = Instant::now();
                    if now.duration_since(last_emit).as_millis() >= PROGRESS_THROTTLE_MS {
                        last_emit = now;
                        let _ = app_for_progress.emit(
                            "copy-file-progress",
                            FileProgressEvent {
                                session_id: sid_for_progress.clone(),
                                source_path: src_disp_for_progress.clone(),
                                dest_id: dest_id_for_progress.clone(),
                                bytes_copied: copied,
                                bytes_total: total,
                            },
                        );
                    }
                })
                .await;

                match result {
                    Ok(v) => {
                        state_em.update(&sid, |s| s.succeeded += 1);
                        let _ = app_em.emit(
                            "copy-file-completed",
                            FileCompletedEvent {
                                session_id: sid,
                                source_path: src_disp,
                                dest_id,
                                success: true,
                                hash: Some(v.dest_hash),
                                error: None,
                                skipped: false,
                            },
                        );
                    }
                    Err(err) => {
                        state_em.update(&sid, |s| s.failed += 1);
                        let _ = app_em.emit(
                            "copy-file-completed",
                            FileCompletedEvent {
                                session_id: sid,
                                source_path: src_disp,
                                dest_id,
                                success: false,
                                hash: None,
                                error: Some(err),
                                skipped: false,
                            },
                        );
                    }
                }
            }));
        }

        // Vent på at alle destinasjoner for denne fila er ferdige før vi går
        // videre — dette gjør at vi ikke leser flere filer fra kortet samtidig.
        for h in handles {
            let _ = h.await;
        }
    }

    // Final session-state
    let (succeeded, failed) = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .map(|h| (h.status.succeeded, h.status.failed))
            .unwrap_or((0, 0))
    };
    state.update(&session_id, |s| {
        s.state = if cancelled {
            "cancelled".into()
        } else if failed > 0 && succeeded == 0 {
            "failed".into()
        } else {
            "completed".into()
        };
    });
    let _ = app.emit(
        "copy-session-completed",
        SessionCompletedEvent {
            session_id,
            succeeded,
            failed,
            cancelled,
        },
    );
}

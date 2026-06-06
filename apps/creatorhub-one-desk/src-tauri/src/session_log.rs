//! Append-only JSONL-log per copy-session.
//!
//! Hver session får en fil under `~/.creatorhub-one-desk/sessions/<id>.jsonl`.
//! Hver event er en JSON-linje. Filen er gjenoppspilbar — ved app-restart
//! leser vi alle JSONL-er, og hvis vi ikke fant `session_ended` markeres
//! sesjonen som "interrupted".
//!
//! Resume-flow:
//!   1. App-startup kaller `list_interrupted_sessions()`
//!   2. UI viser banner med interrupted-sessions
//!   3. Bruker klikker "Fortsett" → app kaller `resume_session(id)`
//!   4. copy_session leser logget SessionSpec + completed-set fra log,
//!      bygger ny SessionSpec uten allerede-completed (source,dest)-par
//!      og starter ny session som arving av samme log-fil
//!
//! Idempotens: copy_session.process_destination har allerede idempotens-
//! sjekk på dest-fila (samme size + hash → skip). Resume trenger derfor
//! ikke være pikselperfekt — det er nok å skippe filer vi VET er ferdig
//! og la engine-en selv re-verifisere uklare tilfeller.

use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::copy_session::SessionSpec;

const SESSION_LOG_RETENTION_DAYS: u64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LogEvent {
    /// Skrevet FØR run_session-loopen starter. Inneholder hele spec-en
    /// så resume vet hvilke destinasjoner som var konfigurert.
    SessionStarted {
        ts_ms: u64,
        session_id: String,
        spec: SessionSpec,
        files: Vec<FileEntry>,
    },
    /// Skrevet HVER GANG en (source, dest) er ferdig — uansett om
    /// success, skipped, eller failed.
    FileResult {
        ts_ms: u64,
        source: String,
        dest_id: String,
        outcome: FileOutcome,
        hash: Option<String>,
        error: Option<String>,
    },
    /// Skrevet ved slutt av run_session. Hvis denne event-en MANGLER i
    /// log-fila ved oppstart vet vi at sesjonen krasjet eller ble
    /// avbrutt unormalt.
    SessionEnded {
        ts_ms: u64,
        state: String,
        succeeded: usize,
        failed: usize,
        cancelled: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FileOutcome {
    Success,
    Skipped,
    Failed,
}

/// Bygger ~/.creatorhub-one-desk/sessions/ — opprettes lazily.
fn sessions_dir() -> Result<PathBuf, String> {
    let mut p = dirs::home_dir().ok_or_else(|| "home_dir not found".to_string())?;
    p.push(".creatorhub-one-desk");
    p.push("sessions");
    if !p.exists() {
        fs::create_dir_all(&p).map_err(|e| format!("create sessions dir: {}", e))?;
    }
    Ok(p)
}

fn now_ms() -> u64 {
    // u64-millis dekker frem til år ~584 millioner — mer enn nok.
    // u128 var penere men serde_json nekter u128 i default-konfig,
    // og log-fila må kunne JSON-round-trip-es uten ekstra features.
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Handle for å appende events til én session-log. Trådsikker via
/// internt Mutex — flere writers (én per destinasjon i parallel)
/// kan dele samme handle.
pub struct SessionLog {
    session_id: String,
    path: PathBuf,
    inner: Mutex<()>,
}

impl SessionLog {
    /// Opprett ny log-fil for session_id, skriv SessionStarted-event.
    pub fn create(session_id: &str, spec: &SessionSpec, files: &[(PathBuf, u64)]) -> Result<Self, String> {
        let dir = sessions_dir()?;
        let path = dir.join(format!("{}.jsonl", session_id));
        let log = Self {
            session_id: session_id.to_string(),
            path: path.clone(),
            inner: Mutex::new(()),
        };
        let entries: Vec<FileEntry> = files
            .iter()
            .map(|(p, size)| FileEntry {
                path: p.display().to_string(),
                size: *size,
            })
            .collect();
        log.append(&LogEvent::SessionStarted {
            ts_ms: now_ms(),
            session_id: session_id.to_string(),
            spec: spec.clone(),
            files: entries,
        })?;
        Ok(log)
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Åpne eksisterende log-fil for å appende videre events (brukes
    /// ved resume). Feiler hvis log-fila ikke eksisterer.
    pub fn open_existing(session_id: &str) -> Result<Self, String> {
        let dir = sessions_dir()?;
        let path = dir.join(format!("{}.jsonl", session_id));
        if !path.exists() {
            return Err(format!("log-fil for {} finnes ikke", session_id));
        }
        Ok(Self {
            session_id: session_id.to_string(),
            path,
            inner: Mutex::new(()),
        })
    }

    pub fn append(&self, event: &LogEvent) -> Result<(), String> {
        let _guard = self.inner.lock().unwrap();
        let line = serde_json::to_string(event)
            .map_err(|e| format!("serialize event: {}", e))?;
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .map_err(|e| format!("open log {}: {}", self.path.display(), e))?;
        writeln!(f, "{}", line).map_err(|e| format!("write log: {}", e))?;
        // fsync er dyrt; vi aksepterer et lite tap-vindu ved kernel-panic.
        // Per-fil-event er likevel garantert i page cache så app-crash
        // (vår egen) er beskyttet.
        Ok(())
    }
}

/// Sammendrag av en interrupted session — det UI viser i resume-banneret.
#[derive(Debug, Clone, Serialize)]
pub struct InterruptedSession {
    pub session_id: String,
    pub started_at_ms: u64,
    pub mount_path: String,
    pub volume_label: String,
    pub total_files: usize,
    pub files_completed_per_dest: Vec<(String, usize)>, // (dest_id, count)
    pub last_event_ms: u64,
}

/// Detaljert resume-input: gjenbruker original SessionSpec + sett av
/// (source, dest_id) som ALLEREDE er ferdig (success eller skipped).
pub struct ResumeData {
    pub spec: SessionSpec,
    pub files: Vec<FileEntry>,
    pub completed: std::collections::HashSet<(String, String)>,
}

/// Scan sessions/-mappen og finn alle sessions som ikke har SessionEnded.
pub fn list_interrupted_sessions() -> Result<Vec<InterruptedSession>, String> {
    let dir = match sessions_dir() {
        Ok(d) => d,
        Err(_) => return Ok(Vec::new()),
    };
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()),
    };
    let mut out = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
            continue;
        }
        match summarize_log(&path) {
            Ok(Some(summary)) => out.push(summary),
            Ok(None) => { /* session ended cleanly — ignore */ }
            Err(err) => {
                eprintln!("[session-log] kunne ikke lese {}: {}", path.display(), err);
            }
        }
    }
    out.sort_by(|a, b| b.last_event_ms.cmp(&a.last_event_ms));
    Ok(out)
}

/// Replay én log-fil. Returnerer Some(InterruptedSession) hvis
/// SessionEnded mangler, None hvis sesjonen avsluttet pent.
fn summarize_log(path: &Path) -> Result<Option<InterruptedSession>, String> {
    let f = fs::File::open(path).map_err(|e| format!("open: {}", e))?;
    let reader = BufReader::new(f);
    let mut started: Option<(String, u64, SessionSpec, Vec<FileEntry>)> = None;
    let mut completed_per_dest: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();
    let mut last_event_ms: u64 = 0;
    let mut ended = false;
    for line in reader.lines().map_while(Result::ok) {
        if line.trim().is_empty() {
            continue;
        }
        let ev: LogEvent = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(err) => {
                eprintln!("[session-log] skip ugyldig linje i {}: {}", path.display(), err);
                continue;
            }
        };
        match ev {
            LogEvent::SessionStarted { ts_ms, session_id, spec, files } => {
                last_event_ms = ts_ms;
                started = Some((session_id, ts_ms, spec, files));
            }
            LogEvent::FileResult { ts_ms, dest_id, outcome, .. } => {
                last_event_ms = ts_ms.max(last_event_ms);
                if matches!(outcome, FileOutcome::Success | FileOutcome::Skipped) {
                    *completed_per_dest.entry(dest_id).or_insert(0) += 1;
                }
            }
            LogEvent::SessionEnded { ts_ms, .. } => {
                last_event_ms = ts_ms.max(last_event_ms);
                ended = true;
            }
        }
    }
    if ended {
        return Ok(None);
    }
    let (session_id, started_at_ms, spec, files) = match started {
        Some(s) => s,
        None => return Ok(None), // log uten SessionStarted — korrupt, skip
    };
    let mut per_dest: Vec<(String, usize)> = completed_per_dest.into_iter().collect();
    per_dest.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(Some(InterruptedSession {
        session_id,
        started_at_ms,
        mount_path: spec.mount_path.clone(),
        volume_label: spec.volume_label.clone(),
        total_files: files.len(),
        files_completed_per_dest: per_dest,
        last_event_ms,
    }))
}

/// Returnerer ResumeData for en gitt session_id ved å lese loggen
/// på nytt. Bruker rebuild-fra-disk-tilnærming så vi alltid har
/// fersk completed-set selv hvis resume kalles flere ganger.
pub fn load_resume_data(session_id: &str) -> Result<ResumeData, String> {
    let dir = sessions_dir()?;
    let path = dir.join(format!("{}.jsonl", session_id));
    let f = fs::File::open(&path).map_err(|e| format!("open log: {}", e))?;
    let reader = BufReader::new(f);
    let mut spec: Option<SessionSpec> = None;
    let mut files: Vec<FileEntry> = Vec::new();
    let mut completed: std::collections::HashSet<(String, String)> =
        std::collections::HashSet::new();
    for line in reader.lines().map_while(Result::ok) {
        if line.trim().is_empty() {
            continue;
        }
        let ev: LogEvent = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };
        match ev {
            LogEvent::SessionStarted { spec: s, files: fs_list, .. } => {
                spec = Some(s);
                files = fs_list;
            }
            LogEvent::FileResult { source, dest_id, outcome, .. } => {
                if matches!(outcome, FileOutcome::Success | FileOutcome::Skipped) {
                    completed.insert((source, dest_id));
                }
            }
            LogEvent::SessionEnded { .. } => { /* ignore — vi resumer uansett */ }
        }
    }
    let spec = spec.ok_or_else(|| "log mangler SessionStarted-event".to_string())?;
    Ok(ResumeData { spec, files, completed })
}

/// Marker en interrupted session som "håndtert" (bruker valgte å forkaste
/// den i stedet for å resume). Sletter log-fila.
pub fn discard_session(session_id: &str) -> Result<(), String> {
    let dir = sessions_dir()?;
    let path = dir.join(format!("{}.jsonl", session_id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("remove log: {}", e))?;
    }
    Ok(())
}

/// Slett log-filer eldre enn SESSION_LOG_RETENTION_DAYS for å holde
/// disken ryddig. Kjøres lazy fra Tauri-command. Best-effort — feil
/// logges men feiler ikke kallet.
pub fn cleanup_old_logs() {
    let dir = match sessions_dir() {
        Ok(d) => d,
        Err(_) => return,
    };
    let cutoff = SystemTime::now() - Duration::from_secs(SESSION_LOG_RETENTION_DAYS * 86_400);
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    if modified < cutoff {
                        if let Err(err) = fs::remove_file(entry.path()) {
                            eprintln!(
                                "[session-log] cleanup remove {} feilet: {}",
                                entry.path().display(),
                                err
                            );
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::copy_session::{DestinationSpec, SessionSpec};
    use std::sync::{Mutex, MutexGuard, OnceLock};
    use tempfile::tempdir;

    /// Serialiserer alle tester som muterer $HOME slik at de ikke race-er.
    /// Tester i samme prosess deler env-state.
    fn home_lock() -> MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|p| p.into_inner())
    }

    fn dummy_spec() -> SessionSpec {
        SessionSpec {
            mount_path: "/Volumes/TEST_CARD".into(),
            volume_label: "TEST_CARD".into(),
            destinations: vec![
                DestinationSpec {
                    id: "dest-a".into(),
                    label: "Disk A".into(),
                    path: "/Volumes/A".into(),
                    backend_id: None,
                },
                DestinationSpec {
                    id: "dest-b".into(),
                    label: "Disk B".into(),
                    path: "/Volumes/B".into(),
                    backend_id: None,
                },
            ],
        }
    }

    /// Returnerer (TempDir, MutexGuard) — guard må droppes etter testen
    /// så neste test får ren $HOME-state. TempDir cleanes opp samtidig.
    fn fresh_home() -> (tempfile::TempDir, MutexGuard<'static, ()>) {
        let guard = home_lock();
        let d = tempdir().expect("tempdir");
        // SAFETY (Rust 2024): set_var er unsafe pga global tilstand;
        // vi serialiserer alle test-tråder via home_lock() over.
        unsafe {
            std::env::set_var("HOME", d.path());
        }
        (d, guard)
    }

    #[test]
    fn session_started_creates_jsonl_file() {
        let (_tmp, _guard) = fresh_home();
        let spec = dummy_spec();
        let files = vec![(PathBuf::from("/Volumes/TEST_CARD/IMG_1.CR3"), 1024)];
        let log = SessionLog::create("sess_test_1", &spec, &files).expect("create log");
        let dir = sessions_dir().unwrap();
        let path = dir.join("sess_test_1.jsonl");
        assert!(path.exists());
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("session_started"));
        assert!(content.contains("TEST_CARD"));
        drop(log);
    }

    #[test]
    fn interrupted_session_detected_when_session_ended_missing() {
        let (_tmp, _guard) = fresh_home();
        let spec = dummy_spec();
        let files = vec![(PathBuf::from("/Volumes/TEST_CARD/IMG_1.CR3"), 1024)];
        let log =
            SessionLog::create("sess_test_2", &spec, &files).expect("create log");
        log.append(&LogEvent::FileResult {
            ts_ms: now_ms(),
            source: "/Volumes/TEST_CARD/IMG_1.CR3".into(),
            dest_id: "dest-a".into(),
            outcome: FileOutcome::Success,
            hash: Some("abc123".into()),
            error: None,
        })
        .unwrap();
        // INGEN SessionEnded — simulerer crash
        let interrupted = list_interrupted_sessions().expect("list");
        assert_eq!(interrupted.len(), 1);
        assert_eq!(interrupted[0].session_id, "sess_test_2");
        assert_eq!(interrupted[0].files_completed_per_dest, vec![("dest-a".into(), 1)]);
    }

    #[test]
    fn cleanly_ended_session_not_interrupted() {
        let (_tmp, _guard) = fresh_home();
        let spec = dummy_spec();
        let files = vec![(PathBuf::from("/Volumes/TEST_CARD/IMG_1.CR3"), 1024)];
        let log =
            SessionLog::create("sess_test_3", &spec, &files).expect("create log");
        log.append(&LogEvent::SessionEnded {
            ts_ms: now_ms(),
            state: "completed".into(),
            succeeded: 2,
            failed: 0,
            cancelled: false,
        })
        .unwrap();
        let interrupted = list_interrupted_sessions().expect("list");
        assert!(
            interrupted.iter().all(|s| s.session_id != "sess_test_3"),
            "ferdig session skal ikke vises i interrupted-list"
        );
    }

    #[test]
    fn load_resume_data_returns_completed_pairs() {
        let (_tmp, _guard) = fresh_home();
        let spec = dummy_spec();
        let files = vec![
            (PathBuf::from("/Volumes/TEST_CARD/IMG_1.CR3"), 1024),
            (PathBuf::from("/Volumes/TEST_CARD/IMG_2.CR3"), 2048),
        ];
        let log =
            SessionLog::create("sess_test_4", &spec, &files).expect("create log");
        log.append(&LogEvent::FileResult {
            ts_ms: now_ms(),
            source: "/Volumes/TEST_CARD/IMG_1.CR3".into(),
            dest_id: "dest-a".into(),
            outcome: FileOutcome::Success,
            hash: None,
            error: None,
        })
        .unwrap();
        log.append(&LogEvent::FileResult {
            ts_ms: now_ms(),
            source: "/Volumes/TEST_CARD/IMG_1.CR3".into(),
            dest_id: "dest-b".into(),
            outcome: FileOutcome::Failed,
            hash: None,
            error: Some("disk-error".into()),
        })
        .unwrap();
        let resume = load_resume_data("sess_test_4").expect("load");
        assert_eq!(resume.files.len(), 2);
        assert_eq!(resume.spec.volume_label, "TEST_CARD");
        // Bare success/skipped teller — failed gjør at parret IKKE er i completed
        assert!(resume.completed.contains(&(
            "/Volumes/TEST_CARD/IMG_1.CR3".into(),
            "dest-a".into()
        )));
        assert!(!resume.completed.contains(&(
            "/Volumes/TEST_CARD/IMG_1.CR3".into(),
            "dest-b".into()
        )));
    }

    #[test]
    fn discard_session_removes_log_file() {
        let (_tmp, _guard) = fresh_home();
        let spec = dummy_spec();
        let files = vec![(PathBuf::from("/Volumes/TEST_CARD/IMG_1.CR3"), 1024)];
        let _log =
            SessionLog::create("sess_test_5", &spec, &files).expect("create log");
        let dir = sessions_dir().unwrap();
        let path = dir.join("sess_test_5.jsonl");
        assert!(path.exists());
        discard_session("sess_test_5").expect("discard");
        assert!(!path.exists());
    }
}

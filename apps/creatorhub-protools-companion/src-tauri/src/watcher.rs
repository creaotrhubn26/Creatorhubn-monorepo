//! Fil-overvåking: notify ser «Session Info»-fila og «Bounced Files»-mappa.
//! Endringer bridges over en tokio-kanal til en async task som pusher til backend.
//!
//! Stopp: når watcheren droppes (watcher_state.watcher = None) lukkes kanalen →
//! prosesserings-tasken avslutter rent.

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use notify::{EventKind, RecursiveMode, Watcher};
use tauri::AppHandle;

use crate::config::{self, PendingBounce};
use crate::processing;
use crate::state::{emit_activity, snapshot, SharedConfig, SharedWatcher};

fn is_audio(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase())
            .as_deref(),
        Some("wav") | Some("aif") | Some("aiff") | Some("mp3") | Some("m4a") | Some("flac")
    )
}

fn same_session_info(path: &Path, configured: &str) -> bool {
    let cfg = Path::new(configured);
    if path == cfg {
        return true;
    }
    match (path.file_name(), cfg.file_name()) {
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}

fn file_meta(path: &Path) -> Option<(u64, SystemTime)> {
    let m = std::fs::metadata(path).ok()?;
    Some((m.len(), m.modified().unwrap_or(SystemTime::UNIX_EPOCH)))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn retry_delay_ms(attempt: u32) -> u64 {
    let seconds = 2_u64.saturating_pow(attempt.min(10)).clamp(5, 900);
    seconds * 1_000
}

fn queue_bounce(cfg: &SharedConfig, path: &Path) -> Result<bool, String> {
    let fingerprint = processing::file_fingerprint(path)?;
    let mut current = cfg.lock().unwrap();
    if current.uploaded_bounces.contains(&fingerprint)
        || current
            .pending_bounces
            .iter()
            .any(|item| item.fingerprint == fingerprint)
    {
        return Ok(false);
    }
    current.pending_bounces.push(PendingBounce {
        path: path.to_string_lossy().into_owned(),
        fingerprint,
        attempt_count: 0,
        next_attempt_at_ms: 0,
        last_error: None,
    });
    config::save(&current)?;
    Ok(true)
}

fn queue_session_info(cfg: &SharedConfig) -> Result<(), String> {
    let mut current = cfg.lock().unwrap();
    current.session_info_pending = true;
    current.session_info_next_attempt_at_ms = 0;
    config::save(&current)
}

fn scan_bounce_dir(cfg: &SharedConfig) {
    let directory = snapshot(cfg).bounce_dir;
    let Some(directory) = directory else { return };
    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if is_audio(&path) {
            let _ = queue_bounce(cfg, &path);
        }
    }
}

async fn drain_session_info(cfg: &SharedConfig, app: &AppHandle) {
    let due = {
        let current = cfg.lock().unwrap();
        current.session_info_pending && current.session_info_next_attempt_at_ms <= now_ms()
    };
    if !due {
        return;
    }
    match processing::sync_session_info(cfg, app).await {
        Ok(_) => {
            let mut current = cfg.lock().unwrap();
            current.session_info_pending = false;
            current.session_info_attempt_count = 0;
            current.session_info_last_error = None;
            let _ = config::save(&current);
        }
        Err(error) => {
            let mut current = cfg.lock().unwrap();
            current.session_info_attempt_count =
                current.session_info_attempt_count.saturating_add(1);
            current.session_info_next_attempt_at_ms =
                now_ms() + retry_delay_ms(current.session_info_attempt_count);
            current.session_info_last_error = Some(error.clone());
            let _ = config::save(&current);
            emit_activity(app, "error", &format!("Session Info i retry-kø: {}", error));
        }
    }
}

async fn drain_one_bounce(cfg: &SharedConfig, app: &AppHandle) {
    let item = {
        let current = cfg.lock().unwrap();
        current
            .pending_bounces
            .iter()
            .find(|item| item.next_attempt_at_ms <= now_ms())
            .cloned()
    };
    let Some(item) = item else { return };
    let path = PathBuf::from(&item.path);
    if !path.exists() {
        let mut current = cfg.lock().unwrap();
        if let Some(pending) = current
            .pending_bounces
            .iter_mut()
            .find(|queued| queued.fingerprint == item.fingerprint)
        {
            pending.attempt_count = pending.attempt_count.saturating_add(1);
            pending.next_attempt_at_ms = now_ms() + retry_delay_ms(pending.attempt_count);
            pending.last_error = Some("Filen er midlertidig utilgjengelig".into());
        }
        let _ = config::save(&current);
        return;
    }
    if !wait_until_stable(&path).await {
        return;
    }
    match processing::upload_bounce(cfg, app, &path).await {
        Ok(_) => {
            let mut current = cfg.lock().unwrap();
            current
                .pending_bounces
                .retain(|queued| queued.fingerprint != item.fingerprint);
            let _ = config::save(&current);
        }
        Err(error) => {
            let mut current = cfg.lock().unwrap();
            if let Some(pending) = current
                .pending_bounces
                .iter_mut()
                .find(|queued| queued.fingerprint == item.fingerprint)
            {
                pending.attempt_count = pending.attempt_count.saturating_add(1);
                pending.next_attempt_at_ms = now_ms() + retry_delay_ms(pending.attempt_count);
                pending.last_error = Some(error.clone());
            }
            let _ = config::save(&current);
            emit_activity(app, "error", &format!("Bounce i retry-kø: {}", error));
        }
    }
}

/// Vent til fila har stabil størrelse (ferdig skrevet). Returnerer false ved timeout/0.
async fn wait_until_stable(path: &Path) -> bool {
    let mut last = match file_meta(path) {
        Some((len, _)) => len,
        None => return false,
    };
    for _ in 0..30 {
        tokio::time::sleep(Duration::from_millis(1000)).await;
        match file_meta(path) {
            Some((len, _)) if len == last && len > 0 => return true,
            Some((len, _)) => last = len,
            None => return false,
        }
    }
    last > 0
}

pub fn start(
    app: AppHandle,
    cfg: SharedConfig,
    watcher_state: SharedWatcher,
) -> Result<(), String> {
    if is_running(&watcher_state) {
        return Ok(());
    }
    let snap = snapshot(&cfg);
    if snap.session_info_path.is_none() && snap.bounce_dir.is_none() {
        return Err("Velg «Session Info»-fil og/eller «Bounced Files»-mappe først".into());
    }

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<notify::Result<notify::Event>>();
    let mut watcher = notify::recommended_watcher(move |res| {
        let _ = tx.send(res);
    })
    .map_err(|e| format!("Kunne ikke starte fil-overvåker: {}", e))?;

    if let Some(info) = &snap.session_info_path {
        if let Some(parent) = Path::new(info).parent() {
            watcher
                .watch(parent, RecursiveMode::NonRecursive)
                .map_err(|e| format!("Overvåk session-mappe: {}", e))?;
        }
    }
    if let Some(bd) = &snap.bounce_dir {
        watcher
            .watch(Path::new(bd), RecursiveMode::NonRecursive)
            .map_err(|e| format!("Overvåk bounce-mappe: {}", e))?;
    }

    // Hold watcheren i live i delt state. Dropp → stopp.
    watcher_state.lock().unwrap().watcher = Some(watcher);

    let info_path = snap.session_info_path.clone();
    let cfg2 = cfg.clone();
    let app2 = app.clone();

    tauri::async_runtime::spawn(async move {
        scan_bounce_dir(&cfg2);
        if info_path
            .as_ref()
            .is_some_and(|path| Path::new(path).exists())
        {
            let _ = queue_session_info(&cfg2);
        }
        let mut interval = tokio::time::interval(Duration::from_secs(10));
        loop {
            tokio::select! {
              _ = interval.tick() => {
                drain_session_info(&cfg2, &app2).await;
                drain_one_bounce(&cfg2, &app2).await;
              }
              received = rx.recv() => {
                let Some(res) = received else { break };
                let event = match res { Ok(e) => e, Err(_) => continue };
                if !matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) { continue; }
                for path in &event.paths {
                  // 1) Session Info-eksport endret → synk markører/metadata.
                  if let Some(ip) = &info_path {
                      if same_session_info(path, ip) {
                          let _ = queue_session_info(&cfg2);
                          continue;
                      }
                  }

                  // 2) Ny/endret bounce → last opp som review-versjon.
                  if is_audio(path) {
                      let _ = queue_bounce(&cfg2, path);
                  }
                }
              }
            }
        }
    });

    emit_activity(&app, "info", "Overvåking startet");
    Ok(())
}

pub fn stop(app: &AppHandle, watcher_state: &SharedWatcher) {
    // Dropp watcheren → kanal lukkes → prosesserings-task avslutter.
    watcher_state.lock().unwrap().watcher = None;
    emit_activity(app, "info", "Overvåking stoppet");
}

pub fn is_running(watcher_state: &SharedWatcher) -> bool {
    watcher_state.lock().unwrap().watcher.is_some()
}

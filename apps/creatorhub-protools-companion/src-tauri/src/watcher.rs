//! Fil-overvåking: notify ser «Session Info»-fila og «Bounced Files»-mappa.
//! Endringer bridges over en tokio-kanal til en async task som pusher til backend.
//!
//! Stopp: når watcheren droppes (watcher_state.watcher = None) lukkes kanalen →
//! prosesserings-tasken avslutter rent.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use notify::{EventKind, RecursiveMode, Watcher};
use tauri::AppHandle;

use crate::processing;
use crate::state::{emit_activity, snapshot, SharedConfig, SharedWatcher};

fn is_audio(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()).as_deref(),
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

pub fn start(app: AppHandle, cfg: SharedConfig, watcher_state: SharedWatcher) -> Result<(), String> {
    let snap = snapshot(&cfg);
    if snap.session_info_path.is_none() && snap.bounce_dir.is_none() && snap.voice_notes_dir.is_none() {
        return Err("Velg «Session Info»-fil og/eller «Bounced Files»-/«Voice Notes»-mappe først".into());
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
    // Voice-notes-mappa overvåkes separat, med mindre den er nøyaktig samme mappe
    // som bounce-mappa (notify feiler på å watch()e samme path to ganger).
    if let Some(vd) = &snap.voice_notes_dir {
        if snap.bounce_dir.as_deref() != Some(vd.as_str()) {
            watcher
                .watch(Path::new(vd), RecursiveMode::NonRecursive)
                .map_err(|e| format!("Overvåk voice-notes-mappe: {}", e))?;
        }
    }

    // Hold watcheren i live i delt state. Dropp → stopp.
    watcher_state.lock().unwrap().watcher = Some(watcher);

    let info_path = snap.session_info_path.clone();
    // Voice-notes-mappa er en EGEN, distinkt mappe fra bounce-mappa (satt opp separat
    // i sesjonsoppsettet) — filer her blir ALDRI review-versjoner, kun tidskodede
    // kommentarer. Skiller fra bounce_dir på path, ikke innhold, så en produsent som
    // (feilaktig) peker begge til samme mappe fortsatt får ett, forutsigbart utfall
    // (bounce vinner — sjekket først under).
    let voice_notes_dir = snap.voice_notes_dir.clone();
    let cfg2 = cfg.clone();
    let app2 = app.clone();

    tauri::async_runtime::spawn(async move {
        // (path → (size, mtime)) for å unngå å laste opp samme uendrede fil flere ganger.
        // Egne kart for bounces vs. voice notes — et dedup-treff i den ene skal ikke
        // hindre en fil med samme navn i den andre mappa fra å bli behandlet.
        let mut seen_bounces: HashMap<PathBuf, (u64, SystemTime)> = HashMap::new();
        let mut seen_voice_notes: HashMap<PathBuf, (u64, SystemTime)> = HashMap::new();

        while let Some(res) = rx.recv().await {
            let event = match res {
                Ok(e) => e,
                Err(_) => continue,
            };
            // Bare reager på opprett/endre.
            let interesting = matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_));
            if !interesting {
                continue;
            }

            for path in &event.paths {
                // 1) Session Info-eksport endret → synk markører/metadata.
                if let Some(ip) = &info_path {
                    if same_session_info(path, ip) {
                        tokio::time::sleep(Duration::from_millis(800)).await;
                        if let Err(e) = processing::sync_session_info(&cfg2, &app2).await {
                            emit_activity(&app2, "error", &format!("Synk feilet: {}", e));
                        }
                        continue;
                    }
                }

                let in_voice_notes_dir = voice_notes_dir
                    .as_deref()
                    .map(|vd| path.parent() == Some(Path::new(vd)))
                    .unwrap_or(false);

                // 2) Ny/endret lyd i voice-notes-mappa → tidskodet kommentar (ikke versjon).
                if in_voice_notes_dir && is_audio(path) {
                    let meta = match file_meta(path) {
                        Some(m) => m,
                        None => continue,
                    };
                    if seen_voice_notes.get(path) == Some(&meta) {
                        continue;
                    }
                    if wait_until_stable(path).await {
                        let final_meta = file_meta(path).unwrap_or(meta);
                        seen_voice_notes.insert(path.clone(), final_meta);
                        if let Err(e) = processing::upload_voice_note(&cfg2, &app2, path).await {
                            emit_activity(&app2, "error", &format!("Lydnotat-opplasting feilet: {}", e));
                        }
                    }
                    continue;
                }

                // 3) Ny/endret bounce → last opp som review-versjon.
                if is_audio(path) {
                    let meta = match file_meta(path) {
                        Some(m) => m,
                        None => continue,
                    };
                    if seen_bounces.get(path) == Some(&meta) {
                        continue; // allerede håndtert, uendret
                    }
                    if wait_until_stable(path).await {
                        // Re-stat etter stabilisering (mtime kan ha endret seg).
                        let final_meta = file_meta(path).unwrap_or(meta);
                        seen_bounces.insert(path.clone(), final_meta);
                        if let Err(e) = processing::upload_bounce(&cfg2, &app2, path).await {
                            emit_activity(&app2, "error", &format!("Opplasting feilet: {}", e));
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

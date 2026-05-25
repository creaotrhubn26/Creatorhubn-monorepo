//! Continuous folder watcher.
//!
//! Watches user-chosen folders for new video/audio files (typical use:
//! a shared event folder where cards get dumped throughout the day).
//! Emits `folder-clips-added` with the new file paths so the frontend
//! can auto-trigger import + cull pipelines.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

const VIDEO_AUDIO_EXTS: &[&str] = &[
    "mov", "mp4", "m4v", "mxf", "avi", "mkv", "braw", "r3d",
    "wav", "aif", "aiff", "mp3", "flac", "m4a",
];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatchedFolder {
    pub path: String,
    pub started_at: String,
    pub seen_count: usize,
}

#[derive(Default)]
pub struct FolderWatcherState {
    /// path → set of files we've already announced (so we don't double-emit)
    pub seen: Mutex<HashMap<String, HashSet<String>>>,
    /// path → metadata for active watchers
    pub watched: Mutex<HashMap<String, WatchedFolder>>,
    /// path → Boxed watcher handle (kept alive)
    pub handles: Mutex<HashMap<String, Box<dyn Watcher + Send>>>,
}

fn is_video_or_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|s| VIDEO_AUDIO_EXTS.contains(&s.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn scan_existing(folder: &Path) -> HashSet<String> {
    let mut set = HashSet::new();
    if let Ok(entries) = std::fs::read_dir(folder) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() && is_video_or_audio(&p) {
                set.insert(p.display().to_string());
            }
            if p.is_dir() {
                // One-level deep (typical card layout — DCIM/100CANON etc.)
                if let Ok(sub_entries) = std::fs::read_dir(&p) {
                    for sub in sub_entries.flatten() {
                        let sp = sub.path();
                        if sp.is_file() && is_video_or_audio(&sp) {
                            set.insert(sp.display().to_string());
                        }
                    }
                }
            }
        }
    }
    set
}

pub fn start_watching(app: AppHandle, state: &FolderWatcherState, folder_path: String) -> Result<(), String> {
    let folder = PathBuf::from(&folder_path);
    if !folder.is_dir() {
        return Err(format!("{} is not a directory", folder.display()));
    }

    // Seed with existing files so we don't announce them as "new"
    let initial = scan_existing(&folder);
    {
        let mut seen = state.seen.lock().map_err(|e| e.to_string())?;
        seen.insert(folder_path.clone(), initial.clone());
    }

    let app_for_watcher = app.clone();
    let folder_path_for_watcher = folder_path.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        let Ok(event) = res else { return };
        if !matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
            return;
        }
        // Settle window — copies often arrive in chunks
        std::thread::sleep(Duration::from_millis(500));

        let new_files: Vec<String> = event
            .paths
            .iter()
            .filter(|p| p.is_file() && is_video_or_audio(p))
            .map(|p| p.display().to_string())
            .collect();

        if new_files.is_empty() {
            return;
        }

        // Dedupe against seen state
        let state: tauri::State<FolderWatcherState> = match app_for_watcher.try_state() {
            Some(s) => s,
            None => return,
        };
        let mut seen_map = match state.seen.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        let seen_for_folder = seen_map.entry(folder_path_for_watcher.clone()).or_default();
        let truly_new: Vec<String> = new_files
            .into_iter()
            .filter(|f| !seen_for_folder.contains(f))
            .collect();
        for f in &truly_new {
            seen_for_folder.insert(f.clone());
        }
        let total_seen = seen_for_folder.len();
        drop(seen_map);

        if truly_new.is_empty() {
            return;
        }

        // Update count on the watched folder
        if let Ok(mut watched) = state.watched.lock() {
            if let Some(entry) = watched.get_mut(&folder_path_for_watcher) {
                entry.seen_count = total_seen;
            }
        }

        let _ = app_for_watcher.emit(
            "folder-clips-added",
            serde_json::json!({
                "folder": folder_path_for_watcher,
                "newClips": truly_new,
                "totalSeen": total_seen,
            }),
        );
    })
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(&folder, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch {}: {}", folder.display(), e))?;

    let now = chrono::Utc::now().to_rfc3339();
    {
        let mut watched = state.watched.lock().map_err(|e| e.to_string())?;
        watched.insert(
            folder_path.clone(),
            WatchedFolder {
                path: folder_path.clone(),
                started_at: now,
                seen_count: initial.len(),
            },
        );
    }
    {
        let mut handles = state.handles.lock().map_err(|e| e.to_string())?;
        handles.insert(folder_path.clone(), Box::new(watcher));
    }

    // Notify frontend that the watch started
    let _ = app.emit(
        "folder-watch-started",
        serde_json::json!({
            "folder": folder_path,
            "initialClipsIgnored": initial.len(),
        }),
    );

    Ok(())
}

pub fn stop_watching(app: AppHandle, state: &FolderWatcherState, folder_path: &str) -> Result<(), String> {
    state
        .handles
        .lock()
        .map_err(|e| e.to_string())?
        .remove(folder_path);
    state
        .watched
        .lock()
        .map_err(|e| e.to_string())?
        .remove(folder_path);
    state
        .seen
        .lock()
        .map_err(|e| e.to_string())?
        .remove(folder_path);
    let _ = app.emit(
        "folder-watch-stopped",
        serde_json::json!({ "folder": folder_path }),
    );
    Ok(())
}

pub fn list_watched(state: &FolderWatcherState) -> Vec<WatchedFolder> {
    state
        .watched
        .lock()
        .map(|m| m.values().cloned().collect())
        .unwrap_or_default()
}

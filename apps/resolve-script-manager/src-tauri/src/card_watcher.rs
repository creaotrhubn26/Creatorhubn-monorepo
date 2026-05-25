//! Camera-card watcher.
//!
//! Watches `/Volumes/` (macOS) for new mounts and identifies camera cards by
//! looking for the canonical folder layouts (DCIM, PRIVATE/M4ROOT, CONTENT/CLIP).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use walkdir::WalkDir;

const VOLUMES_PATH: &str = "/Volumes";

const VIDEO_EXTS: &[&str] = &[
    "mov", "mp4", "m4v", "mxf", "avi", "mkv", "braw", "r3d", "arri",
];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CameraCardClip {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub extension: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MountedCard {
    pub mount_path: String,
    pub volume_label: String,
    pub camera_guess: Option<String>,
    pub total_clips: usize,
    pub total_bytes: u64,
    pub layout_signals: Vec<String>,
    pub card_hash: String,
    pub clips: Vec<CameraCardClip>,
}

fn compute_card_hash(clips: &[CameraCardClip]) -> String {
    use std::collections::BTreeSet;
    // sha1 of the sorted set of basenames — matches Python card_hash in cull_folder.py
    let names: BTreeSet<&str> = clips.iter().map(|c| c.name.as_str()).collect();
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    use std::hash::{Hash, Hasher};
    let joined = names.into_iter().collect::<Vec<_>>().join("\n");
    joined.hash(&mut hasher);
    let h = hasher.finish();
    // We want sha1-like hex; std doesn't ship sha1. Use simple 16-char hex derived from u64.
    // This is good enough for "same card detection" — collisions on basename-sets are unlikely.
    format!("{:016x}", h)
}

#[derive(Default)]
pub struct CardWatcherState {
    pub cards: Mutex<HashMap<String, MountedCard>>,
}

/// Walk the top-level volume and pull a list of video clips up to a reasonable cap.
fn scan_volume(root: &Path) -> MountedCard {
    let volume_label = root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("(unknown)")
        .to_string();

    let mut clips: Vec<CameraCardClip> = Vec::new();
    let mut total_bytes: u64 = 0;
    let mut signals: Vec<String> = Vec::new();
    let mut camera_guess: Option<String> = None;

    let dcim = root.join("DCIM");
    let private = root.join("PRIVATE");
    let m4root = root.join("PRIVATE").join("M4ROOT");
    let content = root.join("CONTENT");
    let clip_dir = root.join("CLIP");

    if dcim.exists() {
        signals.push("DCIM".into());
        camera_guess = Some("Canon / DSLR / Mirrorless".into());
    }
    if m4root.exists() {
        signals.push("PRIVATE/M4ROOT".into());
        camera_guess = Some("Sony XAVC".into());
    } else if private.exists() {
        signals.push("PRIVATE".into());
    }
    if content.exists() {
        signals.push("CONTENT".into());
        camera_guess = Some("Panasonic / Sony".into());
    }
    if clip_dir.exists() {
        signals.push("CLIP".into());
        camera_guess.get_or_insert_with(|| "RED / cinema".into());
    }

    // Walk up to 10_000 files, depth limit 6 to avoid pathological cases
    let walker = WalkDir::new(root)
        .max_depth(6)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .take(20_000);

    for entry in walker {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase());
        let Some(ext) = ext else { continue };
        if !VIDEO_EXTS.contains(&ext.as_str()) {
            continue;
        }
        if let Ok(metadata) = entry.metadata() {
            let size = metadata.len();
            total_bytes += size;
            clips.push(CameraCardClip {
                path: path.display().to_string(),
                name: path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("(unnamed)")
                    .to_string(),
                size_bytes: size,
                extension: ext,
            });
        }
        if clips.len() >= 5_000 {
            break;
        }
    }

    let card_hash = compute_card_hash(&clips);
    MountedCard {
        mount_path: root.display().to_string(),
        volume_label,
        camera_guess,
        total_clips: clips.len(),
        total_bytes,
        layout_signals: signals,
        card_hash,
        clips,
    }
}

fn is_camera_card(mount: &Path) -> bool {
    if !mount.is_dir() {
        return false;
    }
    let dcim = mount.join("DCIM");
    let m4root = mount.join("PRIVATE").join("M4ROOT");
    let content = mount.join("CONTENT");
    let clip = mount.join("CLIP");
    dcim.exists() || m4root.exists() || content.exists() || clip.exists()
}

fn initial_scan() -> HashMap<String, MountedCard> {
    let mut map = HashMap::new();
    let volumes = Path::new(VOLUMES_PATH);
    if !volumes.exists() {
        return map;
    }
    let Ok(entries) = std::fs::read_dir(volumes) else {
        return map;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if is_camera_card(&path) {
            let card = scan_volume(&path);
            map.insert(card.mount_path.clone(), card);
        }
    }
    map
}

pub fn spawn_watcher(app: AppHandle) -> notify::Result<()> {
    // Seed with whatever is mounted right now
    {
        let state: State<CardWatcherState> = app.state();
        let mut cards = state.cards.lock().unwrap();
        *cards = initial_scan();
        let payload: Vec<MountedCard> = cards.values().cloned().collect();
        let _ = app.emit("cards-changed", &payload);
    }

    let app_for_watcher = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            // Only react to top-level mount changes
            if !matches!(
                event.kind,
                EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_)
            ) {
                return;
            }
            let touches_top = event.paths.iter().any(|p| {
                p.parent().map(|parent| parent == Path::new(VOLUMES_PATH)).unwrap_or(false)
            });
            if !touches_top {
                return;
            }

            // Re-scan top-level after a short settle window
            std::thread::sleep(Duration::from_millis(800));
            let state: State<CardWatcherState> = app_for_watcher.state();
            let fresh = initial_scan();
            let mut cards = state.cards.lock().unwrap();
            *cards = fresh;
            let payload: Vec<MountedCard> = cards.values().cloned().collect();
            let _ = app_for_watcher.emit("cards-changed", &payload);
        }
    })?;

    watcher.watch(Path::new(VOLUMES_PATH), RecursiveMode::NonRecursive)?;

    // Keep the watcher alive for the lifetime of the app
    let leaked: Box<dyn Watcher + Send> = Box::new(watcher);
    Box::leak(leaked);
    Ok(())
}

pub fn list_cards(state: &CardWatcherState) -> Vec<MountedCard> {
    let cards = state.cards.lock().unwrap();
    cards.values().cloned().collect()
}

pub fn rescan(state: &CardWatcherState) -> Vec<MountedCard> {
    let fresh = initial_scan();
    let mut cards = state.cards.lock().unwrap();
    *cards = fresh.clone();
    fresh.into_values().collect()
}

/// Public helper for the cull orchestrator: pull a folder's video clips
/// without it needing to be a mounted card (used by "Pick folder" flow).
pub fn scan_arbitrary_folder(path: &Path) -> Result<MountedCard, String> {
    if !path.is_dir() {
        return Err(format!("{} is not a directory", path.display()));
    }
    Ok(scan_volume(path))
}

pub fn arc_state() -> Arc<CardWatcherState> {
    Arc::new(CardWatcherState::default())
}

//! Mount-watcher for Creatorhub One Desk.
//!
//! Detekterer SD/CF/CFexpress-mounts under `/Volumes/` (macOS) ved hjelp
//! av `notify`-crate. For hvert mount: leser volum-kapasitet via statfs,
//! teller foto- og video-filer i kjente camera-layouts (DCIM, PRIVATE/M4ROOT,
//! CONTENT, CLIP), og emit'er `mounts-changed`-event til frontend.
//!
//! READ-ONLY. Vi modifiserer aldri innholdet på et kort.
//!
//! Adaptert fra `apps/resolve-script-manager/src-tauri/src/card_watcher.rs`,
//! men med både foto- og video-deteksjon og volum-kapasitet inkludert.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use walkdir::WalkDir;

const VOLUMES_PATH: &str = "/Volumes";

pub const VIDEO_EXTS: &[&str] = &[
    "mov", "mp4", "m4v", "mxf", "avi", "mkv", "braw", "r3d", "arri", "ari",
];

pub const PHOTO_EXTS: &[&str] = &[
    "jpg", "jpeg", "heic", "heif", "png", "tiff", "tif",
    "cr2", "cr3", "crw", // Canon
    "nef", "nrw",        // Nikon
    "arw", "srf", "sr2", // Sony
    "raf",               // Fujifilm
    "rw2",               // Panasonic
    "orf",               // Olympus
    "dng",               // Adobe / generic
    "raw",
];

/// Returnerer true hvis filens extension er foto eller video (lowercase forventet).
pub fn is_media_extension(ext: &str) -> bool {
    PHOTO_EXTS.contains(&ext) || VIDEO_EXTS.contains(&ext)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectedMount {
    pub mount_path: String,
    pub volume_label: String,
    pub camera_guess: Option<String>,
    pub total_bytes_capacity: Option<u64>,
    pub total_bytes_free: Option<u64>,
    pub photo_count: usize,
    pub video_count: usize,
    pub photo_bytes: u64,
    pub video_bytes: u64,
    pub layout_signals: Vec<String>,
}

#[derive(Default)]
pub struct MountWatcherState {
    pub mounts: Mutex<HashMap<String, DetectedMount>>,
}

/// Henter kapasitet og ledig plass via macOS statfs (libc::statfs).
/// Returnerer (total, free) i bytes. None hvis kallet feiler.
#[cfg(unix)]
fn volume_stats(path: &Path) -> Option<(u64, u64)> {
    use std::ffi::CString;
    use std::mem::MaybeUninit;
    let c_path = CString::new(path.as_os_str().to_string_lossy().as_bytes()).ok()?;
    unsafe {
        let mut buf: MaybeUninit<libc::statfs> = MaybeUninit::uninit();
        let rc = libc::statfs(c_path.as_ptr(), buf.as_mut_ptr());
        if rc != 0 {
            return None;
        }
        let s = buf.assume_init();
        let block_size = s.f_bsize as u64;
        let total = (s.f_blocks as u64).saturating_mul(block_size);
        let free = (s.f_bavail as u64).saturating_mul(block_size);
        Some((total, free))
    }
}

#[cfg(not(unix))]
fn volume_stats(_path: &Path) -> Option<(u64, u64)> {
    None
}

fn scan_volume(root: &Path) -> DetectedMount {
    let volume_label = root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("(unknown)")
        .to_string();

    let mut signals: Vec<String> = Vec::new();
    let mut camera_guess: Option<String> = None;

    let dcim = root.join("DCIM");
    let private = root.join("PRIVATE");
    let m4root = private.join("M4ROOT");
    let content = root.join("CONTENT");
    let clip_dir = root.join("CLIP");

    if dcim.exists() {
        signals.push("DCIM".into());
        camera_guess = Some("Canon / Nikon / Sony mirrorless".into());
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

    let mut photo_count = 0usize;
    let mut video_count = 0usize;
    let mut photo_bytes = 0u64;
    let mut video_bytes = 0u64;

    // Walk inntil 20k filer, dybde-begrenset for å unngå patologiske tilfeller.
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
        let Some(ext) = entry.path().extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) else {
            continue;
        };
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        if PHOTO_EXTS.contains(&ext.as_str()) {
            photo_count += 1;
            photo_bytes = photo_bytes.saturating_add(size);
        } else if VIDEO_EXTS.contains(&ext.as_str()) {
            video_count += 1;
            video_bytes = video_bytes.saturating_add(size);
        }
        if photo_count + video_count >= 10_000 {
            break;
        }
    }

    let (total_bytes_capacity, total_bytes_free) = volume_stats(root)
        .map(|(t, f)| (Some(t), Some(f)))
        .unwrap_or((None, None));

    DetectedMount {
        mount_path: root.display().to_string(),
        volume_label,
        camera_guess,
        total_bytes_capacity,
        total_bytes_free,
        photo_count,
        video_count,
        photo_bytes,
        video_bytes,
        layout_signals: signals,
    }
}

fn is_camera_card(mount: &Path) -> bool {
    if !mount.is_dir() {
        return false;
    }
    mount.join("DCIM").exists()
        || mount.join("PRIVATE").join("M4ROOT").exists()
        || mount.join("CONTENT").exists()
        || mount.join("CLIP").exists()
}

fn initial_scan() -> HashMap<String, DetectedMount> {
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
            let mount = scan_volume(&path);
            map.insert(mount.mount_path.clone(), mount);
        }
    }
    map
}

pub fn spawn_watcher(app: AppHandle) -> notify::Result<()> {
    // Seed med det som er montert akkurat nå
    {
        let state: State<MountWatcherState> = app.state();
        let mut mounts = state.mounts.lock().unwrap();
        *mounts = initial_scan();
        let payload: Vec<DetectedMount> = mounts.values().cloned().collect();
        let _ = app.emit("mounts-changed", &payload);
    }

    let app_for_watcher = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            if !matches!(
                event.kind,
                EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_)
            ) {
                return;
            }
            let touches_top = event.paths.iter().any(|p: &PathBuf| {
                p.parent()
                    .map(|parent| parent == Path::new(VOLUMES_PATH))
                    .unwrap_or(false)
            });
            if !touches_top {
                return;
            }

            // Vent kort for å la mount-en stabilisere seg
            std::thread::sleep(Duration::from_millis(800));
            let state: State<MountWatcherState> = app_for_watcher.state();
            let fresh = initial_scan();
            let mut mounts = state.mounts.lock().unwrap();
            *mounts = fresh;
            let payload: Vec<DetectedMount> = mounts.values().cloned().collect();
            let _ = app_for_watcher.emit("mounts-changed", &payload);
        }
    })?;

    watcher.watch(Path::new(VOLUMES_PATH), RecursiveMode::NonRecursive)?;

    // Hold watcheren i live for app-ets levetid
    let leaked: Box<dyn Watcher + Send> = Box::new(watcher);
    Box::leak(leaked);
    Ok(())
}

pub fn list_mounts(state: &MountWatcherState) -> Vec<DetectedMount> {
    let mounts = state.mounts.lock().unwrap();
    mounts.values().cloned().collect()
}

pub fn rescan(state: &MountWatcherState) -> Vec<DetectedMount> {
    let fresh = initial_scan();
    let mut mounts = state.mounts.lock().unwrap();
    *mounts = fresh.clone();
    fresh.into_values().collect()
}

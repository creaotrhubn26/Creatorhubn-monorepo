//! Capture-kilder for Demo Studio: web (håndteres i frontend), Mac-skjerm,
//! kablede iOS-enheter (AVFoundation) og iOS-simulatorer (simctl).
//!
//! - list_capture_sources: oppdager hva som er tilgjengelig akkurat nå.
//! - record_avfoundation: tar opp fra en AVFoundation video-device-indeks
//!   (Mac-skjerm ELLER kablet iPhone/iPad) til mp4.
//! - record_simulator: tar opp en bootet iOS-simulator via `xcrun simctl`.
//!
//! Viktig (App Store-apper): en app fra App Store kan installeres på en EKTE
//! enhet og tas opp via AVFoundation (kablet). Den kan IKKE kjøre i
//! simulatoren — simulatoren er kun for apper du selv bygger i Xcode.

use std::path::PathBuf;
use std::process::Command;

use serde::Serialize;
use tauri::{AppHandle, Manager};

const FFMPEG_FALLBACK: &[&str] = &[
    "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/local/bin/ffmpeg", "/usr/bin/ffmpeg",
];

fn find_ffmpeg() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("RESOLVE_SCRIPT_MANAGER_FFMPEG") {
        let pb = PathBuf::from(&p);
        if pb.is_file() { return Some(pb); }
    }
    if let Ok(o) = Command::new("which").arg("ffmpeg").output() {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !s.is_empty() && PathBuf::from(&s).is_file() { return Some(PathBuf::from(s)); }
        }
    }
    FFMPEG_FALLBACK.iter().map(PathBuf::from).find(|p| p.is_file())
}

#[derive(Serialize)]
pub struct CaptureSource {
    /// 'mac_screen' | 'ios_device' | 'ios_simulator'
    pub kind: String,
    /// Stabil id: avfoundation-indeks (tall) eller simulator-UDID.
    pub id: String,
    pub label: String,
    /// Hint til UI om hvordan kilden tas opp.
    pub available: bool,
}

/// Parse `ffmpeg -f avfoundation -list_devices`. iOS-enheter dukker opp i
/// video-listen når de er kablet + "Stol på denne maskinen" er bekreftet.
/// Heuristikk: enhet som IKKE er kamera/skjerm antas å være en iOS-enhet.
fn list_avfoundation(ffmpeg: &PathBuf) -> Vec<CaptureSource> {
    let out = Command::new(ffmpeg)
        .args(["-f", "avfoundation", "-list_devices", "true", "-i", ""])
        .output();
    let Ok(out) = out else { return vec![] };
    // ffmpeg skriver enhetslista til stderr.
    let text = String::from_utf8_lossy(&out.stderr);
    let mut sources = vec![];
    let mut in_video = false;
    for line in text.lines() {
        if line.contains("AVFoundation video devices") { in_video = true; continue; }
        if line.contains("AVFoundation audio devices") { in_video = false; continue; }
        if !in_video { continue; }
        // Format: "[AVFoundation indev @ 0x..] [0] MacBook Pro Camera"
        if let Some(idx_start) = line.rfind("] [") {
            let rest = &line[idx_start + 3..];
            if let Some(close) = rest.find(']') {
                let index = rest[..close].trim().to_string();
                let name = rest[close + 1..].trim().to_string();
                if index.parse::<u32>().is_err() { continue; }
                let lower = name.to_lowercase();
                let is_screen = lower.contains("capture screen");
                let is_camera = lower.contains("camera") || lower.contains("desk view");
                let kind = if is_screen { "mac_screen" } else if is_camera { continue } else { "ios_device" };
                sources.push(CaptureSource {
                    kind: kind.to_string(),
                    id: index,
                    label: name,
                    available: true,
                });
            }
        }
    }
    sources
}

/// Parse `xcrun simctl list devices booted` → bootede simulatorer.
fn list_simulators() -> Vec<CaptureSource> {
    let out = Command::new("xcrun").args(["simctl", "list", "devices", "booted"]).output();
    let Ok(out) = out else { return vec![] };
    if !out.status.success() { return vec![]; }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut sources = vec![];
    for line in text.lines() {
        // "    iPhone 15 (UDID) (Booted)"
        if !line.contains("(Booted)") { continue; }
        if let (Some(open), Some(close)) = (line.find('('), line.find(')')) {
            let udid = line[open + 1..close].trim().to_string();
            let name = line[..open].trim().to_string();
            if udid.len() >= 8 {
                sources.push(CaptureSource { kind: "ios_simulator".into(), id: udid, label: name, available: true });
            }
        }
    }
    sources
}

/// List alle tilgjengelige capture-kilder akkurat nå.
#[tauri::command]
pub async fn list_capture_sources() -> Result<Vec<CaptureSource>, String> {
    let mut out = vec![];
    if let Some(ff) = find_ffmpeg() {
        out.extend(list_avfoundation(&ff));
    }
    out.extend(list_simulators());
    Ok(out)
}

fn recordings_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    let safe: String = project_id.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?
        .join("demo-recordings").join(safe);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Ta opp fra en AVFoundation video-device-indeks (Mac-skjerm eller kablet
/// iOS-enhet) i `duration_sec` sekunder → mp4. Returnerer sti.
#[tauri::command]
pub async fn record_avfoundation(
    app: AppHandle,
    project_id: String,
    scene_id: String,
    device_index: String,
    duration_sec: u32,
) -> Result<String, String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg ikke funnet")?;
    let dir = recordings_dir(&app, &project_id)?;
    let safe_scene: String = scene_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    let out_path = dir.join(format!("{}.mp4", safe_scene));
    // -i "<videoindex>:none" → kun video. 30fps, H.264.
    let status = Command::new(&ffmpeg)
        .args([
            "-y", "-f", "avfoundation", "-framerate", "30",
            "-t", &duration_sec.to_string(),
            "-i", &format!("{}:none", device_index),
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            &out_path.to_string_lossy(),
        ])
        .status()
        .map_err(|e| format!("spawn ffmpeg: {}", e))?;
    if !status.success() {
        return Err("avfoundation-opptak feilet (er enheten kablet + trusted?)".into());
    }
    Ok(out_path.to_string_lossy().to_string())
}

/// Ta opp en bootet iOS-simulator via `xcrun simctl io <udid> recordVideo`.
/// Returnerer sti. (Stoppes ved at frontend dreper prosessen — her tar vi en
/// fast varighet med timeout for enkelhet.)
#[tauri::command]
pub async fn record_simulator(
    app: AppHandle,
    project_id: String,
    scene_id: String,
    udid: String,
    duration_sec: u32,
) -> Result<String, String> {
    let dir = recordings_dir(&app, &project_id)?;
    let safe_scene: String = scene_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    let out_path = dir.join(format!("{}.mov", safe_scene));
    // simctl recordVideo kjører til den får SIGINT. Vi bruker `timeout` for å
    // stoppe etter duration_sec (sender SIGINT som simctl flusher på).
    let status = Command::new("/usr/bin/timeout")
        .args([
            "-s", "INT", &duration_sec.to_string(),
            "xcrun", "simctl", "io", &udid, "recordVideo", "--force",
            &out_path.to_string_lossy(),
        ])
        .status();
    match status {
        Ok(s) if s.success() || out_path.is_file() => Ok(out_path.to_string_lossy().to_string()),
        _ => Err("simulator-opptak feilet (krever full Xcode + bootet simulator)".into()),
    }
}

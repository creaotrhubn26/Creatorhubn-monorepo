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

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

const FFMPEG_FALLBACK: &[&str] = &[
    "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/local/bin/ffmpeg", "/usr/bin/ffmpeg",
];

pub(crate) fn find_ffmpeg() -> Option<PathBuf> {
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

const IPHONE_MIRRORING_BUNDLE: &str = "com.apple.ScreenContinuity";
const IPHONE_MIRRORING_PATH: &str = "/System/Applications/iPhone Mirroring.app";

/// Er en app med gitt bundle-id i gang? (via lsappinfo)
fn is_running(bundle_id: &str) -> bool {
    Command::new("/usr/bin/lsappinfo")
        .args(["find", &format!("bundleID={}", bundle_id)])
        .output()
        .map(|o| !String::from_utf8_lossy(&o.stdout).trim().is_empty())
        .unwrap_or(false)
}

/// iPhone Mirroring-kilde hvis appen finnes (macOS 15+). Trådløs Continuity-
/// speiling; vi tar opp selve vinduet via skjerm-capture. 'available' = appen
/// kjører allerede (klar til å fanges).
fn iphone_mirroring_source() -> Option<CaptureSource> {
    if !std::path::Path::new(IPHONE_MIRRORING_PATH).exists() { return None; }
    Some(CaptureSource {
        kind: "iphone_mirroring".into(),
        id: IPHONE_MIRRORING_BUNDLE.into(),
        label: "iPhone Mirroring (trådløst)".into(),
        available: is_running(IPHONE_MIRRORING_BUNDLE),
    })
}

/// Åpne Apples iPhone Mirroring-app (trådløs speiling, ingen kabel).
#[tauri::command]
pub async fn open_iphone_mirroring() -> Result<bool, String> {
    if !std::path::Path::new(IPHONE_MIRRORING_PATH).exists() {
        return Err("iPhone Mirroring krever macOS 15 (Sequoia) eller nyere".into());
    }
    Command::new("/usr/bin/open").arg("-a").arg(IPHONE_MIRRORING_PATH)
        .status().map_err(|e| format!("open feilet: {}", e))?;
    Ok(true)
}

/// List alle tilgjengelige capture-kilder akkurat nå.
#[tauri::command]
pub async fn list_capture_sources() -> Result<Vec<CaptureSource>, String> {
    let mut out = vec![];
    if let Some(ff) = find_ffmpeg() {
        out.extend(list_avfoundation(&ff));
    }
    out.extend(list_simulators());
    if let Some(m) = iphone_mirroring_source() { out.push(m); }
    Ok(out)
}

pub(crate) fn recordings_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
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
    let raw_path = dir.join(format!("{}._sim.mov", safe_scene));
    // simctl recordVideo kjører til den får SIGINT. Vi bruker `timeout` for å
    // stoppe etter duration_sec (sender SIGINT som simctl flusher på).
    let status = Command::new("/usr/bin/timeout")
        .args([
            "-s", "INT", &duration_sec.to_string(),
            "xcrun", "simctl", "io", &udid, "recordVideo", "--force",
            &raw_path.to_string_lossy(),
        ])
        .status();
    match status {
        Ok(s) if s.success() || raw_path.is_file() => {}
        _ => return Err("simulator-opptak feilet (krever full Xcode + bootet simulator)".into()),
    }
    // Normaliser til H.264 MP4 (simctl gir HEVC .mov) så pipelinen får konsistent input.
    let out_path = dir.join(format!("{}.mp4", safe_scene));
    if let Some(ffmpeg) = find_ffmpeg() {
        let ok = Command::new(&ffmpeg)
            .args(["-y", "-i", &raw_path.to_string_lossy(),
                "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", &out_path.to_string_lossy()])
            .status().map(|s| s.success()).unwrap_or(false);
        let _ = std::fs::remove_file(&raw_path);
        if ok && out_path.is_file() { return Ok(out_path.to_string_lossy().to_string()); }
    }
    // Fallback: behold rå .mov hvis transcoding ikke gikk.
    Ok(raw_path.to_string_lossy().to_string())
}

// ── iOS-simulator-styring (live-preview, launch, deep-link, autonom drift) ────
// Post Agent kan ikke bare TA OPP en simulator — den kan DRIVE den. simctl gir
// boot/launch/openurl/screenshot uten noen ekstra avhengighet. For autonom
// gjennomgang trenger vi å FORSTÅ skjermen (accessibility-treet) og TRYKKE:
// det gjør `idb` (Facebooks iOS Development Bridge). idb er valgfritt — Phase-1-
// funksjonene (preview/launch/deep-link) virker uten den.

/// Finn `idb`-CLI: env-override, PATH, deretter vanlige installasjonsstier.
fn find_idb() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("POST_AGENT_IDB") {
        let pb = PathBuf::from(&p);
        if pb.is_file() { return Some(pb); }
    }
    if let Ok(o) = Command::new("/usr/bin/which").arg("idb").output() {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !s.is_empty() && PathBuf::from(&s).is_file() { return Some(PathBuf::from(s)); }
        }
    }
    for cand in ["/opt/homebrew/bin/idb", "/usr/local/bin/idb"] {
        let pb = PathBuf::from(cand);
        if pb.is_file() { return Some(pb); }
    }
    if let Ok(home) = std::env::var("HOME") {
        let pb = PathBuf::from(home).join(".local/bin/idb");
        if pb.is_file() { return Some(pb); }
    }
    None
}

/// Boot en simulator (idempotent) og bring Simulator.app til front så
/// live-preview + opptak har et synlig vindu.
#[tauri::command]
pub async fn ios_sim_boot(udid: String) -> Result<bool, String> {
    // "Unable to boot ... current state: Booted" er ikke en ekte feil.
    let out = Command::new("xcrun").args(["simctl", "boot", &udid]).output()
        .map_err(|e| format!("simctl boot: {}", e))?;
    let stderr = String::from_utf8_lossy(&out.stderr);
    if !out.status.success() && !stderr.contains("Booted") && !stderr.contains("current state") {
        return Err(format!("kunne ikke boote simulator: {}", stderr.trim()));
    }
    let _ = Command::new("/usr/bin/open").args(["-a", "Simulator"]).status();
    Ok(true)
}

/// Launch en app i simulatoren via bundle-id. Returnerer PID (0 hvis ukjent).
#[tauri::command]
pub async fn ios_sim_launch(udid: String, bundle_id: String) -> Result<u32, String> {
    let out = Command::new("xcrun").args(["simctl", "launch", &udid, &bundle_id]).output()
        .map_err(|e| format!("simctl launch: {}", e))?;
    if !out.status.success() {
        return Err(format!("launch feilet: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    // stdout: "com.foo.bar: 12345"
    let s = String::from_utf8_lossy(&out.stdout);
    let pid = s.rsplit(':').next().and_then(|p| p.trim().parse::<u32>().ok()).unwrap_or(0);
    Ok(pid)
}

/// Åpne en deep-link (URL-scheme eller universal link) i simulatoren — driver
/// appen rett til en bestemt skjerm for en scene.
#[tauri::command]
pub async fn ios_sim_openurl(udid: String, url: String) -> Result<bool, String> {
    let out = Command::new("xcrun").args(["simctl", "openurl", &udid, &url]).output()
        .map_err(|e| format!("simctl openurl: {}", e))?;
    if !out.status.success() {
        return Err(format!("openurl feilet: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(true)
}

#[derive(Serialize)]
pub struct SimApp {
    pub bundle_id: String,
    pub name: String,
}

/// List brukerinstallerte apper i simulatoren. `simctl listapps` gir en
/// NeXTSTEP-plist; vi konverterer til JSON via `plutil` (innebygd) og filtrerer
/// til ApplicationType == "User".
#[tauri::command]
pub async fn ios_sim_list_apps(udid: String) -> Result<Vec<SimApp>, String> {
    let out = Command::new("xcrun").args(["simctl", "listapps", &udid]).output()
        .map_err(|e| format!("simctl listapps: {}", e))?;
    if !out.status.success() {
        return Err(format!("listapps feilet: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    // Skriv plist til temp og konverter til JSON med plutil.
    let tmp = std::env::temp_dir().join(format!("postagent_apps_{}.plist", &udid.chars().take(8).collect::<String>()));
    std::fs::write(&tmp, &out.stdout).map_err(|e| e.to_string())?;
    let json_out = Command::new("/usr/bin/plutil")
        .args(["-convert", "json", "-o", "-", &tmp.to_string_lossy()])
        .output().map_err(|e| format!("plutil: {}", e))?;
    let _ = std::fs::remove_file(&tmp);
    if !json_out.status.success() {
        return Err("kunne ikke tolke app-lista (plutil)".into());
    }
    let val: serde_json::Value = serde_json::from_slice(&json_out.stdout)
        .map_err(|e| format!("json: {}", e))?;
    let mut apps = vec![];
    if let Some(map) = val.as_object() {
        for (bundle_id, info) in map {
            let app_type = info.get("ApplicationType").and_then(|v| v.as_str()).unwrap_or("");
            if app_type != "User" { continue; }
            let name = info.get("CFBundleDisplayName").and_then(|v| v.as_str())
                .or_else(|| info.get("CFBundleName").and_then(|v| v.as_str()))
                .unwrap_or(bundle_id).to_string();
            apps.push(SimApp { bundle_id: bundle_id.clone(), name });
        }
    }
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(apps)
}

/// Ta ett skjermbilde av simulatoren og returner det som base64 data-URL
/// (nedskalert med `sips` så IPC-en holder seg lett for live-preview-polling).
#[tauri::command]
pub async fn ios_sim_screenshot(udid: String) -> Result<String, String> {
    use base64::Engine;
    let tmp = std::env::temp_dir().join(format!("postagent_shot_{}.png", &udid.chars().take(8).collect::<String>()));
    let out = Command::new("xcrun")
        .args(["simctl", "io", &udid, "screenshot", &tmp.to_string_lossy()])
        .output().map_err(|e| format!("simctl screenshot: {}", e))?;
    if !out.status.success() && !tmp.is_file() {
        return Err(format!("skjermbilde feilet: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    // Nedskaler til maks 1200px lengste side (behold detaljer for vision, lett nok for polling).
    let _ = Command::new("/usr/bin/sips").args(["-Z", "1200", &tmp.to_string_lossy()]).output();
    let bytes = std::fs::read(&tmp).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&tmp);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}

/// Les accessibility-treet (iOS-DOM-ekvivalent) via idb. Returnerer rå JSON fra
/// `idb ui describe-all` som frontend/autonom-motoren tolker (label+type+ramme
/// per element). Krever idb installert.
#[tauri::command]
pub async fn ios_sim_describe(udid: String) -> Result<String, String> {
    let idb = find_idb().ok_or(
        "idb er ikke installert. For autonom gjennomgang: `brew install facebook/fb/idb-companion` + `pipx install fb-idb`, eller sett POST_AGENT_IDB til idb-stien.")?;
    let out = Command::new(&idb)
        .args(["ui", "describe-all", "--udid", &udid, "--json"])
        .output().map_err(|e| format!("idb describe-all: {}", e))?;
    if !out.status.success() {
        return Err(format!("describe-all feilet: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

/// Trykk på et punkt i simulatoren via idb (autonom drift). x/y i punkt-koordinater
/// slik describe-all rapporterer dem.
#[tauri::command]
pub async fn ios_sim_tap(udid: String, x: f64, y: f64) -> Result<bool, String> {
    let idb = find_idb().ok_or("idb er ikke installert (kreves for autonom trykking)")?;
    let out = Command::new(&idb)
        .args(["ui", "tap", "--udid", &udid, &(x as i64).to_string(), &(y as i64).to_string()])
        .output().map_err(|e| format!("idb tap: {}", e))?;
    if !out.status.success() {
        return Err(format!("tap feilet: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(true)
}

/// Sveip i simulatoren via idb (for scroll under autonom gjennomgang).
#[tauri::command]
pub async fn ios_sim_swipe(udid: String, x1: f64, y1: f64, x2: f64, y2: f64) -> Result<bool, String> {
    let idb = find_idb().ok_or("idb er ikke installert (kreves for autonom sveiping)")?;
    let out = Command::new(&idb)
        .args(["ui", "swipe", "--udid", &udid,
            &(x1 as i64).to_string(), &(y1 as i64).to_string(),
            &(x2 as i64).to_string(), &(y2 as i64).to_string()])
        .output().map_err(|e| format!("idb swipe: {}", e))?;
    if !out.status.success() {
        return Err(format!("swipe feilet: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(true)
}

/// Kjør osascript og returner trimmet stdout (eller None ved feil).
fn osascript(script: &str) -> Option<String> {
    let out = Command::new("/usr/bin/osascript").args(["-e", script]).output().ok()?;
    if !out.status.success() { return None; }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

/// Parse en komma-separert tall-liste fra osascript ("0, 0, 1512, 982").
fn parse_nums(s: &str) -> Vec<f64> {
    s.split(',').filter_map(|p| p.trim().parse::<f64>().ok()).collect()
}

/// Ta opp iPhone Mirroring-VINDUET (ikke hele Mac-skjermen) via skjerm-capture
/// + crop til vindusgeometrien. Crop uttrykkes som FRAKSJONER av frame (iw/ih),
/// så det er uavhengig av retina-skalafaktor. Faller tilbake til full skjerm
/// hvis vindusgrensene ikke kan leses (f.eks. manglende Tilgjengelighet-tilgang).
#[tauri::command]
pub async fn record_iphone_mirroring(
    app: AppHandle,
    project_id: String,
    scene_id: String,
    screen_index: String,
    duration_sec: u32,
) -> Result<String, String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg ikke funnet")?;
    let dir = recordings_dir(&app, &project_id)?;
    let safe_scene: String = scene_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    let out_path = dir.join(format!("{}.mp4", safe_scene));

    // Bring iPhone Mirroring til front så vinduet er synlig (ikke okkludert)
    // og posisjonen er stabil før vi leser geometrien.
    let _ = osascript("tell application \"iPhone Mirroring\" to activate");
    std::thread::sleep(std::time::Duration::from_millis(500));

    // Les vindusgeometri til den har SATT SEG (ikke midt i åpne-/flytte-animasjon):
    // to like avlesninger på rad = stabil.
    let read_win = || osascript(
        "tell application \"System Events\" to tell process \"iPhone Mirroring\" to get {position, size} of window 1",
    ).map(|s| parse_nums(&s));
    let mut win = read_win();
    for _ in 0..8 {
        std::thread::sleep(std::time::Duration::from_millis(250));
        let again = read_win();
        if again.as_ref().map(|v| v.len() == 4).unwrap_or(false) && again == win { break; }
        win = again;
    }
    let desk = osascript(
        "tell application \"Finder\" to get bounds of window of desktop",
    ).map(|s| parse_nums(&s));

    let crop_filter = match (win, desk) {
        (Some(w), Some(d)) if w.len() == 4 && d.len() == 4 && d[2] > 0.0 && d[3] > 0.0 => {
            let (x, y, ww, wh) = (w[0], w[1], w[2], w[3]);
            let (sw, sh) = (d[2], d[3]);
            // Klem fraksjoner til [0,1] for sikkerhets skyld.
            let fx = (x / sw).clamp(0.0, 1.0);
            let fy = (y / sh).clamp(0.0, 1.0);
            let fw = (ww / sw).clamp(0.05, 1.0);
            let fh = (wh / sh).clamp(0.05, 1.0);
            // partalls-dimensjoner (h264) via floor til partall.
            Some(format!(
                "crop=floor(iw*{:.5}/2)*2:floor(ih*{:.5}/2)*2:floor(iw*{:.5}):floor(ih*{:.5})",
                fw, fh, fx, fy
            ))
        }
        _ => None,
    };

    let idx_arg = format!("{}:none", screen_index);
    let mut args: Vec<String> = vec![
        "-y".into(), "-f".into(), "avfoundation".into(), "-framerate".into(), "30".into(),
        "-t".into(), duration_sec.to_string(),
        "-i".into(), idx_arg,
    ];
    if let Some(cf) = &crop_filter { args.push("-vf".into()); args.push(cf.clone()); }
    args.extend([
        "-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(),
        "-pix_fmt".into(), "yuv420p".into(), "-movflags".into(), "+faststart".into(),
        out_path.to_string_lossy().to_string(),
    ]);
    let status = Command::new(&ffmpeg).args(&args).status()
        .map_err(|e| format!("spawn ffmpeg: {}", e))?;
    if !status.success() {
        return Err("iPhone Mirroring-opptak feilet (kjører appen, og er skjermopptak-tilgang gitt?)".into());
    }
    Ok(out_path.to_string_lossy().to_string())
}

// ── Native skjermopptak (interaktiv start/stopp) ─────────────────────────────
// getDisplayMedia finnes ikke i WKWebView, så Guided Recorder kan ikke ta opp
// via nettleseren. Her bruker vi Apples egen `screencapture -v` (ingen ffmpeg-
// avhengighet) som filmer skjermen til den får SIGINT. Vi holder child-prosessen
// i managed state mellom start og stopp.
struct ScreenRecSession {
    child: Child,
    path: PathBuf,
}

#[derive(Default)]
pub struct ScreenRecState(pub(crate) Mutex<HashMap<String, ScreenRecSession>>);

/// Start native skjermopptak for en scene. Returnerer en session-id som må
/// sendes til `stop_screen_record`. Filmer hele skjermen til opptaket stoppes.
#[tauri::command]
pub async fn start_screen_record(
    app: AppHandle,
    state: State<'_, ScreenRecState>,
    project_id: String,
    scene_id: String,
) -> Result<String, String> {
    let dir = recordings_dir(&app, &project_id)?;
    let safe_scene: String = scene_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    let out_path = dir.join(format!("{}.mov", safe_scene));
    // -v: video, -C: ta med musepeker. screencapture stopper + finaliserer ved SIGINT.
    let child = Command::new("/usr/sbin/screencapture")
        .args(["-v", "-C", &out_path.to_string_lossy()])
        .spawn()
        .map_err(|e| format!("kunne ikke starte screencapture: {}", e))?;
    let session_id = safe_scene;
    state.0.lock().unwrap().insert(session_id.clone(), ScreenRecSession { child, path: out_path });
    Ok(session_id)
}

/// Stopp et native skjermopptak (SIGINT → finaliser fil) og returner sti.
#[tauri::command]
pub async fn stop_screen_record(
    state: State<'_, ScreenRecState>,
    session_id: String,
) -> Result<String, String> {
    let mut session = state.0.lock().unwrap().remove(&session_id)
        .ok_or("ingen aktiv opptaks-sesjon")?;
    // Control-C-ekvivalent → screencapture skriver ut filen og avslutter.
    let pid = session.child.id();
    let _ = Command::new("/bin/kill").args(["-INT", &pid.to_string()]).status();
    let _ = session.child.wait();
    let path = session.path.to_string_lossy().to_string();
    if !session.path.exists() {
        return Err("opptaksfil ble ikke skrevet — mangler appen skjermopptak-tillatelse? (Systeminnstillinger → Personvern → Skjermopptak)".into());
    }
    Ok(path)
}

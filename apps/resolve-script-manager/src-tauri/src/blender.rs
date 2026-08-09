//! Cinematic Blender-eksport: rendrer en enhet i et studio-environment via
//! headless Blender (Cycles) → PNG-sekvens → ffmpeg MP4. Gjenbruker det samme
//! prosess-mønsteret som broll.rs (Command + find_ffmpeg + data-URL-dekoder).

use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

/// Finn blender-binæren (homebrew, app-bundle, eller PATH).
fn find_blender() -> Option<PathBuf> {
    const CANDS: &[&str] = &[
        "/opt/homebrew/bin/blender",
        "/usr/local/bin/blender",
        "/Applications/Blender.app/Contents/MacOS/Blender",
    ];
    for c in CANDS {
        let p = PathBuf::from(c);
        if p.is_file() { return Some(p); }
    }
    if let Ok(o) = Command::new("which").arg("blender").output() {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !s.is_empty() { return Some(PathBuf::from(s)); }
        }
    }
    None
}

/// Løs stien til blender-scripts-katalogen: bundlet ressurs (prod) eller repo (dev).
fn scripts_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(res) = app.path().resource_dir() {
        for sub in ["scripts/blender", "_up_/scripts/blender"] {
            let p = res.join(sub);
            if p.join("render-device-scene.py").is_file() { return Some(p); }
        }
    }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("scripts").join("blender");
    if dev.join("render-device-scene.py").is_file() { Some(dev) } else { None }
}

/// Finn en system-python3 som HAR PIL (Blenders innebygde Python mangler PIL).
fn find_python_pil() -> Option<PathBuf> {
    let mut cands: Vec<String> = vec![];
    if let Ok(o) = Command::new("which").arg("python3").output() {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !s.is_empty() { cands.push(s); }
        }
    }
    cands.extend(["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"].map(String::from));
    for c in cands {
        let p = PathBuf::from(&c);
        if !p.is_file() { continue; }
        if Command::new(&p).args(["-c", "import PIL"]).status().map(|s| s.success()).unwrap_or(false) {
            return Some(p);
        }
    }
    None
}

/// Dekod en data-URL (data:image/...;base64,...) til en temp-fil.
fn decode_shot(data_url: &str, dir: &std::path::Path) -> Option<PathBuf> {
    use base64::Engine;
    let comma = data_url.find(',')?;
    let header = &data_url[..comma];
    if !header.contains("base64") { return None; }
    let ext = if header.contains("jpeg") || header.contains("jpg") { "jpg" } else { "png" };
    let bytes = base64::engine::general_purpose::STANDARD.decode(data_url[comma + 1..].trim()).ok()?;
    if bytes.len() < 100 { return None; }
    let path = dir.join(format!("shot.{ext}"));
    std::fs::write(&path, &bytes).ok()?;
    Some(path)
}

/// Rendrer den valgte 3D-enheten som cinematic MP4. `shot` er skjermbildet
/// (data-URL eller lokal sti; None = blank skjerm). Returnerer MP4-stien.
#[tauri::command]
pub async fn render_blender_cinematic(
    app: AppHandle,
    variant: String,
    shot: Option<String>,
    frames: Option<u32>,
    dest: Option<String>,
    type_text: Option<String>,
    rot_x: Option<f64>,
    rot_y: Option<f64>,
    rot_z: Option<f64>,
    key_pop: Option<bool>,
    kb_layout: Option<String>,
) -> Result<String, String> {
    let blender = find_blender().ok_or(
        "Blender ikke funnet. Installer Blender 3.6+ (brew install --cask blender).",
    )?;
    let sdir = scripts_dir(&app).ok_or("Fant ikke scripts/blender")?;
    let script = sdir.join("render-device-scene.py");
    let ffmpeg = crate::capture_sources::find_ffmpeg().ok_or("ffmpeg ikke funnet")?;

    // Unik arbeidskatalog.
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let work = std::env::temp_dir().join(format!("blender-cinematic-{ts}"));
    std::fs::create_dir_all(&work).map_err(|e| format!("mkdir: {e}"))?;

    // Kartlegg app-variant → script-device (kun disse har 3D-render).
    let device = match variant.as_str() {
        "macbook" => "macbook",
        "ipad" | "ipad_landscape" | "tablet" => "ipad",
        _ => "iphone",
    };
    let n = frames.unwrap_or(36).clamp(8, 120);

    // Skjermbilde → temp-fil om data-URL, ellers bruk stien direkte.
    let shot_path: Option<PathBuf> = shot.as_deref().and_then(|s| {
        if s.starts_with("data:") { decode_shot(s, &work) }
        else if !s.is_empty() && PathBuf::from(s).is_file() { Some(PathBuf::from(s)) }
        else { None }
    });

    // 0) Skrive-animasjon: pre-generer per-frame skjerm-bilder (system-python3 + PIL).
    let screendir: Option<PathBuf> = match type_text.as_deref() {
        Some(t) if !t.trim().is_empty() => {
            let py = find_python_pil().ok_or(
                "Skrive-animasjon krever python3 med Pillow (pip3 install pillow).",
            )?;
            let sd = work.join("typing");
            std::fs::create_dir_all(&sd).ok();
            let mut a: Vec<String> = vec![
                sdir.join("gen-typing-frames.py").to_string_lossy().into(),
                "--text".into(), t.to_string(),
                "--frames".into(), n.to_string(),
                "--out".into(), sd.to_string_lossy().into(),
            ];
            if let Some(sp) = &shot_path { a.push("--base".into()); a.push(sp.to_string_lossy().into()); }
            if device != "macbook" { a.push("--osk".into()); } // on-screen-tastatur for telefon/tablet
            if key_pop.unwrap_or(false) { a.push("--keypop".into()); }
            let ok = Command::new(&py).args(&a).status().map(|s| s.success()).unwrap_or(false);
            if ok && sd.join("screen_0001.png").is_file() { Some(sd) } else { None }
        }
        _ => None,
    };

    // 0b) Laptop fysisk tastatur-dekk: pre-generer per-frame dekk-bilder (macbook).
    let layout = if kb_layout.as_deref() == Some("windows") { "windows" } else { "mac" };
    let deckdir: Option<PathBuf> = if device == "macbook" {
        match type_text.as_deref() {
            Some(t) if !t.trim().is_empty() => find_python_pil().and_then(|py| {
                let dd = work.join("deck");
                std::fs::create_dir_all(&dd).ok();
                let ok = Command::new(&py).args([
                    sdir.join("gen-deck-frames.py").to_string_lossy().as_ref(),
                    "--text", t, "--frames", &n.to_string(),
                    "--out", &dd.to_string_lossy(), "--layout", layout,
                ]).status().map(|s| s.success()).unwrap_or(false);
                if ok && dd.join("deck_0001.png").is_file() { Some(dd) } else { None }
            }),
            _ => None,
        }
    } else { None };

    // 1) Blender headless render → PNG-sekvens.
    let mut args: Vec<String> = vec![
        "--background".into(), "--python".into(), script.to_string_lossy().into(),
        "--".into(),
        "--out".into(), work.to_string_lossy().into(),
        "--frames".into(), n.to_string(),
        "--device".into(), device.into(),
        "--rotx".into(), rot_x.unwrap_or(0.0).to_string(),
        "--roty".into(), rot_y.unwrap_or(0.0).to_string(),
        "--rotz".into(), rot_z.unwrap_or(0.0).to_string(),
    ];
    if let Some(sp) = &shot_path {
        args.push("--shot".into());
        args.push(sp.to_string_lossy().into());
    }
    if let Some(sd) = &screendir {
        args.push("--screendir".into());
        args.push(sd.to_string_lossy().into());
    }
    if let Some(dd) = &deckdir {
        args.push("--deckdir".into());
        args.push(dd.to_string_lossy().into());
    }
    let out = Command::new(&blender).args(&args).output()
        .map_err(|e| format!("blender-kjøring feilet: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("Blender-render feilet: {}", err.lines().last().unwrap_or("ukjent")));
    }
    // Sanity: minst ett bilde skrevet.
    if !work.join("frame_0001.png").is_file() {
        return Err("Blender skrev ingen bilder (sjekk script/GPU).".into());
    }

    // 2) ffmpeg PNG-sekvens → MP4 (til valgt destinasjon om oppgitt).
    let mp4 = match dest.as_deref() {
        Some(d) if !d.is_empty() => PathBuf::from(d),
        _ => work.join("cinematic.mp4"),
    };
    let ok = Command::new(&ffmpeg).args([
        "-y", "-framerate", "24", "-i", &work.join("frame_%04d.png").to_string_lossy(),
        "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
        &mp4.to_string_lossy(),
    ]).status().map(|s| s.success()).unwrap_or(false);
    if !ok || !mp4.is_file() {
        return Err("ffmpeg-koding feilet".into());
    }
    Ok(mp4.to_string_lossy().to_string())
}

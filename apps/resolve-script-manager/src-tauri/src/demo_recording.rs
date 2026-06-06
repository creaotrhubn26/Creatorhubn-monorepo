//! Lagrer Guided Recorder-opptak (per scene) til disk — som MP4.
//!
//! Frontend tar opp scenen med MediaRecorder (getDisplayMedia). Browser kan
//! kun skrive webm, så vi mottar webm-bytes (base64), skriver dem midlertidig,
//! og transkoder til H.264 MP4 med ffmpeg. Returnerer mp4-stien — som lagres
//! som scene.recordingPath og senere mates til render-pipelinen.

use std::path::PathBuf;
use std::process::Command;

use base64::Engine;
use tauri::{AppHandle, Manager};

const FFMPEG_FALLBACK_PATHS: &[&str] = &[
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
];

/// Lokaliser ffmpeg: env-override → which → fallback-stier.
fn find_ffmpeg() -> Option<PathBuf> {
    if let Ok(env_path) = std::env::var("RESOLVE_SCRIPT_MANAGER_FFMPEG") {
        let p = PathBuf::from(&env_path);
        if p.is_file() {
            return Some(p);
        }
    }
    if let Ok(output) = Command::new("which").arg("ffmpeg").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && PathBuf::from(&path).is_file() {
                return Some(PathBuf::from(path));
            }
        }
    }
    FFMPEG_FALLBACK_PATHS
        .iter()
        .map(PathBuf::from)
        .find(|p| p.is_file())
}

fn recordings_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?
        .join("demo-recordings")
        .join(sanitize(project_id));
    std::fs::create_dir_all(&base).map_err(|e| format!("create_dir_all: {}", e))?;
    Ok(base)
}

/// Tillat kun trygge filnavn-tegn (unngå path traversal).
fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

/// Lagre ett scene-opptak som MP4. `data_base64` er rå base64 webm (uten
/// data:-prefiks). Skriver webm midlertidig, transkoder til H.264 mp4, og
/// returnerer mp4-stien. Hvis ffmpeg mangler: behold webm og returner den.
#[tauri::command]
pub async fn save_demo_recording(
    app: AppHandle,
    project_id: String,
    scene_id: String,
    data_base64: String,
) -> Result<String, String> {
    let dir = recordings_dir(&app, &project_id)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|e| format!("base64 decode: {}", e))?;
    if bytes.is_empty() {
        return Err("Tomt opptak".into());
    }

    let scene = sanitize(&scene_id);
    let webm_path = dir.join(format!("{}.webm", scene));
    std::fs::write(&webm_path, &bytes).map_err(|e| format!("write webm: {}", e))?;

    // Transkode webm → mp4 (H.264 + AAC). Faststart for rask avspilling.
    let Some(ffmpeg) = find_ffmpeg() else {
        // Ingen ffmpeg → behold webm (pipelinen transkoder uansett ved eksport).
        return Ok(webm_path.to_string_lossy().to_string());
    };
    let mp4_path = dir.join(format!("{}.mp4", scene));
    let output = Command::new(&ffmpeg)
        .args([
            "-y",
            "-i", &webm_path.to_string_lossy(),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            &mp4_path.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("spawn ffmpeg: {}", e))?;

    if !output.status.success() {
        // Transkoding feilet → behold webm som fallback i stedet for å miste opptaket.
        return Ok(webm_path.to_string_lossy().to_string());
    }

    // Rydd webm når mp4 er skrevet.
    let _ = std::fs::remove_file(&webm_path);
    Ok(mp4_path.to_string_lossy().to_string())
}

/// Resultat av innbyggings-sjekk for en URL (X-Frame-Options / CSP frame-ancestors).
#[derive(serde::Serialize)]
pub struct EmbedCheck {
    pub embeddable: bool,
    pub reason: String,
}

/// Sjekk om en URL kan vises i en <iframe>. Brukes av Demo Studio for å advare
/// før web-opptak (ellers tas svart skjerm opp stille). Fail-open: hvis sjekken
/// ikke kan gjennomføres (nettverk/CORS), antar vi at den KAN bygges inn.
#[tauri::command]
pub async fn check_url_embeddable(url: String) -> Result<EmbedCheck, String> {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15")
        .build()
    {
        Ok(c) => c,
        Err(e) => return Ok(EmbedCheck { embeddable: true, reason: format!("kunne ikke initiere sjekk: {}", e) }),
    };
    let res = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return Ok(EmbedCheck { embeddable: true, reason: format!("kunne ikke sjekke siden: {}", e) }),
    };
    let headers = res.headers();
    let xfo = headers
        .get("x-frame-options")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();
    if xfo.contains("deny") || xfo.contains("sameorigin") {
        return Ok(EmbedCheck { embeddable: false, reason: format!("X-Frame-Options: {}", xfo.trim()) });
    }
    let csp = headers
        .get("content-security-policy")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();
    if let Some(idx) = csp.find("frame-ancestors") {
        let rest = &csp[idx..];
        let end = rest.find(';').unwrap_or(rest.len());
        let directive = &rest[..end];
        // Begrenset hvis 'none', eller kun 'self' uten wildcard.
        if directive.contains("'none'") || (directive.contains("'self'") && !directive.contains('*')) {
            return Ok(EmbedCheck { embeddable: false, reason: "CSP frame-ancestors begrenser innbygging".to_string() });
        }
    }
    Ok(EmbedCheck { embeddable: true, reason: "ok".to_string() })
}

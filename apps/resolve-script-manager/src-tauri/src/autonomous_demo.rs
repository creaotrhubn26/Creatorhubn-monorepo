//! autonomous_demo — byggeklosser for «Generér ferdig demo» (autonom):
//!   1. synthesize_tts: lag narration-lyd per scene med macOS `say` → m4a + varighet.
//!   2. mux_demo_video: legg hver narration på sin tids-offset over Playwright-videoen
//!      (ffmpeg adelay+amix) → ferdig mp4. Ingen menneskelig opptak.
//!
//! Bevisst on-device + nøkkelfri: `say` (offline TTS, norske stemmer som «Nora»)
//! + ffmpeg. Stemme-motoren kan byttes senere (ElevenLabs e.l.).

use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

fn find_tool(name: &str, fallbacks: &[&str]) -> Option<PathBuf> {
    if let Ok(o) = Command::new("which").arg(name).output() {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !s.is_empty() && PathBuf::from(&s).is_file() {
                return Some(PathBuf::from(s));
            }
        }
    }
    fallbacks.iter().map(PathBuf::from).find(|p| p.is_file())
}
fn find_ffmpeg() -> Option<PathBuf> {
    find_tool("ffmpeg", &["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/opt/local/bin/ffmpeg", "/usr/bin/ffmpeg"])
}
fn find_ffprobe() -> Option<PathBuf> {
    find_tool("ffprobe", &["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", "/opt/local/bin/ffprobe", "/usr/bin/ffprobe"])
}

fn work_dir(app: &AppHandle, project_id: &str, sub: &str) -> Result<PathBuf, String> {
    let safe: String = project_id.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join(sub).join(safe);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsResult {
    pub path: String,
    pub duration_sec: f64,
}

/// Syntetiser narration for én scene med macOS `say` → .m4a + varighet.
#[tauri::command]
pub async fn synthesize_tts(
    app: AppHandle,
    project_id: String,
    scene_id: String,
    text: String,
    voice: Option<String>,
) -> Result<TtsResult, String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg ikke funnet (brew install ffmpeg)")?;
    let clean = text.trim();
    if clean.is_empty() {
        return Err("tom narration".into());
    }
    let dir = work_dir(&app, &project_id, "demo-tts")?;
    let safe_scene: String = scene_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    let aiff = dir.join(format!("{}.aiff", safe_scene));
    let m4a = dir.join(format!("{}.m4a", safe_scene));

    let run_say = |with_voice: bool| -> std::io::Result<std::process::ExitStatus> {
        let mut say = Command::new("/usr/bin/say");
        if with_voice {
            if let Some(v) = voice.as_ref().filter(|v| !v.is_empty()) {
                say.args(["-v", v]);
            }
        }
        say.args(["-o", &aiff.to_string_lossy(), clean]).status()
    };
    let mut st = run_say(true).map_err(|e| format!("say spawn: {e}"))?;
    if !st.success() {
        // Stemmen er kanskje ikke installert → fall tilbake til systemets standard.
        st = run_say(false).map_err(|e| format!("say spawn: {e}"))?;
    }
    if !st.success() {
        return Err("macOS say feilet".into());
    }
    // aiff → m4a (aac)
    let st2 = Command::new(&ffmpeg)
        .args(["-y", "-i", &aiff.to_string_lossy(), "-c:a", "aac", "-b:a", "128k", &m4a.to_string_lossy()])
        .status()
        .map_err(|e| format!("ffmpeg aiff→m4a spawn: {e}"))?;
    let _ = std::fs::remove_file(&aiff);
    if !st2.success() {
        return Err("ffmpeg aiff→m4a feilet".into());
    }
    let mut duration_sec = 0.0;
    if let Some(fp) = find_ffprobe() {
        if let Ok(o) = Command::new(&fp)
            .args(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", &m4a.to_string_lossy()])
            .output()
        {
            duration_sec = String::from_utf8_lossy(&o.stdout).trim().parse().unwrap_or(0.0);
        }
    }
    Ok(TtsResult { path: m4a.to_string_lossy().to_string(), duration_sec })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NarrationSegment {
    pub audio_path: String,
    pub offset_ms: u32,
}

/// Mux: legg hver narration på sin tids-offset over Playwright-videoen
/// (.webm → .mp4 m/ H.264). Returnerer sti til ferdig mp4.
#[tauri::command]
pub async fn mux_demo_video(
    app: AppHandle,
    project_id: String,
    video_path: String,
    segments: Vec<NarrationSegment>,
) -> Result<String, String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg ikke funnet")?;
    if !PathBuf::from(&video_path).exists() {
        return Err("video-fil mangler (Playwright-opptak feilet?)".into());
    }
    let dir = work_dir(&app, &project_id, "demo-renders")?;
    let out = dir.join("autonom-demo.mp4");

    let mut args: Vec<String> = vec!["-y".into(), "-i".into(), video_path.clone()];
    for seg in &segments {
        args.push("-i".into());
        args.push(seg.audio_path.clone());
    }
    if segments.is_empty() {
        // Ingen narration → bare transkod webm→mp4.
        args.extend([
            "-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(),
            "-pix_fmt".into(), "yuv420p".into(), "-movflags".into(), "+faststart".into(),
            out.to_string_lossy().to_string(),
        ]);
    } else {
        // Forsink hver narration til sin scene-offset, mix sammen (sekvensielle,
        // så normalize=0 holder fullt volum), legg over videoen.
        let mut filter = String::new();
        for (i, seg) in segments.iter().enumerate() {
            let idx = i + 1; // lyd-inputs starter på 1 (0 = video)
            filter.push_str(&format!("[{idx}:a]adelay={d}|{d}[a{i}];", idx = idx, d = seg.offset_ms, i = i));
        }
        for i in 0..segments.len() {
            filter.push_str(&format!("[a{}]", i));
        }
        filter.push_str(&format!("amix=inputs={}:dropout_transition=0:normalize=0[mix]", segments.len()));
        args.extend([
            "-filter_complex".into(), filter,
            "-map".into(), "0:v".into(), "-map".into(), "[mix]".into(),
            "-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(),
            "-pix_fmt".into(), "yuv420p".into(),
            "-c:a".into(), "aac".into(), "-b:a".into(), "192k".into(),
            "-movflags".into(), "+faststart".into(),
            out.to_string_lossy().to_string(),
        ]);
    }
    let st = Command::new(&ffmpeg).args(&args).status().map_err(|e| format!("ffmpeg mux spawn: {e}"))?;
    if !st.success() {
        return Err("ffmpeg mux feilet".into());
    }
    Ok(out.to_string_lossy().to_string())
}

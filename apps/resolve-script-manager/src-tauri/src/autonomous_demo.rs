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

fn probe_duration(ffprobe: &Option<PathBuf>, m4a: &PathBuf) -> f64 {
    if let Some(fp) = ffprobe {
        if let Ok(o) = Command::new(fp).args(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", &m4a.to_string_lossy()]).output() {
            return String::from_utf8_lossy(&o.stdout).trim().parse().unwrap_or(0.0);
        }
    }
    0.0
}

/// Syntetiser narration for én scene. ElevenLabs hvis nøkkel er satt (bedre,
/// selger-kvalitet stemme), ellers macOS `say` (on-device, nøkkelfritt).
#[tauri::command]
pub async fn synthesize_tts(
    app: AppHandle,
    project_id: String,
    scene_id: String,
    text: String,
    voice: Option<String>,
    eleven_key: Option<String>,
    eleven_voice_id: Option<String>,
) -> Result<TtsResult, String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg ikke funnet (brew install ffmpeg)")?;
    let ffprobe = find_ffprobe();
    let clean = text.trim();
    if clean.is_empty() {
        return Err("tom narration".into());
    }
    let dir = work_dir(&app, &project_id, "demo-tts")?;
    let safe_scene: String = scene_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    let aiff = dir.join(format!("{}.aiff", safe_scene));
    let m4a = dir.join(format!("{}.m4a", safe_scene));

    // ── ElevenLabs (hvis API-nøkkel) — faller stille tilbake til say ved feil ──
    if let Some(key) = eleven_key.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        let vid = eleven_voice_id.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
            .unwrap_or_else(|| "EXAVITQu4vr4xnSDxMaL".into());
        let mp3 = dir.join(format!("{}.mp3", safe_scene));
        let client = reqwest::Client::new();
        let res = client
            .post(format!("https://api.elevenlabs.io/v1/text-to-speech/{vid}"))
            .header("xi-api-key", key)
            .json(&serde_json::json!({ "text": clean, "model_id": "eleven_multilingual_v2" }))
            .send().await;
        if let Ok(r) = res {
            if r.status().is_success() {
                if let Ok(bytes) = r.bytes().await {
                    if std::fs::write(&mp3, &bytes).is_ok() {
                        let ok = Command::new(&ffmpeg)
                            .args(["-y", "-i", &mp3.to_string_lossy(), "-c:a", "aac", "-b:a", "160k", &m4a.to_string_lossy()])
                            .status().map(|s| s.success()).unwrap_or(false);
                        let _ = std::fs::remove_file(&mp3);
                        if ok {
                            return Ok(TtsResult { path: m4a.to_string_lossy().to_string(), duration_sec: probe_duration(&ffprobe, &m4a) });
                        }
                    }
                }
            }
        }
        // ElevenLabs feilet → fortsett til say-fallback under (ikke avbryt demoen).
    }

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
    Ok(TtsResult { path: m4a.to_string_lossy().to_string(), duration_sec: probe_duration(&ffprobe, &m4a) })
}

/// Hent ut ett bilde fra videoen ved `offset_sec` → data-URL PNG (skalert til
/// 960px bred for rask/billig vision-QA). Lar AI «se» hver scene i opptaket.
#[tauri::command]
pub async fn extract_frame(video_path: String, offset_sec: f64) -> Result<String, String> {
    use base64::Engine;
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg ikke funnet")?;
    if !PathBuf::from(&video_path).exists() {
        return Err("video-fil mangler".into());
    }
    let ms = (offset_sec.max(0.0) * 1000.0) as u64;
    let out = std::env::temp_dir().join(format!("paqa_frame_{}.png", ms));
    let ok = Command::new(&ffmpeg)
        .args([
            "-y", "-ss", &format!("{:.2}", offset_sec.max(0.0)), "-i", &video_path,
            "-frames:v", "1", "-vf", "scale=960:-1", &out.to_string_lossy(),
        ])
        .status().map(|s| s.success()).unwrap_or(false);
    if !ok {
        return Err("frame-ekstraksjon feilet".into());
    }
    let bytes = std::fs::read(&out).map_err(|e| format!("les frame: {e}"))?;
    let _ = std::fs::remove_file(&out);
    if bytes.is_empty() {
        return Err("tomt frame".into());
    }
    Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

/// Konverter ferdig narration-lyd (mp3/bytes fra TTS-proxy, base64) → m4a +
/// varighet. Brukes når frontend henter stemmen via backend-proxyen.
#[tauri::command]
pub async fn tts_from_audio(
    app: AppHandle,
    project_id: String,
    scene_id: String,
    audio_b64: String,
) -> Result<TtsResult, String> {
    use base64::Engine;
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg ikke funnet")?;
    let ffprobe = find_ffprobe();
    let dir = work_dir(&app, &project_id, "demo-tts")?;
    let safe_scene: String = scene_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    let src = dir.join(format!("{}.src", safe_scene));
    let m4a = dir.join(format!("{}.m4a", safe_scene));
    let data = audio_b64.rsplit(',').next().unwrap_or(&audio_b64);
    let bytes = base64::engine::general_purpose::STANDARD.decode(data.trim()).map_err(|e| format!("base64: {e}"))?;
    if bytes.is_empty() { return Err("tom lyd".into()); }
    std::fs::write(&src, &bytes).map_err(|e| format!("skriv lyd: {e}"))?;
    let ok = Command::new(&ffmpeg)
        .args(["-y", "-i", &src.to_string_lossy(), "-c:a", "aac", "-b:a", "160k", &m4a.to_string_lossy()])
        .status().map(|s| s.success()).unwrap_or(false);
    let _ = std::fs::remove_file(&src);
    if !ok { return Err("ffmpeg konvertering feilet".into()); }
    Ok(TtsResult { path: m4a.to_string_lossy().to_string(), duration_sec: probe_duration(&ffprobe, &m4a) })
}

/// Les et bilde fra disk → data-URL (for produkt-reveal: produktbildet embeddes
/// i den animerte HTML-scenen). Støtter png/jpg/webp.
#[tauri::command]
pub async fn read_image_b64(path: String) -> Result<String, String> {
    use base64::Engine;
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err("bilde finnes ikke".into());
    }
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    };
    let bytes = std::fs::read(&p).map_err(|e| format!("les bilde: {e}"))?;
    if bytes.is_empty() {
        return Err("tomt bilde".into());
    }
    Ok(format!("data:{};base64,{}", mime, base64::engine::general_purpose::STANDARD.encode(bytes)))
}

/// Skriv en data-URL (eller rå base64) til en PNG/JPG på disk og returner stien.
/// Brukes av Fusion-demo-broen: scene-screenshots (scanShots) persistes som
/// filer slik at Resolve/Fusion-scriptet kan importere dem i media pool.
#[tauri::command]
pub async fn save_demo_frame(
    app: AppHandle,
    project_id: String,
    name: String,
    data_url: String,
) -> Result<String, String> {
    use base64::Engine;
    let dir = work_dir(&app, &project_id, "fusion-frames")?;
    let safe: String = name.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    let lower = data_url.to_ascii_lowercase();
    let ext = if lower.contains("image/jpeg") || lower.contains("image/jpg") { "jpg" }
        else if lower.contains("image/webp") { "webp" }
        else { "png" };
    let out = dir.join(format!("{}.{}", safe, ext));
    let payload = data_url.rsplit(',').next().unwrap_or(&data_url);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload.trim())
        .map_err(|e| format!("base64: {e}"))?;
    if bytes.is_empty() {
        return Err("tomt bilde".into());
    }
    std::fs::write(&out, &bytes).map_err(|e| format!("skriv bilde: {e}"))?;
    Ok(out.to_string_lossy().to_string())
}

/// Åpne en fil/sti med systemets standard-app (`/usr/bin/open`). Mer pålitelig
/// enn opener-pluginen for vilkårlige stier (f.eks. ~/Movies/Post Agent/).
#[tauri::command]
pub async fn system_open(path: String) -> Result<(), String> {
    let st = Command::new("/usr/bin/open").arg(&path).status().map_err(|e| format!("open spawn: {e}"))?;
    if !st.success() {
        return Err("kunne ikke åpne fila".into());
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NarrationSegment {
    pub audio_path: String,
    pub offset_ms: u32,
}

/// Branding/innramming for ferdig video. PNG-feltene er base64 (evt. dataURL) —
/// frontend rendrer dem i canvas (drawtext finnes ikke i alle ffmpeg-bygg).
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FinalizeOpts {
    pub frame_png: Option<String>,
    pub frame_x: Option<u32>,
    pub frame_y: Option<u32>,
    pub frame_w: Option<u32>,
    pub frame_h: Option<u32>,
    pub intro_png: Option<String>,
    pub outro_png: Option<String>,
    pub intro_sec: Option<f64>,
    pub outro_sec: Option<f64>,
}

fn run_ff(ffmpeg: &PathBuf, args: &[String], what: &str) -> Result<(), String> {
    let st = Command::new(ffmpeg).args(args).status().map_err(|e| format!("ffmpeg {what} spawn: {e}"))?;
    if !st.success() { return Err(format!("ffmpeg {what} feilet")); }
    Ok(())
}

fn write_b64_png(b64: &str, path: &PathBuf) -> Result<(), String> {
    use base64::Engine;
    let data = b64.rsplit(',').next().unwrap_or(b64); // strip evt. dataURL-prefiks
    let bytes = base64::engine::general_purpose::STANDARD.decode(data.trim()).map_err(|e| format!("base64: {e}"))?;
    std::fs::write(path, bytes).map_err(|e| format!("skriv png: {e}"))?;
    Ok(())
}

/// Lag et video-segment fra et stillbilde (PNG) + stillhet, i `sec` sekunder.
fn png_to_segment(ffmpeg: &PathBuf, png: &PathBuf, sec: f64, out: &PathBuf) -> Result<(), String> {
    run_ff(ffmpeg, &[
        "-y".into(), "-loop".into(), "1".into(), "-t".into(), format!("{:.2}", sec.max(0.5)), "-i".into(), png.to_string_lossy().to_string(),
        "-f".into(), "lavfi".into(), "-t".into(), format!("{:.2}", sec.max(0.5)), "-i".into(), "anullsrc=r=44100:cl=stereo".into(),
        "-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(), "-pix_fmt".into(), "yuv420p".into(),
        "-r".into(), "25".into(), "-vf".into(), "scale=1280:800".into(),
        "-c:a".into(), "aac".into(), "-shortest".into(), out.to_string_lossy().to_string(),
    ], "intro/outro")
}

/// Mux: narration over videoen + valgfri device-ramme + intro/outro → ferdig
/// mp4 i ~/Movies/Post Agent/. Returnerer sti.
#[tauri::command]
pub async fn mux_demo_video(
    app: AppHandle,
    project_id: String,
    video_path: String,
    segments: Vec<NarrationSegment>,
    out_name: Option<String>,
    finalize: Option<FinalizeOpts>,
) -> Result<String, String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg ikke funnet")?;
    if !PathBuf::from(&video_path).exists() {
        return Err("video-fil mangler (Playwright-opptak feilet?)".into());
    }
    let fin = finalize.unwrap_or_default();
    let work = work_dir(&app, &project_id, "demo-renders")?;
    let home = std::env::var("HOME").map_err(|_| "fant ikke hjemmemappe".to_string())?;
    let out_dir = PathBuf::from(home).join("Movies").join("Post Agent");
    std::fs::create_dir_all(&out_dir).map_err(|e| format!("kunne ikke lage ~/Movies/Post Agent: {e}"))?;
    let base: String = out_name.unwrap_or_else(|| "autonom-demo".into())
        .chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == ' ' { c } else { '_' }).collect();
    let base = if base.trim().is_empty() { format!("demo-{}", project_id) } else { base.trim().to_string() };
    let final_out = out_dir.join(format!("{}.mp4", base));

    // ── Steg 1: narration over videoen → work/main.mp4 ──
    let main = work.join("main.mp4");
    let mut args: Vec<String> = vec!["-y".into(), "-i".into(), video_path.clone()];
    for seg in &segments { args.push("-i".into()); args.push(seg.audio_path.clone()); }
    if segments.is_empty() {
        args.extend(["-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(), "-pix_fmt".into(), "yuv420p".into(), main.to_string_lossy().to_string()]);
    } else {
        let mut filter = String::new();
        for (i, seg) in segments.iter().enumerate() { filter.push_str(&format!("[{idx}:a]adelay={d}|{d}[a{i}];", idx = i + 1, d = seg.offset_ms, i = i)); }
        for i in 0..segments.len() { filter.push_str(&format!("[a{}]", i)); }
        filter.push_str(&format!("amix=inputs={}:dropout_transition=0:normalize=0[mix]", segments.len()));
        args.extend(["-filter_complex".into(), filter, "-map".into(), "0:v".into(), "-map".into(), "[mix]".into(),
            "-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(), "-pix_fmt".into(), "yuv420p".into(),
            "-c:a".into(), "aac".into(), "-b:a".into(), "192k".into(), main.to_string_lossy().to_string()]);
    }
    run_ff(&ffmpeg, &args, "mux")?;
    let mut current = main.clone();

    // ── Steg 2: device-ramme (video skalert inn på frame-PNG) → work/framed.mp4 ──
    if let Some(b64) = fin.frame_png.as_ref() {
        let frame_png = work.join("frame.png");
        write_b64_png(b64, &frame_png)?;
        let (fx, fy, fw, fh) = (fin.frame_x.unwrap_or(80), fin.frame_y.unwrap_or(70), fin.frame_w.unwrap_or(1120), fin.frame_h.unwrap_or(700));
        let framed = work.join("framed.mp4");
        run_ff(&ffmpeg, &[
            "-y".into(), "-i".into(), current.to_string_lossy().to_string(), "-i".into(), frame_png.to_string_lossy().to_string(),
            "-filter_complex".into(), format!("[1:v]null[bg];[0:v]scale={fw}:{fh}[v];[bg][v]overlay={fx}:{fy}[out]"),
            "-map".into(), "[out]".into(), "-map".into(), "0:a?".into(),
            "-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(), "-pix_fmt".into(), "yuv420p".into(),
            "-c:a".into(), "aac".into(), framed.to_string_lossy().to_string(),
        ], "ramme")?;
        current = framed;
    }

    // ── Steg 3: intro/outro → concat → work/final.mp4 ──
    let has_intro = fin.intro_png.is_some();
    let has_outro = fin.outro_png.is_some();
    if has_intro || has_outro {
        let mut list: Vec<PathBuf> = vec![];
        if let Some(b64) = fin.intro_png.as_ref() {
            let p = work.join("intro.png"); write_b64_png(b64, &p)?;
            let seg = work.join("intro.mp4"); png_to_segment(&ffmpeg, &p, fin.intro_sec.unwrap_or(2.6), &seg)?;
            list.push(seg);
        }
        list.push(current.clone());
        if let Some(b64) = fin.outro_png.as_ref() {
            let p = work.join("outro.png"); write_b64_png(b64, &p)?;
            let seg = work.join("outro.mp4"); png_to_segment(&ffmpeg, &p, fin.outro_sec.unwrap_or(2.6), &seg)?;
            list.push(seg);
        }
        let list_file = work.join("concat.txt");
        let body: String = list.iter().map(|p| format!("file '{}'\n", p.to_string_lossy())).collect();
        std::fs::write(&list_file, body).map_err(|e| format!("skriv concat-liste: {e}"))?;
        let joined = work.join("final.mp4");
        run_ff(&ffmpeg, &[
            "-y".into(), "-f".into(), "concat".into(), "-safe".into(), "0".into(), "-i".into(), list_file.to_string_lossy().to_string(),
            "-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(), "-pix_fmt".into(), "yuv420p".into(),
            "-c:a".into(), "aac".into(), "-b:a".into(), "192k".into(), joined.to_string_lossy().to_string(),
        ], "concat")?;
        current = joined;
    }

    // ── Steg 4: subtil fargegrad + vignett (premium-look) + faststart ──
    // Lett løft i kontrast/metning + myk vignett gjør videoen mer kino-aktig.
    run_ff(&ffmpeg, &[
        "-y".into(), "-i".into(), current.to_string_lossy().to_string(),
        "-vf".into(), "eq=contrast=1.04:saturation=1.07,vignette=angle=PI/6".into(),
        "-c:v".into(), "libx264".into(), "-preset".into(), "veryfast".into(), "-pix_fmt".into(), "yuv420p".into(),
        "-c:a".into(), "copy".into(), "-movflags".into(), "+faststart".into(), final_out.to_string_lossy().to_string(),
    ], "grade+faststart").or_else(|_| {
        // fallback uten grad hvis filteret feiler
        run_ff(&ffmpeg, &["-y".into(), "-i".into(), current.to_string_lossy().to_string(),
            "-c".into(), "copy".into(), "-movflags".into(), "+faststart".into(), final_out.to_string_lossy().to_string()], "faststart")
    })?;
    Ok(final_out.to_string_lossy().to_string())
}

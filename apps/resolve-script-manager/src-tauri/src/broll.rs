//! broll — AI-generert kinematisk footage til Demo Studio (provider-fasade).
//!
//! Demo-studio fanger ekte skjermer (web/Mac/iOS/simulator). Denne modulen gir
//! den ANDRE footage-typen: syntetisk video (krok, kontekst, overgang, outro) som
//! et skjermopptak ikke kan gi. Den er en tynn fasade over en video-leverandør:
//!
//!   - 'higgsfield': lokal CLI (~/.local/bin/higgsfield, Seedance 2.0) — «den vi
//!     har». Dine kreditter, din maskin. Speiler generate_broll.py sitt kall.
//!   - (fal Seedance serverside kommer som andre provider — samme fasade.)
//!
//! Et generert klipp lagres som en scenes recordingPath, så det flyter gjennom
//! nøyaktig samme eksport (mockupRenderVideo) som en fanget scene — ingen egen
//! rørledning, ingen muxer-endring.

use std::path::PathBuf;
use std::process::Command;

use crate::capture_sources::{find_ffmpeg, recordings_dir};
use tauri::AppHandle;

/// Finn higgsfield-CLI: env-override, standard install-sti, deretter PATH.
fn find_higgsfield() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("POST_AGENT_HIGGSFIELD") {
        let pb = PathBuf::from(&p);
        if pb.is_file() { return Some(pb); }
    }
    if let Ok(home) = std::env::var("HOME") {
        let pb = PathBuf::from(home).join(".local/bin/higgsfield");
        if pb.is_file() { return Some(pb); }
    }
    if let Ok(o) = Command::new("/usr/bin/which").arg("higgsfield").output() {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !s.is_empty() && PathBuf::from(&s).is_file() { return Some(PathBuf::from(s)); }
        }
    }
    for cand in ["/opt/homebrew/bin/higgsfield", "/usr/local/bin/higgsfield"] {
        let pb = PathBuf::from(cand);
        if pb.is_file() { return Some(pb); }
    }
    None
}

/// Konto-/kreditt-status fra higgsfield (rå tekst, vist i UI før generering).
/// Tom streng hvis CLI-en finnes men status ikke kunne leses; feil hvis den mangler.
#[tauri::command]
pub async fn higgsfield_account_status() -> Result<String, String> {
    let hf = find_higgsfield().ok_or(
        "higgsfield-CLI mangler (~/.local/bin/higgsfield). Installer den, eller sett POST_AGENT_HIGGSFIELD til stien.")?;
    let out = Command::new(&hf).args(["account", "status"]).output()
        .map_err(|e| format!("higgsfield account: {}", e))?;
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Trekk en resultat-URL ut av higgsfield sin (støyete) stdout. Prøver JSON-
/// blokker (result_url/url/results[0].url) og faller tilbake til en rå .mp4-URL.
fn extract_url(stdout: &str, stderr: &str) -> Option<String> {
    for chunk in find_json_chunks(stdout) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&chunk) {
            let items: Vec<serde_json::Value> = match val {
                serde_json::Value::Array(a) => a,
                other => vec![other],
            };
            for it in items {
                let u = it.get("result_url").and_then(|v| v.as_str())
                    .or_else(|| it.get("url").and_then(|v| v.as_str()))
                    .or_else(|| it.get("results")
                        .and_then(|r| r.as_array())
                        .and_then(|a| a.first())
                        .and_then(|f| f.get("url"))
                        .and_then(|v| v.as_str()));
                if let Some(u) = u {
                    if u.starts_with("http") { return Some(u.to_string()); }
                }
            }
        }
    }
    // Fallback: hvilken som helst .mp4-URL i utdata.
    let hay = format!("{}{}", stdout, stderr);
    if let Some(start) = hay.find("https://") {
        let tail = &hay[start..];
        if let Some(end) = tail.find(".mp4") {
            return Some(tail[..end + 4].to_string());
        }
    }
    None
}

/// Grov JSON-blokk-splitter (balanserte {} eller []). Higgsfield blander logg + JSON.
fn find_json_chunks(s: &str) -> Vec<String> {
    let mut chunks = vec![];
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i] as char;
        if c == '{' || c == '[' {
            let open = c;
            let close = if c == '{' { '}' } else { ']' };
            let mut depth = 0i32;
            let mut j = i;
            while j < bytes.len() {
                let cj = bytes[j] as char;
                if cj == open { depth += 1; }
                else if cj == close { depth -= 1; if depth == 0 { break; } }
                j += 1;
            }
            if depth == 0 && j < bytes.len() {
                chunks.push(s[i..=j].to_string());
                i = j + 1;
                continue;
            }
        }
        i += 1;
    }
    chunks
}

/// Generér ett kinematisk klipp via higgsfield (Seedance 2.0) og lagre det som
/// scenens recordingPath (normalisert H.264 mp4). start_image (valgfritt) =
/// «forankre i ekte ramme» (levende produkt-skjerm).
#[tauri::command]
pub async fn generate_broll_clip(
    app: AppHandle,
    project_id: String,
    scene_id: String,
    prompt: String,
    start_image: Option<String>,
    duration_sec: u32,
    resolution: String,
    no_people: bool,
) -> Result<String, String> {
    let hf = find_higgsfield().ok_or(
        "higgsfield-CLI mangler (~/.local/bin/higgsfield). Installer den, eller sett POST_AGENT_HIGGSFIELD til stien.")?;
    let mut prompt = prompt.trim().to_string();
    if prompt.is_empty() { return Err("prompt kreves for å generere klipp".into()); }
    if no_people {
        prompt = format!("{}, no people, no faces, no text", prompt);
    }
    let dur = duration_sec.clamp(4, 15).to_string();
    let res = match resolution.as_str() {
        "480p" | "720p" | "1080p" | "4k" => resolution.as_str(),
        "4K" => "4k",
        _ => "1080p",
    };

    let dir = recordings_dir(&app, &project_id)?;
    let safe_scene: String = scene_id.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();

    let mut cmd = Command::new(&hf);
    cmd.args(["generate", "create", "seedance_2_0", "--prompt", &prompt,
        "--duration", &dur, "--resolution", res, "--aspect_ratio", "16:9", "--wait", "--json"]);
    // start_image kan være en fil-sti ELLER en data-URL (ekte fanget ramme fra
    // frontend — «forankre i produkt-skjerm»). Data-URL → skriv til temp-fil.
    let mut _tmp_start: Option<PathBuf> = None;
    if let Some(img) = start_image.as_ref() {
        let resolved = if img.starts_with("data:") {
            let p = data_url_to_temp(img, &dir, &safe_scene);
            _tmp_start = p.clone();
            p
        } else {
            let expanded = shellexpand_home(img);
            let pb = PathBuf::from(&expanded);
            if pb.is_file() { Some(pb) } else { None }
        };
        if let Some(pb) = resolved.as_ref() {
            cmd.args(["--start-image", &pb.to_string_lossy()]);
        }
    }
    let out = cmd.output().map_err(|e| format!("higgsfield generate: {}", e))?;
    if let Some(p) = _tmp_start.as_ref() { let _ = std::fs::remove_file(p); } // rydd anker-ramme
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    let url = extract_url(&stdout, &stderr).ok_or_else(|| {
        let tail: String = format!("{}{}", stdout, stderr).chars().rev().take(300).collect::<String>().chars().rev().collect();
        format!("Fikk ingen resultat-URL fra Higgsfield: {}", tail)
    })?;

    // Last ned rå-klipp.
    let raw_path = dir.join(format!("{}._broll_raw.mp4", safe_scene));
    let dl = Command::new("/usr/bin/curl")
        .args(["-sL", "-o", &raw_path.to_string_lossy(), &url])
        .status().map_err(|e| format!("curl: {}", e))?;
    let raw_ok = dl.success() && raw_path.metadata().map(|m| m.len() > 10_000).unwrap_or(false);
    if !raw_ok {
        let _ = std::fs::remove_file(&raw_path);
        return Err("nedlasting av generert klipp feilet".into());
    }

    // Normaliser til H.264 mp4 så eksport-pipelinen får konsistent input
    // (samme som record_simulator gjør).
    let out_path = dir.join(format!("{}.mp4", safe_scene));
    if let Some(ffmpeg) = find_ffmpeg() {
        let ok = Command::new(&ffmpeg)
            .args(["-y", "-i", &raw_path.to_string_lossy(),
                "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", &out_path.to_string_lossy()])
            .status().map(|s| s.success()).unwrap_or(false);
        let _ = std::fs::remove_file(&raw_path);
        if ok && out_path.is_file() {
            return Ok(out_path.to_string_lossy().to_string());
        }
    }
    // Fallback: behold rå-klippet hvis transcoding ikke gikk.
    Ok(raw_path.to_string_lossy().to_string())
}

/// Dekod en data-URL (data:image/...;base64,....) og skriv til en temp-fil i
/// scene-katalogen. Returnerer stien, eller None ved ugyldig data.
fn data_url_to_temp(data_url: &str, dir: &std::path::Path, safe_scene: &str) -> Option<PathBuf> {
    use base64::Engine;
    let comma = data_url.find(',')?;
    let header = &data_url[..comma];
    if !header.contains("base64") { return None; }
    let ext = if header.contains("jpeg") || header.contains("jpg") { "jpg" } else { "png" };
    let payload = &data_url[comma + 1..];
    let bytes = base64::engine::general_purpose::STANDARD.decode(payload.trim()).ok()?;
    if bytes.len() < 100 { return None; }
    let path = dir.join(format!("{}._anchor.{}", safe_scene, ext));
    std::fs::write(&path, &bytes).ok()?;
    Some(path)
}

/// Utvid en ledende ~ til $HOME (start-image kan komme som «~/...»).
fn shellexpand_home(p: &str) -> String {
    if let Some(rest) = p.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}/{}", home, rest);
        }
    }
    p.to_string()
}

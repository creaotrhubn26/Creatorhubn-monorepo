//! Media file probing — runs ffprobe on video files to read their actual
//! format (frame rate, resolution, codec, color space), and classifies the
//! result as PAL / NTSC / Cinema based on the frame rate.
//!
//! Why we need this:
//!   - Role Room equipment metadata says "Sony FX3 @ 25 fps" (PAL).
//!   - But actual files on the card might be 50 fps slow-mo or even 29.97
//!     (someone left NTSC mode on by mistake).
//!   - Probing the actual files lets us flag mismatches BEFORE the lead
//!     imports into Resolve with the wrong project settings.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

const FFPROBE_FALLBACK_PATHS: &[&str] = &[
    "/opt/homebrew/bin/ffprobe",
    "/usr/local/bin/ffprobe",
    "/opt/local/bin/ffprobe",
    "/usr/bin/ffprobe",
];

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub path: String,
    pub file_name: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub frame_rate: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub codec: Option<String>,
    pub color_space: Option<String>,
    pub color_transfer: Option<String>,
    pub color_primaries: Option<String>,
    pub video_standard: String, // "PAL" | "NTSC" | "Cinema" | "Other"
    /// Detected log curve, if any. None = standard Rec.709/sRGB-style footage.
    pub log_curve: Option<LogCurveGuess>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogCurveGuess {
    /// e.g. "C-Log 2", "S-Log 3", "V-Log", "HLG", "PQ"
    pub label: String,
    /// 0..1 — heuristic confidence
    pub confidence: f32,
    /// What signal we used: "ffprobe_transfer", "filename", "codec_container"
    pub source: String,
    /// Suggested DaVinci Resolve Color Space Transform (CST) input
    /// gamma + gamut so the lead can plug it into a Color page node.
    pub suggested_cst_input_gamma: Option<String>,
    pub suggested_cst_input_gamut: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProbeSummary {
    pub files: Vec<MediaInfo>,
    pub total_files: usize,
    pub probed_count: usize,
    pub error_count: usize,
    pub dominant_frame_rate: Option<f64>,
    pub dominant_resolution: Option<String>,
    pub dominant_standard: Option<String>,
    pub dominant_log_curve: Option<LogCurveGuess>,
    pub mixed_standards: bool,
    pub mixed_log_curves: bool,
    pub ffprobe_available: bool,
}

/// PAL = 25/50 fps. NTSC = 29.97/30/59.94/60. Cinema = 23.976/24/48.
/// Anything else (e.g. variable) → "Other".
pub fn classify(fps: f64) -> &'static str {
    let f = (fps * 1000.0).round() / 1000.0;
    if (f - 25.0).abs() < 0.02 || (f - 50.0).abs() < 0.02 {
        "PAL"
    } else if (f - 29.97).abs() < 0.05
        || (f - 30.0).abs() < 0.02
        || (f - 59.94).abs() < 0.05
        || (f - 60.0).abs() < 0.02
    {
        "NTSC"
    } else if (f - 23.976).abs() < 0.05
        || (f - 24.0).abs() < 0.02
        || (f - 48.0).abs() < 0.02
    {
        "Cinema"
    } else {
        "Other"
    }
}

pub fn find_ffprobe() -> Option<PathBuf> {
    if let Ok(env_path) = std::env::var("RESOLVE_SCRIPT_MANAGER_FFMPEG") {
        let candidate = PathBuf::from(env_path.replace("ffmpeg", "ffprobe"));
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    if let Ok(output) = Command::new("which").arg("ffprobe").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && Path::new(&path).is_file() {
                return Some(PathBuf::from(path));
            }
        }
    }
    for fallback in FFPROBE_FALLBACK_PATHS {
        let p = PathBuf::from(fallback);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

fn parse_frame_rate(rate_str: &str) -> Option<f64> {
    // ffprobe returns "25/1" or "30000/1001". Parse rational fraction.
    let parts: Vec<&str> = rate_str.split('/').collect();
    if parts.len() == 2 {
        let num: f64 = parts[0].parse().ok()?;
        let den: f64 = parts[1].parse().ok()?;
        if den == 0.0 { return None; }
        return Some(num / den);
    }
    rate_str.parse().ok()
}

/// Detect log curves from ffprobe color transfer / primaries + filename
/// pattern + codec heuristics. We can't be 100% certain from container
/// metadata alone for every camera, so we layer signals and report
/// confidence + which signal fired.
pub fn detect_log_curve(
    file_name: &str,
    color_transfer: Option<&str>,
    color_primaries: Option<&str>,
    codec: Option<&str>,
) -> Option<LogCurveGuess> {
    let xfer = color_transfer.unwrap_or("").to_lowercase();
    let prim = color_primaries.unwrap_or("").to_lowercase();
    let name_lower = file_name.to_lowercase();
    let codec_lower = codec.unwrap_or("").to_lowercase();

    // Strongest signal: standard HDR transfer characteristics in container.
    if xfer == "arib-std-b67" || xfer == "bt2020-10" && xfer.contains("hlg") {
        return Some(LogCurveGuess {
            label: "HLG".to_string(),
            confidence: 0.95,
            source: "ffprobe_transfer".to_string(),
            suggested_cst_input_gamma: Some("ARRI Log C / HLG".to_string()),
            suggested_cst_input_gamut: Some("Rec.2020".to_string()),
        });
    }
    if xfer == "smpte2084" || xfer == "smpte-st-2084" {
        return Some(LogCurveGuess {
            label: "PQ (HDR10)".to_string(),
            confidence: 0.95,
            source: "ffprobe_transfer".to_string(),
            suggested_cst_input_gamma: Some("ST.2084".to_string()),
            suggested_cst_input_gamut: Some("Rec.2020".to_string()),
        });
    }

    // Filename + camera-specific patterns. Wedding workflow is mostly Canon
    // R5/R6/C70/C300 (C-Log 2/3), Sony FX3/FX6 (S-Log 3), Panasonic GH/S (V-Log).
    if name_lower.starts_with("mvi_") || name_lower.starts_with("mvi-") || name_lower.starts_with("clp") || name_lower.contains("canon") {
        // Canon. C-Log 2 is the most common log curve on R5/R6/C70 for cinema work.
        return Some(LogCurveGuess {
            label: "Canon C-Log 2 (guessed)".to_string(),
            confidence: 0.55,
            source: "filename".to_string(),
            suggested_cst_input_gamma: Some("Canon C-Log 2".to_string()),
            suggested_cst_input_gamut: Some("Canon Cinema Gamut".to_string()),
        });
    }
    if name_lower.starts_with("c0") && (codec_lower.contains("xavc") || codec_lower.contains("h264") || codec_lower.contains("h265") || name_lower.ends_with(".mp4")) {
        // Sony FX/A7 series — typically S-Log 3 on professional shoots.
        return Some(LogCurveGuess {
            label: "Sony S-Log 3 (guessed)".to_string(),
            confidence: 0.55,
            source: "filename".to_string(),
            suggested_cst_input_gamma: Some("Sony S-Log 3".to_string()),
            suggested_cst_input_gamut: Some("Sony S-Gamut3.Cine".to_string()),
        });
    }
    if name_lower.starts_with("p10") || name_lower.starts_with("p1010") {
        // Panasonic GH/S series — V-Log L (consumer) or V-Log (pro).
        return Some(LogCurveGuess {
            label: "Panasonic V-Log (guessed)".to_string(),
            confidence: 0.55,
            source: "filename".to_string(),
            suggested_cst_input_gamma: Some("Panasonic V-Log".to_string()),
            suggested_cst_input_gamut: Some("Panasonic V-Gamut".to_string()),
        });
    }
    if codec_lower == "prores" && (prim == "bt2020" || xfer == "bt2020-10" || xfer == "bt2020-12") {
        // ProRes + Rec.2020 = likely log master, can't say which without camera context
        return Some(LogCurveGuess {
            label: "Log master (ProRes wide gamut)".to_string(),
            confidence: 0.40,
            source: "codec_container".to_string(),
            suggested_cst_input_gamma: None,
            suggested_cst_input_gamut: Some("Rec.2020".to_string()),
        });
    }

    None
}

pub fn probe_file(ffprobe: &Path, path: &Path) -> MediaInfo {
    let path_str = path.display().to_string();
    let file_name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let mut info = MediaInfo {
        path: path_str.clone(),
        file_name: file_name.clone(),
        width: None,
        height: None,
        frame_rate: None,
        duration_seconds: None,
        codec: None,
        color_space: None,
        color_transfer: None,
        color_primaries: None,
        video_standard: "Other".to_string(),
        log_curve: None,
        error: None,
    };

    let output = Command::new(ffprobe)
        .args([
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate,codec_name,color_space,color_transfer,color_primaries:format=duration",
            "-of", "json",
        ])
        .arg(path)
        .output();

    let output = match output {
        Ok(o) => o,
        Err(e) => {
            info.error = Some(format!("ffprobe spawn failed: {}", e));
            return info;
        }
    };

    if !output.status.success() {
        info.error = Some(format!(
            "ffprobe exit {}: {}",
            output.status.code().unwrap_or(-1),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
        return info;
    }

    let parsed: serde_json::Value = match serde_json::from_slice(&output.stdout) {
        Ok(v) => v,
        Err(e) => {
            info.error = Some(format!("ffprobe JSON parse failed: {}", e));
            return info;
        }
    };

    let stream = parsed.get("streams").and_then(|s| s.as_array()).and_then(|a| a.first());
    if let Some(s) = stream {
        info.width = s.get("width").and_then(|v| v.as_u64()).map(|v| v as u32);
        info.height = s.get("height").and_then(|v| v.as_u64()).map(|v| v as u32);
        info.codec = s.get("codec_name").and_then(|v| v.as_str()).map(|s| s.to_string());
        info.color_space = s.get("color_space").and_then(|v| v.as_str()).map(|s| s.to_string());
        info.color_transfer = s.get("color_transfer").and_then(|v| v.as_str()).map(|s| s.to_string());
        info.color_primaries = s.get("color_primaries").and_then(|v| v.as_str()).map(|s| s.to_string());
        if let Some(rate_str) = s.get("r_frame_rate").and_then(|v| v.as_str()) {
            info.frame_rate = parse_frame_rate(rate_str);
        }
    }

    info.log_curve = detect_log_curve(
        &file_name,
        info.color_transfer.as_deref(),
        info.color_primaries.as_deref(),
        info.codec.as_deref(),
    );

    info.duration_seconds = parsed
        .get("format")
        .and_then(|f| f.get("duration"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok());

    if let Some(fps) = info.frame_rate {
        info.video_standard = classify(fps).to_string();
    }

    info
}

const PROBE_MAX_FILES: usize = 40; // cap to avoid blocking on hundreds-of-clips cards

pub fn probe_files(paths: &[String]) -> ProbeSummary {
    let ffprobe = match find_ffprobe() {
        Some(p) => p,
        None => {
            return ProbeSummary {
                files: vec![],
                total_files: paths.len(),
                probed_count: 0,
                error_count: 0,
                dominant_frame_rate: None,
                dominant_resolution: None,
                dominant_standard: None,
                dominant_log_curve: None,
                mixed_standards: false,
                mixed_log_curves: false,
                ffprobe_available: false,
            };
        }
    };

    let take = paths.len().min(PROBE_MAX_FILES);
    let mut results: Vec<MediaInfo> = Vec::with_capacity(take);
    for p in paths.iter().take(take) {
        results.push(probe_file(&ffprobe, Path::new(p)));
    }

    let probed_count = results.iter().filter(|r| r.error.is_none()).count();
    let error_count = results.len() - probed_count;

    // Dominant frame rate: round-to-2-decimals + mode
    let mut fr_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut res_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut std_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for r in &results {
        if let Some(fps) = r.frame_rate {
            let key = format!("{:.2}", fps);
            *fr_counts.entry(key).or_insert(0) += 1;
        }
        if let (Some(w), Some(h)) = (r.width, r.height) {
            *res_counts.entry(format!("{}x{}", w, h)).or_insert(0) += 1;
        }
        if r.error.is_none() {
            *std_counts.entry(r.video_standard.clone()).or_insert(0) += 1;
        }
    }
    let dominant_frame_rate = fr_counts.iter().max_by_key(|e| e.1)
        .and_then(|(k, _)| k.parse::<f64>().ok());
    let dominant_resolution = res_counts.iter().max_by_key(|e| e.1).map(|(k, _)| k.clone());
    let dominant_standard = std_counts.iter().max_by_key(|e| e.1).map(|(k, _)| k.clone());
    let mixed_standards = std_counts.len() > 1;

    // Aggregate dominant log curve (mode by label)
    let mut log_counts: std::collections::HashMap<String, (LogCurveGuess, usize)> =
        std::collections::HashMap::new();
    for r in &results {
        if let Some(curve) = &r.log_curve {
            log_counts
                .entry(curve.label.clone())
                .or_insert_with(|| (curve.clone(), 0))
                .1 += 1;
        }
    }
    let dominant_log_curve = log_counts
        .values()
        .max_by_key(|(_, n)| *n)
        .map(|(curve, _)| curve.clone());
    let mixed_log_curves = log_counts.len() > 1;

    ProbeSummary {
        files: results,
        total_files: paths.len(),
        probed_count,
        error_count,
        dominant_frame_rate,
        dominant_resolution,
        dominant_standard,
        dominant_log_curve,
        mixed_standards,
        mixed_log_curves,
        ffprobe_available: true,
    }
}

#[tauri::command]
pub async fn probe_media_files(paths: Vec<String>) -> Result<ProbeSummary, String> {
    // Run on a blocking thread since ffprobe spawns subprocesses
    let result = tokio::task::spawn_blocking(move || probe_files(&paths))
        .await
        .map_err(|e| format!("probe_media_files join failed: {}", e))?;
    Ok(result)
}

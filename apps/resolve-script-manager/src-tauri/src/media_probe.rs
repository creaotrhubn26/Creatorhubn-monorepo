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
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::SystemTime;

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
    /// ProRes profile variant (#116) — e.g. "Proxy" / "LT" / "422" / "422 HQ"
    /// / "4444" / "4444 XQ". None for non-ProRes codecs.
    pub prores_variant: Option<String>,
    /// HEVC profile + dynamic-range classification (#117) — e.g.
    /// "Main", "Main 10", "Main 12". None for non-HEVC codecs.
    pub hevc_profile: Option<String>,
    /// "SDR" | "HDR10" | "HLG" | None when not detectable
    pub dynamic_range: Option<String>,
    /// Bit depth if known: 8 / 10 / 12.
    pub bit_depth: Option<u32>,
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

/// (#115) Cache key = (path, mtime nanos, size). Same path with new content
/// (different mtime/size) invalidates automatically. SHA256 would be more
/// correct but too expensive — mtime+size catches 99% of edits.
#[derive(Eq, PartialEq, Hash, Clone)]
struct CacheKey {
    path: String,
    mtime_ns: u128,
    size: u64,
}

static PROBE_CACHE: OnceLock<Mutex<HashMap<CacheKey, MediaInfo>>> = OnceLock::new();

fn probe_cache() -> &'static Mutex<HashMap<CacheKey, MediaInfo>> {
    PROBE_CACHE.get_or_init(|| Mutex::new(HashMap::with_capacity(256)))
}

fn cache_key_for(path: &Path) -> Option<CacheKey> {
    let meta = path.metadata().ok()?;
    let mtime = meta.modified().ok()?;
    let mtime_ns = mtime
        .duration_since(SystemTime::UNIX_EPOCH)
        .ok()?
        .as_nanos();
    Some(CacheKey {
        path: path.display().to_string(),
        mtime_ns,
        size: meta.len(),
    })
}

pub fn probe_file(ffprobe: &Path, path: &Path) -> MediaInfo {
    let path_str = path.display().to_string();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();

    // (#115) Cache hit? Returns immediately without spawning ffprobe.
    let key = cache_key_for(path);
    if let Some(k) = &key {
        if let Ok(cache) = probe_cache().lock() {
            if let Some(hit) = cache.get(k) {
                return hit.clone();
            }
        }
    }

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
        prores_variant: None,
        hevc_profile: None,
        dynamic_range: None,
        bit_depth: None,
        error: None,
    };

    let output = Command::new(ffprobe)
        .args([
            "-v", "error",
            "-select_streams", "v:0",
            // Add profile + codec_tag_string + pix_fmt for ProRes/HEVC classification
            "-show_entries", "stream=width,height,r_frame_rate,codec_name,profile,codec_tag_string,pix_fmt,bits_per_raw_sample,color_space,color_transfer,color_primaries:format=duration",
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
    let mut profile_str: Option<String> = None;
    let mut codec_tag: Option<String> = None;
    let mut pix_fmt: Option<String> = None;
    let mut bits_per_raw: Option<u32> = None;
    if let Some(s) = stream {
        info.width = s.get("width").and_then(|v| v.as_u64()).map(|v| v as u32);
        info.height = s.get("height").and_then(|v| v.as_u64()).map(|v| v as u32);
        info.codec = s.get("codec_name").and_then(|v| v.as_str()).map(|s| s.to_string());
        info.color_space = s.get("color_space").and_then(|v| v.as_str()).map(|s| s.to_string());
        info.color_transfer = s.get("color_transfer").and_then(|v| v.as_str()).map(|s| s.to_string());
        info.color_primaries = s.get("color_primaries").and_then(|v| v.as_str()).map(|s| s.to_string());
        profile_str = s.get("profile").and_then(|v| v.as_str()).map(|s| s.to_string());
        codec_tag = s.get("codec_tag_string").and_then(|v| v.as_str()).map(|s| s.to_string());
        pix_fmt = s.get("pix_fmt").and_then(|v| v.as_str()).map(|s| s.to_string());
        bits_per_raw = s
            .get("bits_per_raw_sample")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok());
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

    // #116 — ProRes profile classification via codec_tag_string (preferred)
    // or profile field. Both are populated by ffprobe; codec_tag_string is
    // the FourCC and unambiguous.
    if info.codec.as_deref() == Some("prores") {
        info.prores_variant = classify_prores(codec_tag.as_deref(), profile_str.as_deref());
    }

    // #117 — HEVC profile + dynamic-range classification
    if matches!(info.codec.as_deref(), Some("hevc") | Some("h265")) {
        info.hevc_profile = profile_str.clone();
        info.bit_depth = bits_per_raw.or_else(|| infer_bit_depth_from_pix_fmt(pix_fmt.as_deref()));
        info.dynamic_range = Some(classify_dynamic_range(info.color_transfer.as_deref()));
    } else {
        info.bit_depth = bits_per_raw.or_else(|| infer_bit_depth_from_pix_fmt(pix_fmt.as_deref()));
        // SDR/HDR applies to non-HEVC too; set if transfer characteristic is unambiguous
        let dr = classify_dynamic_range(info.color_transfer.as_deref());
        if dr != "SDR" || info.color_transfer.is_some() {
            info.dynamic_range = Some(dr);
        }
    }

    info.duration_seconds = parsed
        .get("format")
        .and_then(|f| f.get("duration"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse().ok());

    if let Some(fps) = info.frame_rate {
        info.video_standard = classify(fps).to_string();
    }

    // (#115) Cache the probed result
    if let Some(k) = key {
        if let Ok(mut cache) = probe_cache().lock() {
            cache.insert(k, info.clone());
        }
    }

    info
}

/// (#116) Classify ProRes variant from codec_tag_string (preferred) or profile.
/// ProRes FourCC mapping is standardized:
///   apco = Proxy   apcs = LT   apcn = 422   apch = 422 HQ
///   ap4h = 4444    ap4x = 4444 XQ
fn classify_prores(codec_tag: Option<&str>, profile: Option<&str>) -> Option<String> {
    if let Some(tag) = codec_tag {
        let v = match tag {
            "apco" => "Proxy",
            "apcs" => "LT",
            "apcn" => "422",
            "apch" => "422 HQ",
            "ap4h" => "4444",
            "ap4x" => "4444 XQ",
            _ => "",
        };
        if !v.is_empty() {
            return Some(v.to_string());
        }
    }
    // Fall back to ffprobe's profile string ("Standard", "HQ", "4444", etc.)
    profile.map(|s| s.to_string())
}

/// (#117) Map ffprobe color_transfer to dynamic range bucket.
fn classify_dynamic_range(color_transfer: Option<&str>) -> String {
    match color_transfer.unwrap_or("").to_lowercase().as_str() {
        "smpte2084" | "smpte-st-2084" => "HDR10".to_string(),
        "arib-std-b67" => "HLG".to_string(),
        _ => "SDR".to_string(),
    }
}

/// Map pix_fmt to bit depth. yuv420p10le / yuv422p10le → 10; yuv420p → 8.
fn infer_bit_depth_from_pix_fmt(pix_fmt: Option<&str>) -> Option<u32> {
    let f = pix_fmt?.to_lowercase();
    if f.contains("p16") {
        Some(16)
    } else if f.contains("p12") {
        Some(12)
    } else if f.contains("p10") {
        Some(10)
    } else if f.contains("p8") || f.starts_with("yuv420p") || f.starts_with("yuv422p") || f.starts_with("yuv444p") {
        Some(8)
    } else {
        None
    }
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

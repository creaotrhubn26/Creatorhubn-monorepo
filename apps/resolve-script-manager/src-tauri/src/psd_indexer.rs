//! PSD-indekserer: skanner en mappe for `.psd`/`.psb`-filer og
//! returnerer metadata (dimensjoner, layer-tre, embedded thumbnail).
//!
//! Lar Post Agent vise et thumbnail-galleri over Photoshop-assets
//! UTEN å åpne Photoshop — alt er ren Rust-parsing av PSD-binær-
//! formatet via `psd`-crate. Brukes som inngang til template-
//! velgere, asset-bibliotek og BTS-stills-katalog.

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use image::{ImageBuffer, Rgba};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

const THUMB_MAX: u32 = 320;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LayerInfo {
    pub name: String,
    pub visible: bool,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PsdEntry {
    pub path: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub layer_count: usize,
    pub layers: Vec<LayerInfo>,
    /// PNG-thumbnail base64-encoded; `None` hvis flatten feilet (komplekse
    /// smart objects, manglende fonter, etc.).
    pub thumbnail_b64: Option<String>,
    /// Hvis parsing/thumbnail feilet, beskrives det her — entry vises
    /// fortsatt i galleriet med graceful fallback.
    pub error: Option<String>,
}

/// Skann en mappe for PSD-filer. `max_depth` på 1 = bare denne mappa;
/// høyere tall = sub-mapper.
pub fn index_directory(dir: &Path, max_depth: usize) -> Vec<PsdEntry> {
    if !dir.is_dir() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for entry in WalkDir::new(dir)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_ascii_lowercase());
        if !matches!(ext.as_deref(), Some("psd") | Some("psb")) {
            continue;
        }
        out.push(parse_one(path));
    }
    out
}

/// Parse én enkelt PSD-fil til en `PsdEntry`. Returnerer alltid en
/// entry — feil registreres i `error`-feltet istedenfor å bli kastet.
pub fn parse_one(path: &Path) -> PsdEntry {
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    let path_str = path.display().to_string();
    let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(err) => {
            return PsdEntry {
                path: path_str,
                name,
                width: 0,
                height: 0,
                file_size,
                layer_count: 0,
                layers: Vec::new(),
                thumbnail_b64: None,
                error: Some(format!("read: {}", err)),
            };
        }
    };

    let psd = match psd::Psd::from_bytes(&bytes) {
        Ok(p) => p,
        Err(err) => {
            return PsdEntry {
                path: path_str,
                name,
                width: 0,
                height: 0,
                file_size,
                layer_count: 0,
                layers: Vec::new(),
                thumbnail_b64: None,
                error: Some(format!("parse: {}", err)),
            };
        }
    };

    let width = psd.width();
    let height = psd.height();

    let layers: Vec<LayerInfo> = psd
        .layers()
        .iter()
        .map(|layer| LayerInfo {
            name: layer.name().to_string(),
            visible: layer.visible(),
            width: layer.width() as u32,
            height: layer.height() as u32,
        })
        .collect();

    // Thumbnail-generering. `flatten_layers_rgba` kan feile på filer med
    // smart objects eller adjustment layers vi ikke håndterer ennå — det
    // er greit, vi viser entryen uten thumbnail.
    let (thumbnail_b64, thumb_error) = match std::panic::catch_unwind(|| psd.rgba()) {
        Ok(rgba) => match rgba_to_png_b64(&rgba, width, height) {
            Ok(b64) => (Some(b64), None),
            Err(err) => (None, Some(format!("thumb: {}", err))),
        },
        Err(_) => (None, Some("thumb: panic in psd::rgba".to_string())),
    };

    PsdEntry {
        path: path_str,
        name,
        width,
        height,
        file_size,
        layer_count: layers.len(),
        layers,
        thumbnail_b64,
        error: thumb_error,
    }
}

fn rgba_to_png_b64(rgba: &[u8], width: u32, height: u32) -> Result<String, String> {
    let expected = (width as usize) * (height as usize) * 4;
    if rgba.len() != expected {
        return Err(format!(
            "rgba len {} ≠ width*height*4 = {}",
            rgba.len(),
            expected
        ));
    }
    let img: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_raw(width, height, rgba.to_vec())
            .ok_or_else(|| "from_raw returned None".to_string())?;
    // Skaler ned bevarende aspect ratio så thumbnail er ~THUMB_MAX på lengste side.
    let thumb = if width > THUMB_MAX || height > THUMB_MAX {
        let (tw, th) = scaled_size(width, height, THUMB_MAX);
        image::imageops::thumbnail(&img, tw, th)
    } else {
        img
    };
    let mut buf = Vec::new();
    thumb
        .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| format!("encode png: {}", e))?;
    Ok(B64.encode(&buf))
}

fn scaled_size(w: u32, h: u32, max: u32) -> (u32, u32) {
    if w >= h {
        let th = ((h as f32) * (max as f32) / (w as f32)).round() as u32;
        (max, th.max(1))
    } else {
        let tw = ((w as f32) * (max as f32) / (h as f32)).round() as u32;
        (tw.max(1), max)
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn psd_index_directory(
    dir: String,
    max_depth: Option<usize>,
) -> Result<Vec<PsdEntry>, String> {
    let path = PathBuf::from(dir);
    if !path.is_dir() {
        return Err(format!("{} er ikke en mappe", path.display()));
    }
    let depth = max_depth.unwrap_or(1).max(1);
    // Kjør parsing i blocking-pool så vi ikke holder runtime-tråden okkupert
    // — store filer kan ta ett par sekunder å lese + flate.
    let entries = tokio::task::spawn_blocking(move || index_directory(&path, depth))
        .await
        .map_err(|e| format!("join: {}", e))?;
    Ok(entries)
}

#[tauri::command]
pub async fn psd_get_info(path: String) -> Result<PsdEntry, String> {
    let p = PathBuf::from(path);
    if !p.is_file() {
        return Err(format!("{} er ikke en fil", p.display()));
    }
    let entry = tokio::task::spawn_blocking(move || parse_one(&p))
        .await
        .map_err(|e| format!("join: {}", e))?;
    Ok(entry)
}

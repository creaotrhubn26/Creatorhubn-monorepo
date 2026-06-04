//! demo_capture — automatisk «klikk-gjennom»-capture for Product Demo Studio.
//!
//! Åpner et eget WebviewWindow på den EKTE målsiden (ikke en iframe → ikke
//! underlagt X-Frame-Options/CSP frame-ancestors, så det funker også på SPA-er
//! som blokkerer innbygging). Et initialization_script (capture/demo_capture_inject.js)
//! viser en verktøylinje og sender hvert klikk som et «steg» via IPC til
//! kommandoene under, som videresender til hovedvinduet som events:
//!
//!   demo-capture://step   (payload = steg-objekt)
//!   demo-capture://done   (payload = cancelled: bool)
//!
//! Frontend (demoCaptureService) lytter på disse og bygger scener med hotspot.

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const CAPTURE_JS: &str = include_str!("../capture/demo_capture_inject.js");
const CAPTURE_LABEL: &str = "demo-capture";

/// Åpne capture-vinduet på `url`. Lukker et eventuelt eksisterende capture-vindu
/// først, så vi aldri har to gående.
#[tauri::command]
pub async fn start_demo_capture(app: AppHandle, url: String) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(CAPTURE_LABEL) {
        let _ = existing.close();
    }
    let parsed: tauri::Url = url
        .parse()
        .map_err(|e| format!("ugyldig URL «{url}»: {e}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("URL må være http(s)".to_string());
    }

    WebviewWindowBuilder::new(&app, CAPTURE_LABEL, WebviewUrl::External(parsed))
        .title("Demo Capture — klikk deg gjennom siden")
        .inner_size(1240.0, 840.0)
        .initialization_script(CAPTURE_JS)
        .build()
        .map_err(|e| format!("kunne ikke åpne capture-vindu: {e}"))?;
    Ok(())
}

/// Mottar ett klikk-steg fra capture-vinduet og videresender til hovedvinduet.
#[tauri::command]
pub fn demo_capture_step(app: AppHandle, step: serde_json::Value) -> Result<(), String> {
    app.emit("demo-capture://step", step)
        .map_err(|e| e.to_string())
}

/// Avslutter capture: lukker vinduet og varsler hovedvinduet (cancelled-flagg
/// styrer om frontend forkaster eller beholder de innsamlede stegene).
#[tauri::command]
pub fn demo_capture_done(app: AppHandle, cancelled: bool) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(CAPTURE_LABEL) {
        let _ = w.close();
    }
    app.emit("demo-capture://done", cancelled)
        .map_err(|e| e.to_string())
}

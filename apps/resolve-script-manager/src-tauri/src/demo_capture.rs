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

/// Hent EKTE side-kontekst via reqwest (ingen CORS). Trekker ut tittel +
/// meta-description + klikkbare element-labels (knapper/lenker) + synlig tekst,
/// så AI Director kan skrive scener basert på hva siden faktisk er/inneholder.
#[tauri::command]
pub async fn demo_fetch_site_context(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15")
        .build()
        .map_err(|e| e.to_string())?;
    let res = client.get(&url).send().await.map_err(|e| format!("kunne ikke hente siden: {e}"))?;
    let html = res.text().await.map_err(|e| format!("kunne ikke lese siden: {e}"))?;
    Ok(extract_site_context(&html))
}

fn extract_site_context(html: &str) -> String {
    use regex::Regex;
    let title = Regex::new(r"(?is)<title[^>]*>([^<]+)</title>")
        .ok()
        .and_then(|re| re.captures(html).and_then(|c| c.get(1)).map(|m| m.as_str().trim().to_string()));
    let desc = Regex::new(r#"(?is)<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']"#)
        .ok()
        .and_then(|re| re.captures(html).and_then(|c| c.get(1)).map(|m| m.as_str().trim().to_string()));

    // Klikkbare element-labels (knapp/lenke-tekst) — gir AI ekte targets.
    let mut labels: Vec<String> = Vec::new();
    if let Ok(re) = Regex::new(r"(?is)<(?:a|button)[^>]*>(.*?)</(?:a|button)>") {
        for cap in re.captures_iter(html).take(40) {
            if let Some(m) = cap.get(1) {
                let txt = strip_tags(m.as_str());
                let txt = txt.split_whitespace().collect::<Vec<_>>().join(" ");
                if txt.len() >= 2 && txt.len() <= 40 && !labels.contains(&txt) {
                    labels.push(txt);
                }
            }
        }
    }

    // Synlig tekst (script/style fjernet, tags strippet).
    let no_blocks = Regex::new(r"(?is)<(script|style)[^>]*>.*?</(?:script|style)>")
        .map(|re| re.replace_all(html, " ").to_string())
        .unwrap_or_else(|_| html.to_string());
    let text = strip_tags(&no_blocks);
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let text: String = text.chars().take(1600).collect();

    let mut parts: Vec<String> = Vec::new();
    if let Some(t) = title { if !t.is_empty() { parts.push(format!("Tittel: {t}")); } }
    if let Some(d) = desc { if !d.is_empty() { parts.push(format!("Beskrivelse: {d}")); } }
    if !labels.is_empty() { parts.push(format!("Klikkbare elementer: {}", labels.join(" · "))); }
    if !text.trim().is_empty() { parts.push(format!("Innhold: {text}")); }
    parts.join("\n")
}

fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut depth = 0i32;
    for c in s.chars() {
        match c {
            '<' => depth += 1,
            '>' => { if depth > 0 { depth -= 1; } }
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    out
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

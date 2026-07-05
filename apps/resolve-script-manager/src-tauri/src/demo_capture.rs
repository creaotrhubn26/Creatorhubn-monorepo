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
const SCAN_JS: &str = include_str!("../capture/demo_scan_inject.js");
const H2C_JS: &str = include_str!("../capture/html2canvas.min.js");
const SHOT_JS: &str = include_str!("../capture/demo_shot_inject.js");
const SESSION_JS: &str = include_str!("../capture/demo_session_inject.js");
const PII_JS: &str = include_str!("../capture/demo_pii_inject.js");
const CAPTURE_LABEL: &str = "demo-capture";
const SCAN_LABEL: &str = "demo-scan";
const SHOT_LABEL: &str = "demo-shot";
const SESSION_LABEL: &str = "demo-session";

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

/// Åpne et lite analyse-vindu på `url`, la skann-scriptet katalogisere de ekte
/// interaktive elementene, og motta resultatet via demo_scan_result. Vinduet
/// lukker seg selv når skannet er ferdig.
#[tauri::command]
pub async fn demo_scan_dom(app: AppHandle, url: String) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(SCAN_LABEL) {
        let _ = existing.close();
    }
    let parsed: tauri::Url = url.parse().map_err(|e| format!("ugyldig URL «{url}»: {e}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("URL må være http(s)".to_string());
    }
    WebviewWindowBuilder::new(&app, SCAN_LABEL, WebviewUrl::External(parsed))
        .title("Analyserer side…")
        .inner_size(1200.0, 820.0)
        // html2canvas FØR scan-scriptet → scannen kan ta viewport-screenshots
        // ved hvert scroll-bånd (brukes til presis preview-render, Fase 1b).
        // PII-sladderen maskerer skjemafelt + e-post/telefon under skuddene.
        .initialization_script(H2C_JS)
        .initialization_script(PII_JS)
        .initialization_script(SCAN_JS)
        .build()
        .map_err(|e| format!("kunne ikke åpne analyse-vindu: {e}"))?;
    Ok(())
}

/// Mottar element-katalogen fra skann-vinduet, videresender til hovedvinduet og
/// lukker analyse-vinduet.
#[tauri::command]
pub fn demo_scan_result(app: AppHandle, result: serde_json::Value) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(SCAN_LABEL) {
        let _ = w.close();
    }
    app.emit("demo-capture://dom", result).map_err(|e| e.to_string())
}

/// Fremdrift fra skann-vinduet (stabilitet/scroll-steg/screenshots) → frontend
/// holder timeout-en levende så lenge skannet faktisk jobber (G10).
#[tauri::command]
pub fn demo_scan_progress(app: AppHandle, progress: serde_json::Value) -> Result<(), String> {
    app.emit("demo-capture://scan-progress", progress)
        .map_err(|e| e.to_string())
}

/// Avbryt et pågående skann (frontend ga opp): lukk vinduet så det ikke blir
/// stående og jobbe synlig etter timeout (G10).
#[tauri::command]
pub fn demo_scan_cancel(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(SCAN_LABEL) {
        let _ = w.close();
    }
    Ok(())
}

// (Legacy ett-skudds verify-/auto-vinduer er fjernet — den vedvarende
// demo-økten (demo_session_*) dekker begge med side-tilstand intakt, ekte
// utfalls-rapportering og multi-locator-oppslag.)

/// Ta et skjermbilde av siden (html2canvas i et eget vindu). Resultatet (JPEG
/// data-URL) sendes via demo_shot_result. Brukes til scene-thumbnails + vision.
#[tauri::command]
pub async fn demo_screenshot(app: AppHandle, url: String) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(SHOT_LABEL) {
        let _ = existing.close();
    }
    let parsed: tauri::Url = url.parse().map_err(|e| format!("ugyldig URL «{url}»: {e}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("URL må være http(s)".to_string());
    }
    WebviewWindowBuilder::new(&app, SHOT_LABEL, WebviewUrl::External(parsed))
        .title("Tar skjermbilde…")
        .inner_size(1280.0, 800.0)
        .initialization_script(H2C_JS)
        .initialization_script(PII_JS)
        .initialization_script(SHOT_JS)
        .build()
        .map_err(|e| format!("kunne ikke åpne skjermbilde-vindu: {e}"))?;
    Ok(())
}

/// Mottar skjermbildet (data-URL), videresender til hovedvinduet og lukker vinduet.
#[tauri::command]
pub fn demo_shot_result(app: AppHandle, result: serde_json::Value) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(SHOT_LABEL) {
        let _ = w.close();
    }
    app.emit("demo-capture://shot", result).map_err(|e| e.to_string())
}

// ── Vedvarende demo-økt (G4): ETT vindu gjennom hele auto-kjøringen ──
//
// I motsetning til verify/auto/shot-vinduene over (nytt vindu på base-URL per
// kall → all side-tilstand tapes, innloggede produkter umulige) lever økt-
// vinduet på tvers av steg: navigasjon fra steg 1 består når steg 2 kjører,
// og brukeren kan logge inn i vinduet før/underveis. Kommandoene under kaller
// funksjoner definert av demo_session_inject.js via eval(); resultatene kommer
// tilbake gjennom demo_session_report — som IKKE lukker vinduet.

fn session_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(SESSION_LABEL)
        .ok_or_else(|| "Demo-økten er ikke åpen — kall demo_session_open først".to_string())
}

/// Åpne (eller gjenbruk) det vedvarende økt-vinduet. Returnerer "created" hvis
/// et nytt vindu ble laget (frontend bør da vente på nav-eventet), "reused"
/// hvis et eksisterende vindu ble gjenbrukt uten navigasjon, eller "navigated"
/// hvis `navigate=true` tvang eksisterende vindu til `url`.
#[tauri::command]
pub async fn demo_session_open(app: AppHandle, url: String, navigate: Option<bool>) -> Result<String, String> {
    let parsed: tauri::Url = url.parse().map_err(|e| format!("ugyldig URL «{url}»: {e}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("URL må være http(s)".to_string());
    }
    if let Some(w) = app.get_webview_window(SESSION_LABEL) {
        let _ = w.set_focus();
        if navigate.unwrap_or(false) {
            let url_json = serde_json::to_string(&url).unwrap_or_else(|_| "\"\"".to_string());
            w.eval(&format!("window.location.href = {url_json};"))
                .map_err(|e| format!("kunne ikke navigere økt-vinduet: {e}"))?;
            return Ok("navigated".to_string());
        }
        return Ok("reused".to_string());
    }
    WebviewWindowBuilder::new(&app, SESSION_LABEL, WebviewUrl::External(parsed))
        .title("Demo-økt — stegene kjører i dette vinduet")
        .inner_size(1240.0, 840.0)
        .initialization_script(H2C_JS)
        .initialization_script(PII_JS)
        .initialization_script(SESSION_JS)
        .build()
        .map_err(|e| format!("kunne ikke åpne økt-vindu: {e}"))?;
    Ok("created".to_string())
}

/// Utfør en handling i økt-vinduet (på siden slik den ER nå — ikke en fersk
/// last). `locators` er scenens multi-strategi-locators (id/testid/aria/text/
/// css); scriptet prøver dem i prioritert rekkefølge før `selector`-fallback.
#[tauri::command]
pub async fn demo_session_exec(
    app: AppHandle,
    selector: String,
    action_type: String,
    text: Option<String>,
    locators: Option<serde_json::Value>,
    settle_ms: Option<u32>,
) -> Result<(), String> {
    let w = session_window(&app)?;
    let cfg = serde_json::json!({
        "selector": selector,
        "actionType": action_type,
        "text": text,
        "locators": locators,
        "settleMs": settle_ms,
    });
    let cfg_json = serde_json::to_string(&cfg).unwrap_or_else(|_| "{}".to_string());
    w.eval(&format!("window.__demoSessionRun && window.__demoSessionRun({cfg_json});"))
        .map_err(|e| format!("kunne ikke kjøre steg i økt-vinduet: {e}"))
}

/// Arm ett-skudds verifisering i økt-vinduet: brukeren klikker elementet,
/// selector+label kommer via demo_session_report(kind="verify").
#[tauri::command]
pub async fn demo_session_verify(app: AppHandle, expected_label: Option<String>) -> Result<(), String> {
    let w = session_window(&app)?;
    let label_json = serde_json::to_string(&expected_label.unwrap_or_default()).unwrap_or_else(|_| "\"\"".to_string());
    w.eval(&format!("window.__demoSessionVerify && window.__demoSessionVerify({label_json});"))
        .map_err(|e| format!("kunne ikke arme verify i økt-vinduet: {e}"))
}

/// Ta skjermbilde av øktens NÅVÆRENDE tilstand (etter handlinger — i motsetning
/// til demo_screenshot som laster siden på nytt og dermed viser urørt tilstand).
#[tauri::command]
pub async fn demo_session_shot(app: AppHandle) -> Result<(), String> {
    let w = session_window(&app)?;
    w.eval("window.__demoSessionShot && window.__demoSessionShot();")
        .map_err(|e| format!("kunne ikke ta økt-skjermbilde: {e}"))
}

/// Lukk økt-vinduet (om det finnes).
#[tauri::command]
pub async fn demo_session_close(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(SESSION_LABEL) {
        let _ = w.close();
    }
    Ok(())
}

/// Mottar resultater fra økt-vinduet og videresender til hovedvinduet UTEN å
/// lukke økten. Gjenbruker de eksisterende event-navnene for auto/verify/shot
/// så frontend-lytterne er felles med engangs-vinduene.
#[tauri::command]
pub fn demo_session_report(app: AppHandle, kind: String, result: serde_json::Value) -> Result<(), String> {
    let event = match kind.as_str() {
        "auto" => "demo-capture://auto",
        "verify" => "demo-capture://verify",
        "shot" => "demo-capture://shot",
        "nav" => "demo-capture://session-nav",
        other => return Err(format!("ukjent session-report-kind «{other}»")),
    };
    app.emit(event, result).map_err(|e| e.to_string())
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

/// Hent en live datakilde (JSON/CSV/tekst) via reqwest — ingen CORS-begrensning,
/// slik at Infographic Studio kan binde felt til ekte, oppdaterbare tall fra et
/// API eller en publisert Google Sheet. Returnerer rå tekst (maks ~512 K tegn) +
/// et `truncated`-flagg så klienten kan VARSLE ved avkutting (før: stille kutt →
/// avkuttet JSON falt til CSV-fallback = søppel, uten at brukeren fikk vite det).
#[derive(serde::Serialize)]
pub struct LiveData {
    pub text: String,
    pub truncated: bool,
}

#[tauri::command]
pub async fn fetch_live_data(url: String) -> Result<LiveData, String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("URL må starte med http:// eller https://".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .user_agent("PostAgent-Infographic/1.0")
        .build()
        .map_err(|e| e.to_string())?;
    let res = client.get(&url).send().await.map_err(|e| format!("kunne ikke hente datakilden: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("datakilden svarte {}", res.status().as_u16()));
    }
    let text = res.text().await.map_err(|e| format!("kunne ikke lese datakilden: {e}"))?;
    let max = 512 * 1024;
    if text.chars().count() > max {
        Ok(LiveData { text: text.chars().take(max).collect(), truncated: true })
    } else {
        Ok(LiveData { text, truncated: false })
    }
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

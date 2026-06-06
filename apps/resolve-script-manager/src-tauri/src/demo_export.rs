//! demo_export — leveranse-filer for Product Demo Studio som ikke går gjennom
//! video-render-pipelinen: SRT-undertekster, manus-PDF og thumbnail.
//!
//! Frontend bygger innholdet (SRT-tekst, manus-HTML, PNG-dataURL) og kaller
//! disse for å skrive til en bruker-valgt sti (fra save-dialogen), eller for å
//! åpne et print-vindu der manus kan lagres som PDF via OS-ens «Save as PDF».

use base64::Engine;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Skriv ren tekst (f.eks. .srt) til `path`. Path kommer fra save-dialogen.
#[tauri::command]
pub fn demo_write_text(path: String, contents: String) -> Result<String, String> {
    std::fs::write(&path, contents).map_err(|e| format!("kunne ikke skrive fil: {e}"))?;
    Ok(path)
}

/// Skriv binærfil (f.eks. PNG) fra base64 til `path`.
#[tauri::command]
pub fn demo_write_binary(path: String, base64_data: String) -> Result<String, String> {
    // Tål «data:image/png;base64,XXXX» ved å strippe alt før komma.
    let raw = base64_data.rsplit(',').next().unwrap_or(&base64_data);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw.as_bytes())
        .map_err(|e| format!("ugyldig base64: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("kunne ikke skrive fil: {e}"))?;
    Ok(path)
}

/// Åpne manus-HTML i et eget vindu og trigg utskrift, så brukeren kan velge
/// «Lagre som PDF». HTML lastes som data-URL (ingen temp-fil, ingen file://).
#[tauri::command]
pub async fn demo_print_html(app: AppHandle, html: String) -> Result<(), String> {
    let b64 = base64::engine::general_purpose::STANDARD.encode(html.as_bytes());
    let url = format!("data:text/html;base64,{b64}");
    let parsed: tauri::Url = url.parse().map_err(|e| format!("ugyldig HTML-URL: {e}"))?;
    if let Some(w) = app.get_webview_window("demo-print") {
        let _ = w.close();
    }
    WebviewWindowBuilder::new(&app, "demo-print", WebviewUrl::External(parsed))
        .title("Manus — skriv ut / lagre som PDF")
        .inner_size(820.0, 1040.0)
        .initialization_script(
            "window.addEventListener('load',function(){setTimeout(function(){try{window.print();}catch(e){}},400);});",
        )
        .build()
        .map_err(|e| format!("kunne ikke åpne print-vindu: {e}"))?;
    Ok(())
}

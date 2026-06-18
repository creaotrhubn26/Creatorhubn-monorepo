//! product_brain — les en produkt-PDF (one-pager) til ren tekst, så AI Director
//! forstår produktet dypt utover det som står på nettsiden. On-device via
//! pdf-extract (ingen API/nett).

/// Trekk ut tekst fra en PDF-fil. Returnerer normalisert tekst (whitespace
/// kollapset), kappet til ~20k tegn så vi ikke sprenger AI-konteksten.
#[tauri::command]
pub async fn extract_pdf_text(path: String) -> Result<String, String> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err("Fil finnes ikke".into());
    }
    let text = pdf_extract::extract_text(&p).map_err(|e| format!("Kunne ikke lese PDF: {e}"))?;
    let normalized: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.trim().is_empty() {
        return Err("Fant ingen tekst i PDF-en (bildebasert/skannet?). Prøv en tekst-basert PDF.".into());
    }
    Ok(normalized.chars().take(20_000).collect())
}

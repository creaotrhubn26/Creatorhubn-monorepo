//! Helper-token-klient mot CreatorHub-backend.
//!
//! Lagrer prosjekt-scoped helper-token i `~/.creatorhub-one-desk/config.json`
//! med 0600-permissions (mirror av `tools/dit-helper`-mønsteret). All
//! kommunikasjon med backend bruker `Authorization: Bearer <token>`.
//!
//! F1: kun `get_project_info` mot `/api/dit/projects/:id/info`. F2+ legger
//! til mount-deteksjon og copy-jobs.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const DEFAULT_API_BASE: &str = "https://creatorhubn.com";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub api_base: String,
    pub token: String,
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub project: ProjectSummary,
    pub memory_card_configs: serde_json::Value,
    pub selected_memory_cards: serde_json::Value,
    pub destinations: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
}

/// Hvor config-fila ligger. Faller tilbake til `./.creatorhub-one-desk` hvis
/// `home_dir()` av en eller annen grunn ikke kan løses (svært usannsynlig på Mac).
pub fn config_dir() -> PathBuf {
    dirs::home_dir()
        .map(|h| h.join(".creatorhub-one-desk"))
        .unwrap_or_else(|| PathBuf::from(".creatorhub-one-desk"))
}

/// Sørg for at config-mappa eksisterer. Brukes av modulene som
/// skriver filer hit (projects.rs, device_auth.rs).
pub fn ensure_config_dir() -> Result<(), String> {
    let dir = config_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Create config dir: {}", e))
}

/// Legacy single-project config path. Beholdt for migration —
/// projects.rs leser denne ved første kall hvis projects.json ikke
/// finnes ennå.
pub fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

/// Returnerer den aktive prosjekt-config-en. Delegerer til projects-
/// modulen som håndterer multi-project + migration fra gammel
/// config.json. Eksisterende callers (copy_session, capture_mirror,
/// ipad_pairing) ser samme API som før.
pub fn load_config() -> Result<Option<Config>, String> {
    crate::projects::load_active_disk()
}

/// Lagrer config-en som ny eller oppdatert prosjekt-entry i
/// projects.json. Setter den også som aktiv.
pub fn save_config(cfg: &Config) -> Result<(), String> {
    crate::projects::save_active_disk(cfg, None)
}

/// Sletter ALLE prosjekter (multi-store) + legacy config.json. Brukes
/// fra logout-flow når Fredrik vil starte forfra.
pub fn clear_config() -> Result<(), String> {
    crate::projects::clear_all_disk()
}

pub fn default_api_base() -> &'static str {
    DEFAULT_API_BASE
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSessionSummary {
    pub id: String,
    pub name: String,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub status: String,
    pub owner_user_id: String,
    pub is_active: bool,
}

pub async fn list_capture_sessions(cfg: &Config) -> Result<Vec<CaptureSessionSummary>, String> {
    let base = cfg.api_base.trim_end_matches('/');
    let url = format!(
        "{}/api/dit/projects/{}/capture-sessions",
        base,
        urlencoding::encode(&cfg.project_id)
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", cfg.token))
        .header("User-Agent", concat!("creatorhub-one-desk/", env!("CARGO_PKG_VERSION")))
        .send()
        .await
        .map_err(|e| format!("Backend-request feilet: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet = body.chars().take(300).collect::<String>();
        return Err(format!("Backend svarte {}: {}", status.as_u16(), snippet));
    }

    let raw: serde_json::Value = resp.json().await.map_err(|e| format!("Parse-feil: {}", e))?;
    if raw.get("success").and_then(|v| v.as_bool()) != Some(true) {
        let err = raw.get("error").and_then(|v| v.as_str()).unwrap_or("Ukjent feil");
        return Err(err.to_string());
    }
    let sessions = raw
        .get("sessions")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let out: Vec<CaptureSessionSummary> = sessions
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect();
    Ok(out)
}

/// Henter destinasjoner med dekrypterte cloud-creds. Kalles ved
/// backup-start når vi vet at det finnes cloud-destinasjoner (eller
/// alltid — endepunktet returnerer null creds for lokale dests).
///
/// Sikkerhets-kontrakt: returnert JSON inneholder
/// `cloud_credentials: { key_id, application_key }` for cloud-dests.
/// Disse må ALDRI lagres på disk — kun in-memory til start_copy_session
/// er ferdig.
pub async fn get_destinations_with_creds(cfg: &Config) -> Result<serde_json::Value, String> {
    let base = cfg.api_base.trim_end_matches('/');
    let url = format!(
        "{}/api/dit/projects/{}/destinations/with-creds",
        base,
        urlencoding::encode(&cfg.project_id),
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", cfg.token))
        .header("User-Agent", concat!("creatorhub-one-desk/", env!("CARGO_PKG_VERSION")))
        .send()
        .await
        .map_err(|e| format!("Backend-request feilet: {}", e))?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet = body.chars().take(300).collect::<String>();
        return Err(format!("Backend svarte {}: {}", status.as_u16(), snippet));
    }
    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Kunne ikke parse backend-respons: {}", e))?;
    if raw.get("success").and_then(|v| v.as_bool()) != Some(true) {
        let err = raw.get("error").and_then(|v| v.as_str()).unwrap_or("Ukjent feil");
        return Err(format!("Backend feilet: {}", err));
    }
    Ok(raw.get("destinations").cloned().unwrap_or(serde_json::Value::Array(vec![])))
}

pub async fn get_project_info(cfg: &Config) -> Result<ProjectInfo, String> {
    let base = cfg.api_base.trim_end_matches('/');
    let url = format!("{}/api/dit/projects/{}/info", base, urlencoding::encode(&cfg.project_id));
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", cfg.token))
        .header("User-Agent", concat!("creatorhub-one-desk/", env!("CARGO_PKG_VERSION")))
        .send()
        .await
        .map_err(|e| format!("Backend-request feilet: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet = body.chars().take(300).collect::<String>();
        return Err(format!("Backend svarte {}: {}", status.as_u16(), snippet));
    }

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Kunne ikke parse backend-respons: {}", e))?;

    if raw.get("success").and_then(|v| v.as_bool()) != Some(true) {
        let err = raw.get("error").and_then(|v| v.as_str()).unwrap_or("Ukjent feil");
        return Err(format!("Backend feilet: {}", err));
    }

    let project = raw
        .get("project")
        .ok_or_else(|| "Mangler felt 'project' i respons".to_string())?;
    let info = ProjectInfo {
        project: ProjectSummary {
            id: project.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            name: project.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        },
        memory_card_configs: raw.get("memory_card_configs").cloned().unwrap_or(serde_json::Value::Array(vec![])),
        selected_memory_cards: raw.get("selected_memory_cards").cloned().unwrap_or(serde_json::Value::Array(vec![])),
        destinations: raw.get("destinations").cloned().unwrap_or(serde_json::Value::Array(vec![])),
    };
    Ok(info)
}

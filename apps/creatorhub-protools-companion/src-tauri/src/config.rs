//! Persistent companion-config i ~/.creatorhub-protools-companion/config.json.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

pub const DEFAULT_API_BASE: &str = "https://creatorhub-backend-rtbl.onrender.com";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default = "default_api_base")]
    pub api_base: String,
    #[serde(default)]
    pub device_token: Option<String>,
    #[serde(default)]
    pub user_email: Option<String>,
    #[serde(default)]
    pub device_id: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub session_name: Option<String>,
    #[serde(default)]
    pub session_info_path: Option<String>,
    #[serde(default)]
    pub bounce_dir: Option<String>,
    #[serde(default)]
    pub easeverse_track_id: Option<String>,
    #[serde(default)]
    pub audio_room_id: Option<String>,
    #[serde(default)]
    pub workspace_project_id: Option<String>,
    #[serde(default)]
    pub easeverse_project_id: Option<String>,
    #[serde(default)]
    pub suggested_project_name: Option<String>,
    /// Filfingerprints som er fullført hos backend, brukt for idempotens over omstart.
    #[serde(default)]
    pub uploaded_bounces: Vec<String>,
}

fn default_api_base() -> String {
    DEFAULT_API_BASE.to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            api_base: default_api_base(),
            device_token: None,
            user_email: None,
            device_id: None,
            session_id: None,
            session_name: None,
            session_info_path: None,
            bounce_dir: None,
            easeverse_track_id: None,
            audio_room_id: None,
            workspace_project_id: None,
            easeverse_project_id: None,
            suggested_project_name: None,
            uploaded_bounces: Vec::new(),
        }
    }
}

pub fn config_dir() -> PathBuf {
    let base = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join(".creatorhub-protools-companion")
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

pub fn load() -> AppConfig {
    let path = config_path();
    if !path.exists() {
        return AppConfig::default();
    }
    match fs::read(&path) {
        Ok(raw) => serde_json::from_slice(&raw).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save(cfg: &AppConfig) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Opprett config-mappe: {}", e))?;
    let json = serde_json::to_vec_pretty(cfg).map_err(|e| format!("Serialiser config: {}", e))?;
    let path = config_path();
    fs::write(&path, &json).map_err(|e| format!("Skriv config: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_has_api_base() {
        let c = AppConfig::default();
        assert_eq!(c.api_base, DEFAULT_API_BASE);
        assert!(c.device_token.is_none());
        assert!(c.workspace_project_id.is_none());
    }

    #[test]
    fn missing_fields_default() {
        let c: AppConfig = serde_json::from_str("{}").unwrap();
        assert_eq!(c.api_base, DEFAULT_API_BASE);
        assert!(c.uploaded_bounces.is_empty());
    }

    #[test]
    fn unknown_fields_ignored() {
        let c: AppConfig = serde_json::from_str(r#"{"api_base":"https://x","future":1}"#).unwrap();
        assert_eq!(c.api_base, "https://x");
    }
}

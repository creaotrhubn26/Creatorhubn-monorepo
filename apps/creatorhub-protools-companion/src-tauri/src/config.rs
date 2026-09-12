//! Persistent companion-config i ~/.creatorhub-protools-companion/config.json.

use std::fs;
use std::path::PathBuf;

use crate::intro_preflight::IntroPreflight;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

pub const DEFAULT_API_BASE: &str = "https://creatorhub-backend-rtbl.onrender.com";
const KEYRING_SERVICE: &str = "com.creatorhub.protools-companion";
const DEVICE_TOKEN_ACCOUNT: &str = "creatorhub-device-token";
const LOCAL_IPC_ACCOUNT: &str = "aax-review-console-ipc";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingBounce {
    pub path: String,
    pub fingerprint: String,
    #[serde(default)]
    pub attempt_count: u32,
    #[serde(default)]
    pub next_attempt_at_ms: u64,
    #[serde(default)]
    pub last_error: Option<String>,
}

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
    #[serde(default = "default_protools_tier")]
    pub protools_tier: String,
    #[serde(default)]
    pub intro_preflight: Option<IntroPreflight>,
    /// Filfingerprints som er fullført hos backend, brukt for idempotens over omstart.
    #[serde(default)]
    pub uploaded_bounces: Vec<String>,
    /// Slås på eksplisitt av brukeren og gjenoppretter watcher etter omstart.
    #[serde(default)]
    pub auto_watch: bool,
    /// Varig lokal outbox: en fil forsvinner ikke ved app-/maskinomstart.
    #[serde(default)]
    pub pending_bounces: Vec<PendingBounce>,
    #[serde(default)]
    pub session_info_pending: bool,
    #[serde(default)]
    pub session_info_attempt_count: u32,
    #[serde(default)]
    pub session_info_next_attempt_at_ms: u64,
    #[serde(default)]
    pub session_info_last_error: Option<String>,
    /// Siste kjente Sound Room-innboks. Gjør Review Console lesbar uten nett.
    #[serde(default)]
    pub cached_feedback: Option<Value>,
    #[serde(default)]
    pub last_feedback_sync_at: Option<String>,
    #[serde(default)]
    pub last_feedback_sync_error: Option<String>,
    /// Kun i minnet på macOS/Windows; `save` flytter verdien til OS-nøkkelringen.
    #[serde(default)]
    pub local_ipc_secret: Option<String>,
    #[serde(default)]
    pub last_session_fingerprint: Option<String>,
}

fn default_api_base() -> String {
    DEFAULT_API_BASE.to_string()
}

fn default_protools_tier() -> String {
    "intro".to_string()
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
            protools_tier: default_protools_tier(),
            intro_preflight: None,
            uploaded_bounces: Vec::new(),
            auto_watch: false,
            pending_bounces: Vec::new(),
            session_info_pending: false,
            session_info_attempt_count: 0,
            session_info_next_attempt_at_ms: 0,
            session_info_last_error: None,
            cached_feedback: None,
            last_feedback_sync_at: None,
            last_feedback_sync_error: None,
            local_ipc_secret: None,
            last_session_fingerprint: None,
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

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn keyring_entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, account)
        .map_err(|error| format!("Åpne OS-nøkkelring: {}", error))
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn keyring_get(account: &str) -> Result<Option<String>, String> {
    match keyring_entry(account)?.get_password() {
        Ok(secret) if !secret.trim().is_empty() => Ok(Some(secret)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Les OS-nøkkelring: {}", error)),
    }
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn keyring_set(account: &str, secret: &str) -> Result<(), String> {
    keyring_entry(account)?
        .set_password(secret)
        .map_err(|error| format!("Lagre i OS-nøkkelring: {}", error))
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn keyring_delete(account: &str) -> Result<(), String> {
    match keyring_entry(account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Fjern fra OS-nøkkelring: {}", error)),
    }
}

pub fn load() -> AppConfig {
    let path = config_path();
    let mut config = match fs::read(&path) {
        Ok(raw) => serde_json::from_slice(&raw).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    };
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        if let Ok(Some(token)) = keyring_get(DEVICE_TOKEN_ACCOUNT) {
            config.device_token = Some(token);
        } else if let Some(token) = config.device_token.clone() {
            // Éngangsmigrering fra v0.2-config. Filen saniteres ved neste save.
            let _ = keyring_set(DEVICE_TOKEN_ACCOUNT, &token);
        }
        if let Ok(Some(secret)) = keyring_get(LOCAL_IPC_ACCOUNT) {
            config.local_ipc_secret = Some(secret);
        }
    }
    config
}

pub fn save(cfg: &AppConfig) -> Result<(), String> {
    let dir = config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Opprett config-mappe: {}", e))?;
    let mut persisted = cfg.clone();
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        if let Some(token) = cfg
            .device_token
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            keyring_set(DEVICE_TOKEN_ACCOUNT, token)?;
            persisted.device_token = None;
        }
        if let Some(secret) = cfg
            .local_ipc_secret
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            keyring_set(LOCAL_IPC_ACCOUNT, secret)?;
            persisted.local_ipc_secret = None;
        }
    }
    let json =
        serde_json::to_vec_pretty(&persisted).map_err(|e| format!("Serialiser config: {}", e))?;
    let path = config_path();
    let tmp_path = dir.join("config.json.tmp");
    fs::write(&tmp_path, &json).map_err(|e| format!("Skriv midlertidig config: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o600));
    }
    fs::rename(&tmp_path, &path).map_err(|e| format!("Aktiver config atomisk: {}", e))?;
    Ok(())
}

pub fn clear_device_token() -> Result<(), String> {
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    keyring_delete(DEVICE_TOKEN_ACCOUNT)?;
    Ok(())
}

pub fn ensure_local_ipc_secret(cfg: &mut AppConfig) -> Result<String, String> {
    if let Some(secret) = cfg
        .local_ipc_secret
        .as_deref()
        .filter(|value| value.len() >= 32)
    {
        return Ok(secret.to_string());
    }
    let secret = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    cfg.local_ipc_secret = Some(secret.clone());
    save(cfg)?;
    Ok(secret)
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
        assert!(c.pending_bounces.is_empty());
        assert!(!c.auto_watch);
        assert!(c.cached_feedback.is_none());
    }

    #[test]
    fn unknown_fields_ignored() {
        let c: AppConfig = serde_json::from_str(r#"{"api_base":"https://x","future":1}"#).unwrap();
        assert_eq!(c.api_base, "https://x");
    }

    #[test]
    fn pending_queue_survives_serialization() {
        let mut c = AppConfig {
            auto_watch: true,
            session_info_pending: true,
            ..Default::default()
        };
        c.pending_bounces.push(PendingBounce {
            path: "/tmp/Mix.wav".into(),
            fingerprint: "Mix.wav:10:20".into(),
            attempt_count: 3,
            next_attempt_at_ms: 42,
            last_error: Some("offline".into()),
        });
        let restored: AppConfig = serde_json::from_slice(&serde_json::to_vec(&c).unwrap()).unwrap();
        assert!(restored.auto_watch);
        assert!(restored.session_info_pending);
        assert_eq!(restored.pending_bounces[0].attempt_count, 3);
        assert_eq!(
            restored.pending_bounces[0].last_error.as_deref(),
            Some("offline")
        );
    }

    #[test]
    fn generated_ipc_secret_has_high_entropy_shape() {
        let secret = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
        assert_eq!(secret.len(), 64);
        assert!(secret
            .chars()
            .all(|character| character.is_ascii_hexdigit()));
    }
}

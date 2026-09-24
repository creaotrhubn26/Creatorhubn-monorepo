//! Persistent desk identity (UUID + display name).
//!
//! Genereres EN gang ved første Desk-launch og lagres i
//! `~/.creatorhub-one-desk/desk-identity.json`. Persist'er på tvers av
//! konfigurasjon-bytter (helper-token kan byttes ofte; desk_id skal
//! være stabil så iPad-en kjenner igjen samme Desk over tid).
//!
//! Bevisst SEPARAT fra `helper_client::Config` fordi:
//!   - Config slettes ved `clear_helper_config` (token-rotering)
//!   - desk_id må overleve token-rotering så paringen ikke brytes
//!   - Identiteten er bruker-rettet (hva iPad-en ser i prompten),
//!     mens config er backend-rettet
//!
//! Skjema:
//!   { "desk_id": "<uuid v4>", "desk_name": "<hostname>" }

use std::path::PathBuf;

use rand::RngCore;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::helper_client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeskIdentity {
    pub desk_id: String,
    pub desk_name: String,
}

fn identity_path() -> PathBuf {
    helper_client::config_dir().join("desk-identity.json")
}

fn bridge_secret_path() -> PathBuf {
    helper_client::config_dir().join("bridge-access-token")
}

fn lightroom_broker_secret_path() -> PathBuf {
    helper_client::config_dir().join("lightroom-broker-token")
}

fn default_name() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "Creatorhub One Desk".to_string())
}

/// Henter eller genererer identiteten. Hvis fila ikke finnes eller er
/// korrupt, lager vi en ny — det er hensikten med "first launch
/// auto-generate". Skriv-feil bobler opp så caller kan logge.
pub fn load_or_create() -> Result<DeskIdentity, String> {
    let path = identity_path();
    if let Ok(raw) = std::fs::read(&path) {
        if let Ok(identity) = serde_json::from_slice::<DeskIdentity>(&raw) {
            return Ok(identity);
        }
    }
    let identity = DeskIdentity {
        desk_id: format!("desk_{}", Uuid::new_v4()),
        desk_name: default_name(),
    };
    persist(&identity)?;
    Ok(identity)
}

/// A separate 256-bit bearer token used by paired iPads when reading the
/// local Bridge manifest. It is deliberately not part of `DeskIdentity`,
/// because that value is returned to the Tauri webview.
pub fn load_or_create_bridge_secret() -> Result<String, String> {
    let path = bridge_secret_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        let value = raw.trim();
        if value.len() == 64 && value.chars().all(|character| character.is_ascii_hexdigit()) {
            return Ok(value.to_string());
        }
    }

    let mut bytes = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = hex::encode(bytes);
    let dir = helper_client::config_dir();
    std::fs::create_dir_all(&dir).map_err(|error| format!("Opprett config-mappe: {error}"))?;
    std::fs::write(&path, format!("{token}\n"))
        .map_err(|error| format!("Skriv {}: {error}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Beskytt {}: {error}", path.display()))?;
    }
    Ok(token)
}

/// Local-only capability shared with the installed Lightroom plug-in. This is
/// not a cloud credential: it only authorizes calls to Desk on 127.0.0.1.
pub fn load_or_create_lightroom_broker_secret() -> Result<String, String> {
    load_or_create_hex_secret(&lightroom_broker_secret_path())
}

/// Invalidates every previously installed Lightroom loopback capability.
/// The next install/repair receives the replacement secret.
pub fn rotate_lightroom_broker_secret() -> Result<String, String> {
    write_new_hex_secret(&lightroom_broker_secret_path())
}

fn load_or_create_hex_secret(path: &std::path::Path) -> Result<String, String> {
    if let Ok(raw) = std::fs::read_to_string(path) {
        let value = raw.trim();
        if value.len() == 64 && value.chars().all(|character| character.is_ascii_hexdigit()) {
            return Ok(value.to_string());
        }
    }

    write_new_hex_secret(path)
}

fn write_new_hex_secret(path: &std::path::Path) -> Result<String, String> {
    let mut bytes = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let token = hex::encode(bytes);
    let dir = helper_client::config_dir();
    std::fs::create_dir_all(&dir).map_err(|error| format!("Opprett config-mappe: {error}"))?;
    std::fs::write(path, format!("{token}\n"))
        .map_err(|error| format!("Skriv {}: {error}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Beskytt {}: {error}", path.display()))?;
    }
    Ok(token)
}

fn persist(identity: &DeskIdentity) -> Result<(), String> {
    let dir = helper_client::config_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Opprett config-mappe: {}", e))?;
    let path = identity_path();
    let json = serde_json::to_vec_pretty(identity).map_err(|e| format!("Serialiser: {}", e))?;
    std::fs::write(&path, &json).map_err(|e| format!("Skriv {}: {}", path.display(), e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

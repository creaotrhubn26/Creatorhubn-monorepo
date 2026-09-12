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

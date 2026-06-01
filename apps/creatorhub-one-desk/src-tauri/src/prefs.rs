//! Brukerpreferanser persistert til ~/.creatorhub-one-desk/prefs.json.
//!
//! Mer struktureret enn helper_client::Config (som handler om auth):
//! denne lagrer UI/UX-valg som auto-eject etter backup.
//!
//! Forwards-compat: alle felter har Default, så å legge til nye felter
//! senere bryter ikke tidligere installasjoner.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::helper_client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prefs {
    /// Om appen skal kjøre `diskutil eject` på SD/CFexpress-volumet
    /// etter at backup-sesjonen er fullført med state="completed".
    #[serde(default)]
    pub auto_eject: bool,
}

impl Default for Prefs {
    fn default() -> Self {
        Self { auto_eject: false }
    }
}

fn prefs_path() -> PathBuf {
    helper_client::config_dir().join("prefs.json")
}

pub fn load() -> Result<Prefs, String> {
    let path = prefs_path();
    if !path.exists() {
        return Ok(Prefs::default());
    }
    let raw = fs::read(&path).map_err(|e| format!("Les prefs: {}", e))?;
    // Hvis JSON-en er korrupt (manuell editering), faller vi tilbake
    // til default i stedet for å krasje hele appen.
    let parsed: Result<Prefs, _> = serde_json::from_slice(&raw);
    Ok(parsed.unwrap_or_default())
}

pub fn save(prefs: &Prefs) -> Result<(), String> {
    let dir = helper_client::config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Opprett prefs-mappe: {}", e))?;
    let json = serde_json::to_vec_pretty(prefs).map_err(|e| format!("Serialiser: {}", e))?;
    let path = prefs_path();
    fs::write(&path, &json).map_err(|e| format!("Skriv prefs: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        let _ = fs::set_permissions(&path, perms);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, MutexGuard, OnceLock};
    use tempfile::tempdir;

    fn home_lock() -> MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|p| p.into_inner())
    }

    fn fresh_home() -> (tempfile::TempDir, MutexGuard<'static, ()>) {
        let guard = home_lock();
        let d = tempdir().expect("tempdir");
        unsafe {
            std::env::set_var("HOME", d.path());
        }
        (d, guard)
    }

    #[test]
    fn load_returns_default_when_file_missing() {
        let (_h, _g) = fresh_home();
        let prefs = load().expect("load");
        assert!(!prefs.auto_eject);
    }

    #[test]
    fn save_then_load_round_trips() {
        let (_h, _g) = fresh_home();
        save(&Prefs { auto_eject: true }).expect("save");
        let loaded = load().expect("load");
        assert!(loaded.auto_eject);
    }

    #[test]
    fn corrupt_json_falls_back_to_default() {
        let (_h, _g) = fresh_home();
        let dir = helper_client::config_dir();
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(prefs_path(), b"not json at all").unwrap();
        let prefs = load().expect("load");
        assert!(!prefs.auto_eject, "korrupt fil → default = false");
    }

    #[test]
    fn forwards_compat_unknown_fields_ignored() {
        let (_h, _g) = fresh_home();
        let dir = helper_client::config_dir();
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            prefs_path(),
            br#"{"auto_eject":true,"future_field":"ignored"}"#,
        )
        .unwrap();
        let prefs = load().expect("load");
        assert!(prefs.auto_eject);
    }
}

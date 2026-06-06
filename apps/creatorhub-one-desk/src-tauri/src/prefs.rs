//! Brukerpreferanser persistert til ~/.creatorhub-one-desk/prefs.json.
//!
//! Skilt fra helper_client::Config (som handler om auth): denne lagrer
//! UI/UX-valg som auto-eject + default-destinasjons-utvalg.
//!
//! Forwards-compat: alle felter har Default via serde, så å legge til
//! nye felter senere bryter ikke tidligere installasjoner. Korrupt
//! JSON faller stille til default i stedet for å krasje appen.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::helper_client;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Prefs {
    /// Om appen skal kjøre `diskutil eject` på SD/CFexpress-volumet
    /// etter at backup-sesjonen er fullført med state="completed".
    #[serde(default)]
    pub auto_eject: bool,

    /// dit_destinations.id-er som er pre-haket av i BackupDialog.
    /// Tom liste → fall til auto-select-all-with-path (default-behavior).
    /// Brukes til at Fredrik kan si "alltid disse 3 diskene" uten å
    /// klikke gjennom hver gang.
    #[serde(default)]
    pub default_dest_ids: Vec<String>,
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
        let p = load().expect("load");
        assert!(!p.auto_eject);
        assert!(p.default_dest_ids.is_empty());
    }

    #[test]
    fn save_then_load_round_trips_all_fields() {
        let (_h, _g) = fresh_home();
        save(&Prefs {
            auto_eject: true,
            default_dest_ids: vec!["dest-a".into(), "dest-b".into()],
        })
        .expect("save");
        let loaded = load().expect("load");
        assert!(loaded.auto_eject);
        assert_eq!(loaded.default_dest_ids, vec!["dest-a", "dest-b"]);
    }

    #[test]
    fn corrupt_json_falls_back_to_default() {
        let (_h, _g) = fresh_home();
        fs::create_dir_all(helper_client::config_dir()).unwrap();
        fs::write(prefs_path(), b"not json at all").unwrap();
        let p = load().expect("load");
        assert!(!p.auto_eject);
        assert!(p.default_dest_ids.is_empty());
    }

    #[test]
    fn forwards_compat_unknown_fields_ignored() {
        let (_h, _g) = fresh_home();
        fs::create_dir_all(helper_client::config_dir()).unwrap();
        fs::write(
            prefs_path(),
            br#"{"auto_eject":true,"default_dest_ids":["x"],"future_field":42}"#,
        )
        .unwrap();
        let p = load().expect("load");
        assert!(p.auto_eject);
        assert_eq!(p.default_dest_ids, vec!["x"]);
    }

    #[test]
    fn backwards_compat_missing_default_dest_ids() {
        // Gammel prefs-fil fra før default_dest_ids-feltet ble lagt til
        let (_h, _g) = fresh_home();
        fs::create_dir_all(helper_client::config_dir()).unwrap();
        fs::write(prefs_path(), br#"{"auto_eject":true}"#).unwrap();
        let p = load().expect("load");
        assert!(p.auto_eject);
        assert!(p.default_dest_ids.is_empty(), "default-feltet skal være tom");
    }
}

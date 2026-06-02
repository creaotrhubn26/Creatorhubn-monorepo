//! Multi-project storage: ~/.creatorhub-one-desk/projects.json
//!
//! Erstatter den gamle config.json som bare lagret ett prosjekt. Fredrik
//! kan nå konfigurere flere prosjekter (Bryllup 1, Bryllup 2, Event-A
//! etc) og bytte raskt mellom dem uten å re-paste token.
//!
//! Migration: Hvis config.json finnes ved første kall til
//! ensure_loaded(), leses den og konverteres til en single-entry
//! projects.json. config.json beholdes på disk som backup men leses
//! ikke fra etter konvertering — vi sletter den ikke automatisk i
//! tilfelle bruker har en grunn til å rulle tilbake.
//!
//! Forwards-compat: alle felter har Default-fallback via serde. Korrupt
//! JSON faller stille til empty-state slik at app-en alltid starter.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::helper_client::{self, Config};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectEntry {
    /// Brukerens prosjekt-ID i CreatorHub-backend (samme som Config.project_id).
    pub project_id: String,
    /// Visningsnavn — fra backend's project.name hvis tilgjengelig,
    /// ellers project_id som fallback. Settes ved add_project og kan
    /// oppdateres via update_project_label.
    #[serde(default)]
    pub label: String,
    /// Backend-URL. Default: https://creatorhubn.com
    pub api_base: String,
    /// Helper-token-streng (samme format som tidligere — `trr_dit_…`).
    pub token: String,
    /// Unix ms — sist gang vi byttet til dette prosjektet. Brukes for
    /// å sortere project-picker så most-recently-used er øverst.
    #[serde(default)]
    pub last_used_ms: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProjectsFile {
    /// project_id som er aktivt. Hvis None betyr det at brukeren ikke
    /// har valgt ett ennå (vis project-picker eller token-setup).
    #[serde(default)]
    pub active_project_id: Option<String>,
    #[serde(default)]
    pub projects: Vec<ProjectEntry>,
}

fn projects_path() -> PathBuf {
    helper_client::config_dir().join("projects.json")
}

fn legacy_config_path() -> PathBuf {
    helper_client::config_dir().join("config.json")
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Trådsikker container — én instans levetiden på app-en.
#[derive(Default)]
pub struct ProjectStore {
    inner: Mutex<Option<ProjectsFile>>,
}

impl ProjectStore {
    /// Sørger for at projects.json er innlest + migrert. Idempotent.
    fn ensure_loaded(&self) -> Result<(), String> {
        let mut guard = self.inner.lock().unwrap();
        if guard.is_some() {
            return Ok(());
        }
        let path = projects_path();
        if path.exists() {
            let raw = fs::read(&path).map_err(|e| format!("Les projects.json: {}", e))?;
            // Korrupt JSON → tom state (Fredrik kan re-pase token og
            // sette opp på nytt) i stedet for å krasje app-en.
            let parsed: ProjectsFile = serde_json::from_slice(&raw).unwrap_or_default();
            *guard = Some(parsed);
            return Ok(());
        }
        // Ingen projects.json — sjekk om gammel config.json finnes som
        // skal migreres
        let legacy = legacy_config_path();
        if legacy.exists() {
            let raw = fs::read(&legacy).map_err(|e| format!("Les legacy config: {}", e))?;
            let cfg: Result<Config, _> = serde_json::from_slice(&raw);
            if let Ok(cfg) = cfg {
                let entry = ProjectEntry {
                    project_id: cfg.project_id.clone(),
                    label: cfg.project_id.clone(),
                    api_base: cfg.api_base,
                    token: cfg.token,
                    last_used_ms: now_ms(),
                };
                let file = ProjectsFile {
                    active_project_id: Some(cfg.project_id),
                    projects: vec![entry],
                };
                *guard = Some(file.clone());
                // Skriv migrert versjon til disk så fremtidige starts
                // går direkte til den nye fila
                drop(guard);
                self.save_to_disk(&file)?;
                return Ok(());
            }
        }
        *guard = Some(ProjectsFile::default());
        Ok(())
    }

    fn save_to_disk(&self, file: &ProjectsFile) -> Result<(), String> {
        let dir = helper_client::config_dir();
        fs::create_dir_all(&dir).map_err(|e| format!("Opprett projects-mappe: {}", e))?;
        let json = serde_json::to_vec_pretty(file).map_err(|e| format!("Serialiser: {}", e))?;
        let path = projects_path();
        fs::write(&path, &json).map_err(|e| format!("Skriv projects.json: {}", e))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = fs::Permissions::from_mode(0o600);
            let _ = fs::set_permissions(&path, perms);
        }
        Ok(())
    }

    fn snapshot(&self) -> Result<ProjectsFile, String> {
        self.ensure_loaded()?;
        Ok(self.inner.lock().unwrap().clone().unwrap_or_default())
    }

    pub fn list(&self) -> Result<Vec<ProjectEntry>, String> {
        let snap = self.snapshot()?;
        let mut sorted = snap.projects;
        sorted.sort_by(|a, b| b.last_used_ms.cmp(&a.last_used_ms));
        Ok(sorted)
    }

    /// Returnerer den aktive prosjekt-config-en i samme format som
    /// helper_client::Config — slik at eksisterende kode-paths som
    /// leser config kan beholdes uendret.
    pub fn active_config(&self) -> Result<Option<Config>, String> {
        let snap = self.snapshot()?;
        let active_id = match &snap.active_project_id {
            Some(id) => id.clone(),
            None => return Ok(None),
        };
        let entry = snap
            .projects
            .iter()
            .find(|p| p.project_id == active_id)
            .cloned();
        Ok(entry.map(|e| Config {
            api_base: e.api_base,
            project_id: e.project_id,
            token: e.token,
        }))
    }

    pub fn active_id(&self) -> Result<Option<String>, String> {
        Ok(self.snapshot()?.active_project_id)
    }

    /// Legg til eller oppdater (replace-by-project_id). Setter ny som
    /// aktiv slik at Fredrik ser den umiddelbart etter å ha limt inn
    /// token.
    pub fn add_or_update(
        &self,
        project_id: String,
        label: String,
        api_base: String,
        token: String,
    ) -> Result<(), String> {
        self.ensure_loaded()?;
        let mut guard = self.inner.lock().unwrap();
        let file = guard.as_mut().expect("loaded");
        // Bevar tidligere last_used_ms hvis prosjektet finnes så vi ikke
        // boost'er en gammel som er re-konfigurert
        let existing_last_used = file
            .projects
            .iter()
            .find(|p| p.project_id == project_id)
            .map(|p| p.last_used_ms);
        file.projects.retain(|p| p.project_id != project_id);
        file.projects.push(ProjectEntry {
            project_id: project_id.clone(),
            label,
            api_base,
            token,
            last_used_ms: existing_last_used.unwrap_or_else(now_ms),
        });
        file.active_project_id = Some(project_id);
        let file_clone = file.clone();
        drop(guard);
        self.save_to_disk(&file_clone)
    }

    pub fn remove(&self, project_id: &str) -> Result<(), String> {
        self.ensure_loaded()?;
        let mut guard = self.inner.lock().unwrap();
        let file = guard.as_mut().expect("loaded");
        let was_active = file.active_project_id.as_deref() == Some(project_id);
        file.projects.retain(|p| p.project_id != project_id);
        if was_active {
            // Auto-velg mest nylig brukte gjenværende prosjekt
            file.active_project_id = file
                .projects
                .iter()
                .max_by_key(|p| p.last_used_ms)
                .map(|p| p.project_id.clone());
        }
        let file_clone = file.clone();
        drop(guard);
        self.save_to_disk(&file_clone)
    }

    pub fn set_active(&self, project_id: &str) -> Result<(), String> {
        self.ensure_loaded()?;
        let mut guard = self.inner.lock().unwrap();
        let file = guard.as_mut().expect("loaded");
        let found = file.projects.iter_mut().find(|p| p.project_id == project_id);
        let entry = found.ok_or_else(|| format!("Prosjekt {} ikke funnet", project_id))?;
        entry.last_used_ms = now_ms();
        file.active_project_id = Some(project_id.to_string());
        let file_clone = file.clone();
        drop(guard);
        self.save_to_disk(&file_clone)
    }

    pub fn update_label(&self, project_id: &str, label: String) -> Result<(), String> {
        self.ensure_loaded()?;
        let mut guard = self.inner.lock().unwrap();
        let file = guard.as_mut().expect("loaded");
        let found = file.projects.iter_mut().find(|p| p.project_id == project_id);
        let entry = found.ok_or_else(|| format!("Prosjekt {} ikke funnet", project_id))?;
        entry.label = label;
        let file_clone = file.clone();
        drop(guard);
        self.save_to_disk(&file_clone)
    }

    /// Erstatt hele prosjekt-listen i én transaksjon. Brukes etter
    /// Google OAuth → /api/desktop/me/projects-svaret kommer inn med
    /// ALLE prosjekter brukeren har tilgang til. Bevarer last_used_ms
    /// for prosjekter som allerede fantes så MRU-sortering ikke nullstilles.
    pub fn replace_all(&self, entries: Vec<ProjectEntry>) -> Result<(), String> {
        self.ensure_loaded()?;
        let mut guard = self.inner.lock().unwrap();
        let file = guard.as_mut().expect("loaded");

        let mut prev_last_used: std::collections::HashMap<String, u64> = file
            .projects
            .iter()
            .map(|p| (p.project_id.clone(), p.last_used_ms))
            .collect();

        let merged: Vec<ProjectEntry> = entries
            .into_iter()
            .map(|mut e| {
                if let Some(prev) = prev_last_used.remove(&e.project_id) {
                    e.last_used_ms = prev;
                } else if e.last_used_ms == 0 {
                    e.last_used_ms = now_ms();
                }
                e
            })
            .collect();

        // Velg aktivt prosjekt: behold gjeldende hvis den fortsatt finnes
        // i ny liste, ellers MRU.
        let still_active = file
            .active_project_id
            .as_ref()
            .filter(|id| merged.iter().any(|p| &p.project_id == *id))
            .cloned();
        let active = still_active.or_else(|| {
            merged
                .iter()
                .max_by_key(|p| p.last_used_ms)
                .map(|p| p.project_id.clone())
        });

        file.projects = merged;
        file.active_project_id = active;
        let file_clone = file.clone();
        drop(guard);
        self.save_to_disk(&file_clone)
    }

    /// Sletter både projects.json OG legacy config.json. Brukes ved
    /// "Logg ut alle prosjekter".
    pub fn clear_all(&self) -> Result<(), String> {
        let path = projects_path();
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("Slett projects.json: {}", e))?;
        }
        let legacy = legacy_config_path();
        if legacy.exists() {
            let _ = fs::remove_file(&legacy);
        }
        *self.inner.lock().unwrap() = Some(ProjectsFile::default());
        Ok(())
    }
}

// ── Free-function helpers for legacy callers ─────────────────────
// helper_client::load_config()-stilen brukes mange steder i koden
// (copy_session, capture_mirror, ipad_pairing). I stedet for å
// refaktorere alle disse, eksponerer vi free functions som internt
// bruker en throw-away ProjectStore. Disk-IO er liten (én fil).

pub fn load_active_disk() -> Result<Option<Config>, String> {
    ProjectStore::default().active_config()
}

pub fn save_active_disk(cfg: &Config, label: Option<String>) -> Result<(), String> {
    let store = ProjectStore::default();
    let lbl = label.unwrap_or_else(|| cfg.project_id.clone());
    store.add_or_update(
        cfg.project_id.clone(),
        lbl,
        cfg.api_base.clone(),
        cfg.token.clone(),
    )
}

pub fn clear_all_disk() -> Result<(), String> {
    ProjectStore::default().clear_all()
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
    fn empty_state_when_no_files() {
        let (_h, _g) = fresh_home();
        let store = ProjectStore::default();
        assert!(store.list().unwrap().is_empty());
        assert!(store.active_id().unwrap().is_none());
        assert!(store.active_config().unwrap().is_none());
    }

    #[test]
    fn add_or_update_persists_and_sets_active() {
        let (_h, _g) = fresh_home();
        let store = ProjectStore::default();
        store
            .add_or_update(
                "proj-a".into(),
                "Bryllup Anna".into(),
                "https://creatorhubn.com".into(),
                "trr_dit_aaa".into(),
            )
            .unwrap();
        let list = store.list().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].label, "Bryllup Anna");
        assert_eq!(store.active_id().unwrap().as_deref(), Some("proj-a"));
        let active = store.active_config().unwrap().unwrap();
        assert_eq!(active.token, "trr_dit_aaa");
    }

    #[test]
    fn add_second_project_replaces_active() {
        let (_h, _g) = fresh_home();
        let store = ProjectStore::default();
        store.add_or_update(
            "proj-a".into(), "A".into(),
            "https://creatorhubn.com".into(), "trr_dit_a".into()).unwrap();
        store.add_or_update(
            "proj-b".into(), "B".into(),
            "https://creatorhubn.com".into(), "trr_dit_b".into()).unwrap();
        assert_eq!(store.active_id().unwrap().as_deref(), Some("proj-b"));
        assert_eq!(store.list().unwrap().len(), 2);
    }

    #[test]
    fn set_active_switches_without_replacing_token() {
        let (_h, _g) = fresh_home();
        let store = ProjectStore::default();
        store.add_or_update("a".into(), "A".into(), "u".into(), "ta".into()).unwrap();
        store.add_or_update("b".into(), "B".into(), "u".into(), "tb".into()).unwrap();
        store.set_active("a").unwrap();
        assert_eq!(store.active_config().unwrap().unwrap().token, "ta");
        store.set_active("b").unwrap();
        assert_eq!(store.active_config().unwrap().unwrap().token, "tb");
    }

    #[test]
    fn remove_active_auto_picks_next_mru() {
        let (_h, _g) = fresh_home();
        let store = ProjectStore::default();
        store.add_or_update("old".into(), "Old".into(), "u".into(), "to".into()).unwrap();
        store.add_or_update("new".into(), "New".into(), "u".into(), "tn".into()).unwrap();
        // active = new
        store.remove("new").unwrap();
        // active fallout to 'old' siden det er eneste gjenværende
        assert_eq!(store.active_id().unwrap().as_deref(), Some("old"));
    }

    #[test]
    fn remove_last_project_clears_active() {
        let (_h, _g) = fresh_home();
        let store = ProjectStore::default();
        store.add_or_update("only".into(), "X".into(), "u".into(), "t".into()).unwrap();
        store.remove("only").unwrap();
        assert!(store.active_id().unwrap().is_none());
        assert!(store.list().unwrap().is_empty());
    }

    #[test]
    fn migration_from_legacy_config_json() {
        let (_h, _g) = fresh_home();
        let dir = helper_client::config_dir();
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            legacy_config_path(),
            br#"{"api_base":"https://creatorhubn.com","project_id":"proj_legacy","token":"trr_dit_legacy"}"#,
        ).unwrap();
        let store = ProjectStore::default();
        // ensure_loaded skal trigge migration
        let active = store.active_config().unwrap();
        assert!(active.is_some());
        assert_eq!(active.unwrap().project_id, "proj_legacy");
        // projects.json skal nå eksistere
        assert!(projects_path().exists());
    }

    #[test]
    fn corrupt_projects_json_falls_back_to_empty() {
        let (_h, _g) = fresh_home();
        let dir = helper_client::config_dir();
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(projects_path(), b"not valid json").unwrap();
        let store = ProjectStore::default();
        assert!(store.list().unwrap().is_empty());
        assert!(store.active_id().unwrap().is_none());
    }

    #[test]
    fn update_label_keeps_token() {
        let (_h, _g) = fresh_home();
        let store = ProjectStore::default();
        store.add_or_update("x".into(), "Old name".into(), "u".into(), "t".into()).unwrap();
        store.update_label("x", "New name".into()).unwrap();
        let list = store.list().unwrap();
        assert_eq!(list[0].label, "New name");
        assert_eq!(list[0].token, "t");
    }

    #[test]
    fn clear_all_removes_both_files() {
        let (_h, _g) = fresh_home();
        let store = ProjectStore::default();
        store.add_or_update("x".into(), "X".into(), "u".into(), "t".into()).unwrap();
        assert!(projects_path().exists());
        store.clear_all().unwrap();
        assert!(!projects_path().exists());
        assert!(store.list().unwrap().is_empty());
    }
}

//! Hvor databasene ligger. Ett sted, fordi to steder betyr at én av dem blir
//! glemt.
//!
//! Kodeindeksen og notatlageret er to ulike baser, og det er riktig: den ene
//! kan slettes og bygges opp igjen fra git, den andre inneholder brukerens
//! egne rettelser. Det som var galt var at stien til dem ble utledet både i
//! `indexer/src/cli.rs` og i `app/src-tauri/src/lib.rs`, slik at enhver ny
//! bruk uten `--db` kunne skrive stille til feil fil.

use std::path::PathBuf;

/// Hvilket lager stien gjelder. Eksplisitt argument, ikke en standardverdi:
/// den som spør skal måtte vite hva den spør om.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lager {
    /// Semantisk indeks over kode og notater. Kan slettes når som helst og
    /// bygges opp igjen fra git.
    Kodeindeks,
    /// Appens eget lager: avsnitt, forståelse, rettelser, relasjoner.
    /// `CREATORHUB_NOTAT_DB` overstyrer, som i `notat`-skriptet.
    Notater,
}

impl Lager {
    fn filnavn(self) -> &'static str {
        match self {
            Lager::Kodeindeks => "index.db",
            Lager::Notater => "notater.db",
        }
    }

    fn miljøvariabel(self) -> Option<&'static str> {
        match self {
            Lager::Kodeindeks => None,
            Lager::Notater => Some("CREATORHUB_NOTAT_DB"),
        }
    }
}

/// Mappa begge lagrene bor i.
pub fn app_katalog() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let base = if cfg!(target_os = "macos") {
        PathBuf::from(home).join("Library/Application Support")
    } else {
        PathBuf::from(home).join(".local/share")
    };
    base.join("creatorhub-notes")
}

/// Standardstien til ett av lagrene, med miljøvariabelen som overstyring der
/// den finnes.
pub fn standard_db(lager: Lager) -> PathBuf {
    if let Some(navn) = lager.miljøvariabel() {
        if let Ok(sti) = std::env::var(navn) {
            if !sti.is_empty() {
                return PathBuf::from(sti);
            }
        }
    }
    app_katalog().join(lager.filnavn())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hvert_lager_har_sin_egen_fil_i_app_katalogen() {
        let indeks = standard_db(Lager::Kodeindeks);
        assert!(indeks.is_absolute());
        assert!(
            indeks.to_string_lossy().ends_with("creatorhub-notes/index.db"),
            "fikk {}",
            indeks.display()
        );
        assert_eq!(indeks.parent().unwrap(), app_katalog());
        assert_ne!(indeks, standard_db(Lager::Notater));
    }

    #[test]
    fn notatlageret_kan_overstyres_av_miljøet() {
        // `set_var` er prosessglobal, så testen leser variabelen gjennom den
        // samme funksjonen appen bruker og rydder etter seg.
        let før = std::env::var("CREATORHUB_NOTAT_DB").ok();
        std::env::set_var("CREATORHUB_NOTAT_DB", "/tmp/et-annet-sted.db");
        assert_eq!(standard_db(Lager::Notater), PathBuf::from("/tmp/et-annet-sted.db"));
        // Kodeindeksen skal ikke følge med: en base som kan gjenbygges skal
        // ikke kunne peke på den som ikke kan det.
        assert!(standard_db(Lager::Kodeindeks).to_string_lossy().ends_with("index.db"));

        std::env::set_var("CREATORHUB_NOTAT_DB", "");
        assert!(standard_db(Lager::Notater).to_string_lossy().ends_with("notater.db"));
        match før {
            Some(v) => std::env::set_var("CREATORHUB_NOTAT_DB", v),
            None => std::env::remove_var("CREATORHUB_NOTAT_DB"),
        }
    }
}

//! Overvåker notatmappen mens appen kjører, og melder fra om endringer som
//! ikke kom fra appen selv.
//!
//! Appen leste før bare ved oppstart og etter egen lagring. Skrev `notat`,
//! git, eller en annen editor noe i mellomtiden, dukket det aldri opp før
//! appen ble startet på nytt. Denne modulen retter det: den holder en
//! `notify`-vakt på mappen, samler hendelser som kommer i klaser opp i et
//! kort vindu, luker bort `.git` og filer som ikke er notater, og luker bort
//! appens egne skriv — de skal aldri telle som en endring utenfra.
//!
//! Feiler vakten å starte, eller forsvinner mappen, skal appen virke akkurat
//! som før: lese ved oppstart og etter lagring. Derfor returnerer [`start`]
//! en `Result` som kalleren har lov til å ignorere.

use notify::{RecursiveMode, Watcher};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc::RecvTimeoutError;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Hvor lenge en fil appen nettopp skrev telles som "vår egen". Lenge nok
/// til at operativsystemets hendelse rekker fram gjennom debounce-vinduet
/// under normal last, kort nok til at en ekte ekstern endring rett etterpå
/// på samme fil ikke blir forvekslet med den.
const SELV_TTL: Duration = Duration::from_secs(3);

/// Hvor lenge en klase av hendelser samles opp før den behandles som én.
/// En enkelt lagring gir gjerne flere `notify`-hendelser for samme fil; det
/// er dette vinduet som gjør dem til én reindeksering, ikke flere.
const DEBOUNCE: Duration = Duration::from_millis(400);

/// Stiene appens egne kommandoer nettopp skrev til, med tidspunktet de ble
/// merket. `write_note` og `create_note` merker seg her *før* de skriver —
/// ikke etterpå — slik at merket alltid er satt før operativsystemet i det
/// hele tatt kan ha generert hendelsen som skrivet fører til. Det er dette
/// som gjør løkken umulig, ikke bare usannsynlig: det finnes ingen rekkefølge
/// hendelsene kan komme i som slipper forbi.
#[derive(Default)]
pub struct Selvskrift {
    ferske: Mutex<HashMap<PathBuf, Instant>>,
}

impl Selvskrift {
    /// Kalles rett før fila skrives, aldri etter.
    pub fn merk(&self, path: &Path) {
        self.ferske
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(path.to_path_buf(), Instant::now());
    }

    /// Er denne endringen appens egen? Merket konsumeres av spørsmålet, slik
    /// at en ekte endring på samme fil rett etterpå ikke også blir hoppet
    /// over. Utgåtte merker luftes ut i samme slag, så et notat appen skrev
    /// men aldri fikk en hendelse for ikke blir liggende for alltid.
    pub fn er_selv(&self, path: &Path) -> bool {
        let mut ferske = self.ferske.lock().unwrap_or_else(|e| e.into_inner());
        ferske.retain(|_, t| t.elapsed() < SELV_TTL);
        ferske.remove(path).is_some()
    }
}

/// Luker `event.paths` ned til relative stier til `.md`-filer inne i `dir`,
/// og legger dem i `ut`. Alt under en `.git`-komponent luftes bort her, ikke
/// lenger nede: mappa er et git-repo, og `notat sync` committer i den — uten
/// dette filteret utløser hver commit en storm av hendelser.
///
/// Egen funksjon, uavhengig av `notify`s hendelsestype, nettopp for at den
/// skal kunne testes med rene stier, uten en ekte fil-vakt i bakgrunnen.
fn samle(ut: &mut HashSet<PathBuf>, paths: &[PathBuf], dir: &Path) {
    for full in paths {
        if full.components().any(|c| c.as_os_str() == ".git") {
            continue;
        }
        if full.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        if let Ok(rel) = full.strip_prefix(dir) {
            ut.insert(rel.to_path_buf());
        }
    }
}

/// Starter overvåkingen av `dir` i en egen tråd. `on_batch` kalles fra den
/// tråden — aldri fra hovedtråden — med de relative stiene som faktisk endret
/// seg utenfra i én klase; appens egne skriv, `.git`, og filer som ikke er
/// notater er allerede luket bort når den kalles.
///
/// `notify::RecommendedWatcher`-en som returneres må appen holde i live så
/// lenge den skal overvåke — slipper man den, stopper vakten.
pub fn start(
    dir: PathBuf,
    selv: Arc<Selvskrift>,
    mut on_batch: impl FnMut(Vec<PathBuf>) + Send + 'static,
) -> notify::Result<notify::RecommendedWatcher> {
    let (tx, rx) = std::sync::mpsc::channel::<notify::Event>();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            let _ = tx.send(event);
        }
    })?;
    watcher.watch(&dir, RecursiveMode::Recursive)?;

    std::thread::spawn(move || {
        let mut samlet: HashSet<PathBuf> = HashSet::new();
        loop {
            // Vent uten tidsavbrudd på den første hendelsen i en ny klase —
            // tråden skal ikke spinne når ingenting skjer i mappen.
            let første = match rx.recv() {
                Ok(e) => e,
                Err(_) => break, // senderen er borte: appen avsluttes
            };
            samle(&mut samlet, &første.paths, &dir);

            // Resten av klasen samles opp i debounce-vinduet, som fornyes for
            // hver hendelse som kommer — en lagring som drypper hendelser over
            // tid skal fortsatt bli én klase.
            loop {
                match rx.recv_timeout(DEBOUNCE) {
                    Ok(e) => samle(&mut samlet, &e.paths, &dir),
                    Err(RecvTimeoutError::Timeout) => break,
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }

            let eksterne: Vec<PathBuf> = samlet
                .drain()
                .filter(|rel| !selv.er_selv(&dir.join(rel)))
                .collect();
            if !eksterne.is_empty() {
                on_batch(eksterne);
            }
        }
    });

    Ok(watcher)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    #[test]
    fn selvskrift_hindrer_egen_skriving_i_a_telle_som_ekstern() {
        // Dette er testen som fanger løkken: appen skriver, ser sin egen
        // endring, og skal aldri tolke den som noe å laste inn på nytt.
        let selv = Selvskrift::default();
        let sti = PathBuf::from("/notater/i-dag.md");

        selv.merk(&sti);
        assert!(selv.er_selv(&sti), "et merket skriv skal telle som eget");
        assert!(
            !selv.er_selv(&sti),
            "merket er konsumert — samme skriv skal ikke telle to ganger"
        );
    }

    #[test]
    fn en_fil_som_aldri_ble_merket_er_ekstern() {
        let selv = Selvskrift::default();
        assert!(!selv.er_selv(Path::new("/notater/umerket.md")));
    }

    #[test]
    fn git_mappe_filtreres_bort() {
        let dir = PathBuf::from("/notater");
        let mut ut = HashSet::new();
        samle(
            &mut ut,
            &[
                dir.join(".git/objects/ab/cdef"),
                dir.join("under/.git/HEAD"),
            ],
            &dir,
        );
        assert!(ut.is_empty(), ".git skal ikke utløse noe");
    }

    #[test]
    fn bare_md_filer_telles() {
        let dir = PathBuf::from("/notater");
        let mut ut = HashSet::new();
        samle(
            &mut ut,
            &[dir.join(".DS_Store"), dir.join("notat.md"), dir.join("bilde.png")],
            &dir,
        );
        assert_eq!(ut, HashSet::from([PathBuf::from("notat.md")]));
    }

    #[test]
    fn stier_utenfor_mappen_droppes() {
        let dir = PathBuf::from("/notater");
        let mut ut = HashSet::new();
        samle(&mut ut, &[PathBuf::from("/annet-sted/notat.md")], &dir);
        assert!(ut.is_empty());
    }

    /// Poller `motta` til den enten får et resultat eller går tom for tid.
    /// `notify` er ekte OS-varsling — det tar noen titalls millisekunder, så
    /// en fast liten sleep ville enten flaket eller sløst tid.
    fn vent_på<T>(motta: &mpsc::Receiver<T>, budsjett: Duration) -> Option<T> {
        motta.recv_timeout(budsjett).ok()
    }

    #[test]
    fn ny_fil_dukker_opp_i_klasen() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().canonicalize().unwrap();
        let (tx, rx) = mpsc::channel();
        let _watcher = start(dir.clone(), Arc::new(Selvskrift::default()), move |stier| {
            let _ = tx.send(stier);
        })
        .unwrap();

        std::fs::write(dir.join("nytt.md"), "# Nytt\n").unwrap();

        let stier = vent_på(&rx, Duration::from_secs(3)).expect("skulle fått en klase");
        assert_eq!(stier, vec![PathBuf::from("nytt.md")]);
    }

    #[test]
    fn slettet_fil_meldes() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().canonicalize().unwrap();
        std::fs::write(dir.join("gammelt.md"), "# Gammelt\n").unwrap();

        let (tx, rx) = mpsc::channel();
        let _watcher = start(dir.clone(), Arc::new(Selvskrift::default()), move |stier| {
            let _ = tx.send(stier);
        })
        .unwrap();

        std::fs::remove_file(dir.join("gammelt.md")).unwrap();

        let stier = vent_på(&rx, Duration::from_secs(3)).expect("skulle fått en klase");
        assert_eq!(stier, vec![PathBuf::from("gammelt.md")]);
    }

    #[test]
    fn endringer_i_git_utloser_ingenting() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().canonicalize().unwrap();
        std::fs::create_dir(dir.join(".git")).unwrap();

        let (tx, rx) = mpsc::channel();
        let _watcher = start(dir.clone(), Arc::new(Selvskrift::default()), move |stier| {
            let _ = tx.send(stier);
        })
        .unwrap();

        std::fs::write(dir.join(".git/HEAD"), "ref: refs/heads/main\n").unwrap();

        assert!(
            vent_på(&rx, Duration::from_millis(1500)).is_none(),
            "en endring i .git skal ikke meldes"
        );
    }

    #[test]
    fn eget_skriv_meldes_aldri() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().canonicalize().unwrap();
        let selv = Arc::new(Selvskrift::default());

        let (tx, rx) = mpsc::channel();
        let _watcher = start(dir.clone(), selv.clone(), move |stier| {
            let _ = tx.send(stier);
        })
        .unwrap();

        let full = dir.join("eget.md");
        // Nøyaktig mønsteret `write_note` bruker: merk, så skriv.
        selv.merk(&full);
        std::fs::write(&full, "# Eget\n").unwrap();

        assert!(
            vent_på(&rx, Duration::from_millis(1500)).is_none(),
            "appens eget skriv skal aldri utløse en klase"
        );
    }

    #[test]
    fn flere_skriv_pa_rad_blir_en_klase() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().canonicalize().unwrap();
        let (tx, rx) = mpsc::channel();
        let _watcher = start(dir.clone(), Arc::new(Selvskrift::default()), move |stier| {
            let _ = tx.send(stier);
        })
        .unwrap();

        let full = dir.join("mange.md");
        for _ in 0..5 {
            std::fs::write(&full, "endring\n").unwrap();
            std::thread::sleep(Duration::from_millis(20));
        }

        let første = vent_på(&rx, Duration::from_secs(3)).expect("skulle fått en klase");
        assert_eq!(første, vec![PathBuf::from("mange.md")]);
        assert!(
            vent_på(&rx, Duration::from_millis(800)).is_none(),
            "fem raske skriv skal gi én klase, ikke fem"
        );
    }
}

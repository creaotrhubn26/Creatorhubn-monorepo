//! Notater — skriveflate over `creatorhub_notes_indexer`.
//!
//! Appen deler notatmappe og database med kommandolinjeverktøyet `notat`, og
//! kaller indekseren som bibliotek. Ingen binær startes, ingen nettverkskall
//! gjøres: alt her er disk, git og SQLite.

mod migrering;
mod minne;
mod rettelser;
mod samtale;
mod understand;

use creatorhub_notes_indexer::{db, index, search, sti};
use serde::Serialize;
use tauri::Emitter;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

/// Én indeksering av gangen. Tauri kjører kommandoer på en trådpool, og to
/// samtidige kjøringer ville kjempe om den samme skrivetransaksjonen.
static REINDEX: Mutex<()> = Mutex::new(());

/// Løpenummer for lesninger. En ny lesning — eller [`avbryt_lesning`] — gjør
/// de eldre uinteressante: de stanser ved neste pakkeslutt, i stedet for å
/// bruke minutter på et notat brukeren har gått bort fra.
static LESNING: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    /// Sti relativt til notatmappen — samme form som `git ls-files` gir, slik
    /// at søketreff og listeoppføringer kan sammenlignes direkte.
    path: String,
    title: String,
    /// Sekunder siden epoke. Formateres på norsk i frontend.
    modified: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    path: String,
    title: String,
    /// `snippet()`-utdrag fra FTS5 med treffordene markert med `**…**`.
    snippet: String,
    start_line: usize,
    end_line: usize,
}

/// Notatmappen, opprettet og git-initiert om den mangler — som `notat` gjør.
fn notes_dir() -> Result<PathBuf, String> {
    let dir = match std::env::var("CREATORHUB_NOTATER") {
        Ok(p) if !p.is_empty() => PathBuf::from(p),
        _ => home()?.join("CreatorHub-notater"),
    };
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("kunne ikke lage {dir:?}: {e}"))?;
    }
    if !dir.join(".git").exists() {
        git(&dir, &["init", "-q"])?;
    }
    Ok(dir)
}

fn home() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .map(PathBuf::from)
        .map_err(|_| "HOME er ikke satt".to_string())
}

/// Samme fil som `notat` bruker, slik at skallverktøyet og appen deler lager.
/// Stien utledes ett sted, i indekserens `sti`-modul.
fn db_path() -> PathBuf {
    sti::standard_db(sti::Lager::Notater)
}

fn git(dir: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| format!("git {args:?} startet ikke: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "git {args:?} feilet: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Tittelen et notat vises med: første markdown-overskrift, ellers filnavnet
/// uten datoprefiks. Frontmatter ligger før overskriften og hoppes over av
/// seg selv, siden bare linjer som starter med `#` teller.
fn derive_title(rel: &str, content: &str) -> String {
    for line in content.lines().take(40) {
        let t = line.trim_start();
        if let Some(rest) = t.strip_prefix('#') {
            let heading = rest.trim_start_matches('#').trim();
            if !heading.is_empty() {
                return heading.to_string();
            }
        }
    }
    let stem = Path::new(rel)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| rel.to_string());
    strip_date_prefix(&stem).to_string()
}

/// `2026-09-10-utstyrs-tab` → `utstyrs-tab`.
fn strip_date_prefix(stem: &str) -> &str {
    let b = stem.as_bytes();
    if b.len() > 11
        && b[..10]
            .iter()
            .enumerate()
            .all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() })
        && b[10] == b'-'
    {
        &stem[11..]
    } else {
        stem
    }
}

/// Gjør en sti fra frontend om til en absolutt sti *inne i* notatmappen, eller
/// avviser den. Tillitsgrensen: alt annet her stoler på at stien er trygg.
///
/// Kanonisering skjer på mappen, ikke på fila, fordi fila kan være i ferd med
/// å bli opprettet. Symlenker ut av mappen fanges likevel, siden en symlenket
/// undermappe kanoniseres til målet sitt.
fn resolve_in(dir: &Path, rel: &str) -> Result<PathBuf, String> {
    if rel.is_empty() {
        return Err("tom sti".into());
    }
    let base = dir
        .canonicalize()
        .map_err(|e| format!("finner ikke notatmappen: {e}"))?;
    let joined = base.join(rel);
    let name = joined
        .file_name()
        .ok_or_else(|| "ugyldig filnavn".to_string())?
        .to_owned();
    let parent = joined
        .parent()
        .ok_or_else(|| "ugyldig sti".to_string())?
        .canonicalize()
        .map_err(|_| format!("finnes ikke: {rel}"))?;
    let full = parent.join(name);
    if !full.starts_with(&base) {
        return Err(format!("stien peker utenfor notatmappen: {rel}"));
    }
    if full.extension().and_then(|e| e.to_str()) != Some("md") {
        return Err(format!("bare .md-filer: {rel}"));
    }
    Ok(full)
}

fn slug(title: &str) -> String {
    let s: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c == ' ' { '-' } else { c })
        .filter(|c| c.is_ascii_alphanumeric() || "-æøå".contains(*c))
        .collect();
    let s = s.trim_matches('-').to_string();
    if s.is_empty() {
        "notat".to_string()
    } else {
        s
    }
}

/// Lager `<dato>-<slug>.md` med frontmatter og overskrift.
///
/// Med tittel: finnes fila allerede, returneres den urørt — som i `notat`, der
/// samme tittel to ganger samme dag åpner det samme notatet. Uten tittel er
/// det motsatte riktig: to trykk på «nytt notat» skal gi to notater, så navnet
/// får et løpenummer til det er ledig.
fn create_note_in(dir: &Path, title: &str, date: &str) -> Result<String, String> {
    let title = title.trim();
    let (base, heading) = if title.is_empty() {
        (format!("{date}-uten-tittel"), "Uten tittel")
    } else {
        (format!("{date}-{}", slug(title)), title)
    };

    let mut name = format!("{base}.md");
    if title.is_empty() {
        let mut n = 2;
        while dir.join(&name).exists() {
            name = format!("{base}-{n}.md");
            n += 1;
        }
    }

    let full = dir.join(&name);
    if !full.exists() {
        let id = name.trim_end_matches(".md");
        let body = format!("---\nid: {id}\ntype: \n---\n\n# {heading}\n\n");
        std::fs::write(&full, body).map_err(|e| format!("kunne ikke skrive {name}: {e}"))?;
    }
    Ok(name)
}

/// Dagens dato lokalt. `date` er riktig verktøy for jobben: lokal tidssone
/// uten å dra inn en dato-crate for én linje.
fn today() -> String {
    Command::new("date")
        .arg("+%F")
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| s.len() == 10)
        .unwrap_or_else(|| "0000-00-00".to_string())
}

fn collect_notes(dir: &Path, base: &Path, out: &mut Vec<Note>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            collect_notes(&path, base, out);
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let rel = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .into_owned();
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            out.push(Note {
                title: derive_title(&rel, &content),
                path: rel,
                modified,
            });
        }
    }
}

/// Stager og indekserer. `git add -A` er ikke pynt: indekseren lister filer med
/// `git ls-files -s` og hopper over filer med uendret blob-hash, så et notat
/// som aldri er lagt til git er usynlig for søk, og en endring som ikke er
/// staget har fortsatt den gamle hashen. Staging (ikke commit) gir fersk hash
/// uten å lage en commit per tastetrykk; `notat sync` committer når brukeren
/// vil ha et punktum i historikken.
fn reindex_in(notes: &Path, db_file: &Path) -> Result<String, String> {
    let _guard = REINDEX.lock().unwrap_or_else(|e| e.into_inner());
    git(notes, &["add", "-A"])?;
    let conn = db::open(db_file)
        .map_err(|e| format!("klarte ikke å gjøre notatene søkbare: {e}"))?;
    let report =
        index::run_no_embed(&conn, notes)
        .map_err(|e| format!("klarte ikke å gjøre notatene søkbare: {e}"))?;
    Ok(format!(
        "{} filer, {} biter",
        report.files, report.chunks
    ))
}

#[tauri::command]
fn list_notes() -> Result<Vec<Note>, String> {
    let dir = notes_dir()?;
    let mut out = Vec::new();
    collect_notes(&dir, &dir, &mut out);
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    let dir = notes_dir()?;
    let full = resolve_in(&dir, &path)?;
    std::fs::read_to_string(&full).map_err(|e| format!("kunne ikke lese {path}: {e}"))
}

#[tauri::command]
fn write_note(path: String, content: String) -> Result<(), String> {
    let dir = notes_dir()?;
    let full = resolve_in(&dir, &path)?;
    std::fs::write(&full, content).map_err(|e| format!("kunne ikke lagre {path}: {e}"))
}

#[tauri::command]
fn create_note(title: String) -> Result<String, String> {
    let dir = notes_dir()?;
    create_note_in(&dir, &title, &today())
}

#[tauri::command]
fn search_notes(query: String) -> Result<Vec<SearchHit>, String> {
    let dir = notes_dir()?;
    let conn = db::open(&db_path()).map_err(|e| format!("klarte ikke å søke: {e}"))?;
    let hits = search::text(&conn, &query, 80).map_err(|e| format!("klarte ikke å søke: {e}"))?;

    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for hit in hits {
        if !seen.insert(hit.path.clone()) {
            continue;
        }
        // Indeksen kan inneholde rader fra andre repoer. Bare treff som
        // faktisk ligger i notatmappen vises.
        let Ok(full) = resolve_in(&dir, &hit.path) else {
            continue;
        };
        let Ok(content) = std::fs::read_to_string(&full) else {
            continue;
        };
        out.push(SearchHit {
            title: derive_title(&hit.path, &content),
            path: hit.path,
            snippet: hit.text,
            start_line: hit.start_line,
            end_line: hit.end_line,
        });
        if out.len() == 40 {
            break;
        }
    }
    Ok(out)
}

/// Leser notatet og sier hva det har forstått. Feiler kallet — `claude` finnes
/// ikke, er ikke innlogget, eller bruker for lang tid — svarer den «av», og
/// panelet viser én rolig linje. Ingen feilmelding: brukeren har ikke bedt om
/// noe her, og skriving, lagring og søk går som før.
///
/// Hukommelsen holdes låst gjennom kallet. Det serialiserer to lagringer som
/// kommer tett — som er det man vil: den andre finner arbeidet den første
/// gjorde, i stedet for å betale for det på nytt.
///
/// Lange kilder leses pakke for pakke, og hver pakke skrives før neste kall
/// gjøres. Panelet får delresultatet som hendelsen `forstår` underveis, og
/// det som er skrevet står selv om en senere pakke feiler eller lesningen
/// forlates. `synlig` er `[fra, til]` i UTF-16-enheter — området brukeren ser
/// på skjermen, som klassifiseres først.
#[tauri::command]
fn understand_note(
    app: tauri::AppHandle,
    content: String,
    path: String,
    synlig: Option<[usize; 2]>,
) -> Result<understand::Understanding, String> {
    // Løpenummeret tas før låsen. Står en lang lesning og kjører, er det
    // nettopp dette som forteller den at brukeren har gått videre — hadde vi
    // ventet på låsen først, ville beskjeden kommet etter at den var ferdig.
    let min = LESNING.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
    let gjelder_fortsatt = || LESNING.load(std::sync::atomic::Ordering::SeqCst) == min;

    let mut base = base().ok();
    let biter = understand::split(&content);

    // Er kilden en samtale, er hvert avsnitt ett innlegg med avsenderen først.
    // Da bæres avsenderen med hele veien: inn i `avsnitt`-raden, ut i panelet,
    // og videre til det strukturerte søket. Er den det ikke, er alt som før.
    let er_samtale = samtale::er_samtale(&content);
    let avsendere: Vec<Option<String>> = if er_samtale {
        biter.iter().map(|c| samtale::avsender(&c.text)).collect()
    } else {
        Vec::new()
    };

    // Låsen tas før noe skrives. To lagringer som kommer tett skal ikke skrive
    // avsnittsradene for den samme kilden samtidig.
    let mut memo = understand::memo().lock().unwrap_or_else(|e| e.into_inner());

    let eksempler = base
        .as_ref()
        .and_then(|c| minne::eksempler(c, minne::ANTALL_EKSEMPLER).ok())
        .unwrap_or_default();

    // Identiteten først: hvert avsnitt får id-en sin, og et avsnitt som bare
    // har fått rettet en skrivefeil beholder den id-en det hadde. Det er dette
    // rettelser og relasjoner henger på, og det skjer uavhengig av om
    // klassifiseringen lykkes.
    let ider: Option<Vec<i64>> = base.as_mut().and_then(|conn| {
        let tekster: Vec<String> = biter.iter().map(|c| c.text.clone()).collect();
        minne::synk(conn, &path, &tekster, &avsendere).ok()
    });

    // Alt som er forstått før hentes inn før klassifiseringen. Det er dette
    // som gjør at et notat fra i går ikke koster et eneste kall i dag.
    if let Some(conn) = &base {
        let hasher: Vec<String> = biter.iter().map(|c| understand::nøkkel(&c.text)).collect();
        if let Ok(kjente) = minne::kjente(conn, &hasher) {
            for (nøkkel, label) in kjente {
                memo.entry(nøkkel).or_insert(label);
            }
        }
    }

    let cli = if er_samtale {
        understand::Cli::over_samtale(eksempler)
    } else {
        understand::Cli::new(eksempler)
    };
    let tittel = derive_title(&path, &content);

    // Etter hver pakke: skriv, si ifra, og se om lesningen fortsatt gjelder.
    // Det er dette som gjør delresultatet gyldig — feiler pakke fire, står
    // pakke én til tre allerede i basen.
    let lest = {
        let base = &base;
        let biter = &biter;
        let ider = ider.as_deref().unwrap_or(&[]);
        let tittel = &tittel;
        let app = &app;
        let mut etter_pakke = |ferske: &[understand::Paragraph], lest, totalt| {
            let mut ferske = ferske.to_vec();
            understand::sett_ider(&mut ferske, biter, ider);
            sett_avsendere(&mut ferske, er_samtale);
            if let Some(conn) = base {
                let _ = minne::lagre(conn, tittel, &ferske);
            }
            let _ = app.emit(
                "forstår",
                understand::Framdrift { lesning: min, lest, totalt, paragraphs: ferske },
            );
            gjelder_fortsatt()
        };
        understand::understand(
            &content,
            &cli,
            &mut memo,
            synlig.map(|s| (s[0], s[1])),
            &mut etter_pakke,
        )
    };

    let Ok(mut avsnitt) = lest else {
        return Ok(understand::Understanding::off());
    };
    understand::sett_ider(&mut avsnitt, &biter, ider.as_deref().unwrap_or(&[]));
    sett_avsendere(&mut avsnitt, er_samtale);
    // Hukommelsen holdes låst hele veien. Det serialiserer to lagringer som
    // kommer tett — som er det man vil: den andre finner arbeidet den første
    // gjorde, i stedet for å betale for det på nytt.

    // Rettelsene er det beste vi har, men de er ikke verdt å felle panelet
    // for: klarer vi ikke å åpne basen, står linjene der som systemet leste
    // dem, og brukeren merker ingenting annet.
    let mut lest_på_nytt = Vec::new();
    let mut tidligere = Vec::new();
    if let Some(conn) = &base {
        let _ = minne::lagre(conn, &tittel, &avsnitt);
        // Kryssnotat-minnet koster egne modellkall. Er lesningen forlatt, er
        // det arbeid for et notat brukeren har gått bort fra.
        if gjelder_fortsatt() {
            tidligere = minne::tidligere(conn, &avsnitt, &cli).unwrap_or_default();
        }

        // Avsnittene i teksten, ikke linjene i panelet: en linje kan mangle
        // fordi klassifiseringen ikke fikk lest den, og da er rettelsen
        // fortsatt god — teksten står jo der.
        //
        // Bare når identiteten faktisk ble satt. Feilet den, vet vi ikke hvilke
        // avsnitt som finnes, og å foreldde alle rettelsene på en gjetning er
        // den ene feilen som koster brukeren noe hun ikke kan skrive om igjen.
        if let Some(ider) = &ider {
            let nåværende = ider.iter().copied().collect();
            lest_på_nytt = rettelser::foreldede(conn, &path, &nåværende).unwrap_or_default();
        }
        if let Ok(mine) = rettelser::aktive(conn, &path) {
            rettelser::merge(&mut avsnitt, &mine);
        }
    }

    let mut ut = understand::Understanding::on(avsnitt, lest_på_nytt);
    ut.earlier = tidligere;
    ut.lesning = min;
    Ok(ut)
}

/// Hvem som sa hva, satt på linjene panelet får. Avsenderen leses ut av
/// avsnittsteksten, som er nøyaktig den linja som står i fila — det er derfor
/// den overlever at appen lukkes, uten at noe måtte lagres for å få den fram.
///
/// Bare når kilden er en samtale. Et vanlig notat med «Marius: ja» i seg skal
/// ikke plutselig få deltakere.
fn sett_avsendere(avsnitt: &mut [understand::Paragraph], er_samtale: bool) {
    for a in avsnitt.iter_mut() {
        a.avsender = if er_samtale { samtale::avsender(&a.text) } else { None };
    }
}

/// Er dette limt inn en samtale? Svarer med innleggene skrevet om til
/// markdown, eller `null` når teksten ikke er gjenkjent som en samtale — da
/// limes den inn som den er, og blir et vanlig notat.
///
/// Regelbasert og umiddelbar: ingen modell, ingen nettverk. Den kjører mellom
/// ⌘V og at teksten står på skjermen.
#[tauri::command]
fn importer_samtale(tekst: String) -> Option<String> {
    samtale::del(&tekst).map(|innlegg| samtale::skriv(&innlegg))
}

/// Hvordan notatet leses nå — som samtale eller som notat, gjenkjent eller
/// bestemt av brukeren, og med hvem som er med.
#[tauri::command]
fn samtaleform(innhold: String) -> samtale::Form {
    samtale::form(&innhold)
}

/// Brukerens overstyring: «dette er en samtale» eller «dette er det ikke».
/// Svaret er hele notatet med `kilde` satt i toppfeltet, slik at valget står i
/// fila og gjelder neste gang også.
#[tauri::command]
fn sett_samtale(innhold: String, er_samtale: bool) -> String {
    let verdi = if er_samtale { samtale::SAMTALE } else { samtale::NOTAT };
    samtale::sett_kilde(&innhold, verdi)
}

/// Brukeren har gått videre. Lesningen som kjører forlates ved neste
/// pakkeslutt; det den rakk å skrive står. Panelet kaller dette når det er i
/// ferd med å be om en ny lesning mens en gammel fortsatt går.
#[tauri::command]
fn avbryt_lesning() {
    LESNING.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
}

/// Svarer på et spørsmål om det som er forstått, når søket er ett. Er det et
/// vanlig søk, svarer den ingenting, og fritekstsøket står alene.
#[tauri::command]
fn spor_notater(query: String) -> Result<Option<minne::Svar>, String> {
    let conn = base()?;
    minne::spør(&conn, &query).map_err(|e| format!("klarte ikke å søke: {e}"))
}

/// Hvor et avsnitt står i et notat. Brukes når en linje under «Tidligere om
/// dette» åpner notatet den peker på.
#[tauri::command]
fn finn_avsnitt(path: String, hash: String) -> Result<Option<[usize; 2]>, String> {
    let dir = notes_dir()?;
    let full = resolve_in(&dir, &path)?;
    let innhold =
        std::fs::read_to_string(&full).map_err(|e| format!("kunne ikke lese {path}: {e}"))?;
    Ok(minne::posisjon(&innhold, &hash).map(|(a, b)| [a, b]))
}

/// Basen appen allerede bruker, med app-tabellene på plass.
///
/// Migreringen kjører først og gjør ingenting når skjemaet alt er nytt. Den må
/// stå foran `sørg_for_*`, som bare lager tabeller som mangler og derfor ville
/// latt et gammelt skjema stå urørt.
fn base() -> Result<rusqlite::Connection, String> {
    let fil = db_path();
    let mut conn = db::open(&fil).map_err(|e| format!("fikk ikke åpnet notatbasen: {e}"))?;
    migrering::kjør(&mut conn, Some(&fil))
        .map_err(|e| format!("fikk ikke migrert notatbasen: {e}"))?;
    rettelser::sørg_for_tabell(&conn).map_err(|e| format!("fikk ikke åpnet notatbasen: {e}"))?;
    minne::sørg_for_tabeller(&conn).map_err(|e| format!("fikk ikke åpnet notatbasen: {e}"))?;
    Ok(conn)
}

/// Lagrer brukerens egen retting av én linje, eller tar den bort igjen —
/// som er det angre gjør når det ikke var noen rettelse fra før.
#[tauri::command]
fn rett_avsnitt(retting: rettelser::Retting) -> Result<(), String> {
    if let Some(plass) = retting.plass.as_deref() {
        if !rettelser::PLASSER.contains(&plass) && plass != rettelser::FJERNET {
            return Err(format!("ukjent plass: {plass}"));
        }
    }
    let conn = base()?;
    rettelser::lagre(&conn, &retting).map_err(|e| format!("kunne ikke lagre rettelsen: {e}"))
}

#[tauri::command]
fn reindex() -> Result<String, String> {
    let dir = notes_dir()?;
    reindex_in(&dir, &db_path())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_notes,
            read_note,
            write_note,
            create_note,
            search_notes,
            reindex,
            understand_note,
            avbryt_lesning,
            rett_avsnitt,
            spor_notater,
            finn_avsnitt,
            importer_samtale,
            samtaleform,
            sett_samtale
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tittel_hentes_fra_forste_overskrift() {
        let md = "---\nid: 2026-09-10-utstyr\ntype: \n---\n\n# Utstyrs-tab\n\ntekst\n";
        assert_eq!(derive_title("2026-09-10-utstyr.md", md), "Utstyrs-tab");
        assert_eq!(derive_title("a.md", "## Nivå to\n"), "Nivå to");
    }

    #[test]
    fn tittel_faller_tilbake_til_filnavn_uten_dato() {
        assert_eq!(
            derive_title("2026-09-10-utstyrs-tab.md", "bare brødtekst\n"),
            "utstyrs-tab"
        );
        assert_eq!(derive_title("løse-tanker.md", ""), "løse-tanker");
        // `#` uten tekst er ikke en tittel.
        assert_eq!(derive_title("x.md", "#\n#  \n"), "x");
    }

    #[test]
    fn stier_utenfor_notatmappen_avvises() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path();
        std::fs::write(dir.join("ok.md"), "# ok").unwrap();
        std::fs::create_dir(dir.join("under")).unwrap();

        assert!(resolve_in(dir, "ok.md").is_ok());
        assert!(resolve_in(dir, "under/nytt.md").is_ok(), "fil som ikke finnes ennå er lov");

        for ond in ["../ond.md", "under/../../ond.md", "/etc/passwd.md", ""] {
            assert!(
                resolve_in(dir, ond).is_err(),
                "{ond} skulle vært avvist"
            );
        }
        assert!(resolve_in(dir, "ok.txt").is_err(), "bare .md");
    }

    #[test]
    fn symlenke_ut_av_mappen_avvises() {
        let tmp = tempfile::tempdir().unwrap();
        let utenfor = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(utenfor.path(), tmp.path().join("lenke")).unwrap();
        assert!(resolve_in(tmp.path(), "lenke/ond.md").is_err());
    }

    #[test]
    fn nytt_notat_far_dato_frontmatter_og_overskrift() {
        let tmp = tempfile::tempdir().unwrap();
        let name = create_note_in(tmp.path(), "Utstyrs-tab: bør ryddes", "2026-09-10").unwrap();
        assert_eq!(name, "2026-09-10-utstyrs-tab-bør-ryddes.md");

        let body = std::fs::read_to_string(tmp.path().join(&name)).unwrap();
        assert!(body.starts_with("---\nid: 2026-09-10-utstyrs-tab-bør-ryddes\ntype: \n---\n"));
        assert!(body.contains("# Utstyrs-tab: bør ryddes\n"));
        assert_eq!(derive_title(&name, &body), "Utstyrs-tab: bør ryddes");

        // Samme tittel samme dag åpner det samme notatet, uten å nullstille det.
        std::fs::write(tmp.path().join(&name), "# endret\n").unwrap();
        let igjen = create_note_in(tmp.path(), "Utstyrs-tab: bør ryddes", "2026-09-10").unwrap();
        assert_eq!(igjen, name);
        assert_eq!(
            std::fs::read_to_string(tmp.path().join(&name)).unwrap(),
            "# endret\n"
        );
    }

    #[test]
    fn to_notater_uten_tittel_samme_dag_blir_to_filer() {
        let tmp = tempfile::tempdir().unwrap();
        let a = create_note_in(tmp.path(), "   ", "2026-09-10").unwrap();
        let b = create_note_in(tmp.path(), "", "2026-09-10").unwrap();
        assert_eq!(a, "2026-09-10-uten-tittel.md");
        assert_eq!(b, "2026-09-10-uten-tittel-2.md");
        assert!(std::fs::read_to_string(tmp.path().join(&a))
            .unwrap()
            .contains("# Uten tittel"));
    }

    /// Rettelsene bor i den samme fila som indeksen. Tabellen skal kunne lages
    /// på toppen av det skjemaet uten å kollidere med noe, og tåle å bli laget
    /// igjen ved hver oppstart.
    #[test]
    fn rettelsestabellen_lever_side_om_side_med_indeksen() {
        let tmp = tempfile::tempdir().unwrap();
        let db_file = tmp.path().join("notater.db");
        let mut conn = db::open(&db_file).unwrap();
        rettelser::sørg_for_tabell(&conn).unwrap();
        rettelser::sørg_for_tabell(&conn).unwrap();
        minne::sørg_for_tabeller(&conn).unwrap();

        let id = minne::synk(&mut conn, "notat.md", &["En tanke.".to_string()], &[]).unwrap()[0];
        rettelser::lagre(
            &conn,
            &rettelser::Retting {
                avsnitt_id: id,
                sti: "notat.md".into(),
                tekst: "En tanke.".into(),
                lest_type: "beslutning".into(),
                lest_handling: "bygg".into(),
                lest_kortform: "Noe".into(),
                plass: Some("idé".into()),
                kortform: Some("Noe annet".into()),
            },
        )
        .unwrap();
        assert_eq!(
            rettelser::aktive(&conn, "notat.md").unwrap().get(&id).unwrap().summary,
            "Noe annet"
        );
    }

    #[test]
    fn en_plass_panelet_ikke_har_avvises() {
        let ugyldig = rettelser::Retting {
            avsnitt_id: 1,
            sti: "notat.md".into(),
            tekst: "En tanke.".into(),
            lest_type: "beslutning".into(),
            lest_handling: "bygg".into(),
            lest_kortform: "Noe".into(),
            plass: Some("marker_åpent".into()),
            kortform: Some("Noe".into()),
        };
        assert!(rett_avsnitt(ugyldig).is_err(), "vokabularet vårt er ikke en plass");
    }

    /// Forståelsen bor i den samme fila som indeksen og rettelsene. Den skal
    /// legges på toppen av det skjemaet uten å kollidere med `chunk_fts`, tåle
    /// å bli laget igjen ved hver oppstart, og fortsatt være der etter at
    /// basen er lukket og åpnet på nytt — det er hele poenget med å lagre den.
    #[test]
    fn forståelsen_ligger_i_samme_fil_og_overlever_at_den_lukkes() {
        let tmp = tempfile::tempdir().unwrap();
        let db_file = tmp.path().join("notater.db");
        let tekst = "Kanskje vi burde ha depositum.";

        {
            let mut conn = db::open(&db_file).unwrap();
            rettelser::sørg_for_tabell(&conn).unwrap();
            minne::sørg_for_tabeller(&conn).unwrap();
            minne::sørg_for_tabeller(&conn).unwrap();
            let id = minne::synk(&mut conn, "notat.md", &[tekst.to_string()], &[]).unwrap()[0];
            let avsnitt = vec![understand::Paragraph {
                id,
                start: 0,
                end: 0,
                hash: understand::nøkkel(tekst),
                text: tekst.into(),
                summary: "Depositum".into(),
                avsender: None,
                kind: "tvil".into(),
                action: "marker_åpent".into(),
                dependency: None,
                correction: None,
            }];
            minne::lagre(&conn, "Låne-app", &avsnitt).unwrap();
        }

        // Ny prosess, samme fil.
        let conn = db::open(&db_file).unwrap();
        rettelser::sørg_for_tabell(&conn).unwrap();
        minne::sørg_for_tabeller(&conn).unwrap();

        let kjente = minne::kjente(&conn, &[understand::nøkkel(tekst)]).unwrap();
        assert_eq!(kjente.len(), 1, "det som er lest før skal fortsatt være lest");
        assert_eq!(kjente.values().next().unwrap().summary, "Depositum");

        // Og ordsøket over kortformene virker på fila, side om side med
        // indeksens egen `chunk_fts`.
        let treff = minne::kandidater(&conn, "Depositum tar vi likevel.", 0, 5).unwrap();
        assert_eq!(treff.len(), 1);
        assert_eq!(treff[0].tittel, "Låne-app");

        let uavklart = minne::spør(&conn, "hva er uavklart").unwrap().unwrap();
        assert_eq!(uavklart.treff.len(), 1);
    }

    /// Hele poenget med staging før indeksering: et notat som nettopp ble
    /// skrevet, og aldri committet, skal kunne finnes igjen med søk.
    #[test]
    fn ustaget_notat_blir_sokbart_etter_reindeksering() {
        let tmp = tempfile::tempdir().unwrap();
        let notes = tmp.path().join("notater");
        std::fs::create_dir(&notes).unwrap();
        git(&notes, &["init", "-q"]).unwrap();
        let db_file = tmp.path().join("notater.db");

        let name = create_note_in(&notes, "Forhandler-firmware", "2026-09-10").unwrap();
        std::fs::write(
            notes.join(&name),
            "# Forhandler-firmware\n\nMotoren låste seg på ratatoskr-oppdateringen.\n",
        )
        .unwrap();

        reindex_in(&notes, &db_file).unwrap();

        let conn = db::open(&db_file).unwrap();
        let hits = search::text(&conn, "ratatoskr", 5).unwrap();
        assert_eq!(hits.len(), 1, "notatet skulle vært søkbart uten commit");
        assert_eq!(hits[0].path, name);
        assert!(hits[0].text.contains("ratatoskr"));
    }

    /// Delresultat er gyldig, hele veien ned i basen. Dette er nøyaktig det
    /// `understand_note` gjør mellom pakkene — skriver, og lar det stå.
    /// Feiler pakke tre, står pakke én og to i `forstatt` etterpå.
    #[test]
    fn en_feil_i_tredje_pakke_lar_de_to_første_stå_i_basen() {
        use std::sync::atomic::{AtomicUsize, Ordering};

        /// Klassifiserer to pakker og feiler på den tredje.
        struct Toav3(AtomicUsize);
        impl understand::Classifier for Toav3 {
            fn ask(&self, texts: &[String]) -> Result<String, String> {
                if self.0.fetch_add(1, Ordering::Relaxed) >= 2 {
                    return Err("pakke tre feilet".into());
                }
                Ok(svar(texts))
            }
        }

        /// Teller hvor mange avsnitt som faktisk ble sendt.
        struct Teller<'a>(&'a AtomicUsize);
        impl understand::Classifier for Teller<'_> {
            fn ask(&self, texts: &[String]) -> Result<String, String> {
                self.0.fetch_add(texts.len(), Ordering::Relaxed);
                Ok(svar(texts))
            }
        }

        fn svar(texts: &[String]) -> String {
            texts
                .iter()
                .enumerate()
                .map(|(i, t)| format!("{}|beslutning|bygg|{}", i + 1, t.trim()))
                .collect::<Vec<_>>()
                .join("\n")
        }

        let per_pakke = understand::AVSNITT_PER_PAKKE;
        let doc = (1..=per_pakke * 4)
            .map(|i| format!("Innlegg {i} slår fast noe eget."))
            .collect::<Vec<_>>()
            .join("\n\n");

        let tmp = tempfile::tempdir().unwrap();
        let mut conn = base_i(&tmp.path().join("notater.db"));
        let biter = understand::split(&doc);
        let tekster: Vec<String> = biter.iter().map(|c| c.text.clone()).collect();
        let ider = minne::synk(&mut conn, "samtale.md", &tekster, &[]).unwrap();

        let mut memo = understand::Memo::new();
        understand::understand(
            &doc,
            &Toav3(AtomicUsize::new(0)),
            &mut memo,
            None,
            &mut |nye, _, _| {
                let mut nye = nye.to_vec();
                understand::sett_ider(&mut nye, &biter, &ider);
                minne::lagre(&conn, "Samtale", &nye).unwrap();
                true
            },
        )
        .expect("to pakker kom fram");

        let i_basen: i64 = conn
            .query_row("select count(*) from forstatt", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            i_basen as usize,
            per_pakke * 2,
            "de to pakkene som lyktes skal stå igjen, ingenting rullet tilbake"
        );

        // Og andre kjøring tar bare det som mangler.
        let resten = AtomicUsize::new(0);
        understand::les(&doc, &Teller(&resten), &mut memo).unwrap();
        assert_eq!(
            resten.load(Ordering::Relaxed),
            per_pakke * 2,
            "bare avsnittene som manglet skal sendes andre gang"
        );
    }

    /// Basen slik `base()` bygger den, men på en fil testen eier.
    fn base_i(fil: &Path) -> rusqlite::Connection {
        let mut conn = db::open(fil).unwrap();
        migrering::kjør(&mut conn, Some(fil)).unwrap();
        rettelser::sørg_for_tabell(&conn).unwrap();
        minne::sørg_for_tabeller(&conn).unwrap();
        conn
    }

    /// Avsenderen følger med hele veien til panelet: fra fila, gjennom
    /// lesningen, ut i linjene grensesnittet viser. Og to like setninger fra
    /// to avsendere er to linjer, ikke én — det er beviset på at
    /// identitetsarbeidet løste det det skulle.
    #[test]
    fn avsenderen_følger_med_til_panelet() {
        let limt = "Marius: Vi går for Stripe.\n\
                    Kari: Vi går for Stripe.\n\
                    Marius: Da er vi enige.";
        let innlegg = samtale::del(limt).expect("dette er en samtale");
        let fil = format!(
            "---\nid: 2026-09-13-betaling\nkilde: samtale\n---\n\n# Betaling\n\n{}\n",
            samtale::skriv(&innlegg)
        );
        // Sannheten er markdown på disk. Går appen bort, står samtalen igjen i
        // lesbar tekst — og appen leser den tilbake til de samme innleggene.
        let tmp = tempfile::tempdir().unwrap();
        let sti = tmp.path().join("2026-09-13-betaling.md");
        std::fs::write(&sti, &fil).unwrap();
        let fra_disk = std::fs::read_to_string(&sti).unwrap();
        assert!(fra_disk.contains("Marius: Vi går for Stripe."), "et menneske kan lese den");
        assert!(samtale::er_samtale(&fra_disk));
        let fil = fra_disk;

        struct Alle;
        impl understand::Classifier for Alle {
            fn ask(&self, texts: &[String]) -> Result<String, String> {
                Ok(texts
                    .iter()
                    .enumerate()
                    .map(|(i, t)| format!("{}|beslutning|bygg|{}", i + 1, t.trim()))
                    .collect::<Vec<_>>()
                    .join("\n"))
            }
        }

        let mut memo = understand::Memo::new();
        let mut avsnitt = understand::les(&fil, &Alle, &mut memo).unwrap();
        assert_eq!(avsnitt.len(), 3, "overskriften og toppfeltet er ikke innlegg");
        sett_avsendere(&mut avsnitt, true);

        let sagt_av: Vec<Option<&str>> =
            avsnitt.iter().map(|a| a.avsender.as_deref()).collect();
        assert_eq!(sagt_av, vec![Some("Marius"), Some("Kari"), Some("Marius")]);

        // Samme setning fra to avsendere: to linjer, to klassifiseringer.
        assert_ne!(avsnitt[0].hash, avsnitt[1].hash);
        assert_eq!(memo.len(), 3);

        // Og i et vanlig notat står det ingen avsender, selv om teksten
        // skulle ligne.
        sett_avsendere(&mut avsnitt, false);
        assert!(avsnitt.iter().all(|a| a.avsender.is_none()));
    }
}

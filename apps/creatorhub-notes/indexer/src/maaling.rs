//! Måler gjenfinning på norsk mot datasettet i
//! `tests/fixtures/gjenfinning/`: bøyde former, bestemt form, flertall,
//! genitiv og sammensetninger.
//!
//! Den ligger her og ikke i `tests/` fordi målestokken — bølge 1s spørring,
//! uten bøyning og uten prefiks — er den private `quote_fts_query`. Å måle
//! mot en gjenskrevet kopi av den ville vært å måle mot noe annet enn koden
//! som faktisk kjørte.
//!
//! Kjør med utskrift:
//! `cargo test --lib maaling -- --nocapture`
//!
//! Tallene står i `../../klassifiseringstest/GJENFINNING.md`.
//!
//! `fullformsliste-projeksjon.txt` i fiksturen er hentet ut av Norsk Ordbank
//! bokmål 2005 fra Språkbanken ved Nasjonalbiblioteket, CC BY 4.0. Bare de
//! lemmaene datasettets søkeord berører er med — utvidelsen slår opp ordet,
//! finner lemmaene og henter formene, så en projeksjon på nettopp de
//! lemmaene svarer likt som hele lista på 1 143 887 former.

use super::{kjør, quote_fts_query, Bøyning};
use crate::{chunk, db, ordbank};
use rusqlite::Connection;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

const GRENSE: usize = 20;

fn fikstur() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/gjenfinning")
}

struct Sporring {
    q: String,
    treff: BTreeSet<String>,
    sammensetning: BTreeSet<String>,
}

/// Leser `sporringer.toml`. Håndskrevet fordi den eneste alternativen var å
/// dra `serde` inn i to nye strukturer for fire felt.
fn datasett() -> Vec<Sporring> {
    let tekst = std::fs::read_to_string(fikstur().join("sporringer.toml")).unwrap();
    let verdi: toml::Value = tekst.parse().unwrap();
    verdi["sporring"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| {
            let liste = |navn: &str| -> BTreeSet<String> {
                s[navn]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|v| format!("notater/{}", v.as_str().unwrap()))
                    .collect()
            };
            Sporring {
                q: s["q"].as_str().unwrap().to_string(),
                treff: liste("treff"),
                sammensetning: liste("sammensetning"),
            }
        })
        .collect()
}

/// Korpuset i en fersk base. Bitene lages av `chunk::split`, samme vei som i
/// en ekte indeksering — også hodefeltet med filstien, så det som eventuelt
/// forurenser indeksen forurenser målingen også.
fn korpus(sti: &Path) -> Connection {
    let conn = db::open(sti).unwrap();
    let mut filer: Vec<PathBuf> = std::fs::read_dir(fikstur().join("notater"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect();
    filer.sort();
    for fil in filer {
        let rel = format!("notater/{}", fil.file_name().unwrap().to_string_lossy());
        let innhold = std::fs::read_to_string(&fil).unwrap();
        for bit in chunk::split(&rel, &innhold) {
            conn.execute(
                "insert into chunks(source, path, start_line, end_line, text) \
                 values ('code', ?1, ?2, ?3, ?4)",
                rusqlite::params![rel, bit.start_line as i64, bit.end_line as i64, bit.text],
            )
            .unwrap();
        }
    }
    conn
}

fn stier(treff: Vec<super::Hit>) -> BTreeSet<String> {
    treff.into_iter().map(|h| h.path).collect()
}

#[derive(Default, Debug, PartialEq)]
struct Sum {
    ekte: usize,
    sammensetning: usize,
    falske: usize,
    /// Ekte treff som ikke kom med.
    tapte: usize,
}

impl Sum {
    fn tell(&mut self, s: &Sporring, fikk: &BTreeSet<String>) -> Vec<String> {
        let mut falske = Vec::new();
        for sti in fikk {
            if s.treff.contains(sti) {
                self.ekte += 1;
            } else if s.sammensetning.contains(sti) {
                self.sammensetning += 1;
            } else {
                self.falske += 1;
                falske.push(sti.trim_start_matches("notater/").to_string());
            }
        }
        self.tapte += s.treff.difference(fikk).count();
        falske
    }
}

/// Én runde, uten andre runde. Med en tom bøyning er dette bølge 1 —
/// ordet slik det ble skrevet. Med ordbanken er det bøyning uten prefiks,
/// altså svaret på om sammensetningene er verdt det de koster.
fn en_runde(conn: &Connection, q: &str, bøy: Bøyning) -> BTreeSet<String> {
    match quote_fts_query(q, bøy, false) {
        Some(fts) => stier(kjør(conn, &fts, GRENSE).unwrap()),
        None => BTreeSet::new(),
    }
}

fn rad(navn: &str, s: &Sum) {
    println!(
        "| {navn:24} | {:5} | {:5} | {:5} | {:5} |",
        s.ekte, s.sammensetning, s.falske, s.tapte
    );
}

#[test]
fn boeyning_gir_flere_ekte_treff_enn_den_koster_i_falske() {
    let dir = tempfile::tempdir().unwrap();
    let uten = korpus(&dir.path().join("uten.db"));
    let med = korpus(&dir.path().join("med.db"));
    let n = ordbank::load(&med, &fikstur().join("fullformsliste-projeksjon.txt")).unwrap();
    assert!(n > 0, "ordbankfiksturen må lastes");
    assert_eq!(ordbank::status(&uten), ordbank::Status::Mangler);

    let tom: Bøyning = &|_| Vec::new();
    let bøy: Bøyning = &|ord: &str| ordbank::former(&med, ord);

    let d = datasett();
    let (mut a, mut b, mut c, mut e) =
        (Sum::default(), Sum::default(), Sum::default(), Sum::default());
    let mut støy = Vec::new();
    for s in &d {
        a.tell(s, &en_runde(&uten, &s.q, tom));
        b.tell(s, &stier(super::text(&uten, &s.q, GRENSE).unwrap()));
        e.tell(s, &en_runde(&med, &s.q, bøy));
        let falske = c.tell(s, &stier(super::text(&med, &s.q, GRENSE).unwrap()));
        if !falske.is_empty() {
            støy.push(format!("  {:22} {}", s.q, falske.join(", ")));
        }
    }

    println!("\n{} spørringer over {} notater\n", d.len(), 23);
    println!("| {:24} | {:5} | {:5} | {:5} | {:5} |", "", "ekte", "samm", "falsk", "tapt");
    println!("|{:-<26}|{:-<7}|{:-<7}|{:-<7}|{:-<7}|", "", "", "", "", "");
    rad("bølge 1", &a);
    rad("bølge 3 uten ordlista", &b);
    rad("bølge 3, kun bøyning", &e);
    rad("bølge 3 med ordlista", &c);
    println!("\nfalske treff med ordlista:");
    for linje in &støy {
        println!("{linje}");
    }
    println!();

    // Hovedsaken: bøyningen skal gi flere ekte treff enn bølge 1 gjorde.
    assert!(
        c.ekte > a.ekte,
        "bøyning må gi flere ekte treff: bølge 1 hadde {}, med ordlista {}",
        a.ekte,
        c.ekte
    );
    // Og den skal ikke betale for dem med et arkiv av falske. Terskelen er
    // satt over det målte tallet, ikke på det: den skal fange en forverring,
    // ikke velte på at ett notat rangerer annerledes.
    assert!(
        c.falske <= 4,
        "for mange falske treff med ordlista: {} (bølge 1 hadde {})",
        c.falske,
        a.falske
    );
    // Uten ordlista skal søket fortsatt virke — dårligere, men ikke verre enn
    // bølge 1.
    assert!(
        b.ekte >= a.ekte,
        "uten ordlista må søket være minst like bra som bølge 1: {} mot {}",
        b.ekte,
        a.ekte
    );
    // Prefiksrunda — den som henter sammensetningene og de delvise ordene —
    // skal tjene til livets opphold. Målt: den kjøper to ekte treff til (et
    // delvis ord ingen bøyning kan nå) og fire sammensetninger, for to
    // falske. Går prisen opp, skal dette knekke.
    assert!(
        c.ekte + c.sammensetning > e.ekte + e.sammensetning,
        "prefiksrunda må finne noe bøyningen ikke fant"
    );
    assert!(
        c.falske <= e.falske + 2,
        "prefiksrunda koster for mye: {} falske mot {} uten den",
        c.falske,
        e.falske
    );
    // Ingen ekte treff skal falle bort av noe av dette.
    assert_eq!(c.tapte, 0, "med ordlista skal ingen ekte treff mangle");
}

/// Operatorene fra bølge 1, én spørring om gangen, med ordlista på.
#[test]
fn operatorene_fra_boelge_1_overlever_boeyningen() {
    let dir = tempfile::tempdir().unwrap();
    let conn = korpus(&dir.path().join("med.db"));
    ordbank::load(&conn, &fikstur().join("fullformsliste-projeksjon.txt")).unwrap();

    let s = |q: &str| stier(super::text(&conn, q, GRENSE).unwrap());

    // Negasjon: notatet med både kart og kø faller bort.
    let uten_ko = s("kartet -kø");
    assert!(uten_ko.contains("notater/2026-07-15-visningen.md"));
    assert!(
        !uten_ko.contains("notater/2026-09-02-innboksen.md"),
        "negasjonen skal ta bort notatet med køen, fikk {uten_ko:?}"
    );
    assert!(!uten_ko.contains("notater/2026-09-09-henvendelser.md"));

    // Frase: ordene ved siden av hverandre, og bare der.
    assert_eq!(
        s("\"bestemorvennlig kart\""),
        ["notater/2026-09-10-bestemorvennlig-kart.md".to_string()].into_iter().collect()
    );

    // AND: begge må stå i notatet.
    assert_eq!(
        s("kartet AND kø"),
        ["notater/2026-09-02-innboksen.md".to_string()].into_iter().collect()
    );

    // Bare negasjon er fortsatt ikke et svar.
    assert!(s("-kø").is_empty());
}

/// Æ, ø og å oppfører seg som målt: bare å foldes bort av
/// `remove_diacritics`, og med `0` foldes ingenting. «måling» og «maling» er
/// to ord, og bøyningen skal ikke slå dem sammen.
#[test]
fn aa_og_a_er_fortsatt_to_bokstaver() {
    let dir = tempfile::tempdir().unwrap();
    let conn = korpus(&dir.path().join("med.db"));
    ordbank::load(&conn, &fikstur().join("fullformsliste-projeksjon.txt")).unwrap();

    let s = |q: &str| stier(super::text(&conn, q, GRENSE).unwrap());
    assert_eq!(
        s("måling"),
        ["notater/2026-08-26-lastetid.md".to_string()].into_iter().collect()
    );
    assert_eq!(
        s("maling"),
        ["notater/2026-08-19-kontoret-trenger-farge.md".to_string()].into_iter().collect()
    );
}

/// Bøyning begge veier, for substantiv og for verb. Dette er hele saken:
/// hvilken form hun husker at hun skrev er tilfeldig.
#[test]
fn boeyd_form_finner_grunnform_og_omvendt() {
    let dir = tempfile::tempdir().unwrap();
    let conn = korpus(&dir.path().join("med.db"));
    ordbank::load(&conn, &fikstur().join("fullformsliste-projeksjon.txt")).unwrap();
    let s = |q: &str| stier(super::text(&conn, q, GRENSE).unwrap());

    // Substantiv, bestemt form → grunnform, og motsatt.
    assert!(s("utstyret").contains("notater/2026-03-04-nytt-utstyr.md"));
    assert!(s("utstyr").contains("notater/2026-03-11-lageret-i-lillestrom.md"));
    // Bestemt flertall → entall.
    assert!(s("beslutningene").contains("notater/2026-04-15-depositum.md"));
    assert!(s("beslutning").contains("notater/2026-05-06-i-fjor.md"));
    // Genitiv → bestemt form og flertall.
    let g = s("leverandørens");
    assert!(g.contains("notater/2026-05-20-tilbudet.md"));
    assert!(g.contains("notater/2026-05-27-tre-a-velge-mellom.md"));
    // Verb: infinitiv → presens og preteritum, og preteritum → presens.
    assert!(s("skrive").contains("notater/2026-08-12-lang-epost.md"));
    assert!(s("skrev").contains("notater/2026-08-05-referatet.md"));
}

/// Uten ordlista skal søket virke, bare dårligere: det finner ordet slik det
/// ble skrevet, og ord som begynner likt — men ikke grunnforma.
#[test]
fn uten_ordlista_virker_soeket_bare_daarligere() {
    let dir = tempfile::tempdir().unwrap();
    let conn = korpus(&dir.path().join("uten.db"));
    assert_eq!(ordbank::status(&conn), ordbank::Status::Mangler);
    let s = |q: &str| stier(super::text(&conn, q, GRENSE).unwrap());

    // Virker: ordet slik det står.
    assert!(s("utstyret").contains("notater/2026-03-11-lageret-i-lillestrom.md"));
    // Virker: delvis ord, fordi prefikset fortsatt kjøres.
    assert!(s("kartverk").contains("notater/2026-07-29-adresseoppslag.md"));
    // Virker ikke: grunnforma. Det er nøyaktig dette ordlista kjøper.
    assert!(
        !s("utstyret").contains("notater/2026-03-04-nytt-utstyr.md"),
        "uten ordlista kan ikke «utstyret» finne «utstyr»"
    );
    // Og beskjeden skal si det uten sjargong.
    let sagt = ordbank::status(&conn).to_string();
    assert!(sagt.contains("Ordlista mangler"), "fikk: {sagt}");
    assert!(!sagt.to_lowercase().contains("lemma"));
}

/// Hva et søk koster. Ikke i suiten — den skal være rask — men kjørbar:
///
/// ```text
/// ORDBANK=~/…/fullformsliste.txt \
///   cargo test --release --lib ytelse -- --ignored --nocapture
/// ```
///
/// Uten `ORDBANK` brukes projeksjonen i fiksturen. Antall OR-ledd per ord er
/// det samme uansett (målt: høyst 31 former for et norsk ord), så
/// spørringskostnaden er den samme; det som skiller er oppslaget, og det er
/// et indeksoppslag.
#[test]
#[ignore]
fn ytelse_ved_tusen_notater() {
    use std::time::Instant;

    // Et lite ordforråd der hvert ord står i hvert notat er verste fall: da
    // treffer hvert eneste ledd i en utvidet spørring hver eneste bit, og
    // bm25 må score alt. Et realistisk ordforråd er mange ganger større, og
    // de fleste leddene treffer da ingenting.
    let ord = [
        "utstyret", "leverandøren", "beslutningen", "møtet", "kunden", "fakturaen",
        "depositum", "kartet", "prototypen", "leveransen", "betalingen", "referatet",
    ];
    let dir = tempfile::tempdir().unwrap();

    for (navn, linjer) in [("tusen korte notater", 20usize), ("tusen lange notater", 400)] {
        let conn = db::open(&dir.path().join(format!("{linjer}.db"))).unwrap();
        let tx = conn.unchecked_transaction().unwrap();
        for n in 0..1000 {
            let mut tekst = String::from("---\nid: notat\ntype: \n---\n\n# Notat\n\n");
            for l in 0..linjer {
                for k in 0..12 {
                    tekst.push_str(ord[(n + l * 3 + k * 7) % ord.len()]);
                    tekst.push(' ');
                }
                tekst.push('\n');
            }
            let sti = format!("notater/2026-09-01-notat-{n}.md");
            for bit in chunk::split(&sti, &tekst) {
                tx.execute(
                    "insert into chunks(source, path, start_line, end_line, text) \
                     values ('code', ?1, ?2, ?3, ?4)",
                    rusqlite::params![sti, bit.start_line as i64, bit.end_line as i64, bit.text],
                )
                .unwrap();
            }
        }
        tx.commit().unwrap();
        let biter: i64 =
            conn.query_row("select count(*) from chunks", [], |r| r.get(0)).unwrap();

        let ordbankfil = std::env::var("ORDBANK")
            .map(PathBuf::from)
            .unwrap_or_else(|_| fikstur().join("fullformsliste-projeksjon.txt"));
        let former = ordbank::load(&conn, &ordbankfil).unwrap();

        let tom: Bøyning = &|_| Vec::new();
        println!("\n{navn}: {biter} biter, ordliste med {former} former");
        println!("  {:12} {:>10} {:>10}", "", "bølge 1", "bølge 3");
        for (merkelapp, q) in [
            ("ett ord", "utstyret"),
            ("to ord", "kunden depositum"),
            ("AND", "kartet AND møtet"),
            ("negasjon", "kunden -depositum"),
            ("delvis ord", "leverand"),
        ] {
            let mål = |f: &dyn Fn()| {
                let t = Instant::now();
                for _ in 0..20 {
                    f();
                }
                t.elapsed().as_secs_f64() * 1000.0 / 20.0
            };
            let før = mål(&|| {
                en_runde(&conn, q, tom);
            });
            let etter = mål(&|| {
                super::text(&conn, q, 80).unwrap();
            });
            println!("  {merkelapp:12} {før:>7.1} ms {etter:>7.1} ms");
        }
    }
}

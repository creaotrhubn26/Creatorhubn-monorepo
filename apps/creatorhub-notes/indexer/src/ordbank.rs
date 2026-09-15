use anyhow::{bail, Result};
use rusqlite::Connection;
use std::io::{BufRead, BufReader};
use std::path::Path;

const SCHEMA: &str = r#"
create table if not exists ordbank_fullform (
  form      text not null,
  lemma_id  integer not null,
  tag       text not null
);
create index if not exists ordbank_form on ordbank_fullform(form);
-- Uten denne skanner oppslaget «hvilke andre former har dette lemmaet» hele
-- tabellen på 1,1 millioner rader, én gang per søkeord. Målt: 0,5 ms mot
-- 58 ms for det samme søket.
create index if not exists ordbank_lemma on ordbank_fullform(lemma_id);
"#;

/// Laster fullformslista fra Norsk Ordbank (tabulatorseparert, med
/// overskriftsrad). Kolonner som leses: løpenummer, LEMMA_ID, OPPSLAG, TAG.
///
/// Fila fra Språkbanken er ISO-8859-1 med CRLF, ikke UTF-8 — den første linja
/// med en æ i seg får `BufRead::lines()` til å gi opp. Derfor leses hver linje
/// som bytes og tolkes som UTF-8 der det går, ellers som ISO-8859-1 (der er
/// hver byte sitt eget tegn). Begge kodinger leses altså av samme kall, og
/// testfiksturen i UTF-8 går gjennom uendret.
///
/// Overskriftsrada kjennes igjen på at andre kolonne ikke er et tall. Å lete
/// etter et bestemt kolonnenavn duger ikke: fila fra 2022 skriver `LOEPENR`,
/// og en tidligere versjon av denne koden lette etter `LOPENR` — den lot
/// overskrifta passere og døde på `parse()` i neste steg.
pub fn load(conn: &Connection, fullform_tsv: &Path) -> Result<usize> {
    conn.execute_batch(SCHEMA)?;

    let file = std::fs::File::open(fullform_tsv)?;
    let mut reader = BufReader::new(file);
    let tx = conn.unchecked_transaction()?;
    // Tømmingen må ligge inne i transaksjonen: ellers står tabellen tom om en
    // ødelagt linje avbryter innlastingen.
    tx.execute("delete from ordbank_fullform", [])?;
    let mut stmt =
        tx.prepare("insert into ordbank_fullform(form, lemma_id, tag) values (?1, ?2, ?3)")?;

    let mut count = 0usize;
    let mut buf = Vec::new();
    let mut i = 0usize;
    loop {
        buf.clear();
        if reader.read_until(b'\n', &mut buf)? == 0 {
            break;
        }
        let line = tekst(&buf);
        let line = line.trim_end_matches(['\n', '\r']);
        i += 1;
        if line.trim().is_empty() {
            continue;
        }
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 4 {
            bail!("linje {} har {} kolonner, forventet minst 4", i, cols.len());
        }
        let Ok(lemma_id) = cols[1].trim().parse::<i64>() else {
            if i == 1 {
                continue; // overskriftsrad
            }
            bail!("linje {}: «{}» er ikke et lemma-id", i, cols[1].trim());
        };
        stmt.execute(rusqlite::params![
            cols[2].trim().to_lowercase(),
            lemma_id,
            cols[3].trim()
        ])?;
        count += 1;
    }
    drop(stmt);
    tx.commit()?;
    Ok(count)
}

/// Ei linje som tekst. UTF-8 der det går, ellers ISO-8859-1.
fn tekst(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => bytes.iter().map(|&b| b as char).collect(),
    }
}

pub fn is_valid_form(conn: &Connection, form: &str) -> Result<bool> {
    let n: i64 = conn.query_row(
        "select count(*) from ordbank_fullform where form = ?1",
        [form.to_lowercase()],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn tags(conn: &Connection, form: &str) -> Result<Vec<String>> {
    let out = conn
        .prepare("select tag from ordbank_fullform where form = ?1 order by tag")?
        .query_map([form.to_lowercase()], |r| r.get(0))?
        .collect::<Result<Vec<String>, _>>()?;
    Ok(out)
}

/// Alle formene av ordet — «utstyret» gir «utstyr», «utstyra», «utstyret»,
/// «utstyrene». Slår ordet opp som fullform, finner lemmaene det er en form
/// av, og henter alle formene av de lemmaene. Er ordet en form av flere
/// lemmaer, kommer alle med: «møte» er både substantivet og verbet, og hun
/// husker ikke hvilket hun skrev.
///
/// Sortert kortest først, så den første forma er grunnforma i praksis.
///
/// Tom liste betyr «vet ikke», ikke «ordet finnes ikke»: ordbanken kan mangle
/// helt (tabellen er ikke der), ordet kan være et navn, et fagord eller en
/// skrivefeil. Den som spør skal falle tilbake på ordet slik det ble skrevet.
/// Derfor `Vec`, ikke `Result` — et søk skal aldri feile fordi ordbanken ikke
/// er lastet ned.
pub fn former(conn: &Connection, ord: &str) -> Vec<String> {
    let ord = ord.to_lowercase();
    let treff = slå_opp(conn, &ord);
    if !treff.is_empty() {
        return treff;
    }
    // Genitiv står ikke i fullformslista. Målt: «leverandøren» gir fire
    // former, «leverandørens» gir null — Norsk Ordbank lister ikke s-genitiv,
    // fordi den kan henges på hvilken som helst form og dermed ikke er en
    // egen bøyning. Regelen er så enkel som den ser ut: er ordet ukjent og
    // slutter på s, prøv uten.
    //
    // Dette kan ikke bomme på et vanlig ord som slutter på s — «hus»,
    // «plass», «tips» står i lista og kommer aldri hit.
    match ord.strip_suffix('s') {
        Some(uten) if uten.len() >= 2 => slå_opp(conn, uten),
        _ => Vec::new(),
    }
}

fn slå_opp(conn: &Connection, ord: &str) -> Vec<String> {
    let Ok(mut stmt) = conn.prepare_cached(
        "select distinct f2.form from ordbank_fullform f1 \
         join ordbank_fullform f2 on f2.lemma_id = f1.lemma_id \
         where f1.form = ?1 order by length(f2.form), f2.form",
    ) else {
        return Vec::new(); // ingen ordbank lastet
    };
    let Ok(rader) = stmt.query_map([ord], |r| r.get::<_, String>(0)) else {
        return Vec::new();
    };
    rader.filter_map(|r| r.ok()).collect()
}

/// Hva ordbanken er i stand til akkurat nå.
#[derive(Debug, PartialEq)]
pub enum Status {
    /// Ordbanken er ikke lastet ned. Søket virker, men bare på ordet slik det
    /// er skrevet.
    Mangler,
    /// Antall ordformer i basen.
    Lastet(i64),
}

impl std::fmt::Display for Status {
    /// Ordene en bruker skal få se. Ingen «lemma», ingen «fullform», ingen
    /// «stemming» — bare hva hun får og hva hun ikke får.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Status::Mangler => write!(
                f,
                "Ordlista mangler. Søket finner ordene slik du skrev dem, og \
                 ord som begynner likt — men «utstyret» finner ikke «utstyr»."
            ),
            Status::Lastet(n) => write!(
                f,
                "Ordlista er på plass ({n} ordformer). «utstyret» finner \
                 «utstyr», og «beslutning» finner «beslutningene»."
            ),
        }
    }
}

pub fn status(conn: &Connection) -> Status {
    match conn.query_row("select count(*) from ordbank_fullform", [], |r| r.get::<_, i64>(0)) {
        Ok(n) if n > 0 => Status::Lastet(n),
        _ => Status::Mangler,
    }
}

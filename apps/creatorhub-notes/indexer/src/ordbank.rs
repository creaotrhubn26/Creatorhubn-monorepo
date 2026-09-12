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
"#;

/// Laster fullformslista fra Norsk Ordbank (tabulatorseparert, med overskriftsrad).
/// Kolonner som leses: LOPENR, LEMMA_ID, OPPSLAG, TAG.
pub fn load(conn: &Connection, fullform_tsv: &Path) -> Result<usize> {
    conn.execute_batch(SCHEMA)?;

    let file = std::fs::File::open(fullform_tsv)?;
    let reader = BufReader::new(file);
    let tx = conn.unchecked_transaction()?;
    // Tømmingen må ligge inne i transaksjonen: ellers står tabellen tom om en
    // ødelagt linje avbryter innlastingen.
    tx.execute("delete from ordbank_fullform", [])?;
    let mut stmt =
        tx.prepare("insert into ordbank_fullform(form, lemma_id, tag) values (?1, ?2, ?3)")?;

    let mut count = 0usize;
    for (i, line) in reader.lines().enumerate() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let cols: Vec<&str> = line.split('\t').collect();
        if i == 0 && cols.first().map(|c| c.eq_ignore_ascii_case("LOPENR")) == Some(true) {
            continue; // overskriftsrad
        }
        if cols.len() < 4 {
            bail!("linje {} har {} kolonner, forventet minst 4", i + 1, cols.len());
        }
        let lemma_id: i64 = cols[1].trim().parse()?;
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

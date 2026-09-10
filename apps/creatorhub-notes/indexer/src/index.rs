use crate::{
    chunk,
    embed::{self, Embedder, InputType},
    gitsrc,
};
use anyhow::Result;
use rusqlite::Connection;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::io::Write;
use std::path::Path;
use zerocopy::AsBytes;

/// Pris per million tokener for voyage-code-3, i dollar.
pub const USD_PER_MILLION_TOKENS: f64 = 0.18;

/// Uten embedder er tokenbudsjettet meningsløst, så pakker uten embedder
/// deles etter antall filer i stedet, slik at et stort repo ikke bygger én
/// kjempetransaksjon.
const NO_EMBED_FILES_PER_PACK: usize = 200;

#[derive(Debug)]
pub struct IndexReport {
    /// Filer som ble lest, delt og embeddet i denne kjøringen.
    pub files: usize,
    pub chunks: usize,
    /// Filer som lå i indeksen men ikke lenger er sporet, og derfor ble slettet.
    pub deleted: usize,
    /// Sporede filer med uendret blob-hash. Ikke lest, ikke betalt for.
    pub skipped: usize,
    /// Tokener fakturert av embedderen i denne kjøringen. 0 for testfaker.
    pub tokens: usize,
}

fn purge_path(conn: &Connection, path: &str) -> Result<()> {
    let ids: Vec<i64> = conn
        .prepare("select id from chunks where path = ?1")?
        .query_map([path], |r| r.get(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for id in &ids {
        conn.execute("delete from chunk_vec where rowid = ?1", [id])?;
    }
    conn.execute("delete from chunks where path = ?1", [path])?;
    Ok(())
}

fn read_path_state(conn: &Connection) -> Result<HashMap<String, String>> {
    let map = conn
        .prepare("select path, blob_sha from path_state")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<HashMap<String, String>, _>>()?;
    Ok(map)
}

/// En bit klar for skriving: (sti, startlinje, sluttlinje, tekst).
type Row = (String, usize, usize, String);

/// Embedder (om noen er gitt) én pakke og skriver den i én transaksjon.
/// Enten går alt inn, eller ingenting — og pakker som allerede er committet
/// står igjen om en senere pakke feiler. Det er hele gjenopptakbarheten.
///
/// Uten embedder skrives `chunks`- og `path_state`-radene som vanlig, men
/// `chunk_vec` forblir tom for disse bitene. `chunk_fts` fylles uansett, av
/// triggerne på `chunks` — det krever ingen embedder.
fn flush(
    conn: &Connection,
    embedder: Option<&dyn Embedder>,
    paths: &[(String, String)],
    rows: &[Row],
) -> Result<()> {
    let vectors = match embedder {
        Some(embedder) if !rows.is_empty() => {
            let texts: Vec<String> = rows.iter().map(|r| r.3.clone()).collect();
            let vectors = embedder.embed(&texts, InputType::Document)?;
            if vectors.len() != rows.len() {
                anyhow::bail!(
                    "embedder returnerte {} vektorer for {} biter",
                    vectors.len(),
                    rows.len()
                );
            }
            Some(vectors)
        }
        _ => None,
    };

    let tx = conn.unchecked_transaction()?;
    for (path, _) in paths {
        purge_path(&tx, path)?;
    }
    for (i, row) in rows.iter().enumerate() {
        tx.execute(
            "insert into chunks(source, path, start_line, end_line, text) \
             values ('code', ?1, ?2, ?3, ?4)",
            rusqlite::params![row.0, row.1 as i64, row.2 as i64, row.3],
        )?;
        if let Some(vectors) = &vectors {
            let id = tx.last_insert_rowid();
            tx.execute(
                "insert into chunk_vec(rowid, embedding) values (?1, ?2)",
                rusqlite::params![id, vectors[i].as_bytes()],
            )?;
        }
    }
    for (path, blob_sha) in paths {
        tx.execute(
            "insert into path_state(path, blob_sha) values (?1, ?2) \
             on conflict(path) do update set blob_sha = excluded.blob_sha",
            [path.as_str(), blob_sha.as_str()],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Bitene som allerede har tekst i `chunks` men mangler en vektor i
/// `chunk_vec`: enten fra en `--no-embed`-kjøring, eller en tidligere
/// embed-kjøring som feilet midt i (umulig i praksis siden `flush` skriver
/// begge i samme transaksjon, men koster ingenting å dekke uansett).
///
/// Dette er gjenkjennelsen som gjør oppgraderingsstien trygg: en kjøring med
/// embedder finner disse bitene og embedder dem på plass, uten å røre
/// teksten — ingen re-splitting, ingen duplisering, `path_state` uendret
/// fordi blob-hashen ikke har endret seg.
fn backfill_missing_vectors(conn: &Connection, embedder: &dyn Embedder) -> Result<usize> {
    let rows: Vec<(i64, String)> = conn
        .prepare(
            "select c.id, c.text from chunks c \
             where not exists (select 1 from chunk_vec v where v.rowid = c.id)",
        )?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;
    if rows.is_empty() {
        return Ok(0);
    }

    let texts: Vec<String> = rows.iter().map(|r| r.1.clone()).collect();
    for range in embed::batches(&texts) {
        let vectors = embedder.embed(&texts[range.clone()], InputType::Document)?;
        if vectors.len() != range.len() {
            anyhow::bail!(
                "embedder returnerte {} vektorer for {} biter",
                vectors.len(),
                range.len()
            );
        }
        let tx = conn.unchecked_transaction()?;
        for (offset, idx) in range.enumerate() {
            tx.execute(
                "insert into chunk_vec(rowid, embedding) values (?1, ?2)",
                rusqlite::params![rows[idx].0, vectors[offset].as_bytes()],
            )?;
        }
        tx.commit()?;
    }
    Ok(rows.len())
}

/// Indekserer med embedder: bygger og oppdaterer vektorene som semantisk søk
/// bruker.
pub fn run(conn: &Connection, repo: &Path, embedder: &dyn Embedder) -> Result<IndexReport> {
    run_inner(conn, repo, Some(embedder))
}

/// Indekserer uten embedder: kun tekst og FTS5. Ingen `VOYAGE_API_KEY`
/// kreves, ingen nettverkskall gjøres. `chunk_vec` forblir tom for bitene
/// som skrives her, til en senere `run()` med embedder fyller dem inn — se
/// `backfill_missing_vectors`.
pub fn run_no_embed(conn: &Connection, repo: &Path) -> Result<IndexReport> {
    run_inner(conn, repo, None)
}

fn run_inner(
    conn: &Connection,
    repo: &Path,
    embedder: Option<&dyn Embedder>,
) -> Result<IndexReport> {
    let current = gitsrc::list_files_with_sha(repo)?;
    let state = read_path_state(conn)?;

    let work: Vec<(String, String)> = current
        .iter()
        .filter(|(path, sha)| state.get(path) != Some(sha))
        .cloned()
        .collect();
    let skipped = current.len() - work.len();

    let live: HashSet<&str> = current.iter().map(|(p, _)| p.as_str()).collect();
    let gone: Vec<String> = state
        .keys()
        .filter(|p| !live.contains(p.as_str()))
        .cloned()
        .collect();

    // Slettinger koster ingenting og kan ikke feile halvveis, så de tas først
    // i sin egen transaksjon.
    if !gone.is_empty() {
        let tx = conn.unchecked_transaction()?;
        for path in &gone {
            purge_path(&tx, path)?;
            tx.execute("delete from path_state where path = ?1", [path])?;
        }
        tx.commit()?;
    }

    // Framdrift skrives bare når kjøringen faktisk deler seg i flere pakker,
    // så tester med FakeEmbedder holder kjeft.
    let progress = |batch_no: usize, files_done: usize, chunks: usize, tokens: usize| {
        if batch_no > 1 || files_done < work.len() {
            let _ = writeln!(
                std::io::stderr(),
                "pakke {batch_no}: {files_done}/{} filer, {chunks} biter, {tokens} tokener",
                work.len()
            );
        }
    };

    let mut rows: Vec<Row> = Vec::new();
    let mut pack: Vec<(String, String)> = Vec::new();
    let mut pack_tokens = 0usize;
    let mut chunks_total = 0usize;
    let mut files_done = 0usize;
    let mut batch_no = 0usize;

    for (path, blob_sha) in &work {
        let file_rows: Vec<Row> = match gitsrc::read_if_indexable(repo, path) {
            Some(content) => chunk::split(path, &content)
                .into_iter()
                .map(|c| (path.clone(), c.start_line, c.end_line, c.text))
                .collect(),
            // For stor, eller borte fra arbeidstreet: ingen biter, men vi noterer
            // hashen så neste kjøring hopper over den.
            None => Vec::new(),
        };
        let file_tokens: usize = file_rows.iter().map(|r| embed::est_tokens(&r.3)).sum();

        // Med embedder deles pakker på tokenbudsjettet Voyage håndhever. Uten
        // embedder finnes intet slikt budsjett, så vi deler på antall filer i
        // stedet — bare for å unngå én kjempetransaksjon på et stort repo.
        let overflows = !rows.is_empty()
            && match embedder {
                Some(_) => {
                    pack_tokens + file_tokens > embed::MAX_TOKENS_PER_REQUEST
                        || rows.len() + file_rows.len() > embed::MAX_TEXTS_PER_REQUEST
                }
                None => pack.len() >= NO_EMBED_FILES_PER_PACK,
            };
        if overflows {
            flush(conn, embedder, &pack, &rows)?;
            batch_no += 1;
            files_done += pack.len();
            chunks_total += rows.len();
            progress(batch_no, files_done, chunks_total, tokens_used(embedder));
            pack.clear();
            rows.clear();
            pack_tokens = 0;
        }

        pack.push((path.clone(), blob_sha.clone()));
        pack_tokens += file_tokens;
        rows.extend(file_rows);
    }

    if !pack.is_empty() {
        flush(conn, embedder, &pack, &rows)?;
        batch_no += 1;
        files_done += pack.len();
        chunks_total += rows.len();
        progress(batch_no, files_done, chunks_total, tokens_used(embedder));
    }

    // Oppgraderingssti: en kjøring med embedder ser etter biter som allerede
    // har tekst (fra en tidligere `--no-embed`-kjøring) men ingen vektor, og
    // embedder dem i etterkant — uten å røre `chunks` eller `path_state`.
    if let Some(embedder) = embedder {
        backfill_missing_vectors(conn, embedder)?;
    }

    Ok(IndexReport {
        files: work.len(),
        chunks: chunks_total,
        deleted: gone.len(),
        skipped,
        tokens: tokens_used(embedder),
    })
}

fn tokens_used(embedder: Option<&dyn Embedder>) -> usize {
    embedder.map(|e| e.tokens_used()).unwrap_or(0)
}

#[derive(Debug, Default, Clone)]
pub struct ExtStats {
    pub files: usize,
    pub lines: usize,
    pub chunks: usize,
}

#[derive(Debug)]
pub struct DryRunReport {
    pub files: usize,
    pub lines: usize,
    pub chunks: usize,
    pub tokens: usize,
    pub per_ext: BTreeMap<String, ExtStats>,
}

impl DryRunReport {
    pub fn cost_usd(&self) -> f64 {
        self.tokens as f64 / 1_000_000.0 * USD_PER_MILLION_TOKENS
    }

    pub fn render(&self) -> String {
        let mut s = String::new();
        s.push_str(&format!(
            "{} indekserbare filer, {} linjer, {} biter\n",
            self.files, self.lines, self.chunks
        ));
        s.push_str(&format!(
            "estimert {} tokener, omtrent ${:.2} med ${} per million tokener\n",
            self.tokens,
            self.cost_usd(),
            USD_PER_MILLION_TOKENS
        ));
        s.push_str(
            "Tokenestimatet er bevisst høyt (tre tegn per token), så den reelle \
             fakturaen lander typisk 20-30 % lavere.\n",
        );
        s.push_str("\nendelse      filer      linjer       biter\n");
        let mut sorted: Vec<(&String, &ExtStats)> = self.per_ext.iter().collect();
        sorted.sort_by_key(|e| std::cmp::Reverse(e.1.chunks));
        for (ext, st) in sorted {
            s.push_str(&format!(
                "{:<8} {:>9} {:>11} {:>11}\n",
                ext, st.files, st.lines, st.chunks
            ));
        }
        s.push_str("\nIngen nettverkskall er gjort. Ingenting er betalt for.\n");
        s
    }
}

/// Går gjennom korpuset og rapporterer omfang og kostnad uten å ringe Voyage.
pub fn dry_run(repo: &Path) -> Result<DryRunReport> {
    let mut report = DryRunReport {
        files: 0,
        lines: 0,
        chunks: 0,
        tokens: 0,
        per_ext: BTreeMap::new(),
    };
    for (path, _) in gitsrc::list_files_with_sha(repo)? {
        let Some(content) = gitsrc::read_if_indexable(repo, &path) else {
            continue;
        };
        let lines = content.lines().count();
        let chunks = chunk::split(&path, &content);
        let tokens: usize = chunks.iter().map(|c| embed::est_tokens(&c.text)).sum();

        report.files += 1;
        report.lines += lines;
        report.chunks += chunks.len();
        report.tokens += tokens;

        let ext = path.rsplit_once('.').map(|(_, e)| e).unwrap_or("");
        let st = report.per_ext.entry(ext.to_string()).or_default();
        st.files += 1;
        st.lines += lines;
        st.chunks += chunks.len();
    }
    Ok(report)
}

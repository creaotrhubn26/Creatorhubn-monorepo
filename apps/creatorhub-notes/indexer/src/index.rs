use crate::{chunk, db, embed::{Embedder, InputType}, gitsrc};
use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use zerocopy::AsBytes;

pub const META_LAST_SHA: &str = "last_sha";

#[derive(Debug)]
pub struct IndexReport {
    pub files: usize,
    pub chunks: usize,
    pub incremental: bool,
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

pub fn run(conn: &Connection, repo: &Path, embedder: &dyn Embedder) -> Result<IndexReport> {
    let head = gitsrc::head_sha(repo)?;
    let last = db::get_meta(conn, META_LAST_SHA)?;
    let incremental = last.is_some();

    let paths = match &last {
        Some(sha) if sha == &head => Vec::new(),
        Some(sha) => gitsrc::changed_files(repo, sha)?,
        None => gitsrc::list_files(repo)?,
    };

    let mut texts: Vec<String> = Vec::new();
    let mut rows: Vec<(String, usize, usize, String)> = Vec::new();

    for path in &paths {
        purge_path(conn, path)?;
        let Some(content) = gitsrc::read_if_indexable(repo, path) else {
            continue; // slettet eller for stor
        };
        for c in chunk::split(path, &content) {
            texts.push(c.text.clone());
            rows.push((path.clone(), c.start_line, c.end_line, c.text));
        }
    }

    if !texts.is_empty() {
        let vectors = embedder.embed(&texts, InputType::Document)?;
        let tx = conn.unchecked_transaction()?;
        for (row, vector) in rows.iter().zip(vectors.iter()) {
            tx.execute(
                "insert into chunks(source, path, start_line, end_line, text) \
                 values ('code', ?1, ?2, ?3, ?4)",
                rusqlite::params![row.0, row.1 as i64, row.2 as i64, row.3],
            )?;
            let id = tx.last_insert_rowid();
            tx.execute(
                "insert into chunk_vec(rowid, embedding) values (?1, ?2)",
                rusqlite::params![id, vector.as_bytes()],
            )?;
        }
        tx.commit()?;
    }

    db::set_meta(conn, META_LAST_SHA, &head)?;
    Ok(IndexReport {
        files: paths.len(),
        chunks: rows.len(),
        incremental,
    })
}

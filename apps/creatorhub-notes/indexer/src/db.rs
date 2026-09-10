use anyhow::Result;
use rusqlite::{Connection, OptionalExtension};
use std::path::Path;

pub const EMBEDDING_DIM: usize = 1024;

const SCHEMA: &str = r#"
create table if not exists meta (
  key   text primary key,
  value text not null
);

create table if not exists notes (
  id    text primary key,
  path  text not null unique,
  mtime integer not null,
  type  text,
  title text
);

create table if not exists entities (
  id         integer primary key,
  kind       text not null,
  name       text not null,
  source_ref text,
  repo       text,
  unique(kind, source_ref)
);

create table if not exists chunks (
  id         integer primary key,
  source     text not null,
  path       text not null,
  start_line integer not null,
  end_line   integer not null,
  text       text not null
);
create index if not exists chunks_path on chunks(path);

create table if not exists path_state (
  path     text primary key,
  blob_sha text not null
);

create table if not exists anchors (
  note_id    text not null,
  entity_id  integer not null,
  confidence real not null default 0,
  confirmed  integer not null default 0,
  primary key (note_id, entity_id)
);

create table if not exists edges (
  from_entity integer not null,
  to_entity   integer not null,
  kind        text not null,
  primary key (from_entity, to_entity, kind)
);
"#;

/// Fulltekstindeks over `chunks.text`, uten embedder og uten nettverk.
///
/// `content='chunks', content_rowid='id'` gjør dette til en ekstern-innhold-
/// tabell: FTS5 lagrer bare tokenindeksen, ikke en kopi av teksten. Det
/// betyr at tabellen IKKE holder seg synkronisert av seg selv — triggerne
/// under er det som gjør det, ikke FTS5 selv.
///
/// `remove_diacritics 0` er bevisst: notatene er norske, og standardverdien
/// (1) folder æøå bort slik at «søk» og «sok» blir samme token. Med 0 forblir
/// de distinkte.
const FTS_SCHEMA: &str = r#"
create virtual table if not exists chunk_fts using fts5(
  text,
  content='chunks',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 0'
);

create trigger if not exists chunks_ai_fts after insert on chunks begin
  insert into chunk_fts(rowid, text) values (new.id, new.text);
end;

create trigger if not exists chunks_ad_fts after delete on chunks begin
  insert into chunk_fts(chunk_fts, rowid, text) values ('delete', old.id, old.text);
end;
"#;

/// Åpner databasen og sørger for at skjemaet finnes. Idempotent.
pub fn open(path: &Path) -> Result<Connection> {
    crate::register_vec_extension();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.execute_batch(SCHEMA)?;
    conn.execute_batch(&format!(
        "create virtual table if not exists chunk_vec using vec0(embedding float[{}]);",
        EMBEDDING_DIM
    ))?;
    conn.execute_batch(FTS_SCHEMA)?;
    Ok(conn)
}

pub fn get_meta(conn: &Connection, key: &str) -> Result<Option<String>> {
    let value = conn
        .query_row("select value from meta where key = ?1", [key], |r| r.get(0))
        .optional()?;
    Ok(value)
}

pub fn set_meta(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "insert into meta(key, value) values (?1, ?2) \
         on conflict(key) do update set value = excluded.value",
        [key, value],
    )?;
    Ok(())
}

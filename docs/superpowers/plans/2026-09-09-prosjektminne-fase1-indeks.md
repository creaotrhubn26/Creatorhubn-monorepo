# Prosjektminne fase 1 — indeks og søk

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Rust command-line indexer that embeds the CreatorHub monorepo into a local SQLite vector index and answers semantic search queries well enough to pass a 20-question golden set.

**Architecture:** One Rust crate. `git ls-files -s` enumerates indexable files with their blob hashes, a line-window chunker splits them, Voyage AI embeds the chunks, and `sqlite-vec` stores and KNN-searches the vectors. Re-indexing is incremental per path: the blob hash of every indexed path is stored in `path_state`, and only paths whose hash changed or is missing are re-embedded. Each batch is embedded and committed on its own, so an interrupted run keeps everything it already paid for. No UI, no Tauri, no MCP server in this phase.

**Tech Stack:** Rust 2021, `rusqlite` (bundled SQLite), `sqlite-vec`, `zerocopy` 0.7, `reqwest`, `tokio`, `serde`, `anyhow`, `regex`, `clap`.

**Spec:** `docs/superpowers/specs/2026-09-09-prosjektminne-notatapp-design.md`

## Global Constraints

- Rust edition 2021. Crate lives at `apps/creatorhub-notes/indexer/`.
- `sqlite-vec = "0.1.9"` and `zerocopy = "0.7"` (0.7 exposes `AsBytes`; later versions renamed it to `IntoBytes` and will not compile against the examples in this plan). Do not use the 0.1.10 alpha line: its published tarballs omit four C files that `sqlite-vec.c` includes, so the crate does not build.
- `rusqlite` must use the `bundled` feature. The system SQLite on macOS cannot load the extension.
- Embedding model: `voyage-code-3`, output dimension **1024**, endpoint `POST https://api.voyageai.com/v1/embeddings`, header `Authorization: Bearer $VOYAGE_API_KEY`.
- Voyage request limits: max **1000 texts** per request, max **120 000 tokens** per request for `voyage-code-3`.
- `input_type` is `"document"` when indexing and `"query"` when searching.
- Chunking: 40-line windows, 10-line overlap. Every chunk text is prefixed with its file path and nearest preceding function name.
- Indexed file extensions: `ts tsx js jsx rs py swift sql md`. Skip any file over 500 000 bytes and any path containing `.min.`.
- No network calls in unit tests. Tests use the `Embedder` trait with a fake implementation.
- Never commit an API key. `VOYAGE_API_KEY` is read from the environment only.
- Measured scale of the corpus, against origin/main through the crate's own filters: **8 023 indexable files, 3 180 395 lines, 107 386 chunks, 41-50M embedding tokens, roughly $6-8** at $0.18 per million with `voyage-code-3`. The finished index file is roughly 650 MB. Run `notes-index index --dry-run` — no API key, no network call — before any paid run; it is the number that governs.

---

### Task 1: Crate skeleton and sqlite-vec smoke test

**Files:**
- Create: `apps/creatorhub-notes/indexer/Cargo.toml`
- Create: `apps/creatorhub-notes/indexer/src/lib.rs`
- Create: `apps/creatorhub-notes/indexer/tests/vec_smoke.rs`
- Create: `apps/creatorhub-notes/.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a compiling crate named `creatorhub_notes_indexer` with `sqlite-vec` registered as an auto-extension.

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/tests/vec_smoke.rs`:

```rust
use creatorhub_notes_indexer::register_vec_extension;
use rusqlite::Connection;
use zerocopy::AsBytes;

#[test]
fn vec0_table_answers_knn_query() {
    register_vec_extension();
    let db = Connection::open_in_memory().unwrap();

    let version: String = db
        .query_row("select vec_version()", [], |r| r.get(0))
        .unwrap();
    assert!(!version.is_empty(), "sqlite-vec extension did not load");

    db.execute(
        "CREATE VIRTUAL TABLE vec_items USING vec0(embedding float[4])",
        [],
    )
    .unwrap();

    let items: Vec<(i64, Vec<f32>)> = vec![
        (1, vec![0.1, 0.1, 0.1, 0.1]),
        (2, vec![0.2, 0.2, 0.2, 0.2]),
        (3, vec![0.9, 0.9, 0.9, 0.9]),
    ];
    let mut stmt = db
        .prepare("INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)")
        .unwrap();
    for (id, v) in &items {
        stmt.execute(rusqlite::params![id, v.as_bytes()]).unwrap();
    }

    let query: Vec<f32> = vec![0.9, 0.9, 0.9, 0.9];
    let hits: Vec<(i64, f64)> = db
        .prepare(
            "SELECT rowid, distance FROM vec_items \
             WHERE embedding MATCH ?1 ORDER BY distance LIMIT 1",
        )
        .unwrap()
        .query_map([query.as_bytes()], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].0, 3, "nearest neighbour should be rowid 3");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test vec_smoke`
Expected: FAIL — the crate and `Cargo.toml` do not exist yet, so cargo reports `could not find Cargo.toml`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/creatorhub-notes/indexer/Cargo.toml`:

```toml
[package]
name = "creatorhub-notes-indexer"
version = "0.1.0"
edition = "2021"
description = "Semantisk indeks over CreatorHub-monorepoet for prosjektminne-appen"

[lib]
name = "creatorhub_notes_indexer"
path = "src/lib.rs"

[[bin]]
name = "notes-index"
path = "src/main.rs"

[dependencies]
rusqlite = { version = "0.32", features = ["bundled"] }
sqlite-vec = "0.1.9"
zerocopy = "0.7"
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
regex = "1"
clap = { version = "4", features = ["derive"] }
toml = "0.8"

[dev-dependencies]
tempfile = "3"
```

Create `apps/creatorhub-notes/indexer/src/lib.rs`:

```rust
use rusqlite::ffi::sqlite3_auto_extension;
use sqlite_vec::sqlite3_vec_init;
use std::sync::Once;

static INIT: Once = Once::new();

/// Registrerer sqlite-vec som auto-extension. Trygg å kalle flere ganger.
pub fn register_vec_extension() {
    INIT.call_once(|| unsafe {
        sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite3_vec_init as *const (),
        )));
    });
}
```

Create `apps/creatorhub-notes/indexer/src/main.rs` as a placeholder so the crate builds:

```rust
fn main() {
    println!("notes-index");
}
```

Create `apps/creatorhub-notes/.gitignore`:

```
target/
*.db
*.db-journal
ordbank/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test vec_smoke`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes
git commit -m "feat(notes): scaffold indexer crate with sqlite-vec"
```

---

### Task 2: Database schema

**Files:**
- Create: `apps/creatorhub-notes/indexer/src/db.rs`
- Modify: `apps/creatorhub-notes/indexer/src/lib.rs`
- Create: `apps/creatorhub-notes/indexer/tests/db_schema.rs`

**Interfaces:**
- Consumes: `register_vec_extension()` from Task 1.
- Produces:
  - `db::open(path: &Path) -> anyhow::Result<Connection>` — opens or creates the database and applies the schema. Idempotent.
  - `db::get_meta(&Connection, key: &str) -> anyhow::Result<Option<String>>`
  - `db::set_meta(&Connection, key: &str, value: &str) -> anyhow::Result<()>`
  - Table `chunks(id INTEGER PRIMARY KEY, source TEXT, path TEXT, start_line INTEGER, end_line INTEGER, text TEXT)`
  - Virtual table `chunk_vec` with `embedding float[1024]` keyed by the same rowid as `chunks.id`.

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/tests/db_schema.rs`:

```rust
use creatorhub_notes_indexer::db;
use tempfile::tempdir;

#[test]
fn open_creates_schema_and_is_idempotent() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("index.db");

    {
        let conn = db::open(&path).unwrap();
        let count: i64 = conn
            .query_row(
                "select count(*) from sqlite_master where name in \
                 ('chunks','entities','anchors','edges','notes','meta')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 6, "all six base tables should exist");

        db::set_meta(&conn, "last_sha", "abc123").unwrap();
        assert_eq!(
            db::get_meta(&conn, "last_sha").unwrap(),
            Some("abc123".to_string())
        );
        assert_eq!(db::get_meta(&conn, "missing").unwrap(), None);
    }

    // Opening again must not fail and must preserve data.
    let conn = db::open(&path).unwrap();
    assert_eq!(
        db::get_meta(&conn, "last_sha").unwrap(),
        Some("abc123".to_string())
    );

    // The vector table accepts a 1024-dimension embedding.
    conn.execute(
        "insert into chunks(id, source, path, start_line, end_line, text) \
         values (1, 'code', 'a.ts', 1, 10, 'hei')",
        [],
    )
    .unwrap();
    let v: Vec<f32> = vec![0.01; 1024];
    use zerocopy::AsBytes;
    conn.execute(
        "insert into chunk_vec(rowid, embedding) values (?, ?)",
        rusqlite::params![1i64, v.as_bytes()],
    )
    .unwrap();
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test db_schema`
Expected: FAIL with `unresolved import` / `could not find db in creatorhub_notes_indexer`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/creatorhub-notes/indexer/src/db.rs`:

```rust
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
```

Add to `apps/creatorhub-notes/indexer/src/lib.rs`:

```rust
pub mod db;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test db_schema`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes/indexer
git commit -m "feat(notes): add sqlite schema with vec0 chunk table"
```

---

### Task 3: Line-window chunker

**Files:**
- Create: `apps/creatorhub-notes/indexer/src/chunk.rs`
- Modify: `apps/creatorhub-notes/indexer/src/lib.rs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `pub struct Chunk { pub start_line: usize, pub end_line: usize, pub text: String }`
  - `chunk::split(path: &str, content: &str) -> Vec<Chunk>` — 40-line windows with 10-line overlap. `start_line` and `end_line` are 1-indexed and inclusive. `text` is prefixed with a header line `// <path> :: <nearest fn name>` (the ` :: <name>` part is omitted when no function name is found above the window).

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/src/chunk.rs` with tests at the bottom, implementation to follow in Step 3. Write only this test module first:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn lines(n: usize) -> String {
        (1..=n).map(|i| format!("line{i}\n")).collect()
    }

    #[test]
    fn short_file_becomes_one_chunk() {
        let out = split("a/b.ts", &lines(12));
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].start_line, 1);
        assert_eq!(out[0].end_line, 12);
        assert!(out[0].text.starts_with("// a/b.ts\n"));
        assert!(out[0].text.contains("line12"));
    }

    #[test]
    fn empty_file_becomes_no_chunks() {
        assert!(split("a/b.ts", "").is_empty());
        assert!(split("a/b.ts", "   \n\n").is_empty());
    }

    #[test]
    fn windows_advance_by_thirty_lines() {
        let out = split("a/b.ts", &lines(100));
        // stride = 40 - 10 = 30 -> windows starting at 1, 31, 61; the third
        // window already reaches the last line, so no fourth window is made.
        assert_eq!(out.len(), 3);
        assert_eq!((out[0].start_line, out[0].end_line), (1, 40));
        assert_eq!((out[1].start_line, out[1].end_line), (31, 70));
        assert_eq!((out[2].start_line, out[2].end_line), (61, 100));
    }

    #[test]
    fn header_carries_nearest_function_name() {
        let mut src = String::new();
        src.push_str("export function beregnPris(a: number) {\n");
        for i in 0..60 {
            src.push_str(&format!("  const x{i} = {i};\n"));
        }
        let out = split("backend/server/pricing.ts", &src);
        assert_eq!(out.len(), 2);
        assert!(out[0].text.starts_with("// backend/server/pricing.ts :: beregnPris\n"));
        // The second window starts inside the function, so the name is carried forward.
        assert!(out[1].text.starts_with("// backend/server/pricing.ts :: beregnPris\n"));
    }

    #[test]
    fn header_omitted_when_no_function_found() {
        let out = split("docs/notat.md", &lines(5));
        assert_eq!(out[0].text.lines().next().unwrap(), "// docs/notat.md");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Add `pub mod chunk;` to `src/lib.rs`, then run:
`cd apps/creatorhub-notes/indexer && cargo test chunk::`
Expected: FAIL to compile with `cannot find function split in this scope`.

- [ ] **Step 3: Write minimal implementation**

Put this above the `#[cfg(test)]` module in `apps/creatorhub-notes/indexer/src/chunk.rs`:

```rust
use regex::Regex;
use std::sync::OnceLock;

pub const WINDOW: usize = 40;
pub const OVERLAP: usize = 10;

#[derive(Debug, Clone, PartialEq)]
pub struct Chunk {
    pub start_line: usize,
    pub end_line: usize,
    pub text: String,
}

fn fn_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?x)
              ^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?
              (?:
                 (?:pub\s+)?(?:async\s+)?fn\s+(?P<rust>[A-Za-z_][A-Za-z0-9_]*)
               | function\s+(?P<js>[A-Za-z_$][A-Za-z0-9_$]*)
               | (?:const|let)\s+(?P<jsconst>[A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(
               | def\s+(?P<py>[A-Za-z_][A-Za-z0-9_]*)
               | func\s+(?P<swift>[A-Za-z_][A-Za-z0-9_]*)
               | class\s+(?P<class>[A-Za-z_][A-Za-z0-9_]*)
              )",
        )
        .expect("function regex must compile")
    })
}

/// Navnet på siste funksjon/klasse som starter på eller før `line_idx` (0-indeksert).
fn nearest_name(lines: &[&str], line_idx: usize) -> Option<String> {
    let re = fn_regex();
    for i in (0..=line_idx.min(lines.len().saturating_sub(1))).rev() {
        if let Some(caps) = re.captures(lines[i]) {
            for group in ["rust", "js", "jsconst", "py", "swift", "class"] {
                if let Some(m) = caps.name(group) {
                    return Some(m.as_str().to_string());
                }
            }
        }
    }
    None
}

/// Deler innholdet i 40-linjers vinduer med 10 linjers overlapp.
pub fn split(path: &str, content: &str) -> Vec<Chunk> {
    if content.trim().is_empty() {
        return Vec::new();
    }
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return Vec::new();
    }
    let stride = WINDOW - OVERLAP;
    let mut out = Vec::new();
    let mut start = 0usize;
    loop {
        let end = (start + WINDOW).min(lines.len());
        let header = match nearest_name(&lines, start) {
            Some(name) => format!("// {path} :: {name}"),
            None => format!("// {path}"),
        };
        let body = lines[start..end].join("\n");
        out.push(Chunk {
            start_line: start + 1,
            end_line: end,
            text: format!("{header}\n{body}"),
        });
        if end == lines.len() {
            break;
        }
        start += stride;
    }
    out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test chunk::`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes/indexer
git commit -m "feat(notes): add line-window chunker with function-name headers"
```

---

### Task 4: Git file source

**Files:**
- Create: `apps/creatorhub-notes/indexer/src/gitsrc.rs`
- Modify: `apps/creatorhub-notes/indexer/src/lib.rs`
- Create: `apps/creatorhub-notes/indexer/tests/gitsrc.rs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `gitsrc::head_sha(repo: &Path) -> anyhow::Result<String>`
  - `gitsrc::list_files(repo: &Path) -> anyhow::Result<Vec<String>>` — repo-relative paths of tracked files with an indexable extension.
  - `gitsrc::changed_files(repo: &Path, from_sha: &str) -> anyhow::Result<Vec<String>>` — indexable paths changed between `from_sha` and HEAD, including deletions.
  - `gitsrc::is_indexable(path: &str) -> bool`

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/tests/gitsrc.rs`:

```rust
use creatorhub_notes_indexer::gitsrc;
use std::path::Path;
use std::process::Command;
use tempfile::tempdir;

fn git(repo: &Path, args: &[&str]) {
    let status = Command::new("git")
        .args(args)
        .current_dir(repo)
        .status()
        .unwrap();
    assert!(status.success(), "git {args:?} failed");
}

fn write(repo: &Path, rel: &str, body: &str) {
    let p = repo.join(rel);
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(p, body).unwrap();
}

#[test]
fn extension_filter_accepts_source_rejects_noise() {
    assert!(gitsrc::is_indexable("backend/server/a.ts"));
    assert!(gitsrc::is_indexable("ipad/App/View.swift"));
    assert!(gitsrc::is_indexable("backend/migrations/0095_x.sql"));
    assert!(gitsrc::is_indexable("docs/notat.md"));
    assert!(!gitsrc::is_indexable("public/logo.png"));
    assert!(!gitsrc::is_indexable("dist/bundle.min.js"));
}

#[test]
fn lists_tracked_source_files_and_diffs_against_a_sha() {
    let dir = tempdir().unwrap();
    let repo = dir.path();
    git(repo, &["init", "-q"]);
    git(repo, &["config", "user.email", "t@example.com"]);
    git(repo, &["config", "user.name", "Test"]);

    write(repo, "src/a.ts", "const a = 1;\n");
    write(repo, "logo.png", "notreallyapng");
    git(repo, &["add", "-A"]);
    git(repo, &["commit", "-qm", "first"]);
    let first = gitsrc::head_sha(repo).unwrap();
    assert_eq!(first.len(), 40);

    let files = gitsrc::list_files(repo).unwrap();
    assert_eq!(files, vec!["src/a.ts".to_string()]);

    write(repo, "src/b.py", "def f():\n    return 1\n");
    std::fs::remove_file(repo.join("src/a.ts")).unwrap();
    git(repo, &["add", "-A"]);
    git(repo, &["commit", "-qm", "second"]);

    let mut changed = gitsrc::changed_files(repo, &first).unwrap();
    changed.sort();
    assert_eq!(changed, vec!["src/a.ts".to_string(), "src/b.py".to_string()]);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test gitsrc`
Expected: FAIL with `could not find gitsrc in creatorhub_notes_indexer`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/creatorhub-notes/indexer/src/gitsrc.rs`:

```rust
use anyhow::{bail, Result};
use std::path::Path;
use std::process::Command;

pub const EXTENSIONS: &[&str] = &["ts", "tsx", "js", "jsx", "rs", "py", "swift", "sql", "md"];
pub const MAX_BYTES: u64 = 500_000;

pub fn is_indexable(path: &str) -> bool {
    if path.contains(".min.") {
        return false;
    }
    match path.rsplit_once('.') {
        Some((_, ext)) => EXTENSIONS.contains(&ext),
        None => false,
    }
}

fn run(repo: &Path, args: &[&str]) -> Result<String> {
    let out = Command::new("git").args(args).current_dir(repo).output()?;
    if !out.status.success() {
        bail!(
            "git {:?} feilet: {}",
            args,
            String::from_utf8_lossy(&out.stderr)
        );
    }
    Ok(String::from_utf8(out.stdout)?)
}

pub fn head_sha(repo: &Path) -> Result<String> {
    Ok(run(repo, &["rev-parse", "HEAD"])?.trim().to_string())
}

pub fn list_files(repo: &Path) -> Result<Vec<String>> {
    Ok(run(repo, &["ls-files"])?
        .lines()
        .map(str::to_string)
        .filter(|p| is_indexable(p))
        .collect())
}

pub fn changed_files(repo: &Path, from_sha: &str) -> Result<Vec<String>> {
    Ok(
        run(repo, &["diff", "--name-only", from_sha, "HEAD"])?
            .lines()
            .map(str::to_string)
            .filter(|p| is_indexable(p))
            .collect(),
    )
}

/// Leser fila hvis den finnes og er liten nok. `None` betyr «hopp over eller slettet».
pub fn read_if_indexable(repo: &Path, rel: &str) -> Option<String> {
    let full = repo.join(rel);
    let meta = std::fs::metadata(&full).ok()?;
    if meta.len() > MAX_BYTES {
        return None;
    }
    std::fs::read_to_string(&full).ok()
}
```

Add to `apps/creatorhub-notes/indexer/src/lib.rs`:

```rust
pub mod gitsrc;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test gitsrc`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes/indexer
git commit -m "feat(notes): add git-backed file enumeration and diffing"
```

---

### Task 5: Embedder trait and Voyage client

**Files:**
- Create: `apps/creatorhub-notes/indexer/src/embed.rs`
- Modify: `apps/creatorhub-notes/indexer/src/lib.rs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `pub enum InputType { Document, Query }`
  - `pub trait Embedder { fn embed(&self, texts: &[String], kind: InputType) -> anyhow::Result<Vec<Vec<f32>>>; }`
  - `pub struct VoyageEmbedder { api_key: String, model: String }` with `VoyageEmbedder::from_env() -> anyhow::Result<Self>`
  - `pub struct FakeEmbedder;` — deterministic hash-based vectors, used by every other task's tests.
  - `embed::batches(texts: &[String]) -> Vec<std::ops::Range<usize>>` — splits into requests of at most 1000 texts and at most 120 000 estimated tokens.

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/src/embed.rs` containing only this test module for now:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batches_respect_the_thousand_text_ceiling() {
        let texts: Vec<String> = (0..2500).map(|i| format!("kort tekst {i}")).collect();
        let ranges = batches(&texts);
        assert_eq!(ranges.len(), 3);
        assert_eq!(ranges[0], 0..1000);
        assert_eq!(ranges[1], 1000..2000);
        assert_eq!(ranges[2], 2000..2500);
    }

    #[test]
    fn batches_respect_the_token_ceiling() {
        // ~40 000 estimated tokens each -> at most 3 per request.
        let big = "x".repeat(160_000);
        let texts: Vec<String> = (0..7).map(|_| big.clone()).collect();
        let ranges = batches(&texts);
        assert!(ranges.len() >= 3, "large texts must split into several requests");
        for r in &ranges {
            assert!(r.len() <= 3, "each request must stay under the token ceiling");
        }
    }

    #[test]
    fn fake_embedder_is_deterministic_and_correctly_sized() {
        let f = FakeEmbedder;
        let a = f
            .embed(&["hei".to_string(), "hallo".to_string()], InputType::Document)
            .unwrap();
        let b = f.embed(&["hei".to_string()], InputType::Query).unwrap();
        assert_eq!(a.len(), 2);
        assert_eq!(a[0].len(), crate::db::EMBEDDING_DIM);
        assert_eq!(a[0], b[0], "same text must give the same vector");
        assert_ne!(a[0], a[1], "different text must give different vectors");
        let norm: f32 = a[0].iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-3, "vectors must be normalised");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Add `pub mod embed;` to `src/lib.rs`, then run:
`cd apps/creatorhub-notes/indexer && cargo test embed::`
Expected: FAIL to compile — `batches`, `FakeEmbedder`, `InputType` not found.

- [ ] **Step 3: Write minimal implementation**

Put this above the test module in `apps/creatorhub-notes/indexer/src/embed.rs`:

```rust
use anyhow::{bail, Result};
use serde::Deserialize;
use std::ops::Range;

pub const MAX_TEXTS_PER_REQUEST: usize = 1000;
pub const MAX_TOKENS_PER_REQUEST: usize = 120_000;
pub const DEFAULT_MODEL: &str = "voyage-code-3";

#[derive(Clone, Copy, Debug)]
pub enum InputType {
    Document,
    Query,
}

impl InputType {
    fn as_str(self) -> &'static str {
        match self {
            InputType::Document => "document",
            InputType::Query => "query",
        }
    }
}

pub trait Embedder {
    fn embed(&self, texts: &[String], kind: InputType) -> Result<Vec<Vec<f32>>>;
}

/// Grov tokenestimering: fire tegn per token. Bevisst konservativ.
fn est_tokens(s: &str) -> usize {
    s.len() / 4 + 1
}

pub fn batches(texts: &[String]) -> Vec<Range<usize>> {
    let mut out = Vec::new();
    let mut start = 0usize;
    while start < texts.len() {
        let mut end = start;
        let mut tokens = 0usize;
        while end < texts.len() && end - start < MAX_TEXTS_PER_REQUEST {
            let t = est_tokens(&texts[end]);
            if end > start && tokens + t > MAX_TOKENS_PER_REQUEST {
                break;
            }
            tokens += t;
            end += 1;
        }
        out.push(start..end);
        start = end;
    }
    out
}

#[derive(Deserialize)]
struct VoyageResponse {
    data: Vec<VoyageItem>,
}

#[derive(Deserialize)]
struct VoyageItem {
    embedding: Vec<f32>,
    index: usize,
}

pub struct VoyageEmbedder {
    api_key: String,
    model: String,
    client: reqwest::blocking::Client,
}

impl VoyageEmbedder {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("VOYAGE_API_KEY")
            .map_err(|_| anyhow::anyhow!("VOYAGE_API_KEY er ikke satt"))?;
        Ok(Self {
            api_key,
            model: DEFAULT_MODEL.to_string(),
            client: reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()?,
        })
    }
}

impl Embedder for VoyageEmbedder {
    fn embed(&self, texts: &[String], kind: InputType) -> Result<Vec<Vec<f32>>> {
        let mut out: Vec<Vec<f32>> = Vec::with_capacity(texts.len());
        for range in batches(texts) {
            let slice = &texts[range.clone()];
            let body = serde_json::json!({
                "model": self.model,
                "input": slice,
                "input_type": kind.as_str(),
                "output_dimension": crate::db::EMBEDDING_DIM,
                "truncation": true,
            });

            let mut attempt = 0;
            let parsed: VoyageResponse = loop {
                attempt += 1;
                let resp = self
                    .client
                    .post("https://api.voyageai.com/v1/embeddings")
                    .bearer_auth(&self.api_key)
                    .json(&body)
                    .send()?;
                let status = resp.status();
                if status.is_success() {
                    break resp.json()?;
                }
                if (status.as_u16() == 429 || status.is_server_error()) && attempt < 5 {
                    std::thread::sleep(std::time::Duration::from_secs(2u64.pow(attempt)));
                    continue;
                }
                bail!("Voyage svarte {}: {}", status, resp.text()?);
            };

            let mut sorted = parsed.data;
            sorted.sort_by_key(|i| i.index);
            for item in sorted {
                out.push(item.embedding);
            }
        }
        if out.len() != texts.len() {
            bail!("fikk {} vektorer for {} tekster", out.len(), texts.len());
        }
        Ok(out)
    }
}

/// Deterministisk falsk embedder for tester. Aldri nettverk.
pub struct FakeEmbedder;

impl Embedder for FakeEmbedder {
    fn embed(&self, texts: &[String], _kind: InputType) -> Result<Vec<Vec<f32>>> {
        Ok(texts
            .iter()
            .map(|t| {
                let mut v = vec![0f32; crate::db::EMBEDDING_DIM];
                for word in t.split_whitespace() {
                    let mut h: u64 = 1469598103934665603;
                    for b in word.as_bytes() {
                        h ^= *b as u64;
                        h = h.wrapping_mul(1099511628211);
                    }
                    v[(h as usize) % crate::db::EMBEDDING_DIM] += 1.0;
                }
                let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
                if norm > 0.0 {
                    for x in v.iter_mut() {
                        *x /= norm;
                    }
                } else {
                    v[0] = 1.0;
                }
                v
            })
            .collect())
    }
}
```

Add `blocking` to the reqwest features in `Cargo.toml`:

```toml
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls", "blocking"] }
```

Remove the now-unused `tokio` dependency line from `Cargo.toml` — the client is blocking, so no async runtime is needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test embed::`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes/indexer
git commit -m "feat(notes): add Voyage embedder with batching and a test fake"
```

---

### Task 6: Indexing run, full and incremental

**Files:**
- Create: `apps/creatorhub-notes/indexer/src/index.rs`
- Modify: `apps/creatorhub-notes/indexer/src/lib.rs`
- Create: `apps/creatorhub-notes/indexer/tests/indexing.rs`

**Interfaces:**
- Consumes: `db::open`, `db::get_meta`, `db::set_meta`, `chunk::split`, `gitsrc::*`, `embed::Embedder`.
- Produces:
  - `pub struct IndexReport { pub files: usize, pub chunks: usize, pub incremental: bool }`
  - `index::run(conn: &Connection, repo: &Path, embedder: &dyn Embedder) -> anyhow::Result<IndexReport>` — full index on first run, incremental on later runs, and it stores HEAD in `meta` under the key `last_sha`.

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/tests/indexing.rs`:

```rust
use creatorhub_notes_indexer::{db, embed::FakeEmbedder, index};
use std::path::Path;
use std::process::Command;
use tempfile::tempdir;

fn git(repo: &Path, args: &[&str]) {
    assert!(Command::new("git")
        .args(args)
        .current_dir(repo)
        .status()
        .unwrap()
        .success());
}

fn write(repo: &Path, rel: &str, body: &str) {
    let p = repo.join(rel);
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(p, body).unwrap();
}

#[test]
fn first_run_indexes_everything_and_second_run_is_incremental() {
    let dir = tempdir().unwrap();
    let repo = dir.path().join("repo");
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q"]);
    git(&repo, &["config", "user.email", "t@example.com"]);
    git(&repo, &["config", "user.name", "Test"]);

    write(&repo, "src/pris.ts", "export function beregnPris() { return 42; }\n");
    write(&repo, "src/kart.ts", "export function hentKartverket() { return 1; }\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    let fake = FakeEmbedder;

    let first = index::run(&conn, &repo, &fake).unwrap();
    assert!(!first.incremental);
    assert_eq!(first.files, 2);
    assert_eq!(first.chunks, 2);

    let rows: i64 = conn
        .query_row("select count(*) from chunks", [], |r| r.get(0))
        .unwrap();
    assert_eq!(rows, 2);
    let vecs: i64 = conn
        .query_row("select count(*) from chunk_vec", [], |r| r.get(0))
        .unwrap();
    assert_eq!(vecs, 2);

    // No changes -> incremental run that touches nothing.
    let second = index::run(&conn, &repo, &fake).unwrap();
    assert!(second.incremental);
    assert_eq!(second.files, 0);

    // Change one file, delete the other.
    write(&repo, "src/pris.ts", "export function beregnPris() { return 43; }\n");
    std::fs::remove_file(repo.join("src/kart.ts")).unwrap();
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "second"]);

    let third = index::run(&conn, &repo, &fake).unwrap();
    assert!(third.incremental);
    assert_eq!(third.files, 2, "one modified and one deleted file");

    let paths: Vec<String> = conn
        .prepare("select distinct path from chunks order by path")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(paths, vec!["src/pris.ts".to_string()], "deleted file must be purged");

    let rows: i64 = conn
        .query_row("select count(*) from chunks", [], |r| r.get(0))
        .unwrap();
    let vecs: i64 = conn
        .query_row("select count(*) from chunk_vec", [], |r| r.get(0))
        .unwrap();
    assert_eq!(rows, vecs, "chunks and vectors must stay in sync");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test indexing`
Expected: FAIL with `could not find index in creatorhub_notes_indexer`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/creatorhub-notes/indexer/src/index.rs`:

```rust
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
```

Add to `apps/creatorhub-notes/indexer/src/lib.rs`:

```rust
pub mod index;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test indexing`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes/indexer
git commit -m "feat(notes): index a repo into sqlite with incremental git diffing"
```

---

### Task 7: Semantic search

**Files:**
- Create: `apps/creatorhub-notes/indexer/src/search.rs`
- Modify: `apps/creatorhub-notes/indexer/src/lib.rs`
- Create: `apps/creatorhub-notes/indexer/tests/search.rs`

**Interfaces:**
- Consumes: `db`, `embed::{Embedder, InputType}`.
- Produces:
  - `pub struct Hit { pub path: String, pub start_line: usize, pub end_line: usize, pub distance: f64, pub text: String }`
  - `search::query(conn: &Connection, embedder: &dyn Embedder, q: &str, limit: usize) -> anyhow::Result<Vec<Hit>>` — ordered nearest first.

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/tests/search.rs`:

```rust
use creatorhub_notes_indexer::{db, embed::FakeEmbedder, index, search};
use std::path::Path;
use std::process::Command;
use tempfile::tempdir;

fn git(repo: &Path, args: &[&str]) {
    assert!(Command::new("git")
        .args(args)
        .current_dir(repo)
        .status()
        .unwrap()
        .success());
}

fn write(repo: &Path, rel: &str, body: &str) {
    let p = repo.join(rel);
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(p, body).unwrap();
}

#[test]
fn query_returns_the_matching_file_first() {
    let dir = tempdir().unwrap();
    let repo = dir.path().join("repo");
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q"]);
    git(&repo, &["config", "user.email", "t@example.com"]);
    git(&repo, &["config", "user.name", "Test"]);

    write(&repo, "src/kartverket.ts", "kartverket matrikkel adresse oppslag\n");
    write(&repo, "src/faktura.ts", "faktura betaling purring mva\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    let fake = FakeEmbedder;
    index::run(&conn, &repo, &fake).unwrap();

    let hits = search::query(&conn, &fake, "matrikkel adresse", 2).unwrap();
    assert_eq!(hits.len(), 2);
    assert_eq!(hits[0].path, "src/kartverket.ts");
    assert!(hits[0].distance <= hits[1].distance, "hits must be sorted by distance");
    assert_eq!(hits[0].start_line, 1);
    assert!(hits[0].text.contains("matrikkel"));
}

#[test]
fn query_on_empty_index_returns_nothing() {
    let dir = tempdir().unwrap();
    let conn = db::open(&dir.path().join("index.db")).unwrap();
    let hits = search::query(&conn, &FakeEmbedder, "hva som helst", 5).unwrap();
    assert!(hits.is_empty());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test search`
Expected: FAIL with `could not find search in creatorhub_notes_indexer`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/creatorhub-notes/indexer/src/search.rs`:

```rust
use crate::embed::{Embedder, InputType};
use anyhow::{bail, Result};
use rusqlite::Connection;
use zerocopy::AsBytes;

#[derive(Debug, Clone)]
pub struct Hit {
    pub path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub distance: f64,
    pub text: String,
}

pub fn query(
    conn: &Connection,
    embedder: &dyn Embedder,
    q: &str,
    limit: usize,
) -> Result<Vec<Hit>> {
    let total: i64 = conn.query_row("select count(*) from chunks", [], |r| r.get(0))?;
    if total == 0 {
        return Ok(Vec::new());
    }

    let vectors = embedder.embed(&[q.to_string()], InputType::Query)?;
    let Some(vector) = vectors.into_iter().next() else {
        bail!("embedder returnerte ingen vektor for spørringen");
    };

    let hits = conn
        .prepare(
            "select c.path, c.start_line, c.end_line, k.distance, c.text \
             from (select rowid, distance from chunk_vec \
                   where embedding match ?1 and k = ?2) k \
             join chunks c on c.id = k.rowid \
             order by k.distance",
        )?
        .query_map(
            rusqlite::params![vector.as_bytes(), limit as i64],
            |r| {
                Ok(Hit {
                    path: r.get(0)?,
                    start_line: r.get::<_, i64>(1)? as usize,
                    end_line: r.get::<_, i64>(2)? as usize,
                    distance: r.get(3)?,
                    text: r.get(4)?,
                })
            },
        )?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(hits)
}
```

Add to `apps/creatorhub-notes/indexer/src/lib.rs`:

```rust
pub mod search;
```

Note on the SQL: a `vec0` KNN search must be its own subquery with the result count given as `k = ?`; joining `chunk_vec` directly in the outer query makes SQLite plan a full scan and the `MATCH` fails. If `cargo test` reports an error mentioning `k`, the extension build wants `limit ?2` instead — replace `and k = ?2` with `limit ?2` inside the subquery, keeping the parameter order.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test search`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes/indexer
git commit -m "feat(notes): add semantic search over the chunk index"
```

---

### Task 8: Golden set and evaluation

**Files:**
- Create: `apps/creatorhub-notes/indexer/gullsett.toml`
- Create: `apps/creatorhub-notes/indexer/src/eval.rs`
- Modify: `apps/creatorhub-notes/indexer/src/lib.rs`

**Interfaces:**
- Consumes: `search::{query, Hit}`, `embed::Embedder`.
- Produces:
  - `pub struct EvalReport { pub results: Vec<(String, bool, Option<usize>)>, pub k: usize }` — question, whether the expected path appeared in the top k, and its rank.
  - `EvalReport::recall(&self) -> f64`, `EvalReport::passed(&self) -> bool` (true when recall is at least 0.80), `EvalReport::render(&self) -> String`
  - `eval::score(questions: &[Question], hits_per_question: &[Vec<Hit>], k: usize) -> EvalReport`
  - `eval::run(conn, embedder, file, k) -> anyhow::Result<EvalReport>`

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/src/eval.rs` with only this test module:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::search::Hit;

    fn hit(path: &str) -> Hit {
        Hit {
            path: path.to_string(),
            start_line: 1,
            end_line: 40,
            distance: 0.1,
            text: String::new(),
        }
    }

    fn q(question: &str, expect: &str) -> Question {
        Question {
            question: question.to_string(),
            expect: expect.to_string(),
        }
    }

    #[test]
    fn scores_rank_and_recall() {
        let questions = vec![
            q("hvor er prisingen", "pricing-routes.ts"),
            q("hvor er kartverket", "kartverket-routes.ts"),
        ];
        let hits = vec![
            vec![hit("backend/server/other.ts"), hit("backend/server/admin-lead-map-pricing-routes.ts")],
            vec![hit("backend/server/nope.ts"), hit("backend/server/also-nope.ts")],
        ];
        let report = score(&questions, &hits, 5);
        assert_eq!(report.results[0].1, true);
        assert_eq!(report.results[0].2, Some(2), "rank is 1-indexed");
        assert_eq!(report.results[1].1, false);
        assert_eq!(report.results[1].2, None);
        assert!((report.recall() - 0.5).abs() < 1e-9);
        assert!(!report.passed(), "0.5 recall is below the 0.80 threshold");
    }

    #[test]
    fn full_recall_passes() {
        let questions = vec![q("a", "a.ts")];
        let hits = vec![vec![hit("src/a.ts")]];
        let report = score(&questions, &hits, 5);
        assert!((report.recall() - 1.0).abs() < 1e-9);
        assert!(report.passed());
        assert!(report.render().contains("100"));
    }

    #[test]
    fn the_shipped_golden_set_has_twenty_questions() {
        let raw = include_str!("../gullsett.toml");
        let file: QuestionFile = toml::from_str(raw).unwrap();
        assert_eq!(file.question.len(), 20);
        for q in &file.question {
            assert!(!q.question.trim().is_empty());
            assert!(q.expect.contains('.'), "expect må peke på en fil: {}", q.expect);
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Add `pub mod eval;` to `src/lib.rs`, then run:
`cd apps/creatorhub-notes/indexer && cargo test eval::`
Expected: FAIL to compile — `Question`, `score`, `QuestionFile` not found, and `gullsett.toml` missing.

- [ ] **Step 3: Write minimal implementation**

Create `apps/creatorhub-notes/indexer/gullsett.toml`. Every `expect` below is a real path in this monorepo, verified with `git ls-files`:

```toml
# Gullsett for semantisk søk. `expect` er en delstreng av forventet filsti.
# Kjør: notes-index eval --file gullsett.toml --k 5

[[question]]
question = "hvor beregnes prisingen for lead map"
expect = "backend/server/admin-lead-map-pricing-routes.ts"

[[question]]
question = "service worker som mellomlagrer frontend-filer"
expect = "frontend/client/public/sw.js"

[[question]]
question = "fanen som viser utstyr i prosjektarbeidsflaten"
expect = "frontend/client/src/components/workspace/tabs/UtstyrTab.tsx"

[[question]]
question = "oppslag mot matrikkel og eiendomsdata på serveren"
expect = "backend/server/leadgrid-kartverket-routes.ts"

[[question]]
question = "eiendomsoppslag på iPad"
expect = "ipad/LeadMapApp/LeadMapApp/Core/KartverketService.swift"

[[question]]
question = "rett opp skjeve bilder automatisk"
expect = "ipad/CaptureApp/CaptureApp/Core/Capture/AutoStraightenFilter.swift"

[[question]]
question = "last opp store filer i biter til serveren"
expect = "backend/server/chunked-upload-routes.ts"

[[question]]
question = "betalingsvarsel fra Stripe for akademiet"
expect = "backend/server/academy-stripe-webhook-routes.ts"

[[question]]
question = "koble kundeportalen til Google Ads med OAuth"
expect = "backend/server/client-portal-google-ads-oauth.ts"

[[question]]
question = "send invitasjon til casting-team over WhatsApp"
expect = "backend/server/casting-team-whatsapp-invite-service.ts"

[[question]]
question = "hent nye e-poster inn i chatten"
expect = "backend/server/chat-gmail-poller.ts"

[[question]]
question = "agent som utvikler historien videre"
expect = "backend/server/ai-story-development-agent.ts"

[[question]]
question = "render mockup i Tauri-appen"
expect = "apps/resolve-script-manager/src-tauri/src/mockup_render.rs"

[[question]]
question = "last opp filer til Backblaze"
expect = "apps/creatorhub-one-desk/src-tauri/src/b2_uploader.rs"

[[question]]
question = "autentisering av enhet i one-desk"
expect = "apps/creatorhub-one-desk/src-tauri/src/device_auth.rs"

[[question]]
question = "trekk ut miniatyrbilder fra klipp"
expect = "apps/resolve-script-manager/python/scripts/cull/extract_thumbnails.py"

[[question]]
question = "legg klippene på takten i musikken"
expect = "apps/resolve-script-manager/python/scripts/timeline/assign_clips_to_beats.py"

[[question]]
question = "finn stille partier i tidslinjen"
expect = "apps/resolve-script-manager/python/scripts/qc/detect_silent_sections_in_timeline.py"

[[question]]
question = "hindre at samme forespørsel behandles to ganger"
expect = "backend/server/_shared-idempotency.ts"

[[question]]
question = "database-endring for garanti på utstyr"
expect = "backend/migrations/0095_user_equipment_warranty.sql"
```

Put this above the test module in `apps/creatorhub-notes/indexer/src/eval.rs`:

```rust
use crate::{embed::Embedder, search};
use anyhow::Result;
use rusqlite::Connection;
use serde::Deserialize;
use std::path::Path;

pub const PASS_THRESHOLD: f64 = 0.80;

#[derive(Debug, Deserialize, Clone)]
pub struct Question {
    pub question: String,
    /// Delstreng av forventet filsti.
    pub expect: String,
}

#[derive(Debug, Deserialize)]
pub struct QuestionFile {
    pub question: Vec<Question>,
}

#[derive(Debug)]
pub struct EvalReport {
    /// (spørsmål, traff innenfor k, plassering 1-indeksert)
    pub results: Vec<(String, bool, Option<usize>)>,
    pub k: usize,
}

impl EvalReport {
    pub fn recall(&self) -> f64 {
        if self.results.is_empty() {
            return 0.0;
        }
        let hits = self.results.iter().filter(|r| r.1).count();
        hits as f64 / self.results.len() as f64
    }

    pub fn passed(&self) -> bool {
        self.recall() >= PASS_THRESHOLD
    }

    pub fn render(&self) -> String {
        let mut s = String::new();
        for (question, ok, rank) in &self.results {
            let mark = if *ok { "OK " } else { "BOM" };
            let place = rank.map(|r| r.to_string()).unwrap_or_else(|| "-".into());
            s.push_str(&format!("{mark} [{place}] {question}\n"));
        }
        s.push_str(&format!(
            "\nrecall@{} = {:.0}% ({} av {}), terskel {:.0}%\n",
            self.k,
            self.recall() * 100.0,
            self.results.iter().filter(|r| r.1).count(),
            self.results.len(),
            PASS_THRESHOLD * 100.0
        ));
        s
    }
}

pub fn score(
    questions: &[Question],
    hits_per_question: &[Vec<search::Hit>],
    k: usize,
) -> EvalReport {
    let results = questions
        .iter()
        .zip(hits_per_question.iter())
        .map(|(q, hits)| {
            let rank = hits
                .iter()
                .take(k)
                .position(|h| h.path.contains(&q.expect))
                .map(|i| i + 1);
            (q.question.clone(), rank.is_some(), rank)
        })
        .collect();
    EvalReport { results, k }
}

pub fn run(
    conn: &Connection,
    embedder: &dyn Embedder,
    file: &Path,
    k: usize,
) -> Result<EvalReport> {
    let parsed: QuestionFile = toml::from_str(&std::fs::read_to_string(file)?)?;
    let mut hits = Vec::with_capacity(parsed.question.len());
    for q in &parsed.question {
        hits.push(search::query(conn, embedder, &q.question, k)?);
    }
    Ok(score(&parsed.question, &hits, k))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test`
Expected: PASS — every test in the crate, including the three new `eval::` tests.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes/indexer
git commit -m "feat(notes): add golden set and recall evaluation"
```

### Task 9: Command-line interface

**Files:**
- Modify: `apps/creatorhub-notes/indexer/src/main.rs`
- Create: `apps/creatorhub-notes/indexer/src/cli.rs`
- Modify: `apps/creatorhub-notes/indexer/src/lib.rs`

**Interfaces:**
- Consumes: `db`, `index`, `search`, `embed::VoyageEmbedder`.
- Produces:
  - `cli::default_db_path() -> std::path::PathBuf` — `~/Library/Application Support/creatorhub-notes/index.db` on macOS, `~/.local/share/creatorhub-notes/index.db` elsewhere.
  - Binary `notes-index` with subcommands `index`, `search`, `eval`.

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/src/cli.rs` with only this test module:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_db_path_ends_in_the_app_directory() {
        let p = default_db_path();
        let s = p.to_string_lossy();
        assert!(s.ends_with("creatorhub-notes/index.db"), "fikk {s}");
        assert!(p.is_absolute());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Add `pub mod cli;` to `src/lib.rs`, then run:
`cd apps/creatorhub-notes/indexer && cargo test cli::`
Expected: FAIL to compile — `cannot find function default_db_path`.

- [ ] **Step 3: Write minimal implementation**

Put this above the test module in `apps/creatorhub-notes/indexer/src/cli.rs`:

```rust
use std::path::PathBuf;

pub fn default_db_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let base = if cfg!(target_os = "macos") {
        PathBuf::from(home).join("Library/Application Support")
    } else {
        PathBuf::from(home).join(".local/share")
    };
    base.join("creatorhub-notes").join("index.db")
}
```

Replace `apps/creatorhub-notes/indexer/src/main.rs` with:

```rust
use anyhow::Result;
use clap::{Parser, Subcommand};
use creatorhub_notes_indexer::{cli, db, embed::VoyageEmbedder, index, search};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "notes-index", about = "Semantisk indeks over CreatorHub-monorepoet")]
struct Cli {
    /// Sti til indeksdatabasen
    #[arg(long)]
    db: Option<PathBuf>,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Indekser et repo. Kjør på nytt for inkrementell oppdatering.
    Index {
        #[arg(default_value = ".")]
        repo: PathBuf,
    },
    /// Søk semantisk i indeksen
    Search {
        query: String,
        #[arg(long, default_value_t = 5)]
        limit: usize,
    },
    /// Kjør gullsettet og rapporter recall
    Eval {
        #[arg(long, default_value = "gullsett.toml")]
        file: PathBuf,
        #[arg(long, default_value_t = 5)]
        k: usize,
    },
}

fn main() -> Result<()> {
    let args = Cli::parse();
    let db_path = args.db.unwrap_or_else(cli::default_db_path);
    let conn = db::open(&db_path)?;
    let embedder = VoyageEmbedder::from_env()?;

    match args.command {
        Command::Index { repo } => {
            let report = index::run(&conn, &repo, &embedder)?;
            println!(
                "{} filer, {} biter, {}",
                report.files,
                report.chunks,
                if report.incremental { "inkrementell" } else { "full" }
            );
        }
        Command::Search { query, limit } => {
            for hit in search::query(&conn, &embedder, &query, limit)? {
                println!(
                    "{:.4}  {}:{}-{}",
                    hit.distance, hit.path, hit.start_line, hit.end_line
                );
            }
        }
        Command::Eval { file, k } => {
            let report = creatorhub_notes_indexer::eval::run(&conn, &embedder, &file, k)?;
            println!("{}", report.render());
            if !report.passed() {
                std::process::exit(1);
            }
        }
    }
    Ok(())
}
```

Every module `main.rs` calls now exists, so the binary compiles as soon as `cli.rs` is written.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test`
Expected: PASS — the whole suite, and `cargo build` produces the `notes-index` binary.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes/indexer
git commit -m "feat(notes): add notes-index command-line interface"
```

- [ ] **Step 6: Run the real index and evaluation**

This is the phase gate. It costs roughly **$6-8** of Voyage credit and takes 30-60 minutes. Confirm the scale with `--dry-run` first — it needs no API key and makes no network call — and get the user's authorisation before spending.

```bash
cd apps/creatorhub-notes/indexer
cargo run --release -- index --dry-run /Users/danielqazi/Creatorhubn-monorepo
export VOYAGE_API_KEY=...            # aldri commit denne
cargo run --release -- --db /tmp/creatorhub-index.db index /Users/danielqazi/Creatorhubn-monorepo
cargo run --release -- --db /tmp/creatorhub-index.db eval --file gullsett.toml --k 5
```

Expected: the index reports roughly 8 000 files and on the order of 107 000 chunks, writes an index file of roughly 650 MB, and `eval` prints recall at or above 80 percent and exits 0. The run prints per-batch progress and its total token usage to stderr; if it is interrupted, rerun the same command — committed batches are kept and only the remaining paths are embedded.

If recall is below 80 percent, record which questions missed and stop — that is the signal the spec names for reconsidering chunking, not a reason to tune the golden set. Do not edit `gullsett.toml` to make the run pass.

---

### Task 10: Norsk Ordbank lookup

**Files:**
- Create: `apps/creatorhub-notes/indexer/src/ordbank.rs`
- Modify: `apps/creatorhub-notes/indexer/src/lib.rs`
- Create: `apps/creatorhub-notes/indexer/tests/fixtures/fullformsliste-mini.txt`
- Create: `apps/creatorhub-notes/indexer/tests/ordbank.rs`
- Create: `apps/creatorhub-notes/indexer/README.md`

This task is groundwork for the language-verification phase. Nothing in phase 1 calls it yet; it exists so the corpus is loaded and the lookup is proven before it is needed.

**Interfaces:**
- Consumes: `db::open`.
- Produces:
  - `ordbank::load(conn: &Connection, fullform_tsv: &Path) -> anyhow::Result<usize>` — creates and fills `ordbank_fullform(form TEXT, lemma_id INTEGER, tag TEXT)` with an index on `form`, returns the row count. Idempotent: it clears the table first.
  - `ordbank::is_valid_form(conn: &Connection, form: &str) -> anyhow::Result<bool>` — case-insensitive.
  - `ordbank::tags(conn: &Connection, form: &str) -> anyhow::Result<Vec<String>>`

- [ ] **Step 1: Write the failing test**

Create `apps/creatorhub-notes/indexer/tests/fixtures/fullformsliste-mini.txt`. The real file from Språkbanken is tab-separated with a header row; this fixture mirrors the four columns the loader reads:

```
LOPENR	LEMMA_ID	OPPSLAG	TAG
1	101	hus	subst mask appell ent ub
2	101	huset	subst mask appell ent be
3	101	husene	subst mask appell fl be
4	205	skrive	verb inf
5	205	skriver	verb pres
```

Create `apps/creatorhub-notes/indexer/tests/ordbank.rs`:

```rust
use creatorhub_notes_indexer::{db, ordbank};
use tempfile::tempdir;

#[test]
fn loads_forms_and_answers_lookups() {
    let dir = tempdir().unwrap();
    let conn = db::open(&dir.path().join("index.db")).unwrap();

    let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/fullformsliste-mini.txt");
    let count = ordbank::load(&conn, &fixture).unwrap();
    assert_eq!(count, 5, "header row must not be counted");

    assert!(ordbank::is_valid_form(&conn, "husene").unwrap());
    assert!(ordbank::is_valid_form(&conn, "Husene").unwrap(), "oppslag skal være case-insensitivt");
    assert!(!ordbank::is_valid_form(&conn, "husan").unwrap());

    let tags = ordbank::tags(&conn, "skriver").unwrap();
    assert_eq!(tags, vec!["verb pres".to_string()]);

    // Loading twice must not duplicate rows.
    let again = ordbank::load(&conn, &fixture).unwrap();
    assert_eq!(again, 5);
    let rows: i64 = conn
        .query_row("select count(*) from ordbank_fullform", [], |r| r.get(0))
        .unwrap();
    assert_eq!(rows, 5);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/creatorhub-notes/indexer && cargo test --test ordbank`
Expected: FAIL with `could not find ordbank in creatorhub_notes_indexer`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/creatorhub-notes/indexer/src/ordbank.rs`:

```rust
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
    conn.execute("delete from ordbank_fullform", [])?;

    let file = std::fs::File::open(fullform_tsv)?;
    let reader = BufReader::new(file);
    let tx = conn.unchecked_transaction()?;
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
```

Add to `apps/creatorhub-notes/indexer/src/lib.rs`:

```rust
pub mod ordbank;
```

Create `apps/creatorhub-notes/indexer/README.md`:

```markdown
# notes-index

Semantisk indeks over CreatorHub-monorepoet. Fase 1 av prosjektminne-appen.
Design: `docs/superpowers/specs/2026-09-09-prosjektminne-notatapp-design.md`

## Bruk

    cargo run --release -- index --dry-run /Users/danielqazi/Creatorhubn-monorepo
    export VOYAGE_API_KEY=...
    cargo run --release -- index /Users/danielqazi/Creatorhubn-monorepo
    cargo run --release -- search "hvor beregnes prisingen for lead map"
    cargo run --release -- eval --file gullsett.toml --k 5

Kjør alltid `--dry-run` først. Den teller filer, linjer, biter, tokener og
kostnad uten å ringe Voyage og uten å trenge API-nøkkel.

Første indeksering er omtrent 8 000 filer, 3,2 millioner linjer og 107 000
biter, altså 41-50 millioner tokener og 6-8 dollar. Den tar 30-60 minutter og
gir en indeksfil på omtrent 650 MB. Senere kjøringer leser kun filer der
blob-hashen har endret seg.

## Norsk Ordbank

Brukes fra og med språkfasen, lastes allerede nå. Last ned Bokmål-utgaven fra
Språkbanken (CC-BY 4.0) og pakk den ut, så:

    cargo run --release -- --db <sti> index .   # oppretter databasen
    # deretter fra kode: ordbank::load(&conn, Path::new("ordbank/nob/fullformsliste.txt"))

Katalogen `ordbank/` er git-ignorert.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/creatorhub-notes/indexer && cargo test`
Expected: PASS — the whole suite, including the four `ordbank` assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/creatorhub-notes/indexer
git commit -m "feat(notes): load Norsk Ordbank full forms for later verification"
```

---

## Phase gate

Phase 1 is done when `cargo test` is green, the real index has been built against the monorepo, and `notes-index eval` reports recall at or above 80 percent. Only then does phase 2 (the Tauri interface) begin.

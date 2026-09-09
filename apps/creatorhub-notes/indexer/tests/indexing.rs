use anyhow::{bail, Result};
use creatorhub_notes_indexer::embed::{Embedder, FakeEmbedder, InputType};
use creatorhub_notes_indexer::{db, index, search};
use rusqlite::Connection;
use std::cell::RefCell;
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

fn init_repo(root: &Path) -> std::path::PathBuf {
    let repo = root.join("repo");
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q"]);
    git(&repo, &["config", "user.email", "t@example.com"]);
    git(&repo, &["config", "user.name", "Test"]);
    repo
}

fn count(conn: &Connection, table: &str) -> i64 {
    conn.query_row(&format!("select count(*) from {table}"), [], |r| r.get(0))
        .unwrap()
}

/// Teller hvor mange tekster som faktisk ble sendt til embedding, så et
/// «hoppet over»-tall kan bevises og ikke bare påstås.
struct CountingEmbedder {
    inner: FakeEmbedder,
    seen: RefCell<Vec<String>>,
}

impl CountingEmbedder {
    fn new() -> Self {
        Self {
            inner: FakeEmbedder,
            seen: RefCell::new(Vec::new()),
        }
    }
}

impl Embedder for CountingEmbedder {
    fn embed(&self, texts: &[String], kind: InputType) -> Result<Vec<Vec<f32>>> {
        if matches!(kind, InputType::Document) {
            self.seen.borrow_mut().extend(texts.iter().cloned());
        }
        self.inner.embed(texts, kind)
    }
}

struct FailingEmbedder;

impl Embedder for FailingEmbedder {
    fn embed(&self, _texts: &[String], _kind: InputType) -> Result<Vec<Vec<f32>>> {
        bail!("nettverket er nede")
    }
}

struct ShortEmbedder;

impl Embedder for ShortEmbedder {
    fn embed(&self, texts: &[String], kind: InputType) -> Result<Vec<Vec<f32>>> {
        let mut v = FakeEmbedder.embed(texts, kind)?;
        v.pop();
        Ok(v)
    }
}

#[test]
fn blob_hashes_drive_what_gets_reindexed() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());

    write(&repo, "src/pris.ts", "export function beregnPris() { return 42; }\n");
    write(&repo, "src/kart.ts", "export function hentKartverket() { return 1; }\n");
    write(&repo, "src/rolig.ts", "export function roresAldri() { return 7; }\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    let fake = FakeEmbedder;

    let first = index::run(&conn, &repo, &fake).unwrap();
    assert_eq!(first.files, 3);
    assert_eq!(first.chunks, 3);
    assert_eq!(first.deleted, 0);
    assert_eq!(first.skipped, 0);
    assert_eq!(count(&conn, "chunks"), 3);
    assert_eq!(count(&conn, "chunk_vec"), 3);
    assert_eq!(count(&conn, "path_state"), 3);

    // Nothing changed -> nothing embedded, everything skipped.
    let second = index::run(&conn, &repo, &fake).unwrap();
    assert_eq!(second.files, 0);
    assert_eq!(second.chunks, 0);
    assert_eq!(second.deleted, 0);
    assert_eq!(second.skipped, 3);

    // Modify one file, delete another, leave the third alone.
    write(&repo, "src/pris.ts", "export function beregnPris() { return 43; }\n");
    std::fs::remove_file(repo.join("src/kart.ts")).unwrap();
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "second"]);

    let counting = CountingEmbedder::new();
    let third = index::run(&conn, &repo, &counting).unwrap();
    assert_eq!(third.files, 1, "only the modified file is re-embedded");
    assert_eq!(third.deleted, 1, "the removed file is purged");
    assert_eq!(third.skipped, 1, "the untouched file is skipped");

    let sent = counting.seen.borrow();
    assert_eq!(sent.len(), 1, "exactly one chunk was embedded");
    assert!(sent[0].contains("beregnPris"));
    assert!(
        !sent.iter().any(|t| t.contains("roresAldri")),
        "the unchanged file must not be re-embedded"
    );

    let paths: Vec<String> = conn
        .prepare("select distinct path from chunks order by path")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(
        paths,
        vec!["src/pris.ts".to_string(), "src/rolig.ts".to_string()]
    );
    assert_eq!(count(&conn, "chunks"), count(&conn, "chunk_vec"));
    assert_eq!(count(&conn, "path_state"), 2);
}

/// Et rent teller-sjekk ville også passert om vec0-rowid N var paret med feil
/// `chunks`-rad. Her tvinges flere biter per fil, en annen fil slettes, og
/// treffet må fortsatt peke på riktig fil *og* riktig linjeintervall.
#[test]
fn rows_and_vectors_stay_aligned_across_a_reindex() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());

    let mut lang = String::from("export function tidligDel() {\n");
    for i in 0..40 {
        lang.push_str(&format!("  const fyll{i} = {i};\n"));
    }
    lang.push_str("  const matrikkel = 'kartverket adresse oppslag';\n");
    for i in 0..40 {
        lang.push_str(&format!("  const mer{i} = {i};\n"));
    }
    write(&repo, "src/lang.ts", &lang);
    write(&repo, "src/borte.ts", "export function slettes() { return 0; }\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    let fake = FakeEmbedder;
    let first = index::run(&conn, &repo, &fake).unwrap();
    assert!(
        first.chunks >= 4,
        "the long file must produce three or more chunks, got {}",
        first.chunks
    );

    std::fs::remove_file(repo.join("src/borte.ts")).unwrap();
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "second"]);
    index::run(&conn, &repo, &fake).unwrap();

    let hits = search::query(&conn, &fake, "matrikkel kartverket adresse oppslag", 1).unwrap();
    assert_eq!(hits.len(), 1);
    let hit = &hits[0];
    assert_eq!(hit.path, "src/lang.ts");
    assert!(
        hit.text.contains("matrikkel"),
        "the returned text must be the chunk that matched"
    );

    // The stored line range must describe the returned text, not some other row.
    let body: Vec<&str> = hit.text.lines().skip(1).collect();
    assert_eq!(
        body.len(),
        hit.end_line - hit.start_line + 1,
        "start_line/end_line must match the chunk text"
    );
    let source: Vec<&str> = lang.lines().collect();
    assert_eq!(body, &source[hit.start_line - 1..hit.end_line]);
}

#[test]
fn a_failing_embedder_leaves_the_database_untouched() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());
    write(&repo, "src/a.ts", "export function a() { return 1; }\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();

    // Case 1: nothing indexed yet.
    for e in [
        &FailingEmbedder as &dyn Embedder,
        &ShortEmbedder as &dyn Embedder,
    ] {
        assert!(index::run(&conn, &repo, e).is_err());
        assert_eq!(count(&conn, "chunks"), 0);
        assert_eq!(count(&conn, "chunk_vec"), 0);
        assert_eq!(count(&conn, "path_state"), 0);
    }

    // Case 2: a successful run has already populated the tables.
    index::run(&conn, &repo, &FakeEmbedder).unwrap();
    let before = (
        count(&conn, "chunks"),
        count(&conn, "chunk_vec"),
        count(&conn, "path_state"),
    );
    assert_eq!(before, (1, 1, 1));

    write(&repo, "src/b.ts", "export function b() { return 2; }\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "second"]);

    for e in [
        &FailingEmbedder as &dyn Embedder,
        &ShortEmbedder as &dyn Embedder,
    ] {
        assert!(index::run(&conn, &repo, e).is_err());
        assert_eq!(
            (
                count(&conn, "chunks"),
                count(&conn, "chunk_vec"),
                count(&conn, "path_state")
            ),
            before,
            "a failed embed must not change anything"
        );
    }
}

#[test]
fn dry_run_counts_the_corpus_without_embedding() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());
    write(&repo, "src/a.ts", "export function a() { return 1; }\n");
    write(&repo, "docs/notat.md", "# Notat\n\nlitt tekst\n");
    write(&repo, "public/logo.png", "ikke en png\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let report = index::dry_run(&repo).unwrap();
    assert_eq!(report.files, 2, "the png is not indexable");
    assert_eq!(report.lines, 4);
    assert_eq!(report.chunks, 2);
    assert!(report.tokens > 0);
    assert_eq!(report.per_ext["ts"].files, 1);
    assert_eq!(report.per_ext["md"].lines, 3);
    assert!(!report.per_ext.contains_key("png"));

    let rendered = report.render();
    assert!(rendered.contains("0.18"), "the rate must be stated: {rendered}");
    assert!(rendered.contains("2 indekserbare filer"));
}

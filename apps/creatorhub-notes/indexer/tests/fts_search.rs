use creatorhub_notes_indexer::embed::FakeEmbedder;
use creatorhub_notes_indexer::{db, index, search};
use rusqlite::Connection;
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

#[test]
fn no_embed_writes_text_and_leaves_vectors_empty() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());
    write(&repo, "notes/a.md", "# Faktura\n\nHusk å sende faktura til kunden.\n");
    write(&repo, "notes/b.md", "# Handleliste\n\nMelk, brød, ost.\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    let report = index::run_no_embed(&conn, &repo).unwrap();

    assert_eq!(report.files, 2);
    assert_eq!(report.chunks, 2);
    assert_eq!(report.tokens, 0, "no embedder means nothing was billed");
    assert_eq!(count(&conn, "chunks"), 2);
    assert_eq!(count(&conn, "path_state"), 2);
    assert_eq!(count(&conn, "chunk_vec"), 0, "no-embed must not write vectors");

    // chunk_fts is populated by the insert triggers, no embedder involved.
    let hits = search::text(&conn, "faktura", 5).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].path, "notes/a.md");
}

#[test]
fn text_search_finds_the_matching_note_and_not_the_other() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());
    write(&repo, "notes/skatt.md", "# Skatt\n\nHusk å sette av penger til skatt hvert kvartal.\n");
    write(&repo, "notes/handleliste.md", "# Handleliste\n\nMelk, brød, ost, egg.\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    index::run_no_embed(&conn, &repo).unwrap();

    let hits = search::text(&conn, "kvartal", 5).unwrap();
    let paths: Vec<&str> = hits.iter().map(|h| h.path.as_str()).collect();
    assert!(paths.contains(&"notes/skatt.md"));
    assert!(!paths.contains(&"notes/handleliste.md"));
}

#[test]
fn a_note_mentioning_the_term_repeatedly_outranks_one_mentioning_it_once() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());
    write(
        &repo,
        "notes/mye.md",
        "kartverket kartverket kartverket adresseoppslag hos kartverket igjen\n",
    );
    write(&repo, "notes/lite.md", "en enkelt henvisning til kartverket her\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    index::run_no_embed(&conn, &repo).unwrap();

    let hits = search::text(&conn, "kartverket", 5).unwrap();
    assert_eq!(hits.len(), 2);
    assert_eq!(hits[0].path, "notes/mye.md", "more mentions must rank first");
    // bm25 in SQLite: lower (more negative) is better, ordering is ascending.
    assert!(hits[0].distance <= hits[1].distance);
}

#[test]
fn norwegian_diacritics_are_not_folded_away() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());
    write(&repo, "notes/skatt.md", "Jeg må sende inn søknad om skatteutsettelse.\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    index::run_no_embed(&conn, &repo).unwrap();

    let with_diacritic = search::text(&conn, "søknad", 5).unwrap();
    assert_eq!(with_diacritic.len(), 1, "søknad must be found as written");

    let folded = search::text(&conn, "soknad", 5).unwrap();
    assert!(
        folded.is_empty(),
        "remove_diacritics 0 must keep søknad and soknad distinct, got {folded:?}"
    );
}

#[test]
fn fts5_syntax_characters_never_produce_an_error() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());
    write(&repo, "notes/a.md", "et notat om async pipeline versjon to\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    index::run_no_embed(&conn, &repo).unwrap();

    for q in [
        "hva med \"async\"?",
        "pipeline (v2)",
        "foo*",
        "a AND OR NOT b",
        "\"",
        "\"\"\"",
    ] {
        // Must return Ok, whether empty or not — never an FTS5 syntax error.
        search::text(&conn, q, 5).unwrap();
    }
}

#[test]
fn adding_an_embedder_later_backfills_vectors_without_touching_the_text() {
    let dir = tempdir().unwrap();
    let repo = init_repo(dir.path());
    write(&repo, "notes/a.md", "# Faktura\n\nHusk å sende faktura til kunden.\n");
    write(&repo, "notes/b.md", "# Reise\n\nBestill togbillett til Bergen.\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();

    // Phase 1: text-only, no embedder, no key, no network.
    let first = index::run_no_embed(&conn, &repo).unwrap();
    assert_eq!(first.chunks, 2);
    assert_eq!(count(&conn, "chunk_vec"), 0);
    let text_ids_before: Vec<i64> = conn
        .prepare("select id from chunks order by id")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    // Phase 2: same repo, unchanged blob hashes, but now an embedder is
    // available. This must NOT be a no-op just because path_state already
    // matches the current blob hashes.
    let fake = FakeEmbedder;
    let second = index::run(&conn, &repo, &fake).unwrap();

    // No re-indexing of the text side: same chunk rows, no duplicates.
    assert_eq!(count(&conn, "chunks"), 2, "text rows must not be duplicated");
    let text_ids_after: Vec<i64> = conn
        .prepare("select id from chunks order by id")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(text_ids_before, text_ids_after, "chunk ids must be unchanged");

    // The same chunks now have vectors.
    assert_eq!(count(&conn, "chunk_vec"), 2);
    assert_eq!(
        second.files, 0,
        "no path changed, so the normal work list is empty"
    );

    // A second run with no changes and no embedder gap does nothing further.
    let third = index::run(&conn, &repo, &fake).unwrap();
    assert_eq!(third.files, 0);
    assert_eq!(count(&conn, "chunk_vec"), 2, "backfill must not run twice");

    // chunk_fts must still answer, using the very same (never re-inserted) text.
    let hits = search::text(&conn, "faktura", 5).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].path, "notes/a.md");

    // And semantic search now works on notes indexed before Voyage was available.
    let semantic = search::query(&conn, &fake, "togbillett Bergen", 5).unwrap();
    assert!(semantic.iter().any(|h| h.path == "notes/b.md"));
}

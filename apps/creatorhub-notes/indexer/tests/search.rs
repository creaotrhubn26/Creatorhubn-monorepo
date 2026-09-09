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

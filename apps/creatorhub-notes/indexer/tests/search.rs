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
fn query_paths_gives_each_file_one_slot() {
    let dir = tempdir().unwrap();
    let repo = dir.path().join("repo");
    std::fs::create_dir_all(&repo).unwrap();
    git(&repo, &["init", "-q"]);
    git(&repo, &["config", "user.email", "t@example.com"]);
    git(&repo, &["config", "user.name", "Test"]);

    // A dense file whose every window repeats the query terms: chunk-level
    // search lets it occupy the whole top-k, which is the bug.
    let mut tett = String::new();
    for i in 0..200 {
        tett.push_str(&format!("kartverket matrikkel adresse oppslag rad {i}\n"));
    }
    write(&repo, "src/tett.ts", &tett);
    write(&repo, "src/nesten.ts", "kartverket matrikkel oppslag\n");
    write(&repo, "src/faktura.ts", "faktura betaling purring mva\n");
    git(&repo, &["add", "-A"]);
    git(&repo, &["commit", "-qm", "first"]);

    let conn = db::open(&dir.path().join("index.db")).unwrap();
    let fake = FakeEmbedder;
    let report = index::run(&conn, &repo, &fake).unwrap();
    assert!(report.chunks >= 8, "the dense file must span many chunks");

    let chunk_hits = search::query(&conn, &fake, "kartverket matrikkel adresse", 5).unwrap();
    assert!(
        chunk_hits.iter().filter(|h| h.path == "src/tett.ts").count() > 1,
        "chunk-level search does repeat one file, which is what query_paths fixes"
    );

    let hits = search::query_paths(&conn, &fake, "kartverket matrikkel adresse", 5).unwrap();
    let paths: Vec<&str> = hits.iter().map(|h| h.path.as_str()).collect();
    assert_eq!(paths.len(), 3, "one hit per file, got {paths:?}");
    let mut unique = paths.clone();
    unique.sort_unstable();
    unique.dedup();
    assert_eq!(unique.len(), 3, "no path may appear twice: {paths:?}");
    assert_eq!(paths[0], "src/tett.ts", "best-scoring path stays first");

    for w in hits.windows(2) {
        assert!(w[0].distance <= w[1].distance, "ordered by best distance");
    }

    // The kept hit for a multi-chunk file is its best chunk, not merely its first.
    let best = chunk_hits.iter().find(|h| h.path == "src/tett.ts").unwrap();
    assert_eq!(hits[0].start_line, best.start_line);
    assert!((hits[0].distance - best.distance).abs() < 1e-9);
}

#[test]
fn query_on_empty_index_returns_nothing() {
    let dir = tempdir().unwrap();
    let conn = db::open(&dir.path().join("index.db")).unwrap();
    let hits = search::query(&conn, &FakeEmbedder, "hva som helst", 5).unwrap();
    assert!(hits.is_empty());
}

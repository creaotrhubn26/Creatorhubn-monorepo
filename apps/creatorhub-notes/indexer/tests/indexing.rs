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

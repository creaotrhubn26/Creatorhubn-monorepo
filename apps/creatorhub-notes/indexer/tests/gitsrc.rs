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

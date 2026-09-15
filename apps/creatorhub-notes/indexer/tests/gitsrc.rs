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
fn lists_tracked_source_files_with_blob_hashes() {
    let dir = tempdir().unwrap();
    let repo = dir.path();
    git(repo, &["init", "-q"]);
    git(repo, &["config", "user.email", "t@example.com"]);
    git(repo, &["config", "user.name", "Test"]);

    write(repo, "src/a.ts", "const a = 1;\n");
    write(repo, "logo.png", "notreallyapng");
    git(repo, &["add", "-A"]);
    git(repo, &["commit", "-qm", "first"]);
    let files = gitsrc::list_files(repo).unwrap();
    assert_eq!(files, vec!["src/a.ts".to_string()]);

    let with_sha = gitsrc::list_files_with_sha(repo).unwrap();
    assert_eq!(with_sha.len(), 1, "the png is filtered out");
    assert_eq!(with_sha[0].0, "src/a.ts");
    assert_eq!(with_sha[0].1.len(), 40, "blob hash: {}", with_sha[0].1);
    let first_sha = with_sha[0].1.clone();

    // Editing the file changes its blob hash; adding a file does not change others.
    write(repo, "src/a.ts", "const a = 2;\n");
    write(repo, "src/b.py", "def f():\n    return 1\n");
    git(repo, &["add", "-A"]);
    git(repo, &["commit", "-qm", "second"]);

    let mut after = gitsrc::list_files_with_sha(repo).unwrap();
    after.sort();
    assert_eq!(after.len(), 2);
    assert_eq!(after[0].0, "src/a.ts");
    assert_ne!(after[0].1, first_sha, "edited file must get a new blob hash");
    assert_eq!(after[1].0, "src/b.py");
}

#[test]
fn non_ascii_paths_are_not_octal_escaped() {
    let dir = tempdir().unwrap();
    let repo = dir.path();
    git(repo, &["init", "-q"]);
    git(repo, &["config", "user.email", "t@example.com"]);
    git(repo, &["config", "user.name", "Test"]);

    write(repo, "src/væ.ts", "const a = 1;\n");
    git(repo, &["add", "-A"]);
    git(repo, &["commit", "-qm", "first"]);

    let files = gitsrc::list_files_with_sha(repo).unwrap();
    assert_eq!(files.len(), 1, "quoted path must survive the filter");
    assert_eq!(files[0].0, "src/væ.ts");
    assert!(gitsrc::read_if_indexable(repo, &files[0].0).is_some());
}

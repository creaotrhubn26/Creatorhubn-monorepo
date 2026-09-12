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
    // core.quotePath=false: ellers oktal-escapes git stier med ikke-ASCII-tegn
    // (`src/v\303\246.ts`), og da finner vi ikke fila på disk.
    let out = Command::new("git")
        .args(["-c", "core.quotePath=false"])
        .args(args)
        .current_dir(repo)
        .output()?;
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

/// Alle indekserbare sporede filer med git-blob-hashen sin.
/// `git ls-files -s` skriver `<mode> <sha> <stage>\t<sti>`.
pub fn list_files_with_sha(repo: &Path) -> Result<Vec<(String, String)>> {
    let mut out = Vec::new();
    for line in run(repo, &["ls-files", "-s"])?.lines() {
        let Some((meta, path)) = line.split_once('\t') else {
            continue;
        };
        if !is_indexable(path) {
            continue;
        }
        let Some(sha) = meta.split_whitespace().nth(1) else {
            continue;
        };
        out.push((path.to_string(), sha.to_string()));
    }
    Ok(out)
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

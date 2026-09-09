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

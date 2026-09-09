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

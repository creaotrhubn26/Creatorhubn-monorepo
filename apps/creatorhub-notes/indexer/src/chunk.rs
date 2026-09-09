use regex::Regex;
use std::sync::OnceLock;

pub const WINDOW: usize = 40;
pub const OVERLAP: usize = 10;

#[derive(Debug, Clone, PartialEq)]
pub struct Chunk {
    pub start_line: usize,
    pub end_line: usize,
    pub text: String,
}

fn fn_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?x)
              ^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?
              (?:
                 (?:pub\s+)?(?:async\s+)?fn\s+(?P<rust>[A-Za-z_][A-Za-z0-9_]*)
               | function\s+(?P<js>[A-Za-z_$][A-Za-z0-9_$]*)
               | (?:const|let)\s+(?P<jsconst>[A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(
               | def\s+(?P<py>[A-Za-z_][A-Za-z0-9_]*)
               | func\s+(?P<swift>[A-Za-z_][A-Za-z0-9_]*)
               | class\s+(?P<class>[A-Za-z_][A-Za-z0-9_]*)
              )",
        )
        .expect("function regex must compile")
    })
}

/// Funksjons- eller klassenavnet linja eventuelt erklærer.
fn name_in_line(line: &str) -> Option<String> {
    let caps = fn_regex().captures(line)?;
    for group in ["rust", "js", "jsconst", "py", "swift", "class"] {
        if let Some(m) = caps.name(group) {
            return Some(m.as_str().to_string());
        }
    }
    None
}

/// Deler innholdet i 40-linjers vinduer med 10 linjers overlapp.
pub fn split(path: &str, content: &str) -> Vec<Chunk> {
    if content.trim().is_empty() {
        return Vec::new();
    }
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return Vec::new();
    }
    let stride = WINDOW - OVERLAP;
    let mut out = Vec::new();
    let mut start = 0usize;
    // Siste navn sett så langt, båret videre mellom vinduer. Uten dette ville
    // hvert vindu skanne tilbake til linje 0 — kvadratisk på store filer.
    let mut name: Option<String> = None;
    let mut scanned = 0usize;
    loop {
        while scanned <= start && scanned < lines.len() {
            if let Some(found) = name_in_line(lines[scanned]) {
                name = Some(found);
            }
            scanned += 1;
        }
        let end = (start + WINDOW).min(lines.len());
        let header = match &name {
            Some(name) => format!("// {path} :: {name}"),
            None => format!("// {path}"),
        };
        let body = lines[start..end].join("\n");
        out.push(Chunk {
            start_line: start + 1,
            end_line: end,
            text: format!("{header}\n{body}"),
        });
        if end == lines.len() {
            break;
        }
        start += stride;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(n: usize) -> String {
        (1..=n).map(|i| format!("line{i}\n")).collect()
    }

    #[test]
    fn short_file_becomes_one_chunk() {
        let out = split("a/b.ts", &lines(12));
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].start_line, 1);
        assert_eq!(out[0].end_line, 12);
        assert!(out[0].text.starts_with("// a/b.ts\n"));
        assert!(out[0].text.contains("line12"));
    }

    #[test]
    fn empty_file_becomes_no_chunks() {
        assert!(split("a/b.ts", "").is_empty());
        assert!(split("a/b.ts", "   \n\n").is_empty());
    }

    #[test]
    fn windows_advance_by_thirty_lines() {
        let out = split("a/b.ts", &lines(100));
        // stride = 40 - 10 = 30 -> windows starting at 1, 31, 61; the third
        // window already reaches the last line, so no fourth window is made.
        assert_eq!(out.len(), 3);
        assert_eq!((out[0].start_line, out[0].end_line), (1, 40));
        assert_eq!((out[1].start_line, out[1].end_line), (31, 70));
        assert_eq!((out[2].start_line, out[2].end_line), (61, 100));
    }

    #[test]
    fn header_carries_nearest_function_name() {
        let mut src = String::new();
        src.push_str("export function beregnPris(a: number) {\n");
        for i in 0..60 {
            src.push_str(&format!("  const x{i} = {i};\n"));
        }
        let out = split("backend/server/pricing.ts", &src);
        assert_eq!(out.len(), 2);
        assert!(out[0].text.starts_with("// backend/server/pricing.ts :: beregnPris\n"));
        // The second window starts inside the function, so the name is carried forward.
        assert!(out[1].text.starts_with("// backend/server/pricing.ts :: beregnPris\n"));
    }

    #[test]
    fn header_omitted_when_no_function_found() {
        let out = split("docs/notat.md", &lines(5));
        assert_eq!(out[0].text.lines().next().unwrap(), "// docs/notat.md");
    }
}

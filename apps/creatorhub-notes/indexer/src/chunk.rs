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

/// Antall linjer toppfeltet legger beslag på, inkludert de to `---`-linjene.
/// 0 når fila ikke har noe toppfelt.
///
/// Toppfeltet i et notat er `id:` og `type:` — maskinfelt, ikke tekst hun har
/// skrevet. Indekseres de, returnerer «2026» hvert eneste notat fra i år og
/// «type» samtlige. `understand::split` hopper allerede over det; her ble det
/// stående med.
fn toppfelt(lines: &[&str]) -> usize {
    if lines.first().map(|l| l.trim_end()) != Some("---") {
        return 0;
    }
    // Uten en avsluttende `---` er det ikke et toppfelt, bare en strek.
    lines[1..]
        .iter()
        .position(|l| l.trim_end() == "---")
        .map(|i| i + 2)
        .unwrap_or(0)
}

/// Deler innholdet i 40-linjers vinduer med 10 linjers overlapp.
pub fn split(path: &str, content: &str) -> Vec<Chunk> {
    if content.trim().is_empty() {
        return Vec::new();
    }
    let alle: Vec<&str> = content.lines().collect();
    // Linjenumrene skal fortsatt peke inn i fila slik den er på disk, så
    // toppfeltet hoppes over med et forskyvningstall og ikke ved å klippe.
    let hopp = toppfelt(&alle);
    let lines: &[&str] = &alle[hopp.min(alle.len())..];
    if lines.is_empty() || lines.iter().all(|l| l.trim().is_empty()) {
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
        let body = lines[start..end].join("\n");
        // Hodefeltet bærer funksjonsnavnet biten står i, som er hele grunnen
        // til at det finnes. Er det ikke noe navn — og det er det aldri i et
        // notat — er det bare filstien, og da søker hun opp filnavn uten å ha
        // bedt om det: «tittel» returnerte hvert eneste `*-uten-tittel.md`.
        let text = match &name {
            Some(name) => format!("// {path} :: {name}\n{body}"),
            None => body,
        };
        out.push(Chunk {
            start_line: start + hopp + 1,
            end_line: end + hopp,
            text,
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
        assert!(out[0].text.starts_with("line1\n"));
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

    /// Uten et funksjonsnavn er hodefeltet bare filstien, og da er det verre
    /// enn ingenting: filnavnet blir søkbar tekst uten at noen har skrevet det.
    #[test]
    fn header_omitted_when_no_function_found() {
        let out = split("docs/2026-09-10-uten-tittel.md", &lines(5));
        assert_eq!(out[0].text.lines().next().unwrap(), "line1");
        assert!(!out[0].text.contains("uten-tittel"));
    }

    /// Toppfeltet er maskinfelt. Det hoppes over, men linjenumrene skal
    /// fortsatt peke inn i fila slik den ligger på disk.
    #[test]
    fn frontmatter_is_skipped_but_line_numbers_still_point_at_the_file() {
        let ut = split(
            "notater/2026-09-10-motet.md",
            "---\nid: 2026-09-10-motet\ntype: \n---\n\n# Møtet\n\nVi ble enige.\n",
        );
        assert_eq!(ut.len(), 1);
        assert!(!ut[0].text.contains("2026-09-10-motet"), "fikk: {}", ut[0].text);
        assert!(ut[0].text.contains("Vi ble enige."));
        assert_eq!(ut[0].start_line, 5, "linje 5 er den første etter toppfeltet");
        assert_eq!(ut[0].end_line, 8);
    }

    /// En strek uten en avsluttende strek er ikke et toppfelt. Da er det en
    /// horisontal linje i markdown, og teksten under skal indekseres.
    #[test]
    fn a_lone_dash_rule_is_not_frontmatter() {
        let ut = split("notater/a.md", "---\n\nVi ble enige om depositum.\n");
        assert_eq!(ut[0].start_line, 1);
        assert!(ut[0].text.contains("depositum"));
    }
}

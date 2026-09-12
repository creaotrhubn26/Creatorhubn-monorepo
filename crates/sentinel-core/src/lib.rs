//! sentinel-core — CreatorHub Sentinel's deterministic analysis engine.
//!
//! This is the *detection* layer. It is intentionally pure-`std` (no external
//! crates) so the CI gate binary compiles offline and carries no dependency
//! surface. Findings are emitted in a SARIF-shaped model so the Tauri cockpit
//! and the AI explanation layer consume one schema.
//!
//! Slice 1 ships two high-precision "confirmed" rules that encode the exact
//! bug classes that took down `/workspace` and flooded the console this week:
//!
//!   * `CH-SEC-001` — `fetch('/api/…', {credentials:'include'})` with no bearer
//!     header (the 401 flood). Backend auth reads only the Authorization /
//!     x-session-token header, so cookie-only calls 401 even when logged in.
//!   * `CH-BUG-001` — array-spread of a `useState(null)` variable (`[...tasks]`
//!     → "tasks is not iterable" before data loads).
//!
//! The graph-dependent rules (`CH-ARCH-001` provider-contract, `CH-ARCH-002`
//! missing-ErrorBoundary) require the tree-sitter import/JSX graph and land in
//! the next increment; they are declared in [`RULES`] so the catalog is stable.

use std::fs;
use std::path::{Path, PathBuf};

// ─── Finding model (SARIF-lean) ──────────────────────────────────────────

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Severity {
    Error,
    Warning,
    Note,
}

impl Severity {
    pub fn as_str(self) -> &'static str {
        match self {
            Severity::Error => "error",
            Severity::Warning => "warning",
            Severity::Note => "note",
        }
    }
}

/// Separates "sikre funn" (Confirmed — block the deploy) from "mulige
/// mistanker" (Suspected — surface, don't block), per the product spec.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Confidence {
    Confirmed,
    Suspected,
}

impl Confidence {
    pub fn as_str(self) -> &'static str {
        match self {
            Confidence::Confirmed => "confirmed",
            Confidence::Suspected => "suspected",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Finding {
    pub rule_id: &'static str,
    pub severity: Severity,
    pub confidence: Confidence,
    pub file: String,
    pub line: usize,
    /// Why it is wrong + what to do — the deterministic message. (The AI layer
    /// enriches this with blast-radius; the gate ships without it.)
    pub message: String,
    pub snippet: String,
}

/// Static rule catalog — stable ids so the cockpit/CI can reference rules that
/// are not yet implemented.
pub struct RuleDef {
    pub id: &'static str,
    pub title: &'static str,
    pub implemented: bool,
}

pub const RULES: &[RuleDef] = &[
    RuleDef { id: "CH-SEC-001", title: "fetch() to /api/ with credentials:'include' and no bearer header", implemented: true },
    RuleDef { id: "CH-BUG-001", title: "array-spread of a useState(null) variable", implemented: true },
    RuleDef { id: "CH-ARCH-001", title: "hook used outside its required Provider (graph)", implemented: false },
    RuleDef { id: "CH-ARCH-002", title: "route render tree with no ErrorBoundary ancestor (graph)", implemented: false },
];

// ─── File collection ─────────────────────────────────────────────────────

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build", ".next", "coverage",
    ".turbo", "out", ".vercel", "gen",
];

pub fn collect_source_files(roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for r in roots {
        walk(r, &mut out);
    }
    out
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
    let rd = match fs::read_dir(dir) {
        Ok(x) => x,
        Err(_) => return,
    };
    for entry in rd.flatten() {
        let p = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if p.is_dir() {
            if SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            walk(&p, out);
        } else if let Some(ext) = p.extension().and_then(|x| x.to_str()) {
            if matches!(ext, "ts" | "tsx") && !name.ends_with(".d.ts") {
                out.push(p);
            }
        }
    }
}

// ─── Scanning primitives ─────────────────────────────────────────────────

fn line_of(src: &str, byte: usize) -> usize {
    src.as_bytes()[..byte.min(src.len())]
        .iter()
        .filter(|&&b| b == b'\n')
        .count()
        + 1
}

fn ident_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'$'
}

/// Index of the `)` matching the `(` at `open`, skipping string/template
/// literals (so parens inside strings don't unbalance the count).
fn matching_paren(b: &[u8], open: usize) -> Option<usize> {
    let mut depth: i32 = 0;
    let mut i = open;
    let mut str_ch: u8 = 0;
    while i < b.len() {
        let c = b[i];
        if str_ch != 0 {
            if c == b'\\' {
                i += 2;
                continue;
            }
            if c == str_ch {
                str_ch = 0;
            }
            i += 1;
            continue;
        }
        match c {
            b'\'' | b'"' | b'`' => str_ch = c,
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

/// The first top-level argument slice of a call whose parens span `open..=close`.
fn first_arg<'a>(b: &'a [u8], open: usize, close: usize) -> &'a [u8] {
    let start = open + 1;
    let mut i = start;
    let mut depth: i32 = 0;
    let mut str_ch: u8 = 0;
    while i < close {
        let c = b[i];
        if str_ch != 0 {
            if c == b'\\' {
                i += 2;
                continue;
            }
            if c == str_ch {
                str_ch = 0;
            }
            i += 1;
            continue;
        }
        match c {
            b'\'' | b'"' | b'`' => str_ch = c,
            b'(' | b'[' | b'{' => depth += 1,
            b')' | b']' | b'}' => depth -= 1,
            b',' if depth == 0 => return &b[start..i],
            _ => {}
        }
        i += 1;
    }
    &b[start..close]
}

fn line_bounds(src: &str, byte: usize) -> (usize, usize) {
    let b = src.as_bytes();
    let start = src[..byte].rfind('\n').map(|x| x + 1).unwrap_or(0);
    let mut end = byte;
    while end < b.len() && b[end] != b'\n' {
        end += 1;
    }
    (start, end)
}

fn snippet_at(src: &str, byte: usize) -> String {
    let (s, e) = line_bounds(src, byte);
    src[s..e].trim().to_string()
}

// ─── Rule CH-SEC-001 — fetch() to /api/ without a bearer header ───────────

const AUTH_MARKERS: &[&str] = &[
    "Authorization",
    "authHeaders",
    "getAuthHeader",
    "x-session-token",
    "x-auth-token",
];

pub fn rule_missing_bearer(path: &str, src: &str) -> Vec<Finding> {
    // Browser-context bug only. A server-side node fetch to the app's own API
    // (backend/*) with credentials:'include' is meaningless and usually carries
    // auth via a query token — not this bug class.
    if !path.contains("frontend") {
        return Vec::new();
    }
    let b = src.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while let Some(rel) = src[i..].find("fetch(") {
        let idx = i + rel;
        i = idx + 6;
        // Boundary: exclude `apiFetch(` (capital F won't match anyway) and any
        // identifier-prefixed `xfetch(`; allow `.fetch(` (window.fetch).
        let prefixed = idx > 0 && ident_byte(b[idx - 1]);
        if prefixed {
            continue;
        }
        let open = idx + 5; // '(' directly after "fetch"
        let close = match matching_paren(b, open) {
            Some(c) => c,
            None => continue,
        };
        let call = &src[idx..=close];
        let arg = std::str::from_utf8(first_arg(b, open, close)).unwrap_or("");
        let is_api = arg.contains("/api/");
        let cookie_only = call.contains("credentials") && call.contains("include");
        let has_auth = AUTH_MARKERS.iter().any(|m| call.contains(m));
        if is_api && cookie_only && !has_auth {
            // A `headers:` key means the call attaches *some* headers, possibly a
            // bearer via a variable we can't see in-call → suspect, don't block.
            // A bare `{credentials:'include'}` provably attaches nothing → confirmed.
            let confidence = if call.contains("headers") {
                Confidence::Suspected
            } else {
                Confidence::Confirmed
            };
            out.push(Finding {
                rule_id: "CH-SEC-001",
                severity: Severity::Error,
                confidence,
                file: path.to_string(),
                line: line_of(src, idx),
                message: format!(
                    "fetch() to {} sends credentials:'include' but attaches no Authorization bearer header. Backend auth reads only the header token (Authorization / x-session-token), so this 401s even for logged-in users. Use apiFetch() or spread authHeaders().",
                    trim_url(arg)
                ),
                snippet: snippet_at(src, idx),
            });
        }
    }
    out
}

fn trim_url(arg: &str) -> String {
    let t = arg.trim().trim_matches(|c| c == '\'' || c == '"' || c == '`');
    let head: String = t.chars().take(60).collect();
    if t.chars().count() > 60 {
        format!("{head}…")
    } else {
        head
    }
}

// ─── Rule CH-BUG-001 — spread of a useState(null) variable ────────────────

pub fn rule_null_spread(path: &str, src: &str) -> Vec<Finding> {
    let b = src.as_bytes();

    // 1. Collect state vars whose useState initialiser is literally null/undefined.
    let mut null_vars: Vec<String> = Vec::new();
    let mut i = 0;
    while let Some(rel) = src[i..].find("useState") {
        let idx = i + rel;
        i = idx + 8;
        // The '(' opening the useState call (skip an optional <Generic>).
        let open = match src[idx..].find('(') {
            Some(p) => idx + p,
            None => continue,
        };
        let close = match matching_paren(b, open) {
            Some(c) => c,
            None => continue,
        };
        let init = src[open + 1..close].trim();
        if init == "null" || init == "undefined" {
            if let Some(name) = destructured_name(src, idx) {
                if !null_vars.contains(&name) {
                    null_vars.push(name);
                }
            }
        }
    }
    if null_vars.is_empty() {
        return Vec::new();
    }

    // 2. Flag `...name` spreads of those vars. A guarded `...(name || [])` is
    //    skipped automatically — the char after `...` is `(`, not an identifier.
    let mut out = Vec::new();
    let mut j = 0;
    while let Some(rel) = src[j..].find("...") {
        let idx = j + rel;
        j = idx + 3;
        let after = idx + 3;
        if after >= b.len() || !(b[after].is_ascii_alphabetic() || b[after] == b'_' || b[after] == b'$') {
            continue;
        }
        let mut k = after;
        while k < b.len() && ident_byte(b[k]) {
            k += 1;
        }
        let name = &src[after..k];
        // Only ARRAY spread `[...x]` (and array-nested) throws on null. Object
        // spread `{...x}` is safe (`{...null}` → `{}`), so skip `{`/`(` context.
        if enclosing_opener(b, idx) != Some(b'[') {
            continue;
        }
        // Direct-variable spread only: `[...tasks]`. A member/index/call access
        // `[...obj.items]` is a different (null-property) class — skip to keep
        // this rule's "not iterable" message precise and confirmed.
        if k < b.len() && matches!(b[k], b'.' | b'[' | b'(') {
            continue;
        }
        if null_vars.iter().any(|v| v == name) {
            out.push(Finding {
                rule_id: "CH-BUG-001",
                severity: Severity::Error,
                confidence: Confidence::Confirmed,
                file: path.to_string(),
                line: line_of(src, idx),
                message: format!(
                    "Spread of `{name}`, which is initialised to null via useState — `[...{name}]` throws \"{name} is not iterable\" before data loads. Guard it as `...({name} || [])`."
                ),
                snippet: snippet_at(src, idx),
            });
        }
    }
    out
}

/// The innermost enclosing open bracket to the left of `pos` (`[`, `{`, or
/// `(`), or None at top level. Well-formed nesting assumed: walk left, count
/// closers, and the first opener seen at depth 0 is the enclosing one.
fn enclosing_opener(b: &[u8], pos: usize) -> Option<u8> {
    let mut depth: i32 = 0;
    let mut i = pos;
    let mut str_ch: u8 = 0;
    while i > 0 {
        i -= 1;
        let c = b[i];
        // Cheap string skip: toggle on unescaped quotes going backward. Not
        // perfect, but spreads live in code, not string bodies.
        if str_ch != 0 {
            if c == str_ch && (i == 0 || b[i - 1] != b'\\') {
                str_ch = 0;
            }
            continue;
        }
        match c {
            b'\'' | b'"' | b'`' => str_ch = c,
            b')' | b']' | b'}' => depth += 1,
            b'(' | b'[' | b'{' => {
                if depth == 0 {
                    return Some(c);
                }
                depth -= 1;
            }
            _ => {}
        }
    }
    None
}

/// Given the byte index of a `useState` token, walk left to the enclosing
/// `const [name, setName]` and return `name`.
fn destructured_name(src: &str, use_idx: usize) -> Option<String> {
    // Floor the look-back window to a char boundary — a fixed byte offset can
    // land inside a multi-byte char (æ/ø/å in comments/strings) and panic.
    let mut start = use_idx.saturating_sub(200);
    while start < use_idx && !src.is_char_boundary(start) {
        start += 1;
    }
    let seg = &src[start..use_idx];
    let lb = seg.rfind('[')?;
    let b = src.as_bytes();
    let mut k = start + lb + 1;
    while k < use_idx && b[k] == b' ' {
        k += 1;
    }
    let s = k;
    while k < use_idx && ident_byte(b[k]) {
        k += 1;
    }
    if k > s {
        Some(src[s..k].to_string())
    } else {
        None
    }
}

// ─── Orchestration ───────────────────────────────────────────────────────

pub fn analyze_file(path: &str, src: &str) -> Vec<Finding> {
    let mut f = Vec::new();
    f.extend(rule_missing_bearer(path, src));
    f.extend(rule_null_spread(path, src));
    f
}

pub fn analyze_roots(roots: &[PathBuf]) -> Vec<Finding> {
    let mut all = Vec::new();
    for p in collect_source_files(roots) {
        if let Ok(src) = fs::read_to_string(&p) {
            all.extend(analyze_file(&p.to_string_lossy(), &src));
        }
    }
    all.sort_by(|a, b| a.file.cmp(&b.file).then(a.line.cmp(&b.line)));
    all
}

// ─── Serialization (manual; zero deps) ───────────────────────────────────

fn json_escape(s: &str) -> String {
    let mut o = String::with_capacity(s.len() + 8);
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c if (c as u32) < 0x20 => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o
}

/// Minimal but valid SARIF 2.1.0 — the universal finding schema the cockpit,
/// GitHub code-scanning, and the AI layer all read.
pub fn to_sarif(findings: &[Finding]) -> String {
    let mut results = String::new();
    for (n, f) in findings.iter().enumerate() {
        if n > 0 {
            results.push(',');
        }
        results.push_str(&format!(
            r#"{{"ruleId":"{}","level":"{}","message":{{"text":"{}"}},"properties":{{"confidence":"{}"}},"locations":[{{"physicalLocation":{{"artifactLocation":{{"uri":"{}"}},"region":{{"startLine":{}}}}}}}]}}"#,
            f.rule_id,
            f.severity.as_str(),
            format_args!("{}", json_escape(&f.message)),
            f.confidence.as_str(),
            json_escape(&f.file),
            f.line,
        ));
    }
    format!(
        r#"{{"version":"2.1.0","$schema":"https://json.schemastore.org/sarif-2.1.0.json","runs":[{{"tool":{{"driver":{{"name":"CreatorHub Sentinel","version":"0.1.0","rules":[]}}}},"results":[{results}]}}]}}"#
    )
}

// ─── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const FE: &str = "frontend/client/src/x.tsx";

    fn bearer(src: &str) -> Vec<Finding> {
        rule_missing_bearer(FE, src)
    }

    #[test]
    fn bearer_flags_bare_cookie_call() {
        // The exact MarketingCockpitTab bug.
        let f = bearer("const r = await fetch('/api/role-room/x', { credentials: 'include' });");
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].confidence, Confidence::Confirmed);
    }

    #[test]
    fn bearer_silent_when_auth_header_present() {
        assert!(bearer("fetch('/api/x', { credentials: 'include', headers: { Authorization: `Bearer ${t}` } })").is_empty());
        assert!(bearer("fetch('/api/x', { credentials: 'include', headers: authHeaders() })").is_empty());
    }

    #[test]
    fn bearer_headers_var_is_suspected_not_confirmed() {
        let f = bearer("fetch('/api/x', { credentials: 'include', headers })");
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].confidence, Confidence::Suspected);
    }

    #[test]
    fn bearer_ignores_apifetch_and_backend() {
        assert!(bearer("apiFetch('/api/x', { credentials: 'include' })").is_empty());
        assert!(rule_missing_bearer("backend/server/index.ts", "fetch('/api/x', { credentials: 'include' })").is_empty());
    }

    #[test]
    fn null_spread_flags_direct_array_spread() {
        // The exact OversiktTab bug.
        let src = "const [tasks, setTasks] = useState(null);\nconst all = [...tasks, ...checks];";
        let f = rule_null_spread(FE, src);
        assert_eq!(f.len(), 1, "expected one finding, got {f:?}");
        assert_eq!(f[0].rule_id, "CH-BUG-001");
    }

    #[test]
    fn null_spread_silent_on_guarded_and_object_and_member() {
        let base = "const [tasks, setTasks] = useState(null);\n";
        assert!(rule_null_spread(FE, &format!("{base}const a = [...(tasks || [])];")).is_empty(), "guarded");
        assert!(rule_null_spread(FE, &format!("{base}const o = {{ ...tasks }};")).is_empty(), "object spread");
        assert!(rule_null_spread(FE, &format!("{base}const m = [...tasks.items];")).is_empty(), "member access");
    }

    #[test]
    fn null_spread_silent_when_initialised_nonnull() {
        let src = "const [tasks, setTasks] = useState([]);\nconst all = [...tasks];";
        assert!(rule_null_spread(FE, src).is_empty());
    }

    #[test]
    fn handles_multibyte_norwegian_without_panic() {
        // Regression: fixed-offset look-back must floor to a char boundary.
        let src = "// æøå kommentar med mange tegn æøå æøå æøå\nconst [x, setX] = useState(null);\nconst y = [...x];";
        let f = rule_null_spread(FE, src);
        assert_eq!(f.len(), 1);
    }
}

pub fn to_json(findings: &[Finding]) -> String {
    let mut items = String::new();
    for (n, f) in findings.iter().enumerate() {
        if n > 0 {
            items.push(',');
        }
        items.push_str(&format!(
            r#"{{"ruleId":"{}","severity":"{}","confidence":"{}","file":"{}","line":{},"message":"{}","snippet":"{}"}}"#,
            f.rule_id,
            f.severity.as_str(),
            f.confidence.as_str(),
            json_escape(&f.file),
            f.line,
            json_escape(&f.message),
            json_escape(&f.snippet),
        ));
    }
    format!("[{items}]")
}

//! sentinel-ci — the headless deployment gate.
//!
//! Walks the repo, runs the deterministic rule engine, prints findings grouped
//! into "sikre funn" (Confirmed → block) and "mulige mistanker" (Suspected →
//! surface). Exits non-zero when any Confirmed Error is present, so a CI step
//! can stand between `Deploy` and `Produksjon` in the Utrullingspipeline.
//!
//! Usage:
//!   sentinel-ci [BASE_DIR] [--json | --sarif] [--all]
//!
//!   BASE_DIR   repo root to scan (default ".")
//!   --json     emit machine-readable JSON instead of the human report
//!   --sarif    emit SARIF 2.1.0 (for GitHub code-scanning / the cockpit)
//!   --all      exit 0 even with findings (report-only; don't block)

use std::path::PathBuf;
use std::process::ExitCode;

use sentinel_core::{analyze_roots, to_json, to_sarif, Confidence, Finding, Severity};

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let json = args.iter().any(|a| a == "--json");
    let sarif = args.iter().any(|a| a == "--sarif");
    let report_only = args.iter().any(|a| a == "--all");
    let base = args
        .iter()
        .find(|a| !a.starts_with("--"))
        .cloned()
        .unwrap_or_else(|| ".".to_string());

    let roots = resolve_roots(&base);
    if roots.is_empty() {
        eprintln!("sentinel: no source roots found under {base:?}");
        return ExitCode::from(2);
    }

    let findings = analyze_roots(&roots);

    if json {
        println!("{}", to_json(&findings));
    } else if sarif {
        println!("{}", to_sarif(&findings));
    } else {
        print_human(&findings, &roots);
    }

    let blocking = findings
        .iter()
        .filter(|f| f.severity == Severity::Error && f.confidence == Confidence::Confirmed)
        .count();

    if blocking > 0 && !report_only {
        if !json && !sarif {
            eprintln!(
                "\n\x1b[31m✖ Sentinel gate: {blocking} confirmed error(s) — deploy blocked.\x1b[0m"
            );
        }
        return ExitCode::from(1);
    }
    ExitCode::SUCCESS
}

/// Prefer the two known source trees; fall back to scanning the base dir.
fn resolve_roots(base: &str) -> Vec<PathBuf> {
    let candidates = ["frontend/client/src", "backend/server"];
    let mut roots: Vec<PathBuf> = candidates
        .iter()
        .map(|c| PathBuf::from(base).join(c))
        .filter(|p| p.is_dir())
        .collect();
    if roots.is_empty() {
        let b = PathBuf::from(base);
        if b.is_dir() {
            roots.push(b);
        }
    }
    roots
}

fn print_human(findings: &[Finding], roots: &[PathBuf]) {
    let roots_str: Vec<String> = roots.iter().map(|r| r.to_string_lossy().into_owned()).collect();
    println!("\x1b[1mCreatorHub Sentinel\x1b[0m — deterministic gate  ·  roots: {}", roots_str.join(", "));

    let confirmed: Vec<&Finding> = findings.iter().filter(|f| f.confidence == Confidence::Confirmed).collect();
    let suspected: Vec<&Finding> = findings.iter().filter(|f| f.confidence == Confidence::Suspected).collect();

    if findings.is_empty() {
        println!("\n\x1b[32m✓ No findings.\x1b[0m");
        return;
    }

    if !confirmed.is_empty() {
        println!("\n\x1b[31m● Sikre funn (Confirmed — blocking)\x1b[0m  [{}]", confirmed.len());
        for f in &confirmed {
            print_finding(f);
        }
    }
    if !suspected.is_empty() {
        println!("\n\x1b[33m● Mulige mistanker (Suspected — non-blocking)\x1b[0m  [{}]", suspected.len());
        for f in &suspected {
            print_finding(f);
        }
    }
}

fn print_finding(f: &Finding) {
    println!(
        "\n  \x1b[36m{}\x1b[0m  {}:{}",
        f.rule_id, f.file, f.line
    );
    println!("    {}", f.message);
    if !f.snippet.is_empty() {
        println!("    \x1b[2m{}\x1b[0m", f.snippet);
    }
}

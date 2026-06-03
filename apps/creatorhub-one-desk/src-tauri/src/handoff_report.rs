//! Handoff-rapport: ende-på-dagen-leveranse fra DIT til produsent.
//!
//! Slår sammen alle session_log-data + notater for én eller flere
//! sessions, og bygger en strukturert ReportData som UI viser + kan
//! eksportere til markdown/HTML/mailto. Per-kamera-deteksjonen er en
//! heuristikk på filsti-segmenter (DCIM/100CANON → CANON, DCIM/100SONY,
//! PRIVATE/AVCHD → AVCHD-handheld). Faller tilbake til volume_label
//! hvis sti ikke gir signal.

use std::collections::BTreeMap;

use serde::Serialize;

use crate::session_log::{self, FileResult, SessionMeta};

#[derive(Debug, Clone, Serialize)]
pub struct ReportData {
    pub session_id: String,
    pub project_id: String,
    pub mount_path: String,
    pub volume_label: String,
    pub started_at_ms: u64,
    pub destinations: Vec<DestSummary>,
    pub cameras: Vec<CameraGroup>,
    pub totals: TotalsSummary,
    pub failures: Vec<FailureItem>,
    pub note: String,
    /// Ferdig-rendret Markdown — UI kan vise direkte og brukeren kan
    /// kopiere til mailto:-body eller lagre som .md.
    pub markdown: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DestSummary {
    pub id: String,
    pub label: String,
    pub path: String,
    pub files: usize,
    pub bytes: u64,
    pub failures: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct CameraGroup {
    /// f.eks. "CANON 100CANON", "SONY", "PRIVATE/AVCHD", eller fallback
    /// til volume_label hvis ingen sti-signal funnet.
    pub label: String,
    pub files: usize,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TotalsSummary {
    pub file_count: usize,
    pub total_bytes: u64,
    pub success_count: usize,
    pub failed_count: usize,
    pub skipped_count: usize,
    pub verified_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct FailureItem {
    pub source_path: String,
    pub dest_id: String,
    pub error: String,
}

pub fn generate(session_id: &str) -> Result<ReportData, String> {
    let meta = session_log::read_meta(session_id)
        .ok_or_else(|| format!("Fant ingen meta for session {}", session_id))?;
    let results = session_log::read_results(session_id);
    let note = session_log::load_note(session_id).unwrap_or_default();
    Ok(build(&meta, &results, note))
}

fn build(meta: &SessionMeta, results: &[FileResult], note: String) -> ReportData {
    let mut dest_totals: BTreeMap<String, DestSummary> = BTreeMap::new();
    for d in &meta.destinations {
        dest_totals.insert(
            d.id.clone(),
            DestSummary {
                id: d.id.clone(),
                label: d.label.clone(),
                path: d.path.clone(),
                files: 0,
                bytes: 0,
                failures: 0,
            },
        );
    }

    // Vi grupperer kameragrupper på SOURCE-stien (unik per fil-vei),
    // ikke på dest. En fil kopiert til 3 destinasjoner skal telle som
    // ÉN fil i kamera-statistikken — ikke 3.
    let mut camera_files: BTreeMap<String, (usize, u64)> = BTreeMap::new();
    let mut seen_sources: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut failures: Vec<FailureItem> = Vec::new();

    let mut success = 0usize;
    let mut failed = 0usize;
    let mut skipped = 0usize;
    let mut verified = 0usize;

    for r in results {
        let dest = dest_totals.entry(r.dest_id.clone()).or_insert(DestSummary {
            id: r.dest_id.clone(),
            label: r.dest_id.clone(),
            path: String::new(),
            files: 0,
            bytes: 0,
            failures: 0,
        });

        if r.skipped {
            skipped += 1;
        } else if r.success {
            success += 1;
            dest.files += 1;
            dest.bytes += r.size;
            if r.hash.as_deref().is_some_and(|h| !h.is_empty()) {
                verified += 1;
            }
        } else {
            failed += 1;
            dest.failures += 1;
            failures.push(FailureItem {
                source_path: r.source_path.clone(),
                dest_id: r.dest_id.clone(),
                error: r.error.clone().unwrap_or_else(|| "ukjent feil".into()),
            });
        }

        // Tell kun ÉN kameragruppe-bidrag per kildefil (ikke per dest).
        if seen_sources.insert(r.source_path.clone()) && (r.success || r.skipped) {
            let cam = detect_camera_group(&r.source_path, &meta.volume_label);
            let e = camera_files.entry(cam).or_insert((0, 0));
            e.0 += 1;
            e.1 += r.size;
        }
    }

    let cameras: Vec<CameraGroup> = camera_files
        .into_iter()
        .map(|(label, (files, bytes))| CameraGroup { label, files, bytes })
        .collect();

    let destinations: Vec<DestSummary> = dest_totals.into_values().collect();

    // file_count = unike kildefiler som ikke feilet
    let file_count = seen_sources.len();
    let total_bytes: u64 = cameras.iter().map(|c| c.bytes).sum();

    let totals = TotalsSummary {
        file_count,
        total_bytes,
        success_count: success,
        failed_count: failed,
        skipped_count: skipped,
        verified_count: verified,
    };

    let markdown = render_markdown(meta, &destinations, &cameras, &totals, &failures, &note);

    ReportData {
        session_id: meta.session_id.clone(),
        project_id: meta.project_id.clone(),
        mount_path: meta.mount_path.clone(),
        volume_label: meta.volume_label.clone(),
        started_at_ms: meta.started_at_ms,
        destinations,
        cameras,
        totals,
        failures,
        note,
        markdown,
    }
}

fn detect_camera_group(source_path: &str, fallback_label: &str) -> String {
    // Vanlige strukturer:
    //   /Volumes/SD/DCIM/100CANON/IMG_0001.CR3       → CANON
    //   /Volumes/SD/DCIM/100MSDCF/DSC00001.ARW       → SONY (MSDCF)
    //   /Volumes/SD/DCIM/100NIKON/DSC_0001.NEF       → NIKON
    //   /Volumes/SD/DCIM/100GOPRO/GOPR0001.MP4       → GOPRO
    //   /Volumes/SD/PRIVATE/M4ROOT/CLIP/C0001.MP4    → SONY-MOVIE (M4ROOT)
    //   /Volumes/SD/PRIVATE/AVCHD/BDMV/STREAM/00001  → AVCHD
    //   /Volumes/SD/XDROOT/CLIP/B001C001.MXF         → XDCAM
    let lower = source_path.to_lowercase();
    let pairs = [
        ("100canon", "CANON"),
        ("canon", "CANON"),
        ("100msdcf", "SONY MSDCF"),
        ("msdcf", "SONY MSDCF"),
        ("m4root", "SONY M4ROOT"),
        ("100sony", "SONY"),
        ("xdroot", "XDCAM"),
        ("100nikon", "NIKON"),
        ("dcim/nkn", "NIKON"),
        ("100gopro", "GOPRO"),
        ("avchd", "AVCHD"),
        ("100fuji", "FUJI"),
        ("100rcd", "RED"),
        ("xdcam", "XDCAM"),
        ("blackmagic", "BMD"),
        ("dji_", "DJI"),
        ("dji ", "DJI"),
    ];
    for (needle, label) in pairs {
        if lower.contains(needle) {
            return label.to_string();
        }
    }
    if fallback_label.is_empty() {
        "UKJENT".to_string()
    } else {
        fallback_label.to_string()
    }
}

fn human_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    const TB: u64 = GB * 1024;
    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.0} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

fn render_markdown(
    meta: &SessionMeta,
    destinations: &[DestSummary],
    cameras: &[CameraGroup],
    totals: &TotalsSummary,
    failures: &[FailureItem],
    note: &str,
) -> String {
    let mut s = String::new();
    s.push_str(&format!("# Backup-rapport — {}\n\n", meta.volume_label));
    s.push_str(&format!("- Prosjekt-ID: `{}`\n", meta.project_id));
    s.push_str(&format!("- Session-ID: `{}`\n", meta.session_id));
    s.push_str(&format!("- Kilde: `{}`\n\n", meta.mount_path));

    s.push_str("## Sammendrag\n\n");
    s.push_str(&format!("| Felt | Verdi |\n|---|---|\n"));
    s.push_str(&format!("| Antall filer | {} |\n", totals.file_count));
    s.push_str(&format!("| Total størrelse | {} |\n", human_bytes(totals.total_bytes)));
    s.push_str(&format!(
        "| Verifisert (xxHash64) | {} av {} |\n",
        totals.verified_count, totals.success_count
    ));
    s.push_str(&format!("| Feil | {} |\n", totals.failed_count));
    s.push_str(&format!("| Hoppet over (allerede kopiert) | {} |\n\n", totals.skipped_count));

    if !cameras.is_empty() {
        s.push_str("## Per kamera\n\n");
        s.push_str("| Kamera | Filer | Bytes |\n|---|---:|---:|\n");
        for c in cameras {
            s.push_str(&format!(
                "| {} | {} | {} |\n",
                c.label, c.files, human_bytes(c.bytes)
            ));
        }
        s.push('\n');
    }

    if !destinations.is_empty() {
        s.push_str("## Per destinasjon\n\n");
        s.push_str("| Destinasjon | Filer | Bytes | Feil |\n|---|---:|---:|---:|\n");
        for d in destinations {
            s.push_str(&format!(
                "| {} (`{}`) | {} | {} | {} |\n",
                d.label, d.path, d.files, human_bytes(d.bytes), d.failures
            ));
        }
        s.push('\n');
    }

    if !failures.is_empty() {
        s.push_str("## Feil-detaljer\n\n");
        for f in failures {
            s.push_str(&format!(
                "- `{}` → `{}` — {}\n",
                f.source_path, f.dest_id, f.error
            ));
        }
        s.push('\n');
    }

    if !note.trim().is_empty() {
        s.push_str("## Notater\n\n");
        s.push_str(note);
        s.push_str("\n\n");
    }

    s.push_str("---\n");
    s.push_str("_Generert av Creatorhub One Desk_\n");
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fr(src: &str, dest_id: &str, size: u64, ok: bool, hash: Option<&str>) -> FileResult {
        FileResult {
            source_path: src.into(),
            dest_id: dest_id.into(),
            size,
            success: ok,
            hash: hash.map(String::from),
            error: if ok { None } else { Some("write-fail".into()) },
            skipped: false,
            ts_ms: 0,
        }
    }

    fn meta(label: &str) -> SessionMeta {
        SessionMeta {
            session_id: "s1".into(),
            mount_path: "/Volumes/SD".into(),
            volume_label: label.into(),
            project_id: "proj_a".into(),
            started_at_ms: 0,
            destinations: vec![
                crate::session_log::DestSummary {
                    id: "did_p".into(),
                    label: "Primary".into(),
                    path: "/raid/p".into(),
                },
                crate::session_log::DestSummary {
                    id: "did_s".into(),
                    label: "Secondary".into(),
                    path: "/raid/s".into(),
                },
            ],
        }
    }

    #[test]
    fn camera_detection_from_dcim() {
        let r = build(
            &meta("EOS"),
            &[
                fr("/Volumes/SD/DCIM/100CANON/IMG_0001.CR3", "did_p", 100, true, Some("aa")),
                fr("/Volumes/SD/DCIM/100CANON/IMG_0001.CR3", "did_s", 100, true, Some("aa")),
                fr("/Volumes/SD/DCIM/100MSDCF/DSC00001.ARW", "did_p", 200, true, Some("bb")),
            ],
            String::new(),
        );
        // 2 unike kilder
        assert_eq!(r.totals.file_count, 2);
        // 3 vellykkede skrivinger
        assert_eq!(r.totals.success_count, 3);
        assert_eq!(r.totals.verified_count, 3);
        // To kameraer detektert
        assert_eq!(r.cameras.len(), 2);
        assert!(r.cameras.iter().any(|c| c.label == "CANON"));
        assert!(r.cameras.iter().any(|c| c.label.contains("MSDCF")));
    }

    #[test]
    fn fallback_to_volume_label_when_unknown_path() {
        let r = build(
            &meta("MY_DRIVE"),
            &[fr("/Volumes/SD/random/file.mov", "did_p", 100, true, Some("aa"))],
            String::new(),
        );
        assert_eq!(r.cameras.len(), 1);
        assert_eq!(r.cameras[0].label, "MY_DRIVE");
    }

    #[test]
    fn counts_failures_separately() {
        let r = build(
            &meta("EOS"),
            &[
                fr("/Volumes/SD/DCIM/100CANON/IMG_0001.CR3", "did_p", 100, true, Some("aa")),
                fr("/Volumes/SD/DCIM/100CANON/IMG_0002.CR3", "did_p", 100, false, None),
            ],
            String::new(),
        );
        assert_eq!(r.totals.success_count, 1);
        assert_eq!(r.totals.failed_count, 1);
        assert_eq!(r.failures.len(), 1);
        assert!(r.markdown.contains("Feil-detaljer"));
    }

    #[test]
    fn renders_note_section() {
        let r = build(
            &meta("EOS"),
            &[fr("/Volumes/SD/DCIM/100CANON/IMG_0001.CR3", "did_p", 1, true, Some("a"))],
            "Card 2 ga clicking-sound midt på dagen".into(),
        );
        assert!(r.markdown.contains("Notater"));
        assert!(r.markdown.contains("clicking-sound"));
    }

    #[test]
    fn human_bytes_units() {
        assert_eq!(human_bytes(0), "0 B");
        assert_eq!(human_bytes(1024), "1 KB");
        assert!(human_bytes(2 * 1024 * 1024).ends_with(" MB"));
        assert!(human_bytes(3 * 1024 * 1024 * 1024).ends_with(" GB"));
    }
}

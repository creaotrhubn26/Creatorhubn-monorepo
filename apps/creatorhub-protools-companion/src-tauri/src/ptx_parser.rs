//! Parser for Pro Tools «Export Session Info as Text».
//!
//! Pro Tools har ingen åpen marker/scripting-API på vanlige lisenser, men kan
//! eksportere all sesjons-info som tekst (File → Export → Session Info as Text).
//! Den eksporten inneholder samplerate, bitdybde, spor-listing og — viktigst —
//! en MARKERS LISTING med tidsreferanse i samples. Vi konverterer samples →
//! sekunder via sampleraten. Dette er den eneste pålitelige veien til markører
//! uten AAX/EuCon, og er rent tekst-arbeid (enhetstestbart her).

#[derive(Debug, Clone, PartialEq)]
pub struct Marker {
    pub name: String,
    pub start_seconds: f64,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ParsedSession {
    pub session_name: Option<String>,
    pub sample_rate: Option<f64>,
    pub bit_depth: Option<i64>,
    pub tracks: Vec<String>,
    pub markers: Vec<Marker>,
}

/// Fjerner all whitespace og upper-caser — brukes til å kjenne igjen de
/// bokstav-spredte seksjons-titlene («M A R K E R S  L I S T I N G»).
fn normalize_heading(line: &str) -> String {
    line.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_uppercase()
}

fn field_after_colon<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let upper = line.to_uppercase();
    if upper.trim_start().starts_with(key) {
        // Verdien står etter første kolon (Pro Tools bruker «KEY:\tVERDI»).
        line.split_once(':').map(|(_, v)| v.trim())
    } else {
        None
    }
}

fn parse_leading_number(s: &str) -> Option<f64> {
    let t = s.trim();
    let mut end = 0;
    for (i, c) in t.char_indices() {
        if c.is_ascii_digit() || c == '.' {
            end = i + c.len_utf8();
        } else {
            break;
        }
    }
    if end == 0 {
        None
    } else {
        t[..end].parse::<f64>().ok()
    }
}

/// Splitt en tabell-rad. Pro Tools bruker TAB mellom kolonner, men padder med
/// mellomrom. Vi splitter primært på TAB; faller tilbake til 2+-mellomrom hvis
/// raden ikke har tabs.
fn split_columns(line: &str) -> Vec<String> {
    if line.contains('\t') {
        line.split('\t').map(|s| s.trim().to_string()).collect()
    } else {
        line.split("  ")
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect()
    }
}

pub fn parse_session_info(text: &str) -> ParsedSession {
    let mut out = ParsedSession::default();
    let lines: Vec<&str> = text.lines().collect();

    #[derive(PartialEq)]
    enum Section {
        Header,
        Tracks,
        Markers,
    }
    let mut section = Section::Header;

    // Markør-kolonneindekser (oppdages fra header-raden i MARKERS-seksjonen).
    let mut col_name: Option<usize> = None;
    let mut col_timeref: Option<usize> = None;
    let mut col_units: Option<usize> = None;
    let mut col_location: Option<usize> = None;
    let mut marker_header_seen = false;

    for raw in &lines {
        let line = *raw;
        let norm = normalize_heading(line);

        // Seksjonsbytter (bokstav-spredte titler).
        if norm.contains("TRACKLISTING") {
            section = Section::Tracks;
            continue;
        }
        if norm.contains("MARKERSLISTING") {
            section = Section::Markers;
            marker_header_seen = false;
            continue;
        }
        if norm.contains("FILESINSESSION") || norm.contains("PLUGINLISTING") || norm.contains("CLIPSLISTING") {
            section = Section::Header; // nøytral; vi plukker ikke felter herfra
            continue;
        }

        match section {
            Section::Header => {
                if out.session_name.is_none() {
                    if let Some(v) = field_after_colon(line, "SESSION NAME") {
                        out.session_name = Some(v.to_string());
                    }
                }
                if out.sample_rate.is_none() {
                    if let Some(v) = field_after_colon(line, "SAMPLE RATE") {
                        out.sample_rate = parse_leading_number(v);
                    }
                }
                if out.bit_depth.is_none() {
                    if let Some(v) = field_after_colon(line, "BIT DEPTH") {
                        out.bit_depth = parse_leading_number(v).map(|n| n as i64);
                    }
                }
            }
            Section::Tracks => {
                if let Some(v) = field_after_colon(line, "TRACK NAME") {
                    if !v.is_empty() {
                        out.tracks.push(v.to_string());
                    }
                }
            }
            Section::Markers => {
                if line.trim().is_empty() {
                    continue;
                }
                let cols = split_columns(line);
                if !marker_header_seen {
                    // Første ikke-tomme rad er kolonne-headeren.
                    for (i, c) in cols.iter().enumerate() {
                        let u = c.to_uppercase();
                        if u.contains("NAME") {
                            col_name = Some(i);
                        } else if u.contains("TIME REFERENCE") || u == "TIME REFERENCE" {
                            col_timeref = Some(i);
                        } else if u.contains("UNIT") {
                            col_units = Some(i);
                        } else if u.contains("LOCATION") {
                            col_location = Some(i);
                        }
                    }
                    marker_header_seen = true;
                    continue;
                }
                // Data-rad.
                let name = col_name
                    .and_then(|i| cols.get(i))
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| format!("Markør {}", out.markers.len() + 1));

                let units_is_samples = col_units
                    .and_then(|i| cols.get(i))
                    .map(|u| u.to_uppercase().contains("SAMPLE"))
                    .unwrap_or(true);

                let mut start_seconds: Option<f64> = None;
                if units_is_samples {
                    if let (Some(ti), Some(sr)) = (col_timeref, out.sample_rate) {
                        if let Some(samples) = cols.get(ti).and_then(|s| parse_leading_number(s)) {
                            if sr > 0.0 {
                                start_seconds = Some(samples / sr);
                            }
                        }
                    }
                }
                // Fallback: LOCATION-timecode (HH:MM:SS:FF) hvis samples ikke gikk.
                if start_seconds.is_none() {
                    if let Some(loc) = col_location.and_then(|i| cols.get(i)) {
                        start_seconds = timecode_to_seconds(loc, 25.0);
                    }
                }

                if let Some(s) = start_seconds {
                    out.markers.push(Marker { name, start_seconds: s });
                }
            }
        }
    }

    out
}

/// HH:MM:SS:FF → sekunder. Frames antas mot oppgitt fps (default 25).
fn timecode_to_seconds(tc: &str, fps: f64) -> Option<f64> {
    let parts: Vec<&str> = tc.trim().split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let h: f64 = parts[0].trim().parse().ok()?;
    let m: f64 = parts[1].trim().parse().ok()?;
    let s: f64 = parts[2].trim().parse().ok()?;
    let f: f64 = if parts.len() >= 4 { parts[3].trim().parse().unwrap_or(0.0) } else { 0.0 };
    let fps = if fps > 0.0 { fps } else { 25.0 };
    Some(h * 3600.0 + m * 60.0 + s + f / fps)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "SESSION NAME:\tRunning Home\n\
SAMPLE RATE:\t48000.000000\n\
BIT DEPTH:\t24-bit\n\
SESSION START TIMECODE:\t01:00:00:00\n\
TIMECODE FORMAT:\t25 Frame\n\
# OF AUDIO TRACKS:\t2\n\
\n\
T R A C K   L I S T I N G\n\
TRACK NAME:\tLead Vox\n\
COMMENTS:\t\n\
TRACK NAME:\tDrums\n\
COMMENTS:\t\n\
\n\
M A R K E R S  L I S T I N G\n\
#\tLOCATION\tTIME REFERENCE\tUNITS\tNAME\tCOMMENTS\n\
1\t00:00:05:00\t240000\tSamples\tIntro\t\n\
2\t00:00:24:00\t1152000\tSamples\tVerse 1\t\n\
3\t00:01:00:00\t2880000\tSamples\tChorus\t\n";

    #[test]
    fn parses_header_fields() {
        let p = parse_session_info(SAMPLE);
        assert_eq!(p.session_name.as_deref(), Some("Running Home"));
        assert_eq!(p.sample_rate, Some(48000.0));
        assert_eq!(p.bit_depth, Some(24));
    }

    #[test]
    fn parses_tracks() {
        let p = parse_session_info(SAMPLE);
        assert_eq!(p.tracks, vec!["Lead Vox".to_string(), "Drums".to_string()]);
    }

    #[test]
    fn parses_markers_samples_to_seconds() {
        let p = parse_session_info(SAMPLE);
        assert_eq!(p.markers.len(), 3);
        assert_eq!(p.markers[0].name, "Intro");
        assert!((p.markers[0].start_seconds - 5.0).abs() < 1e-6); // 240000/48000
        assert!((p.markers[1].start_seconds - 24.0).abs() < 1e-6);
        assert!((p.markers[2].start_seconds - 60.0).abs() < 1e-6);
    }

    #[test]
    fn timecode_fallback_works() {
        assert!((timecode_to_seconds("00:00:10:00", 25.0).unwrap() - 10.0).abs() < 1e-9);
        assert!((timecode_to_seconds("00:01:00:00", 25.0).unwrap() - 60.0).abs() < 1e-9);
        // 12 frames @ 25fps = 0.48s
        assert!((timecode_to_seconds("00:00:00:12", 25.0).unwrap() - 0.48).abs() < 1e-9);
    }

    #[test]
    fn handles_empty_input() {
        let p = parse_session_info("");
        assert!(p.markers.is_empty());
        assert!(p.tracks.is_empty());
        assert!(p.sample_rate.is_none());
    }

    #[test]
    fn missing_name_column_gets_placeholder() {
        let txt = "SAMPLE RATE:\t48000.0\n\nM A R K E R S  L I S T I N G\n#\tTIME REFERENCE\tUNITS\n1\t48000\tSamples\n";
        let p = parse_session_info(txt);
        assert_eq!(p.markers.len(), 1);
        assert_eq!(p.markers[0].name, "Markør 1");
        assert!((p.markers[0].start_seconds - 1.0).abs() < 1e-6);
    }
}

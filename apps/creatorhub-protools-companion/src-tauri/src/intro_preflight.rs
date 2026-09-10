use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct TrackCounts {
    pub audio: usize,
    pub instrument: usize,
    pub midi: usize,
    pub aux: usize,
    pub io_paths: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IntroViolation {
    pub category: String,
    pub actual: usize,
    pub limit: usize,
    pub excess: usize,
    pub recommendation: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IntroPreflight {
    pub compatible: bool,
    pub counts: TrackCounts,
    pub violations: Vec<IntroViolation>,
    pub checked_against: String,
}

fn check(
    violations: &mut Vec<IntroViolation>,
    category: &str,
    actual: usize,
    limit: usize,
    recommendation: &str,
) {
    if actual > limit {
        violations.push(IntroViolation {
            category: category.to_string(),
            actual,
            limit,
            excess: actual - limit,
            recommendation: recommendation.to_string(),
        });
    }
}

/// Pro Tools Intro compatibility guard. Limits are deliberately centralized so
/// both the UI and metadata payload are based on the same deterministic report.
pub fn evaluate(counts: TrackCounts) -> IntroPreflight {
    let mut violations = Vec::new();
    check(
        &mut violations,
        "audio",
        counts.audio,
        8,
        "Commit, freeze or export extra audio tracks as stems before opening in Intro.",
    );
    check(
        &mut violations,
        "instrument",
        counts.instrument,
        8,
        "Print extra virtual instruments to audio stems.",
    );
    check(
        &mut violations,
        "midi",
        counts.midi,
        8,
        "Consolidate or export extra MIDI parts before handoff.",
    );
    check(
        &mut violations,
        "aux",
        counts.aux,
        4,
        "Flatten extra aux routing into printed stem buses.",
    );
    check(
        &mut violations,
        "io_paths",
        counts.io_paths,
        4,
        "Use a four-path I/O handoff preset for Intro.",
    );
    IntroPreflight {
        compatible: violations.is_empty(),
        counts,
        violations,
        checked_against: "Pro Tools Intro: 8 audio / 8 instrument / 8 MIDI / 4 aux / 4 I/O"
            .to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_a_session_at_intro_limits() {
        let report = evaluate(TrackCounts {
            audio: 8,
            instrument: 8,
            midi: 8,
            aux: 4,
            io_paths: 4,
        });
        assert!(report.compatible);
        assert!(report.violations.is_empty());
    }

    #[test]
    fn reports_each_overage_and_stem_remediation() {
        let report = evaluate(TrackCounts {
            audio: 11,
            instrument: 9,
            midi: 8,
            aux: 6,
            io_paths: 5,
        });
        assert!(!report.compatible);
        assert_eq!(report.violations.len(), 4);
        assert_eq!(report.violations[0].excess, 3);
        assert!(report.violations[0].recommendation.contains("stems"));
    }
}

use crate::{embed::Embedder, search};
use anyhow::Result;
use rusqlite::Connection;
use serde::Deserialize;
use std::path::Path;

pub const PASS_THRESHOLD: f64 = 0.80;

#[derive(Debug, Deserialize, Clone)]
pub struct Question {
    pub question: String,
    /// Delstreng av forventet filsti.
    pub expect: String,
}

#[derive(Debug, Deserialize)]
pub struct QuestionFile {
    pub question: Vec<Question>,
}

#[derive(Debug)]
pub struct EvalReport {
    /// (spørsmål, traff innenfor k, plassering 1-indeksert)
    pub results: Vec<(String, bool, Option<usize>)>,
    pub k: usize,
}

impl EvalReport {
    pub fn recall(&self) -> f64 {
        if self.results.is_empty() {
            return 0.0;
        }
        let hits = self.results.iter().filter(|r| r.1).count();
        hits as f64 / self.results.len() as f64
    }

    pub fn passed(&self) -> bool {
        self.recall() >= PASS_THRESHOLD
    }

    pub fn render(&self) -> String {
        let mut s = String::new();
        for (question, ok, rank) in &self.results {
            let mark = if *ok { "OK " } else { "BOM" };
            let place = rank.map(|r| r.to_string()).unwrap_or_else(|| "-".into());
            s.push_str(&format!("{mark} [{place}] {question}\n"));
        }
        s.push_str(&format!(
            "\nrecall@{} = {:.0}% ({} av {}), terskel {:.0}%\n",
            self.k,
            self.recall() * 100.0,
            self.results.iter().filter(|r| r.1).count(),
            self.results.len(),
            PASS_THRESHOLD * 100.0
        ));
        s
    }
}

pub fn score(
    questions: &[Question],
    hits_per_question: &[Vec<search::Hit>],
    k: usize,
) -> EvalReport {
    let results = questions
        .iter()
        .zip(hits_per_question.iter())
        .map(|(q, hits)| {
            let rank = hits
                .iter()
                .take(k)
                .position(|h| h.path.contains(&q.expect))
                .map(|i| i + 1);
            (q.question.clone(), rank.is_some(), rank)
        })
        .collect();
    EvalReport { results, k }
}

pub fn run(
    conn: &Connection,
    embedder: &dyn Embedder,
    file: &Path,
    k: usize,
) -> Result<EvalReport> {
    let parsed: QuestionFile = toml::from_str(&std::fs::read_to_string(file)?)?;
    let mut hits = Vec::with_capacity(parsed.question.len());
    for q in &parsed.question {
        hits.push(search::query_paths(conn, embedder, &q.question, k)?);
    }
    Ok(score(&parsed.question, &hits, k))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::search::Hit;

    fn hit(path: &str) -> Hit {
        Hit {
            path: path.to_string(),
            start_line: 1,
            end_line: 40,
            distance: 0.1,
            text: String::new(),
        }
    }

    fn q(question: &str, expect: &str) -> Question {
        Question {
            question: question.to_string(),
            expect: expect.to_string(),
        }
    }

    #[test]
    fn scores_rank_and_recall() {
        let questions = vec![
            q("hvor er prisingen", "pricing-routes.ts"),
            q("hvor er kartverket", "kartverket-routes.ts"),
        ];
        let hits = vec![
            vec![hit("backend/server/other.ts"), hit("backend/server/admin-lead-map-pricing-routes.ts")],
            vec![hit("backend/server/nope.ts"), hit("backend/server/also-nope.ts")],
        ];
        let report = score(&questions, &hits, 5);
        assert!(report.results[0].1);
        assert_eq!(report.results[0].2, Some(2), "rank is 1-indexed");
        assert!(!report.results[1].1);
        assert_eq!(report.results[1].2, None);
        assert!((report.recall() - 0.5).abs() < 1e-9);
        assert!(!report.passed(), "0.5 recall is below the 0.80 threshold");
    }

    #[test]
    fn full_recall_passes() {
        let questions = vec![q("a", "a.ts")];
        let hits = vec![vec![hit("src/a.ts")]];
        let report = score(&questions, &hits, 5);
        assert!((report.recall() - 1.0).abs() < 1e-9);
        assert!(report.passed());
        assert!(report.render().contains("100"));
    }

    #[test]
    fn the_shipped_golden_set_has_twenty_questions() {
        let raw = include_str!("../gullsett.toml");
        let file: QuestionFile = toml::from_str(raw).unwrap();
        assert_eq!(file.question.len(), 20);
        for q in &file.question {
            assert!(!q.question.trim().is_empty());
            assert!(q.expect.contains('.'), "expect må peke på en fil: {}", q.expect);
        }
    }
}

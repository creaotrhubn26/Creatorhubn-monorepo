use anyhow::{bail, Result};
use serde::Deserialize;
use std::ops::Range;

pub const MAX_TEXTS_PER_REQUEST: usize = 1000;
pub const MAX_TOKENS_PER_REQUEST: usize = 120_000;
pub const DEFAULT_MODEL: &str = "voyage-code-3";

#[derive(Clone, Copy, Debug)]
pub enum InputType {
    Document,
    Query,
}

impl InputType {
    fn as_str(self) -> &'static str {
        match self {
            InputType::Document => "document",
            InputType::Query => "query",
        }
    }
}

pub trait Embedder {
    fn embed(&self, texts: &[String], kind: InputType) -> Result<Vec<Vec<f32>>>;
}

/// Grov tokenestimering: fire tegn per token. Bevisst konservativ.
fn est_tokens(s: &str) -> usize {
    s.len() / 4 + 1
}

pub fn batches(texts: &[String]) -> Vec<Range<usize>> {
    let mut out = Vec::new();
    let mut start = 0usize;
    while start < texts.len() {
        let mut end = start;
        let mut tokens = 0usize;
        while end < texts.len() && end - start < MAX_TEXTS_PER_REQUEST {
            let t = est_tokens(&texts[end]);
            if end > start && tokens + t > MAX_TOKENS_PER_REQUEST {
                break;
            }
            tokens += t;
            end += 1;
        }
        out.push(start..end);
        start = end;
    }
    out
}

#[derive(Deserialize)]
struct VoyageResponse {
    data: Vec<VoyageItem>,
}

#[derive(Deserialize)]
struct VoyageItem {
    embedding: Vec<f32>,
    index: usize,
}

pub struct VoyageEmbedder {
    api_key: String,
    model: String,
    client: reqwest::blocking::Client,
}

impl VoyageEmbedder {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("VOYAGE_API_KEY")
            .map_err(|_| anyhow::anyhow!("VOYAGE_API_KEY er ikke satt"))?;
        Ok(Self {
            api_key,
            model: DEFAULT_MODEL.to_string(),
            client: reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()?,
        })
    }
}

impl Embedder for VoyageEmbedder {
    fn embed(&self, texts: &[String], kind: InputType) -> Result<Vec<Vec<f32>>> {
        let mut out: Vec<Vec<f32>> = Vec::with_capacity(texts.len());
        for range in batches(texts) {
            let slice = &texts[range.clone()];
            let body = serde_json::json!({
                "model": self.model,
                "input": slice,
                "input_type": kind.as_str(),
                "output_dimension": crate::db::EMBEDDING_DIM,
                "truncation": true,
            });

            let mut attempt = 0;
            let parsed: VoyageResponse = loop {
                attempt += 1;
                let resp = self
                    .client
                    .post("https://api.voyageai.com/v1/embeddings")
                    .bearer_auth(&self.api_key)
                    .json(&body)
                    .send()?;
                let status = resp.status();
                if status.is_success() {
                    break resp.json()?;
                }
                if (status.as_u16() == 429 || status.is_server_error()) && attempt < 5 {
                    std::thread::sleep(std::time::Duration::from_secs(2u64.pow(attempt)));
                    continue;
                }
                bail!("Voyage svarte {}: {}", status, resp.text()?);
            };

            let mut sorted = parsed.data;
            sorted.sort_by_key(|i| i.index);
            for item in sorted {
                out.push(item.embedding);
            }
        }
        if out.len() != texts.len() {
            bail!("fikk {} vektorer for {} tekster", out.len(), texts.len());
        }
        Ok(out)
    }
}

/// Deterministisk falsk embedder for tester. Aldri nettverk.
pub struct FakeEmbedder;

impl Embedder for FakeEmbedder {
    fn embed(&self, texts: &[String], _kind: InputType) -> Result<Vec<Vec<f32>>> {
        Ok(texts
            .iter()
            .map(|t| {
                let mut v = vec![0f32; crate::db::EMBEDDING_DIM];
                for word in t.split_whitespace() {
                    let mut h: u64 = 1469598103934665603;
                    for b in word.as_bytes() {
                        h ^= *b as u64;
                        h = h.wrapping_mul(1099511628211);
                    }
                    v[(h as usize) % crate::db::EMBEDDING_DIM] += 1.0;
                }
                let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
                if norm > 0.0 {
                    for x in v.iter_mut() {
                        *x /= norm;
                    }
                } else {
                    v[0] = 1.0;
                }
                v
            })
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batches_respect_the_thousand_text_ceiling() {
        let texts: Vec<String> = (0..2500).map(|i| format!("kort tekst {i}")).collect();
        let ranges = batches(&texts);
        assert_eq!(ranges.len(), 3);
        assert_eq!(ranges[0], 0..1000);
        assert_eq!(ranges[1], 1000..2000);
        assert_eq!(ranges[2], 2000..2500);
    }

    #[test]
    fn batches_respect_the_token_ceiling() {
        // ~40 000 estimated tokens each -> at most 3 per request.
        let big = "x".repeat(160_000);
        let texts: Vec<String> = (0..7).map(|_| big.clone()).collect();
        let ranges = batches(&texts);
        assert!(ranges.len() >= 3, "large texts must split into several requests");
        for r in &ranges {
            assert!(r.len() <= 3, "each request must stay under the token ceiling");
        }
    }

    #[test]
    fn fake_embedder_is_deterministic_and_correctly_sized() {
        let f = FakeEmbedder;
        let a = f
            .embed(&["hei".to_string(), "hallo".to_string()], InputType::Document)
            .unwrap();
        let b = f.embed(&["hei".to_string()], InputType::Query).unwrap();
        assert_eq!(a.len(), 2);
        assert_eq!(a[0].len(), crate::db::EMBEDDING_DIM);
        assert_eq!(a[0], b[0], "same text must give the same vector");
        assert_ne!(a[0], a[1], "different text must give different vectors");
        let norm: f32 = a[0].iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-3, "vectors must be normalised");
    }
}

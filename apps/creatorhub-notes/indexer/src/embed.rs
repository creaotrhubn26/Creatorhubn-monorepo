use anyhow::{bail, Result};
use serde::Deserialize;
use std::ops::Range;
use std::sync::atomic::{AtomicUsize, Ordering};

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

    /// Tokener embedderen har fakturert så langt. 0 for embeddere uten telling.
    fn tokens_used(&self) -> usize {
        0
    }
}

/// Grov tokenestimering: tre tegn per token. Bevisst et *overestimat*: BPE på
/// TypeScript og Swift lander rundt 3,0-3,5 tegn per token, ikke de 4 som
/// passer engelsk prosa. Å overestimere koster én ekstra forespørsel; å
/// underestimere koster en forespørsel Voyage avviser med 400.
pub fn est_tokens(s: &str) -> usize {
    s.len() / 3 + 1
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
    usage: Option<VoyageUsage>,
}

#[derive(Deserialize)]
struct VoyageUsage {
    total_tokens: usize,
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
    tokens: AtomicUsize,
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
            tokens: AtomicUsize::new(0),
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

            if let Some(usage) = &parsed.usage {
                self.tokens.fetch_add(usage.total_tokens, Ordering::Relaxed);
            }

            let mut sorted = parsed.data;
            sorted.sort_by_key(|i| i.index);
            for item in sorted {
                if item.embedding.len() != crate::db::EMBEDDING_DIM {
                    bail!(
                        "Voyage returnerte en vektor med {} dimensjoner, forventet {}. \
                         Sjekk output_dimension og modellnavn før du betaler for en full kjøring.",
                        item.embedding.len(),
                        crate::db::EMBEDDING_DIM
                    );
                }
                out.push(item.embedding);
            }
        }
        if out.len() != texts.len() {
            bail!("fikk {} vektorer for {} tekster", out.len(), texts.len());
        }
        Ok(out)
    }

    fn tokens_used(&self) -> usize {
        self.tokens.load(Ordering::Relaxed)
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
        // 160 000 chars / 3 + 1 = 53 334 estimated tokens each. Two fit under the
        // 120 000 ceiling (106 668); three do not (160 002).
        let big = "x".repeat(160_000);
        assert_eq!(est_tokens(&big), 53_334);
        let texts: Vec<String> = (0..7).map(|_| big.clone()).collect();
        assert_eq!(batches(&texts), vec![0..2, 2..4, 4..6, 6..7]);
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

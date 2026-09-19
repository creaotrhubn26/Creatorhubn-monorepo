//! Blackmagic Camera REST adapter.
//!
//! The adapter implements only endpoints present in Blackmagic's published
//! REST API: product/system summary, record state, start/stop transport and
//! clip listing. It does not treat the REST connection as a video source.

use std::time::Duration;

use reqwest::{Client, Method, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use url::Url;

use crate::local_endpoint::parse_local_endpoint;

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductInfo {
    pub device_name: Option<String>,
    pub product_name: Option<String>,
    pub software_version: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RecordState {
    pub recording: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BlackmagicProbe {
    pub api_base: String,
    pub product: ProductInfo,
    pub recording: bool,
    pub clip_count: usize,
    pub system: Value,
}

pub async fn probe(raw_base: &str) -> Result<BlackmagicProbe, String> {
    let adapter = BlackmagicCamera::new(raw_base)?;
    let product = adapter.get_json::<ProductInfo>("system/product").await?;
    let record = adapter
        .get_json::<RecordState>("transports/0/record")
        .await?;
    let clips = adapter.get_json::<Value>("clips").await?;
    let system = adapter.get_json::<Value>("system").await?;
    let clip_count = clips
        .get("clips")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    Ok(BlackmagicProbe {
        api_base: adapter.base.to_string(),
        product,
        recording: record.recording,
        clip_count,
        system,
    })
}

pub async fn set_recording(
    raw_base: &str,
    recording: bool,
    clip_name: Option<&str>,
) -> Result<RecordState, String> {
    let adapter = BlackmagicCamera::new(raw_base)?;
    if recording {
        let trimmed = clip_name.map(str::trim).filter(|name| !name.is_empty());
        if trimmed.is_some_and(|name| name.chars().count() > 128) {
            return Err("Klippenavn kan ikke være lengre enn 128 tegn".into());
        }
        adapter
            .send_no_content(
                Method::POST,
                "transports/0/record",
                trimmed.map(|name| json!({ "clipName": name })),
            )
            .await?;
    } else {
        // Blackmagic documents POST /transports/0/stop as the current
        // non-deprecated way to stop the transport, including InputRecord.
        adapter
            .send_no_content(Method::POST, "transports/0/stop", None)
            .await?;
    }
    adapter.get_json("transports/0/record").await
}

struct BlackmagicCamera {
    base: Url,
    client: Client,
}

impl BlackmagicCamera {
    fn new(raw_base: &str) -> Result<Self, String> {
        let mut base = parse_local_endpoint(raw_base, &["http", "https"])?;
        let normalized = base.path().trim_end_matches('/');
        if normalized.is_empty() {
            base.set_path("/control/api/v1/");
        } else if normalized == "/control/api/v1" {
            base.set_path("/control/api/v1/");
        } else {
            return Err(
                "Blackmagic-URL må være kameraets rot-URL eller ende med /control/api/v1/".into(),
            );
        }
        base.set_query(None);
        base.set_fragment(None);
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(4))
            .timeout(Duration::from_secs(8))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|error| format!("Kunne ikke opprette Blackmagic-klient: {error}"))?;
        Ok(Self { base, client })
    }

    fn endpoint(&self, relative: &str) -> Result<Url, String> {
        self.base
            .join(relative)
            .map_err(|error| format!("Ugyldig Blackmagic-endepunkt: {error}"))
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(&self, relative: &str) -> Result<T, String> {
        let endpoint = self.endpoint(relative)?;
        let response = self
            .client
            .get(endpoint)
            .send()
            .await
            .map_err(|error| format!("Blackmagic svarte ikke: {error}"))?;
        parse_json_response(response).await
    }

    async fn send_no_content(
        &self,
        method: Method,
        relative: &str,
        body: Option<Value>,
    ) -> Result<(), String> {
        let endpoint = self.endpoint(relative)?;
        let mut request = self.client.request(method, endpoint);
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request
            .send()
            .await
            .map_err(|error| format!("Blackmagic svarte ikke: {error}"))?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(http_error("Blackmagic-kommando", response).await)
        }
    }
}

async fn parse_json_response<T: for<'de> Deserialize<'de>>(
    response: reqwest::Response,
) -> Result<T, String> {
    if !response.status().is_success() {
        return Err(http_error("Blackmagic-lesing", response).await);
    }
    response
        .json::<T>()
        .await
        .map_err(|error| format!("Ugyldig JSON fra Blackmagic-kameraet: {error}"))
}

async fn http_error(context: &str, response: reqwest::Response) -> String {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    let excerpt: String = body.chars().take(240).collect();
    if status == StatusCode::NOT_FOUND {
        format!(
            "{context} ga 404. Kontroller at Web Media Manager er aktivert og at kameraet støtter REST API-et."
        )
    } else if excerpt.is_empty() {
        format!("{context} feilet med HTTP {status}")
    } else {
        format!("{context} feilet med HTTP {status}: {excerpt}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    async fn mock_camera(
        replies: Vec<(&'static str, &'static str)>,
    ) -> (String, tokio::task::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("listener");
        let address = listener.local_addr().expect("address");
        let handle = tokio::spawn(async move {
            for (expected_path, body) in replies {
                let (mut stream, _) = listener.accept().await.expect("accept");
                let mut request = vec![0_u8; 8192];
                let read = stream.read(&mut request).await.expect("read request");
                let request = String::from_utf8_lossy(&request[..read]);
                assert!(
                    request
                        .lines()
                        .next()
                        .is_some_and(|line| line.contains(expected_path)),
                    "expected {expected_path}, got {request}"
                );
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                stream
                    .write_all(response.as_bytes())
                    .await
                    .expect("response");
            }
        });
        (format!("http://{address}"), handle)
    }

    #[test]
    fn normalizes_camera_root_to_documented_api_base() {
        let camera = BlackmagicCamera::new("http://192.168.10.20").expect("adapter");
        assert_eq!(camera.base.as_str(), "http://192.168.10.20/control/api/v1/");
    }

    #[test]
    fn refuses_unrelated_paths_and_public_hosts() {
        assert!(BlackmagicCamera::new("http://192.168.10.20/admin").is_err());
        assert!(BlackmagicCamera::new("https://example.com").is_err());
    }

    #[tokio::test]
    async fn probes_documented_blackmagic_routes() {
        let (base, server) = mock_camera(vec![
            (
                "/control/api/v1/system/product",
                r#"{"deviceName":"A CAM","productName":"PYXIS 6K","softwareVersion":"9.7"}"#,
            ),
            (
                "/control/api/v1/transports/0/record",
                r#"{"recording":false}"#,
            ),
            ("/control/api/v1/clips", r#"{"clips":[{"clipUniqueId":1}]}"#),
            (
                "/control/api/v1/system",
                r#"{"videoFormat":{"name":"4K DCI"}}"#,
            ),
        ])
        .await;
        let result = probe(&base).await.expect("probe");
        assert_eq!(result.product.device_name.as_deref(), Some("A CAM"));
        assert_eq!(result.clip_count, 1);
        assert!(!result.recording);
        server.await.expect("server task");
    }

    #[tokio::test]
    async fn starts_recording_then_reads_back_state() {
        let (base, server) = mock_camera(vec![
            ("/control/api/v1/transports/0/record", ""),
            (
                "/control/api/v1/transports/0/record",
                r#"{"recording":true}"#,
            ),
        ])
        .await;
        let state = set_recording(&base, true, Some("A001_C001"))
            .await
            .expect("record");
        assert!(state.recording);
        server.await.expect("server task");
    }
}

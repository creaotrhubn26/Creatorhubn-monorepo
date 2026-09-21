//! Local, cloud-independent discovery and preview manifest for CreatorHub Bridge.
//!
//! The server is intentionally a small read-only control plane. Vendor adapters
//! (NDI, capture hardware or OBS output) provide an HLS URL; the iPad discovers
//! this service over Bonjour and plays the URL directly on the LAN. No video is
//! relayed through CreatorHub's cloud and this module does not pretend to decode
//! NDI when the licensed runtime is unavailable.

use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Deserialize, Serialize};

use crate::{desk_identity, helper_client, local_endpoint};

pub const SERVICE_TYPE: &str = "_creatorhubbridge._tcp.local.";
const MANIFEST_PATH: &str = "/v1/manifest";
const MAX_REQUEST_BYTES: usize = 8 * 1024;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PreviewRole {
    Multiview,
    Camera,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BridgePreviewSource {
    pub id: String,
    pub label: String,
    pub role: PreviewRole,
    pub playback_url: String,
    pub quality_label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BridgeManifest {
    pub protocol_version: u8,
    pub desk_id: String,
    pub desk_name: String,
    pub local_only: bool,
    pub sources: Vec<BridgePreviewSource>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BridgePreviewStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub service_type: &'static str,
    pub manifest_path: &'static str,
    pub source_count: usize,
    pub sources: Vec<BridgePreviewSource>,
    pub last_error: Option<String>,
}

pub struct BridgePreviewState {
    sources: RwLock<Vec<BridgePreviewSource>>,
    runtime_sources: RwLock<Vec<BridgePreviewSource>>,
    port: Mutex<Option<u16>>,
    last_error: Mutex<Option<String>>,
    daemon: Mutex<Option<Arc<ServiceDaemon>>>,
    media_token: String,
}

impl BridgePreviewState {
    pub fn new_loaded() -> Self {
        let sources = load_sources().unwrap_or_default();
        Self {
            sources: RwLock::new(sources),
            runtime_sources: RwLock::new(Vec::new()),
            port: Mutex::new(None),
            last_error: Mutex::new(None),
            daemon: Mutex::new(None),
            media_token: random_media_token(),
        }
    }

    pub fn status(&self) -> BridgePreviewStatus {
        let sources = self.effective_sources();
        let port = *self.port.lock().unwrap();
        BridgePreviewStatus {
            running: port.is_some(),
            port,
            service_type: SERVICE_TYPE,
            manifest_path: MANIFEST_PATH,
            source_count: sources.len(),
            sources,
            last_error: self.last_error.lock().unwrap().clone(),
        }
    }

    pub fn replace_sources(
        &self,
        sources: Vec<BridgePreviewSource>,
    ) -> Result<BridgePreviewStatus, String> {
        let sources = validate_sources(sources)?;
        persist_sources(&sources)?;
        *self.sources.write().unwrap() = sources;
        Ok(self.status())
    }

    fn manifest(&self, identity: &desk_identity::DeskIdentity) -> BridgeManifest {
        BridgeManifest {
            protocol_version: 1,
            desk_id: identity.desk_id.clone(),
            desk_name: identity.desk_name.clone(),
            local_only: true,
            sources: self.effective_sources(),
        }
    }

    pub fn publish_local_hls(
        &self,
        id: &str,
        label: &str,
        role: PreviewRole,
        quality_label: &str,
    ) -> Result<BridgePreviewSource, String> {
        validate_hls_component(id)?;
        let port = self
            .port
            .lock()
            .unwrap()
            .ok_or_else(|| "Bridge preview-serveren er ikke startet".to_string())?;
        let source = BridgePreviewSource {
            id: id.to_string(),
            label: label.to_string(),
            role,
            playback_url: format!(
                "http://127.0.0.1:{port}/v1/hls/{}/{id}/index.m3u8",
                self.media_token
            ),
            quality_label: quality_label.to_string(),
        };
        validate_sources(vec![source.clone()])?;
        let mut runtime = self.runtime_sources.write().unwrap();
        runtime.retain(|existing| existing.id != id && existing.role != role);
        runtime.push(source.clone());
        Ok(source)
    }

    pub fn remove_runtime_source(&self, id: &str) {
        self.runtime_sources
            .write()
            .unwrap()
            .retain(|source| source.id != id);
    }

    fn effective_sources(&self) -> Vec<BridgePreviewSource> {
        let runtime = self.runtime_sources.read().unwrap().clone();
        let runtime_roles: HashSet<_> = runtime.iter().map(|source| source.role).collect();
        let mut sources: Vec<_> = self
            .sources
            .read()
            .unwrap()
            .iter()
            .filter(|source| !runtime_roles.contains(&source.role))
            .cloned()
            .collect();
        sources.extend(runtime);
        sources
    }

    pub(crate) fn fail(&self, error: impl Into<String>) {
        *self.last_error.lock().unwrap() = Some(error.into());
    }
}

pub fn start(state: Arc<BridgePreviewState>) -> Result<(), String> {
    let identity = desk_identity::load_or_create()?;
    let token = desk_identity::load_or_create_bridge_secret()?;
    let listener =
        TcpListener::bind(("0.0.0.0", 0)).map_err(|error| format!("Bridge listener: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Bridge listener address: {error}"))?
        .port();

    let daemon = ServiceDaemon::new().map_err(|error| format!("Bridge Bonjour: {error}"))?;
    let daemon = Arc::new(daemon);
    let suffix: String = identity
        .desk_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .rev()
        .take(8)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    let instance_name = format!("CreatorHub Bridge {suffix}");
    let host_name = format!("creatorhub-bridge-{suffix}.local.");
    let properties = HashMap::from([
        ("desk_id".to_string(), identity.desk_id.clone()),
        ("desk_name".to_string(), identity.desk_name.clone()),
        ("api".to_string(), "v1".to_string()),
        ("auth".to_string(), "bearer".to_string()),
    ]);
    let service = ServiceInfo::new(
        SERVICE_TYPE,
        &instance_name,
        &host_name,
        "",
        port,
        properties,
    )
    .map_err(|error| format!("Bridge Bonjour service: {error}"))?
    .enable_addr_auto();
    daemon
        .register(service)
        .map_err(|error| format!("Bridge Bonjour register: {error}"))?;

    *state.port.lock().unwrap() = Some(port);
    *state.daemon.lock().unwrap() = Some(daemon);
    let state_for_server = state.clone();
    std::thread::Builder::new()
        .name("creatorhub-bridge-preview".into())
        .spawn(move || {
            for connection in listener.incoming() {
                match connection {
                    Ok(stream) => {
                        let state = state_for_server.clone();
                        let identity = identity.clone();
                        let token = token.clone();
                        let _ = std::thread::Builder::new()
                            .name("creatorhub-bridge-request".into())
                            .spawn(move || {
                                if let Err(error) =
                                    handle_connection(stream, &state, &identity, &token)
                                {
                                    state.fail(error);
                                }
                            });
                    }
                    Err(error) => state_for_server.fail(format!("Bridge accept: {error}")),
                }
            }
        })
        .map_err(|error| format!("Start Bridge server: {error}"))?;
    Ok(())
}

fn handle_connection(
    mut stream: TcpStream,
    state: &BridgePreviewState,
    identity: &desk_identity::DeskIdentity,
    token: &str,
) -> Result<(), String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    let mut request = Vec::with_capacity(1024);
    let mut buffer = [0_u8; 1024];
    while request.len() < MAX_REQUEST_BYTES {
        let read = stream
            .read(&mut buffer)
            .map_err(|error| format!("Bridge read: {error}"))?;
        if read == 0 {
            break;
        }
        request.extend_from_slice(&buffer[..read]);
        if request.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }
    if request.len() >= MAX_REQUEST_BYTES {
        return write_response(&mut stream, 413, "text/plain", b"request too large");
    }
    let request =
        String::from_utf8(request).map_err(|_| "Bridge request is not UTF-8".to_string())?;
    let mut lines = request.split("\r\n");
    let first = lines.next().unwrap_or_default();
    let mut first_parts = first.split_whitespace();
    let method = first_parts.next().unwrap_or_default();
    let request_target = first_parts.next().unwrap_or_default();
    let path = request_target.split('?').next().unwrap_or_default();
    if method != "GET" {
        return write_response(&mut stream, 405, "text/plain", b"method not allowed");
    }
    if path == "/v1/health" {
        return write_response(&mut stream, 200, "application/json", br#"{"status":"ok"}"#);
    }
    if path.starts_with("/v1/hls/") {
        return serve_hls(&mut stream, path, &state.media_token);
    }
    if path != MANIFEST_PATH {
        return write_response(&mut stream, 404, "text/plain", b"not found");
    }
    let authorization = lines.find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("authorization")
            .then(|| value.trim().to_string())
    });
    let supplied_token = authorization
        .as_deref()
        .and_then(|value| value.strip_prefix("Bearer "));
    if supplied_token != Some(token) {
        return write_response(
            &mut stream,
            401,
            "application/json",
            br#"{"error":"unauthorized"}"#,
        );
    }
    let body = serde_json::to_vec(&state.manifest(identity))
        .map_err(|error| format!("Bridge manifest JSON: {error}"))?;
    write_response(&mut stream, 200, "application/json", &body)
}

fn serve_hls(stream: &mut TcpStream, request_path: &str, media_token: &str) -> Result<(), String> {
    let relative = request_path
        .strip_prefix("/v1/hls/")
        .ok_or_else(|| "Ugyldig HLS-sti".to_string())?;
    let mut components = relative.split('/');
    let supplied_token = components.next().unwrap_or_default();
    let source_id = components.next().unwrap_or_default();
    let file_name = components.next().unwrap_or_default();
    if components.next().is_some()
        || supplied_token != media_token
        || validate_hls_component(source_id).is_err()
        || validate_hls_file(file_name).is_err()
    {
        return write_response(stream, 404, "text/plain", b"not found");
    }
    let path = hls_root().join(source_id).join(file_name);
    let body = match std::fs::read(&path) {
        Ok(body) => body,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return write_response(stream, 404, "text/plain", b"not found");
        }
        Err(error) => return Err(format!("Les HLS-fil {}: {error}", path.display())),
    };
    let content_type = match Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
    {
        Some("m3u8") => "application/vnd.apple.mpegurl",
        Some("ts") => "video/mp2t",
        Some("m4s") => "video/iso.segment",
        _ => "application/octet-stream",
    };
    write_response(stream, 200, content_type, &body)
}

fn write_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &[u8],
) -> Result<(), String> {
    let reason = match status {
        200 => "OK",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        413 => "Payload Too Large",
        _ => "Error",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream
        .write_all(header.as_bytes())
        .and_then(|_| stream.write_all(body))
        .map_err(|error| format!("Bridge write: {error}"))
}

fn source_path() -> PathBuf {
    helper_client::config_dir().join("bridge-preview-sources.json")
}

pub(crate) fn hls_root() -> PathBuf {
    helper_client::config_dir().join("bridge-hls")
}

fn random_media_token() -> String {
    use rand::RngCore;
    let mut bytes = [0_u8; 24];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn validate_hls_component(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("Ugyldig lokal HLS-kilde".into());
    }
    Ok(())
}

fn validate_hls_file(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 96
        || value.contains("..")
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        return Err("Ugyldig lokal HLS-fil".into());
    }
    Ok(())
}

fn load_sources() -> Result<Vec<BridgePreviewSource>, String> {
    let path = source_path();
    let Ok(raw) = std::fs::read(&path) else {
        return Ok(Vec::new());
    };
    let sources: Vec<BridgePreviewSource> =
        serde_json::from_slice(&raw).map_err(|error| format!("Les Bridge-kilder: {error}"))?;
    validate_sources(sources)
}

fn persist_sources(sources: &[BridgePreviewSource]) -> Result<(), String> {
    let dir = helper_client::config_dir();
    std::fs::create_dir_all(&dir).map_err(|error| format!("Opprett config-mappe: {error}"))?;
    let path = source_path();
    let body = serde_json::to_vec_pretty(sources)
        .map_err(|error| format!("Serialiser Bridge-kilder: {error}"))?;
    std::fs::write(&path, body).map_err(|error| format!("Skriv {}: {error}", path.display()))
}

fn validate_sources(sources: Vec<BridgePreviewSource>) -> Result<Vec<BridgePreviewSource>, String> {
    if sources.len() > 2 {
        return Err("Bridge støtter én multiview- og én kamerafølge per nå".into());
    }
    let mut roles = HashSet::new();
    let mut ids = HashSet::new();
    for source in &sources {
        if source.id.trim().is_empty() || source.id.len() > 64 {
            return Err("Bridge-kilde må ha en kort ID".into());
        }
        if source.label.trim().is_empty() || source.label.len() > 128 {
            return Err("Bridge-kilde må ha et navn".into());
        }
        if !ids.insert(source.id.clone()) || !roles.insert(source.role) {
            return Err("Bridge-kilder må ha unik ID og rolle".into());
        }
        let parsed =
            local_endpoint::parse_local_endpoint(&source.playback_url, &["http", "https"])?;
        if parsed.path().is_empty() || parsed.path() == "/" {
            return Err("HLS-kilden må peke til en konkret playlist".into());
        }
        if source.quality_label.trim().is_empty() || source.quality_label.len() > 64 {
            return Err("Bridge-kilden må ha en kort kvalitetsbeskrivelse".into());
        }
    }
    Ok(sources)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn source(role: PreviewRole, url: &str) -> BridgePreviewSource {
        BridgePreviewSource {
            id: match role {
                PreviewRole::Multiview => "multiview",
                PreviewRole::Camera => "camera-a",
            }
            .into(),
            label: "Preview".into(),
            role,
            playback_url: url.into(),
            quality_label: "1080p".into(),
        }
    }

    #[test]
    fn accepts_one_multiview_and_one_camera_hls_source() {
        let result = validate_sources(vec![
            source(
                PreviewRole::Multiview,
                "http://192.168.1.10:8080/multi.m3u8",
            ),
            source(PreviewRole::Camera, "http://bridge.local/camera-a.m3u8"),
        ]);
        assert!(result.is_ok());
    }

    #[test]
    fn rejects_public_duplicate_or_non_playlist_targets() {
        assert!(
            validate_sources(vec![source(
                PreviewRole::Camera,
                "https://example.com/camera.m3u8"
            )])
            .is_err()
        );
        assert!(
            validate_sources(vec![
                source(PreviewRole::Camera, "http://10.0.0.2/a.m3u8"),
                source(PreviewRole::Camera, "http://10.0.0.2/b.m3u8"),
            ])
            .is_err()
        );
        assert!(validate_sources(vec![source(PreviewRole::Camera, "http://10.0.0.2")]).is_err());
    }

    #[test]
    fn manifest_requires_the_pairing_token() {
        let state = BridgePreviewState::new_loaded();
        let identity = desk_identity::DeskIdentity {
            desk_id: "desk_test".into(),
            desk_name: "Test Desk".into(),
        };
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let address = listener.local_addr().unwrap();
        let state = Arc::new(state);
        let state_for_thread = state.clone();
        std::thread::spawn(move || {
            for _ in 0..2 {
                let (stream, _) = listener.accept().unwrap();
                handle_connection(stream, &state_for_thread, &identity, "secret").unwrap();
            }
        });

        let unauthorized = request(address, None);
        assert!(unauthorized.starts_with("HTTP/1.1 401"));
        let authorized = request(address, Some("secret"));
        assert!(authorized.starts_with("HTTP/1.1 200"));
        assert!(authorized.contains("\"desk_id\":\"desk_test\""));
    }

    #[test]
    fn runtime_source_overrides_configured_camera_without_being_persisted() {
        let state = BridgePreviewState::new_loaded();
        *state.port.lock().unwrap() = Some(8123);
        *state.sources.write().unwrap() = vec![source(
            PreviewRole::Camera,
            "http://127.0.0.1:9000/manual.m3u8",
        )];
        let published = state
            .publish_local_hls("ndi-camera", "NDI test", PreviewRole::Camera, "1080p")
            .unwrap();
        assert!(published.playback_url.contains("/v1/hls/"));
        assert_eq!(state.effective_sources().len(), 1);
        assert_eq!(state.effective_sources()[0].id, "ndi-camera");
        state.remove_runtime_source("ndi-camera");
        assert_eq!(state.effective_sources()[0].id, "camera-a");
    }

    #[test]
    fn hls_paths_reject_traversal_and_invalid_tokens() {
        assert!(validate_hls_component("ndi-camera").is_ok());
        assert!(validate_hls_component("../secret").is_err());
        assert!(validate_hls_file("index.m3u8").is_ok());
        assert!(validate_hls_file("../bridge-access-token").is_err());
    }

    fn request(address: std::net::SocketAddr, token: Option<&str>) -> String {
        let mut stream = TcpStream::connect(address).unwrap();
        let authorization = token
            .map(|value| format!("Authorization: Bearer {value}\r\n"))
            .unwrap_or_default();
        write!(
            stream,
            "GET {MANIFEST_PATH} HTTP/1.1\r\nHost: localhost\r\n{authorization}\r\n"
        )
        .unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        response
    }
}

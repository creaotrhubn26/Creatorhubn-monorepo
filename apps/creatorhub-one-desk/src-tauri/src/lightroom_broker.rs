//! Local CreatorHub SSO broker for Lightroom Classic.
//!
//! Lightroom receives only a random loopback capability. The CreatorHub Desk
//! device bearer remains in Keychain and is exchanged server-side for a
//! short-lived, device-bound Lightroom session for each export.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{desk_identity, device_auth};

pub const PREFERRED_PORT: u16 = 48_653;
const SESSION_PATH: &str = "/v1/lightroom/session";
const HEARTBEAT_PATH: &str = "/v1/lightroom/heartbeat";
const MAX_REQUEST_BYTES: usize = 32 * 1024;
const RUNTIME_ACTIVE_SECONDS: u64 = 150;
static LAST_RUNTIME_HEARTBEAT_SECONDS: AtomicU64 = AtomicU64::new(0);
static ACTUAL_PORT: AtomicU16 = AtomicU16::new(0);
static BROKER_RUNNING: AtomicBool = AtomicBool::new(false);
static BROKER_ERROR: OnceLock<Mutex<Option<String>>> = OnceLock::new();

pub fn broker_url() -> String {
    let port = ACTUAL_PORT.load(Ordering::Relaxed);
    format!(
        "http://127.0.0.1:{}",
        if port == 0 { PREFERRED_PORT } else { port }
    )
}

pub fn is_running() -> bool {
    BROKER_RUNNING.load(Ordering::Relaxed)
}

pub fn last_error() -> Option<String> {
    BROKER_ERROR
        .get_or_init(|| Mutex::new(None))
        .lock()
        .ok()
        .and_then(|value| value.clone())
}

fn set_error(value: Option<String>) {
    if let Ok(mut error) = BROKER_ERROR.get_or_init(|| Mutex::new(None)).lock() {
        *error = value;
    }
}

fn unix_seconds_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn mark_runtime_heartbeat() {
    LAST_RUNTIME_HEARTBEAT_SECONDS.store(unix_seconds_now(), Ordering::Relaxed);
}

pub fn reset_runtime_heartbeat() {
    LAST_RUNTIME_HEARTBEAT_SECONDS.store(0, Ordering::Relaxed);
}

pub fn runtime_last_seen_seconds() -> Option<u64> {
    match LAST_RUNTIME_HEARTBEAT_SECONDS.load(Ordering::Relaxed) {
        0 => None,
        value => Some(value),
    }
}

pub fn runtime_is_active() -> bool {
    runtime_last_seen_seconds()
        .map(|last_seen| unix_seconds_now().saturating_sub(last_seen) <= RUNTIME_ACTIVE_SECONDS)
        .unwrap_or(false)
}

fn bind_loopback(preferred_port: u16) -> std::io::Result<TcpListener> {
    TcpListener::bind(("127.0.0.1", preferred_port))
        .or_else(|_| TcpListener::bind(("127.0.0.1", 0)))
}

pub fn start() -> Result<(), String> {
    if is_running() {
        return Ok(());
    }
    let listener = bind_loopback(PREFERRED_PORT).map_err(|error| {
        let message = format!("Lightroom SSO listener kunne ikke bindes: {error}");
        set_error(Some(message.clone()));
        message
    })?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Les Lightroom SSO-port: {error}"))?
        .port();
    ACTUAL_PORT.store(port, Ordering::Relaxed);
    BROKER_RUNNING.store(true, Ordering::Relaxed);
    set_error(None);
    std::thread::Builder::new()
        .name("creatorhub-lightroom-sso".into())
        .spawn(move || {
            for connection in listener.incoming() {
                match connection {
                    Ok(stream) => {
                        let _ = std::thread::Builder::new()
                            .name("creatorhub-lightroom-sso-request".into())
                            .spawn(move || {
                                let _ = handle_connection(stream);
                            });
                    }
                    Err(error) => eprintln!("Lightroom SSO accept: {error}"),
                }
            }
        })
        .map_err(|error| {
            BROKER_RUNNING.store(false, Ordering::Relaxed);
            let message = format!("Start Lightroom SSO broker: {error}");
            set_error(Some(message.clone()));
            message
        })?;
    Ok(())
}

fn handle_connection(mut stream: TcpStream) -> Result<(), String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(20)));
    let mut request = Vec::with_capacity(1024);
    let mut buffer = [0_u8; 1024];
    while request.len() < MAX_REQUEST_BYTES {
        let read = stream
            .read(&mut buffer)
            .map_err(|error| format!("Les Lightroom SSO-kall: {error}"))?;
        if read == 0 {
            break;
        }
        request.extend_from_slice(&buffer[..read]);
        if request.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }
    if request.len() >= MAX_REQUEST_BYTES {
        return write_json(&mut stream, 413, r#"{"error":"request_too_large"}"#);
    }
    let header_end = request
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|position| position + 4)
        .ok_or_else(|| "Lightroom SSO-kallet mangler komplette headere".to_string())?;
    let header_text = String::from_utf8(request[..header_end].to_vec())
        .map_err(|_| "Lightroom SSO-kallet er ikke UTF-8".to_string())?;
    let content_length = header_text
        .split("\r\n")
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().ok())
                .flatten()
        })
        .unwrap_or(0);
    if header_end.saturating_add(content_length) > MAX_REQUEST_BYTES {
        return write_json(&mut stream, 413, r#"{"error":"request_too_large"}"#);
    }
    while request.len().saturating_sub(header_end) < content_length {
        let read = stream
            .read(&mut buffer)
            .map_err(|error| format!("Les Lightroom SSO-body: {error}"))?;
        if read == 0 {
            break;
        }
        request.extend_from_slice(&buffer[..read]);
    }
    let mut lines = header_text.split("\r\n");
    let first = lines.next().unwrap_or_default();
    let mut first_parts = first.split_whitespace();
    let method = first_parts.next().unwrap_or_default();
    let target = first_parts.next().unwrap_or_default();
    let path = target.split('?').next().unwrap_or_default();
    if method != "POST" || (path != SESSION_PATH && path != HEARTBEAT_PATH) {
        return write_json(&mut stream, 404, r#"{"error":"not_found"}"#);
    }
    let supplied_secret = authorization_bearer(lines);
    let expected_secret = desk_identity::load_or_create_lightroom_broker_secret()?;
    if supplied_secret.as_deref() != Some(expected_secret.as_str()) {
        return write_json(&mut stream, 401, r#"{"error":"unauthorized"}"#);
    }
    mark_runtime_heartbeat();
    if path == HEARTBEAT_PATH {
        return write_json(&mut stream, 200, r#"{"success":true}"#);
    }
    let Some(device) = device_auth::load_device_token()? else {
        return write_json(&mut stream, 401, r#"{"error":"desk_login_required"}"#);
    };
    match tauri::async_runtime::block_on(device_auth::fetch_lightroom_session(&device)) {
        Ok(session) => {
            let body = serde_json::to_string(&session)
                .map_err(|error| format!("Serialiser Lightroom SSO-sesjon: {error}"))?;
            write_json(&mut stream, 200, &body)
        }
        Err(error) => {
            eprintln!("Lightroom SSO exchange feilet: {error}");
            write_json(&mut stream, 503, r#"{"error":"creatorhub_unavailable"}"#)
        }
    }
}

fn authorization_bearer<'a>(mut lines: impl Iterator<Item = &'a str>) -> Option<String> {
    lines.find_map(|line| {
        let (name, value) = line.split_once(':')?;
        if !name.eq_ignore_ascii_case("authorization") {
            return None;
        }
        value.trim().strip_prefix("Bearer ").map(str::to_string)
    })
}

fn write_json(stream: &mut TcpStream, status: u16, body: &str) -> Result<(), String> {
    let reason = match status {
        200 => "OK",
        401 => "Unauthorized",
        404 => "Not Found",
        413 => "Payload Too Large",
        503 => "Service Unavailable",
        _ => "Error",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream
        .write_all(header.as_bytes())
        .and_then(|_| stream.write_all(body.as_bytes()))
        .map_err(|error| format!("Skriv Lightroom SSO-svar: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    static HEARTBEAT_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn accepts_only_exact_bearer_header() {
        let request = ["Host: 127.0.0.1", "Authorization: Bearer abc123", ""];
        assert_eq!(
            authorization_bearer(request.into_iter()).as_deref(),
            Some("abc123")
        );
        let wrong_scheme = ["Authorization: Basic abc123"];
        assert!(authorization_bearer(wrong_scheme.into_iter()).is_none());
    }

    #[test]
    fn broker_is_loopback_only_and_stable() {
        let url = broker_url();
        assert!(url.starts_with("http://127.0.0.1:"));
    }

    #[test]
    fn heartbeat_marks_the_lightroom_runtime_active() {
        let _guard = HEARTBEAT_TEST_LOCK.lock().unwrap();
        LAST_RUNTIME_HEARTBEAT_SECONDS.store(0, Ordering::Relaxed);
        assert!(!runtime_is_active());
        mark_runtime_heartbeat();
        assert!(runtime_is_active());
        assert!(runtime_last_seen_seconds().is_some());
    }

    #[test]
    fn runtime_heartbeat_can_be_invalidated_on_logout() {
        let _guard = HEARTBEAT_TEST_LOCK.lock().unwrap();
        mark_runtime_heartbeat();
        reset_runtime_heartbeat();
        assert!(!runtime_is_active());
    }

    #[test]
    fn falls_back_to_an_available_loopback_port() {
        let occupied = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let occupied_port = occupied.local_addr().unwrap().port();
        let fallback = bind_loopback(occupied_port).unwrap();
        assert_ne!(fallback.local_addr().unwrap().port(), occupied_port);
        assert!(fallback.local_addr().unwrap().ip().is_loopback());
    }
}

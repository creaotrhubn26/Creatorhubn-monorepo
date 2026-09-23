//! Local CreatorHub SSO broker for Lightroom Classic.
//!
//! Lightroom receives only a random loopback capability. The CreatorHub Desk
//! device bearer remains in Keychain and is exchanged server-side for a
//! short-lived, device-bound Lightroom session for each export.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::Duration;

use crate::{desk_identity, device_auth};

pub const PORT: u16 = 48_653;
const SESSION_PATH: &str = "/v1/lightroom/session";
const MAX_REQUEST_BYTES: usize = 32 * 1024;

pub fn broker_url() -> String {
    format!("http://127.0.0.1:{PORT}")
}

pub fn start() -> Result<(), String> {
    let listener = TcpListener::bind(("127.0.0.1", PORT))
        .map_err(|error| format!("Lightroom SSO listener på port {PORT}: {error}"))?;
    let secret = desk_identity::load_or_create_lightroom_broker_secret()?;
    std::thread::Builder::new()
        .name("creatorhub-lightroom-sso".into())
        .spawn(move || {
            for connection in listener.incoming() {
                match connection {
                    Ok(stream) => {
                        let secret = secret.clone();
                        let _ = std::thread::Builder::new()
                            .name("creatorhub-lightroom-sso-request".into())
                            .spawn(move || {
                                let _ = handle_connection(stream, &secret);
                            });
                    }
                    Err(error) => eprintln!("Lightroom SSO accept: {error}"),
                }
            }
        })
        .map_err(|error| format!("Start Lightroom SSO broker: {error}"))?;
    Ok(())
}

fn handle_connection(mut stream: TcpStream, expected_secret: &str) -> Result<(), String> {
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
    if method != "POST" || path != SESSION_PATH {
        return write_json(&mut stream, 404, r#"{"error":"not_found"}"#);
    }
    let supplied_secret = authorization_bearer(lines);
    if supplied_secret.as_deref() != Some(expected_secret) {
        return write_json(&mut stream, 401, r#"{"error":"unauthorized"}"#);
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
        assert_eq!(broker_url(), "http://127.0.0.1:48653");
    }
}

//! Validation shared by local camera/control adapters.
//!
//! Tauri commands are callable by the webview. Restricting targets to loopback,
//! RFC1918/link-local addresses, and Bonjour `.local` names prevents these
//! adapters from becoming generic internet request proxies if the UI is ever
//! compromised.

use std::net::IpAddr;

use url::Url;

pub fn parse_local_endpoint(raw: &str, allowed_schemes: &[&str]) -> Result<Url, String> {
    let parsed = Url::parse(raw.trim()).map_err(|error| format!("Ugyldig URL: {error}"))?;
    if !allowed_schemes.contains(&parsed.scheme()) {
        return Err(format!(
            "Ugyldig protokoll '{}'; tillatt: {}",
            parsed.scheme(),
            allowed_schemes.join(", ")
        ));
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Brukernavn/passord skal ikke ligge i URL-en".into());
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "URL-en mangler host".to_string())?;
    if !is_local_host(host) {
        return Err(
            "Kun loopback, private/link-local IP-adresser og Bonjour .local-navn er tillatt".into(),
        );
    }
    Ok(parsed)
}

fn is_local_host(host: &str) -> bool {
    let host = host.trim_start_matches('[').trim_end_matches(']');
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".local") {
        return true;
    }
    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(ip)) => ip.is_loopback() || ip.is_private() || ip.is_link_local(),
        Ok(IpAddr::V6(ip)) => {
            ip.is_loopback() || ip.is_unique_local() || ip.is_unicast_link_local()
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_camera_and_loopback_targets() {
        assert!(parse_local_endpoint("https://ursa.local", &["http", "https"]).is_ok());
        assert!(parse_local_endpoint("ws://127.0.0.1:4455", &["ws", "wss"]).is_ok());
        assert!(parse_local_endpoint("http://192.168.10.45", &["http", "https"]).is_ok());
        assert!(parse_local_endpoint("http://[fe80::1234]", &["http", "https"]).is_ok());
    }

    #[test]
    fn rejects_public_or_credentialed_targets() {
        assert!(parse_local_endpoint("https://example.com", &["http", "https"]).is_err());
        assert!(parse_local_endpoint("ws://user:pass@127.0.0.1:4455", &["ws"]).is_err());
        assert!(parse_local_endpoint("file:///tmp/camera", &["http"]).is_err());
    }
}

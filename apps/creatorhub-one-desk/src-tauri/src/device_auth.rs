//! Device-auth: Google-OAuth-login + device-token-lagring.
//!
//! Erstatter manuell helper-token-inntasting med:
//!   1. start_google_login() → POST /api/desktop/auth/google/start →
//!      åpner authorizationUrl i nettleseren
//!   2. Bruker logger inn med Google → backend redirecter til
//!      creatorhub-one-desk://oauth-callback?token=...&email=...
//!   3. tauri-plugin-deep-link plukker opp URLen, vi parser ut tokenet
//!      og lagrer hemmeligheten i OS-nøkkelringen. JSON-filen inneholder
//!      bare ikke-sensitiv kontoidentitet.
//!   4. fetch_projects_with_device_token() henter alle prosjekter
//!      brukeren har tilgang til + per-prosjekt helper-tokens og
//!      populerer ProjectStore via replace_all().

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::projects::ProjectEntry;
use crate::{desk_identity, helper_client};

// www, ikke apex: creatorhubn.com 301/308-redirecter til www.creatorhubn.com
// (Netlify), og reqwest fjerner Authorization-headeren på cross-host-
// redirects — apex-URL her gjorde at Bearer-tokenet ble borte før /me/
// projects nådde backend ("Bearer-token påkrevd" selv med gyldig token).
const DEFAULT_API_BASE: &str = "https://www.creatorhubn.com";
const KEYRING_SERVICE: &str = "com.creatorhub.one-desk";
const DEVICE_TOKEN_ACCOUNT: &str = "desktop-device-token";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceToken {
    pub token: String,
    pub user_email: String,
    #[serde(default)]
    pub user_name: String,
    pub api_base: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredDeviceIdentity {
    /// Migration-only: builds before 0.1.11 stored the bearer token in this
    /// 0600 JSON file. New writes always omit it after moving it to Keychain.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    token: Option<String>,
    user_email: String,
    #[serde(default)]
    user_name: String,
    api_base: String,
}

fn device_token_path() -> PathBuf {
    helper_client::config_dir().join("device-token.json")
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, DEVICE_TOKEN_ACCOUNT)
        .map_err(|error| format!("Åpne OS-nøkkelring: {}", error))
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn keyring_get() -> Result<Option<String>, String> {
    match keyring_entry()?.get_password() {
        Ok(secret) if !secret.trim().is_empty() => Ok(Some(secret)),
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Les OS-nøkkelring: {}", error)),
    }
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn keyring_set(secret: &str) -> Result<(), String> {
    keyring_entry()?
        .set_password(secret)
        .map_err(|error| format!("Lagre i OS-nøkkelring: {}", error))
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn keyring_delete() -> Result<(), String> {
    match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Fjern fra OS-nøkkelring: {}", error)),
    }
}

fn write_device_identity(identity: &StoredDeviceIdentity) -> Result<(), String> {
    helper_client::ensure_config_dir()?;
    let path = device_token_path();
    let json = serde_json::to_vec_pretty(identity).map_err(|e| format!("Serialize: {}", e))?;
    fs::write(&path, &json).map_err(|e| format!("Skriv device-identitet: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        let _ = fs::set_permissions(&path, perms);
    }
    Ok(())
}

pub fn load_device_token() -> Result<Option<DeviceToken>, String> {
    let path = device_token_path();
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(|e| format!("Les device-token: {}", e))?;
    if bytes.is_empty() {
        return Ok(None);
    }
    let mut identity = serde_json::from_slice::<StoredDeviceIdentity>(&bytes)
        .map_err(|e| format!("Parse device-identitet: {}", e))?;

    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let token = match keyring_get()? {
        Some(secret) => secret,
        None => {
            let legacy = identity
                .token
                .take()
                .filter(|secret| !secret.trim().is_empty());
            let Some(secret) = legacy else {
                return Ok(None);
            };
            keyring_set(&secret)?;
            write_device_identity(&identity)?;
            secret
        }
    };

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let token = match identity.token.take() {
        Some(secret) if !secret.trim().is_empty() => secret,
        _ => return Ok(None),
    };

    Ok(Some(DeviceToken {
        token,
        user_email: identity.user_email,
        user_name: identity.user_name,
        api_base: identity.api_base,
    }))
}

pub fn save_device_token(token: &DeviceToken) -> Result<(), String> {
    let account_changed = fs::read(device_token_path())
        .ok()
        .and_then(|bytes| serde_json::from_slice::<StoredDeviceIdentity>(&bytes).ok())
        .is_some_and(|identity| !identity.user_email.eq_ignore_ascii_case(&token.user_email));

    #[cfg(any(target_os = "macos", target_os = "windows"))]
    keyring_set(&token.token)?;

    if account_changed {
        desk_identity::rotate_lightroom_broker_secret()?;
    }

    write_device_identity(&StoredDeviceIdentity {
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        token: Some(token.token.clone()),
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        token: None,
        user_email: token.user_email.clone(),
        user_name: token.user_name.clone(),
        api_base: token.api_base.clone(),
    })
}

pub fn clear_device_token() -> Result<(), String> {
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    keyring_delete()?;

    let path = device_token_path();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Slett device-token: {}", e))?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LightroomDeskSession {
    pub token: String,
    pub expires_at: String,
    pub api_base_url: String,
    pub account_email: String,
    pub plugin_version: String,
    #[serde(default)]
    pub drive_available: bool,
    #[serde(default)]
    pub projects: Vec<LightroomProjectOption>,
    #[serde(default)]
    pub project_options: String,
    #[serde(default)]
    pub latest_export: Option<LightroomLatestExport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LightroomProjectOption {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LightroomLatestExport {
    pub export_id: String,
    pub project_id: String,
    pub project_title: String,
    pub asset_id: String,
    pub filename: String,
    pub status: String,
    pub verified_at: Option<String>,
    pub created_at: Option<String>,
}

pub async fn fetch_lightroom_session(device: &DeviceToken) -> Result<LightroomDeskSession, String> {
    let url = format!(
        "{}/api/desktop/me/lightroom-session",
        device.api_base.trim_end_matches('/')
    );
    let response = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Opprett CreatorHub-klient: {error}"))?
        .post(url)
        .header("Authorization", format!("Bearer {}", device.token))
        .send()
        .await
        .map_err(|error| format!("CreatorHub Desk SSO: {error}"))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Les CreatorHub Desk SSO-svar: {error}"))?;
    if !status.is_success() {
        return Err(format!("CreatorHub Desk SSO avvist ({}).", status.as_u16()));
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Response {
        success: bool,
        token: String,
        expires_at: String,
        api_base_url: String,
        account_email: String,
        plugin_version: String,
        #[serde(default)]
        drive_available: bool,
        #[serde(default)]
        projects: Vec<LightroomProjectOption>,
        #[serde(default)]
        project_options: String,
        #[serde(default)]
        latest_export: Option<LightroomLatestExport>,
    }
    let parsed: Response = serde_json::from_str(&body)
        .map_err(|error| format!("Ugyldig CreatorHub Desk SSO-svar: {error}"))?;
    if !parsed.success || !parsed.token.starts_with("lrs_") {
        return Err("CreatorHub returnerte ikke en gyldig Lightroom-sesjon.".to_string());
    }
    Ok(LightroomDeskSession {
        token: parsed.token,
        expires_at: parsed.expires_at,
        api_base_url: parsed.api_base_url,
        account_email: parsed.account_email,
        plugin_version: parsed.plugin_version,
        drive_available: parsed.drive_available,
        projects: parsed.projects,
        project_options: parsed.project_options,
        latest_export: parsed.latest_export,
    })
}

pub async fn revoke_device_token(device: &DeviceToken) -> Result<(), String> {
    let url = format!(
        "{}/api/desktop/me/logout",
        device.api_base.trim_end_matches('/')
    );
    let response = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|error| format!("Opprett utloggingsklient: {error}"))?
        .post(url)
        .header("Authorization", format!("Bearer {}", device.token))
        .send()
        .await
        .map_err(|error| format!("Revoker Desk-innlogging: {error}"))?;
    if response.status().is_success() || response.status().as_u16() == 401 {
        Ok(())
    } else {
        Err(format!(
            "CreatorHub avviste utlogging ({})",
            response.status().as_u16()
        ))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartLoginResult {
    pub authorization_url: String,
    pub state: String,
}

/// POST /api/desktop/auth/google/start — returnerer authorizationUrl
/// + state-id som app-en bruker for å polle /complete-endepunktet hvis
/// deep-link-handleren ikke fyrer (kjent macOS-quirk for running-app).
pub async fn start_google_login_v2(api_base: &str) -> Result<StartLoginResult, String> {
    let base = api_base.trim().trim_end_matches('/');
    let url = format!("{}/api/desktop/auth/google/start", base);
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Origin", base)
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await
        .map_err(|e| format!("Google-login start feilet: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Backend ({}): {}", status, body));
    }
    #[derive(Deserialize)]
    struct R {
        #[serde(default, rename = "authorizationUrl")]
        url: Option<String>,
        #[serde(default)]
        state: Option<String>,
    }
    let parsed: R = resp.json().await.map_err(|e| format!("Parse: {}", e))?;
    let authorization_url = parsed
        .url
        .ok_or_else(|| "Mangler authorizationUrl".to_string())?;
    let state = parsed.state.ok_or_else(|| "Mangler state".to_string())?;
    Ok(StartLoginResult {
        authorization_url,
        state,
    })
}

/// GET /api/desktop/auth/google/complete/:stateId — poll for completion.
/// Returnerer Some(DeviceToken) hvis bruker har fullført OAuth-flyten i
/// browseren, None hvis fortsatt venter (HTTP 202). Err hvis 404 (state
/// utløpt eller ugyldig).
pub async fn poll_oauth_completion(
    api_base: &str,
    state_id: &str,
) -> Result<Option<DeviceToken>, String> {
    let base = api_base.trim().trim_end_matches('/');
    let url = format!(
        "{}/api/desktop/auth/google/complete/{}",
        base,
        urlencoding::encode(state_id),
    );
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Poll feilet: {}", e))?;
    if resp.status().as_u16() == 202 {
        return Ok(None);
    }
    if resp.status().as_u16() == 404 {
        return Err("State utløpt — start innlogging på nytt".to_string());
    }
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Backend ({}): {}", status, body));
    }
    #[derive(Deserialize)]
    struct R {
        success: bool,
        token: String,
        user_email: String,
        #[serde(default)]
        user_name: String,
        api_base: String,
    }
    let r: R = resp.json().await.map_err(|e| format!("Parse: {}", e))?;
    if !r.success {
        return Err("success=false".to_string());
    }
    Ok(Some(DeviceToken {
        token: r.token,
        user_email: r.user_email,
        user_name: r.user_name,
        api_base: r.api_base,
    }))
}

/// POST /api/desktop/auth/google/start — returnerer authorizationUrl
/// som brukeren må åpne i nettleseren.
pub async fn start_google_login(api_base: &str) -> Result<String, String> {
    let base = api_base.trim().trim_end_matches('/');
    let url = format!("{}/api/desktop/auth/google/start", base);
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        // Origin-header trengs så backend bygger redirect_uri som matcher.
        .header("Origin", base)
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await
        .map_err(|e| format!("Google-login start feilet: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Backend ({}): {}", status, body));
    }
    #[derive(Deserialize)]
    struct StartResp {
        #[serde(default)]
        authorization_url: Option<String>,
        #[serde(default, rename = "authorizationUrl")]
        authorization_url_camel: Option<String>,
    }
    let parsed: StartResp = resp
        .json()
        .await
        .map_err(|e| format!("Parse start-svar: {}", e))?;
    parsed
        .authorization_url
        .or(parsed.authorization_url_camel)
        .ok_or_else(|| "Mangler authorizationUrl i svar".to_string())
}

#[derive(Debug, Deserialize)]
struct ApiProject {
    id: String,
    name: String,
    helper_token: String,
}

#[derive(Debug, Deserialize)]
struct ProjectsResp {
    success: bool,
    #[serde(default)]
    projects: Vec<ApiProject>,
    #[serde(default)]
    error: Option<String>,
}

/// GET /api/desktop/me/projects — returnerer alle prosjekter brukeren
/// har tilgang til + nye per-prosjekt helper-tokens. Backend revoker
/// gamle One Desk-tokens for samme par så vi ikke akkumulerer.
pub async fn fetch_projects_for_token(
    api_base: &str,
    device_token: &str,
) -> Result<Vec<ProjectEntry>, String> {
    let base = api_base.trim().trim_end_matches('/');
    let url = format!("{}/api/desktop/me/projects", base);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", device_token))
        .send()
        .await
        .map_err(|e| format!("Fetch prosjekter feilet: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Backend ({}): {}", status, body));
    }
    let parsed: ProjectsResp = resp
        .json()
        .await
        .map_err(|e| format!("Parse prosjekt-svar: {}", e))?;
    if !parsed.success {
        return Err(parsed.error.unwrap_or_else(|| "Ukjent feil".to_string()));
    }
    Ok(parsed
        .projects
        .into_iter()
        .map(|p| ProjectEntry {
            project_id: p.id,
            label: p.name,
            api_base: base.to_string(),
            token: p.helper_token,
            last_used_ms: 0, // settes av replace_all
        })
        .collect())
}

/// Parser deep-link-URL og returnerer en DeviceToken hvis URLen er
/// gyldig oauth-callback. Format:
/// creatorhub-one-desk://oauth-callback?token=...&email=...&name=...
pub fn parse_oauth_callback_url(url_str: &str) -> Option<DeviceToken> {
    let url = url::Url::parse(url_str).ok()?;
    if url.scheme() != "creatorhub-one-desk" {
        return None;
    }
    // host eller path kan være "oauth-callback" avhengig av OS-parsing
    let is_callback = url.host_str() == Some("oauth-callback")
        || url
            .path()
            .trim_start_matches('/')
            .starts_with("oauth-callback");
    if !is_callback {
        return None;
    }
    let mut token: Option<String> = None;
    let mut email: Option<String> = None;
    let mut name: Option<String> = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "token" => token = Some(v.to_string()),
            "email" => email = Some(v.to_string()),
            "name" => name = Some(v.to_string()),
            _ => {}
        }
    }
    Some(DeviceToken {
        token: token?,
        user_email: email?,
        user_name: name.unwrap_or_default(),
        api_base: DEFAULT_API_BASE.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_callback_url() {
        let url = "creatorhub-one-desk://oauth-callback?token=trr_desk_abc&email=daniel%40creatorhubn.com&name=Daniel%20Qazi";
        let dt = parse_oauth_callback_url(url).expect("parses");
        assert_eq!(dt.token, "trr_desk_abc");
        assert_eq!(dt.user_email, "daniel@creatorhubn.com");
        assert_eq!(dt.user_name, "Daniel Qazi");
    }

    #[test]
    fn rejects_wrong_scheme() {
        assert!(parse_oauth_callback_url("https://example.com?token=x").is_none());
    }

    #[test]
    fn rejects_missing_token() {
        assert!(
            parse_oauth_callback_url("creatorhub-one-desk://oauth-callback?email=a@b.c").is_none()
        );
    }

    #[test]
    fn persisted_identity_omits_device_bearer_token() {
        let identity = StoredDeviceIdentity {
            token: None,
            user_email: "owner@example.test".into(),
            user_name: "Owner".into(),
            api_base: "https://www.creatorhubn.com".into(),
        };
        let serialized = serde_json::to_string(&identity).expect("serialize identity");
        assert!(!serialized.contains("trr_desk_"));
        assert!(!serialized.contains("\"token\""));
    }
}

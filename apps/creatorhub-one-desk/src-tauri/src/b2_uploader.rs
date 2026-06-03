//! Backblaze B2 uploader for offsite-backup-destinasjoner.
//!
//! API-flow (v3):
//!   1. b2_authorize_account  GET → API-host + auth-token
//!   2. b2_get_upload_url     POST → per-bucket upload-endpoint + token
//!   3. b2_upload_file        POST → fil-payload + SHA-1-header
//!
//! B2 krever **SHA-1** i `X-Bz-Content-Sha1`-header for hver fil.
//! Vi beregner SHA-1 separat fra xxHash64 (xxHash64 brukes fortsatt
//! lokalt for verifisering og session_log; SHA-1 kun for B2).
//!
//! Auth-token + upload-URL caches IKKE her — caller får bare ferske
//! ressurser fra get_upload_url så vi unngår token-expiry-bugs.
//! Hver upload gjør sin egen authorize+get-url-call (overhead ~200ms
//! per fil, akseptabelt for backup-flow).

use std::path::Path;

use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use tokio::io::AsyncReadExt;

const B2_AUTHORIZE_URL: &str = "https://api.backblazeb2.com/b2api/v3/b2_authorize_account";
const HASH_CHUNK_SIZE: usize = 1024 * 1024; // 1 MiB

#[derive(Debug, Clone, Deserialize)]
pub struct B2Auth {
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "authorizationToken")]
    pub auth_token: String,
    #[serde(rename = "apiInfo")]
    pub api_info: B2ApiInfo,
}

#[derive(Debug, Clone, Deserialize)]
pub struct B2ApiInfo {
    #[serde(rename = "storageApi")]
    pub storage_api: B2StorageApi,
}

#[derive(Debug, Clone, Deserialize)]
pub struct B2StorageApi {
    #[serde(rename = "apiUrl")]
    pub api_url: String,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct B2UploadUrl {
    #[serde(rename = "bucketId")]
    pub bucket_id: String,
    #[serde(rename = "uploadUrl")]
    pub upload_url: String,
    #[serde(rename = "authorizationToken")]
    pub upload_auth_token: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct B2UploadResult {
    pub file_id: String,
    pub file_name: String,
    pub content_sha1: String,
    pub content_length: u64,
}

#[derive(Debug, Clone, Deserialize)]
struct B2UploadResponse {
    #[serde(rename = "fileId")]
    file_id: String,
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "contentSha1")]
    content_sha1: String,
    #[serde(rename = "contentLength")]
    content_length: u64,
}

#[derive(Debug, Serialize)]
struct GetUploadUrlBody<'a> {
    #[serde(rename = "bucketId")]
    bucket_id: &'a str,
}

#[derive(Debug, Deserialize)]
struct B2ErrorBody {
    #[serde(default)]
    code: Option<String>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    status: Option<u16>,
}

/// b2_authorize_account — Basic Auth med (key_id, application_key).
pub async fn authorize(key_id: &str, application_key: &str) -> Result<B2Auth, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(B2_AUTHORIZE_URL)
        .basic_auth(key_id, Some(application_key))
        .send()
        .await
        .map_err(|e| format!("Backblaze authorize-feil: {}", e))?;
    parse_b2_response::<B2Auth>(resp, "authorize").await
}

/// b2_get_upload_url — krever auth-URL + token fra authorize.
pub async fn get_upload_url(auth: &B2Auth, bucket_id: &str) -> Result<B2UploadUrl, String> {
    let url = format!("{}/b2api/v3/b2_get_upload_url", auth.api_info.storage_api.api_url);
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", &auth.auth_token)
        .json(&GetUploadUrlBody { bucket_id })
        .send()
        .await
        .map_err(|e| format!("get_upload_url-feil: {}", e))?;
    parse_b2_response::<B2UploadUrl>(resp, "get_upload_url").await
}

/// Beregn SHA-1 ved å streame filen i 1 MiB-blokker — unngår
/// minne-fotavtrykk for store filer (RED RAW > 1 GB).
pub async fn compute_sha1(path: &Path) -> Result<String, String> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| format!("Åpne fil: {}", e))?;
    let mut hasher = Sha1::new();
    let mut buf = vec![0u8; HASH_CHUNK_SIZE];
    loop {
        let n = file
            .read(&mut buf)
            .await
            .map_err(|e| format!("Les fil: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

/// b2_upload_file — laster opp hele fila som body med SHA-1 i header.
/// Filer >5 GB krever multipart-upload (b2_start_large_file +
/// b2_upload_part). Den varianten er ikke implementert i v1; caller
/// må selv sjekke størrelse og falle tilbake til lokal-only.
pub async fn upload_file(
    upload: &B2UploadUrl,
    file_path: &Path,
    dest_name: &str,
    sha1_hex: &str,
) -> Result<B2UploadResult, String> {
    let metadata = tokio::fs::metadata(file_path)
        .await
        .map_err(|e| format!("Les filmetadata: {}", e))?;
    let size = metadata.len();
    if size > 5_000_000_000 {
        return Err(format!(
            "Filen ({} bytes) er over 5 GB. Multipart-upload ikke støttet i denne versjonen.",
            size
        ));
    }

    let body_bytes = tokio::fs::read(file_path)
        .await
        .map_err(|e| format!("Les fil for upload: {}", e))?;

    // B2 krever URL-encoded fil-navn i header
    let encoded_name = b2_url_encode(dest_name);

    let client = reqwest::Client::new();
    let resp = client
        .post(&upload.upload_url)
        .header("Authorization", &upload.upload_auth_token)
        .header("X-Bz-File-Name", encoded_name)
        .header("Content-Type", "b2/x-auto")
        .header("Content-Length", size.to_string())
        .header("X-Bz-Content-Sha1", sha1_hex)
        .body(body_bytes)
        .send()
        .await
        .map_err(|e| format!("b2_upload_file-feil: {}", e))?;

    let parsed: B2UploadResponse = parse_b2_response(resp, "upload_file").await?;

    // Defensiv check: Backblaze returnerer den hashen DE beregnet — bør
    // matche vår. Ulik = silent korrupsjon i transport. Avbryt.
    if !sha1_hex.eq_ignore_ascii_case(&parsed.content_sha1) {
        return Err(format!(
            "B2 SHA-1 ({}) matcher ikke vår ({}) — transport-korrupsjon",
            parsed.content_sha1, sha1_hex
        ));
    }

    Ok(B2UploadResult {
        file_id: parsed.file_id,
        file_name: parsed.file_name,
        content_sha1: parsed.content_sha1,
        content_length: parsed.content_length,
    })
}

/// b2_delete_file_version — for GDPR right-to-erasure-flow.
pub async fn delete_file_version(
    auth: &B2Auth,
    file_id: &str,
    file_name: &str,
) -> Result<(), String> {
    let url = format!(
        "{}/b2api/v3/b2_delete_file_version",
        auth.api_info.storage_api.api_url
    );
    let client = reqwest::Client::new();
    let body = serde_json::json!({ "fileId": file_id, "fileName": file_name });
    let resp = client
        .post(&url)
        .header("Authorization", &auth.auth_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("delete_file_version-feil: {}", e))?;
    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Slett feilet: {}", body));
    }
    Ok(())
}

async fn parse_b2_response<T: for<'de> Deserialize<'de>>(
    resp: reqwest::Response,
    op: &str,
) -> Result<T, String> {
    let status = resp.status();
    if !status.is_success() {
        let body_text = resp.text().await.unwrap_or_default();
        // Prøv å parse B2-feil-objekt for ryddig melding
        if let Ok(err) = serde_json::from_str::<B2ErrorBody>(&body_text) {
            return Err(format!(
                "B2 {} feilet (HTTP {}): {} — {}",
                op,
                err.status.unwrap_or(status.as_u16()),
                err.code.unwrap_or_else(|| "ukjent_code".into()),
                err.message.unwrap_or_else(|| body_text.clone())
            ));
        }
        return Err(format!("B2 {} feilet (HTTP {}): {}", op, status, body_text));
    }
    resp.json::<T>()
        .await
        .map_err(|e| format!("Parse B2 {}-svar: {}", op, e))
}

/// B2 sin egen prosent-encoding-spec: kun ASCII-alphanumerisk +
/// noen utvalgte tegn er trygt; alt annet må encodes som %XX.
/// Slash beholdes så path-strukturen (`dit-backup/proj_x/file.cr3`)
/// blir bevart i B2 — der vises det som en virtual folder-tree.
fn b2_url_encode(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for b in name.as_bytes() {
        let c = *b;
        let safe = c.is_ascii_alphanumeric()
            || matches!(c, b'/' | b'.' | b'_' | b'-' | b'~');
        if safe {
            out.push(c as char);
        } else {
            out.push_str(&format!("%{:02X}", c));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[tokio::test]
    async fn sha1_of_empty_file() {
        let f = tempfile::NamedTempFile::new().unwrap();
        let sha = compute_sha1(f.path()).await.unwrap();
        // SHA-1 av tom string
        assert_eq!(sha, "da39a3ee5e6b4b0d3255bfef95601890afd80709");
    }

    #[tokio::test]
    async fn sha1_of_hello_world() {
        let mut f = tempfile::NamedTempFile::new().unwrap();
        f.write_all(b"hello world").unwrap();
        f.flush().unwrap();
        let sha = compute_sha1(f.path()).await.unwrap();
        // SHA-1 av "hello world"
        assert_eq!(sha, "2aae6c35c94fcfb415dbe95f408b9ce91ee846ed");
    }

    #[test]
    fn url_encode_preserves_slash_and_alphanumeric() {
        assert_eq!(
            b2_url_encode("dit-backup/proj_a/IMG_0001.CR3"),
            "dit-backup/proj_a/IMG_0001.CR3"
        );
    }

    #[test]
    fn url_encode_escapes_spaces_and_norse() {
        assert_eq!(b2_url_encode("foo bar.txt"), "foo%20bar.txt");
        assert_eq!(b2_url_encode("brød.jpg"), "br%C3%B8d.jpg");
    }

    #[test]
    fn parse_b2_auth_response() {
        let json = r#"{
            "accountId": "abc123",
            "authorizationToken": "tok_xyz",
            "apiInfo": {
                "storageApi": {
                    "apiUrl": "https://api001.backblazeb2.com",
                    "downloadUrl": "https://f001.backblazeb2.com"
                }
            }
        }"#;
        let auth: B2Auth = serde_json::from_str(json).unwrap();
        assert_eq!(auth.account_id, "abc123");
        assert_eq!(auth.auth_token, "tok_xyz");
        assert_eq!(auth.api_info.storage_api.api_url, "https://api001.backblazeb2.com");
    }
}

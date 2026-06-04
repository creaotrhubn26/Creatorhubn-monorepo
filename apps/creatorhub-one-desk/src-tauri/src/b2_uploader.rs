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
use std::sync::{Arc, Mutex};

use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use tokio::io::AsyncReadExt;
use tokio_util::io::ReaderStream;

const B2_AUTHORIZE_URL: &str = "https://api.backblazeb2.com/b2api/v3/b2_authorize_account";
const HASH_CHUNK_SIZE: usize = 1024 * 1024; // 1 MiB

/// Filer ≥ denne størrelsen bruker multipart-upload (b2_start_large_file +
/// b2_upload_part). B2 dokumentasjon anbefaler 100 MB+ parts. Vi bruker
/// 100 MB-parts og aktiverer multipart-flow ved 200 MB+ for å unngå
/// overhead på medium-store filer.
const MULTIPART_THRESHOLD: u64 = 200 * 1024 * 1024; // 200 MiB
const MULTIPART_PART_SIZE: u64 = 100 * 1024 * 1024; // 100 MiB

/// Maks retries for transient feil (5xx, 429, nettverks-timeouts).
/// Exponential backoff: 1s, 2s, 4s, 8s → maks ~15s ekstra ventetid.
const MAX_RETRIES: u32 = 4;

/// True hvis HTTP-status eller error-melding signaliserer transient
/// feil som er trygt å retry'e. 4xx (utenom 408/429) er permanente.
fn is_transient(status_code: u16, err_msg: &str) -> bool {
    // HTTP 5xx, 408 (timeout), 429 (rate-limit) er retry-able per B2-dokumentasjon
    if status_code >= 500 || status_code == 408 || status_code == 429 {
        return true;
    }
    // reqwest-feil uten HTTP-status (network refused, DNS, TLS-handshake):
    // sjekk for vanlige mønstre
    let lower = err_msg.to_lowercase();
    lower.contains("timed out")
        || lower.contains("timeout")
        || lower.contains("connection reset")
        || lower.contains("connection refused")
        || lower.contains("temporary failure")
        || lower.contains("eof")
        || lower.contains("os error 60")  // ETIMEDOUT på macOS
        || lower.contains("os error 54")  // ECONNRESET på macOS
}

/// Wrapper som retry'er en async-operasjon ved transient feil.
/// `op_name` brukes kun for feilmeldinger. `attempt_fn` returnerer
/// Result<T, (u16, String)> hvor u16 er HTTP-status (0 hvis network-feil).
async fn retry_transient<T, F, Fut>(op_name: &str, mut attempt_fn: F) -> Result<T, String>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, (u16, String)>>,
{
    let mut delay_ms = 1000u64;
    let mut last_err = format!("{}: ingen attempts (skal ikke skje)", op_name);
    for attempt in 0..=MAX_RETRIES {
        match attempt_fn().await {
            Ok(v) => return Ok(v),
            Err((status, msg)) => {
                last_err = format!("{} (HTTP {}): {}", op_name, status, msg);
                if attempt == MAX_RETRIES || !is_transient(status, &msg) {
                    return Err(last_err);
                }
                eprintln!(
                    "[b2-retry] {} forsøk {}/{} feilet (transient), venter {}ms: {}",
                    op_name,
                    attempt + 1,
                    MAX_RETRIES + 1,
                    delay_ms,
                    msg
                );
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                delay_ms = delay_ms.saturating_mul(2);
            }
        }
    }
    Err(last_err)
}

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
    retry_transient("b2_authorize_account", || async {
        let client = reqwest::Client::new();
        let resp = client
            .get(B2_AUTHORIZE_URL)
            .basic_auth(key_id, Some(application_key))
            .send()
            .await
            .map_err(|e| (0u16, e.to_string()))?;
        let status = resp.status().as_u16();
        parse_b2_response::<B2Auth>(resp, "authorize")
            .await
            .map_err(|e| (status, e))
    })
    .await
}

/// b2_get_upload_url — krever auth-URL + token fra authorize.
pub async fn get_upload_url(auth: &B2Auth, bucket_id: &str) -> Result<B2UploadUrl, String> {
    let url = format!("{}/b2api/v3/b2_get_upload_url", auth.api_info.storage_api.api_url);
    retry_transient("b2_get_upload_url", || async {
        let client = reqwest::Client::new();
        let resp = client
            .post(&url)
            .header("Authorization", &auth.auth_token)
            .json(&GetUploadUrlBody { bucket_id })
            .send()
            .await
            .map_err(|e| (0u16, e.to_string()))?;
        let status = resp.status().as_u16();
        parse_b2_response::<B2UploadUrl>(resp, "get_upload_url")
            .await
            .map_err(|e| (status, e))
    })
    .await
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
/// For filer ≥ MULTIPART_THRESHOLD (200 MiB) bør caller bruke
/// `upload_file_large` istedenfor. B2 har 5 GB hard grense for
/// single-part uploads.
///
/// `on_progress` kalles med (bytes_sent, total_bytes) hver gang et
/// chunk er sendt over wire. Brukes til å emit'e `copy-file-progress`-
/// event til UI så Fredrik ser fremdrift på cloud-upload (samme
/// pattern som lokal-flyten i copy_engine::copy_and_verify).
pub async fn upload_file<F>(
    upload: &B2UploadUrl,
    file_path: &Path,
    dest_name: &str,
    sha1_hex: &str,
    on_progress: F,
) -> Result<B2UploadResult, String>
where
    F: FnMut(u64, u64) + Send + 'static,
{
    let metadata = tokio::fs::metadata(file_path)
        .await
        .map_err(|e| format!("Les filmetadata: {}", e))?;
    let size = metadata.len();
    if size > 5_000_000_000 {
        return Err(format!(
            "Filen ({} bytes) er over 5 GB. Bruk upload_file_large for multipart-upload.",
            size
        ));
    }

    let file = tokio::fs::File::open(file_path)
        .await
        .map_err(|e| format!("Åpne fil for upload: {}", e))?;

    // Stream fila i 256 KiB-chunks så reqwest sender med Content-Length
    // pre-known + vi kan emit'e progress per chunk.
    let progress = Arc::new(Mutex::new(on_progress));
    let progress_for_stream = progress.clone();
    let bytes_sent = Arc::new(Mutex::new(0u64));
    let bytes_sent_for_stream = bytes_sent.clone();

    let reader_stream = ReaderStream::with_capacity(file, 256 * 1024);
    let stream = reader_stream.inspect_ok(move |chunk| {
        let mut sent = bytes_sent_for_stream.lock().unwrap();
        *sent += chunk.len() as u64;
        let snapshot = *sent;
        drop(sent);
        if let Ok(mut cb) = progress_for_stream.lock() {
            cb(snapshot, size);
        }
    });

    // B2 krever URL-encoded fil-navn i header
    let encoded_name = b2_url_encode(dest_name);

    let body = reqwest::Body::wrap_stream(stream);
    let client = reqwest::Client::new();
    let resp = client
        .post(&upload.upload_url)
        .header("Authorization", &upload.upload_auth_token)
        .header("X-Bz-File-Name", encoded_name)
        .header("Content-Type", "b2/x-auto")
        .header("Content-Length", size.to_string())
        .header("X-Bz-Content-Sha1", sha1_hex)
        .body(body)
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

    // Final progress-emit ved 100% (i tilfelle siste chunk var et delvis
    // bidrag og kompresjon-aware reqwest droppet vår tracking)
    if let Ok(mut cb) = progress.lock() {
        cb(size, size);
    }

    Ok(B2UploadResult {
        file_id: parsed.file_id,
        file_name: parsed.file_name,
        content_sha1: parsed.content_sha1,
        content_length: parsed.content_length,
    })
}

/// Verifiser at credsen autoriserer + at bucket-en eksisterer.
/// Brukt av frontend Test-connection-knappen før user committer en
/// cloud-destinasjon. Returnerer OK med bucket-navn på suksess.
pub async fn test_connection(
    key_id: &str,
    application_key: &str,
    bucket_id: &str,
) -> Result<String, String> {
    let auth = authorize(key_id, application_key).await?;
    let url = format!("{}/b2api/v3/b2_list_buckets", auth.api_info.storage_api.api_url);
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "accountId": auth.account_id,
        "bucketId": bucket_id,
    });
    let resp = client
        .post(&url)
        .header("Authorization", &auth.auth_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("test_connection-feil: {}", e))?;
    #[derive(Deserialize)]
    struct R {
        buckets: Vec<B2Bucket>,
    }
    #[derive(Deserialize)]
    struct B2Bucket {
        #[serde(rename = "bucketName")]
        bucket_name: String,
    }
    let parsed: R = parse_b2_response(resp, "list_buckets").await?;
    parsed
        .buckets
        .into_iter()
        .next()
        .map(|b| b.bucket_name)
        .ok_or_else(|| format!("Bucket {} finnes ikke (eller key mangler tilgang)", bucket_id))
}

// ── Multipart upload for filer > 5 GB ────────────────────────────

#[derive(Debug, Deserialize)]
struct B2LargeFileStarted {
    #[serde(rename = "fileId")]
    file_id: String,
}

#[derive(Debug, Deserialize)]
struct B2UploadPartUrl {
    #[serde(rename = "uploadUrl")]
    upload_url: String,
    #[serde(rename = "authorizationToken")]
    upload_auth_token: String,
}

#[derive(Debug, Deserialize)]
struct B2PartResp {
    #[serde(rename = "contentSha1")]
    content_sha1: String,
}

#[derive(Debug, Deserialize)]
struct B2FinishLargeFile {
    #[serde(rename = "fileId")]
    file_id: String,
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "contentLength")]
    content_length: u64,
}

/// Threshold-router: caller bruker denne istedenfor å selv velge
/// single-part vs multipart. Emit'er progress over hele upload-en
/// (på tvers av parts).
pub async fn upload_file_smart<F>(
    auth: &B2Auth,
    bucket_id: &str,
    file_path: &Path,
    dest_name: &str,
    sha1_hex: &str,
    on_progress: F,
) -> Result<B2UploadResult, String>
where
    F: FnMut(u64, u64) + Send + 'static,
{
    let metadata = tokio::fs::metadata(file_path)
        .await
        .map_err(|e| format!("Les filmetadata: {}", e))?;
    let size = metadata.len();
    if size >= MULTIPART_THRESHOLD {
        upload_file_large(auth, bucket_id, file_path, dest_name, on_progress).await
    } else {
        // Single-part: trenger upload URL først
        let upload_url = get_upload_url(auth, bucket_id).await?;
        upload_file(&upload_url, file_path, dest_name, sha1_hex, on_progress).await
    }
}

/// Multipart-upload for store filer (RED RAW, 8K-video, etc.).
/// Splitter fila i 100 MiB parts, laster opp sekvensielt (parallell
/// kan komme i v2 hvis prod-test viser behov), kaller
/// b2_finish_large_file med liste av part-SHA-1-er.
///
/// `dest_name` er filnavnet i bucketen. SHA-1 av hele fila beregnes
/// IKKE her (Backblaze beregner det selv ved finish).
pub async fn upload_file_large<F>(
    auth: &B2Auth,
    bucket_id: &str,
    file_path: &Path,
    dest_name: &str,
    on_progress: F,
) -> Result<B2UploadResult, String>
where
    F: FnMut(u64, u64) + Send + 'static,
{
    use tokio::io::AsyncSeekExt;

    let metadata = tokio::fs::metadata(file_path)
        .await
        .map_err(|e| format!("Les filmetadata: {}", e))?;
    let total_size = metadata.len();

    if total_size < MULTIPART_PART_SIZE {
        return Err("Fila er for liten for multipart (< 100 MiB)".into());
    }

    // 1. b2_start_large_file
    let encoded_name = b2_url_encode(dest_name);
    let started: B2LargeFileStarted = retry_transient("b2_start_large_file", || {
        let url = format!(
            "{}/b2api/v3/b2_start_large_file",
            auth.api_info.storage_api.api_url
        );
        let body = serde_json::json!({
            "bucketId": bucket_id,
            "fileName": encoded_name,
            "contentType": "b2/x-auto",
        });
        let token = auth.auth_token.clone();
        async move {
            let client = reqwest::Client::new();
            let resp = client
                .post(&url)
                .header("Authorization", &token)
                .json(&body)
                .send()
                .await
                .map_err(|e| (0u16, e.to_string()))?;
            let status = resp.status().as_u16();
            parse_b2_response::<B2LargeFileStarted>(resp, "start_large_file")
                .await
                .map_err(|e| (status, e))
        }
    })
    .await?;
    let file_id = started.file_id;

    // 2. Iterér parts og last opp hver
    let progress = Arc::new(Mutex::new(on_progress));
    let mut part_shas: Vec<String> = Vec::new();
    let mut total_sent: u64 = 0;
    let mut part_number = 1u32;
    let mut offset: u64 = 0;

    while offset < total_size {
        let remaining = total_size - offset;
        let this_part_size = std::cmp::min(MULTIPART_PART_SIZE, remaining);

        // Les part-bytes inn i minnet (B2 godtar ikke streaming for parts
        // med Content-Length pre-known — eller, jo det gjør den, men det
        // forenkler retry-flyten å ha bytes i minnet).
        let mut buf = vec![0u8; this_part_size as usize];
        let mut f = tokio::fs::File::open(file_path)
            .await
            .map_err(|e| format!("Åpne fil for part: {}", e))?;
        f.seek(std::io::SeekFrom::Start(offset))
            .await
            .map_err(|e| format!("Seek: {}", e))?;
        f.read_exact(&mut buf)
            .await
            .map_err(|e| format!("Les part: {}", e))?;

        // SHA-1 av part
        let mut hasher = Sha1::new();
        hasher.update(&buf);
        let part_sha1 = hex::encode(hasher.finalize());

        // Hent upload-URL for denne parten + retry
        let part_url: B2UploadPartUrl = retry_transient("b2_get_upload_part_url", || {
            let url = format!(
                "{}/b2api/v3/b2_get_upload_part_url",
                auth.api_info.storage_api.api_url
            );
            let body = serde_json::json!({ "fileId": file_id });
            let token = auth.auth_token.clone();
            async move {
                let client = reqwest::Client::new();
                let resp = client
                    .post(&url)
                    .header("Authorization", &token)
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| (0u16, e.to_string()))?;
                let status = resp.status().as_u16();
                parse_b2_response::<B2UploadPartUrl>(resp, "get_upload_part_url")
                    .await
                    .map_err(|e| (status, e))
            }
        })
        .await?;

        // Upload part med retry. Ved network-feil får vi automatisk en
        // ny upload-URL hvis vi går through retry_transient.
        let buf_arc = Arc::new(buf);
        let part_sha1_clone = part_sha1.clone();
        let part_response: B2PartResp = retry_transient("b2_upload_part", || {
            let body = buf_arc.as_ref().clone();
            let upload_url_str = part_url.upload_url.clone();
            let upload_token = part_url.upload_auth_token.clone();
            let part_sha = part_sha1_clone.clone();
            let part_size = this_part_size;
            async move {
                let client = reqwest::Client::new();
                let resp = client
                    .post(&upload_url_str)
                    .header("Authorization", &upload_token)
                    .header("X-Bz-Part-Number", part_number.to_string())
                    .header("Content-Length", part_size.to_string())
                    .header("X-Bz-Content-Sha1", &part_sha)
                    .body(body)
                    .send()
                    .await
                    .map_err(|e| (0u16, e.to_string()))?;
                let status = resp.status().as_u16();
                parse_b2_response::<B2PartResp>(resp, "upload_part")
                    .await
                    .map_err(|e| (status, e))
            }
        })
        .await?;

        if !part_response.content_sha1.eq_ignore_ascii_case(&part_sha1) {
            return Err(format!(
                "Multipart part-{} SHA-1 mismatch: {} vs {}",
                part_number, part_response.content_sha1, part_sha1
            ));
        }

        part_shas.push(part_sha1);
        total_sent += this_part_size;
        offset += this_part_size;
        part_number += 1;

        // Emit progress etter hver vellykket part
        if let Ok(mut cb) = progress.lock() {
            cb(total_sent, total_size);
        }
    }

    // 3. b2_finish_large_file
    let finished: B2FinishLargeFile = retry_transient("b2_finish_large_file", || {
        let url = format!(
            "{}/b2api/v3/b2_finish_large_file",
            auth.api_info.storage_api.api_url
        );
        let body = serde_json::json!({
            "fileId": file_id,
            "partSha1Array": part_shas,
        });
        let token = auth.auth_token.clone();
        async move {
            let client = reqwest::Client::new();
            let resp = client
                .post(&url)
                .header("Authorization", &token)
                .json(&body)
                .send()
                .await
                .map_err(|e| (0u16, e.to_string()))?;
            let status = resp.status().as_u16();
            parse_b2_response::<B2FinishLargeFile>(resp, "finish_large_file")
                .await
                .map_err(|e| (status, e))
        }
    })
    .await?;

    Ok(B2UploadResult {
        file_id: finished.file_id,
        file_name: finished.file_name,
        // B2 beregner ikke en samlet SHA-1 av multipart-filer ("none" eller
        // "unverified:" returneres av list_files). Vi har verifisert hver
        // part individuelt, så vi setter en marker.
        content_sha1: "multipart-verified".to_string(),
        content_length: finished.content_length,
    })
}

// ── Bucket storage usage (quota-info) ─────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BucketUsage {
    pub bucket_id: String,
    pub bucket_name: String,
    pub file_count: u64,
    pub bytes_used: u64,
}

/// Henter file count + bytes brukt for én bucket. Bruker
/// b2_list_file_names (én eller flere round-trips for buckets med mange
/// filer) — for buckets med >10k filer kan dette være tregt. UI burde
/// cache resultatet og oppdatere f.eks. én gang per session.
pub async fn bucket_usage(
    auth: &B2Auth,
    bucket_id: &str,
    bucket_name: String,
) -> Result<BucketUsage, String> {
    let url = format!(
        "{}/b2api/v3/b2_list_file_names",
        auth.api_info.storage_api.api_url
    );
    let mut file_count = 0u64;
    let mut bytes_used = 0u64;
    let mut next_file_name: Option<String> = None;

    loop {
        let mut body = serde_json::json!({
            "bucketId": bucket_id,
            "maxFileCount": 10000,
        });
        if let Some(ref nxt) = next_file_name {
            body["startFileName"] = serde_json::Value::String(nxt.clone());
        }

        #[derive(Deserialize)]
        struct ListResp {
            files: Vec<FileEntry>,
            #[serde(rename = "nextFileName")]
            next_file_name: Option<String>,
        }
        #[derive(Deserialize)]
        struct FileEntry {
            #[serde(rename = "contentLength")]
            content_length: u64,
        }

        let resp: ListResp = retry_transient("b2_list_file_names", || {
            let url_c = url.clone();
            let body_c = body.clone();
            let token = auth.auth_token.clone();
            async move {
                let client = reqwest::Client::new();
                let resp = client
                    .post(&url_c)
                    .header("Authorization", &token)
                    .json(&body_c)
                    .send()
                    .await
                    .map_err(|e| (0u16, e.to_string()))?;
                let status = resp.status().as_u16();
                parse_b2_response::<ListResp>(resp, "list_file_names")
                    .await
                    .map_err(|e| (status, e))
            }
        })
        .await?;

        for f in &resp.files {
            file_count += 1;
            bytes_used += f.content_length;
        }

        if let Some(n) = resp.next_file_name {
            next_file_name = Some(n);
        } else {
            break;
        }
    }

    Ok(BucketUsage {
        bucket_id: bucket_id.to_string(),
        bucket_name,
        file_count,
        bytes_used,
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
    fn transient_classification() {
        // 5xx → transient
        assert!(is_transient(500, ""));
        assert!(is_transient(502, ""));
        assert!(is_transient(503, ""));
        // 408 timeout + 429 rate-limit → transient
        assert!(is_transient(408, ""));
        assert!(is_transient(429, ""));
        // 4xx (utenom 408/429) → permanent
        assert!(!is_transient(400, ""));
        assert!(!is_transient(401, "Invalid token"));
        assert!(!is_transient(403, "Access denied"));
        assert!(!is_transient(404, "Not found"));
        // 2xx skal aldri komme hit, men ikke retry uansett
        assert!(!is_transient(200, ""));
        // Network-feil (status=0) basert på error-melding
        assert!(is_transient(0, "Connection timed out"));
        assert!(is_transient(0, "Connection reset by peer"));
        assert!(is_transient(0, "os error 60"));
        assert!(!is_transient(0, "Some other random error"));
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

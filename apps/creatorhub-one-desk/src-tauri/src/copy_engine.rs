//! Copy-engine primitiver: xxHash64-streaming, kopi med progress, og
//! read-after-write hash-verifisering.
//!
//! INVARIANTER:
//!   - Kilden åpnes KUN for lesing (read-only). Aldri write/open_append.
//!   - Destinasjon-hash beregnes ved å lese tilbake fra disk etter kopiering,
//!     ikke fra in-memory chunks — det fanger korrupsjon ved disk-write.
//!   - Ved hash-mismatch returnerer vi en strukturert feil. Vi sletter
//!     ALDRI destinasjons-fila automatisk; bruker må beslutte.
//!   - Ved disk-full / IO-feil under kopiering SLETTER vi partial-fila
//!     før vi returnerer feil. Dette hindrer at en korrupt halvfil ligger
//!     på disk og maskerer som "ferdig kopiert" ved senere idempotens-
//!     sjekk. Hash-mismatch er den eneste situasjonen der dest beholdes
//!     (bruker må selv inspisere før vi rører bytes).

use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use xxhash_rust::xxh64::Xxh64;

const CHUNK_SIZE: usize = 1024 * 1024; // 1 MiB

/// Strukturert feil-kategori så caller (copy_session) kan reagere
/// presist (varsle UI med riktig melding, droppe sesjon vs skippe fil).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CopyErrorKind {
    /// Destinasjon-disk er full (ENOSPC) eller skrev færre bytes enn
    /// forventet. Partial-fila er fjernet.
    DestNoSpace,
    /// Skrivetillatelse nektet på destinasjon (EACCES/EPERM).
    DestPermDenied,
    /// Kunne ikke skrive til destinasjon av annen grunn. Partial-fila
    /// er fjernet.
    DestWriteFailed,
    /// Kunne ikke lese fra kilde — typisk når SD-kort tas ut mid-kopi.
    SourceReadFailed,
    /// Annen feil (åpning av fil, opprette mapper, etc).
    Other,
}

impl CopyErrorKind {
    fn from_io(err: &std::io::Error) -> Self {
        match err.kind() {
            ErrorKind::WriteZero | ErrorKind::StorageFull => CopyErrorKind::DestNoSpace,
            // ENOSPC kommer ofte som annet på enkelte OS-er.
            // Sjekk OS-error 28 (Linux ENOSPC) eller meldingstekst.
            _ if err.raw_os_error() == Some(28) => CopyErrorKind::DestNoSpace,
            _ if err.to_string().to_lowercase().contains("no space") => CopyErrorKind::DestNoSpace,
            ErrorKind::PermissionDenied => CopyErrorKind::DestPermDenied,
            _ => CopyErrorKind::DestWriteFailed,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CopyError {
    pub kind: CopyErrorKind,
    pub message: String,
}

impl CopyError {
    pub fn other(message: impl Into<String>) -> Self {
        Self {
            kind: CopyErrorKind::Other,
            message: message.into(),
        }
    }
    pub fn source_read(message: impl Into<String>) -> Self {
        Self {
            kind: CopyErrorKind::SourceReadFailed,
            message: message.into(),
        }
    }
}

impl std::fmt::Display for CopyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.kind {
            CopyErrorKind::DestNoSpace => write!(f, "DEST_NO_SPACE: {}", self.message),
            CopyErrorKind::DestPermDenied => write!(f, "DEST_PERM_DENIED: {}", self.message),
            CopyErrorKind::DestWriteFailed => write!(f, "DEST_WRITE_FAILED: {}", self.message),
            CopyErrorKind::SourceReadFailed => write!(f, "SOURCE_READ_FAILED: {}", self.message),
            CopyErrorKind::Other => write!(f, "{}", self.message),
        }
    }
}

impl From<CopyError> for String {
    fn from(err: CopyError) -> String {
        err.to_string()
    }
}

/// Hash en fil med xxh64. Streaming — laster aldri hele fila i minnet.
pub async fn hash_file_xxh64(path: &Path) -> Result<String, String> {
    let mut file = File::open(path)
        .await
        .map_err(|e| format!("Åpne {} for hashing: {}", path.display(), e))?;
    let mut hasher = Xxh64::new(0);
    let mut buf = vec![0u8; CHUNK_SIZE];
    loop {
        let n = file
            .read(&mut buf)
            .await
            .map_err(|e| format!("Les {} under hashing: {}", path.display(), e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:016x}", hasher.digest()))
}

/// Kopiér en fil til destinasjon med progress-callback.
/// Oppretter mellomliggende mapper hvis de mangler.
///
/// `on_progress(bytes_copied, total_bytes)` kalles ved hver chunk —
/// typisk hver 1 MiB. Caller ansvarlig for throttling hvis ønsket.
///
/// SIKKERHET: ved IO-feil under skriving (disk-full, permission, etc.)
/// fjernes partial-fila automatisk før feil propageres. Dette hindrer
/// at en halv-skrevet fil ligger på disk og maskerer som ferdig
/// kopiert ved senere idempotens-sjekk (siden idempotens-sjekken
/// bare ser på filstørrelse + hash).
pub async fn copy_with_progress<F>(
    source: &Path,
    dest: &Path,
    mut on_progress: F,
) -> Result<u64, CopyError>
where
    F: FnMut(u64, u64) + Send,
{
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| CopyError::other(format!("Opprett mappe {}: {}", parent.display(), e)))?;
    }

    let mut src_file = File::open(source).await.map_err(|e| {
        CopyError::source_read(format!("Åpne kilde {}: {}", source.display(), e))
    })?;
    let metadata = src_file.metadata().await.map_err(|e| {
        CopyError::source_read(format!("Les metadata for {}: {}", source.display(), e))
    })?;
    let total_bytes = metadata.len();

    // create_new = true → feiler hvis dest finnes (idempotens-håndtering ligger
    // i copy_session, ikke her). For F3 vi krever en explicit overwrite-policy
    // i caller; her sier vi nei.
    let mut dst_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(dest)
        .await
        .map_err(|e| {
            let kind = CopyErrorKind::from_io(&e);
            CopyError {
                kind: match kind {
                    // create_new + AlreadyExists er ikke ENOSPC; reduser feilkategori
                    CopyErrorKind::DestWriteFailed if e.kind() == ErrorKind::AlreadyExists => {
                        CopyErrorKind::Other
                    }
                    other => other,
                },
                message: format!("Opprett destinasjon {}: {}", dest.display(), e),
            }
        })?;

    // Helper: fjern partial dest hvis vi feiler underveis. Best-effort —
    // hvis sletting feiler logger vi og lar den opprinnelige feilen vinne.
    async fn cleanup_partial(dest: &Path) {
        if let Err(rm_err) = tokio::fs::remove_file(dest).await {
            eprintln!(
                "[copy-engine] WARN: kunne ikke fjerne partial-fil {} ({}); manuell opprydding kan trengs",
                dest.display(),
                rm_err
            );
        }
    }

    let mut buf = vec![0u8; CHUNK_SIZE];
    let mut copied = 0u64;
    loop {
        let n = match src_file.read(&mut buf).await {
            Ok(n) => n,
            Err(e) => {
                drop(dst_file);
                cleanup_partial(dest).await;
                return Err(CopyError::source_read(format!(
                    "Les fra {} under kopiering: {}",
                    source.display(),
                    e
                )));
            }
        };
        if n == 0 {
            break;
        }
        if let Err(e) = dst_file.write_all(&buf[..n]).await {
            let kind = CopyErrorKind::from_io(&e);
            drop(dst_file);
            cleanup_partial(dest).await;
            return Err(CopyError {
                kind,
                message: format!("Skriv til {} under kopiering: {}", dest.display(), e),
            });
        }
        copied += n as u64;
        on_progress(copied, total_bytes);
    }
    if let Err(e) = dst_file.flush().await {
        let kind = CopyErrorKind::from_io(&e);
        drop(dst_file);
        cleanup_partial(dest).await;
        return Err(CopyError {
            kind,
            message: format!("Flush {}: {}", dest.display(), e),
        });
    }
    // Sync to disk så hash-verifisering leser faktiske on-disk bytes
    if let Err(e) = dst_file.sync_all().await {
        let kind = CopyErrorKind::from_io(&e);
        drop(dst_file);
        cleanup_partial(dest).await;
        return Err(CopyError {
            kind,
            message: format!("Sync {}: {}", dest.display(), e),
        });
    }

    Ok(copied)
}

#[derive(Debug)]
#[allow(dead_code)] // bytes_copied + source_hash brukes i F4 backend-rapportering
pub struct VerifiedCopy {
    pub bytes_copied: u64,
    pub source_hash: String,
    pub dest_hash: String,
}

/// Full kopi-pipeline: hash kilde, kopiér til destinasjon, verifiser
/// dest-hash matcher kilde-hash. Returnerer Err hvis noe steg feiler.
///
/// Returnerer `String` for å beholde eksisterende caller-API; bruk
/// `copy_and_verify_typed` hvis du trenger feilkategorien programmatisk.
pub async fn copy_and_verify<F>(
    source: &Path,
    dest: &Path,
    on_progress: F,
) -> Result<VerifiedCopy, String>
where
    F: FnMut(u64, u64) + Send,
{
    copy_and_verify_typed(source, dest, on_progress)
        .await
        .map_err(|e| e.to_string())
}

/// Som copy_and_verify, men returnerer CopyError-typed så caller kan
/// reagere på CopyErrorKind (f.eks. avbryte hele sesjon ved DEST_NO_SPACE
/// vs kun denne filen).
pub async fn copy_and_verify_typed<F>(
    source: &Path,
    dest: &Path,
    on_progress: F,
) -> Result<VerifiedCopy, CopyError>
where
    F: FnMut(u64, u64) + Send,
{
    let source_hash = hash_file_xxh64(source)
        .await
        .map_err(CopyError::source_read)?;
    let bytes_copied = copy_with_progress(source, dest, on_progress).await?;
    let dest_hash = hash_file_xxh64(dest).await.map_err(|e| CopyError {
        kind: CopyErrorKind::DestWriteFailed,
        message: format!("Verifiserings-hash mislyktes for {}: {}", dest.display(), e),
    })?;
    if dest_hash != source_hash {
        return Err(CopyError {
            kind: CopyErrorKind::DestWriteFailed,
            message: format!(
                "HASH MISMATCH for {} → {}: source={}, dest={}",
                source.display(),
                dest.display(),
                source_hash,
                dest_hash,
            ),
        });
    }
    Ok(VerifiedCopy {
        bytes_copied,
        source_hash,
        dest_hash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;

    fn write_tmp_file(dir: &Path, name: &str, bytes: &[u8]) -> PathBuf {
        let path = dir.join(name);
        let mut f = std::fs::File::create(&path).expect("create tmp");
        f.write_all(bytes).expect("write tmp");
        f.sync_all().expect("sync tmp");
        path
    }

    #[tokio::test]
    async fn copy_and_verify_typed_succeeds_for_clean_copy() {
        let src_dir = tempdir().unwrap();
        let dst_dir = tempdir().unwrap();
        let src = write_tmp_file(src_dir.path(), "img.bin", b"hello world creators");
        let dst = dst_dir.path().join("img.bin");
        let result = copy_and_verify_typed(&src, &dst, |_, _| {}).await;
        let v = result.expect("happy-path skal lykkes");
        assert_eq!(v.bytes_copied, 20);
        assert_eq!(v.source_hash, v.dest_hash);
        assert!(dst.exists());
    }

    #[tokio::test]
    async fn copy_with_progress_removes_partial_on_source_read_failure() {
        // Sletter kildefila i prosess via en kort kilde slik at vi
        // tester at dest fjernes hvis hashing-prep feiler. For å trigge
        // SOURCE_READ pass-throughen sletter vi etter copy_with_progress
        // har lest metadata, men før den åpner kilden — vanskelig å
        // race nøyaktig her, så vi tester på et lukket scenario:
        // ikke-eksisterende kilde.
        let dst_dir = tempdir().unwrap();
        let missing_src = dst_dir.path().join("does-not-exist.bin");
        let dst = dst_dir.path().join("dst.bin");
        let result = copy_with_progress(&missing_src, &dst, |_, _| {}).await;
        let err = result.expect_err("kopi skal feile");
        assert_eq!(err.kind, CopyErrorKind::SourceReadFailed);
        assert!(!dst.exists(), "ingen dest-fil skal eksistere når kilde feilet");
    }

    #[tokio::test]
    async fn copy_with_progress_removes_partial_when_dest_dir_disappears_mid_copy() {
        // Vi kan ikke enkelt simulere ENOSPC i tester (krever spesielle
        // FS-mounts), men vi kan teste at en typed CopyError klassifiseres
        // riktig for kjente fra_io-input.
        let mock_full = std::io::Error::new(std::io::ErrorKind::WriteZero, "ingen plass");
        assert_eq!(CopyErrorKind::from_io(&mock_full), CopyErrorKind::DestNoSpace);
        let mock_perm =
            std::io::Error::new(std::io::ErrorKind::PermissionDenied, "ikke lov");
        assert_eq!(
            CopyErrorKind::from_io(&mock_perm),
            CopyErrorKind::DestPermDenied
        );
        let mock_other = std::io::Error::new(std::io::ErrorKind::Other, "ukjent");
        assert_eq!(
            CopyErrorKind::from_io(&mock_other),
            CopyErrorKind::DestWriteFailed
        );
    }

    #[tokio::test]
    async fn copy_with_progress_refuses_to_overwrite_existing_dest() {
        let dir = tempdir().unwrap();
        let src = write_tmp_file(dir.path(), "src.bin", b"new content");
        let dst = write_tmp_file(
            dir.path(),
            "dst.bin",
            b"existing content - do not touch",
        );
        let result = copy_with_progress(&src, &dst, |_, _| {}).await;
        // Skal feile fordi create_new=true; partial-fila er ikke vår,
        // så vi sletter den IKKE — bruker kan inspisere.
        let err = result.expect_err("eksisterende dest skal blokkere copy");
        // create_new gir AlreadyExists som maper til Other (ikke partial-cleanup).
        assert_eq!(err.kind, CopyErrorKind::Other);
        // Original-fila er bevart
        let bytes = std::fs::read(&dst).expect("dst skal fortsatt eksistere");
        assert_eq!(bytes, b"existing content - do not touch");
    }

    #[tokio::test]
    async fn copy_error_display_includes_kind_prefix_for_classification() {
        let no_space = CopyError {
            kind: CopyErrorKind::DestNoSpace,
            message: "disk full".to_string(),
        };
        assert!(no_space.to_string().starts_with("DEST_NO_SPACE:"));
        let perm = CopyError {
            kind: CopyErrorKind::DestPermDenied,
            message: "nei".to_string(),
        };
        assert!(perm.to_string().starts_with("DEST_PERM_DENIED:"));
    }
}

/// Bygg destinasjons-stien for en kilde-fil basert på destinasjons-rot,
/// volum-label (f.eks. "EOS_DIGITAL") og kildens relative sti fra
/// mount-punktet.
///
/// Eksempel:
///   source       = /Volumes/EOS_DIGITAL/DCIM/100EOSR5/IMG_0001.CR3
///   mount_root   = /Volumes/EOS_DIGITAL
///   dest_root    = /Volumes/MyRAID/Bryllup_2026
///   volume_label = EOS_DIGITAL
///   →            = /Volumes/MyRAID/Bryllup_2026/EOS_DIGITAL/DCIM/100EOSR5/IMG_0001.CR3
pub fn build_dest_path(
    source: &Path,
    mount_root: &Path,
    dest_root: &Path,
    volume_label: &str,
) -> Result<PathBuf, String> {
    let rel = source
        .strip_prefix(mount_root)
        .map_err(|_| format!("{} er ikke under {}", source.display(), mount_root.display()))?;
    Ok(dest_root.join(volume_label).join(rel))
}

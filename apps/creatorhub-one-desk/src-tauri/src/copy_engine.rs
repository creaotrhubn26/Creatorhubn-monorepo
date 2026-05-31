//! Copy-engine primitiver: xxHash64-streaming, kopi med progress, og
//! read-after-write hash-verifisering.
//!
//! INVARIANTER:
//!   - Kilden åpnes KUN for lesing (read-only). Aldri write/open_append.
//!   - Destinasjon-hash beregnes ved å lese tilbake fra disk etter kopiering,
//!     ikke fra in-memory chunks — det fanger korrupsjon ved disk-write.
//!   - Ved hash-mismatch returnerer vi en strukturert feil. Vi sletter
//!     ALDRI destinasjons-fila automatisk; bruker må beslutte.

use std::path::{Path, PathBuf};

use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use xxhash_rust::xxh64::Xxh64;

const CHUNK_SIZE: usize = 1024 * 1024; // 1 MiB

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
pub async fn copy_with_progress<F>(
    source: &Path,
    dest: &Path,
    mut on_progress: F,
) -> Result<u64, String>
where
    F: FnMut(u64, u64) + Send,
{
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Opprett mappe {}: {}", parent.display(), e))?;
    }

    let mut src_file = File::open(source)
        .await
        .map_err(|e| format!("Åpne kilde {} for lesing: {}", source.display(), e))?;
    let metadata = src_file
        .metadata()
        .await
        .map_err(|e| format!("Les metadata for {}: {}", source.display(), e))?;
    let total_bytes = metadata.len();

    // create_new = true → feiler hvis dest finnes (idempotens-håndtering ligger
    // i copy_session, ikke her). For F3 vi krever en explicit overwrite-policy
    // i caller; her sier vi nei.
    let mut dst_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(dest)
        .await
        .map_err(|e| format!("Opprett destinasjon {}: {}", dest.display(), e))?;

    let mut buf = vec![0u8; CHUNK_SIZE];
    let mut copied = 0u64;
    loop {
        let n = src_file
            .read(&mut buf)
            .await
            .map_err(|e| format!("Les fra {} under kopiering: {}", source.display(), e))?;
        if n == 0 {
            break;
        }
        dst_file
            .write_all(&buf[..n])
            .await
            .map_err(|e| format!("Skriv til {} under kopiering: {}", dest.display(), e))?;
        copied += n as u64;
        on_progress(copied, total_bytes);
    }
    dst_file
        .flush()
        .await
        .map_err(|e| format!("Flush {}: {}", dest.display(), e))?;
    // Sync to disk så hash-verifisering leser faktiske on-disk bytes
    dst_file
        .sync_all()
        .await
        .map_err(|e| format!("Sync {}: {}", dest.display(), e))?;

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
pub async fn copy_and_verify<F>(
    source: &Path,
    dest: &Path,
    on_progress: F,
) -> Result<VerifiedCopy, String>
where
    F: FnMut(u64, u64) + Send,
{
    let source_hash = hash_file_xxh64(source).await?;
    let bytes_copied = copy_with_progress(source, dest, on_progress).await?;
    let dest_hash = hash_file_xxh64(dest).await?;
    if dest_hash != source_hash {
        return Err(format!(
            "HASH MISMATCH for {} → {}: source={}, dest={}",
            source.display(),
            dest.display(),
            source_hash,
            dest_hash,
        ));
    }
    Ok(VerifiedCopy {
        bytes_copied,
        source_hash,
        dest_hash,
    })
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

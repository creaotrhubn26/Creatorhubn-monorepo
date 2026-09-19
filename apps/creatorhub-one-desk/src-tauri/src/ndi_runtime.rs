//! Runtime-loaded NDI 6.3 integration.
//!
//! Loading the dylib at runtime keeps CreatorHub Desk buildable on machines
//! without the licensed SDK. All FFI signatures below are copied from the
//! installed `Processing.NDI.Lib.h` / `Processing.NDI.Find.h` v6.3.2.0.

use std::ffi::{CStr, CString, c_char, c_void};
use std::path::{Path, PathBuf};
use std::ptr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

use libloading::Library;
use serde::Serialize;

type FindInstance = *mut c_void;

#[repr(C)]
struct NdiSourceRaw {
    p_ndi_name: *const c_char,
    p_url_address: *const c_char,
}

type InitializeFn = unsafe extern "C" fn() -> bool;
type VersionFn = unsafe extern "C" fn() -> *const c_char;
type FindCreateFn = unsafe extern "C" fn(*const c_void) -> FindInstance;
type FindDestroyFn = unsafe extern "C" fn(FindInstance);
type FindWaitFn = unsafe extern "C" fn(FindInstance, u32) -> bool;
type FindCurrentFn = unsafe extern "C" fn(FindInstance, *mut u32) -> *const NdiSourceRaw;
type RecvInstance = *mut c_void;
type RecvCreateFn = unsafe extern "C" fn(*const NdiRecvCreateRaw) -> RecvInstance;
type RecvDestroyFn = unsafe extern "C" fn(RecvInstance);
type RecvCaptureFn =
    unsafe extern "C" fn(RecvInstance, *mut NdiVideoFrameRaw, *mut c_void, *mut c_void, u32) -> i32;
type RecvFreeVideoFn = unsafe extern "C" fn(RecvInstance, *const NdiVideoFrameRaw);

const FRAME_TYPE_NONE: i32 = 0;
const FRAME_TYPE_VIDEO: i32 = 1;
const FRAME_TYPE_ERROR: i32 = 4;
const COLOR_FORMAT_UYVY_BGRA: i32 = 1;
const BANDWIDTH_HIGHEST: i32 = 100;
const FOURCC_UYVY: i32 = i32::from_le_bytes(*b"UYVY");
const FOURCC_BGRA: i32 = i32::from_le_bytes(*b"BGRA");

#[repr(C)]
struct NdiRecvCreateRaw {
    source_to_connect_to: NdiSourceRaw,
    color_format: i32,
    bandwidth: i32,
    allow_video_fields: bool,
    p_ndi_recv_name: *const c_char,
}

#[repr(C)]
struct NdiVideoFrameRaw {
    xres: i32,
    yres: i32,
    fourcc: i32,
    frame_rate_n: i32,
    frame_rate_d: i32,
    picture_aspect_ratio: f32,
    frame_format_type: i32,
    timecode: i64,
    p_data: *mut u8,
    line_stride_in_bytes: i32,
    p_metadata: *const c_char,
    timestamp: i64,
}

struct NdiRuntime {
    _library: Library,
    version: VersionFn,
    find_create: FindCreateFn,
    find_destroy: FindDestroyFn,
    find_wait: FindWaitFn,
    find_current: FindCurrentFn,
    recv_create: RecvCreateFn,
    recv_destroy: RecvDestroyFn,
    recv_capture: RecvCaptureFn,
    recv_free_video: RecvFreeVideoFn,
}

static RUNTIME: OnceLock<Result<NdiRuntime, String>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct NdiSource {
    pub name: String,
    pub url_address: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NdiDiscoveryResult {
    pub runtime_path: String,
    pub runtime_version: String,
    pub sources: Vec<NdiSource>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NdiPixelFormat {
    Uyvy422,
    Bgra,
}

#[derive(Debug, Clone)]
pub struct NdiVideoFrame {
    pub width: usize,
    pub height: usize,
    pub frame_rate_n: i32,
    pub frame_rate_d: i32,
    pub pixel_format: NdiPixelFormat,
    pub data: Arc<[u8]>,
}

pub fn runtime_path() -> Option<PathBuf> {
    if let Some(configured) = std::env::var_os("CREATORHUB_NDI_RUNTIME") {
        if let Some(path) = resolve_candidate(Path::new(&configured)) {
            return Some(path);
        }
    }
    [
        Path::new("/Library/NDI SDK for Apple/lib/macOS/libndi.dylib"),
        Path::new("/usr/local/lib/libndi.dylib"),
    ]
    .into_iter()
    .find(|path| path.is_file())
    .map(Path::to_path_buf)
}

fn resolve_candidate(path: &Path) -> Option<PathBuf> {
    if path.is_file() {
        return Some(path.to_path_buf());
    }
    if !path.is_dir() {
        return None;
    }
    [
        path.join("libndi.dylib"),
        path.join("lib/macOS/libndi.dylib"),
    ]
    .into_iter()
    .find(|candidate| candidate.is_file())
}

pub fn discover(timeout_ms: u32) -> Result<NdiDiscoveryResult, String> {
    let runtime_path = runtime_path().ok_or_else(|| {
        "NDI runtime mangler. Installer NDI SDK/runtime eller sett CREATORHUB_NDI_RUNTIME."
            .to_string()
    })?;
    let timeout_ms = timeout_ms.min(5_000);
    let runtime = runtime()?;

    // SAFETY: The process-global runtime keeps the library alive for every
    // finder call. Signatures match the installed NDI 6.3.2 headers.
    unsafe {
        let runtime_version =
            c_string((runtime.version)()).unwrap_or_else(|| "Ukjent NDI-versjon".into());
        let finder = (runtime.find_create)(ptr::null());
        if finder.is_null() {
            return Err("NDIlib_find_create_v2 returnerte null".into());
        }

        let _changed = (runtime.find_wait)(finder, timeout_ms);
        let mut source_count = 0_u32;
        let source_pointer = (runtime.find_current)(finder, &mut source_count);
        let sources = if source_pointer.is_null() || source_count == 0 {
            Vec::new()
        } else {
            std::slice::from_raw_parts(source_pointer, source_count as usize)
                .iter()
                .filter_map(|source| {
                    Some(NdiSource {
                        name: c_string(source.p_ndi_name)?,
                        url_address: c_string(source.p_url_address),
                    })
                })
                .collect()
        };
        (runtime.find_destroy)(finder);

        Ok(NdiDiscoveryResult {
            runtime_path: runtime_path.display().to_string(),
            runtime_version,
            sources,
        })
    }
}

pub fn find_source(
    source_name: &str,
    url_address: Option<&str>,
    timeout_ms: u32,
) -> Result<NdiSource, String> {
    let discovered = discover(timeout_ms)?;
    discovered
        .sources
        .into_iter()
        .find(|source| {
            source.name == source_name
                && url_address.is_none_or(|url| source.url_address.as_deref() == Some(url))
        })
        .ok_or_else(|| format!("NDI-kilden er ikke lenger tilgjengelig: {source_name}"))
}

pub fn receive_video<F>(
    source: &NdiSource,
    stop: &AtomicBool,
    repeat_last_frame: bool,
    mut on_frame: F,
) -> Result<(), String>
where
    F: FnMut(NdiVideoFrame) -> Result<(), String>,
{
    let runtime = runtime()?;
    let source_name = CString::new(source.name.as_str())
        .map_err(|_| "NDI-kilden har ugyldig navn".to_string())?;
    let source_url = source
        .url_address
        .as_deref()
        .map(CString::new)
        .transpose()
        .map_err(|_| "NDI-kilden har ugyldig URL".to_string())?;
    let receiver_name = CString::new("CreatorHub Bridge Preview").expect("static receiver name");
    let settings = NdiRecvCreateRaw {
        source_to_connect_to: NdiSourceRaw {
            p_ndi_name: source_name.as_ptr(),
            p_url_address: source_url
                .as_ref()
                .map_or(ptr::null(), |value| value.as_ptr()),
        },
        color_format: COLOR_FORMAT_UYVY_BGRA,
        bandwidth: BANDWIDTH_HIGHEST,
        allow_video_fields: false,
        p_ndi_recv_name: receiver_name.as_ptr(),
    };

    // SAFETY: All structs and signatures are copied from the installed NDI
    // 6.3.2 headers. Captured frame bytes are copied before the NDI buffer is
    // freed, and all CString storage outlives receiver creation.
    unsafe {
        let receiver = (runtime.recv_create)(&settings);
        if receiver.is_null() {
            return Err("NDIlib_recv_create_v3 returnerte null".into());
        }
        let result = (|| {
            let mut last_frame: Option<NdiVideoFrame> = None;
            let mut last_emitted = Instant::now();
            while !stop.load(Ordering::Relaxed) {
                let mut raw: NdiVideoFrameRaw = std::mem::zeroed();
                match (runtime.recv_capture)(
                    receiver,
                    &mut raw,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    25,
                ) {
                    FRAME_TYPE_NONE => {
                        if repeat_last_frame
                            && let Some(frame) = last_frame.as_ref()
                            && last_emitted.elapsed() >= frame_interval(frame)
                        {
                            on_frame(frame.clone())?;
                            last_emitted = Instant::now();
                        }
                    }
                    FRAME_TYPE_VIDEO => {
                        let copied = copy_video_frame(&raw);
                        (runtime.recv_free_video)(receiver, &raw);
                        let copied = copied?;
                        on_frame(copied.clone())?;
                        last_frame = Some(copied);
                        last_emitted = Instant::now();
                    }
                    FRAME_TYPE_ERROR => return Err("NDI-forbindelsen ble brutt".into()),
                    _ => continue,
                }
            }
            Ok(())
        })();
        (runtime.recv_destroy)(receiver);
        result
    }
}

fn frame_interval(frame: &NdiVideoFrame) -> Duration {
    let seconds = if frame.frame_rate_n > 0 && frame.frame_rate_d > 0 {
        frame.frame_rate_d as f64 / frame.frame_rate_n as f64
    } else {
        1.0 / 30.0
    };
    Duration::from_secs_f64(seconds.clamp(0.005, 1.0))
}

fn runtime() -> Result<&'static NdiRuntime, String> {
    match RUNTIME.get_or_init(load_runtime) {
        Ok(runtime) => Ok(runtime),
        Err(error) => Err(error.clone()),
    }
}

fn load_runtime() -> Result<NdiRuntime, String> {
    let path = runtime_path().ok_or_else(|| {
        "NDI runtime mangler. Installer NDI SDK/runtime eller sett CREATORHUB_NDI_RUNTIME."
            .to_string()
    })?;
    // SAFETY: Symbol names and signatures are validated against the locally
    // installed 6.3.2 SDK headers. The Library is retained for process life.
    unsafe {
        let library = Library::new(&path)
            .map_err(|error| format!("Last NDI runtime {}: {error}", path.display()))?;
        let initialize: InitializeFn = load_symbol(&library, b"NDIlib_initialize\0")?;
        if !initialize() {
            return Err("NDIlib_initialize avviste denne maskinen/runtime-kombinasjonen".into());
        }
        Ok(NdiRuntime {
            version: load_symbol(&library, b"NDIlib_version\0")?,
            find_create: load_symbol(&library, b"NDIlib_find_create_v2\0")?,
            find_destroy: load_symbol(&library, b"NDIlib_find_destroy\0")?,
            find_wait: load_symbol(&library, b"NDIlib_find_wait_for_sources\0")?,
            find_current: load_symbol(&library, b"NDIlib_find_get_current_sources\0")?,
            recv_create: load_symbol(&library, b"NDIlib_recv_create_v3\0")?,
            recv_destroy: load_symbol(&library, b"NDIlib_recv_destroy\0")?,
            recv_capture: load_symbol(&library, b"NDIlib_recv_capture_v3\0")?,
            recv_free_video: load_symbol(&library, b"NDIlib_recv_free_video_v2\0")?,
            _library: library,
        })
    }
}

unsafe fn load_symbol<T: Copy>(library: &Library, name: &[u8]) -> Result<T, String> {
    // SAFETY: The caller supplies the exact version-matched function type.
    unsafe { library.get::<T>(name) }
        .map(|symbol| *symbol)
        .map_err(|error| format!("{}: {error}", String::from_utf8_lossy(name)))
}

fn copy_video_frame(raw: &NdiVideoFrameRaw) -> Result<NdiVideoFrame, String> {
    let width = usize::try_from(raw.xres).map_err(|_| "Ugyldig NDI-bredde".to_string())?;
    let height = usize::try_from(raw.yres).map_err(|_| "Ugyldig NDI-høyde".to_string())?;
    if width == 0 || height == 0 || width > 16_384 || height > 16_384 || raw.p_data.is_null() {
        return Err("NDI returnerte en ugyldig videoramme".into());
    }
    let (pixel_format, bytes_per_pixel) = match raw.fourcc {
        FOURCC_UYVY => (NdiPixelFormat::Uyvy422, 2_usize),
        FOURCC_BGRA => (NdiPixelFormat::Bgra, 4_usize),
        other => return Err(format!("NDI-pikselformat støttes ikke ennå: {other:#x}")),
    };
    let row_bytes = width
        .checked_mul(bytes_per_pixel)
        .ok_or_else(|| "NDI-rammen er for stor".to_string())?;
    let stride = usize::try_from(raw.line_stride_in_bytes)
        .ok()
        .filter(|value| *value >= row_bytes)
        .unwrap_or(row_bytes);
    let input_len = stride
        .checked_mul(height)
        .ok_or_else(|| "NDI-rammen er for stor".to_string())?;
    let output_len = row_bytes
        .checked_mul(height)
        .ok_or_else(|| "NDI-rammen er for stor".to_string())?;
    let input = unsafe { std::slice::from_raw_parts(raw.p_data, input_len) };
    let mut data = Vec::with_capacity(output_len);
    for row in input.chunks_exact(stride).take(height) {
        data.extend_from_slice(&row[..row_bytes]);
    }
    Ok(NdiVideoFrame {
        width,
        height,
        frame_rate_n: raw.frame_rate_n,
        frame_rate_d: raw.frame_rate_d,
        pixel_format,
        data: data.into(),
    })
}

unsafe fn c_string(pointer: *const c_char) -> Option<String> {
    if pointer.is_null() {
        return None;
    }
    // SAFETY: NDI owns this NUL-terminated string until the next finder call;
    // callers copy it immediately before destroying the finder.
    Some(
        unsafe { CStr::from_ptr(pointer) }
            .to_string_lossy()
            .into_owned(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installed_runtime_loads_and_reports_its_version() {
        let Some(_) = runtime_path() else { return };
        let result = discover(0).expect("installed NDI runtime");
        assert!(!result.runtime_version.is_empty());
        assert!(result.runtime_path.ends_with("libndi.dylib"));
    }

    #[test]
    fn copies_strided_uyvy_frame_without_padding() {
        let mut bytes = vec![1_u8, 2, 3, 4, 99, 99, 5, 6, 7, 8, 99, 99];
        let raw = NdiVideoFrameRaw {
            xres: 2,
            yres: 2,
            fourcc: FOURCC_UYVY,
            frame_rate_n: 25,
            frame_rate_d: 1,
            picture_aspect_ratio: 1.0,
            frame_format_type: 1,
            timecode: 0,
            p_data: bytes.as_mut_ptr(),
            line_stride_in_bytes: 6,
            p_metadata: ptr::null(),
            timestamp: 0,
        };
        let copied = copy_video_frame(&raw).expect("copy frame");
        assert_eq!(copied.pixel_format, NdiPixelFormat::Uyvy422);
        assert_eq!(&*copied.data, &[1, 2, 3, 4, 5, 6, 7, 8]);
    }
}

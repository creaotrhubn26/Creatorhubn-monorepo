//! NDI source -> local HLS preview pipeline for CreatorHub Bridge.
//!
//! NDI decoding stays inside the installed vendor runtime. Frames are copied
//! into a local FFmpeg process and encoded with macOS VideoToolbox. The HLS
//! files are served by `bridge_preview` and never leave the local network.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::JoinHandle;

use serde::Serialize;

use crate::bridge_preview::{self, BridgePreviewState, PreviewRole};
use crate::ndi_runtime::{self, NdiPixelFormat, NdiSource, NdiVideoFrame};

const RUNTIME_SOURCE_ID: &str = "ndi-camera";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NdiPreviewPhase {
    Idle,
    Starting,
    Running,
    Stopped,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct NdiPreviewStatus {
    pub phase: NdiPreviewPhase,
    pub source_name: Option<String>,
    pub frames_received: u64,
    pub width: Option<usize>,
    pub height: Option<usize>,
    pub frames_per_second: Option<f64>,
    pub playback_url: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub last_error: Option<String>,
}

impl Default for NdiPreviewStatus {
    fn default() -> Self {
        Self {
            phase: NdiPreviewPhase::Idle,
            source_name: None,
            frames_received: 0,
            width: None,
            height: None,
            frames_per_second: None,
            playback_url: None,
            ffmpeg_path: None,
            last_error: None,
        }
    }
}

struct Worker {
    stop: Arc<AtomicBool>,
    join: JoinHandle<()>,
}

pub struct NdiPreviewState {
    status: Arc<RwLock<NdiPreviewStatus>>,
    worker: Mutex<Option<Worker>>,
}

impl Default for NdiPreviewState {
    fn default() -> Self {
        Self {
            status: Arc::new(RwLock::new(NdiPreviewStatus::default())),
            worker: Mutex::new(None),
        }
    }
}

impl NdiPreviewState {
    pub fn status(&self) -> NdiPreviewStatus {
        self.status.read().unwrap().clone()
    }

    pub fn start(
        &self,
        source_name: String,
        url_address: Option<String>,
        bridge: Arc<BridgePreviewState>,
    ) -> Result<NdiPreviewStatus, String> {
        self.stop(&bridge)?;
        let source = ndi_runtime::find_source(&source_name, url_address.as_deref(), 2_500)?;
        let ffmpeg = ffmpeg_path()?;
        let output_dir = bridge_preview::hls_root().join(RUNTIME_SOURCE_ID);
        prepare_output_dir(&output_dir)?;

        *self.status.write().unwrap() = NdiPreviewStatus {
            phase: NdiPreviewPhase::Starting,
            source_name: Some(source.name.clone()),
            ffmpeg_path: Some(ffmpeg.display().to_string()),
            ..NdiPreviewStatus::default()
        };

        let stop = Arc::new(AtomicBool::new(false));
        let worker_stop = stop.clone();
        let status = self.status.clone();
        let join = std::thread::Builder::new()
            .name("creatorhub-ndi-preview".into())
            .spawn(move || {
                let result = run_pipeline(
                    &source,
                    &ffmpeg,
                    &output_dir,
                    &worker_stop,
                    &status,
                    &bridge,
                );
                bridge.remove_runtime_source(RUNTIME_SOURCE_ID);
                let mut current = status.write().unwrap();
                current.playback_url = None;
                if worker_stop.load(Ordering::Relaxed) {
                    current.phase = NdiPreviewPhase::Stopped;
                    current.last_error = None;
                } else if let Err(error) = result {
                    current.phase = NdiPreviewPhase::Failed;
                    current.last_error = Some(error);
                }
            })
            .map_err(|error| format!("Start NDI preview-tråd: {error}"))?;
        *self.worker.lock().unwrap() = Some(Worker { stop, join });
        Ok(self.status())
    }

    pub fn stop(&self, bridge: &BridgePreviewState) -> Result<NdiPreviewStatus, String> {
        let worker = self.worker.lock().unwrap().take();
        if let Some(worker) = worker {
            worker.stop.store(true, Ordering::Relaxed);
            worker
                .join
                .join()
                .map_err(|_| "NDI preview-tråden krasjet under stopp".to_string())?;
        }
        bridge.remove_runtime_source(RUNTIME_SOURCE_ID);
        let mut status = self.status.write().unwrap();
        if !matches!(status.phase, NdiPreviewPhase::Idle) {
            status.phase = NdiPreviewPhase::Stopped;
            status.playback_url = None;
            status.last_error = None;
        }
        Ok(status.clone())
    }
}

impl Drop for NdiPreviewState {
    fn drop(&mut self) {
        if let Ok(worker) = self.worker.get_mut()
            && let Some(worker) = worker.take()
        {
            worker.stop.store(true, Ordering::Relaxed);
            let _ = worker.join.join();
        }
    }
}

fn run_pipeline(
    source: &NdiSource,
    ffmpeg_path: &Path,
    output_dir: &Path,
    stop: &AtomicBool,
    status: &RwLock<NdiPreviewStatus>,
    bridge: &BridgePreviewState,
) -> Result<(), String> {
    let mut encoder: Option<HlsEncoder> = None;
    let mut published = false;
    let playlist = output_dir.join("index.m3u8");
    let mut frame_count = 0_u64;

    let receive_result = ndi_runtime::receive_video(source, stop, true, |frame| {
        if encoder.is_none() {
            encoder = Some(HlsEncoder::start(ffmpeg_path, output_dir, &frame)?);
        }
        let active = encoder.as_mut().expect("encoder initialized");
        active.write_frame(&frame)?;
        frame_count += 1;

        if frame_count == 1 || frame_count % 15 == 0 {
            let mut current = status.write().unwrap();
            current.frames_received = frame_count;
            current.width = Some(frame.width);
            current.height = Some(frame.height);
            current.frames_per_second = Some(frame_rate(&frame));
        }
        if !published && playlist.is_file() {
            let source = bridge.publish_local_hls(
                RUNTIME_SOURCE_ID,
                &format!("{} · NDI", source.name),
                PreviewRole::Camera,
                &format!("{}×{} lokal", frame.width, frame.height),
            )?;
            let mut current = status.write().unwrap();
            current.phase = NdiPreviewPhase::Running;
            current.playback_url = Some(source.playback_url);
            published = true;
        }
        Ok(())
    });

    if let Some(mut encoder) = encoder {
        encoder.finish();
    }
    receive_result
}

struct HlsEncoder {
    child: Child,
    stdin: Option<ChildStdin>,
    width: usize,
    height: usize,
    pixel_format: NdiPixelFormat,
}

impl HlsEncoder {
    fn start(ffmpeg_path: &Path, output_dir: &Path, frame: &NdiVideoFrame) -> Result<Self, String> {
        let playlist = output_dir.join("index.m3u8");
        let segments = output_dir.join("segment_%06d.ts");
        let fps = normalized_frame_rate(frame);
        let keyframe_interval = ((fps.0 as f64 / fps.1 as f64).round() as u32).max(1);
        let pixel_format = match frame.pixel_format {
            NdiPixelFormat::Uyvy422 => "uyvy422",
            NdiPixelFormat::Bgra => "bgra",
        };
        let mut child = Command::new(ffmpeg_path)
            .args([
                "-hide_banner",
                "-loglevel",
                "warning",
                "-f",
                "rawvideo",
                "-pixel_format",
                pixel_format,
                "-video_size",
                &format!("{}x{}", frame.width, frame.height),
                "-framerate",
                &format!("{}/{}", fps.0, fps.1),
                "-i",
                "pipe:0",
                "-an",
                "-c:v",
                "h264_videotoolbox",
                "-allow_sw",
                "1",
                "-realtime",
                "1",
                "-pix_fmt",
                "yuv420p",
                "-b:v",
                "5000k",
                "-maxrate",
                "6500k",
                "-bufsize",
                "10000k",
                "-g",
                &keyframe_interval.to_string(),
                "-bf",
                "0",
                "-force_key_frames",
                "expr:gte(t,n_forced*1)",
                "-flush_packets",
                "1",
                "-f",
                "hls",
                "-hls_time",
                "1",
                "-hls_list_size",
                "5",
                "-hls_flags",
                "delete_segments+append_list+independent_segments+omit_endlist+program_date_time",
                "-hls_segment_filename",
                &segments.display().to_string(),
                &playlist.display().to_string(),
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Start FFmpeg for NDI preview: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "FFmpeg åpnet ikke video-input".to_string())?;
        Ok(Self {
            child,
            stdin: Some(stdin),
            width: frame.width,
            height: frame.height,
            pixel_format: frame.pixel_format,
        })
    }

    fn write_frame(&mut self, frame: &NdiVideoFrame) -> Result<(), String> {
        if frame.width != self.width
            || frame.height != self.height
            || frame.pixel_format != self.pixel_format
        {
            return Err("NDI-kilden endret videoformat; start previewen på nytt".into());
        }
        if let Some(status) = self
            .child
            .try_wait()
            .map_err(|error| format!("Kontroller FFmpeg: {error}"))?
        {
            return Err(format!("FFmpeg stoppet uventet med status {status}"));
        }
        self.stdin
            .as_mut()
            .ok_or_else(|| "FFmpeg-input er lukket".to_string())?
            .write_all(&frame.data)
            .map_err(|error| format!("Send NDI-frame til FFmpeg: {error}"))
    }

    fn finish(&mut self) {
        self.stdin.take();
        if self.child.wait().is_err() {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}

impl Drop for HlsEncoder {
    fn drop(&mut self) {
        self.finish();
    }
}

fn normalized_frame_rate(frame: &NdiVideoFrame) -> (i32, i32) {
    if frame.frame_rate_n > 0 && frame.frame_rate_d > 0 {
        (frame.frame_rate_n, frame.frame_rate_d)
    } else {
        (30_000, 1_001)
    }
}

fn frame_rate(frame: &NdiVideoFrame) -> f64 {
    let (numerator, denominator) = normalized_frame_rate(frame);
    numerator as f64 / denominator as f64
}

fn prepare_output_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|error| format!("Opprett HLS-mappe: {error}"))?;
    for entry in fs::read_dir(path).map_err(|error| format!("Les HLS-mappe: {error}"))? {
        let entry = entry.map_err(|error| format!("Les HLS-fil: {error}"))?;
        if entry
            .file_type()
            .map(|kind| kind.is_file())
            .unwrap_or(false)
        {
            let entry_path = entry.path();
            let extension = entry_path
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or("");
            if matches!(extension, "m3u8" | "ts" | "m4s" | "tmp") {
                fs::remove_file(entry_path)
                    .map_err(|error| format!("Fjern gammel HLS-fil: {error}"))?;
            }
        }
    }
    Ok(())
}

pub(crate) fn ffmpeg_path() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();
    if let Some(configured) = std::env::var_os("CREATORHUB_FFMPEG") {
        candidates.push(PathBuf::from(configured));
    }
    candidates.extend([
        PathBuf::from("/opt/homebrew/bin/ffmpeg"),
        PathBuf::from("/usr/local/bin/ffmpeg"),
        PathBuf::from("ffmpeg"),
    ]);
    candidates
        .into_iter()
        .find(|candidate| {
            Command::new(candidate)
                .arg("-version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
        })
        .ok_or_else(|| {
            "FFmpeg mangler. Installer FFmpeg med VideoToolbox eller sett CREATORHUB_FFMPEG."
                .to_string()
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::net::TcpStream;
    use std::time::{Duration, Instant};

    #[test]
    fn finds_installed_ffmpeg_with_videotoolbox_build() {
        let Ok(path) = ffmpeg_path() else { return };
        let output = Command::new(path)
            .args(["-hide_banner", "-encoders"])
            .output()
            .unwrap();
        let encoders = String::from_utf8_lossy(&output.stdout);
        assert!(encoders.contains("h264_videotoolbox"));
    }

    #[test]
    fn removes_only_generated_hls_files() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("index.m3u8"), "playlist").unwrap();
        fs::write(dir.path().join("segment_000001.ts"), "segment").unwrap();
        fs::write(dir.path().join("keep.txt"), "keep").unwrap();
        prepare_output_dir(dir.path()).unwrap();
        assert!(!dir.path().join("index.m3u8").exists());
        assert!(!dir.path().join("segment_000001.ts").exists());
        assert!(dir.path().join("keep.txt").exists());
    }

    #[test]
    #[ignore = "requires the official NDI Test Patterns sender to be running"]
    fn live_test_pattern_generates_hls_playlist() {
        let source = ndi_runtime::discover(3_000)
            .expect("discover NDI sources")
            .sources
            .into_iter()
            .find(|source| source.name.contains("Test Patterns"))
            .expect("start NDI Test Patterns before running this smoke test");
        let ffmpeg = ffmpeg_path().expect("ffmpeg");
        let output = bridge_preview::hls_root().join(RUNTIME_SOURCE_ID);
        prepare_output_dir(&output).expect("prepare HLS output");
        let bridge = Arc::new(BridgePreviewState::new_loaded());
        bridge_preview::start(bridge.clone()).expect("Bridge preview server");
        let status = RwLock::new(NdiPreviewStatus::default());
        let stop = Arc::new(AtomicBool::new(false));
        let stop_when_ready = stop.clone();
        let playlist = output.join("index.m3u8");
        let playlist_for_waiter = playlist.clone();
        let waiter = std::thread::spawn(move || {
            let deadline = Instant::now() + Duration::from_secs(15);
            while Instant::now() < deadline && !playlist_for_waiter.is_file() {
                std::thread::sleep(Duration::from_millis(100));
            }
            stop_when_ready.store(true, Ordering::Relaxed);
        });
        run_pipeline(&source, &ffmpeg, &output, &stop, &status, &bridge)
            .expect("NDI to HLS pipeline");
        waiter.join().unwrap();
        let manifest = fs::read_to_string(playlist).expect("generated HLS playlist");
        assert!(manifest.contains("#EXTM3U"));
        assert!(manifest.contains("segment_"));
        let preview_status = status.read().unwrap().clone();
        assert!(preview_status.frames_received > 0);
        let playback_url = preview_status.playback_url.expect("published playback URL");
        let playlist_response = http_get(&playback_url);
        assert!(playlist_response.starts_with(b"HTTP/1.1 200"));
        let segment = manifest
            .lines()
            .find(|line| line.ends_with(".ts"))
            .expect("HLS segment");
        let segment_url = format!("{}/{}", playback_url.rsplit_once('/').unwrap().0, segment);
        let segment_response = http_get(&segment_url);
        assert!(segment_response.starts_with(b"HTTP/1.1 200"));
        assert!(segment_response.len() > 1_000);
    }

    fn http_get(value: &str) -> Vec<u8> {
        let url = url::Url::parse(value).unwrap();
        let mut stream =
            TcpStream::connect((url.host_str().unwrap(), url.port().unwrap())).unwrap();
        write!(
            stream,
            "GET {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
            url.path(),
            url.host_str().unwrap()
        )
        .unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).unwrap();
        response
    }
}

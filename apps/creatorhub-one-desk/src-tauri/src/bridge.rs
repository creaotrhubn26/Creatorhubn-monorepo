//! CreatorHub Bridge capability registry.
//!
//! This module deliberately keeps video transport and device control as
//! separate concepts. OBS WebSocket and the ATEM Switcher SDK can control a
//! production, but neither is treated as a video source. NDI is a transport;
//! the free NDI SDK runtime still has to be installed and distributed under
//! NDI's terms before the Bridge may advertise an NDI preview as ready.

use std::path::{Path, PathBuf};

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Availability {
    Ready,
    RuntimeRequired,
    ToolRequired,
    SdkRequired,
    DeviceRequired,
}

#[derive(Debug, Clone, Serialize)]
pub struct BridgeCapability {
    pub id: &'static str,
    pub label: &'static str,
    pub role: &'static str,
    pub availability: Availability,
    pub local_only: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BridgeStatus {
    pub product_name: &'static str,
    pub local_monitoring_requires_cloud: bool,
    pub video_sources: Vec<BridgeCapability>,
    pub camera_controls: Vec<BridgeCapability>,
    pub production_controls: Vec<BridgeCapability>,
}

pub fn status() -> BridgeStatus {
    let ndi_runtime = crate::ndi_runtime::runtime_path();
    let ndi_ffmpeg = crate::ndi_preview::ffmpeg_path().ok();
    let sony_sdk = configured_runtime("CREATORHUB_SONY_CAMERA_REMOTE_SDK");
    let atem_sdk = configured_runtime("CREATORHUB_ATEM_SDK");

    BridgeStatus {
        product_name: "CreatorHub Bridge",
        local_monitoring_requires_cloud: false,
        video_sources: vec![
            BridgeCapability {
                id: "uvc_ipad",
                label: "USB / UVC",
                role: "video_transport",
                availability: Availability::DeviceRequired,
                local_only: true,
                detail: "Kobles direkte til iPad via AVFoundation; Bridge er ikke i signalveien."
                    .into(),
            },
            BridgeCapability {
                id: "ndi_bridge",
                label: "NDI via Bridge",
                role: "video_transport",
                availability: match (&ndi_runtime, &ndi_ffmpeg) {
                    (Some(_), Some(_)) => Availability::Ready,
                    (None, _) => Availability::RuntimeRequired,
                    (Some(_), None) => Availability::ToolRequired,
                },
                local_only: true,
                detail: match (ndi_runtime, ndi_ffmpeg) {
                    (Some(runtime), Some(ffmpeg)) => format!(
                        "Ekte NDI-mottak og lokal HLS er klare via {} og {}.",
                        runtime.display(),
                        ffmpeg.display()
                    ),
                    (None, _) => "Installer den lisensierte NDI-runtime-en eller sett CREATORHUB_NDI_RUNTIME. Ingen sky-fallback brukes."
                        .into(),
                    (Some(_), None) => "NDI-runtime er installert, men FFmpeg med VideoToolbox mangler. Sett CREATORHUB_FFMPEG eller installer FFmpeg."
                        .into(),
                },
            },
        ],
        camera_controls: vec![
            BridgeCapability {
                id: "canon_ccapi",
                label: "Canon CCAPI",
                role: "camera_control",
                availability: Availability::Ready,
                local_only: true,
                detail: "Native iPad-adapter håndterer tilkobling, direkte live view, still-trigger og kameramedier. Movie-control aktiveres først mot verifisert CCAPI-referanse."
                    .into(),
            },
            BridgeCapability {
                id: "blackmagic_rest",
                label: "Blackmagic Camera REST",
                role: "camera_control",
                availability: Availability::Ready,
                local_only: true,
                detail: "Bridge-adapter for produktinfo, record-status, start/stopp og klippliste via /control/api/v1/."
                    .into(),
            },
            BridgeCapability {
                id: "sony_remote_sdk",
                label: "Sony Camera Remote SDK",
                role: "camera_control",
                availability: if sony_sdk.is_some() {
                    Availability::Ready
                } else {
                    Availability::SdkRequired
                },
                local_only: true,
                detail: sony_sdk
                    .map(|path| format!("Sony SDK konfigurert: {}", path.display()))
                    .unwrap_or_else(|| {
                        "Desktop-SDK og kommersiell tillatelse må installeres før driveren kan lastes."
                            .into()
                    }),
            },
        ],
        production_controls: vec![
            BridgeCapability {
                id: "obs_websocket",
                label: "OBS WebSocket",
                role: "production_control",
                availability: Availability::Ready,
                local_only: true,
                detail: "Autentisert kontroll for scene og recording. OBS WebSocket brukes aldri som videostrøm."
                    .into(),
            },
            BridgeCapability {
                id: "atem_switcher_sdk",
                label: "ATEM Switcher SDK",
                role: "production_control",
                availability: if atem_sdk.is_some() {
                    Availability::Ready
                } else {
                    Availability::SdkRequired
                },
                local_only: true,
                detail: atem_sdk
                    .map(|path| format!("ATEM SDK konfigurert: {}", path.display()))
                    .unwrap_or_else(|| {
                        "ATEM SDK må installeres i Bridge. Videobildet må komme via UVC, NDI eller en annen separat signalvei."
                            .into()
                    }),
            },
        ],
    }
}

fn configured_runtime(variable: &str) -> Option<PathBuf> {
    let value = std::env::var_os(variable)?;
    let path = Path::new(&value);
    if path.exists() {
        Some(path.to_path_buf())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn production_controls_are_not_video_sources() {
        let status = status();
        let source_ids: Vec<_> = status.video_sources.iter().map(|item| item.id).collect();
        assert!(!source_ids.contains(&"obs_websocket"));
        assert!(!source_ids.contains(&"atem_switcher_sdk"));
        assert!(!status.local_monitoring_requires_cloud);
    }

    #[test]
    fn missing_vendor_runtimes_are_reported_instead_of_faked() {
        if crate::ndi_runtime::runtime_path().is_none() {
            let ndi = status()
                .video_sources
                .into_iter()
                .find(|item| item.id == "ndi_bridge")
                .expect("NDI capability");
            assert_eq!(ndi.availability, Availability::RuntimeRequired);
        }
    }
}

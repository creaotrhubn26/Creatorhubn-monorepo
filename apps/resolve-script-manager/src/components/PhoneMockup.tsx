/**
 * PhoneMockup — visualiserer en design-thumbnail i konteksten av en
 * faktisk telefon med korrekte dimensjoner og plattform-UI-safe-zones.
 *
 * Editing skjer inne i mock-en: barna (text/logo-overlays) plasseres
 * inne i skjermområdet, og overlay-en med plattform-UI vises som
 * semi-transparent guide slik at editor ser hva som faktisk er synlig
 * for sluttbrukeren.
 *
 * Device-bezel + cutout (dynamic island / hole-punch) gir realistisk
 * preview-følelse. Editor kan se at "denne tittelen blir spist av
 * action-knappene i Reels" før eksport.
 */

import type { CSSProperties, ReactNode } from "react";
import { DEVICES, PLATFORMS, fitDeviceInContainer } from "../lib/devicePresets";
import type { DeviceId, PlatformId } from "../lib/devicePresets";

interface Props {
  deviceId: DeviceId;
  platformId: PlatformId;
  /** Hvor stor mocken skal være — fyller container-bredden. */
  maxWidth?: number;
  maxHeight?: number;
  /** Innholdet inne i telefon-skjermen (selve design-laget). */
  children: ReactNode;
  /** Vis plattform-UI-overlay (top/bottom-bars, høyre-knapper). Default på. */
  showPlatformUI?: boolean;
  /** Vis safe-area-guides (Apple HIG home indicator + dynamic island). */
  showSafeArea?: boolean;
}

export function PhoneMockup({
  deviceId, platformId, maxWidth = 360, maxHeight = 640,
  children, showPlatformUI = true, showSafeArea = false,
}: Props) {
  const device = DEVICES[deviceId];
  const platform = PLATFORMS[platformId];
  const fit = fitDeviceInContainer(device, maxWidth, maxHeight);
  const { scale } = fit;

  // Tegner SVG-bezel for å få jevn ramme + cutout
  const bezelPx = device.bezel * scale;
  const cornerPx = device.cornerRadius * scale;
  const cutout = device.cutout;
  const cutoutScaled = {
    w: cutout.w * scale,
    h: cutout.h * scale,
    y: cutout.y * scale,
  };

  // Skjerm-bredde og -høyde (innenfor bezel)
  const screenW = fit.deviceW - 2 * bezelPx;
  const screenH = fit.deviceH - 2 * bezelPx;

  // Aspect-ratio av selve content-thumbnailen
  const [aspectW, aspectH] = platform.cssAspect.split("/").map(s => parseFloat(s.trim()));
  const contentAspect = aspectW / aspectH;
  const screenAspect = screenW / screenH;

  // Hvor mye av skjermen fylles av thumbnail-en?
  // Fullscreen content (Reels/Story/TikTok 9:16 ~ matcher device 19.5:9) fyller
  // hele skjermen med små svarte bars hvis aspect ikke matcher.
  // Feed-card vises 80% bredde inne i et "feed-frame".
  let contentW: number, contentH: number;
  let contentX: number, contentY: number;
  if (platform.presentation === "fullscreen") {
    if (contentAspect > screenAspect) {
      contentW = screenW;
      contentH = contentW / contentAspect;
      contentX = 0;
      contentY = (screenH - contentH) / 2;
    } else {
      contentH = screenH;
      contentW = contentH * contentAspect;
      contentX = (screenW - contentW) / 2;
      contentY = 0;
    }
  } else {
    // Feed-card: 90% bredde, sentrert vertikalt
    contentW = screenW * 0.92;
    contentH = contentW / contentAspect;
    contentX = (screenW - contentW) / 2;
    contentY = (screenH - contentH) / 2;
  }

  // Platform-UI-overlay (semi-transparent guide over content-flata).
  // Overlay-prosenter er målt på content-flata (ikke hele skjermen),
  // siden de er en attribute av selve plattformen.
  const overlayTop = platform.uiOverlay.top * contentH;
  const overlayBottom = platform.uiOverlay.bottom * contentH;
  const overlayRight = platform.uiOverlay.right * contentW;

  const deviceFrameStyle: CSSProperties = {
    position: "relative",
    width: fit.deviceW,
    height: fit.deviceH,
    borderRadius: cornerPx + bezelPx,
    background: "#0a0a0f",
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.06), " +
      "0 30px 60px -20px rgba(0,0,0,0.7), " +
      "inset 0 0 0 1px rgba(255,255,255,0.02)",
    padding: bezelPx,
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Telefon-frame */}
      <div style={deviceFrameStyle}>
        {/* Skjerm-flate */}
        <div
          style={{
            position: "relative",
            width: screenW, height: screenH,
            borderRadius: cornerPx,
            overflow: "hidden",
            background: platform.presentation === "fullscreen" ? "#000" : "#fafafa",
          }}
        >
          {/* Content-area */}
          <div
            style={{
              position: "absolute",
              left: contentX, top: contentY,
              width: contentW, height: contentH,
              overflow: "hidden",
            }}
            data-thumbnail-canvas="true"
          >
            {children}
          </div>

          {/* Plattform-UI-overlay */}
          {showPlatformUI && platform.presentation === "fullscreen" && (
            <PlatformUIOverlay
              platformId={platformId}
              contentX={contentX} contentY={contentY}
              contentW={contentW} contentH={contentH}
              overlayTop={overlayTop} overlayBottom={overlayBottom}
              overlayRight={overlayRight}
              scale={scale}
            />
          )}
          {showPlatformUI && platform.presentation === "feed-card" && (
            <FeedCardUIOverlay
              platformId={platformId}
              contentX={contentX} contentY={contentY}
              contentW={contentW} contentH={contentH}
              screenW={screenW} screenH={screenH}
              scale={scale}
            />
          )}

          {/* Safe-area-guides (Apple HIG) */}
          {showSafeArea && device.safeArea.top > 0 && (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: device.safeArea.top * scale,
              borderBottom: "1px dashed rgba(255,80,200,0.45)",
              background: "linear-gradient(rgba(255,80,200,0.10), transparent)",
              pointerEvents: "none",
            }} />
          )}
          {showSafeArea && device.safeArea.bottom > 0 && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: device.safeArea.bottom * scale,
              borderTop: "1px dashed rgba(255,80,200,0.45)",
              background: "linear-gradient(transparent, rgba(255,80,200,0.10))",
              pointerEvents: "none",
            }} />
          )}

          {/* Cutout (dynamic-island / notch / hole-punch) */}
          {cutout.type === "dynamic-island" && (
            <div style={{
              position: "absolute",
              top: cutoutScaled.y,
              left: "50%", transform: "translateX(-50%)",
              width: cutoutScaled.w, height: cutoutScaled.h,
              background: "#000",
              borderRadius: cutoutScaled.h / 2,
              zIndex: 10,
            }} />
          )}
          {cutout.type === "notch" && (
            <div style={{
              position: "absolute", top: 0,
              left: "50%", transform: "translateX(-50%)",
              width: cutoutScaled.w, height: cutoutScaled.h,
              background: "#000",
              borderRadius: "0 0 18px 18px",
              zIndex: 10,
            }} />
          )}
          {cutout.type === "hole-punch" && (
            <div style={{
              position: "absolute",
              top: cutoutScaled.y,
              left: "50%", transform: "translateX(-50%)",
              width: cutoutScaled.w, height: cutoutScaled.h,
              background: "#000",
              borderRadius: "50%",
              zIndex: 10,
            }} />
          )}

          {/* Home indicator (Face-ID phones) */}
          {device.safeArea.bottom >= 30 && (
            <div style={{
              position: "absolute",
              bottom: 8 * scale, left: "50%",
              transform: "translateX(-50%)",
              width: 134 * scale, height: 5 * scale,
              background: platform.presentation === "fullscreen"
                ? "rgba(255,255,255,0.85)" : "rgba(20,20,30,0.85)",
              borderRadius: 3 * scale,
              zIndex: 11,
            }} />
          )}
        </div>
      </div>

      {/* Device/plattform-info under */}
      <div style={{
        marginTop: 14, textAlign: "center",
        fontSize: 11, color: "var(--text-3)",
      }}>
        <div style={{ fontWeight: 600, color: "var(--text-2)", marginBottom: 2 }}>
          {device.name} · {platform.name}
        </div>
        <div>
          Eksport: {platform.exportPx.w}×{platform.exportPx.h} px
          {" · "}device-screen: {device.pointSize.w}×{device.pointSize.h} pt
        </div>
      </div>
    </div>
  );
}

interface OverlayProps {
  platformId: PlatformId;
  contentX: number; contentY: number;
  contentW: number; contentH: number;
  overlayTop: number; overlayBottom: number; overlayRight: number;
  scale: number;
}

function PlatformUIOverlay({
  platformId, contentX, contentY, contentW, contentH,
  overlayTop, overlayBottom, overlayRight, scale,
}: OverlayProps) {
  const t = "rgba(255,255,255,0.85)";
  // Plattform-spesifikk overlay-rendering
  switch (platformId) {
    case "instagram-reels": {
      return (
        <>
          {/* Top: profil-rad */}
          <div style={{
            position: "absolute",
            left: contentX, top: contentY,
            width: contentW, height: overlayTop,
            background: "linear-gradient(rgba(0,0,0,0.45), transparent)",
            display: "flex", alignItems: "center", padding: 8 * scale,
            color: t, fontSize: 9 * scale, fontWeight: 600,
            pointerEvents: "none",
          }}>
            <div style={{
              width: 24 * scale, height: 24 * scale, borderRadius: "50%",
              background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366)",
            }} />
            <div style={{ marginLeft: 6 * scale }}>brukernavn · Følg</div>
          </div>
          {/* Right side: action-knapper */}
          <div style={{
            position: "absolute",
            right: contentX, top: contentY + contentH * 0.4,
            width: overlayRight, height: contentH * 0.5,
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "space-around",
            color: t, fontSize: 9 * scale, fontWeight: 600,
            pointerEvents: "none",
          }}>
            {["♡", "💬", "↗", "⋯"].map((g, i) => (
              <div key={i} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}>
                <div style={{ fontSize: 22 * scale }}>{g}</div>
                <div>{["12k", "234", "Del", ""][i]}</div>
              </div>
            ))}
          </div>
          {/* Bottom: caption + nav */}
          <div style={{
            position: "absolute",
            left: contentX, bottom: -contentY,
            width: contentW, height: overlayBottom,
            background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
            padding: 10 * scale, color: t,
            fontSize: 10 * scale, lineHeight: 1.3,
            pointerEvents: "none",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
          }}>
            <div style={{ marginBottom: 4 * scale }}>
              Caption … <span style={{ opacity: 0.7 }}>se mer</span>
            </div>
            <div style={{ opacity: 0.8, fontSize: 9 * scale }}>♪ Original lyd · brukernavn</div>
          </div>
        </>
      );
    }
    case "tiktok": {
      return (
        <>
          <div style={{
            position: "absolute", left: contentX, top: contentY,
            width: contentW, height: overlayTop,
            display: "flex", justifyContent: "center", alignItems: "center",
            color: t, fontSize: 10 * scale, fontWeight: 700,
            background: "linear-gradient(rgba(0,0,0,0.35), transparent)",
            gap: 14 * scale, pointerEvents: "none",
          }}>
            <span style={{ opacity: 0.6 }}>Følger</span>
            <span style={{ borderBottom: `2px solid ${t}`, paddingBottom: 2 * scale }}>For deg</span>
          </div>
          <div style={{
            position: "absolute", right: contentX, top: contentY + contentH * 0.3,
            width: overlayRight, height: contentH * 0.6,
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "space-around",
            color: t, fontSize: 9 * scale, fontWeight: 600,
            textAlign: "center", pointerEvents: "none",
          }}>
            <div style={{
              width: 36 * scale, height: 36 * scale, borderRadius: "50%",
              background: "#fe2c55", border: `2px solid ${t}`,
            }} />
            {["♥", "💬", "🔖", "↗"].map((g, i) => (
              <div key={i} style={{
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                fontSize: 22 * scale,
              }}>{g}</div>
            ))}
          </div>
          <div style={{
            position: "absolute", left: contentX, bottom: -contentY,
            width: contentW, height: overlayBottom,
            background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
            padding: 10 * scale, color: t,
            fontSize: 10 * scale,
            pointerEvents: "none",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
          }}>
            <div style={{ fontWeight: 700 }}>@brukernavn</div>
            <div style={{ marginTop: 2 * scale }}>Caption-tekst …</div>
            <div style={{ marginTop: 6 * scale, opacity: 0.85, fontSize: 9 * scale }}>
              ♪ trending sound · brukernavn
            </div>
          </div>
        </>
      );
    }
    case "instagram-story": {
      return (
        <>
          <div style={{
            position: "absolute", left: contentX, top: contentY,
            width: contentW, height: overlayTop,
            padding: 6 * scale, pointerEvents: "none",
            display: "flex", flexDirection: "column", gap: 4 * scale,
          }}>
            <div style={{ display: "flex", gap: 3 * scale }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  flex: 1, height: 2 * scale,
                  background: i === 1 ? t : "rgba(255,255,255,0.35)",
                  borderRadius: 1,
                }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center",
                            color: t, fontSize: 9 * scale, fontWeight: 600 }}>
              <div style={{
                width: 22 * scale, height: 22 * scale, borderRadius: "50%",
                background: "linear-gradient(45deg, #f09433, #cc2366)",
              }} />
              <span style={{ marginLeft: 6 * scale }}>brukernavn · 2t</span>
            </div>
          </div>
          <div style={{
            position: "absolute", left: contentX, bottom: -contentY,
            width: contentW, height: overlayBottom,
            padding: 8 * scale, pointerEvents: "none",
            display: "flex", alignItems: "center", gap: 6 * scale,
          }}>
            <div style={{
              flex: 1, height: 28 * scale, borderRadius: 14 * scale,
              border: `1px solid ${t}`, color: t,
              padding: `0 ${10 * scale}px`,
              display: "flex", alignItems: "center",
              fontSize: 10 * scale, opacity: 0.85,
            }}>Send melding</div>
            <div style={{ color: t, fontSize: 20 * scale }}>♡</div>
            <div style={{ color: t, fontSize: 20 * scale }}>↗</div>
          </div>
        </>
      );
    }
    case "youtube-shorts": {
      return (
        <>
          <div style={{
            position: "absolute", left: contentX, top: contentY,
            width: contentW, height: overlayTop,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: `0 ${8 * scale}px`, color: t, fontSize: 11 * scale, fontWeight: 700,
            background: "linear-gradient(rgba(0,0,0,0.35), transparent)",
            pointerEvents: "none",
          }}>
            <span>Shorts</span>
            <span style={{ fontSize: 14 * scale }}>🔍 ⋯</span>
          </div>
          <div style={{
            position: "absolute", right: contentX, top: contentY + contentH * 0.35,
            width: overlayRight, height: contentH * 0.55,
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "space-around",
            color: t, fontSize: 9 * scale, fontWeight: 600,
            pointerEvents: "none",
          }}>
            {["👍", "👎", "💬", "↗"].map((g, i) => (
              <div key={i} style={{
                fontSize: 18 * scale,
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}>{g}</div>
            ))}
          </div>
          <div style={{
            position: "absolute", left: contentX, bottom: -contentY,
            width: contentW, height: overlayBottom,
            padding: 8 * scale, color: t,
            background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
            pointerEvents: "none",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            fontSize: 10 * scale,
          }}>
            <div>@kanal</div>
            <div style={{ marginTop: 2 * scale }}>Caption …</div>
          </div>
        </>
      );
    }
    default:
      return null;
  }
}

function FeedCardUIOverlay({
  platformId, contentX, contentY, contentW, contentH,
  screenW, screenH, scale,
}: {
  platformId: PlatformId;
  contentX: number; contentY: number;
  contentW: number; contentH: number;
  screenW: number; screenH: number;
  scale: number;
}) {
  // Feed-card: viser plattform-skall rundt content med navn over og UI under
  const headerH = 44 * scale;
  const footerH = 60 * scale;

  if (platformId === "youtube-thumbnail") {
    return (
      <>
        {/* Duration pill bottom-right (typisk YouTube overlay) */}
        <div style={{
          position: "absolute",
          right: contentX + 8 * scale,
          bottom: screenH - (contentY + contentH) + 8 * scale,
          padding: `${2 * scale}px ${6 * scale}px`,
          background: "rgba(0,0,0,0.85)", color: "#fff",
          fontSize: 10 * scale, fontWeight: 600, borderRadius: 3,
          pointerEvents: "none",
        }}>3:24</div>
        {/* Title-mock under thumbnail */}
        <div style={{
          position: "absolute",
          left: contentX, top: contentY + contentH + 8 * scale,
          width: contentW, color: "var(--text-1, #ddd)",
          fontSize: 11 * scale, fontWeight: 700, lineHeight: 1.3,
          pointerEvents: "none",
        }}>
          Video-tittelen vises her under thumbnailen
        </div>
      </>
    );
  }

  // IG/LinkedIn feed-card: header + footer skall
  return (
    <>
      <div style={{
        position: "absolute",
        left: contentX, top: contentY - headerH,
        width: contentW, height: headerH,
        display: "flex", alignItems: "center", padding: `0 ${8 * scale}px`,
        background: "#fff", color: "#14141e",
        fontSize: 10 * scale, fontWeight: 600,
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        pointerEvents: "none",
      }}>
        <div style={{
          width: 26 * scale, height: 26 * scale, borderRadius: "50%",
          background: "linear-gradient(45deg, #f09433, #cc2366)",
        }} />
        <span style={{ marginLeft: 6 * scale }}>brukernavn</span>
        <span style={{ marginLeft: "auto", opacity: 0.5 }}>⋯</span>
      </div>
      <div style={{
        position: "absolute",
        left: contentX, top: contentY + contentH,
        width: contentW, height: footerH,
        padding: 8 * scale, background: "#fff", color: "#14141e",
        fontSize: 11 * scale, lineHeight: 1.3,
        pointerEvents: "none",
      }}>
        <div style={{ display: "flex", gap: 10 * scale, fontSize: 18 * scale }}>
          ♡ 💬 ↗
        </div>
        <div style={{ marginTop: 4 * scale, fontSize: 10 * scale }}>
          234 likerklikk · <span style={{ opacity: 0.6 }}>brukernavn</span> caption…
        </div>
      </div>
    </>
  );
}

export default PhoneMockup;

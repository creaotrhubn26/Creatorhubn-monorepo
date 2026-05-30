/**
 * MarketingPreviewUploadDialog — Bjarne velger en marketing-plan-post
 * og laster opp et proxy-rendret klipp som klienten ser direkte i
 * sin client-portal.
 *
 * Backend velger pipeline:
 *   - Cloudflare Stream (HLS + auto-thumbnail) hvis konfigurert
 *   - R2 (rå mp4 + signed URL) som fallback
 *
 * UI-flyt:
 *   1. Liste over posts i prosjektet (klikk for å velge)
 *   2. Velg lokal video-fil
 *   3. Upload — backend håndterer pipeline
 *   4. Hvis Stream: poll ready-state (3 sek interval) til transcoding
 *      er ferdig. Vis "klar for klient" når ready=true.
 */

import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  marketingPreviewVideoService,
  type MarketingPreviewPost,
  type PreviewUploadResult,
} from "../services/marketingPreviewVideoService";
import { IconX, IconCheck, IconSparkle } from "./Icons";

interface Props {
  projectId: string;
  onClose: () => void;
}

export function MarketingPreviewUploadDialog({ projectId, onClose }: Props) {
  const [posts, setPosts] = useState<MarketingPreviewPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<PreviewUploadResult | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Last posts ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await marketingPreviewVideoService.listPosts(projectId);
        if (cancelled) return;
        setPosts(list);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setLoadingPosts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── Poll Stream ready-state ────────────────────────────────────────
  useEffect(() => {
    if (!uploadResult || uploadResult.pipeline !== "cloudflare-stream") return;
    if (uploadResult.ready) {
      setStreamReady(true);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await marketingPreviewVideoService.pollStatus(uploadResult.postId);
        if (cancelled) return;
        if (s.ready) setStreamReady(true);
      } catch { /* ignore — vil retrye */ }
    };
    const id = window.setInterval(tick, 3000);
    void tick();
    return () => { cancelled = true; clearInterval(id); };
  }, [uploadResult]);

  const handlePickFile = useCallback(async () => {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mp4", "mov", "webm", "mkv"] }],
    });
    if (typeof path === "string") setFilePath(path);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedPostId || !filePath) return;
    setUploading(true);
    setError(null);
    try {
      const result = await marketingPreviewVideoService.uploadFromFile({
        postId: selectedPostId,
        filePath,
      });
      setUploadResult(result);
      if (result.pipeline === "r2" || (result.pipeline === "cloudflare-stream" && result.ready)) {
        setStreamReady(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }, [selectedPostId, filePath]);

  const selectedPost = posts.find(p => p.id === selectedPostId);
  const canUpload = !!selectedPostId && !!filePath && !uploading && !uploadResult;

  return (
    <div style={overlaySx}>
      <div style={dialogSx}>
        <div style={headerSx}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconSparkle size={20} />
            <h2 style={titleSx}>Send preview til klient</h2>
          </div>
          <button onClick={onClose} style={closeBtnSx} title="Lukk">
            <IconX size={18} />
          </button>
        </div>

        <p style={leadSx}>
          Velg post fra markedsplanen, plukk en proxy-render (helst 720p H.264),
          så ser klienten den direkte i portalen sin.
        </p>

        {/* ── Steg 1: velg post ───────────────────────────────────── */}
        <div style={sectionSx}>
          <div style={sectionLabelSx}>1. Velg post</div>
          {loadingPosts && <div style={mutedSx}>Laster posts …</div>}
          {loadError && <div style={errorSx}>{loadError}</div>}
          {!loadingPosts && !loadError && posts.length === 0 && (
            <div style={mutedSx}>Ingen aktive marketing-plan-posts på dette prosjektet.</div>
          )}
          {posts.length > 0 && (
            <div style={postListSx}>
              {posts.map(p => (
                <button key={p.id}
                        onClick={() => setSelectedPostId(p.id)}
                        style={{
                          ...postBtnSx,
                          borderColor: selectedPostId === p.id
                            ? "rgba(160,48,192,0.6)" : "rgba(160,48,192,0.18)",
                          background: selectedPostId === p.id
                            ? "rgba(160,48,192,0.14)" : "rgba(20,12,40,0.4)",
                        }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={dayChipSx}>
                      {p.dayOffset !== null ? `D${p.dayOffset + 1}` : "—"}
                    </span>
                    <span style={formatChipSx}>{p.format}</span>
                    {p.hasPreview && (
                      <span style={previewChipSx}>
                        Preview lastet opp
                      </span>
                    )}
                  </div>
                  <div style={hookSx}>{p.hook}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Steg 2: velg fil ────────────────────────────────────── */}
        {selectedPostId && !uploadResult && (
          <div style={sectionSx}>
            <div style={sectionLabelSx}>2. Velg proxy-fil</div>
            <button onClick={handlePickFile} style={fileBtnSx}>
              {filePath ? filePath.split(/[/\\]/).pop() : "Velg video …"}
            </button>
            {filePath && (
              <div style={mutedSx}>{filePath}</div>
            )}
          </div>
        )}

        {/* ── Steg 3: upload ──────────────────────────────────────── */}
        {selectedPostId && filePath && !uploadResult && (
          <div style={sectionSx}>
            <button onClick={handleUpload}
                    disabled={!canUpload}
                    style={{
                      ...primaryBtnSx,
                      opacity: canUpload ? 1 : 0.4,
                      cursor: canUpload ? "pointer" : "not-allowed",
                    }}>
              {uploading ? "Laster opp …" : "Send til klient"}
            </button>
          </div>
        )}

        {/* ── Resultat ────────────────────────────────────────────── */}
        {uploadResult && (
          <div style={resultSx}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <IconCheck size={20} />
              <strong>Opplasting fullført</strong>
            </div>
            {uploadResult.pipeline === "cloudflare-stream" ? (
              <div>
                <div style={mutedSx}>Pipeline: Cloudflare Stream (HLS, adaptive)</div>
                <div style={mutedSx}>
                  Stream-status: {streamReady
                    ? "Klar — klient kan spille av nå"
                    : "Behandles … (transcoding)"}
                </div>
              </div>
            ) : (
              <div style={mutedSx}>
                Pipeline: R2 (rå mp4) · {(uploadResult.bytes / 1024 / 1024).toFixed(1)} MB
              </div>
            )}
            <div style={mutedSx}>
              {selectedPost?.hook && `Posten: "${selectedPost.hook.slice(0, 60)}…"`}
            </div>
          </div>
        )}

        {error && <div style={errorSx}>{error}</div>}

        <div style={footerSx}>
          <button onClick={onClose} style={secondaryBtnSx}>
            {uploadResult ? "Lukk" : "Avbryt"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────── Styling — Role Room dark-lilla brand ──────────

const overlaySx: React.CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.72)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000,
};

const dialogSx: React.CSSProperties = {
  background: "linear-gradient(180deg, #1a0f2e 0%, #14092a 100%)",
  border: "1px solid rgba(160,48,192,0.32)",
  borderRadius: 8,
  padding: 24,
  width: 560,
  maxWidth: "90vw",
  maxHeight: "85vh",
  overflowY: "auto",
  color: "rgba(232,224,240,0.95)",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const headerSx: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  marginBottom: 8,
};

const titleSx: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, margin: 0,
};

const leadSx: React.CSSProperties = {
  fontSize: 13, color: "rgba(200,188,216,0.85)",
  margin: "0 0 16px", lineHeight: 1.5,
};

const closeBtnSx: React.CSSProperties = {
  background: "transparent", border: 0, color: "rgba(200,188,216,0.75)",
  cursor: "pointer", padding: 4,
};

const sectionSx: React.CSSProperties = { marginBottom: 16 };

const sectionLabelSx: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "#a030c0", marginBottom: 8,
};

const postListSx: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
  maxHeight: 240, overflowY: "auto",
};

const postBtnSx: React.CSSProperties = {
  textAlign: "left", padding: "8px 10px",
  border: "1px solid", borderRadius: 4,
  color: "inherit", cursor: "pointer",
  font: "inherit", fontSize: 12,
};

const dayChipSx: React.CSSProperties = {
  background: "rgba(160,48,192,0.20)", color: "#c8a8e8",
  padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700,
};

const formatChipSx: React.CSSProperties = {
  background: "rgba(74,212,138,0.18)", color: "#4ad48a",
  padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600,
};

const previewChipSx: React.CSSProperties = {
  background: "rgba(240,165,0,0.20)", color: "#f0a500",
  padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600,
  marginLeft: "auto",
};

const hookSx: React.CSSProperties = {
  marginTop: 4, fontSize: 12.5, lineHeight: 1.4,
  color: "rgba(232,224,240,0.92)",
};

const fileBtnSx: React.CSSProperties = {
  background: "rgba(20,12,40,0.6)",
  border: "1px dashed rgba(160,48,192,0.40)",
  color: "rgba(232,224,240,0.95)",
  padding: "10px 14px", borderRadius: 4, width: "100%",
  cursor: "pointer", fontSize: 13,
};

const primaryBtnSx: React.CSSProperties = {
  background: "linear-gradient(135deg, #6e3fc7, #a030c0)",
  border: 0, color: "#fff",
  padding: "10px 18px", fontSize: 14, fontWeight: 700,
  borderRadius: 4, width: "100%",
};

const secondaryBtnSx: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(160,48,192,0.32)",
  color: "rgba(232,224,240,0.85)",
  padding: "8px 16px", fontSize: 13, fontWeight: 600,
  borderRadius: 4, cursor: "pointer",
};

const mutedSx: React.CSSProperties = {
  fontSize: 11, color: "rgba(168,156,184,0.75)",
  marginTop: 4,
};

const errorSx: React.CSSProperties = {
  padding: 8, borderRadius: 4,
  background: "rgba(239,79,111,0.12)",
  border: "1px solid rgba(239,79,111,0.30)",
  color: "#ef4f6f", fontSize: 12, marginTop: 8,
};

const resultSx: React.CSSProperties = {
  padding: 12, borderRadius: 4,
  background: "rgba(74,212,138,0.08)",
  border: "1px solid rgba(74,212,138,0.30)",
  marginBottom: 16,
};

const footerSx: React.CSSProperties = {
  display: "flex", justifyContent: "flex-end",
  gap: 8, marginTop: 16, paddingTop: 12,
  borderTop: "1px solid rgba(160,48,192,0.18)",
};

export default MarketingPreviewUploadDialog;

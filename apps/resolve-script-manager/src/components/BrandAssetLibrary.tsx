/**
 * BrandAssetLibrary — bibliotek av logoer/icons/overlays per prosjekt.
 * Brukes inne i Thumbnail Creator (og senere Creative Editor) for å
 * laste opp + pick assets uten å hard-kode URLer.
 *
 * Bibliotek er prosjekt-scope: hvert prosjekt har sitt eget bibliotek
 * (matcher hvordan brand-snapshot fungerer i feed-plan). Hvis du
 * jobber på tvers av prosjekter for samme kunde, må du laste opp i
 * begge — V1-trade-off, kan deles via team-scope senere.
 */

import { useEffect, useRef, useState } from "react";
import {
  brandAssetsService, fileToDataUrl,
} from "../services/brandAssetsService";
import type { BrandAsset, BrandAssetKind } from "../services/brandAssetsService";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  kind: BrandAssetKind;
  /** Når bruker velger en asset, returneres dens dataUrl. */
  onPick: (asset: BrandAsset) => void;
  /** For label-konsistens. */
  accentColor?: string;
}

const KIND_LABELS: Record<BrandAssetKind, string> = {
  logo: "Logoer",
  icon: "Icons",
  overlay: "Overlays",
  "template-bg": "Template-bakgrunner",
};

export function BrandAssetLibrary({
  open, onClose, projectId, kind, onPick, accentColor = "#a030c0",
}: Props) {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    brandAssetsService.list(projectId, kind)
      .then(a => { if (!cancelled) setAssets(a); })
      .catch(e => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, projectId, kind]);

  const refresh = async () => {
    setLoading(true);
    try {
      setAssets(await brandAssetsService.list(projectId, kind));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      // Cap 1 MB klient-side så vi får tydelig feilmelding før backend
      // returnerer 413
      if (file.size > 1_000_000) {
        throw new Error(
          `Filen er ${(file.size / 1024).toFixed(0)} KB — max 1000 KB. ` +
          `Reduser oppløsningen eller bytt format (PNG → WebP).`,
        );
      }
      const dataUrl = await fileToDataUrl(file);
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Untitled";
      await brandAssetsService.upload({
        projectId, kind, name, dataUrl,
        sourceFilename: file.name,
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Slett denne asseten? Den fjernes fra biblioteket permanent.")) {
      return;
    }
    try {
      await brandAssetsService.delete(id);
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 6500,
        background: "rgba(8,4,20,0.85)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(800px, 92vw)",
          maxHeight: "85vh",
          background: "linear-gradient(180deg, #1a0d45 0%, #0a0518 100%)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          display: "flex", flexDirection: "column",
          color: "var(--text-1)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {KIND_LABELS[kind]} · prosjekt-bibliotek
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
              Last opp én gang, gjenbruk på alle thumbnails i prosjektet
            </div>
          </div>
          <button onClick={onClose}
                  style={{ background: "transparent", border: 0, color: "var(--text-2)",
                            cursor: "pointer", padding: 4,
                            display: "inline-flex", alignItems: "center",
                            justifyContent: "center" }}>
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: "10px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <input ref={fileInputRef}
                 type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                 onChange={e => {
                   const f = e.target.files?.[0];
                   if (f) void handleFileUpload(f);
                 }}
                 style={{ display: "none" }} />
          <button onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    background: uploading ? "var(--bg-2)" : accentColor,
                    color: "#fff", border: 0, borderRadius: 4,
                    padding: "7px 14px", fontSize: 12, fontWeight: 600,
                    cursor: uploading ? "wait" : "pointer",
                  }}>
            {uploading ? "Laster opp…" : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <AddIcon sx={{ fontSize: 14 }} /> Last opp
              </span>
            )}
          </button>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            PNG / JPG / SVG / WebP · max 1 MB
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }}>
            {assets.length} {assets.length === 1 ? "asset" : "assets"}
          </span>
        </div>

        {error && (
          <div style={{
            margin: "10px 18px", padding: 8, borderRadius: 4,
            background: "rgba(239,79,111,0.10)", color: "#ef4f6f",
            fontSize: 11,
          }}>{error}</div>
        )}

        {/* Grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {loading && assets.length === 0 && (
            <div style={{ textAlign: "center", padding: 40,
                            fontSize: 12, color: "var(--text-3)" }}>
              Laster bibliotek …
            </div>
          )}
          {!loading && assets.length === 0 && (
            <div style={{ textAlign: "center", padding: 40,
                            fontSize: 12, color: "var(--text-3)" }}>
              Ingen {KIND_LABELS[kind].toLowerCase()} i prosjekt-biblioteket enda
              <div style={{ marginTop: 8, fontSize: 11, opacity: 0.8 }}>
                Last opp første nå →
              </div>
            </div>
          )}
          {assets.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
            }}>
              {assets.map(a => (
                <div key={a.id} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6, overflow: "hidden",
                  position: "relative",
                }}>
                  <button
                    onClick={() => { onPick(a); onClose(); }}
                    title={`Bruk ${a.name}`}
                    style={{
                      display: "block", width: "100%",
                      aspectRatio: "1 / 1",
                      background:
                        // Sjakk-mønster så transparens vises
                        "repeating-conic-gradient(#1a1a25 0% 25%, #14141e 0% 50%)" +
                        " 50% / 16px 16px",
                      border: 0, padding: 8, cursor: "pointer",
                    }}>
                    <img src={a.dataUrl}
                         alt={a.name}
                         style={{ maxWidth: "100%", maxHeight: "100%",
                                   objectFit: "contain", display: "block",
                                   margin: "auto" }} />
                  </button>
                  <div style={{
                    padding: "6px 8px", fontSize: 10.5,
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 4,
                  }}>
                    <div style={{
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", flex: 1,
                      color: "var(--text-2)",
                    }} title={a.name}>{a.name}</div>
                    <button
                      onClick={() => void handleDelete(a.id)}
                      title="Slett fra biblioteket"
                      style={{
                        background: "transparent", border: 0,
                        color: "var(--text-3)", cursor: "pointer",
                        padding: 0, lineHeight: 1,
                        display: "inline-flex", alignItems: "center",
                      }}>
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </button>
                  </div>
                  {a.widthPx && a.heightPx && (
                    <div style={{ position: "absolute", top: 4, right: 4,
                                    background: "rgba(0,0,0,0.65)",
                                    color: "#fff", fontSize: 9, padding: "1px 4px",
                                    borderRadius: 3 }}>
                      {a.widthPx}×{a.heightPx}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BrandAssetLibrary;

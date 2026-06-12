/**
 * UpdaterDialog — pen modal for Tauri auto-updater-flyten.
 *
 * Erstatter window.alert/confirm med en proper dialog som viser:
 *   1. Versjon + release-notes (om tilgjengelig)
 *   2. Progress-bar mens nedlasting + installasjon kjører
 *   3. "Installert"-tilstand med restart-prompt
 *
 * Bruker eksisterende modal-pattern fra MagicCutDialog/RoleRoomSignInDialog.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { IconSparkle, IconX } from "./Icons";

type UpdaterStage = "available" | "downloading" | "installed" | "error";

interface Props {
  version: string;
  notes: string | null;
  /** Starter download. Callback får progress (0..1) eller -1 ved ferdig. */
  onDownload: (onProgress: (fraction: number, status: "downloading" | "finished") => void) => Promise<void>;
  onDismiss: () => void;
}

export function UpdaterDialog({ version, notes, onDownload, onDismiss }: Props) {
  const [stage, setStage] = useState<UpdaterStage>("available");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const downloadRef = useRef<Promise<void> | null>(null);

  const handleDownload = useCallback(() => {
    if (downloadRef.current) return;
    setStage("downloading");
    setProgress(0);
    setError(null);
    downloadRef.current = onDownload((fraction, status) => {
      setProgress(fraction);
      if (status === "finished") {
        setStage("installed");
      }
    }).catch((err) => {
      setStage("error");
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [onDownload]);

  // Auto-close after 8s on "installed" if user does nothing (the version is
  // already on disk; restart can happen later).
  useEffect(() => {
    if (stage !== "installed") return;
    const timer = window.setTimeout(() => onDismiss(), 8000);
    return () => window.clearTimeout(timer);
  }, [stage, onDismiss]);

  const closeable = stage === "available" || stage === "installed" || stage === "error";

  return (
    <div className="modal-backdrop" onClick={closeable ? onDismiss : undefined}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 460, maxWidth: "92vw" }}
      >
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <IconSparkle /> Oppdatering tilgjengelig
        </h2>
        {closeable && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Lukk"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-2)",
              padding: 6,
            }}
          >
            <IconX />
          </button>
        )}

        {stage === "available" && (
          <>
            <div className="desc" style={{ marginTop: 12 }}>
              Post Agent <strong>v{version}</strong> er klar.
            </div>
            {notes && (
              <>
              <div style={{ marginTop: 14, marginBottom: 6, fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: "var(--text-3)" }}>Hva er nytt</div>
              <div
                style={{
                  padding: 12,
                  background: "var(--bg-3)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--text-2)",
                  maxHeight: 180,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {notes}
              </div>
              </>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" className="btn-ghost" onClick={onDismiss}>
                Senere
              </button>
              <button type="button" className="btn-primary" onClick={handleDownload}>
                Last ned og installer
              </button>
            </div>
          </>
        )}

        {stage === "downloading" && (
          <>
            <div className="desc" style={{ marginTop: 12 }}>
              Laster ned v{version}…
            </div>
            <div
              style={{
                marginTop: 16,
                height: 8,
                width: "100%",
                background: "var(--bg-3)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(progress * 100)}%`,
                  background: "var(--accent)",
                  transition: "width 200ms ease",
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-2)" }}>
              {Math.round(progress * 100)}%
            </div>
          </>
        )}

        {stage === "installed" && (
          <>
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: "rgba(74, 212, 138, 0.1)",
                border: "1px solid #4ad48a",
                borderRadius: 8,
                color: "#4ad48a",
                fontWeight: 500,
              }}
            >
              v{version} er installert. Lukk Post Agent (⌘Q) og åpne den på nytt for å aktivere.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" className="btn-primary" onClick={onDismiss}>
                Forstått
              </button>
            </div>
          </>
        )}

        {stage === "error" && (
          <>
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: "rgba(239, 79, 111, 0.1)",
                border: "1px solid #ef4f6f",
                borderRadius: 8,
                color: "#ef4f6f",
              }}
            >
              {error || "Kunne ikke laste ned oppdateringen."}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" className="btn-primary" onClick={onDismiss}>
                Lukk
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default UpdaterDialog;

import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  executeScript,
  listWatchedFolders,
  onFolderClipsAdded,
  startWatchingFolder,
  stopWatchingFolder,
  type WatchedFolder,
} from "../api";
import { IconCheck } from "./Icons";

interface Props {
  onClose: () => void;
}

interface RecentBatch {
  folder: string;
  timestamp: number;
  clipCount: number;
  imported: boolean;
}

export function WatchFolderModal({ onClose }: Props) {
  const [watched, setWatched] = useState<WatchedFolder[]>([]);
  const [recent, setRecent] = useState<RecentBatch[]>([]);
  const [autoImport, setAutoImport] = useState<boolean>(() => {
    return localStorage.getItem("trrpa.autoImportOnWatch") === "true";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listWatchedFolders();
      setWatched(list);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    let unlisten: (() => void) | null = null;
    onFolderClipsAdded((event) => {
      const batch: RecentBatch = {
        folder: event.folder,
        timestamp: Date.now(),
        clipCount: event.newClips.length,
        imported: false,
      };
      setRecent((prev) => [batch, ...prev].slice(0, 20));
      void refresh();
      // Auto-import if enabled
      if (localStorage.getItem("trrpa.autoImportOnWatch") === "true") {
        // Use the folder containing the first new clip as the import source
        const firstClip = event.newClips[0];
        if (firstClip) {
          const parentDir = firstClip.substring(0, firstClip.lastIndexOf("/"));
          executeScript("import_media_from_folder", { mediaFolderPath: parentDir }, false)
            .then(() => {
              setRecent((prev) =>
                prev.map((r) =>
                  r.timestamp === batch.timestamp ? { ...r, imported: true } : r,
                ),
              );
            })
            .catch((e) => setError(`Auto-import failed: ${e}`));
        }
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, [refresh]);

  const handlePickFolder = useCallback(async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked !== "string") return;
      setBusy(true);
      setError(null);
      await startWatchingFolder(picked);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const handleStop = useCallback(
    async (path: string) => {
      try {
        setBusy(true);
        await stopWatchingFolder(path);
        await refresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const toggleAutoImport = useCallback(() => {
    const next = !autoImport;
    setAutoImport(next);
    localStorage.setItem("trrpa.autoImportOnWatch", next ? "true" : "false");
  }, [autoImport]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 580, maxHeight: "85vh" }}>
        <h2>Watch Folder · Live Event Mode</h2>
        <div className="desc">
          Watcher en mappe for nye video/audio-filer. Nyttig for event-dager hvor kort kommer inn løpende
          — app-en oppdager nye klipp og kan automatisk importere dem til Resolve.
        </div>

        {error && <div className="dialog-warning">{error}</div>}

        <div className="settings-section">
          <div className="preflight-question">
            <input
              id="auto-import-toggle"
              type="checkbox"
              checked={autoImport}
              onChange={toggleAutoImport}
            />
            <label htmlFor="auto-import-toggle">
              <strong>Auto-import nye klipp til Resolve</strong>
              <div className="desc">
                Når nye klipp lander i en watched mappe, kjør <code>import_media_from_folder</code> automatisk
                på den mappa. Resolve må være åpent med et prosjekt.
              </div>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <div className="section-title">Watched folders ({watched.length})</div>
          {watched.length === 0 ? (
            <div className="empty">Ingen mapper watches akkurat nå.</div>
          ) : (
            watched.map((w) => (
              <div key={w.path} className="watched-folder">
                <div className="watched-folder-meta">
                  <strong>{w.path.split("/").pop()}</strong>
                  <span className="card-chip-meta">{w.path}</span>
                  <span className="card-chip-meta">
                    {w.seen_count} klipp · siden {new Date(w.started_at).toLocaleTimeString()}
                  </span>
                </div>
                <button className="small" onClick={() => handleStop(w.path)} disabled={busy}>
                  Stop
                </button>
              </div>
            ))
          )}
          <button
            className="small primary"
            onClick={handlePickFolder}
            disabled={busy}
            style={{ marginTop: 8 }}
          >
            + Watch ny mappe
          </button>
        </div>

        {recent.length > 0 && (
          <div className="settings-section">
            <div className="section-title">Recent events</div>
            <div className="watch-recent-list">
              {recent.map((r, i) => (
                <div key={i} className="watch-recent-item">
                  <span className={`chip ${r.imported ? "ready" : "stub"}`}>
                    {r.imported ? <><IconCheck /> imported</> : "new"}
                  </span>
                  <span>{r.clipCount} klipp i {r.folder.split("/").pop()}</span>
                  <span className="card-chip-meta">{new Date(r.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

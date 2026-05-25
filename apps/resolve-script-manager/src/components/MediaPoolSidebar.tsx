import { useCallback, useEffect, useState } from "react";
import { executeScript } from "../api";
import { IconPlay } from "./Icons";

interface BinNode {
  name: string;
  depth: number;
  clipCount: number;
  totalBytes: number;
  clips: Array<{ name: string; type: string; resolution?: string; duration?: string }>;
  subBins: BinNode[];
}

interface MediaPoolState {
  projectName: string;
  currentPage?: string | null;
  rootBin: BinNode;
  timelines: Array<{
    name: string;
    startFrame: number;
    endFrame: number;
    videoTracks: number;
    audioTracks: number;
    isCurrent?: boolean;
  }>;
  renderQueue: Array<{ jobId?: string; name?: string; status?: string }>;
  renderQueueCount: number;
}

interface Props {
  refreshTrigger: number;
}

const FORMAT_GB = (b: number) => `${(b / 1_073_741_824).toFixed(1)} GB`;
const FORMAT_MB = (b: number) => `${(b / 1_048_576).toFixed(0)} MB`;

function BinRow({ bin, expanded, onToggle }: { bin: BinNode; expanded: Set<string>; onToggle: (path: string) => void }) {
  const path = bin.name + ":" + bin.depth;
  const isOpen = expanded.has(path);
  const hasChildren = bin.subBins.length > 0 || bin.clipCount > 0;
  return (
    <>
      <div
        className="media-pool-bin"
        style={{ paddingLeft: bin.depth * 12 }}
        onClick={() => hasChildren && onToggle(path)}
      >
        <span className="media-pool-bin-toggle">{hasChildren ? (isOpen ? "▾" : "▸") : "·"}</span>
        <span className="media-pool-bin-name">{bin.name}</span>
        <span className="media-pool-bin-count">{bin.clipCount}</span>
        {bin.totalBytes > 0 && (
          <span className="media-pool-bin-size">
            {bin.totalBytes >= 1_073_741_824 ? FORMAT_GB(bin.totalBytes) : FORMAT_MB(bin.totalBytes)}
          </span>
        )}
      </div>
      {isOpen && (
        <>
          {bin.clips.slice(0, 30).map((clip) => (
            <div key={clip.name} className="media-pool-clip" style={{ paddingLeft: (bin.depth + 1) * 12 + 16 }}>
              <span className="media-pool-clip-name">{clip.name}</span>
              {clip.resolution && (
                <span className="media-pool-clip-meta">{clip.resolution}</span>
              )}
            </div>
          ))}
          {bin.clips.length > 30 && (
            <div className="media-pool-clip" style={{ paddingLeft: (bin.depth + 1) * 12 + 16, opacity: 0.6 }}>
              +{bin.clips.length - 30} more…
            </div>
          )}
          {bin.subBins.map((sub) => (
            <BinRow key={sub.name + sub.depth} bin={sub} expanded={expanded} onToggle={onToggle} />
          ))}
        </>
      )}
    </>
  );
}

export function MediaPoolSidebar({ refreshTrigger }: Props) {
  const [state, setState] = useState<MediaPoolState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([":0"]));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await executeScript("get_media_pool_state", { includeClips: true }, false);
      const result = summary.events.find((e) => e.type === "result")?.value as MediaPoolState | undefined;
      if (!result) {
        setError("Could not read Media Pool. Is Resolve running with a project open?");
        setState(null);
        return;
      }
      setState(result);
      // Auto-expand root bin
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(result.rootBin.name + ":0");
        return next;
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshTrigger]);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return (
    <aside className="media-pool-sidebar">
      <div className="media-pool-header">
        <h3>Media Pool</h3>
        <button className="small ghost" onClick={refresh} disabled={loading} title="Refresh">
          {loading ? "…" : "↻"}
        </button>
      </div>

      {error && <div className="dialog-warning" style={{ margin: "8px 10px", fontSize: 10 }}>{error}</div>}

      {state && (
        <>
          <div className="media-pool-project">
            <strong>{state.projectName}</strong>
            {state.currentPage && (
              <span className="card-chip-meta">· {state.currentPage}</span>
            )}
          </div>

          <div className="media-pool-section-title">Bins</div>
          <div className="media-pool-bins">
            <BinRow bin={state.rootBin} expanded={expanded} onToggle={toggle} />
          </div>

          {state.timelines.length > 0 && (
            <>
              <div className="media-pool-section-title">Timelines ({state.timelines.length})</div>
              <div className="media-pool-timelines">
                {state.timelines.map((tl) => (
                  <div key={tl.name} className={`media-pool-timeline ${tl.isCurrent ? "current" : ""}`}>
                    <div className="media-pool-timeline-name">
                      {tl.isCurrent && <><IconPlay /> </>}
                      {tl.name}
                    </div>
                    <div className="card-chip-meta">
                      V{tl.videoTracks} · A{tl.audioTracks} ·{" "}
                      {Math.round((tl.endFrame - tl.startFrame) / 25)}s
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {state.renderQueueCount > 0 && (
            <>
              <div className="media-pool-section-title">Render Queue ({state.renderQueueCount})</div>
              {state.renderQueue.map((job) => (
                <div key={job.jobId} className="media-pool-render-job">
                  <span>{job.name ?? "(unnamed)"}</span>
                  {job.status && <span className="chip">{job.status}</span>}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {!state && !loading && !error && (
        <div className="empty" style={{ padding: 12 }}>
          Open a project in Resolve and click ↻
        </div>
      )}
    </aside>
  );
}

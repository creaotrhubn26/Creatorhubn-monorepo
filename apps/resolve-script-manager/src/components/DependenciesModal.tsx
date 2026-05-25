import { useCallback, useEffect, useState } from "react";
import { executeScript } from "../api";
import { IconCheck, IconX } from "./Icons";

interface ToolStatus {
  installed: boolean;
  path?: string | null;
  version?: string | null;
  installCommand?: string | null;
  bundleId?: string;
  isStudio?: boolean;
  isLite?: boolean;
  architecture?: string;
  note?: string;
}

interface DepResult {
  tools: Record<string, ToolStatus>;
  credentials: Record<string, { set: boolean; via: string }>;
  summary: Record<string, boolean>;
}

interface Props {
  onClose: () => void;
}

const DISPLAY_ORDER: Array<{ key: string; label: string; manager?: "brew" | "pip"; brewPkg?: string; pipPkg?: string }> = [
  { key: "brew", label: "Homebrew" },
  { key: "ffmpeg", label: "ffmpeg", manager: "brew", brewPkg: "ffmpeg" },
  { key: "ffprobe", label: "ffprobe", manager: "brew", brewPkg: "ffmpeg" },
  { key: "fpcalc", label: "chromaprint (fpcalc)", manager: "brew", brewPkg: "chromaprint" },
  { key: "python3", label: "Python 3" },
  { key: "anthropic", label: "anthropic (Python)", manager: "pip", pipPkg: "anthropic" },
  { key: "whisperx", label: "whisperx (Python)", manager: "pip", pipPkg: "whisperx" },
  { key: "resolve", label: "DaVinci Resolve" },
];

export function DependenciesModal({ onClose }: Props) {
  const [result, setResult] = useState<DepResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await executeScript("check_dependencies", {}, false);
      const r = summary.events.find((e) => e.type === "result")?.value as DepResult | undefined;
      if (r) setResult(r);
      else setError("check_dependencies returned no result.");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const install = useCallback(
    async (manager: "brew" | "pip", pkg: string) => {
      setInstalling(`${manager}: ${pkg}`);
      setError(null);
      try {
        await executeScript("install_dependency", { manager, packages: [pkg] }, false);
        await check();
      } catch (e) {
        setError(String(e));
      } finally {
        setInstalling(null);
      }
    },
    [check],
  );

  const installAllMissing = useCallback(async () => {
    if (!result) return;
    const brewMissing = DISPLAY_ORDER
      .filter((d) => d.manager === "brew" && d.brewPkg)
      .filter((d) => !result.tools[d.key]?.installed)
      .map((d) => d.brewPkg as string);
    const pipMissing = DISPLAY_ORDER
      .filter((d) => d.manager === "pip" && d.pipPkg)
      .filter((d) => !result.tools[d.key]?.installed)
      .map((d) => d.pipPkg as string);
    const dedupBrew = Array.from(new Set(brewMissing));
    const dedupPip = Array.from(new Set(pipMissing));

    setInstalling("Installing all missing…");
    try {
      if (dedupBrew.length > 0) {
        await executeScript("install_dependency", { manager: "brew", packages: dedupBrew }, false);
      }
      if (dedupPip.length > 0) {
        await executeScript("install_dependency", { manager: "pip", packages: dedupPip }, false);
      }
      await check();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(null);
    }
  }, [result, check]);

  const missingCount = result
    ? DISPLAY_ORDER.filter((d) => d.manager && !result.tools[d.key]?.installed).length
    : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 600, maxHeight: "85vh" }}>
        <h2>Dependencies</h2>
        <div className="desc">
          Verktøy appen trenger for full funksjonalitet. Mangler noe — klikk "Install" på radene.
          DaVinci Resolve Studio må lastes manuelt fra blackmagicdesign.com.
        </div>

        {error && <div className="dialog-warning">{error}</div>}

        {!result && loading && (
          <div className="cull-running" style={{ padding: 16 }}>
            <div className="cull-running-spinner" />
            Sjekker installerte verktøy…
          </div>
        )}

        {result && (
          <>
            <div style={{ overflowY: "auto", maxHeight: "55vh", marginTop: 8 }}>
              {DISPLAY_ORDER.map(({ key, label, manager, brewPkg, pipPkg }) => {
                const status = result.tools[key];
                if (!status) return null;
                const installed = status.installed;
                const isResolve = key === "resolve";
                const isLiteVsStudio = isResolve && installed && status.isLite;
                return (
                  <div key={key} className="dependency-row">
                    <span className={`chip ${installed ? (isLiteVsStudio ? "risk-medium" : "ready") : "risk-high"}`}>
                      {installed ? (isLiteVsStudio ? "Lite" : <IconCheck />) : <IconX />}
                    </span>
                    <div>
                      <div className="dependency-name">{label}</div>
                      <div className="dependency-detail">
                        {installed
                          ? `${status.version ?? ""} ${status.architecture ?? ""} ${status.path ? `· ${status.path}` : ""}`
                          : status.installCommand ?? status.note ?? "Not installed"}
                        {isLiteVsStudio && " · Studio kreves for external scripting"}
                      </div>
                    </div>
                    <span className="card-chip-meta">{manager ?? (isResolve ? "manual" : "system")}</span>
                    {!installed && manager === "brew" && brewPkg && (
                      <button
                        className="small primary"
                        onClick={() => install("brew", brewPkg)}
                        disabled={!!installing}
                      >
                        Install
                      </button>
                    )}
                    {!installed && manager === "pip" && pipPkg && (
                      <button
                        className="small primary"
                        onClick={() => install("pip", pipPkg)}
                        disabled={!!installing}
                      >
                        Install
                      </button>
                    )}
                    {!installed && isResolve && (
                      <a
                        href="https://www.blackmagicdesign.com/support/family/davinci-resolve"
                        target="_blank"
                        rel="noreferrer"
                        className="small"
                      >
                        Download
                      </a>
                    )}
                    {installed && !isResolve && <span className="card-chip-meta">—</span>}
                  </div>
                );
              })}
            </div>

            <div className="actions" style={{ flexWrap: "wrap", gap: 8 }}>
              <button onClick={check} disabled={loading || !!installing}>
                Re-check
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("trrpa.firstRunComplete");
                  location.reload();
                }}
                disabled={!!installing}
                title="Restart appen og åpne førstegangs-wizardet på nytt"
              >
                Re-run setup wizard
              </button>
              {missingCount > 0 && (
                <button className="primary" onClick={installAllMissing} disabled={!!installing}>
                  {installing ? installing : `Install all ${missingCount} missing`}
                </button>
              )}
              <button onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * LearningView — surface the user-learning profile (#614).
 *
 * After each `learn_from_user_edit` run we write profile.json + a markdown
 * report. Until now this was invisible from the UI — user had to open
 * Finder to read them. This component reads via the Tauri command
 * read_learning_profile and renders:
 *
 *   - Stats card: total sessions, sessions per project, blacklist count
 *   - Top 5 most-kept clips (system got these right)
 *   - Top 5 most-replaced clips (system needs to learn)
 *   - Current blacklist (auto-pruned after 3 consecutive replacements)
 *   - Energy/duration deltas per segment-bin (intro/rise/build/climax/outro)
 *   - Recent reorder events
 *   - Recent session-records with link to markdown report
 *
 * Per-project picker switches the displayed profile. Default = global.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ClipPreference {
  keeps?: number;
  replacements?: number;
  contexts?: string[];
  replacementStreak?: number;
}

interface ReorderEvent {
  clipPath: string;
  autoIndex: number;
  userIndex: number;
  delta: number;
}

interface Profile {
  version?: number;
  totalLearningSessions?: number;
  clipPreferences?: Record<string, ClipPreference>;
  blacklist?: string[];
  energyCurveDeltas?: Record<string, { sum?: number; count?: number }>;
  durationDeltas?: Record<string, { sum?: number; count?: number }>;
  reorderEvents?: ReorderEvent[];
}

interface RecentSession {
  _filename: string;
  _path: string;
  timelineName?: string;
  kept?: number;
  replaced?: number;
  removed?: number;
  moved?: number;
  insertedByUser?: number;
  savedAt?: number;
}

interface ProfileResponse {
  global: Profile;
  projects: Record<string, Profile>;
  recentSessions: RecentSession[];
}

interface Props {
  onClose: () => void;
}

function basename(p: string): string {
  return p.split("/").pop() || p;
}

function formatSec(n?: number): string {
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString();
}

export function LearningView({ onClose }: Props) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("__global");

  const reload = useCallback(async () => {
    try {
      const res = await invoke<ProfileResponse>("read_learning_profile");
      setData(res);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const profile: Profile = useMemo(() => {
    if (!data) return {};
    if (selectedProject === "__global") return data.global;
    return data.projects[selectedProject] || {};
  }, [data, selectedProject]);

  const ranked = useMemo(() => {
    const prefs = profile.clipPreferences || {};
    return Object.entries(prefs).map(([path, p]) => {
      const keeps = p.keeps || 0;
      const replacements = p.replacements || 0;
      return {
        path, keeps, replacements,
        delta: keeps - replacements,
        streak: p.replacementStreak || 0,
      };
    });
  }, [profile]);

  const mostKept = useMemo(
    () => [...ranked].filter((r) => r.keeps > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
    [ranked],
  );
  const mostReplaced = useMemo(
    () => [...ranked].filter((r) => r.replacements > 0)
                     .sort((a, b) => (b.replacements - b.keeps) - (a.replacements - a.keeps))
                     .slice(0, 5),
    [ranked],
  );

  const blacklist = profile.blacklist || [];
  const reorderEvents = (profile.reorderEvents || []).slice(-10);

  // Avg deltas per bin (for energy + duration)
  const avgDelta = useCallback((map?: Record<string, { sum?: number; count?: number }>) => {
    if (!map) return {};
    const out: Record<string, number> = {};
    for (const [bin, v] of Object.entries(map)) {
      if (v.count && v.count > 0) {
        out[bin] = (v.sum || 0) / v.count;
      }
    }
    return out;
  }, []);
  const durationDeltas = avgDelta(profile.durationDeltas);

  const projectNames = Object.keys(data?.projects || {});

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 250,
      background: "rgba(10,5,24,0.85)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      paddingTop: "6vh",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(900px, 94vw)", maxHeight: "85vh", overflow: "auto",
        background: "#15093c", border: "1px solid #2c1860",
        borderRadius: 12, padding: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Hva systemet har lært</h2>
            <div style={{ fontSize: 11, color: "#8674a8", marginTop: 4 }}>
              Aggregert fra learn_from_user_edit-kjøringer
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              style={{
                background: "#0a0518", border: "1px solid #2c1860",
                color: "#f0eaff", padding: "4px 8px", borderRadius: 4, fontSize: 12,
              }}
            >
              <option value="__global">Global (alle prosjekter)</option>
              {projectNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button onClick={reload} style={btn}>↻</button>
            <button onClick={onClose} style={btn}>Lukk</button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: 10, background: "rgba(239,79,111,0.1)",
            color: "#ef4f6f", borderRadius: 6, marginBottom: 12, fontSize: 13,
          }}>{error}</div>
        )}

        {!data && !error && <div style={{ color: "#8674a8" }}>Laster…</div>}

        {data && (
          <>
            {/* Stats overview */}
            <div style={statCardRow}>
              <Stat title="Læringsøkter" value={profile.totalLearningSessions ?? 0} />
              <Stat title="Klipp med historikk" value={Object.keys(profile.clipPreferences || {}).length} />
              <Stat title="Blacklist" value={blacklist.length}
                    accent={blacklist.length > 0 ? "#ef4f6f" : undefined} />
              <Stat title="Reorder-events" value={(profile.reorderEvents || []).length} />
              <Stat title="Prosjekter med data" value={projectNames.length} />
            </div>

            {/* Most-kept + most-replaced side-by-side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                          gap: 12, marginTop: 16 }}>
              <Section title="🟢 Mest beholdt" subtitle="Systemet rangerte disse godt">
                {mostKept.length === 0 ? <Empty/> :
                  mostKept.map((r) => (
                    <ClipRow key={r.path} path={r.path}
                             primary={`${r.keeps} keeps`}
                             secondary={`${r.replacements} replacements · Δ +${r.delta}`}
                             color="#3fc77f" />
                  ))
                }
              </Section>
              <Section title="🔁 Mest erstattet" subtitle="Systemet trenger å lære disse">
                {mostReplaced.length === 0 ? <Empty/> :
                  mostReplaced.map((r) => (
                    <ClipRow key={r.path} path={r.path}
                             primary={`${r.replacements} replacements`}
                             secondary={`${r.keeps} keeps · streak ${r.streak} · Δ ${-(r.replacements - r.keeps)}`}
                             color="#f0b030" />
                  ))
                }
              </Section>
            </div>

            {/* Blacklist */}
            {blacklist.length > 0 && (
              <Section title="⛔ Blacklist" subtitle="Filtrert ut av fremtidige auto-placements">
                {blacklist.map((p) => (
                  <ClipRow key={p} path={p} primary="blocked" secondary=""
                           color="#ef4f6f" />
                ))}
              </Section>
            )}

            {/* Duration deltas per bin */}
            {Object.keys(durationDeltas).length > 0 && (
              <Section title="⏱ Lengde-justeringer per energi-bin"
                       subtitle="Hvor mye lengre/kortere du gjør klippene enn auto-forslag">
                {Object.entries(durationDeltas).map(([bin, val]) => (
                  <div key={bin} style={statRow}>
                    <span style={{ width: 80, color: "#b8a8d8" }}>{bin}</span>
                    <span style={{ color: val > 0 ? "#3fc77f" : "#f0b030" }}>
                      {val > 0 ? "+" : ""}{val.toFixed(2)}s
                    </span>
                  </div>
                ))}
              </Section>
            )}

            {/* Recent reorder events */}
            {reorderEvents.length > 0 && (
              <Section title="↔ Reorder-events (sist 10)"
                       subtitle="Klipp du flyttet til en annen posisjon enn auto-forslaget">
                {reorderEvents.map((ev, i) => (
                  <ClipRow key={i} path={ev.clipPath}
                           primary={`pos ${ev.autoIndex} → ${ev.userIndex}`}
                           secondary={`delta ${ev.delta > 0 ? "+" : ""}${ev.delta}`}
                           color="#a030c0" />
                ))}
              </Section>
            )}

            {/* Recent sessions */}
            {selectedProject === "__global" && data.recentSessions.length > 0 && (
              <Section title="📋 Siste læringsøkter"
                       subtitle="Klikk for å åpne markdown-rapport">
                {data.recentSessions.map((s) => (
                  <div key={s._filename} style={statRow}
                       onClick={() => {
                         const mdPath = s._path.replace(".json", ".md");
                         void invoke("open_path_in_finder", { path: mdPath })
                           .catch(() => void invoke("open_script_folder").catch(() => {}));
                       }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, color: "#f0eaff",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {s.timelineName || s._filename}
                      </div>
                      <div style={{ fontSize: 10, color: "#8674a8", marginTop: 2 }}>
                        {formatSec(s.savedAt)}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#b8a8d8" }}>
                      ✓{s.kept ?? 0} 🔁{s.replaced ?? 0} 🗑{s.removed ?? 0}
                    </div>
                  </div>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ title, value, accent }: { title: string; value: number; accent?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 130,
      padding: 12,
      background: "rgba(26,13,69,0.6)", border: "1px solid #2c1860",
      borderRadius: 8,
    }}>
      <div style={{
        fontSize: 24, fontWeight: 700,
        color: accent ?? "#a030c0",
      }}>{value}</div>
      <div style={{ fontSize: 10, color: "#b8a8d8", marginTop: 2 }}>{title}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#f0eaff" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 10, color: "#8674a8", marginTop: 2 }}>{subtitle}</div>}
      <div style={{ marginTop: 6,
                    background: "rgba(0,0,0,0.2)", border: "1px solid #2c1860",
                    borderRadius: 6, padding: 6 }}>
        {children}
      </div>
    </div>
  );
}

function ClipRow({ path, primary, secondary, color }: {
  path: string; primary: string; secondary: string; color: string;
}) {
  return (
    <div style={statRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, color: "#f0eaff",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }} title={path}>{basename(path)}</div>
        {secondary && (
          <div style={{ fontSize: 10, color: "#8674a8", marginTop: 1 }}>
            {secondary}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color, marginLeft: 8 }}>{primary}</div>
    </div>
  );
}

function Empty() {
  return <div style={{ padding: 6, color: "#8674a8", fontSize: 11, fontStyle: "italic" }}>
    (ingen data ennå — kjør Learn From My Edit)
  </div>;
}

const btn: React.CSSProperties = {
  background: "transparent", border: "1px solid #2c1860",
  color: "#b8a8d8", padding: "4px 10px", borderRadius: 4,
  cursor: "pointer", fontSize: 12,
};

const statCardRow: React.CSSProperties = {
  display: "flex", gap: 10, flexWrap: "wrap",
};

const statRow: React.CSSProperties = {
  display: "flex", alignItems: "center",
  padding: "4px 6px", cursor: "pointer",
  borderBottom: "1px solid rgba(44,24,96,0.5)",
};

/**
 * Home view — primary landing surface.
 *
 * Replaces the previous 4-tab layout (Pipeline / Cull / Audio / Color).
 * Mental model: user opens app → picks a project template → goes
 * straight into Magic Cut. No more "what tab am I on" overhead.
 *
 * Power-user features (script library, individual script runs, raw
 * pipeline view) live behind cmd-K / Advanced menu — not on the home.
 */

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import type { ProjectTemplateSummary } from "../types";
import {
  IconSparkle,
  IconArrowRight,
  IconCheck,
  IconClapper,
  IconCamera,
  IconFilmReel,
  IconMicrophone,
  IconBookOpen,
  IconWaveform,
  IconPhone,
  IconHeart,
  IconPlay,
} from "./Icons";
import ChurchIcon from "@mui/icons-material/Church";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import MovieIcon from "@mui/icons-material/Movie";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import PersonIcon from "@mui/icons-material/Person";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import SaveIcon from "@mui/icons-material/Save";
import FolderIcon from "@mui/icons-material/Folder";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import EditIcon from "@mui/icons-material/Edit";
import CircleIcon from "@mui/icons-material/Circle";
import type { SvgIconComponent } from "@mui/icons-material";
import { RoleRoomProjectSync } from "./RoleRoomProjectSync";
import { executeScript } from "../api";
import { loadProjectActivity, logActivity, ACTIVITY_ICONS } from "../lib/projectActivity";
import type { ActivityKind } from "../lib/projectActivity";

const ACTIVITY_ICON_MAP: Record<string, SvgIconComponent> = {
  Movie: MovieIcon,
  CameraAlt: CameraAltIcon,
  VolumeUp: VolumeUpIcon,
  Person: PersonIcon,
  MusicNote: MusicNoteIcon,
  Save: SaveIcon,
  Folder: FolderIcon,
  VideoLibrary: VideoLibraryIcon,
  Search: SearchIcon,
  AutoAwesome: AutoAwesomeIcon,
  AutoFixHigh: AutoFixHighIcon,
  Edit: EditIcon,
};

function ActivityIcon({ name }: { name: string }) {
  const Icon = ACTIVITY_ICON_MAP[name] ?? CircleIcon;
  return <Icon sx={{ fontSize: 14 }} />;
}

type IconCmp = (p: { size?: number }) => JSX.Element;

interface RecentProject {
  templateId: string;
  templateName: string;
  startedAt: number;
  status: "completed" | "cancelled" | "in_progress";
  clipCount?: number;
  sourceLabel?: string;
}

interface Props {
  templates: ProjectTemplateSummary[];
  onPickTemplate: (templateId: string) => void;
  onOpenAdvanced: () => void;
  onNewProjectFromFile: () => void;
  onOpenWeddingWizard: () => void;
  onOpenQcVideo: () => void;
  onOpenSavedProject: (picksPath: string) => void;
  signedIn: boolean;
  onSignIn: () => void;
  resolveConnected: boolean;
}

interface SavedProject {
  picksPath: string;
  sourceVideo: string;
  title: string;
  savedAt: number;
  audioCount?: number;
}

function loadSavedProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem("trrpa.savedProjects");
    return raw ? (JSON.parse(raw) as SavedProject[]) : [];
  } catch {
    return [];
  }
}

const TEMPLATE_DECORATIONS: Record<string, { Icon: IconCmp; tagline: string }> = {
  corporate_video: { Icon: IconClapper, tagline: "Brand-films, intervjuer, internkomms" },
  documentary: { Icon: IconCamera, tagline: "Lang-form, faktisk fortelling" },
  podcast: { Icon: IconMicrophone, tagline: "Multi-cam med ekstern lyd" },
  course_academy: { Icon: IconBookOpen, tagline: "Kurs, tutorials, e-læring" },
  music_video: { Icon: IconWaveform, tagline: "Beat-synket cut til musikk" },
  social_media: { Icon: IconPhone, tagline: "Reels, Shorts, TikTok" },
  wedding_film: { Icon: IconHeart, tagline: "Bryllups-dokumentasjon" },
};

function loadRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem("trrpa.recentProjects");
    return raw ? (JSON.parse(raw) as RecentProject[]) : [];
  } catch {
    return [];
  }
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "akkurat nå";
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d siden`;
  return new Date(ts).toLocaleDateString();
}

export function HomeView({
  templates,
  onPickTemplate,
  onOpenAdvanced,
  onNewProjectFromFile,
  onOpenWeddingWizard,
  onOpenQcVideo,
  onOpenSavedProject,
  signedIn,
  onSignIn,
  resolveConnected,
}: Props) {
  const [recent, setRecent] = useState<RecentProject[]>(() => loadRecentProjects());
  const [saved, setSaved] = useState<SavedProject[]>(() => loadSavedProjects());

  useEffect(() => {
    const handler = () => {
      setRecent(loadRecentProjects());
      setSaved(loadSavedProjects());
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, []);

  // Sync Python-loggede activity-events fra activity_log.jsonl inn i localStorage.
  // Triggers så terminal-runs også vises i UI.
  useEffect(() => {
    executeScript("read_activity_log", {}, false).then((sum) => {
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as { entries?: Array<{ ts: number; kind: string; label: string; summary?: string; sourceVideo?: string | null }> } | undefined;
      const entries = val?.entries || [];
      if (entries.length === 0) return;
      // For hver entry, sjekk om den finnes lokalt (samme ts) — hvis ikke, legg inn
      try {
        for (const e of entries) {
          if (!e.sourceVideo) continue;
          const key = `trrpa.projectActivity.${e.sourceVideo}`;
          const raw = localStorage.getItem(key);
          const local = (raw ? JSON.parse(raw) : []) as Array<{ ts: number }>;
          if (local.some((l) => l.ts === e.ts)) continue;
          logActivity(e.sourceVideo, {
            kind: (e.kind as ActivityKind) || "manual_edit",
            label: e.label,
            summary: e.summary,
          });
        }
      } catch (err) {
        console.warn("Activity-sync failed:", err);
      }
    }).catch(() => { /* non-critical */ });
  }, []);

  // Sync localStorage savedProjects with on-disk archive on mount.
  // Hopper over picks-paths brukeren eksplisitt har slettet fra listen.
  useEffect(() => {
    let cancelled = false;
    executeScript("list_archived_projects", {}, false).then((sum) => {
      const r = sum.events.find((e) => e.type === "result");
      const val = r?.value as { projects?: SavedProject[] } | undefined;
      const disk = val?.projects || [];
      if (cancelled || disk.length === 0) return;
      try {
        const deleted = new Set<string>(
          JSON.parse(localStorage.getItem("trrpa.deletedPicksPaths") || "[]") as string[]
        );
        const existing = loadSavedProjects();
        const existingPaths = new Set(existing.map((p) => p.picksPath));
        const merged = [...existing];
        for (const p of disk) {
          if (!existingPaths.has(p.picksPath) && !deleted.has(p.picksPath)) merged.push(p);
        }
        merged.sort((a, b) => b.savedAt - a.savedAt);
        localStorage.setItem("trrpa.savedProjects", JSON.stringify(merged.slice(0, 30)));
        setSaved(merged);
      } catch (e) {
        console.warn("Sync savedProjects failed:", e);
      }
    }).catch(() => { /* non-critical */ });
    return () => { cancelled = true; };
  }, []);

  const orderedTemplates = useMemo(() => {
    // Put the most-used template first based on recent projects
    if (recent.length === 0) return templates;
    const counts = new Map<string, number>();
    recent.forEach((r) => counts.set(r.templateId, (counts.get(r.templateId) ?? 0) + 1));
    return [...templates].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [templates, recent]);

  return (
    <div className="home-view">
      <div className="home-hero">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                       gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h1 className="home-title">Hva vil du lage?</h1>
            <p className="home-subtitle">
              Velg en mal, pek på footage-mappa, og la AI sammenstille en rough cut i Resolve.
            </p>
          </div>

          {/* Live status-rad: Resolve + Role Room + stats */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6,
                            padding: "6px 12px", borderRadius: 999,
                            background: resolveConnected ? "rgba(74, 212, 138, 0.10)" : "rgba(240, 165, 0, 0.10)",
                            border: `1px solid ${resolveConnected ? "#4ad48a" : "#f0a500"}`,
                            fontSize: 11 }}>
              <span className={`anim-pulse-dot`}
                     style={{ width: 8, height: 8, borderRadius: "50%",
                               background: resolveConnected ? "#4ad48a" : "#f0a500" }} />
              <span>Resolve {resolveConnected ? "tilkoblet" : "ikke åpen"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6,
                            padding: "6px 12px", borderRadius: 999,
                            background: signedIn ? "rgba(160, 48, 192, 0.10)" : "var(--bg-3)",
                            border: `1px solid ${signedIn ? "var(--accent)" : "var(--border)"}`,
                            fontSize: 11, cursor: signedIn ? "default" : "pointer" }}
                  onClick={() => !signedIn && onSignIn()}>
              <IconSparkle size={11} />
              <span>{signedIn ? "Role Room pålogget" : "Logg inn"}</span>
            </div>
            {saved.length > 0 && (
              <div style={{ padding: "6px 12px", borderRadius: 999,
                              background: "var(--bg-3)", border: "1px solid var(--border)",
                              fontSize: 11 }}>
                {saved.length} prosjekt{saved.length > 1 ? "er" : ""}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hovedhandlinger: 2-kolonner med tydelig hierarki */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                      gap: 14, marginTop: 18 }}>
        <button
          className="home-action-card primary-action anim-lift anim-press"
          onClick={onOpenWeddingWizard}
          disabled={!signedIn}
          title={signedIn ? "Material-scan, multicam, sanger, personer, stil — Claude lærer av valgene dine" : "Logg inn først"}
        >
          <div className="home-action-icon" style={{ background: "linear-gradient(135deg, #ef4f6f, #a030c0)" }}>
            <ChurchIcon sx={{ fontSize: 28, color: "white" }} />
          </div>
          <div className="home-action-body">
            <div className="home-action-title">Bryllups-veiviser</div>
            <div className="home-action-desc">
              8 steg: kilder → multicam → lyd → sanger → personer → stil → live → LUT
            </div>
            <div className="home-action-tag">Anbefalt for nytt prosjekt</div>
          </div>
          <IconArrowRight />
        </button>

        <button
          className="home-action-card anim-lift anim-press"
          onClick={onNewProjectFromFile}
          disabled={!signedIn}
          title={signedIn ? "Velg én ferdig redigert/eksportert video → AI lager picks + identifiserer musikk" : "Logg inn først"}
        >
          <div className="home-action-icon" style={{ background: "linear-gradient(135deg, #6e3fc7, #4a90e2)" }}>
            <IconSparkle size={26} />
          </div>
          <div className="home-action-body">
            <div className="home-action-title">Nytt fra én fil</div>
            <div className="home-action-desc">
              Rask flyt: ferdig video → AI scanner picks → editor åpner
            </div>
            <div className="home-action-tag">~30 min</div>
          </div>
          <IconArrowRight />
        </button>
      </div>

      {saved.length > 0 && (
        <div className="home-recent" style={{ marginTop: 22 }}>
          <div className="home-section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VideoLibraryIcon sx={{ fontSize: 16, opacity: 0.7 }} />
            Mine prosjekter
            <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 400 }}>
              ({saved.length})
            </span>
          </div>
          <div className="anim-stagger">
            {saved.slice(0, 8).map((p) => <SavedProjectRow key={p.picksPath}
                                                              project={p}
                                                              onOpen={onOpenSavedProject}
                                                              onRemove={(path) => {
              const next = saved.filter((x) => x.picksPath !== path);
              setSaved(next);
              localStorage.setItem("trrpa.savedProjects", JSON.stringify(next));
              localStorage.setItem("trrpa.deletedPicksPaths",
                JSON.stringify([
                  ...(JSON.parse(localStorage.getItem("trrpa.deletedPicksPaths") || "[]") as string[]),
                  path,
                ])
              );
            }} />)}
          </div>
        </div>
      )}

      <div className="home-section-title" style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 8 }}>
        <AutoAwesomeIcon sx={{ fontSize: 16, opacity: 0.7 }} />
        Eller velg en mal
      </div>
      <div className="home-templates anim-stagger">
        {orderedTemplates.map((t) => {
          const deco = TEMPLATE_DECORATIONS[t.id] ?? { Icon: IconFilmReel, tagline: t.description };
          const Icon = deco.Icon;
          return (
            <button
              key={t.id}
              className="home-template-card anim-lift anim-press"
              onClick={() => onPickTemplate(t.id)}
              disabled={!signedIn || !resolveConnected}
              title={signedIn ? t.name : "Logg inn først"}
            >
              <div className="home-template-icon">
                <Icon size={32} />
              </div>
              <div className="home-template-name">{t.name}</div>
              <div className="home-template-tagline">{deco.tagline}</div>
            </button>
          );
        })}
      </div>

      {recent.length > 0 && (
        <div className="home-recent">
          <div className="home-section-title">Maler brukt nylig</div>
          {recent.slice(0, 5).map((r, i) => (
            <button
              key={i}
              className="home-recent-item"
              onClick={() => onPickTemplate(r.templateId)}
            >
              <div className="home-recent-status">
                {r.status === "completed" ? <IconCheck size={14} /> : r.status === "cancelled" ? <span style={{ opacity: 0.4 }}>—</span> : <IconPlay size={12} />}
              </div>
              <div className="home-recent-meta">
                <strong>{r.templateName}</strong>
                <span className="card-chip-meta">
                  {r.sourceLabel ? `${r.sourceLabel} · ` : ""}
                  {r.clipCount ? `${r.clipCount} klipp · ` : ""}
                  {formatRelativeTime(r.startedAt)}
                </span>
              </div>
              <IconArrowRight />
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <RoleRoomProjectSync />
      </div>

      <div className="home-footer-hints" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <button className="home-link-button" onClick={onOpenQcVideo} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <SearchIcon sx={{ fontSize: 16 }} /> QC sjekk av video (gaps + stille) →
        </button>
        <button className="home-link-button" onClick={onOpenAdvanced}>
          Avansert: kjør enkelt-script eller se pipeline-detaljer →
        </button>
      </div>
    </div>
  );
}

/** Single project-row with expandable activity-log. */
function SavedProjectRow({ project, onOpen, onRemove }:
                          { project: SavedProject; onOpen: (path: string) => void;
                            onRemove: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const activity = useMemo(() => loadProjectActivity(project.sourceVideo), [project.sourceVideo, expanded]);

  return (
    <div className="home-recent-item-wrap" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 4 }}>
        <button className="home-recent-item" onClick={() => onOpen(project.picksPath)}
                 title={project.sourceVideo} style={{ flex: 1 }}>
          <div className="home-recent-status">
            <IconFilmReel size={14} />
          </div>
          <div className="home-recent-meta">
            <strong>{project.title}</strong>
            <span className="card-chip-meta">
              {project.audioCount ? `${project.audioCount} sang${project.audioCount > 1 ? "er" : ""} · ` : ""}
              {activity.length > 0 ? `${activity.length} jobb${activity.length > 1 ? "er" : ""} utført · ` : ""}
              {formatRelativeTime(project.savedAt * 1000)}
            </span>
          </div>
          <IconArrowRight />
        </button>
        {activity.length > 0 && (
          <button onClick={() => setExpanded((v) => !v)}
                  title={expanded ? "Skjul aktivitet" : "Vis aktivitet"}
                  style={{ padding: "0 12px", fontSize: 12,
                            background: expanded ? "var(--accent-dim)" : "transparent",
                            border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>
            {expanded ? <KeyboardArrowDown sx={{ fontSize: 16 }} /> : <KeyboardArrowRight sx={{ fontSize: 16 }} />}
          </button>
        )}
        <button onClick={() => {
          if (!confirm(`Slett "${project.title}" fra listen? (Arkivfilen forblir på disk.)`)) return;
          onRemove(project.picksPath);
        }} title="Fjern fra listen"
                style={{ padding: "0 12px", color: "var(--text-dim)", fontSize: 16,
                          background: "transparent", border: "1px solid var(--border)",
                          borderRadius: 8, cursor: "pointer" }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </button>
      </div>
      {expanded && activity.length > 0 && (
        <div style={{ marginTop: 6, marginLeft: 36, marginBottom: 4, padding: 8,
                       background: "var(--bg-3)", borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, marginBottom: 6 }}>
            Utført på prosjektet:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {activity.slice(0, 15).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 11 }}>
                <span style={{ minWidth: 18, display: "inline-flex", alignItems: "center" }}>
                  <ActivityIcon name={ACTIVITY_ICONS[a.kind] || "Circle"} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>{a.label}</div>
                  {a.summary && (
                    <div style={{ fontSize: 10, opacity: 0.6, overflow: "hidden",
                                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.summary}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 10, opacity: 0.5, whiteSpace: "nowrap" }}>
                  {formatRelativeTime(a.ts)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Record a started project — kept in localStorage so HomeView can show it. */
export function recordRecentProject(p: Omit<RecentProject, "startedAt" | "status"> & Partial<Pick<RecentProject, "startedAt" | "status">>): void {
  try {
    const existing = loadRecentProjects();
    const entry: RecentProject = {
      ...p,
      startedAt: p.startedAt ?? Date.now(),
      status: p.status ?? "in_progress",
    };
    // Dedupe by templateId+sourceLabel — keep most recent
    const filtered = existing.filter(
      (r) => !(r.templateId === entry.templateId && r.sourceLabel === entry.sourceLabel),
    );
    const updated = [entry, ...filtered].slice(0, 20);
    localStorage.setItem("trrpa.recentProjects", JSON.stringify(updated));
  } catch {
    // Non-critical
  }
}

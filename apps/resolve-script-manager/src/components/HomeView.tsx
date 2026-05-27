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
  IconWarning,
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
import { RoleRoomProjectSync } from "./RoleRoomProjectSync";
import { executeScript } from "../api";

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
        <h1 className="home-title">Hva vil du lage?</h1>
        <p className="home-subtitle">
          Velg en mal, pek på footage-mappa, og la AI sammenstille en rough cut i Resolve.
        </p>

        {!signedIn && (
          <div className="home-cta-banner" onClick={onSignIn}>
            <IconSparkle />
            <div>
              <strong>Logg inn med Role Room</strong>
              <span> — krever for AI-funksjoner</span>
            </div>
            <IconArrowRight />
          </div>
        )}

        {!resolveConnected && (
          <div className="home-status-banner warning">
            <IconWarning />
            <div>
              DaVinci Resolve er ikke koblet til. Åpne Resolve med et prosjekt før du starter.
            </div>
          </div>
        )}
      </div>

      <button
        className="home-new-project-card"
        onClick={onNewProjectFromFile}
        disabled={!signedIn}
        title={signedIn ? "Velg én ferdig redigert/eksportert video → AI lager picks + identifiserer musikk" : "Logg inn først"}
      >
        <div className="home-new-project-icon">
          <IconSparkle size={24} />
        </div>
        <div className="home-new-project-body">
          <div className="home-new-project-title">+ Nytt prosjekt fra fil</div>
          <div className="home-new-project-desc">
            Velg en video → AI scanner picks, identifiserer musikk, du velger rolle per sang → editor åpner
          </div>
        </div>
        <IconArrowRight />
      </button>

      <div className="home-templates">
        {orderedTemplates.map((t) => {
          const deco = TEMPLATE_DECORATIONS[t.id] ?? { Icon: IconFilmReel, tagline: t.description };
          const Icon = deco.Icon;
          return (
            <button
              key={t.id}
              className="home-template-card"
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

      {saved.length > 0 && (
        <div className="home-recent" style={{ marginTop: 24 }}>
          <div className="home-section-title">Mine prosjekter</div>
          {saved.slice(0, 8).map((p) => (
            <div key={p.picksPath} className="home-recent-item-wrap"
                 style={{ display: "flex", alignItems: "stretch", gap: 4 }}>
              <button
                className="home-recent-item"
                onClick={() => onOpenSavedProject(p.picksPath)}
                title={p.sourceVideo}
                style={{ flex: 1 }}
              >
                <div className="home-recent-status">
                  <IconFilmReel size={14} />
                </div>
                <div className="home-recent-meta">
                  <strong>{p.title}</strong>
                  <span className="card-chip-meta">
                    {p.audioCount ? `${p.audioCount} sang${p.audioCount > 1 ? "er" : ""} · ` : ""}
                    {formatRelativeTime(p.savedAt * 1000)}
                  </span>
                </div>
                <IconArrowRight />
              </button>
              <button
                onClick={() => {
                  if (!confirm(`Slett "${p.title}" fra listen? (Arkivfilen forblir på disk.)`)) return;
                  const next = saved.filter((x) => x.picksPath !== p.picksPath);
                  setSaved(next);
                  localStorage.setItem("trrpa.savedProjects", JSON.stringify(next));
                  localStorage.setItem("trrpa.deletedPicksPaths",
                    JSON.stringify([
                      ...(JSON.parse(localStorage.getItem("trrpa.deletedPicksPaths") || "[]") as string[]),
                      p.picksPath,
                    ])
                  );
                }}
                title="Fjern fra listen"
                style={{ padding: "0 12px", color: "var(--text-dim)", fontSize: 16,
                         background: "transparent", border: "1px solid var(--border)",
                         borderRadius: 8, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

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

      <div className="home-footer-hints">
        <button className="home-link-button" onClick={onOpenAdvanced}>
          Avansert: kjør enkelt-script eller se pipeline-detaljer →
        </button>
      </div>
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

/**
 * UpcomingJobsSidebar — viser kommende feed-plan-jobs fra Role Room.
 *
 * Project-type-agnostisk: fungerer for bryllup, corporate, music-video,
 * content-producer-leveranser osv. Bjarne ser én samlet liste over alle
 * sine kommende deadlines på tvers av plattformer (IG/TikTok/LinkedIn).
 *
 * Klikk på en jobb → auto-load:
 *   - Platform-preset (instagram_reels / tiktok / linkedin / etc.)
 *   - Brand-snapshot (colors, logo, tone of voice)
 *   - Caption + CTA som clientWishes
 *
 * Floating-panel som ligger nede til venstre — kan skjules.
 */

import { useState } from "react";
import { useUpcomingJobs } from "../hooks/useUpcomingJobs";
import type { UpcomingJob } from "../services/upcomingJobsService";

interface Props {
  onJobSelected: (job: UpcomingJob) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  instagram_reels: "IG Reels",
  instagram_story: "IG Story",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  youtube_shorts: "YT Shorts",
  facebook: "Facebook",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#e1306c",
  instagram_reels: "#e1306c",
  tiktok: "#000000",
  linkedin: "#0a66c2",
  youtube: "#ff0000",
  facebook: "#1877f2",
};

function timeUntilLabel(daysUntil: number | null, hoursUntil: number | null): {
  text: string; color: string;
} {
  if (daysUntil == null) return { text: "—", color: "var(--text-3)" };
  if (daysUntil < 0) {
    const overdueDays = Math.abs(daysUntil);
    return {
      text: overdueDays < 1
        ? `${Math.abs(hoursUntil ?? 0)}t for sent`
        : `${overdueDays.toFixed(0)} dager forsinket`,
      color: "#ef4f6f",
    };
  }
  if (daysUntil < 1) {
    return { text: `om ${hoursUntil}t`, color: "#f0a500" };
  }
  if (daysUntil < 3) {
    return { text: `om ${daysUntil.toFixed(0)} dager`, color: "#f0a500" };
  }
  return { text: `om ${daysUntil.toFixed(0)} dager`, color: "var(--text-2)" };
}

function JobCard({ job, onClick }: { job: UpcomingJob; onClick: () => void }) {
  const platformLabel = PLATFORM_LABELS[job.platform.toLowerCase()] ?? job.platform;
  const platformColor = PLATFORM_COLORS[job.platform.toLowerCase()] ?? "#8674a8";
  const deadline = timeUntilLabel(job.daysUntilDeadline, job.hoursUntilDeadline);
  const accent = job.brandSnapshot?.accentColor ?? platformColor;

  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid rgba(255,255,255,0.08)`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: 10,
        marginBottom: 6,
        cursor: "pointer",
        color: "inherit",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
      }}
    >
      {/* Platform pill + deadline */}
      <div style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 4 }}>
        <span style={{
          fontSize: 9.5, fontWeight: 700, textTransform: "uppercase",
          background: platformColor, color: "#fff",
          padding: "1.5px 6px", borderRadius: 3,
        }}>
          {platformLabel}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: deadline.color }}>
          {deadline.text}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2,
                      lineHeight: 1.25,
                      overflow: "hidden", textOverflow: "ellipsis",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {job.title || job.caption.slice(0, 60) || "(uten tittel)"}
      </div>

      {/* Project name + brand */}
      <div style={{ fontSize: 10.5, color: "var(--text-3)",
                      display: "flex", justifyContent: "space-between",
                      gap: 6, marginTop: 4 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis",
                         whiteSpace: "nowrap", flex: 1 }}>
          {job.projectName}
          {job.brandSnapshot?.companyName && job.brandSnapshot.companyName !== job.projectName
            ? ` · ${job.brandSnapshot.companyName}` : ""}
        </span>
        {job.projectKind && (
          <span style={{ opacity: 0.6, fontSize: 9.5 }}>{job.projectKind}</span>
        )}
      </div>
    </button>
  );
}

export function UpcomingJobsSidebar({ onJobSelected }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [days, setDays] = useState(7);
  const { status, jobs, totalJobs, overdueCount, refresh } = useUpcomingJobs({ days });

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Vis planlagte jobber"
        style={{
          position: "fixed", left: 16, bottom: 16, zIndex: 3500,
          background: "rgba(160,48,192,0.18)",
          border: "1px solid rgba(160,48,192,0.4)",
          borderRadius: 8, padding: "8px 12px",
          color: "var(--text-1)", fontSize: 12, fontWeight: 600,
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        📋 {totalJobs} jobber
        {overdueCount > 0 && (
          <span style={{ color: "#ef4f6f", fontSize: 10 }}>· {overdueCount} forsinket</span>
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed", left: 16, bottom: 16, zIndex: 3500,
        width: 320, maxHeight: "70vh",
        display: "flex", flexDirection: "column",
        background: "linear-gradient(180deg, rgba(20,12,40,0.96), rgba(10,5,24,0.96))",
        border: "1px solid rgba(160,48,192,0.35)",
        borderRadius: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
        color: "var(--text-1)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>📋 Planlagte jobber</div>
          <div style={{ fontSize: 10, color: "var(--text-3)" }}>
            {totalJobs} kommende
            {overdueCount > 0 && (
              <span style={{ color: "#ef4f6f", marginLeft: 4 }}>
                · {overdueCount} forsinket
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            style={{
              fontSize: 10, padding: "3px 6px", borderRadius: 4,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "inherit",
            }}>
            <option value={3}>3 dager</option>
            <option value={7}>1 uke</option>
            <option value={14}>2 uker</option>
            <option value={30}>1 mnd</option>
          </select>
          <button onClick={() => void refresh()} title="Oppdater"
                  style={{ background: "transparent", border: 0,
                            color: "var(--text-2)", cursor: "pointer",
                            fontSize: 14, padding: 2 }}>⟳</button>
          <button onClick={() => setCollapsed(true)} title="Minimer"
                  style={{ background: "transparent", border: 0,
                            color: "var(--text-2)", cursor: "pointer",
                            fontSize: 16, padding: 2 }}>−</button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
        {status === "loading" && jobs.length === 0 && (
          <div style={{ textAlign: "center", padding: 20, fontSize: 11,
                          color: "var(--text-3)" }}>
            Laster …
          </div>
        )}
        {status === "unauthenticated" && (
          <div style={{ textAlign: "center", padding: 20, fontSize: 11,
                          color: "var(--text-3)" }}>
            Logg inn til Role Room for å se planlagte jobber
          </div>
        )}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: 12, fontSize: 11,
                          color: "#ef4f6f" }}>
            Kunne ikke laste — prøv igjen
          </div>
        )}
        {status === "ready" && jobs.length === 0 && (
          <div style={{ textAlign: "center", padding: 20, fontSize: 11,
                          color: "var(--text-3)" }}>
            Ingen kommende jobber i feed planner
            <div style={{ marginTop: 4, fontSize: 10, opacity: 0.7 }}>
              Lag posts i Role Room → Feed Plan
            </div>
          </div>
        )}
        {jobs.map(job => (
          <JobCard
            key={`${job.projectId}-${job.postId}`}
            job={job}
            onClick={() => onJobSelected(job)}
          />
        ))}
      </div>
    </div>
  );
}

export default UpcomingJobsSidebar;

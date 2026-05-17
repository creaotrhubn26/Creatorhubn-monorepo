/**
 * Research bootstrap exporters — items #12 (JSON/CSV/PDF export) and
 * #15 (client-side researchVersion tracking).
 *
 * Each exporter takes the RoleRoomAgentProducerBootstrapResult that the
 * "Research Complete" overlay already has in hand and either:
 *   - downloads it as a single file (JSON, CSV)
 *   - vector-draws a one-page summary PDF via jsPDF
 *
 * Version tracking lives here too because both the overlay and the
 * exporter want to stamp the same v1/v2/v3 label on the artifact.
 * Storage is localStorage so the version persists across sessions for
 * the same browser — no DB migration required.
 */

import jsPDF from 'jspdf';
import type { RoleRoomAgentProducerBootstrapResult } from '../services/roleRoomAgentService';

const VERSION_STORE_KEY_PREFIX = 'roleRoom.researchVersions.';
const MAX_VERSIONS_PER_PROJECT = 50;

/** Server-side researchVersion lookup. Calls /research/version-info
 *  which reads the role_room_research_versions table. Returns null on
 *  network/server errors so callers cleanly fall back to the
 *  localStorage counter below. */
export async function fetchServerResearchVersion(
  researchId: string,
): Promise<{ versionNumber: number; totalVersions: number; generatedAt: string } | null> {
  try {
    const response = await fetch(
      `/api/role-room/agent/research/version-info?researchId=${encodeURIComponent(researchId)}`,
      { credentials: 'include' },
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as
      | { success?: boolean; versionNumber?: number; totalVersions?: number; generatedAt?: string }
      | null;
    if (!payload?.success || typeof payload.versionNumber !== 'number') return null;
    return {
      versionNumber: payload.versionNumber,
      totalVersions: payload.totalVersions ?? payload.versionNumber,
      generatedAt: payload.generatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Returns a 1-indexed version number for the given researchId within
 *  the project. The first researchId seen for a project becomes v1, the
 *  next v2, etc. Idempotent: calling with the same researchId twice
 *  returns the same number without inflating the list. Returns null if
 *  either id is missing (we never want to render "Versjon N" without a
 *  stable anchor). Use this as a localStorage fallback when the server
 *  version lookup (fetchServerResearchVersion) returns null. */
export function recordResearchVersion(
  projectId: string | null | undefined,
  researchId: string | null | undefined,
): number | null {
  if (!projectId || !researchId) return null;
  const key = `${VERSION_STORE_KEY_PREFIX}${projectId}`;
  try {
    const raw = localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const existingIndex = list.indexOf(researchId);
    if (existingIndex >= 0) return existingIndex + 1;
    const next = [...list, researchId].slice(-MAX_VERSIONS_PER_PROJECT);
    localStorage.setItem(key, JSON.stringify(next));
    return next.length;
  } catch {
    return null;
  }
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(name: string | null | undefined, fallback = 'research'): string {
  if (!name) return fallback;
  return name
    .normalize('NFKD')
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 60) || fallback;
}

export function exportResearchAsJson(result: RoleRoomAgentProducerBootstrapResult): void {
  const filename = `${sanitizeFilename(result.companyProfile?.companyName)}_research_${result.researchId?.slice(0, 8) ?? 'snapshot'}.json`;
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  triggerDownload(filename, blob);
}

/** CSV escape that handles quotes, commas, and newlines per RFC 4180. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = Array.isArray(value) ? value.join(' | ') : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportResearchAsCsv(result: RoleRoomAgentProducerBootstrapResult): void {
  const profile = result.companyProfile;
  const rows: Array<[string, unknown]> = [
    ['Felt', 'Verdi'],
    ['Bedriftsnavn', profile?.companyName],
    ['Bransje', profile?.industry],
    ['Underbransje', profile?.subIndustry],
    ['Forretningsmodell', profile?.businessModel],
    ['Innholdskategori', profile?.contentCategory],
    ['Produksjonsmetode', profile?.productionApproach],
    ['Nettside', profile?.websiteUrl],
    ['Organisasjonsnummer', profile?.organizationNumber],
    ['Adresse', profile?.probableLocationAddress],
    ['Logo URL', profile?.logoUrl],
    ['Sammendrag', profile?.summary],
    ['Tilbud', profile?.offerings],
    ['Målgruppe', profile?.targetAudience],
    ['Tone-signaler', profile?.toneAndBrandSignals],
    ['', ''],
    ['Tone of voice', result.planningDraft?.brandGuide?.toneOfVoice],
    ['Visuell stil', result.planningDraft?.brandGuide?.visualStyle],
    ['Brand colors', (result.planningDraft?.brandGuide?.colors ?? []).map((c) => `${c.label}:${c.hex}`)],
    ['', ''],
    ['Konkurrenter (antall)', result.competitorAnalysis?.competitors?.length ?? 0],
    ['Lokale muligheter (antall)', result.localPresencePlan?.nearbyOpportunities?.length ?? 0],
    ['Sosiale profiler (antall)', result.socialProfileCandidates?.length ?? 0],
    ['Merch-leverandører (antall)', result.merchSuppliers?.suppliers?.length ?? 0],
    ['', ''],
    ['Research ID', result.researchId],
    ['Generert', result.generatedAt],
    ['Provider', result.provider],
    ['Modell', result.model],
    ['Totaltid (ms)', result.serviceLatencies?.totalMs],
    ['Fallbacks', result.fallbacksUsed],
  ];
  const csv = rows.map(([k, v]) => `${csvCell(k)},${csvCell(v)}`).join('\n');
  // BOM so Excel picks UTF-8 correctly with Norwegian characters
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const filename = `${sanitizeFilename(profile?.companyName)}_research_${result.researchId?.slice(0, 8) ?? 'snapshot'}.csv`;
  triggerDownload(filename, blob);
}

/** Vector-drawn single-page PDF summary. Layout mirrors the overlay so
 *  printed output matches what the user saw on screen: brand bar →
 *  company summary → key metrics → timeline-style metadata → footer. */
export function exportResearchAsPdf(
  result: RoleRoomAgentProducerBootstrapResult,
  versionLabel: string | null = null,
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const usable = pageWidth - margin * 2;
  const palette = result.planningDraft?.brandGuide?.colors ?? [];
  const primaryHex = palette[0]?.hex ?? '#6366f1';
  const accentHex = palette[1]?.hex ?? '#0f172a';

  const hexToRgb = (hex: string): [number, number, number] => {
    const m = /^#?([a-f0-9]{6})$/i.exec(hex);
    if (!m) return [99, 102, 241];
    const v = m[1];
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  };

  // Header bar in the customer's primary brand color
  const [pr, pg, pb] = hexToRgb(primaryHex);
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, pageWidth, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(result.companyProfile?.companyName || 'Research Snapshot', margin, 38);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    [result.companyProfile?.industry, result.companyProfile?.businessModel].filter(Boolean).join(' · ') || '—',
    margin,
    52,
  );

  let y = 88;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Research-snapshot', margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const finishedAt = result.bootstrapFinishedAt
    ? new Date(result.bootstrapFinishedAt).toLocaleString('nb-NO')
    : '—';
  const metaLine = [
    `ID ${result.researchId?.slice(0, 8) ?? '—'}`,
    versionLabel ?? null,
    `Generert ${finishedAt}`,
    `Provider ${result.provider}`,
  ].filter(Boolean).join('   ·   ');
  doc.text(metaLine, margin, y);
  y += 22;

  // Summary block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Sammendrag', margin, y);
  y += 13;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const summary = result.companyProfile?.summary || '—';
  const summaryLines = doc.splitTextToSize(summary, usable);
  doc.text(summaryLines as string[], margin, y);
  y += (summaryLines as string[]).length * 12 + 14;

  // Metrics grid
  doc.setFont('helvetica', 'bold');
  doc.text('Datapunkter', margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  const metrics = [
    ['Konkurrenter', result.competitorAnalysis?.competitors?.length ?? 0],
    ['Lokale muligheter', result.localPresencePlan?.nearbyOpportunities?.length ?? 0],
    ['Sosiale profiler', result.socialProfileCandidates?.length ?? 0],
    ['Merch-leverandører', result.merchSuppliers?.suppliers?.length ?? 0],
    ['Brand-farger', palette.length],
    ['Tilbud', result.companyProfile?.offerings?.length ?? 0],
  ];
  const colWidth = usable / 3;
  metrics.forEach((entry, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = margin + col * colWidth;
    const cellY = y + row * 32;
    doc.setFillColor(241, 245, 249);
    doc.rect(x, cellY, colWidth - 8, 26, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.text(String(entry[0]), x + 8, cellY + 10);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(String(entry[1]), x + 8, cellY + 22);
    doc.setFont('helvetica', 'normal');
  });
  y += Math.ceil(metrics.length / 3) * 32 + 12;

  // Brand palette swatches
  if (palette.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Brand-farger', margin, y);
    y += 12;
    palette.slice(0, 6).forEach((color, idx) => {
      const [r, g, b] = hexToRgb(color.hex);
      const x = margin + idx * 90;
      doc.setFillColor(r, g, b);
      doc.rect(x, y, 24, 24, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(color.hex.toUpperCase(), x + 28, y + 11);
      doc.setTextColor(100, 116, 139);
      doc.text(color.label || '', x + 28, y + 22);
      doc.setTextColor(15, 23, 42);
    });
    y += 36;
  }

  // Tone + visual style
  const tone = result.planningDraft?.brandGuide?.toneOfVoice;
  const visual = result.planningDraft?.brandGuide?.visualStyle;
  if (tone || visual) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Brand voice', margin, y);
    y += 13;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    if (tone) {
      const toneLines = doc.splitTextToSize(`Tone: ${tone}`, usable);
      doc.text(toneLines as string[], margin, y);
      y += (toneLines as string[]).length * 12;
    }
    if (visual) {
      const visualLines = doc.splitTextToSize(`Visuell stil: ${visual}`, usable);
      doc.text(visualLines as string[], margin, y);
      y += (visualLines as string[]).length * 12;
    }
    y += 10;
  }

  // Service latency mini-list
  const latencies = result.serviceLatencies ?? {};
  const latencyEntries = Object.entries(latencies)
    .filter(([k, v]) => k !== 'totalMs' && typeof v === 'number')
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 8);
  if (latencyEntries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Pipeline (totalt ${latencies.totalMs ? `${(latencies.totalMs / 1000).toFixed(1)} s` : '—'})`, margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    latencyEntries.forEach(([key, ms]) => {
      const msNum = ms as number;
      const label = `${key}`;
      doc.text(`${label}`, margin, y);
      doc.text(`${msNum} ms`, pageWidth - margin, y, { align: 'right' });
      y += 11;
    });
    y += 8;
  }

  // Footer bar
  const [ar, ag, ab] = hexToRgb(accentHex);
  doc.setFillColor(ar, ag, ab);
  doc.rect(0, doc.internal.pageSize.getHeight() - 22, pageWidth, 22, 'F');
  doc.setTextColor(241, 245, 249);
  doc.setFontSize(8);
  doc.text(
    `Role Room Agent · ${result.provider} · ${result.model}`,
    margin,
    doc.internal.pageSize.getHeight() - 8,
  );

  const filename = `${sanitizeFilename(result.companyProfile?.companyName)}_research_${result.researchId?.slice(0, 8) ?? 'snapshot'}.pdf`;
  doc.save(filename);
}

/**
 * useStripboardData.ts
 * Handles all async data loading plus import / export operations.
 *
 * Responsibilities:
 *  - Fetch strips, shooting days and cast from the service layer
 *  - Fall back to demo data when the API returns nothing or throws
 *  - JSON import (file reader)
 *  - JSON / CSV export
 *  - Print-window generation (PDF)
 */

import { useState, useCallback, useRef, type ChangeEvent } from 'react';
import {
  productionWorkflowService,
  type StripboardStrip,
  type ShootingDay,
  type CastMember,
} from '../../services/productionWorkflowService';
import { DEMO_STRIPS, DEMO_SHOOTING_DAYS } from './stripboard.mockData';
import { STRIP_COLORS, STATUS_CONFIG, getStripColorFromHex } from './stripboard.constants';
import type { StripsByDay, PrintOptions, StripboardStats } from './stripboard.types';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStripboardData(projectId: string, projectTitle: string) {
  const [strips, setStrips] = useState<StripboardStrip[]>([]);
  const [shootingDays, setShootingDays] = useState<ShootingDay[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [loading, setLoading] = useState(true);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadStripboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [stripData, dayData, castData] = await Promise.all([
        productionWorkflowService.getStripboard(projectId),
        productionWorkflowService.getShootingDays(projectId),
        productionWorkflowService.getCast(projectId),
      ]);
      setStrips(stripData?.length  ? stripData  : DEMO_STRIPS);
      setShootingDays(dayData?.length ? dayData  : DEMO_SHOOTING_DAYS);
      setCast(castData || []);
    } catch {
      setStrips(DEMO_STRIPS);
      setShootingDays(DEMO_SHOOTING_DAYS);
      setCast([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // ── Import / Export ───────────────────────────────────────────────────────

  const handleImportJSON = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const importedDays: ShootingDay[] = Array.isArray(raw.shootingDays)
          ? raw.shootingDays.map(({ strips: _s, ...day }: any) => day)
          : [];
        const importedStrips: StripboardStrip[] = [];
        if (Array.isArray(raw.shootingDays)) {
          raw.shootingDays.forEach((day: any) => {
            if (Array.isArray(day.strips)) {
              day.strips.forEach((s: StripboardStrip) =>
                importedStrips.push({ ...s, shootingDayId: day.id, dayNumber: day.dayNumber }),
              );
            }
          });
        }
        if (Array.isArray(raw.unassignedStrips)) {
          raw.unassignedStrips.forEach((s: StripboardStrip) =>
            importedStrips.push({ ...s, shootingDayId: undefined, dayNumber: undefined }),
          );
        }
        if (importedDays.length)  setShootingDays(importedDays);
        if (importedStrips.length) setStrips(importedStrips);
      } catch {
        alert('Ugyldig filformat for stripboard-import.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }, []);

  const handleExportJSON = useCallback((stats: StripboardStats) => {
    const data = {
      projectId, projectTitle,
      exportDate: new Date().toISOString(),
      shootingDays: shootingDays.map(day => ({
        ...day,
        strips: strips.filter(s => s.shootingDayId === day.id),
      })),
      unassignedStrips: strips.filter(s => !s.shootingDayId),
      statistics: stats,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stripboard-${projectTitle.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [projectId, projectTitle, shootingDays, strips]);

  const handleExportCSV = useCallback(() => {
    const rows = [
      ['Scene', 'Lokasjon', 'INT/EXT', 'Sider', 'Tid (min)', 'Cast', 'Status', 'Dag', 'Dato', 'Notater'],
    ];
    strips.forEach(strip => {
      const day = shootingDays.find(d => d.id === strip.shootingDayId);
      const colorKey = getStripColorFromHex(strip.color);
      rows.push([
        strip.sceneNumber, strip.location,
        STRIP_COLORS[colorKey]?.label || '',
        strip.pages.toString(), strip.estimatedTime.toString(),
        strip.cast.join('; '), STATUS_CONFIG[strip.status]?.label ?? strip.status,
        day?.dayNumber?.toString() || 'Ikke planlagt',
        day?.date || '', strip.notes || '',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stripboard-${projectTitle.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [projectTitle, strips, shootingDays]);

  /** Opens a new print window with a self-contained HTML stripboard document. */
  const handleConfirmPrint = useCallback(
    (printOptions: PrintOptions, stripsByDay: StripsByDay[], stats: StripboardStats) => {
      const pw = window.open('', '_blank');
      if (!pw) { alert('Kunne ikke åpne utskriftsvindu. Vennligst tillat popups.'); return; }

      const genStrips = (dayStrips: StripboardStrip[]) =>
        dayStrips.map(strip => {
          const ck = getStripColorFromHex(strip.color);
          const cc = STRIP_COLORS[ck];
          return `<div class="strip" style="background:${strip.color};color:${cc.textColor};">
            <div class="strip-header">
              <span class="scene-num">Scene ${strip.sceneNumber}</span>
              <span class="strip-type">${cc.label}</span>
              <span class="strip-pages">${strip.pages}p</span>
              <span class="strip-time">${Math.floor(strip.estimatedTime / 60)}t ${strip.estimatedTime % 60}m</span>
              <span class="strip-status">${STATUS_CONFIG[strip.status]?.label ?? strip.status}</span>
            </div>
            <div class="strip-location">${strip.location}</div>
            ${printOptions.castInfo && strip.cast.length ? `<div class="strip-cast">Cast: ${strip.cast.join(', ')}</div>` : ''}
            ${printOptions.notes && strip.notes ? `<div class="strip-notes">📝 ${strip.notes}</div>` : ''}
          </div>`;
        }).join('');

      const daysHTML = stripsByDay.map(d => {
        if (d.dayId === null && !printOptions.unassignedScenes) return '';
        if (d.dayId !== null && !printOptions.scheduledDays)    return '';
        const isUnassigned = d.dayId === null;
        return `<div class="day-group">
          <div class="day-header" style="background:${isUnassigned ? '#f3e8ff' : '#7C3AED'};color:${isUnassigned ? '#1a1a1a' : '#fff'};">
            <h3>${isUnassigned ? '📋 Ikke planlagt' : `Dag ${d.dayNumber}`}</h3>
            ${!isUnassigned && d.date ? `<span class="day-date">${new Date(d.date).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}</span>` : ''}
            <span class="day-stats">${d.strips.length} scener • ${d.totalPages}p • ${Math.floor(d.totalTime / 60)}t ${d.totalTime % 60}m</span>
          </div>
          <div class="strips-container">${genStrips(d.strips)}</div>
        </div>`;
      }).join('');

      const legendHTML = printOptions.legend ? `<div class="legend"><h4>Fargeforklaring</h4><div class="legend-items">
        ${Object.entries(STRIP_COLORS).map(([, c]) => `<div class="legend-item"><span class="legend-color" style="background:${c.bg};"></span><span>${c.label}</span></div>`).join('')}
      </div></div>` : '';

      const statsHTML = printOptions.stats ? `<div class="stats-bar">
        <div class="stat"><span class="stat-value">${stats.total}</span><span class="stat-label">Totalt scener</span></div>
        <div class="stat"><span class="stat-value" style="color:#10b981;">${stats.shot}</span><span class="stat-label">Skutt</span></div>
        <div class="stat"><span class="stat-value">${stats.scheduled}</span><span class="stat-label">Planlagt</span></div>
        <div class="stat"><span class="stat-value">${stats.totalPages}</span><span class="stat-label">Sider</span></div>
        <div class="stat"><span class="stat-value">${Math.floor(stats.totalTime / 60)}t ${stats.totalTime % 60}m</span><span class="stat-label">Total tid</span></div>
      </div>` : '';

      pw.document.write(`<!DOCTYPE html><html><head><title>Stripboard - ${projectTitle}</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:'Inter','Segoe UI',sans-serif;font-size:11px;line-height:1.4;padding:20px;color:#1a1a1a}
          .header{text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:3px solid #7C3AED}
          .header h1{font-size:28px;font-weight:700} .header h2{font-size:14px;color:#7C3AED;font-weight:600}
          .branding{font-size:10px;color:#666;margin-top:8px} .branding strong{color:#7C3AED}
          .stats-bar{display:flex;justify-content:center;gap:30px;background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px}
          .stat{text-align:center} .stat-value{font-size:20px;font-weight:700;color:#7C3AED;display:block}
          .stat-label{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px}
          .legend{background:#f8f9fa;padding:12px 15px;border-radius:8px;margin-bottom:20px}
          .legend h4{font-size:11px;color:#666;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px}
          .legend-items{display:flex;flex-wrap:wrap;gap:12px}
          .legend-item{display:flex;align-items:center;gap:6px}
          .legend-color{width:20px;height:14px;border-radius:3px;border:1px solid rgba(0,0,0,.1)}
          .day-group{margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;page-break-inside:avoid}
          .day-header{padding:12px 16px;display:flex;align-items:center;gap:15px;flex-wrap:wrap}
          .day-header h3{font-size:16px;font-weight:700} .day-date{font-size:12px;opacity:.9} .day-stats{font-size:11px;opacity:.8;margin-left:auto}
          .strips-container{padding:12px;background:#fafafa}
          .strip{padding:10px 12px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(0,0,0,.1)}
          .strip-header{display:flex;align-items:center;gap:10px;margin-bottom:6px}
          .scene-num{font-weight:700;font-size:13px}
          .strip-type{font-size:9px;padding:2px 6px;background:rgba(0,0,0,.1);border-radius:3px}
          .strip-pages,.strip-time{font-size:10px;opacity:.8}
          .strip-location{font-size:11px;margin-bottom:4px}
          .strip-cast{font-size:10px;opacity:.85;margin-top:4px}
          .strip-notes{font-size:10px;font-style:italic;opacity:.8;margin-top:4px}
          .strip-status{font-size:9px;padding:2px 6px;background:rgba(0,0,0,.08);border-radius:3px;margin-left:auto;font-weight:600}
          .footer{margin-top:30px;padding-top:15px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#7C3AED}
          @media print{body{padding:10px} .day-group{page-break-inside:avoid}}
        </style>
      </head><body>
        ${printOptions.header ? `<div class="header"><h1>${projectTitle}</h1><h2>Stripboard / Opptaksplan</h2><div class="branding">Generert med <strong>The Role Room</strong> • ${new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>` : ''}
        ${statsHTML}${legendHTML}${daysHTML}
        <div class="footer">Generert med The Role Room • theroleroom.com</div>
      </body></html>`);
      pw.document.close();
      setTimeout(() => pw.print(), 250);
    },
    [projectTitle],
  );

  return {
    strips, setStrips,
    shootingDays, setShootingDays,
    cast, setCast,
    loading,
    importInputRef,
    loadStripboardData,
    handleImportJSON,
    handleExportJSON,
    handleExportCSV,
    handleConfirmPrint,
  };
}

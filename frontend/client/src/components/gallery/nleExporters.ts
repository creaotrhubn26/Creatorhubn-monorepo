/**
 * NLE-eksportører for klient-tilbakemelding (Slice 9X.83).
 *
 * Bjarne sitter i DaVinci Resolve eller Adobe Premiere og laster ned en
 * fil her som inneholder ALLE timecode-kommentarer fra klient som
 * markørene på timelinen. Da slipper han å lese gjennom CreatorHub UI.
 *
 * Formater:
 *  - EDL (CMX 3600)          — Resolve, Premiere, Avid, FCP
 *  - FCPXML 1.9              — Resolve 16+, Premiere CC, FCP X
 *  - Markers CSV             — Resolve via Workflow Integration / Premiere panels
 *
 * Antakelse: 25 fps (PAL/EU-standard). Klipp-start = 00:00:00:00. Hvis
 * Bjarne har klipp-start på et annet timecode kan han offsete i NLE-en.
 *
 * Farger pr. priority:
 *   must-fix     → RED       (haster — må fikses)
 *   nice-to-have → YELLOW    (ønske — gjør hvis tid)
 *   suggestion   → GREEN     (forslag — vurder)
 *   resolved     → BLUE      (kvittert — ferdig)
 */

const FPS = 25;

export interface NLEFeedbackEntry {
  id: string;
  timecodeSec: number;
  endTimecodeSec?: number | null;
  comment: string;
  category?: string | null;
  priority?: 'must-fix' | 'nice-to-have' | 'suggestion' | null;
  status?: 'open' | 'resolved' | 'archived' | null;
  suggestedMediaUrl?: string | null;
  suggestedMediaLabel?: string | null;
  suggestedMediaFromSec?: number | null;
  suggestedMediaToSec?: number | null;
}

interface ExportContext {
  projectTitle?: string | null;
  clientName?: string | null;
  fps?: number;
}

/** Sek → "HH:MM:SS:FF" non-drop, klampet til ≥0 */
function secToTC(sec: number, fps = FPS): string {
  const total = Math.max(0, Math.round(sec * fps));
  const ff = total % fps;
  const totalSec = Math.floor(total / fps);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60) % 60;
  const hh = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

function priorityColor(priority?: string | null, status?: string | null): {
  edl: string;
  fcpxml: string;
  resolve: 'Red' | 'Yellow' | 'Green' | 'Blue' | 'Cyan' | 'Magenta' | 'Cream';
} {
  if (status === 'resolved') return { edl: 'BLUE', fcpxml: '0 0 1 1', resolve: 'Blue' };
  if (priority === 'must-fix') return { edl: 'RED', fcpxml: '1 0 0 1', resolve: 'Red' };
  if (priority === 'nice-to-have') return { edl: 'YELLOW', fcpxml: '1 1 0 1', resolve: 'Yellow' };
  return { edl: 'GREEN', fcpxml: '0 1 0 1', resolve: 'Green' };
}

function fmtTimeShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sanitizeLine(s: string): string {
  // EDL/CSV-trygt: én linje, ingen kontroll-tegn
  return s.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildCommentLine(e: NLEFeedbackEntry): string {
  const parts: string[] = [];
  if (e.category) parts.push(e.category.toUpperCase());
  if (e.priority) parts.push(e.priority.toUpperCase());
  parts.push(e.comment);
  let line = parts.join(' | ');
  if (e.suggestedMediaUrl) {
    const label = e.suggestedMediaLabel || 'Sang-forslag';
    const range = e.suggestedMediaFromSec != null
      ? ` @ ${fmtTimeShort(e.suggestedMediaFromSec)}${e.suggestedMediaToSec != null ? '–' + fmtTimeShort(e.suggestedMediaToSec) : ''}`
      : '';
    line += `  ♪ ${label}${range}  ${e.suggestedMediaUrl}`;
  }
  return sanitizeLine(line);
}

/* ── EDL (CMX 3600) ─────────────────────────────────────────────────
 *
 * Resolve: File > Import > Timeline > Pre-Conformed EDL
 * Premiere: File > Import > velg .edl
 *
 * Vi bruker null-lengde-klipp (in == out) som markør-bærere. Comment-
 * linjer (* COMMENT:) festes til hver event.
 *
 * NB: EDL-format krever 3-sifret event-nummer (001, 002, ...) og
 * fast-bredde kolonner. Vi prøver å være standard-compliant uten å
 * gå overbord — Resolve og Premiere er forgivende.
 */
export function generateEDL(entries: NLEFeedbackEntry[], ctx: ExportContext = {}): string {
  const lines: string[] = [];
  const title = ctx.projectTitle || 'CreatorHub feedback';
  lines.push(`TITLE: ${sanitizeLine(title)}`);
  lines.push('FCM: NON-DROP FRAME');
  lines.push('');

  const sorted = [...entries].sort((a, b) => a.timecodeSec - b.timecodeSec);
  sorted.forEach((e, idx) => {
    const num = String(idx + 1).padStart(3, '0');
    const startTC = secToTC(e.timecodeSec, ctx.fps);
    const endTC = secToTC(e.endTimecodeSec != null ? e.endTimecodeSec : e.timecodeSec + 1 / FPS, ctx.fps);
    const color = priorityColor(e.priority, e.status);
    // standard EDL-event-rad: id reel  track  type  src-in  src-out  rec-in  rec-out
    lines.push(`${num}  001      V     C        ${startTC} ${endTC} ${startTC} ${endTC}`);
    lines.push(`* FROM CLIP NAME: CREATORHUB-FEEDBACK`);
    lines.push(`* COLOR: ${color.edl}`);
    lines.push(`* COMMENT: ${buildCommentLine(e)}`);
    if (ctx.clientName) lines.push(`* CLIENT: ${sanitizeLine(ctx.clientName)}`);
    lines.push('');
  });

  return lines.join('\n');
}

/* ── FCPXML 1.9 ─────────────────────────────────────────────────────
 *
 * Resolve 16+: File > Import > Timeline > XML/FCPXML
 * Premiere: File > Import > velg .fcpxml
 *
 * Vi pakker alle markørene som <marker>-elementer på et placeholder-
 * klipp som varer en time. Når Bjarne importerer XMLen får han ett
 * tomt klipp på timeline med alle markørene plassert på riktig sek.
 * Han kan så aligne det med sitt rendrede master-klipp (drag-snap).
 *
 * `value`-attributten på marker viser i NLE-en som markør-tekst.
 * `completed` kan settes til true for resolved-status.
 */
export function generateFCPXML(entries: NLEFeedbackEntry[], ctx: ExportContext = {}): string {
  const fps = ctx.fps || FPS;
  const frameDuration = `1/${fps}s`;
  const title = ctx.projectTitle || 'CreatorHub feedback';
  const eventName = ctx.clientName ? `CreatorHub — ${ctx.clientName}` : 'CreatorHub feedback';

  // Placeholder-spine på 1 time (3600s) så markørene ikke faller utenfor klippet
  const spineDuration = '3600s';

  const escapeXml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const markerXml = entries
    .slice()
    .sort((a, b) => a.timecodeSec - b.timecodeSec)
    .map((e) => {
      const startFrames = Math.round(e.timecodeSec * fps);
      const start = `${startFrames}/${fps}s`;
      const durFrames =
        e.endTimecodeSec != null && e.endTimecodeSec > e.timecodeSec
          ? Math.round((e.endTimecodeSec - e.timecodeSec) * fps)
          : 1;
      const duration = `${durFrames}/${fps}s`;
      const completed = e.status === 'resolved' ? '1' : '0';
      const value = escapeXml(buildCommentLine(e));
      // Bruker chapter-marker for resolved (mørkere ikon), vanlig marker for åpne
      return `        <marker start="${start}" duration="${duration}" value="${value}" completed="${completed}"/>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080p${fps}" frameDuration="${frameDuration}" width="1920" height="1080"/>
  </resources>
  <library>
    <event name="${escapeXml(eventName)}">
      <project name="${escapeXml(title)}">
        <sequence format="r1" duration="${spineDuration}" tcStart="0s" tcFormat="NDF">
          <spine>
            <gap name="CreatorHub feedback placeholder" offset="0s" start="0s" duration="${spineDuration}">
${markerXml}
            </gap>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

/* ── Markers CSV ────────────────────────────────────────────────────
 *
 * Resolve har Workflow Integrations som leser CSV; Premiere har
 * tredjeparts-paneler (Marker Importer av Jarle Leirpoll, Productive
 * Editor). Format: standard "Resolve Marker List"-CSV.
 *
 * Header: #,Color,Notes,In,Out,Duration
 *
 * Komma i kommentar håndteres via "..."-quoting.
 */
export function generateMarkersCSV(entries: NLEFeedbackEntry[], ctx: ExportContext = {}): string {
  const rows: string[] = [];
  rows.push('#,Color,Notes,In,Out,Duration');
  const sorted = [...entries].sort((a, b) => a.timecodeSec - b.timecodeSec);
  sorted.forEach((e, idx) => {
    const start = secToTC(e.timecodeSec, ctx.fps);
    const end = secToTC(e.endTimecodeSec != null ? e.endTimecodeSec : e.timecodeSec, ctx.fps);
    const dur = secToTC(
      e.endTimecodeSec != null ? Math.max(0, e.endTimecodeSec - e.timecodeSec) : 0,
      ctx.fps,
    );
    const color = priorityColor(e.priority, e.status).resolve;
    const note = buildCommentLine(e).replace(/"/g, '""');
    rows.push(`${idx + 1},${color},"${note}",${start},${end},${dur}`);
  });
  return rows.join('\n');
}

/* ── Filnavn-helpers ────────────────────────────────────────────────
 */
export function safeFilenameBase(projectTitle?: string | null, clientName?: string | null): string {
  const parts = [projectTitle, clientName].filter(Boolean).join(' - ');
  const base = parts || 'creatorhub-feedback';
  return base
    .toLowerCase()
    .replace(/[æå]/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Trigger nettleser-download av en tekst-fil */
export function downloadAsFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

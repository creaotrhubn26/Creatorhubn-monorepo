/**
 * ExportsPanel — eksport (Arcweave-JSON, Markdown, standalone HTML), import
 * fra Arcweave og delbare spill-lenker.
 *
 * Nedlastingene bygges klient-side fra det delte format-laget (samme kode
 * som backend/MCP), så de virker uten ekstra kall og uten nett. Import går
 * via server (revisjon «Før import» + erstatning av hele grafen).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton,
  InputLabel, List, ListItem, ListItemText, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Code as EmbedIcon,
  ContentCopy as CopyIcon,
  DataObject as JsonIcon,
  Description as MarkdownIcon,
  Language as HtmlIcon,
  LinkOff as RevokeIcon,
  PictureAsPdf as PdfIcon,
  Share as ShareIcon,
  TableChart as CsvIcon,
  UploadFile as ImportIcon,
} from '@mui/icons-material';
import {
  ArcweaveImportError, InkImportError, TweeImportError, IMPORT_FORMAT_LABELS, buildStandaloneHtml, exportFileStem,
  fromArcweaveProject, fromInk, fromTwee, sniffImportFormat, toArcweaveProject, toCsv, toMarkdown, SUGGESTED_LOCALES, type ImportFormat,
} from '@shared/narrative-format';
import * as api from '../narrativeService';
import {
  NARRATIVE_SHARE_MODES, SHARE_MODE_LABELS,
  type NarrativeGraph, type NarrativeImportWarning, type NarrativeShareLink, type NarrativeShareMode,
} from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';
import { PlanGateBanner } from '../../game/GameBillingPanels';
import { useGamePlanGate } from '../../game/useGamePlanGate';

export interface ExportsPanelProps {
  projectId: string;
  graph: NarrativeGraph;
  onImported: (graph: NarrativeGraph) => void;
  onNotice: (message: string, severity: 'success' | 'error' | 'warning') => void;
}

const PLAYER_JS_URL = '/embed/narrative-player.js';

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)' },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
  '& .MuiSvgIcon-root': { color: narrativeColors.textDim },
};

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function downloadText(text: string, filename: string, mime: string): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function linkStatus(link: NarrativeShareLink): { label: string; color: string } {
  if (link.revokedAt) return { label: 'Tilbakekalt', color: narrativeColors.error };
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return { label: 'Utløpt', color: narrativeColors.warning };
  return { label: 'Aktiv', color: narrativeColors.accent };
}

const Section: React.FC<{ title: string; hint: string; children: React.ReactNode; testId: string }> = ({ title, hint, children, testId }) => (
  <Box sx={{ border: `1px solid ${narrativeColors.borderStrong}`, borderRadius: 1.5, bgcolor: narrativeColors.bgPanel, p: 2 }} data-testid={testId}>
    <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.25 }}>{title}</Typography>
    <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, mb: 1.5 }}>{hint}</Typography>
    {children}
  </Box>
);

interface ImportPreview {
  fileName: string;
  format: ImportFormat;
  body: api.ImportBody;
  counts: { boards: number; elements: number; connections: number; components: number; variables: number };
  warnings: NarrativeImportWarning[];
}

export function ExportsPanel({ projectId, graph, onImported, onNotice }: ExportsPanelProps) {
  const fileStem = useMemo(() => exportFileStem(graph.settings.title), [graph.settings.title]);
  const playerJsRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importWarnings, setImportWarnings] = useState<NarrativeImportWarning[]>([]);
  const [links, setLinks] = useState<NarrativeShareLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [mode, setMode] = useState<NarrativeShareMode>('play_only');
  const [expiry, setExpiry] = useState<'never' | '7' | '30' | '90'>('never');
  const [freshLink, setFreshLink] = useState<{ url: string; mode: NarrativeShareMode } | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const locales = graph.settings.locales?.length ? graph.settings.locales : ['nb'];
  const [exportLocale, setExportLocale] = useState<string>('nb');
  // Plan-gating (Fase 4d): serveren gater med 402; UI låser knappene og viser banner.
  const gate = useGamePlanGate();
  const canHtml = gate.has('export_html');
  const canPdf = gate.has('export_pdf');
  const canShare = gate.has('share_links');
  const canTextImport = gate.has('import_twine_ink');
  const localeSuffix = exportLocale !== 'nb' ? `-${exportLocale}` : '';

  const loadLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      setLinks(await api.listShareLinks(projectId));
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Kunne ikke hente delingslenker.', 'error');
    } finally {
      setLinksLoading(false);
    }
  }, [projectId, onNotice]);

  useEffect(() => { void loadLinks(); }, [loadLinks]);

  // ── Eksport ─────────────────────────────────────────────────────────
  const exportJson = () => {
    downloadText(JSON.stringify(toArcweaveProject(graph, { locale: exportLocale }), null, 2), `${fileStem}${localeSuffix}.json`, 'application/json');
    onNotice('Arcweave-JSON lastet ned.', 'success');
  };
  const exportMarkdown = () => {
    downloadText(toMarkdown(graph, { locale: exportLocale }), `${fileStem}${localeSuffix}.md`, 'text/markdown;charset=utf-8');
    onNotice('Markdown lastet ned.', 'success');
  };
  const exportCsv = () => {
    downloadText(toCsv(graph, { locale: exportLocale }), `${fileStem}${localeSuffix}.csv`, 'text/csv;charset=utf-8');
    onNotice('CSV lastet ned — åpnes rett i Excel/Numbers (skilletegn «;»).', 'success');
  };
  const exportScenesPdf = async () => {
    setBusy('scenes-pdf');
    try {
      const { blob, filename } = await api.exportScenesPdf(projectId);
      downloadBlob(blob, filename ?? `${fileStem}-manus.pdf`);
      onNotice('Manus-PDF lastet ned.', 'success');
    } catch (err) {
      if (err instanceof api.NarrativeApiError && err.code === 'plan_required') {
        onNotice('PDF-eksport krever Pro eller Studio — se «Pris»-fanen.', 'warning');
      } else {
        onNotice(err instanceof Error ? err.message : 'Manus-PDF feilet.', 'error');
      }
    } finally {
      setBusy(null);
    }
  };
  const exportPdf = async () => {
    setBusy('pdf');
    try {
      const { blob, filename } = await api.exportPdf(projectId, exportLocale);
      downloadBlob(blob, filename ?? `${fileStem}${localeSuffix}.pdf`);
      onNotice('PDF lastet ned.', 'success');
    } catch (err) {
      if (err instanceof api.NarrativeApiError && err.code === 'plan_required') {
        onNotice('PDF-eksport krever Pro eller Studio — se «Pris»-fanen.', 'warning');
      } else {
        onNotice(err instanceof Error ? err.message : 'PDF-eksport feilet.', 'error');
      }
    } finally {
      setBusy(null);
    }
  };
  const exportHtml = async () => {
    setBusy('html');
    try {
      if (!playerJsRef.current) {
        const res = await fetch(PLAYER_JS_URL, { credentials: 'omit' });
        if (!res.ok) throw new Error('Fant ikke spiller-skriptet (embed/narrative-player.js).');
        playerJsRef.current = await res.text();
      }
      const html = buildStandaloneHtml({ title: graph.settings.title, graph, playerJs: playerJsRef.current, locale: exportLocale });
      downloadText(html, `${fileStem}${localeSuffix}.html`, 'text/html;charset=utf-8');
      onNotice('Spillbar HTML lastet ned — åpnes lokalt uten nett.', 'success');
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Kunne ikke bygge HTML.', 'error');
    } finally {
      setBusy(null);
    }
  };

  // ── Import ──────────────────────────────────────────────────────────
  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setImportWarnings([]);
    try {
      const text = await file.text();
      const format = sniffImportFormat(file.name, text);
      if (!format) throw new ArcweaveImportError('Kjenner ikke igjen formatet — bruk Arcweave project.json, Twine .twee eller Ink .ink.');
      const title = file.name.replace(/\.[^.]+$/, '');
      let body: api.ImportBody;
      let local: { graph: NarrativeGraph; warnings: NarrativeImportWarning[] };
      // Forhåndsvisning lokalt (samme kode som serveren bruker) — viser hva som kommer.
      if (format === 'arcweave') {
        const parsed = JSON.parse(text) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ArcweaveImportError('Fila er ikke et JSON-objekt.');
        const project = parsed as Record<string, unknown>;
        body = { format, project };
        local = fromArcweaveProject(project, { projectId }) as unknown as typeof local;
      } else {
        body = { format, source: text, title };
        local = (format === 'twee' ? fromTwee(text, { projectId, title }) : fromInk(text, { projectId, title })) as unknown as typeof local;
      }
      setPreview({
        fileName: file.name,
        format,
        body,
        counts: {
          boards: local.graph.boards.length, elements: local.graph.elements.length, connections: local.graph.connections.length,
          components: local.graph.components.length, variables: local.graph.variables.length,
        },
        warnings: local.warnings,
      });
    } catch (err) {
      const message = err instanceof ArcweaveImportError || err instanceof TweeImportError || err instanceof InkImportError ? err.message
        : err instanceof SyntaxError ? 'Fila er ikke gyldig JSON.'
          : err instanceof Error ? err.message : 'Kunne ikke lese fila.';
      onNotice(message, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setBusy('import');
    try {
      const result = await api.importProject(projectId, preview.body);
      onImported(result.graph);
      setImportWarnings(result.warnings);
      onNotice(`Importert «${preview.fileName}». Forrige versjon er lagret i Historikk.`, 'success');
      setPreview(null);
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Import feilet.', 'error');
    } finally {
      setBusy(null);
    }
  };

  // ── Deling ──────────────────────────────────────────────────────────
  const createLink = async () => {
    setBusy('share');
    try {
      const expiresInDays = expiry === 'never' ? null : Number(expiry);
      const { path, link } = await api.createShareLink(projectId, { mode, expiresInDays });
      setFreshLink({ url: `${window.location.origin}${path}`, mode: link.mode });
      await loadLinks();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Kunne ikke opprette lenke.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const copyFresh = async () => {
    if (!freshLink) return;
    try {
      await navigator.clipboard.writeText(freshLink.url);
      onNotice('Lenken er kopiert.', 'success');
    } catch {
      onNotice('Kunne ikke kopiere — marker og kopier lenken manuelt.', 'warning');
    }
  };

  // Embed-snutt: iframe mot /story/:token?embed=1 (uten toppstripe). Råtokenet finnes
  // bare rett etter opprettelse (kun hash lagres), derfor kun for freshLink.
  const embedCode = freshLink
    ? `<iframe src="${freshLink.url}?embed=1${exportLocale !== 'nb' ? `&locale=${encodeURIComponent(exportLocale)}` : ''}" style="width:100%;max-width:720px;height:640px;border:0;border-radius:12px;background:#050505" title="${(graph.settings.title || 'Story Graph').replace(/"/g, '&quot;')}" loading="lazy" allowfullscreen></iframe>`
    : '';
  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 1800);
    } catch {
      onNotice('Kunne ikke kopiere — marker og kopier koden manuelt.', 'warning');
    }
  };

  const revoke = async (link: NarrativeShareLink) => {
    setBusy(`revoke-${link.id}`);
    try {
      const updated = await api.revokeShareLink(projectId, link.id);
      setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      onNotice('Lenken er tilbakekalt.', 'success');
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Kunne ikke tilbakekalle.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const empty = graph.elements.length === 0;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, color: narrativeColors.text, maxWidth: 960 }} data-testid="narrative-exports-panel">
      <Stack spacing={2}>
        <Section
          testId="narrative-exports-download"
          title="Last ned"
          hint="Arcweave-kompatibel JSON virker rett i Arcweaves Unity-, Godot- og Unreal-plugins. CSV gir én rad per element for regneark. HTML-fila er en spillbar versjon som åpnes lokalt. PDF er et lesbart manus (Pro/Studio)."
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            {locales.length > 1 ? (
              <FormControl size="small" sx={{ minWidth: 150, ...fieldSx }}>
                <InputLabel id="narrative-export-locale-label">Språk</InputLabel>
                <Select labelId="narrative-export-locale-label" label="Språk" value={exportLocale} onChange={(e) => setExportLocale(String(e.target.value))} data-testid="narrative-export-locale">
                  {locales.map((code) => <MenuItem key={code} value={code}>{SUGGESTED_LOCALES.find((l) => l.code === code)?.label ?? code}</MenuItem>)}
                </Select>
              </FormControl>
            ) : null}
            <Button variant="outlined" startIcon={<JsonIcon />} onClick={exportJson} disabled={empty} sx={{ color: narrativeColors.accent, borderColor: narrativeColors.borderStrong }} data-testid="narrative-export-json">
              JSON (Arcweave)
            </Button>
            <Button variant="outlined" startIcon={<MarkdownIcon />} onClick={exportMarkdown} disabled={empty} sx={{ color: narrativeColors.text, borderColor: narrativeColors.borderStrong }} data-testid="narrative-export-markdown">
              Markdown
            </Button>
            <Button variant="outlined" startIcon={<CsvIcon />} onClick={exportCsv} disabled={empty} sx={{ color: narrativeColors.text, borderColor: narrativeColors.borderStrong }} data-testid="narrative-export-csv">
              CSV (regneark)
            </Button>
            <Button variant="outlined" startIcon={<HtmlIcon />} onClick={() => void exportHtml()} disabled={empty || busy === 'html' || !canHtml} sx={{ color: narrativeColors.text, borderColor: narrativeColors.borderStrong }} data-testid="narrative-export-html" data-locked={canHtml ? undefined : 'plan'}>
              Spillbar HTML
            </Button>
            <Button variant="outlined" startIcon={<PdfIcon />} onClick={() => void exportPdf()} disabled={empty || busy === 'pdf' || !canPdf} sx={{ color: narrativeColors.text, borderColor: narrativeColors.borderStrong }} data-testid="narrative-export-pdf" data-locked={canPdf ? undefined : 'plan'}>
              {busy === 'pdf' ? 'Lager PDF…' : 'PDF (Story Graph)'}
            </Button>
            <Button variant="outlined" startIcon={<PdfIcon />} onClick={() => void exportScenesPdf()} disabled={busy === 'scenes-pdf' || !canPdf} sx={{ color: narrativeColors.text, borderColor: narrativeColors.borderStrong }} data-testid="narrative-export-scenes-pdf" data-locked={canPdf ? undefined : 'plan'}>
              {busy === 'scenes-pdf' ? 'Lager manus…' : 'Manus-PDF (scener)'}
            </Button>
          </Stack>
          <Box sx={{ mt: 1.5 }}><PlanGateBanner feature="export_html" compact /></Box>
          <Box><PlanGateBanner feature="export_pdf" compact /></Box>
          {empty ? (
            <Alert severity="info" sx={{ mt: 1.5, bgcolor: 'rgba(59,130,246,0.08)', color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }} data-testid="narrative-exports-empty-graph">
              Eksporten her gjelder Story Graph-brettene (elementer, forgreninger, variabler), og prosjektet har ingen brett ennå. Scener, replikker og gater ligger under «Scener &amp; gameplay» — åpne Brett for å tegne historien, eller start fra en mal på Hjem.
            </Alert>
          ) : null}
        </Section>

        <Section
          testId="narrative-exports-import"
          title="Importer fra Arcweave, Twine eller Ink"
          hint="Last opp Arcweave project.json, Twine Twee 3 (.twee — SugarCube fullt, Harlowe delvis) eller Ink (.ink, delsett). Hele grafen erstattes; nåværende versjon lagres først i Historikk. Det som ikke kan oversettes beholdes som tekst og listes som merknader."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.twee,.tw,.ink,.txt,application/json,text/plain"
            style={{ display: 'none' }}
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            data-testid="narrative-import-file"
          />
          <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => fileInputRef.current?.click()} sx={{ color: narrativeColors.text, borderColor: narrativeColors.borderStrong }} data-testid="narrative-import-pick">
            Velg fil (Arcweave JSON, Twine .twee, Ink .ink)
          </Button>
          {importWarnings.length > 0 ? (
            <Alert severity="warning" sx={{ mt: 1.5 }} data-testid="narrative-import-warnings">
              <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Importert med {importWarnings.length} merknad{importWarnings.length === 1 ? '' : 'er'}:</Typography>
              {importWarnings.slice(0, 20).map((w, i) => <Typography key={i} sx={{ fontSize: 12 }}>• {w.message}</Typography>)}
              {importWarnings.length > 20 ? <Typography sx={{ fontSize: 12 }}>… og {importWarnings.length - 20} til.</Typography> : null}
            </Alert>
          ) : null}
        </Section>

        <Section
          testId="narrative-exports-share"
          title="Delbare spill-lenker"
          hint="Alle med lenken kan spille historien uten innlogging. Lenken vises kun én gang — den lagres bare som hash hos oss."
        >
          <PlanGateBanner feature="share_links" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
            <FormControl size="small" sx={{ minWidth: 180, ...fieldSx }}>
              <InputLabel id="narrative-share-mode-label">Modus</InputLabel>
              <Select labelId="narrative-share-mode-label" label="Modus" value={mode} onChange={(e) => setMode(e.target.value as NarrativeShareMode)} data-testid="narrative-share-mode">
                {NARRATIVE_SHARE_MODES.map((m) => <MenuItem key={m} value={m}>{SHARE_MODE_LABELS[m]}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160, ...fieldSx }}>
              <InputLabel id="narrative-share-expiry-label">Utløper</InputLabel>
              <Select labelId="narrative-share-expiry-label" label="Utløper" value={expiry} onChange={(e) => setExpiry(e.target.value as typeof expiry)} data-testid="narrative-share-expiry">
                <MenuItem value="never">Aldri</MenuItem>
                <MenuItem value="7">Om 7 dager</MenuItem>
                <MenuItem value="30">Om 30 dager</MenuItem>
                <MenuItem value="90">Om 90 dager</MenuItem>
              </Select>
            </FormControl>
            <Button variant="contained" startIcon={<ShareIcon />} onClick={() => void createLink()} disabled={empty || busy === 'share' || !canShare} sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700 }} data-testid="narrative-share-create" data-locked={canShare ? undefined : 'plan'}>
              Opprett lenke
            </Button>
          </Stack>

          {freshLink ? (
            <Alert severity="success" sx={{ mb: 1.5 }} data-testid="narrative-share-fresh"
              action={(
                <Stack direction="row" spacing={0.5}>
                  <Tooltip title="Kopier lenke">
                    <IconButton size="small" onClick={() => void copyFresh()} aria-label="Kopier lenke" data-testid="narrative-share-copy"><CopyIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Embed-kode (iframe til egen nettside)">
                    <IconButton size="small" onClick={() => setEmbedOpen(true)} aria-label="Embed-kode" data-testid="narrative-share-embed"><EmbedIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Stack>
              )}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Ny lenke ({SHARE_MODE_LABELS[freshLink.mode]}) — kopier den nå:</Typography>
              <TextField value={freshLink.url} size="small" fullWidth InputProps={{ readOnly: true }} sx={{ mt: 0.5, '& input': { fontFamily: 'monospace', fontSize: 12 } }} inputProps={{ 'data-testid': 'narrative-share-url' }} onFocus={(e) => e.target.select()} />
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mt: 0.5 }}>Lenka og embed-koden vises bare nå — vi lagrer kun en hash av den.</Typography>
            </Alert>
          ) : null}

          <Dialog open={embedOpen && !!freshLink} onClose={() => setEmbedOpen(false)} maxWidth="sm" fullWidth PaperProps={{ 'data-testid': 'narrative-share-embed-dialog', sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` } } as never}>
            <DialogTitle sx={{ fontSize: 16 }}>Bygg inn spilleren på egen nettside</DialogTitle>
            <DialogContent>
              <Typography sx={{ fontSize: 13, color: narrativeColors.textDim, mb: 1.5 }}>
                Lim koden inn der spilleren skal vises. Rammen er 640 px høy — juster <code>height</code> etter behov. Tilbakekaller du lenka, slutter innbyggingen å virke.
              </Typography>
              <TextField value={embedCode} multiline minRows={4} fullWidth InputProps={{ readOnly: true }} sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12 } }} inputProps={{ 'data-testid': 'narrative-share-embed-code' }} onFocus={(e) => e.target.select()} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEmbedOpen(false)} sx={{ color: narrativeColors.textDim }}>Lukk</Button>
              <Button variant="contained" startIcon={<CopyIcon />} onClick={() => void copyEmbed()} sx={{ bgcolor: embedCopied ? narrativeColors.accentDark : narrativeColors.accent, color: '#04140a', fontWeight: 700 }} data-testid="narrative-share-embed-copy">
                {embedCopied ? 'Kopiert!' : 'Kopier koden'}
              </Button>
            </DialogActions>
          </Dialog>

          <Divider sx={{ borderColor: narrativeColors.borderStrong, mb: 1 }} />
          {linksLoading ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Laster lenker…</Typography> : null}
          {!linksLoading && links.length === 0 ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen delingslenker ennå.</Typography> : null}
          <List dense disablePadding data-testid="narrative-share-list">
            {links.map((link) => {
              const status = linkStatus(link);
              return (
                <ListItem
                  key={link.id}
                  data-testid={`narrative-share-link-${link.id}`}
                  secondaryAction={!link.revokedAt ? (
                    <Tooltip title="Tilbakekall lenken">
                      <span>
                        <IconButton edge="end" size="small" disabled={busy === `revoke-${link.id}`} onClick={() => void revoke(link)} sx={{ color: narrativeColors.error }} aria-label="Tilbakekall" data-testid={`narrative-share-revoke-${link.id}`}>
                          <RevokeIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : undefined}
                  sx={{ borderBottom: `1px solid ${narrativeColors.borderSoft}` }}
                >
                  <ListItemText
                    primary={(
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={status.label} sx={{ bgcolor: 'transparent', border: `1px solid ${status.color}`, color: status.color, height: 20, fontSize: 10 }} data-testid={`narrative-share-status-${link.id}`} />
                        <Typography sx={{ fontSize: 12 }}>{SHARE_MODE_LABELS[link.mode]}</Typography>
                      </Stack>
                    )}
                    secondary={`Opprettet ${formatDate(link.createdAt)}${link.expiresAt ? ` · utløper ${formatDate(link.expiresAt)}` : ''} · ${link.viewCount} visning${link.viewCount === 1 ? '' : 'er'}`}
                    secondaryTypographyProps={{ fontSize: 11, color: narrativeColors.textDim }}
                  />
                </ListItem>
              );
            })}
          </List>
        </Section>
      </Stack>

      <Dialog open={!!preview} onClose={() => (busy === 'import' ? undefined : setPreview(null))} PaperProps={{ 'data-testid': 'narrative-import-dialog', sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` } } as never}>
        <DialogTitle sx={{ fontSize: 16 }}>Importere «{preview?.fileName}»{preview ? ` (${IMPORT_FORMAT_LABELS[preview.format]})` : ''}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, mb: 1 }}>
            Hele grafen erstattes med {preview?.counts.boards} brett, {preview?.counts.elements} elementer, {preview?.counts.connections} koblinger,{' '}
            {preview?.counts.components} komponenter og {preview?.counts.variables} variabler. Nåværende versjon lagres først i Historikk.
          </Typography>
          {preview && preview.format !== 'arcweave' && !canTextImport ? <PlanGateBanner feature="import_twine_ink" /> : null}
          {preview && preview.warnings.length > 0 ? (
            <Alert severity="warning" sx={{ fontSize: 12 }}>
              {preview.warnings.length} merknad{preview.warnings.length === 1 ? '' : 'er'} (f.eks. «{preview.warnings[0].message}»).
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)} disabled={busy === 'import'} sx={{ color: narrativeColors.textDim }}>Avbryt</Button>
          <Button onClick={() => void confirmImport()} disabled={busy === 'import' || (!!preview && preview.format !== 'arcweave' && !canTextImport)} variant="contained" sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700 }} data-testid="narrative-import-confirm">
            Importer og erstatt
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

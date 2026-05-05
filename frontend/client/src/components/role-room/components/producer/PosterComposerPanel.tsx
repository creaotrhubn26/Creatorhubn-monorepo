/**
 * PosterComposerPanel — Role Room poster + signage + menu composer.
 *
 * Fase 2 MVP: brand-/template-/format-velgere + form for alle 9 layers
 * (Brand · Kampanje · Pris · Produkter · CTA · Footer) + live preview-pane.
 * Endringer triggrer debouncet re-render (800ms) mot backend; resultatet
 * vises som blob URL i en <img> (eller embed for PDF).
 *
 * Fase 3 utvider med snap-to-grid, smart-guides og inline-editing direkte
 * på preview-canvas (react-moveable). Fase 4 legger til Claude-knapp,
 * tekstur-overlay og export-to-Instagram.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AutoAwesome as AutoAwesomeIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  FolderOpen as FolderOpenIcon,
} from "@mui/icons-material";
import {
  fetchFormats,
  fetchTemplates,
  generateCampaignConcept,
  listDrafts,
  loadDraft,
  renderPosterPreview,
  renderMenuPreview,
  saveDraft,
  type CustomLayer,
  type FormatGroups,
  type FormatInfo,
  type MenuContent,
  type PosterContent,
  type PosterDraftSummary,
  type PosterFormat,
  type MenuFormat,
  type TemplateGroups,
} from "../../../../services/posterComposerService";
import PosterEditorCanvas from "./PosterEditorCanvas";

import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  Snackbar,
} from "@mui/material";

// ─────────────────────────────────────────────────────────────────────────
// Default content — Holy Crust som seed-eksempel.
// I Fase 3 byttes dette med "load from selected brand-profile + template".
// ─────────────────────────────────────────────────────────────────────────

const HOLY_LOGO_DATA_URL = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="92" fill="none" stroke="white" stroke-width="6"/>
  <circle cx="40" cy="60" r="6" fill="white"/>
  <circle cx="160" cy="80" r="5" fill="white"/>
  <circle cx="60" cy="140" r="7" fill="white"/>
  <circle cx="150" cy="150" r="6" fill="white"/>
  <text x="100" y="92" font-family="Arial Black,sans-serif" font-size="32" font-weight="900" fill="white" text-anchor="middle">HOLY</text>
  <text x="100" y="128" font-family="Arial Black,sans-serif" font-size="32" font-weight="900" fill="white" text-anchor="middle">CRUST</text>
</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
})();

const DEFAULT_POSTER: PosterContent = {
  templateId: "monday-special",
  brand: {
    businessName: "Holy Crust",
    logoUrl: HOLY_LOGO_DATA_URL,
    colors: {
      primary: "#C8102E",
      secondary: "#1B2D5C",
      accent: "#F4EBD8",
      background: "#0E0E0E",
      text: "#FFFFFF",
    },
    fonts: { display: "Bebas Neue", body: "Inter" },
  },
  campaign: {
    headlinePrimary: "Blue Monday",
    connector: "om til",
    headlineSecondary: "Holy Monday",
    subhead: "Kun hver mandag hos Holy Crust",
    burst: "Vi redder mandagen din!",
    cta: "Start uka riktig. Bestill nå!",
  },
  pricing: [
    { label: "VALGFRI STOR PIZZA", price: "169,-" },
    { label: "VALGFRI LITEN PIZZA", price: "99,-" },
  ],
  products: [
    { imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80", name: "Pepperoni" },
    { imageUrl: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=600&q=80", name: "Veggie" },
    { imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80", name: "Holy Kebab" },
  ],
  ctaActions: [
    { iconSvgPath: "M3 12h2l3-9h8l3 9h2v8H3v-8z", text: "Hent i restaurant" },
    { iconSvgPath: "M3 17V7h11v3h4l3 3v4h-3", text: "Rask levering" },
    { iconSvgPath: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20", text: "holycrust.no" },
  ],
  footer: { phone: "97 25 22 22", socialLine: "@holycrust.no" },
};

const DEFAULT_MENU: MenuContent = {
  templateId: "menu-premium",
  brand: DEFAULT_POSTER.brand,
  cover: { title: "Den Hellige Menyen", subtitle: "Holy Crust · Oslo" },
  categories: [
    {
      title: "Starters",
      items: [
        { name: "Garlic Brød", description: "Sprøtt brød med smør og hvitløk.", price: "29 kr" },
        { name: "Holy Garlic Brød", description: "Hvitløksbrød med ost og kylling tikka.", price: "59 kr" },
      ],
    },
    {
      title: "Holy Pizzas",
      items: [
        { name: "Margherita", description: "Klassisk pizza med tomatsaus og ost.", price: "Liten 99 · Stor 229 kr" },
        { name: "Pepperoni", description: "Tidløs favoritt med pepperoni og ost.", price: "Liten 129 · Stor 249 kr" },
      ],
    },
  ],
  contact: { phone: "972 52 222", address: "Jerikoveien 1, 1067 Oslo", website: "holycrust.no" },
};

// ─────────────────────────────────────────────────────────────────────────
// Hjelpere
// ─────────────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Undo/redo-historikk med debounset snapshot. Coalesce'er rask-typing til én
 * historie-entry (snapshot 800ms etter siste set-call).
 */
function useHistory<T>(initial: T): {
  value: T;
  set: (next: T | ((prev: T) => T)) => void;
  setNoHistory: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);
  const presentRef = useRef<T>(initial);
  const startingValueRef = useRef<T | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    const computed =
      typeof next === "function" ? (next as (prev: T) => T)(presentRef.current) : next;
    if (startingValueRef.current === null) {
      startingValueRef.current = presentRef.current;
    }
    presentRef.current = computed;
    setPresent(computed);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (startingValueRef.current !== null) {
        const start = startingValueRef.current;
        setPast((p) => [...p.slice(-49), start]);
        setFuture([]);
        startingValueRef.current = null;
      }
    }, 800);
  }, []);

  const setNoHistory = useCallback((next: T) => {
    presentRef.current = next;
    setPresent(next);
    setPast([]);
    setFuture([]);
    startingValueRef.current = null;
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [presentRef.current, ...f]);
      presentRef.current = prev;
      setPresent(prev);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, presentRef.current]);
      presentRef.current = next;
      setPresent(next);
      return f.slice(1);
    });
  }, []);

  return { value: present, set, setNoHistory, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

function dimsLabel(d: FormatInfo): string {
  if (d.physicalMm) return `${d.physicalMm.w}×${d.physicalMm.h} mm @ ${d.dpi} DPI`;
  return `${d.w}×${d.h} px`;
}

// ─────────────────────────────────────────────────────────────────────────
// Hovedkomponent
// ─────────────────────────────────────────────────────────────────────────

type PanelMode = "poster" | "menu";

interface PosterComposerPanelProps {
  /** Valgfri brand-id som låser composer til denne brand-profilen.
   *  Hvis utelatt, bruker vi default Holy Crust som seed (Fase 3 erstatter). */
  brandId?: string;
}

export default function PosterComposerPanel({ brandId: _brandId }: PosterComposerPanelProps = {}) {
  // Mode: poster vs menu (separate content-strukturer)
  const [mode, setMode] = useState<PanelMode>("poster");

  // Content-state med undo/redo-historikk
  const posterHistory = useHistory<PosterContent>(DEFAULT_POSTER);
  const menuHistory = useHistory<MenuContent>(DEFAULT_MENU);
  const poster = posterHistory.value;
  const menu = menuHistory.value;
  const setPoster = posterHistory.set;
  const setMenu = menuHistory.set;
  const [posterFormat, setPosterFormat] = useState<PosterFormat>("4x5");
  const [menuFormat, setMenuFormat] = useState<MenuFormat>("menu-a4");

  // Drafts-state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("Untitled");
  const [drafts, setDrafts] = useState<PosterDraftSummary[]>([]);
  const [draftsMenuAnchor, setDraftsMenuAnchor] = useState<HTMLElement | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  // Claude-state
  const [claudeOpen, setClaudeOpen] = useState(false);
  const [claudeIntent, setClaudeIntent] = useState("");
  const [claudeLoading, setClaudeLoading] = useState(false);

  // Format-/template-katalog fra backend
  const [formats, setFormats] = useState<FormatGroups | null>(null);
  const [templates, setTemplates] = useState<TemplateGroups | null>(null);

  // Preview-state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const previousUrlRef = useRef<string | null>(null);

  // Form-tab
  const [activeTab, setActiveTab] = useState(0);

  // Debounced content for auto-render (800ms etter siste edit)
  const debouncedPoster = useDebounced(poster, 800);
  const debouncedMenu = useDebounced(menu, 800);
  const debouncedFormat = useDebounced(mode === "poster" ? posterFormat : menuFormat, 200);

  // Hent katalog ved mount
  useEffect(() => {
    fetchFormats().then(setFormats).catch((e) => setRenderError(`Format-liste-feil: ${e.message}`));
    fetchTemplates().then(setTemplates).catch((e) => setRenderError(`Template-liste-feil: ${e.message}`));
    refreshDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drafts: list, save, load ──
  const refreshDrafts = useCallback(async () => {
    try {
      const list = await listDrafts();
      setDrafts(list);
    } catch (err) {
      // Ikke fatal — drafts-tabellen kan mangle hvis migration 121 ikke er kjørt
      console.warn("[poster-composer] drafts list failed:", err);
    }
  }, []);

  const persistDraft = useCallback(
    async (name: string) => {
      setSaving(true);
      try {
        const result = await saveDraft({
          id: currentDraftId ?? undefined,
          templateId: mode === "poster" ? poster.templateId : menu.templateId,
          name,
          format: mode === "poster" ? posterFormat : menuFormat,
          content: mode === "poster" ? poster : menu,
        });
        setCurrentDraftId(result.id);
        setDraftName(name);
        setSavedAt(new Date(result.updated_at));
        setSnackbar("Lagret");
        await refreshDrafts();
      } catch (err) {
        setSnackbar(`Lagring feilet: ${err instanceof Error ? err.message : err}`);
      } finally {
        setSaving(false);
        setSaveDialogOpen(false);
      }
    },
    [currentDraftId, mode, poster, menu, posterFormat, menuFormat, refreshDrafts],
  );

  const handleLoadDraft = useCallback(
    async (draftId: string) => {
      try {
        const d = await loadDraft(draftId);
        setCurrentDraftId(d.id);
        setDraftName(d.name);
        setSavedAt(new Date());
        if (d.content && (d.content as PosterContent).campaign) {
          // Plakat
          posterHistory.setNoHistory(d.content as PosterContent);
          setMode("poster");
          setPosterFormat(d.format as PosterFormat);
        } else {
          // Meny
          menuHistory.setNoHistory(d.content as MenuContent);
          setMode("menu");
          setMenuFormat(d.format as MenuFormat);
        }
        setDraftsMenuAnchor(null);
        setSnackbar(`Lastet "${d.name}"`);
      } catch (err) {
        setSnackbar(`Last-feil: ${err instanceof Error ? err.message : err}`);
      }
    },
    [posterHistory, menuHistory],
  );

  // ── Tastatursnarveier: Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const target = e.target as HTMLElement | null;
      // Ikke kapre når man er midt i input/textarea/contenteditable
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const hist = mode === "poster" ? posterHistory : menuHistory;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        hist.undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        hist.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, posterHistory, menuHistory]);

  const activeHistory = mode === "poster" ? posterHistory : menuHistory;

  // ── Claude: generer kampanje-tekst ──
  const runClaude = useCallback(async () => {
    if (!claudeIntent.trim()) return;
    setClaudeLoading(true);
    try {
      const newCampaign = await generateCampaignConcept({
        brand: poster.brand,
        templateId: poster.templateId,
        intent: claudeIntent,
        referenceCampaign: poster.campaign,
      });
      if (newCampaign) {
        setPoster({ ...poster, campaign: { ...poster.campaign, ...newCampaign } });
        setSnackbar("Claude genererte ny kampanje-tekst");
        setClaudeOpen(false);
        setClaudeIntent("");
      } else {
        setSnackbar("Claude returnerte tomt — sjekk Anthropic-credit");
      }
    } catch (err) {
      setSnackbar(`Claude-feil: ${err instanceof Error ? err.message : err}`);
    } finally {
      setClaudeLoading(false);
    }
  }, [claudeIntent, poster, setPoster]);

  // Auto-render ved endring (debounced).
  // For plakat-mode sendes content UTEN customLayers — disse rendres i DOM
  // av PosterEditorCanvas. Da unngår vi dobbelt-rendring og slipper å vente
  // på re-render mens bruker drar layers.
  const renderPreview = useCallback(async () => {
    setRendering(true);
    setRenderError(null);
    try {
      const url =
        mode === "poster"
          ? await renderPosterPreview(
              { ...debouncedPoster, customLayers: [] },
              posterFormat,
            )
          : await renderMenuPreview(debouncedMenu, menuFormat);
      if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
      previousUrlRef.current = url;
      setPreviewUrl(url);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : String(err));
    } finally {
      setRendering(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, debouncedPoster, debouncedMenu, posterFormat, menuFormat]);

  useEffect(() => {
    renderPreview();
  }, [debouncedPoster, debouncedMenu, debouncedFormat, mode, renderPreview]);

  // Cleanup blob URL ved unmount
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
    };
  }, []);

  const currentFormatInfo: FormatInfo | undefined = useMemo(() => {
    if (!formats) return undefined;
    const all = [...formats.social, ...formats.print, ...formats.digital_signage, ...formats.menu];
    return all.find((f) => f.key === (mode === "poster" ? posterFormat : menuFormat));
  }, [formats, mode, posterFormat, menuFormat]);

  // ── Render ──
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 600 }}>
      {/* Topp-toolbar */}
      <Paper elevation={0} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Plakat-/menu-composer
          </Typography>
          {/* Mode-toggle */}
          <Tabs
            value={mode}
            onChange={(_e, v) => setMode(v)}
            sx={{ minHeight: 36 }}
          >
            <Tab value="poster" label="Plakat / Signage" sx={{ minHeight: 36 }} />
            <Tab value="menu" label="Meny (PDF)" sx={{ minHeight: 36 }} />
          </Tabs>

          <Box flex={1} />

          {/* Template */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Template</InputLabel>
            <Select
              label="Template"
              value={mode === "poster" ? poster.templateId : menu.templateId}
              onChange={(e) => {
                const v = e.target.value as PosterContent["templateId"] | MenuContent["templateId"];
                if (mode === "poster") setPoster({ ...poster, templateId: v as PosterContent["templateId"] });
                else setMenu({ ...menu, templateId: v as MenuContent["templateId"] });
              }}
            >
              {(mode === "poster" ? templates?.poster ?? [] : templates?.menu ?? []).map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Format */}
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Format</InputLabel>
            <Select
              label="Format"
              value={mode === "poster" ? posterFormat : menuFormat}
              onChange={(e) => {
                if (mode === "poster") setPosterFormat(e.target.value as PosterFormat);
                else setMenuFormat(e.target.value as MenuFormat);
              }}
            >
              {mode === "poster" && formats && [
                <MenuItem key="h1" disabled sx={{ fontWeight: 700, opacity: 1 }}>
                  Sosial
                </MenuItem>,
                ...formats.social.map((f) => (
                  <MenuItem key={f.key} value={f.key} sx={{ pl: 3 }}>
                    {f.key} — {f.w}×{f.h}
                  </MenuItem>
                )),
                <MenuItem key="h2" disabled sx={{ fontWeight: 700, opacity: 1 }}>
                  Print signage
                </MenuItem>,
                ...formats.print.map((f) => (
                  <MenuItem key={f.key} value={f.key} sx={{ pl: 3 }}>
                    {f.key} — {dimsLabel(f)}
                  </MenuItem>
                )),
                <MenuItem key="h3" disabled sx={{ fontWeight: 700, opacity: 1 }}>
                  Digital signage
                </MenuItem>,
                ...formats.digital_signage.map((f) => (
                  <MenuItem key={f.key} value={f.key} sx={{ pl: 3 }}>
                    {f.key} — {f.w}×{f.h}
                  </MenuItem>
                )),
              ]}
              {mode === "menu" && formats &&
                formats.menu.map((f) => (
                  <MenuItem key={f.key} value={f.key}>
                    {f.key} — {dimsLabel(f)}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <Tooltip title="Render på nytt">
            <span>
              <IconButton onClick={renderPreview} disabled={rendering}>
                {rendering ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>

          {/* Undo/redo */}
          <Stack direction="row" spacing={0}>
            <Tooltip title="Angre (⌘Z)">
              <span>
                <IconButton size="small" onClick={() => activeHistory.undo()} disabled={!activeHistory.canUndo}>
                  <UndoIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Gjør om (⌘⇧Z)">
              <span>
                <IconButton size="small" onClick={() => activeHistory.redo()} disabled={!activeHistory.canRedo}>
                  <RedoIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {/* Drafts: open existing */}
          <Button
            startIcon={<FolderOpenIcon />}
            variant="outlined"
            size="small"
            onClick={(e) => {
              refreshDrafts();
              setDraftsMenuAnchor(e.currentTarget);
            }}
          >
            {drafts.length > 0 ? `Drafts (${drafts.length})` : "Drafts"}
          </Button>
          <Menu
            anchorEl={draftsMenuAnchor}
            open={Boolean(draftsMenuAnchor)}
            onClose={() => setDraftsMenuAnchor(null)}
          >
            {drafts.length === 0 && (
              <MenuItem disabled>
                <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                  Ingen drafts (kjør migration 121)
                </Typography>
              </MenuItem>
            )}
            {drafts.map((d) => (
              <MenuItem key={d.id} onClick={() => handleLoadDraft(d.id)}>
                <Stack>
                  <Typography variant="body2" sx={{ fontWeight: currentDraftId === d.id ? 700 : 400 }}>
                    {d.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {d.template_id} · {d.format} · {new Date(d.updated_at).toLocaleString()}
                  </Typography>
                </Stack>
              </MenuItem>
            ))}
          </Menu>

          {/* Save */}
          <Button
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
            variant="contained"
            size="small"
            onClick={() => {
              if (currentDraftId) {
                // Hurtig-lagring til eksisterende draft uten dialog
                persistDraft(draftName);
              } else {
                setSaveDialogOpen(true);
              }
            }}
            disabled={saving}
          >
            {currentDraftId ? "Lagre" : "Lagre som…"}
          </Button>
          {savedAt && (
            <Typography variant="caption" color="text.secondary">
              Lagret {savedAt.toLocaleTimeString()}
            </Typography>
          )}

          {previewUrl && (
            <Tooltip title="Last ned">
              <IconButton component="a" href={previewUrl} download={`${mode}-${currentFormatInfo?.key ?? "preview"}.${mode === "menu" ? "pdf" : "png"}`}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          )}

          <Button
            startIcon={<AutoAwesomeIcon />}
            variant="contained"
            color="secondary"
            disabled={mode !== "poster"}
            onClick={() => setClaudeOpen(true)}
          >
            Claude-kampanjetekst
          </Button>
        </Stack>

        {/* Claude-dialog */}
        <Dialog open={claudeOpen} onClose={() => setClaudeOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Generer kampanje-tekst med Claude</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Beskriv hva kampanjen handler om — Claude bruker brand-stemmen til
              å generere headline-par + connector + subhead + burst + CTA i én operasjon.
              Eksisterende felter brukes som tone-referanse.
            </Typography>
            <TextField
              autoFocus
              label="Kampanje-intent (norsk)"
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              value={claudeIntent}
              onChange={(e) => setClaudeIntent(e.target.value)}
              placeholder='F.eks. "Mandag er den kjipeste dagen — gjør den til Holy Monday med rabatt på alle store pizzaer"'
              disabled={claudeLoading}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setClaudeOpen(false)} disabled={claudeLoading}>
              Avbryt
            </Button>
            <Button
              variant="contained"
              startIcon={claudeLoading ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
              onClick={runClaude}
              disabled={!claudeIntent.trim() || claudeLoading}
            >
              {claudeLoading ? "Genererer…" : "Generer"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Save-as dialog (første gang) */}
        <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Lagre som ny draft</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              label="Navn"
              fullWidth
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              sx={{ mt: 1 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") persistDraft(draftName);
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSaveDialogOpen(false)}>Avbryt</Button>
            <Button variant="contained" onClick={() => persistDraft(draftName)} disabled={saving}>
              Lagre
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(snackbar)}
          autoHideDuration={3000}
          onClose={() => setSnackbar(null)}
          message={snackbar ?? ""}
        />

        {currentFormatInfo && (
          <Typography variant="caption" sx={{ mt: 1, display: "block", color: "text.secondary" }}>
            {currentFormatInfo.shape} · {currentFormatInfo.kind}
            {currentFormatInfo.bleed ? ` · bleed ${currentFormatInfo.bleed}px` : ""}
            {currentFormatInfo.safeZone ? ` · safe-zone ${currentFormatInfo.safeZone}px` : ""}
          </Typography>
        )}
      </Paper>

      {/* Hovedinnhold: form + preview */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Venstre: form */}
        <Box sx={{ width: 460, borderRight: 1, borderColor: "divider", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
            {mode === "poster" ? (
              [
                <Tab key="campaign" label="Kampanje" />,
                <Tab key="pricing" label="Pris" />,
                <Tab key="products" label="Produkter" />,
                <Tab key="cta" label="CTA" />,
                <Tab key="footer" label="Footer" />,
                <Tab key="brand" label="Brand" />,
              ]
            ) : (
              [
                <Tab key="cover" label="Cover" />,
                <Tab key="categories" label="Kategorier" />,
                <Tab key="deals" label="Deals" />,
                <Tab key="contact" label="Kontakt" />,
                <Tab key="brand" label="Brand" />,
              ]
            )}
          </Tabs>

          <Box sx={{ p: 2, overflow: "auto", flex: 1 }}>
            {mode === "poster" && (
              <PosterForm activeTab={activeTab} content={poster} onChange={setPoster} />
            )}
            {mode === "menu" && (
              <MenuForm activeTab={activeTab} content={menu} onChange={setMenu} />
            )}
          </Box>
        </Box>

        {/* Høyre: preview / editor */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#f5f5f5" }}>
          {renderError && (
            <Alert severity="error" sx={{ m: 2 }}>
              {renderError}
            </Alert>
          )}
          {mode === "poster" && currentFormatInfo && (
            <PosterEditorCanvas
              previewUrl={previewUrl}
              canvasW={currentFormatInfo.w}
              canvasH={currentFormatInfo.h}
              formatInfo={currentFormatInfo}
              layers={poster.customLayers ?? []}
              onLayersChange={(next: CustomLayer[]) =>
                setPoster({ ...poster, customLayers: next })
              }
            />
          )}
          {mode === "menu" && (
            <Box sx={{ p: 3, display: "flex", flexDirection: "column", alignItems: "center", overflow: "auto", flex: 1 }}>
              {rendering && !previewUrl && (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, mt: 8 }}>
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary">Rendrer…</Typography>
                </Box>
              )}
              {previewUrl && (
                <Box
                  component="iframe"
                  src={previewUrl}
                  title="Meny-PDF-preview"
                  sx={{
                    width: "min(100%, 900px)",
                    height: "calc(100vh - 240px)",
                    border: "none",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                    background: "white",
                  }}
                />
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Poster-form (tabs)
// ─────────────────────────────────────────────────────────────────────────

function PosterForm({
  activeTab,
  content,
  onChange,
}: {
  activeTab: number;
  content: PosterContent;
  onChange: (next: PosterContent) => void;
}) {
  const update = (patch: Partial<PosterContent>) => onChange({ ...content, ...patch });

  if (activeTab === 0) {
    // Kampanje
    return (
      <Stack spacing={2}>
        <TextField
          label="Headline 1"
          value={content.campaign.headlinePrimary}
          onChange={(e) => update({ campaign: { ...content.campaign, headlinePrimary: e.target.value } })}
          fullWidth
        />
        <TextField
          label="Connector (valgfri)"
          value={content.campaign.connector ?? ""}
          onChange={(e) => update({ campaign: { ...content.campaign, connector: e.target.value } })}
          fullWidth
        />
        <TextField
          label="Headline 2"
          value={content.campaign.headlineSecondary}
          onChange={(e) => update({ campaign: { ...content.campaign, headlineSecondary: e.target.value } })}
          fullWidth
        />
        <TextField
          label="Subhead"
          value={content.campaign.subhead ?? ""}
          onChange={(e) => update({ campaign: { ...content.campaign, subhead: e.target.value } })}
          fullWidth
        />
        <TextField
          label="Burst (callout)"
          value={content.campaign.burst ?? ""}
          onChange={(e) => update({ campaign: { ...content.campaign, burst: e.target.value } })}
          fullWidth
        />
        <TextField
          label="CTA"
          value={content.campaign.cta}
          onChange={(e) => update({ campaign: { ...content.campaign, cta: e.target.value } })}
          fullWidth
        />
      </Stack>
    );
  }

  if (activeTab === 1) {
    // Pris
    return (
      <Stack spacing={2}>
        {content.pricing.map((p, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Typography variant="subtitle2">Pris-tier {i + 1}</Typography>
              <Box flex={1} />
              <IconButton
                size="small"
                onClick={() => update({ pricing: content.pricing.filter((_, idx) => idx !== i) })}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
            <TextField
              label="Etikett"
              value={p.label}
              onChange={(e) => {
                const next = [...content.pricing];
                next[i] = { ...p, label: e.target.value };
                update({ pricing: next });
              }}
              fullWidth
              sx={{ mb: 1 }}
            />
            <TextField
              label="Pris"
              value={p.price}
              onChange={(e) => {
                const next = [...content.pricing];
                next[i] = { ...p, price: e.target.value };
                update({ pricing: next });
              }}
              fullWidth
            />
          </Paper>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={() => update({ pricing: [...content.pricing, { label: "Ny tier", price: "0,-" }] })}
        >
          Legg til pris-tier
        </Button>
      </Stack>
    );
  }

  if (activeTab === 2) {
    // Produkter
    return (
      <Stack spacing={2}>
        {content.products.map((p, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Typography variant="subtitle2">Produkt {i + 1}</Typography>
              <Box flex={1} />
              <IconButton
                size="small"
                onClick={() => update({ products: content.products.filter((_, idx) => idx !== i) })}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
            <TextField
              label="Navn"
              value={p.name}
              onChange={(e) => {
                const next = [...content.products];
                next[i] = { ...p, name: e.target.value };
                update({ products: next });
              }}
              fullWidth
              sx={{ mb: 1 }}
            />
            <TextField
              label="Bilde-URL (transparent PNG anbefales)"
              value={p.imageUrl}
              onChange={(e) => {
                const next = [...content.products];
                next[i] = { ...p, imageUrl: e.target.value };
                update({ products: next });
              }}
              fullWidth
            />
          </Paper>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={() => update({ products: [...content.products, { name: "Nytt", imageUrl: "" }] })}
        >
          Legg til produkt
        </Button>
      </Stack>
    );
  }

  if (activeTab === 3) {
    // CTA-rad
    return (
      <Stack spacing={2}>
        {content.ctaActions.map((a, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Typography variant="subtitle2">CTA {i + 1}</Typography>
              <Box flex={1} />
              <IconButton
                size="small"
                onClick={() => update({ ctaActions: content.ctaActions.filter((_, idx) => idx !== i) })}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
            <TextField
              label="Tekst"
              value={a.text}
              onChange={(e) => {
                const next = [...content.ctaActions];
                next[i] = { ...a, text: e.target.value };
                update({ ctaActions: next });
              }}
              fullWidth
              sx={{ mb: 1 }}
            />
            <TextField
              label="SVG-path-data (24×24 viewbox)"
              value={a.iconSvgPath}
              onChange={(e) => {
                const next = [...content.ctaActions];
                next[i] = { ...a, iconSvgPath: e.target.value };
                update({ ctaActions: next });
              }}
              fullWidth
              size="small"
              sx={{ "& input": { fontFamily: "monospace", fontSize: 11 } }}
            />
          </Paper>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={() =>
            update({
              ctaActions: [
                ...content.ctaActions,
                { text: "Ny CTA", iconSvgPath: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20" },
              ],
            })
          }
        >
          Legg til CTA-handling
        </Button>
      </Stack>
    );
  }

  if (activeTab === 4) {
    // Footer
    return (
      <Stack spacing={2}>
        <TextField
          label="Telefon"
          value={content.footer?.phone ?? ""}
          onChange={(e) => update({ footer: { ...content.footer, phone: e.target.value } })}
          fullWidth
        />
        <TextField
          label="Sosial-linje (f.eks. @holycrust.no)"
          value={content.footer?.socialLine ?? ""}
          onChange={(e) => update({ footer: { ...content.footer, socialLine: e.target.value } })}
          fullWidth
        />
      </Stack>
    );
  }

  // Brand (tab 5)
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Identitet</Typography>
      <TextField
        label="Bedriftsnavn"
        value={content.brand.businessName}
        onChange={(e) => update({ brand: { ...content.brand, businessName: e.target.value } })}
        fullWidth
      />
      <TextField
        label="Logo-URL"
        value={content.brand.logoUrl}
        onChange={(e) => update({ brand: { ...content.brand, logoUrl: e.target.value } })}
        fullWidth
        size="small"
        sx={{ "& input": { fontFamily: "monospace", fontSize: 11 } }}
      />
      <Divider />
      <Typography variant="subtitle2">Palett</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          label="Primary"
          type="color"
          value={content.brand.colors.primary}
          onChange={(e) => update({ brand: { ...content.brand, colors: { ...content.brand.colors, primary: e.target.value } } })}
          sx={{ width: 100 }}
        />
        <TextField
          label="Secondary"
          type="color"
          value={content.brand.colors.secondary}
          onChange={(e) => update({ brand: { ...content.brand, colors: { ...content.brand.colors, secondary: e.target.value } } })}
          sx={{ width: 100 }}
        />
        <TextField
          label="Accent"
          type="color"
          value={content.brand.colors.accent ?? "#F4EBD8"}
          onChange={(e) => update({ brand: { ...content.brand, colors: { ...content.brand.colors, accent: e.target.value } } })}
          sx={{ width: 100 }}
        />
        <TextField
          label="Tekst"
          type="color"
          value={content.brand.colors.text ?? "#FFFFFF"}
          onChange={(e) => update({ brand: { ...content.brand, colors: { ...content.brand.colors, text: e.target.value } } })}
          sx={{ width: 100 }}
        />
      </Stack>
      <Divider />
      <Typography variant="subtitle2">Fonter</Typography>
      <FormControl fullWidth>
        <InputLabel>Display-font</InputLabel>
        <Select
          label="Display-font"
          value={content.brand.fonts.display}
          onChange={(e) => update({ brand: { ...content.brand, fonts: { ...content.brand.fonts, display: e.target.value } } })}
        >
          {["Bebas Neue", "Anton", "Oswald", "Bowlby One", "Permanent Marker"].map((f) => (
            <MenuItem key={f} value={f}>{f}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel>Body-font</InputLabel>
        <Select
          label="Body-font"
          value={content.brand.fonts.body}
          onChange={(e) => update({ brand: { ...content.brand, fonts: { ...content.brand.fonts, body: e.target.value } } })}
        >
          {["Inter", "Manrope", "Caveat"].map((f) => (
            <MenuItem key={f} value={f}>{f}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Menu-form (tabs)
// ─────────────────────────────────────────────────────────────────────────

function MenuForm({
  activeTab,
  content,
  onChange,
}: {
  activeTab: number;
  content: MenuContent;
  onChange: (next: MenuContent) => void;
}) {
  const update = (patch: Partial<MenuContent>) => onChange({ ...content, ...patch });

  if (activeTab === 0) {
    return (
      <Stack spacing={2}>
        <TextField
          label="Cover-tittel"
          value={content.cover.title}
          onChange={(e) => update({ cover: { ...content.cover, title: e.target.value } })}
          fullWidth
        />
        <TextField
          label="Subtittel"
          value={content.cover.subtitle ?? ""}
          onChange={(e) => update({ cover: { ...content.cover, subtitle: e.target.value } })}
          fullWidth
        />
        <TextField
          label="Tagline"
          value={content.cover.tagline ?? ""}
          onChange={(e) => update({ cover: { ...content.cover, tagline: e.target.value } })}
          fullWidth
          helperText="Brukes på trifold-cover-panel"
        />
      </Stack>
    );
  }

  if (activeTab === 1) {
    // Kategorier — kompakt redigering, accordion-stil
    return (
      <Stack spacing={2}>
        {content.categories.map((cat, ci) => (
          <Paper key={ci} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <TextField
                label="Kategori"
                value={cat.title}
                onChange={(e) => {
                  const next = [...content.categories];
                  next[ci] = { ...cat, title: e.target.value };
                  update({ categories: next });
                }}
                size="small"
                sx={{ flex: 1 }}
              />
              <IconButton
                size="small"
                onClick={() => update({ categories: content.categories.filter((_, idx) => idx !== ci) })}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
            <TextField
              label="Beskrivelse (valgfri)"
              value={cat.description ?? ""}
              onChange={(e) => {
                const next = [...content.categories];
                next[ci] = { ...cat, description: e.target.value };
                update({ categories: next });
              }}
              fullWidth
              size="small"
              sx={{ mb: 1 }}
            />
            <Stack spacing={1} sx={{ pl: 2, borderLeft: 2, borderColor: "divider" }}>
              {cat.items.map((item, ii) => (
                <Box key={ii}>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Item-navn"
                      value={item.name}
                      onChange={(e) => {
                        const nextCats = [...content.categories];
                        const nextItems = [...cat.items];
                        nextItems[ii] = { ...item, name: e.target.value };
                        nextCats[ci] = { ...cat, items: nextItems };
                        update({ categories: nextCats });
                      }}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Pris"
                      value={item.price}
                      onChange={(e) => {
                        const nextCats = [...content.categories];
                        const nextItems = [...cat.items];
                        nextItems[ii] = { ...item, price: e.target.value };
                        nextCats[ci] = { ...cat, items: nextItems };
                        update({ categories: nextCats });
                      }}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const nextCats = [...content.categories];
                        nextCats[ci] = { ...cat, items: cat.items.filter((_, idx) => idx !== ii) };
                        update({ categories: nextCats });
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <TextField
                    label="Beskrivelse"
                    value={item.description ?? ""}
                    onChange={(e) => {
                      const nextCats = [...content.categories];
                      const nextItems = [...cat.items];
                      nextItems[ii] = { ...item, description: e.target.value };
                      nextCats[ci] = { ...cat, items: nextItems };
                      update({ categories: nextCats });
                    }}
                    size="small"
                    fullWidth
                    multiline
                    maxRows={2}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  const nextCats = [...content.categories];
                  nextCats[ci] = { ...cat, items: [...cat.items, { name: "Nytt item", price: "0 kr" }] };
                  update({ categories: nextCats });
                }}
              >
                Legg til item
              </Button>
            </Stack>
          </Paper>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={() => update({ categories: [...content.categories, { title: "Ny kategori", items: [] }] })}
        >
          Legg til kategori
        </Button>
      </Stack>
    );
  }

  if (activeTab === 2) {
    // Deals — kun brukt av trifold-template
    return (
      <Stack spacing={2}>
        <Typography variant="caption" color="text.secondary">
          Highlight-tilbud som vises på trifold-cover. Ignoreres av premium-meny.
        </Typography>
        {(content.deals ?? []).map((d, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <Typography variant="subtitle2">Deal {i + 1}</Typography>
              <Box flex={1} />
              <IconButton
                size="small"
                onClick={() => update({ deals: (content.deals ?? []).filter((_, idx) => idx !== i) })}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
            <TextField
              label="Tittel"
              value={d.title}
              onChange={(e) => {
                const next = [...(content.deals ?? [])];
                next[i] = { ...d, title: e.target.value };
                update({ deals: next });
              }}
              fullWidth
              size="small"
              sx={{ mb: 1 }}
            />
            <TextField
              label="Beskrivelse"
              value={d.description ?? ""}
              onChange={(e) => {
                const next = [...(content.deals ?? [])];
                next[i] = { ...d, description: e.target.value };
                update({ deals: next });
              }}
              fullWidth
              size="small"
              sx={{ mb: 1 }}
            />
            <TextField
              label="Pris"
              value={d.price}
              onChange={(e) => {
                const next = [...(content.deals ?? [])];
                next[i] = { ...d, price: e.target.value };
                update({ deals: next });
              }}
              fullWidth
              size="small"
            />
          </Paper>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={() =>
            update({
              deals: [...(content.deals ?? []), { title: "Nytt tilbud", description: "", price: "0 kr" }],
            })
          }
        >
          Legg til deal
        </Button>
      </Stack>
    );
  }

  if (activeTab === 3) {
    // Kontakt + åpningstider
    return (
      <Stack spacing={2}>
        <TextField
          label="Telefon"
          value={content.contact.phone ?? ""}
          onChange={(e) => update({ contact: { ...content.contact, phone: e.target.value } })}
          fullWidth
        />
        <TextField
          label="Adresse"
          value={content.contact.address ?? ""}
          onChange={(e) => update({ contact: { ...content.contact, address: e.target.value } })}
          fullWidth
        />
        <TextField
          label="Nettside"
          value={content.contact.website ?? ""}
          onChange={(e) => update({ contact: { ...content.contact, website: e.target.value } })}
          fullWidth
        />
        <Divider />
        <Typography variant="subtitle2">Åpningstider</Typography>
        <Typography variant="caption" color="text.secondary">
          Brukes på trifold-kontakt-panel.
        </Typography>
        {(content.contact.hours ?? []).map((h, i) => (
          <Stack key={i} direction="row" spacing={1}>
            <TextField
              label="Dag"
              value={h.day}
              onChange={(e) => {
                const next = [...(content.contact.hours ?? [])];
                next[i] = { ...h, day: e.target.value };
                update({ contact: { ...content.contact, hours: next } });
              }}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              label="Tid"
              value={h.time}
              onChange={(e) => {
                const next = [...(content.contact.hours ?? [])];
                next[i] = { ...h, time: e.target.value };
                update({ contact: { ...content.contact, hours: next } });
              }}
              size="small"
              sx={{ flex: 1 }}
            />
            <IconButton
              size="small"
              onClick={() => {
                const next = (content.contact.hours ?? []).filter((_, idx) => idx !== i);
                update({ contact: { ...content.contact, hours: next } });
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => {
            const next = [...(content.contact.hours ?? []), { day: "", time: "" }];
            update({ contact: { ...content.contact, hours: next } });
          }}
        >
          Legg til dag
        </Button>
      </Stack>
    );
  }

  // Brand (tab 4)
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Brand-redigering er felles med plakat-tabben — bytt til "Plakat / Signage"-modus for å endre palett/fonter/logo.
      </Typography>
    </Stack>
  );
}

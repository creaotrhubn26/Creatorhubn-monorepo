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
  uploadPosterImage,
  scrapeMenuFromUrl,
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

// Ekte Holy Crust-assets fra holycrust.no + Supabase storage (Daniel eier
// brand'et — pilot-bruk). Når brand-picker fra business_profiles er på plass
// (Fase 4-followup), erstattes dette med brand.logo_url + product-bilder fra DB.
const HOLY_LOGO_URL = "https://holycrust.no/assets/logo-CoKe0218.png";
const HC_BUCKET = "https://qraexxlqubveegtueszd.supabase.co/storage/v1/object/public/menu-images";

const DEFAULT_POSTER: PosterContent = {
  templateId: "monday-special",
  brand: {
    businessName: "Holy Crust",
    logoUrl: HOLY_LOGO_URL,
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
    { imageUrl: `${HC_BUCKET}/pepperoni.jpg`, name: "Pepperoni" },
    { imageUrl: `${HC_BUCKET}/holy-veggie-pizza.jpg`, name: "Holy Veggie" },
    { imageUrl: `${HC_BUCKET}/holy-kebab-pizza-v2.jpg`, name: "Holy Kebab" },
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
        { name: "Garlic Brød", description: "Sprøtt, nystekt brød med smør og hvitløk.", price: "29 kr", imageUrl: "https://holycrust.no/images/garlic-brod.jpg" },
        { name: "Holy Garlic Brød", description: "Hvitløksbrød med ost og kylling tikka.", price: "59 kr", imageUrl: `${HC_BUCKET}/holy-garlic-brod.jpg` },
        { name: "Spicy Rice", description: "Aromatisk ris med vår signatur smak.", price: "69 kr", imageUrl: `${HC_BUCKET}/spicy-rice.jpg` },
      ],
    },
    {
      title: "Grill",
      items: [
        { name: "Chicken Tandoori", description: "Klassisk tandoori-marinert kylling.", price: "4 stk 79 · 6 stk 109 · 8 stk 139 kr", imageUrl: `${HC_BUCKET}/grill-chicken-tandoori.jpg` },
        { name: "Peri Peri", description: "Kylling i vår signatur peri peri-saus.", price: "4 stk 79 · 6 stk 109 · 8 stk 139 kr", imageUrl: `${HC_BUCKET}/grill-peri-peri.jpg` },
      ],
    },
    {
      title: "Holy Pizzas",
      items: [
        { name: "Margherita", description: "Klassisk pizza med fyldig tomatsaus og smeltet ost.", price: "Liten 99 · Stor 229 kr", imageUrl: `${HC_BUCKET}/margherita.jpg` },
        { name: "Pepperoni", description: "Tidløs favoritt med rikelig pepperoni.", price: "Liten 129 · Stor 249 kr", imageUrl: `${HC_BUCKET}/pepperoni.jpg` },
        { name: "Chicken Tikka", description: "Saftig marinert kylling og rødløk.", price: "Liten 139 · Stor 259 kr", imageUrl: `${HC_BUCKET}/chicken-tikka-pizza-v2.jpg` },
        { name: "Peri Peri", description: "Kylling, paprika og løk med peri peri-saus.", price: "Liten 149 · Stor 269 kr", imageUrl: `${HC_BUCKET}/peri-peri-pizza.jpg` },
        { name: "Beef Blessing", description: "Marinert biff med ost og paprika.", price: "Liten 149 · Stor 259 kr", imageUrl: `${HC_BUCKET}/beef-blessing-pizza.jpg` },
        { name: "Hot Beef", description: "Krydret biff med løk, jalapeños og tomat.", price: "Liten 149 · Stor 259 kr", imageUrl: `${HC_BUCKET}/hot-beef-pizza-v2.jpg` },
        { name: "Holy Kebab", description: "Dønerkjøtt, jalapeños, mais og rødløk med kebabdressing.", price: "Liten 149 · Stor 269 kr", imageUrl: `${HC_BUCKET}/holy-kebab-pizza-v2.jpg` },
        { name: "Holy Veggie", description: "Paprika, rødløk, sopp, tomat og sort pepper.", price: "Liten 149 · Stor 249 kr", imageUrl: `${HC_BUCKET}/holy-veggie-pizza.jpg` },
      ],
    },
    {
      title: "Detroit Style",
      description: "Tykk, sprø panbunn — vår signaturpizza",
      items: [
        { name: "Ost og Marinara", description: "Sprø firkantet bunn med ost og fyldig tomatsaus.", price: "Liten 169 · Stor 229 kr", imageUrl: `${HC_BUCKET}/detroit-ost-marinara.jpg` },
        { name: "Pepperoni", description: "Klassisk Detroit-stil med rikelig pepperoni.", price: "Liten 179 · Stor 249 kr", imageUrl: `${HC_BUCKET}/detroit-pepperoni.jpg` },
        { name: "Chicken Tikka", description: "Marinert kylling med rødløk på tykk, luftig bunn.", price: "Liten 189 · Stor 259 kr", imageUrl: `${HC_BUCKET}/detroit-chicken-tikka.jpg` },
        { name: "Peri Peri", description: "Kylling, paprika, løk og peri peri-saus.", price: "Liten 189 · Stor 259 kr", imageUrl: `${HC_BUCKET}/detroit-peri-peri.jpg` },
        { name: "Kebab", description: "Dønerkjøtt, jalapeños, mais og kebabdressing.", price: "Liten 189 · Stor 259 kr", imageUrl: `${HC_BUCKET}/detroit-kebab.jpg` },
      ],
    },
    {
      title: "Andre Retter",
      items: [
        { name: "Plain Fries", description: "Klassiske pommes frites, sprø og gylne.", price: "39 kr", imageUrl: `${HC_BUCKET}/plain-fries.png` },
      ],
    },
    {
      title: "Dessert",
      items: [
        { name: "Raspberry Cheesecake", description: "Ostekake med bringebær og hvit sjokolade.", price: "99 kr", imageUrl: `${HC_BUCKET}/raspberry-cheesecake.jpg` },
        { name: "Cookie Double Chocolate", description: "Myk og seig kjeks med dobbel sjokolade.", price: "49 kr", imageUrl: `${HC_BUCKET}/cookie-double-chocolate.jpg` },
      ],
    },
  ],
  contact: {
    phone: "972 52 222",
    address: "Jerikoveien 1, 1067 Oslo",
    website: "holycrust.no",
    hours: [
      { day: "Mandag", time: "11:00 – 22:00" },
      { day: "Tirsdag", time: "11:00 – 22:00" },
      { day: "Onsdag", time: "11:00 – 22:00" },
      { day: "Torsdag", time: "11:00 – 22:00" },
      { day: "Fredag", time: "11:00 – 22:00" },
      { day: "Lørdag", time: "11:00 – 22:00" },
      { day: "Søndag", time: "11:00 – 22:00" },
    ],
  },
  deals: [
    { title: "2 Stor Pizza", description: "Velg blant Holy-favorittene", price: "429 kr" },
    { title: "Familiepakke", description: "Pizza + grill + drikke", price: "699 kr" },
  ],
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

  // Scrape-state
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("holycrust.no");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ categories: { title: string; items: { name: string; description?: string; price: string; imageUrl?: string }[] }[]; source: string; warnings: string[] } | null>(null);

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

  // ── Scrape: hent meny fra nettside ──
  const runScrape = useCallback(async () => {
    if (!scrapeUrl.trim()) return;
    setScrapeLoading(true);
    setScrapeResult(null);
    try {
      const result = await scrapeMenuFromUrl(scrapeUrl);
      setScrapeResult(result);
    } catch (err) {
      setSnackbar(`Scrape-feil: ${err instanceof Error ? err.message : err}`);
    } finally {
      setScrapeLoading(false);
    }
  }, [scrapeUrl]);

  const applyScrapedMenu = useCallback(() => {
    if (!scrapeResult) return;
    setMenu({
      ...menu,
      categories: scrapeResult.categories,
      // Sett mode til menu hvis vi ikke allerede er der
    });
    setMode("menu");
    setScrapeOpen(false);
    setScrapeResult(null);
    setSnackbar(`Importerte ${scrapeResult.categories.reduce((n, c) => n + c.items.length, 0)} items fra ${scrapeResult.source}`);
  }, [scrapeResult, menu, setMenu]);

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

          {mode === "menu" && (
            <Button
              startIcon={<AutoAwesomeIcon />}
              variant="outlined"
              size="small"
              onClick={() => setScrapeOpen(true)}
            >
              Hent fra nettside
            </Button>
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

        {/* Scrape-dialog */}
        <Dialog open={scrapeOpen} onClose={() => setScrapeOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Importer meny fra nettside</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Backend prøver Supabase-detektor først (matcher Holy Crust-stack), faller tilbake til generic HTML-scrape (alt-text + img-tags).
              Inspiser resultatet før du importerer.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField
                autoFocus
                label="Nettside-URL"
                fullWidth
                size="small"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                disabled={scrapeLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runScrape();
                }}
              />
              <Button
                variant="contained"
                onClick={runScrape}
                disabled={scrapeLoading || !scrapeUrl.trim()}
                startIcon={scrapeLoading ? <CircularProgress size={14} /> : null}
              >
                {scrapeLoading ? "Henter…" : "Hent"}
              </Button>
            </Stack>

            {scrapeResult && (
              <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, maxHeight: 400, overflow: "auto" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  Kilde: <code>{scrapeResult.source}</code> ·{" "}
                  {scrapeResult.categories.reduce((n, c) => n + c.items.length, 0)} items i{" "}
                  {scrapeResult.categories.length} kategorier
                </Typography>
                {scrapeResult.warnings.length > 0 && (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    {scrapeResult.warnings.join(" · ")}
                  </Alert>
                )}
                {scrapeResult.categories.map((c, ci) => (
                  <Box key={ci} sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {c.title} ({c.items.length})
                    </Typography>
                    <Stack spacing={0.5} sx={{ pl: 1.5, mt: 0.5 }}>
                      {c.items.map((it, ii) => (
                        <Stack key={ii} direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              width: 32, height: 32, flexShrink: 0,
                              borderRadius: "50%",
                              backgroundImage: it.imageUrl ? `url(${it.imageUrl})` : undefined,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              bgcolor: it.imageUrl ? undefined : "action.hover",
                              border: it.imageUrl ? "none" : "1px dashed",
                              borderColor: "divider",
                            }}
                          />
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {it.name}
                          </Typography>
                          <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                            {it.price}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setScrapeOpen(false)}>Avbryt</Button>
            <Button
              variant="contained"
              onClick={applyScrapedMenu}
              disabled={!scrapeResult || scrapeResult.categories.length === 0}
            >
              Importer
            </Button>
          </DialogActions>
        </Dialog>

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
                  {/* Image-upload: thumbnail-preview + upload-knapp */}
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        border: "1px dashed",
                        borderColor: "divider",
                        flexShrink: 0,
                        backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundColor: item.imageUrl ? undefined : "action.hover",
                      }}
                    />
                    <MenuItemImageUpload
                      currentUrl={item.imageUrl}
                      onUploaded={(url) => {
                        const nextCats = [...content.categories];
                        const nextItems = [...cat.items];
                        nextItems[ii] = { ...item, imageUrl: url };
                        nextCats[ci] = { ...cat, items: nextItems };
                        update({ categories: nextCats });
                      }}
                      onClear={item.imageUrl ? () => {
                        const nextCats = [...content.categories];
                        const nextItems = [...cat.items];
                        nextItems[ii] = { ...item, imageUrl: undefined };
                        nextCats[ci] = { ...cat, items: nextItems };
                        update({ categories: nextCats });
                      } : undefined}
                    />
                  </Stack>
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

// ─────────────────────────────────────────────────────────────────────────
// MenuItemImageUpload — kompakt upload-knapp pr menu-item
// ─────────────────────────────────────────────────────────────────────────

function MenuItemImageUpload({
  currentUrl,
  onUploaded,
  onClear,
}: {
  currentUrl: string | undefined;
  onUploaded: (url: string) => void;
  onClear?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadPosterImage(file);
      onUploaded(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        size="small"
        variant={currentUrl ? "text" : "outlined"}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        sx={{ fontSize: 11, py: 0.25, minWidth: 0 }}
      >
        {uploading ? "Laster…" : currentUrl ? "Bytt bilde" : "Legg til bilde"}
      </Button>
      {currentUrl && onClear && (
        <IconButton size="small" onClick={onClear} sx={{ p: 0.25 }}>
          <DeleteIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
      {error && (
        <Typography variant="caption" color="error" sx={{ fontSize: 10 }}>
          {error.slice(0, 30)}
        </Typography>
      )}
    </Stack>
  );
}

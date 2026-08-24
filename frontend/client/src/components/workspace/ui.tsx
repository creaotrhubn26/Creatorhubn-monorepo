// @ts-nocheck
/**
 * ui.tsx — delte byggeklosser for Team Workspace-tabbene (dark CreatorHub).
 */
import React, { useRef, useState } from 'react';
import { Box, Stack, Typography, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
import AddPhotoAlternate from '@mui/icons-material/AddPhotoAlternate';
import Close from '@mui/icons-material/Close';
import { ws } from './workspaceTheme';

/** Ett-felts inndata-dialog — ws-stilet erstatning for window.prompt() */
export const WsPromptDialog: React.FC<{
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void> | void;
}> = ({ open, title, label, placeholder, submitLabel = 'Legg til', cancelLabel = 'Avbryt', defaultValue, onClose, onSubmit }) => {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  React.useEffect(() => { if (open) { setValue(defaultValue || ''); setBusy(false); setError(null); } }, [open, defaultValue]);
  const submit = async () => {
    const v = value.trim(); if (!v || busy) return;
    setBusy(true); setError(null);
    try { await onSubmit(v); onClose(); }
    catch (e: any) { setError(e?.message || 'Kunne ikke lagre'); setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus fullWidth size="small" label={label} placeholder={placeholder}
          value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          error={!!error} helperText={error || undefined} disabled={busy}
          sx={{ mt: 0.5 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button size="small" onClick={onClose} disabled={busy} sx={{ color: ws.textDim, textTransform: 'none' }}>{cancelLabel}</Button>
        <Button size="small" variant="contained" onClick={submit} disabled={busy || !value.trim()}
          sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accent } }}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Global dialog-tjeneste — drop-in-erstatning for window.alert/confirm/prompt
 * i workspace-flatene. Krever at <WsDialogHost /> er montert (App.tsx);
 * uten host faller kallene tilbake til native window.*-dialogene.
 */
type WsDlgReq =
  | { kind: 'alert'; message: string; resolve: () => void }
  | { kind: 'confirm'; message: string; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; title: string; defaultValue?: string; resolve: (v: string | null) => void };

let wsDlgPush: ((r: WsDlgReq) => void) | null = null;

export const wsAlert = (message: unknown): Promise<void> =>
  new Promise((resolve) => {
    const m = String(message ?? '');
    if (wsDlgPush) wsDlgPush({ kind: 'alert', message: m, resolve });
    else { window.alert(m); resolve(); }
  });

export const wsConfirm = (message: unknown): Promise<boolean> =>
  new Promise((resolve) => {
    const m = String(message ?? '');
    if (wsDlgPush) wsDlgPush({ kind: 'confirm', message: m, resolve });
    else resolve(window.confirm(m));
  });

export const wsPrompt = (title: unknown, defaultValue?: unknown): Promise<string | null> =>
  new Promise((resolve) => {
    const t = String(title ?? '');
    const d = defaultValue == null ? undefined : String(defaultValue);
    if (wsDlgPush) wsDlgPush({ kind: 'prompt', title: t, defaultValue: d, resolve });
    else resolve(window.prompt(t, d));
  });

export const WsDialogHost: React.FC = () => {
  const [queue, setQueue] = useState<WsDlgReq[]>([]);
  React.useEffect(() => {
    wsDlgPush = (r) => setQueue((q) => [...q, r]);
    return () => { wsDlgPush = null; };
  }, []);
  const cur = queue[0];
  const done = () => setQueue((q) => q.slice(1));
  if (!cur) return null;
  if (cur.kind === 'prompt') {
    return (
      <WsPromptDialog
        open title={cur.title} defaultValue={cur.defaultValue} submitLabel="OK"
        onClose={() => { cur.resolve(null); done(); }}
        onSubmit={(v) => { cur.resolve(v); }}
      />
    );
  }
  const isConfirm = cur.kind === 'confirm';
  const cancel = () => { if (isConfirm) (cur.resolve as (ok: boolean) => void)(false); else (cur.resolve as () => void)(); done(); };
  const ok = () => { if (isConfirm) (cur.resolve as (ok: boolean) => void)(true); else (cur.resolve as () => void)(); done(); };
  return (
    <Dialog open onClose={cancel} fullWidth maxWidth="xs">
      <DialogContent sx={{ pt: 3 }}>
        <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{cur.message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {isConfirm && (
          <Button size="small" onClick={cancel} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
        )}
        <Button size="small" variant="contained" onClick={ok} autoFocus
          sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accent } }}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Gjenbrukbar modal (for «Se alle» / detalj-visninger) */
export const WsModal: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: any }> = ({ open, onClose, title, children, maxWidth = 'md' }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth}>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {title}
      <IconButton onClick={onClose} size="small"><Close fontSize="small" /></IconButton>
    </DialogTitle>
    <DialogContent dividers>{children}</DialogContent>
  </Dialog>
);

export const WsCard: React.FC<{ children: React.ReactNode; sx?: any; pad?: number; onClick?: () => void; ariaLabel?: string }> = ({ children, sx, pad = 2, onClick, ariaLabel }) => (
  <Box
    onClick={onClick}
    // Et klikkbart kort må være et fokuserbart kontrollelement, ellers er det
    // usynlig for tastatur og skjermlesere.
    {...(onClick ? {
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': ariaLabel,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      },
    } : {})}
    sx={{
      bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`,
      p: pad, ...sx,
    }}
  >
    {children}
  </Box>
);

/**
 * Feiltilstand for primær-lasting: vises når hovedspørringen til en fane feiler
 * (nettverk/500), i stedet for en misvisende tom-tilstand. «Prøv igjen» kaller
 * onRetry. Locale-nøytral — teksten sendes inn (fanen har allerede makeT).
 */
export const WsErrorState: React.FC<{ message: string; retryLabel?: string; onRetry?: () => void; sx?: any }> = ({ message, retryLabel = 'Prøv igjen', onRetry, sx }) => (
  <Box sx={{
    bgcolor: ws.panel, border: `1px solid ${ws.redSoft}`, borderRadius: `${ws.radius}px`,
    p: 3, textAlign: 'center', ...sx,
  }}>
    <Typography sx={{ fontSize: 13.5, color: ws.textDim, mb: onRetry ? 1.5 : 0 }}>{message}</Typography>
    {onRetry && (
      <Box
        component="button"
        onClick={onRetry}
        sx={{
          font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          bgcolor: 'transparent', color: ws.accent, border: `1px solid ${ws.accentBorder}`,
          borderRadius: `${ws.radiusSm}px`, px: 2, py: 0.75,
          '&:hover': { bgcolor: ws.accentSoft },
        }}
      >
        {retryLabel}
      </Box>
    )}
  </Box>
);

export const WsSectionTitle: React.FC<{ icon?: React.ReactNode; title: string; action?: React.ReactNode; sx?: any }> = ({ icon, title, action, sx }) => (
  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, ...sx }}>
    <Stack direction="row" alignItems="center" spacing={1}>
      {icon}
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: ws.text }}>{title}</Typography>
    </Stack>
    {action}
  </Stack>
);

/** Donut/ring progress (Team Sync %, Ressursallokering) */
export const WsRing: React.FC<{ value: number; size?: number; thickness?: number; color?: string; label?: string; sub?: string }> = ({
  value, size = 120, thickness = 10, color = ws.green, label, sub,
}) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: size * 0.22, fontWeight: 800, color: ws.text, lineHeight: 1 }}>{label ?? `${value}%`}</Typography>
        {sub && <Typography sx={{ fontSize: 11, color: ws.textDim, mt: 0.25 }}>{sub}</Typography>}
      </Box>
    </Box>
  );
};

/** Tynn fremdriftslinje */
export const WsBar: React.FC<{ value: number; color?: string; height?: number }> = ({ value, color = ws.accent, height = 6 }) => (
  <Box sx={{ width: '100%', height, borderRadius: height, bgcolor: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
    <Box sx={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', bgcolor: color, borderRadius: height }} />
  </Box>
);

/** Liten status-pille (Ferdig/Pågår/Planlagt/Kritisk osv.) */
export const WsTag: React.FC<{ label: string; icon?: React.ReactNode; tone?: 'green' | 'amber' | 'red' | 'blue' | 'accent' | 'neutral' }> = ({ label, icon, tone = 'neutral' }) => {
  const map: any = {
    green: [ws.green, ws.greenSoft], amber: [ws.amber, ws.amberSoft], red: [ws.red, ws.redSoft],
    blue: [ws.blue, ws.blueSoft], accent: [ws.accent, ws.accentSoft], neutral: [ws.textDim, 'rgba(255,255,255,0.06)'],
  };
  const [c, bg] = map[tone] || map.neutral;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 1, py: 0.25, borderRadius: 1, bgcolor: bg, color: c, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', '& svg': { fontSize: 13 } }}>
      {icon}{label}
    </Box>
  );
};

/** Stat-kort (Totalt antall shots, Fullført, osv.) */
export const WsStat: React.FC<{ icon?: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: string }> = ({ icon, label, value, sub, tone }) => (
  <WsCard pad={1.75}>
    <Stack direction="row" spacing={1.5} alignItems="center">
      {icon && (
        <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: tone || ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ws.accent }}>{icon}</Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: ws.textDim }}>{label}</Typography>
        {/* component="div": `value` er ofte en <Typography> (=<p>) selv — et
            <p> inne i et <p> er ugyldig HTML (validateDOMNesting-advarsel). */}
        <Typography component="div" sx={{ fontSize: 22, fontWeight: 800, color: ws.text, lineHeight: 1.1 }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{sub}</Typography>}
      </Box>
    </Stack>
  </WsCard>
);

/** Pille-faner (Alle/Forberedelser/Vielse … eller Timeline/Board/Kart) */
export const WsPills: React.FC<{ items: { key: string; label: string }[]; value: string; onChange: (k: string) => void; sx?: any }> = ({ items, value, onChange, sx }) => (
  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, ...sx }}>
    {items.map((it) => {
      const active = it.key === value;
      return (
        <Box key={it.key} onClick={() => onChange(it.key)} sx={{
          px: 1.5, py: 0.6, borderRadius: 2, cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
          color: active ? ws.accent : ws.textDim, bgcolor: active ? ws.accentSoft : 'transparent',
          border: `1px solid ${active ? ws.accentBorder : 'transparent'}`,
          '&:hover': { color: ws.text, bgcolor: active ? ws.accentSoft : 'rgba(255,255,255,0.04)' },
        }}>{it.label}</Box>
      );
    })}
  </Stack>
);

/** Bilde-placeholder (referanser/moodboard/media — vi har ikke ekte bilder i mock) */
export const WsImg: React.FC<{ ratio?: string; label?: string; sx?: any }> = ({ ratio = '1 / 1', label, sx }) => (
  <Box sx={{
    aspectRatio: ratio, borderRadius: `${ws.radiusSm}px`, position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(135deg, rgba(255,140,0,0.16), rgba(255,255,255,0.05))',
    border: `1px solid ${ws.borderSoft}`, display: 'flex', alignItems: 'flex-end', ...sx,
  }}>
    {label && <Typography sx={{ position: 'absolute', left: 6, bottom: 6, fontSize: 10.5, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.45)', color: '#fff' }}>{label}</Typography>}
  </Box>
);

/**
 * WsImageGrid — opplastbart bilde-rutenett. Tomme/placeholder-ruter er en EKTE
 * «legg til bilde»-knapp (klikk → filvelger → forhåndsvisning). `onUpload` POSTer
 * filen til panelets opplastings-endepunkt (wires per panel: moodboard / capture
 * media / reference-archive). Uten onUpload brukes lokal forhåndsvisning slik at
 * UX-en fungerer allerede nå.
 */
export const WsPageTitle: React.FC<{ icon?: React.ReactNode; title: string; sub?: string; actions?: React.ReactNode; children?: React.ReactNode }> = ({ icon, title, sub, actions, children }) => (
  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
      {icon && (
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1, #22d3ee)', boxShadow: '0 4px 16px rgba(99,102,241,.4)' }}>{icon}</Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Typography sx={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4, lineHeight: 1.2, background: 'linear-gradient(90deg, #f5f5f8, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</Typography>
          {children}
        </Stack>
        {sub && <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{sub}</Typography>}
      </Box>
    </Stack>
    {actions && <Stack direction="row" spacing={1} alignItems="center">{actions}</Stack>}
  </Stack>
);

// Kanonisk bilde-type for workspace. useProjectImages re-eksporterer denne, så
// bilder fra API-et og bilder i UI-et er samme type — to parallelle
// definisjoner ga «WsImageItem is not assignable to WsImageItem».
// category er nullbar fordi API-et sender null for ukategoriserte bilder.
export interface WsImageItem { id: string; url: string; label?: string; rating?: number; flag?: boolean; category?: string | null }
export const WsImageGrid: React.FC<{
  images?: WsImageItem[];
  columns?: number;
  ratio?: string;
  addLabel?: string;
  allowAdd?: boolean;
  onUpload?: (file: File) => Promise<WsImageItem | void> | void;
  onRemove?: (id: string) => void;
  onSelect?: (item: WsImageItem) => void;
  extraLabel?: string; // f.eks. "+12"
}> = ({ images = [], columns = 3, ratio = '1 / 1', addLabel = 'Legg til bilde', allowAdd = true, onUpload, onRemove, onSelect, extraLabel }) => {
  const [items, setItems] = useState<WsImageItem[]>(images);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Synk når bilder lastes asynkront (f.eks. fra B2 via useProjectImages).
  // NB: dep-en må være en STABIL signatur, ikke selve array-referansen — ellers
  // looper effekten (default `images=[]` og inline-mappede props gir ny referanse
  // hver render → «Maximum update depth exceeded»).
  const imagesSig = images.map((im) => `${im.id}:${im.url}`).join('|');
  React.useEffect(() => { setItems(images); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [imagesSig]);

  const pick = () => inputRef.current?.click();
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const localUrl = URL.createObjectURL(file);
      const local: WsImageItem = { id: `local-${file.name}-${file.size}`, url: localUrl, label: file.name };
      setItems((p) => [...p, local]);
      try {
        if (onUpload) {
          const saved = await onUpload(file);
          if (saved && saved.url) setItems((p) => p.map((it) => (it.id === local.id ? saved : it)));
        }
      } catch { /* behold lokal forhåndsvisning */ }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 1 }}>
      {items.map((im, i) => (
        <Box key={im.id} onClick={() => onSelect && onSelect(im)} sx={{ aspectRatio: ratio, borderRadius: `${ws.radiusSm}px`, position: 'relative', overflow: 'hidden', border: `1px solid ${ws.borderSoft}`, bgcolor: ws.panelInput, cursor: onSelect ? 'pointer' : 'default',
          background: im.url ? `center/cover no-repeat url(${im.url})` : 'linear-gradient(135deg, rgba(255,140,0,0.16), rgba(255,255,255,0.05))', '&:hover': onSelect ? { outline: `2px solid ${ws.accentBorder}` } : undefined }}>
          {im.flag && <Box sx={{ position: 'absolute', top: 5, left: 5, width: 18, height: 18, borderRadius: '50%', bgcolor: ws.accent, color: ws.accentContrast, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>★</Box>}
          {typeof im.rating === 'number' && im.rating > 0 && (
            <Box sx={{ position: 'absolute', top: 5, right: 5, px: 0.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.55)', color: '#ffd24a', fontSize: 10, fontWeight: 700 }}>{'★'.repeat(Math.min(5, im.rating))}</Box>
          )}
          {im.label && <Typography sx={{ position: 'absolute', left: 6, bottom: 6, fontSize: 10.5, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', maxWidth: '85%' }} noWrap>{im.label}</Typography>}
          {onRemove && (
            <IconButton size="small" onClick={() => { setItems((p) => p.filter((x) => x.id !== im.id)); onRemove(im.id); }}
              sx={{ position: 'absolute', top: 2, right: 2, color: '#fff', bgcolor: 'rgba(0,0,0,0.45)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }, p: 0.25 }}>
              <Close sx={{ fontSize: 14 }} />
            </IconButton>
          )}
          {extraLabel && i === items.length - 1 && (
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{extraLabel}</Typography>
            </Box>
          )}
        </Box>
      ))}
      {allowAdd && (
        <Box onClick={pick} role="button" tabIndex={0}
          sx={{ aspectRatio: ratio, borderRadius: `${ws.radiusSm}px`, border: `1.5px dashed ${ws.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: ws.textDim, transition: 'all .12s', opacity: busy ? 0.6 : 1, '&:hover': { borderColor: ws.accentBorder, color: ws.accent, bgcolor: ws.accentSoft } }}>
          <AddPhotoAlternate sx={{ fontSize: 22, mb: 0.5 }} />
          <Typography sx={{ fontSize: 10.5, fontWeight: 600, textAlign: 'center', px: 0.5 }}>{busy ? 'Laster opp…' : addLabel}</Typography>
        </Box>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
    </Box>
  );
};

/** Enkel tabell på mørk flate */
export const WsTable: React.FC<{ columns: string[]; rows: React.ReactNode[][]; widths?: string[]; onRowClick?: (i: number) => void }> = ({ columns, rows, widths, onRowClick }) => (
  <Box sx={{ overflowX: 'auto' }}>
    <Box sx={{ display: 'table', width: '100%', borderCollapse: 'collapse' }}>
      <Box sx={{ display: 'table-header-group' }}>
        <Box sx={{ display: 'table-row' }}>
          {columns.map((c, i) => (
            <Box key={i} sx={{ display: 'table-cell', px: 1.25, py: 1, fontSize: 11, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${ws.border}`, width: widths?.[i] }}>{c}</Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ display: 'table-row-group' }}>
        {rows.map((r, ri) => (
          <Box key={ri} onClick={() => onRowClick && onRowClick(ri)} sx={{ display: 'table-row', cursor: onRowClick ? 'pointer' : 'default', '&:hover': { bgcolor: onRowClick ? ws.accentSoft : 'rgba(255,255,255,0.02)' } }}>
            {r.map((cell, ci) => (
              <Box key={ci} sx={{ display: 'table-cell', px: 1.25, py: 1, fontSize: 13, color: ws.text, borderBottom: `1px solid ${ws.borderSoft}`, verticalAlign: 'middle' }}>{cell}</Box>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
);

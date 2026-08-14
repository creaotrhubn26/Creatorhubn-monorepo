// @ts-nocheck
/**
 * ui.tsx — delte byggeklosser for Team Workspace-tabbene (dark CreatorHub).
 */
import React, { useRef, useState } from 'react';
import { Box, Stack, Typography, IconButton, Dialog, DialogTitle, DialogContent } from '@mui/material';
import AddPhotoAlternate from '@mui/icons-material/AddPhotoAlternate';
import Close from '@mui/icons-material/Close';
import { ws } from './workspaceTheme';

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

/** Sidetittel i CreatorHub-stil: gradient-ikon + gradient-tekst + underlinje + actions. */
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

export const WsCard: React.FC<{ children: React.ReactNode; sx?: any; pad?: number; onClick?: () => void; ariaLabel?: string }> = ({ children, sx, pad = 2, onClick, ariaLabel }) => (
  <Box
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    aria-label={ariaLabel}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
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
    <Box sx={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', bgcolor: color, borderRadius: height, transition: 'width 0.35s ease' }} />
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
export const WsPills: React.FC<{ items: { key: string; label: string }[]; value: string; onChange: (k: string) => void; sx?: any }> = ({ items, value, onChange, sx }) => {
  const activeIdx = Math.max(0, items.findIndex((it) => it.key === value));
  const select = (e: React.KeyboardEvent, idx: number) => {
    e.preventDefault();
    const next = items[idx];
    onChange(next.key);
    const nextEl = (e.currentTarget as HTMLElement).parentElement?.querySelector(`[data-ws-pill="${next.key}"]`) as HTMLElement | null;
    nextEl?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') select(e, Math.min(items.length - 1, idx + 1));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') select(e, Math.max(0, idx - 1));
    else if (e.key === 'Home') select(e, 0);
    else if (e.key === 'End') select(e, items.length - 1);
  };
  return (
    <Stack direction="row" spacing={0.5} role="tablist" sx={{ flexWrap: 'wrap', gap: 0.5, ...sx }}>
      {items.map((it, idx) => {
        const active = it.key === value;
        return (
          <Box
            key={it.key}
            data-ws-pill={it.key}
            role="tab"
            aria-selected={active}
            tabIndex={idx === activeIdx ? 0 : -1}
            onClick={() => onChange(it.key)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            sx={{
              px: 1.5, py: 0.6, borderRadius: 2, cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? ws.accent : ws.textDim, bgcolor: active ? ws.accentSoft : 'transparent',
              border: `1px solid ${active ? ws.accentBorder : 'transparent'}`,
              '&:hover': { color: ws.text, bgcolor: active ? ws.accentSoft : 'rgba(255,255,255,0.04)' },
              '&:focus-visible': { outline: `2px solid ${ws.accent}`, outlineOffset: 2 },
            }}
          >{it.label}</Box>
        );
      })}
    </Stack>
  );
};

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
export interface WsImageItem { id: string; url: string; label?: string; rating?: number; flag?: boolean; category?: string | null; comments?: any[]; fit?: number | null; b2Key?: string | null; createdAt?: string | null }
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
  search?: string; // highlight av treff i label
  bulk?: { sel: Set<string>; onToggle: (id: string, e: React.MouseEvent) => void }; // multi-seleksjon
  showFit?: boolean; // farge-match-prosent nederst på bildene
  overlay?: '9x16' | '4x5' | '1x1'; // komposisjons-maske
  actions?: (im: WsImageItem) => React.ReactNode; // egne handlinger øverst (gruppe-delte bilder)
  accept?: string; // filtyper i opplasting (default image/*)
  colorStrip?: (im: WsImageItem) => string | null; // fargestripe nederst (fargekode fra culling)
  onContextMenu?: (im: WsImageItem, e: React.MouseEvent) => void; // høyreklikk på tile
}> = ({ images = [], columns = 3, ratio = '1 / 1', addLabel = 'Legg til bilde', allowAdd = true, onUpload, onRemove, onSelect, extraLabel, search, bulk, showFit, overlay, actions, accept = 'image/*', colorStrip, onContextMenu }) => {
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
      {items.map((im, i) => {
        const sel = !!bulk?.sel.has(im.id);
        return (
        <Box key={im.id} data-im-id={im.id} onClick={(e) => { if (bulk) bulk.onToggle(im.id, e); else if (onSelect) onSelect(im); }} onContextMenu={(e) => { e.preventDefault(); if (onContextMenu) onContextMenu(im, e); }} sx={{ aspectRatio: ratio, borderRadius: `${ws.radiusSm}px`, position: 'relative', overflow: 'hidden', border: sel ? '2px solid #6366f1' : `1px solid ${ws.borderSoft}`, bgcolor: ws.panelInput, cursor: (bulk || onSelect) ? 'pointer' : 'default',
          background: im.url ? `center/cover no-repeat url(${im.url})` : 'linear-gradient(135deg, rgba(255,140,0,0.16), rgba(255,255,255,0.05))', transition: 'transform .15s ease, border-color .12s', '&:hover': bulk || onSelect ? { outline: `2px solid ${ws.accentBorder}` } : undefined }}>
          {im.flag && <Box sx={{ position: 'absolute', top: 5, left: 5, width: 18, height: 18, borderRadius: '50%', bgcolor: ws.accent, color: ws.accentContrast, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>★</Box>}
          {typeof im.rating === 'number' && im.rating > 0 && (
            <Box sx={{ position: 'absolute', top: 5, right: 5, px: 0.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.55)', color: '#ffd24a', fontSize: 10, fontWeight: 700 }}>{'★'.repeat(Math.min(5, im.rating))}</Box>
          )}
          {im.label && (
            <Typography sx={{ position: 'absolute', left: 6, bottom: 6, fontSize: 10.5, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', maxWidth: '85%' }} noWrap>
              {search && im.label.toLowerCase().includes(search.toLowerCase()) ? (
                (() => {
                  const q = search.toLowerCase();
                  const hay = im.label.toLowerCase();
                  const i = hay.indexOf(q);
                  if (i === -1) return im.label;
                  return (
                    <>
                      {im.label.slice(0, i)}
                      <Box component="span" sx={{ color: '#fde047', fontWeight: 800 }}>{im.label.slice(i, i + q.length)}</Box>
                      {im.label.slice(i + q.length)}
                    </>
                  );
                })()
              ) : im.label}
            </Typography>
          )}
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
          {bulk && sel && (
            <Box sx={{ position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: '50%', bgcolor: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.5)' }}>✓</Box>
          )}
          {actions && <Box sx={{ position: 'absolute', top: 5, left: 5, zIndex: 3, display: 'flex', alignItems: 'center', gap: 0.4 }} onClick={(e) => e.stopPropagation()}>{actions(im)}</Box>}
          {showFit && typeof im.fit === 'number' && (
            <Box sx={{ position: 'absolute', right: 5, bottom: 5, px: 0.6, py: 0.2, borderRadius: 1, bgcolor: im.fit >= 60 ? 'rgba(52,211,153,0.85)' : 'rgba(251,191,36,0.85)', color: '#0d0d16', fontSize: 10, fontWeight: 800 }} title="Farge-match mot paletten">{im.fit}%</Box>
          )}
          {colorStrip && (() => { const col = colorStrip(im); return col ? <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, bgcolor: col }} /> : null; })()}
          {overlay && (
            <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
              {(() => {
                // Riktig aspect-matematikk inni kvadrat-flisen: bredde = høyde × w/h.
                const ratio = overlay === '9x16' ? 9 / 16 : overlay === '4x5' ? 4 / 5 : 1; // w/h (stående)
                const inset = overlay === '1x1' ? 0 : ((1 - ratio) / 2) * 100;
                return (
                  <>
                    <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${inset}%`, bgcolor: 'rgba(0,0,0,0.5)', transition: 'width .25s ease' }} />
                    <Box sx={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${inset}%`, bgcolor: 'rgba(0,0,0,0.5)', transition: 'width .25s ease' }} />
                    <Box sx={{ position: 'absolute', top: '5%', bottom: '5%', left: `${inset}%`, right: `${inset}%`, transition: 'left .25s ease, right .25s ease' }}>
                      <Box sx={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.35)' }} />
                      {[
                        { top: -1, left: -1, borderTop: '2px solid #fff', borderLeft: '2px solid #fff' },
                        { top: -1, right: -1, borderTop: '2px solid #fff', borderRight: '2px solid #fff' },
                        { bottom: -1, left: -1, borderBottom: '2px solid #fff', borderLeft: '2px solid #fff' },
                        { bottom: -1, right: -1, borderBottom: '2px solid #fff', borderRight: '2px solid #fff' },
                      ].map((sx: any, i: number) => (
                        <Box key={i} sx={{ position: 'absolute', width: 15, height: 15, ...sx }} />
                      ))}
                      <Box sx={{ position: 'absolute', top: '33.333%', left: 0, right: 0, height: 1, bgcolor: 'rgba(255,255,255,0.4)' }} />
                      <Box sx={{ position: 'absolute', bottom: '33.333%', left: 0, right: 0, height: 1, bgcolor: 'rgba(255,255,255,0.4)' }} />
                      <Box sx={{ position: 'absolute', left: '33.333%', top: 0, bottom: 0, width: 1, bgcolor: 'rgba(255,255,255,0.4)' }} />
                      <Box sx={{ position: 'absolute', right: '33.333%', top: 0, bottom: 0, width: 1, bgcolor: 'rgba(255,255,255,0.4)' }} />
                    </Box>
                    <Box sx={{ position: 'absolute', top: 6, left: 6, px: 0.6, py: 0.2, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4 }}>{overlay.toUpperCase()}</Box>
                  </>
                );
              })()}
            </Box>
          )}
        </Box>
        );
      })}
      {allowAdd && (
        <Box onClick={pick} role="button" tabIndex={0}
          sx={{ aspectRatio: ratio, borderRadius: `${ws.radiusSm}px`, border: `1.5px dashed ${ws.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: ws.textDim, transition: 'all .12s', opacity: busy ? 0.6 : 1, '&:hover': { borderColor: ws.accentBorder, color: ws.accent, bgcolor: ws.accentSoft } }}>
          <AddPhotoAlternate sx={{ fontSize: 22, mb: 0.5 }} />
          <Typography sx={{ fontSize: 10.5, fontWeight: 600, textAlign: 'center', px: 0.5 }}>{busy ? 'Laster opp…' : addLabel}</Typography>
        </Box>
      )}
      <input ref={inputRef} type="file" accept={accept} multiple hidden onChange={(e) => handleFiles(e.target.files)} />
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
          <Box key={ri} data-ws-table-row={ri} onClick={() => onRowClick && onRowClick(ri)} sx={{ display: 'table-row', cursor: onRowClick ? 'pointer' : 'default', '&:hover': { bgcolor: onRowClick ? ws.accentSoft : 'rgba(255,255,255,0.02)' } }}>
            {r.map((cell, ci) => (
              <Box key={ci} sx={{ display: 'table-cell', px: 1.25, py: 1, fontSize: 13, color: ws.text, borderBottom: `1px solid ${ws.borderSoft}`, verticalAlign: 'middle' }}>{cell}</Box>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
);

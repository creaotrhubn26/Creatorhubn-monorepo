// @ts-nocheck
/**
 * ui.tsx — delte byggeklosser for Team Workspace-tabbene (dark CreatorHub).
 */
import React, { useRef, useState } from 'react';
import { Box, Stack, Typography, IconButton } from '@mui/material';
import AddPhotoAlternate from '@mui/icons-material/AddPhotoAlternate';
import Close from '@mui/icons-material/Close';
import { ws } from './workspaceTheme';

export const WsCard: React.FC<{ children: React.ReactNode; sx?: any; pad?: number }> = ({ children, sx, pad = 2 }) => (
  <Box sx={{
    bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`,
    p: pad, ...sx,
  }}>
    {children}
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
export const WsTag: React.FC<{ label: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'accent' | 'neutral' }> = ({ label, tone = 'neutral' }) => {
  const map: any = {
    green: [ws.green, ws.greenSoft], amber: [ws.amber, ws.amberSoft], red: [ws.red, ws.redSoft],
    blue: [ws.blue, ws.blueSoft], accent: [ws.accent, ws.accentSoft], neutral: [ws.textDim, 'rgba(255,255,255,0.06)'],
  };
  const [c, bg] = map[tone] || map.neutral;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.25, borderRadius: 1, bgcolor: bg, color: c, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
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
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: ws.text, lineHeight: 1.1 }}>{value}</Typography>
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
export interface WsImageItem { id: string; url: string; label?: string }
export const WsImageGrid: React.FC<{
  images?: WsImageItem[];
  columns?: number;
  ratio?: string;
  addLabel?: string;
  allowAdd?: boolean;
  onUpload?: (file: File) => Promise<WsImageItem | void> | void;
  onRemove?: (id: string) => void;
  extraLabel?: string; // f.eks. "+12"
}> = ({ images = [], columns = 3, ratio = '1 / 1', addLabel = 'Legg til bilde', allowAdd = true, onUpload, onRemove, extraLabel }) => {
  const [items, setItems] = useState<WsImageItem[]>(images);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Synk når bilder lastes asynkront (f.eks. fra B2 via useProjectImages).
  React.useEffect(() => { setItems(images); }, [images]);

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
        <Box key={im.id} sx={{ aspectRatio: ratio, borderRadius: `${ws.radiusSm}px`, position: 'relative', overflow: 'hidden', border: `1px solid ${ws.borderSoft}`, bgcolor: ws.panelInput,
          background: im.url ? `center/cover no-repeat url(${im.url})` : 'linear-gradient(135deg, rgba(255,140,0,0.16), rgba(255,255,255,0.05))' }}>
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
export const WsTable: React.FC<{ columns: string[]; rows: React.ReactNode[][]; widths?: string[] }> = ({ columns, rows, widths }) => (
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
          <Box key={ri} sx={{ display: 'table-row', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
            {r.map((cell, ci) => (
              <Box key={ci} sx={{ display: 'table-cell', px: 1.25, py: 1, fontSize: 13, color: ws.text, borderBottom: `1px solid ${ws.borderSoft}`, verticalAlign: 'middle' }}>{cell}</Box>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
);

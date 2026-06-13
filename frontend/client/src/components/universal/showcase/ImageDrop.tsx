/**
 * ImageDrop.tsx — drag-and-drop bildeopplasting (ingen URL).
 * Slipp/velg et bilde → resizes klient-side på canvas → data-URL (JPEG).
 * Brukes for profilbilde (sirkel) og cover-bilde. express.json-grensen er 50mb,
 * så data-URL inline er trygt; ingen ekstern lagring kreves.
 */
import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { PhotoCamera } from '@mui/icons-material';

const ACCENT = '#FF6B35', BORDER = 'rgba(255,255,255,0.14)', MUTED = 'rgba(245,242,234,0.55)';

export async function fileToResizedDataUrl(file: File, maxDim: number, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('no ctx')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface Props {
  value?: string | null;
  onChange: (dataUrl: string) => void | Promise<void>;
  variant?: 'circle' | 'cover';
  maxDim?: number;
  label?: string;
  size?: number; // for circle
}

export default function ImageDrop({ value, onChange, variant = 'circle', maxDim, label, size = 84 }: Props) {
  const [over, setOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const isCircle = variant === 'circle';
  const dim = maxDim ?? (isCircle ? 512 : 1400);

  const handleFile = async (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setBusy(true);
    try { const url = await fileToResizedDataUrl(file, dim); await onChange(url); }
    finally { setBusy(false); }
  };

  const common = {
    onClick: () => inputRef.current?.click(),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(false); void handleFile(e.dataTransfer.files?.[0]); },
  };

  return (
    <Box>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => void handleFile(e.target.files?.[0])} />
      {isCircle ? (
        <Box {...common} sx={{
          width: size, height: size, borderRadius: '50%', cursor: 'pointer', position: 'relative', overflow: 'hidden',
          border: `2px dashed ${over ? ACCENT : BORDER}`, bgcolor: 'rgba(255,107,53,0.08)',
          backgroundImage: value ? `url(${value})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s',
        }}>
          {busy ? <CircularProgress size={20} sx={{ color: ACCENT }} /> : !value && <PhotoCamera sx={{ color: ACCENT, fontSize: size * 0.3 }} />}
          {value && !busy && (
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.35)', opacity: 0, '&:hover': { opacity: 1 }, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity .2s' }}><PhotoCamera sx={{ color: '#fff', fontSize: 22 }} /></Box>
          )}
        </Box>
      ) : (
        <Box {...common} sx={{
          width: '100%', height: 130, borderRadius: '12px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
          border: `2px dashed ${over ? ACCENT : BORDER}`,
          backgroundImage: value ? `url(${value})` : 'linear-gradient(135deg,#3a2418,#71361a)', backgroundSize: 'cover', backgroundPosition: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s',
        }}>
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.55))' }} />
          <Box sx={{ position: 'relative', textAlign: 'center', color: '#fff' }}>
            {busy ? <CircularProgress size={22} sx={{ color: ACCENT }} /> : (
              <>
                <PhotoCamera sx={{ fontSize: 22, opacity: 0.9 }} />
                <Typography sx={{ fontSize: '0.72rem', opacity: 0.9 }}>{value ? 'Bytt cover' : 'Slipp / velg cover-bilde'}</Typography>
              </>
            )}
          </Box>
        </Box>
      )}
      {label && <Typography sx={{ fontSize: '0.7rem', color: MUTED, mt: 0.75, textAlign: isCircle ? 'center' : 'left' }}>{label}</Typography>}
    </Box>
  );
}

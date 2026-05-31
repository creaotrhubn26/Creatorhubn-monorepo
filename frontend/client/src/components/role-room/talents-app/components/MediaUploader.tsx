/**
 * MediaUploader.tsx — drag-and-drop / klikk-for-å-velge med direct R2-streaming.
 *
 * Bytter URL-input mot ekte file-picker. Streamer direkte til Cloudflare R2 via
 * presigned PUT-URL (backend ser aldri bytes — ren stream-tilkobling).
 *
 * Faller tilbake til URL-input hvis backend rapporterer at upload ikke er
 * konfigurert (R2-env-vars mangler).
 */

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/LinkOutlined';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import roleRoomTalentsService, {
  type UploadConfig,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';

type UploadKind = 'headshot' | 'showreel' | 'resume' | 'alt_photo';

interface MediaUploaderProps {
  kind: UploadKind;
  label: string;
  helperText?: string;
  value: string | null | '';
  onChange: (url: string | null) => void;
  /** Brukerinnstilling: tving URL-input istedenfor file picker (fallback). */
  forceUrlInput?: boolean;
}

const KIND_ICON: Record<UploadKind, string> = {
  headshot: '📷',
  alt_photo: '🖼️',
  showreel: '🎬',
  resume: '📄',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Husk config-respons mellom mounts for å unngå roundtrip
let cachedConfig: UploadConfig | null = null;

export default function MediaUploader({
  kind,
  label,
  helperText,
  value,
  onChange,
  forceUrlInput = false,
}: MediaUploaderProps) {
  const [config, setConfig] = useState<UploadConfig | null>(cachedConfig);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState(value || '');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (cachedConfig) return;
    roleRoomTalentsService.fetchUploadConfig().then((cfg) => {
      cachedConfig = cfg;
      setConfig(cfg);
    });
  }, []);

  useEffect(() => {
    setUrlValue(value || '');
  }, [value]);

  const allowedTypes = config?.allowedTypes?.[kind] ?? [];
  const maxBytes = config?.maxBytes?.[kind] ?? 0;
  const acceptAttr = allowedTypes.join(',');
  const directUploadAvailable = (config?.enabled ?? false) && !forceUrlInput;

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      setError(`Filtype ${file.type || 'ukjent'} er ikke støttet. Tillatt: ${allowedTypes.join(', ')}`);
      return;
    }
    if (maxBytes > 0 && file.size > maxBytes) {
      setError(`Filen er for stor (${formatBytes(file.size)}). Maks ${formatBytes(maxBytes)}.`);
      return;
    }

    setUploading(true);
    setProgress(0);

    // Showreel går via Cloudflare Stream hvis aktivert (auto-transcoding + adaptive bitrate).
    // Andre kinds (headshot/CV/alt_photo) går via R2 direct upload.
    if (kind === 'showreel' && config?.streamEnabled) {
      const result = await roleRoomTalentsService.uploadShowreelToStream(file, (pct) => setProgress(pct));
      setUploading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChange(result.result.finalUrl);
      return;
    }

    const result = await roleRoomTalentsService.uploadFileToR2(file, kind, (pct) => setProgress(pct));
    setUploading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange(result.url);
  }, [allowedTypes, kind, maxBytes, onChange, config?.streamEnabled]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = () => setDragActive(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = () => {
    onChange(null);
    setUrlValue('');
  };

  const previewable = useMemo(() => {
    if (!value) return null;
    if (kind === 'headshot' || kind === 'alt_photo') return 'image';
    if (kind === 'showreel') return 'video';
    if (kind === 'resume') return 'document';
    return null;
  }, [value, kind]);

  // Detect Cloudflare Stream-URL (videodelivery.net eller cloudflarestream.com)
  const isStreamUrl = value && (value.includes('cloudflarestream.com') || value.includes('videodelivery.net'));

  // ── Render: eksisterende fil med preview + bytt/slett ─────────────
  if (value && !uploading) {
    // Showreel via Cloudflare Stream: vis ekte iframe-player
    if (kind === 'showreel' && isStreamUrl) {
      return (
        <Box sx={{ borderRadius: radius.md, border: `1px solid ${palette.border}`, bgcolor: palette.bgCardElevated, overflow: 'hidden' }}>
          <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', bgcolor: '#000' }}>
            <Box
              component="iframe"
              src={value}
              title={label}
              sx={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
          </Box>
          <Stack direction="row" spacing={1.4} alignItems="center" sx={{ p: 1.4 }}>
            <CheckCircleIcon sx={{ color: palette.success, fontSize: 18 }} />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.9rem', flexGrow: 1 }}>
              {label} via Cloudflare Stream — adaptive bitrate
            </Typography>
            <Button size="small" startIcon={<CloudUploadIcon />} onClick={() => inputRef.current?.click()} sx={{ textTransform: 'none', color: palette.textSecondary, fontSize: '0.78rem' }}>
              Bytt
            </Button>
            <IconButton size="small" onClick={handleRemove} sx={{ color: palette.danger }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
          <input ref={inputRef} type="file" accept={acceptAttr} hidden onChange={handleInputChange} />
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2, borderRadius: radius.md, border: `1px solid ${palette.border}`, bgcolor: palette.bgCardElevated }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {previewable === 'image' ? (
            <Box
              component="img"
              src={value}
              alt={label}
              sx={{ width: 72, height: 72, borderRadius: radius.sm, objectFit: 'cover', border: `1px solid ${palette.borderSubtle}` }}
            />
          ) : (
            <Box sx={{ width: 72, height: 72, borderRadius: radius.sm, bgcolor: 'rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>
              {KIND_ICON[kind]}
            </Box>
          )}
          <Stack spacing={0.4} sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckCircleIcon sx={{ color: palette.success, fontSize: 18 }} />
              <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.92rem' }}>{label} lastet opp</Typography>
            </Stack>
            <Typography
              component="a"
              href={value}
              target="_blank"
              rel="noreferrer"
              sx={{ color: palette.accentBright, fontSize: '0.78rem', textDecoration: 'none', wordBreak: 'break-all', '&:hover': { textDecoration: 'underline' } }}
            >
              {value.split('/').pop()?.split('?')[0] || value.slice(0, 60)}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.6}>
            <Button
              size="small"
              startIcon={<CloudUploadIcon />}
              onClick={() => inputRef.current?.click()}
              sx={{ textTransform: 'none', color: palette.textSecondary, fontSize: '0.78rem' }}
            >
              Bytt
            </Button>
            <IconButton size="small" onClick={handleRemove} sx={{ color: palette.danger }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        <input ref={inputRef} type="file" accept={acceptAttr} hidden onChange={handleInputChange} />
      </Box>
    );
  }

  // ── Render: opplastning pågår ─────────────────────────────────────
  if (uploading) {
    return (
      <Box sx={{ p: 2.4, borderRadius: radius.md, border: `1px solid ${palette.borderStrong}`, bgcolor: 'rgba(168,85,247,0.08)' }}>
        <Stack spacing={1.4}>
          <Stack direction="row" spacing={1.4} alignItems="center">
            <CircularProgress size={20} sx={{ color: palette.accentBright }} />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.92rem' }}>
              Laster opp {label.toLowerCase()}…
            </Typography>
            <Typography sx={{ color: palette.accentBright, fontWeight: 700, fontSize: '0.92rem', ml: 'auto' }}>
              {progress}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(168,85,247,0.12)',
              '& .MuiLinearProgress-bar': { background: palette.accentGradient },
            }}
          />
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
            {kind === 'showreel' && config?.streamEnabled
              ? 'Streamer direkte til Cloudflare Stream. Videoen blir auto-transkodet for adaptive bitrate når den er ferdig.'
              : 'Streamer direkte til Cloudflare R2. Ikke lukk siden før opplastningen er ferdig.'}
          </Typography>
        </Stack>
      </Box>
    );
  }

  // ── Render: dropzone eller URL-input ──────────────────────────────
  if (showUrlInput || !directUploadAvailable) {
    return (
      <Box>
        <TextField
          label={label}
          value={urlValue}
          onChange={(e) => {
            setUrlValue(e.target.value);
            onChange(e.target.value || null);
          }}
          fullWidth
          size="small"
          placeholder="https://…"
          helperText={
            !directUploadAvailable
              ? 'Direkte opplasting er ikke konfigurert. Lim inn en lenke.'
              : helperText || 'Lim inn en lenke til filen din.'
          }
        />
        {directUploadAvailable ? (
          <Button
            size="small"
            startIcon={<CloudUploadIcon />}
            onClick={() => setShowUrlInput(false)}
            sx={{ mt: 0.6, textTransform: 'none', color: palette.accentBright, fontSize: '0.78rem' }}
          >
            Last opp fil i stedet
          </Button>
        ) : null}
      </Box>
    );
  }

  return (
    <Box>
      <Box
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          p: 3,
          borderRadius: radius.md,
          border: `2px dashed ${dragActive ? palette.accent : palette.borderStrong}`,
          bgcolor: dragActive ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.04)',
          cursor: 'pointer',
          transition: 'all 0.12s',
          textAlign: 'center',
          '&:hover': { borderColor: palette.accent, bgcolor: 'rgba(168,85,247,0.08)' },
        }}
      >
        <CloudUploadIcon sx={{ color: palette.accentBright, fontSize: 36, mb: 1 }} />
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.95rem' }}>
          {label}
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mt: 0.4 }}>
          Dra og slipp en fil her, eller klikk for å velge
        </Typography>
        {allowedTypes.length > 0 ? (
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', mt: 0.6 }}>
            {allowedTypes.map((t) => t.split('/').pop()).join(' · ')} · maks {formatBytes(maxBytes)}
          </Typography>
        ) : null}
        {kind === 'showreel' && config?.streamEnabled ? (
          <Typography sx={{ color: palette.accentBright, fontSize: '0.72rem', mt: 0.6, fontWeight: 600 }}>
            ⚡ Videoen blir transkodet for HLS/DASH og spilles av i optimal kvalitet på alle enheter
          </Typography>
        ) : null}
      </Box>
      <input ref={inputRef} type="file" accept={acceptAttr} hidden onChange={handleInputChange} />
      {error ? <Alert severity="error" sx={{ mt: 1.2 }}>{error}</Alert> : null}
      <Button
        size="small"
        startIcon={<LinkIcon />}
        onClick={() => setShowUrlInput(true)}
        sx={{ mt: 0.6, textTransform: 'none', color: palette.textMuted, fontSize: '0.78rem' }}
      >
        Eller lim inn en lenke i stedet
      </Button>
    </Box>
  );
}

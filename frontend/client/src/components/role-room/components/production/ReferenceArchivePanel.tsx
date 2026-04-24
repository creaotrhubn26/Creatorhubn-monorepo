import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CloudUpload as UploadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  analyzeFramePreview,
  createReferenceFrame,
  fileToBase64,
  searchReferenceFrames,
  type ReferenceFrame,
  type ReferenceFrameClaudeTags,
  type ReferenceFrameShotType,
} from '../../services/referenceArchiveService';

const SHOT_TYPE_OPTIONS: ReadonlyArray<{ value: ReferenceFrameShotType | ''; label: string }> = [
  { value: '', label: 'Alle shot-typer' },
  { value: 'wide', label: 'Wide' },
  { value: 'medium', label: 'Medium' },
  { value: 'close-up', label: 'Close-up' },
  { value: 'extreme-close-up', label: 'ECU' },
  { value: 'over-the-shoulder', label: 'OTS' },
  { value: 'two-shot', label: 'Two-shot' },
  { value: 'insert', label: 'Insert' },
  { value: 'aerial', label: 'Aerial' },
];

const TIME_OF_DAY_OPTIONS = ['', 'day', 'night', 'dusk', 'dawn', 'interior'] as const;

interface Props {
  projectId?: string;
  onPickFrame: (url: string) => void;
}

const INITIAL_UPLOAD_STATE = {
  file: null as File | null,
  previewUrl: null as string | null,
  mime: '' as string,
  imageBase64: '' as string,
  filmTitle: '',
  cinematographer: '',
  year: '',
  notes: '',
  userTagsRaw: '',
  analyzedTags: null as ReferenceFrameClaudeTags | null,
  analyzing: false,
  analyzeError: null as string | null,
  saving: false,
  saveError: null as string | null,
};

type UploadState = typeof INITIAL_UPLOAD_STATE;

export const ReferenceArchivePanel: React.FC<Props> = ({ projectId, onPickFrame }) => {
  const [query, setQuery] = useState('');
  const [shotType, setShotType] = useState<ReferenceFrameShotType | ''>('');
  const [timeOfDay, setTimeOfDay] = useState<'' | (typeof TIME_OF_DAY_OPTIONS)[number]>('');
  const [results, setResults] = useState<ReferenceFrame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upload, setUpload] = useState<UploadState>(INITIAL_UPLOAD_STATE);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await searchReferenceFrames({
        q: query || undefined,
        shotType: shotType || undefined,
        timeOfDay: timeOfDay || undefined,
      });
      setResults(rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, shotType, timeOfDay]);

  // Initial load + re-search when facets change
  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const resetUpload = useCallback(() => {
    if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
    setUpload(INITIAL_UPLOAD_STATE);
  }, [upload.previewUrl]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
      const previewUrl = URL.createObjectURL(file);
      setUpload((s) => ({
        ...s,
        file,
        previewUrl,
        mime: file.type || 'image/jpeg',
        imageBase64: '',
        analyzing: true,
        analyzeError: null,
        analyzedTags: null,
      }));
      try {
        const base64 = await fileToBase64(file);
        const tags = await analyzeFramePreview({
          imageBase64: base64,
          mime: (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic',
          hintFilmTitle: upload.filmTitle || undefined,
          hintCinematographer: upload.cinematographer || undefined,
        });
        // Keep the base64 on state so the save step doesn't re-read the file
        setUpload((s) => ({ ...s, analyzing: false, analyzedTags: tags, imageBase64: base64 }));
      } catch (err) {
        setUpload((s) => ({ ...s, analyzing: false, analyzeError: (err as Error).message }));
      }
    },
    [upload.previewUrl, upload.filmTitle, upload.cinematographer],
  );

  const handleSave = useCallback(async () => {
    if (!upload.analyzedTags || !upload.imageBase64) return;
    setUpload((s) => ({ ...s, saving: true, saveError: null }));
    try {
      await createReferenceFrame({
        imageBase64: upload.imageBase64,
        mime: upload.mime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic',
        filmTitle: upload.filmTitle || null,
        cinematographer: upload.cinematographer || null,
        year: upload.year ? Number(upload.year) || null : null,
        notes: upload.notes || null,
        claudeTags: upload.analyzedTags,
        userTags: upload.userTagsRaw
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        usedOnProjectIds: projectId ? [projectId] : [],
      });
      setUploadOpen(false);
      resetUpload();
      void runSearch();
    } catch (err) {
      setUpload((s) => ({ ...s, saving: false, saveError: (err as Error).message }));
    }
  }, [upload, projectId, resetUpload, runSearch]);

  return (
    <Box data-testid="pmv-reference-archive-panel">
      {/* Toolbar: search + facets + upload */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <TextField
          placeholder="Søk i arkivet (keyword, film, notater)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(); }}
          size="small"
          fullWidth
          inputProps={{ 'data-testid': 'pmv-archive-search-input' }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: '#252d3d',
              '& fieldset': { borderColor: '#374151' },
              '&:hover fieldset': { borderColor: '#4b5563' },
            },
            '& .MuiInputBase-input': { color: '#fff', fontSize: 13 },
          }}
        />
        <Select
          size="small"
          value={shotType}
          onChange={(e) => setShotType(e.target.value as ReferenceFrameShotType | '')}
          displayEmpty
          inputProps={{ 'data-testid': 'pmv-archive-shot-type' }}
          sx={{ minWidth: 140, bgcolor: '#252d3d', color: '#e5e7eb', fontSize: 12 }}
        >
          {SHOT_TYPE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value || 'any'} value={opt.value} sx={{ fontSize: 12 }}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value as '' | (typeof TIME_OF_DAY_OPTIONS)[number])}
          displayEmpty
          sx={{ minWidth: 120, bgcolor: '#252d3d', color: '#e5e7eb', fontSize: 12 }}
        >
          {TIME_OF_DAY_OPTIONS.map((t) => (
            <MenuItem key={t || 'any'} value={t} sx={{ fontSize: 12 }}>
              {t ? t : 'Tid på dagen'}
            </MenuItem>
          ))}
        </Select>
        <Button
          size="small"
          variant="contained"
          startIcon={<UploadIcon sx={{ fontSize: 16 }} />}
          onClick={() => setUploadOpen(true)}
          data-testid="pmv-archive-open-upload"
          sx={{ whiteSpace: 'nowrap', textTransform: 'none' }}
        >
          Last opp
        </Button>
      </Stack>

      {loading && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 3 }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>Henter frames…</Typography>
        </Stack>
      )}
      {error && (
        <Typography sx={{ fontSize: 12, color: '#f87171', py: 2 }}>Feil: {error}</Typography>
      )}
      {!loading && !error && results.length === 0 && (
        <Typography
          data-testid="pmv-archive-empty"
          sx={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', py: 4 }}
        >
          {query || shotType || timeOfDay
            ? 'Ingen frames i arkivet matcher søket.'
            : 'Arkivet er tomt. Last opp din første referanseframe.'}
        </Typography>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 1,
          maxHeight: 440,
          overflowY: 'auto',
        }}
      >
        {results.map((frame) => (
          <Box
            key={frame.id}
            data-testid={`pmv-archive-frame-${frame.id}`}
            onClick={() => onPickFrame(frame.sourceUrl)}
            sx={{
              position: 'relative',
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: '#0f1318',
              border: '1px solid #252d3d',
              cursor: 'pointer',
              '&:hover': { borderColor: '#8b5cf6' },
              '&:hover .archive-overlay': { opacity: 1 },
            }}
          >
            <Box
              sx={{
                aspectRatio: '16/9',
                backgroundImage: `url(${frame.thumbnailUrl || frame.sourceUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <Box
              className="archive-overlay"
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(2,6,23,0.85)',
                opacity: 0,
                transition: 'opacity 0.15s',
                p: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap: 0.5,
              }}
            >
              {frame.filmTitle && (
                <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                  {frame.filmTitle}
                  {frame.year ? ` (${frame.year})` : ''}
                </Typography>
              )}
              {frame.cinematographer && (
                <Typography sx={{ fontSize: 10, color: '#cbd5e1' }}>
                  DP: {frame.cinematographer}
                </Typography>
              )}
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {frame.claudeTags.shotType !== 'unknown' && (
                  <Chip
                    size="small"
                    label={frame.claudeTags.shotType}
                    sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(139,92,246,0.3)', color: '#e5e7eb' }}
                  />
                )}
                {frame.claudeTags.lightingMood && (
                  <Chip
                    size="small"
                    label={frame.claudeTags.lightingMood}
                    sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(59,130,246,0.3)', color: '#e5e7eb' }}
                  />
                )}
              </Stack>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Upload dialog */}
      <Dialog
        open={uploadOpen}
        onClose={() => { if (!upload.saving) { setUploadOpen(false); resetUpload(); } }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e2536', color: '#e5e7eb' } }}
        data-testid="pmv-archive-upload-dialog"
      >
        <DialogTitle sx={{ borderBottom: '1px solid #2a3142', pb: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
              Last opp referanseframe
            </Typography>
            <IconButton
              size="small"
              aria-label="Lukk"
              onClick={() => { if (!upload.saving) { setUploadOpen(false); resetUpload(); } }}
              sx={{ color: '#9ca3af' }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#2a3142' }}>
          <Stack spacing={2}>
            {/* File picker */}
            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: '1px dashed #4b5563',
                borderRadius: 1,
                p: 2,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: '#252d3d',
                '&:hover': { borderColor: '#8b5cf6' },
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                style={{ display: 'none' }}
                data-testid="pmv-archive-upload-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelect(file);
                }}
              />
              {upload.previewUrl ? (
                <Box
                  sx={{
                    backgroundImage: `url(${upload.previewUrl})`,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    height: 200,
                  }}
                />
              ) : (
                <Stack spacing={1} alignItems="center">
                  <UploadIcon sx={{ fontSize: 32, color: '#8b5cf6' }} />
                  <Typography sx={{ fontSize: 13, color: '#e5e7eb' }}>
                    Klikk for å velge fil (JPEG/PNG/WebP/HEIC)
                  </Typography>
                </Stack>
              )}
            </Box>

            {upload.analyzing && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={14} />
                <Typography sx={{ fontSize: 12, color: '#a78bfa' }}>
                  Claude Vision tagger bildet…
                </Typography>
              </Stack>
            )}
            {upload.analyzeError && (
              <Typography sx={{ fontSize: 12, color: '#f87171' }}>
                Tagging feilet: {upload.analyzeError}
              </Typography>
            )}

            {/* AI-tags preview */}
            {upload.analyzedTags && (
              <Box
                data-testid="pmv-archive-upload-tags-preview"
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.3)',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 14, color: '#a78bfa' }} />
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>
                    AUTO-TAGS
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                  {upload.analyzedTags.shotType !== 'unknown' && (
                    <Chip size="small" label={`Shot: ${upload.analyzedTags.shotType}`} sx={{ height: 18, fontSize: 10 }} />
                  )}
                  {upload.analyzedTags.cameraAngle && (
                    <Chip size="small" label={`Vinkel: ${upload.analyzedTags.cameraAngle}`} sx={{ height: 18, fontSize: 10 }} />
                  )}
                  {upload.analyzedTags.lightingMood && (
                    <Chip size="small" label={`Lys: ${upload.analyzedTags.lightingMood}`} sx={{ height: 18, fontSize: 10 }} />
                  )}
                  {upload.analyzedTags.timeOfDay && (
                    <Chip size="small" label={`Tid: ${upload.analyzedTags.timeOfDay}`} sx={{ height: 18, fontSize: 10 }} />
                  )}
                  {upload.analyzedTags.suggestedCinematographerStyle && (
                    <Chip
                      size="small"
                      label={`Stil: ${upload.analyzedTags.suggestedCinematographerStyle}`}
                      sx={{ height: 18, fontSize: 10 }}
                    />
                  )}
                </Stack>
                {upload.analyzedTags.colorPalette.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mb: 0.75 }}>
                    {upload.analyzedTags.colorPalette.map((c) => (
                      <Box
                        key={c}
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          bgcolor: c,
                          border: '1px solid #374151',
                        }}
                        title={c}
                      />
                    ))}
                  </Stack>
                )}
                {upload.analyzedTags.keywords.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {upload.analyzedTags.keywords.map((k) => (
                      <Chip
                        key={k}
                        size="small"
                        label={k}
                        sx={{ height: 16, fontSize: 9, bgcolor: '#252d3d', color: '#9ca3af' }}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            )}

            {/* Manual metadata */}
            <Stack direction="row" spacing={1}>
              <TextField
                label="Film"
                size="small"
                fullWidth
                value={upload.filmTitle}
                onChange={(e) => setUpload((s) => ({ ...s, filmTitle: e.target.value }))}
                InputLabelProps={{ sx: { color: '#9ca3af' } }}
                sx={{ '& .MuiInputBase-input': { color: '#e5e7eb' } }}
              />
              <TextField
                label="Cinematographer"
                size="small"
                fullWidth
                value={upload.cinematographer}
                onChange={(e) => setUpload((s) => ({ ...s, cinematographer: e.target.value }))}
                InputLabelProps={{ sx: { color: '#9ca3af' } }}
                sx={{ '& .MuiInputBase-input': { color: '#e5e7eb' } }}
              />
              <TextField
                label="År"
                size="small"
                type="number"
                value={upload.year}
                onChange={(e) => setUpload((s) => ({ ...s, year: e.target.value }))}
                InputLabelProps={{ sx: { color: '#9ca3af' } }}
                sx={{ width: 110, '& .MuiInputBase-input': { color: '#e5e7eb' } }}
              />
            </Stack>
            <TextField
              label="Egne tags (komma-separert)"
              size="small"
              fullWidth
              value={upload.userTagsRaw}
              onChange={(e) => setUpload((s) => ({ ...s, userTagsRaw: e.target.value }))}
              InputLabelProps={{ sx: { color: '#9ca3af' } }}
              sx={{ '& .MuiInputBase-input': { color: '#e5e7eb' } }}
              placeholder="f.eks. interior, warm-highlights, practicals"
            />
            <TextField
              label="Notater"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={upload.notes}
              onChange={(e) => setUpload((s) => ({ ...s, notes: e.target.value }))}
              InputLabelProps={{ sx: { color: '#9ca3af' } }}
              sx={{ '& .MuiInputBase-input': { color: '#e5e7eb' } }}
            />
            {upload.saveError && (
              <Typography sx={{ fontSize: 12, color: '#f87171' }}>{upload.saveError}</Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #2a3142' }}>
          <Button
            onClick={() => { setUploadOpen(false); resetUpload(); }}
            disabled={upload.saving}
            sx={{ color: '#9ca3af' }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={upload.saving || !upload.analyzedTags || !upload.imageBase64}
            data-testid="pmv-archive-upload-save"
            startIcon={upload.saving ? <CircularProgress size={14} /> : null}
          >
            {upload.saving ? 'Laster opp…' : 'Lagre i arkivet'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReferenceArchivePanel;

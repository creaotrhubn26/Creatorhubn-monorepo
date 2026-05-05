/**
 * AutoDistractionDetector — Claude-Vision-driven object-removal flow.
 * Photographer doesn't paint anything: we send the image to
 * /api/photo-enhancer/detect-distractions, Claude returns a list of
 * stray studio equipment with bbox-es, the photographer ticks which
 * ones to actually remove, and we send a combined mask through the
 * existing /inpaint endpoint.
 *
 * Design notes:
 *   - Detection thumbnails are cropped with a 16px margin so the
 *     photographer can see WHERE the bbox sits in the photo, not just
 *     the object in isolation.
 *   - Default-selected: detections with confidence >= 0.85. Lower-
 *     confidence ones are listed but unchecked — the photographer can
 *     opt them in if Claude was right but cautious.
 *   - The combined mask is built client-side as a single binary PNG.
 *     The executor handles arbitrarily-shaped masks, so multi-bbox
 *     selections become one /inpaint call, not N round-trips.
 *   - skipPlanner=1 on the inpaint call: we already know what to fill
 *     and from where (synthesised donor candidates around each bbox
 *     work fine for studio backdrops), and skipping the Claude planner
 *     keeps the round-trip under 2s.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CompareIcon from '@mui/icons-material/Compare';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { InpaintRecipe } from '../../lib/enhancer-session/module-contract';

type DistractionType =
  | 'flash_strobe'
  | 'light_stand'
  | 'cable'
  | 'boom_arm'
  | 'tape_clip'
  | 'sensor_dust'
  | 'other_distraction';

interface DetectionBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Detection {
  id: string;
  type: DistractionType;
  bbox: DetectionBbox;
  confidence: number;
  description: string;
}

interface DetectResponse {
  success: boolean;
  detections?: Detection[];
  rationale?: string;
  error?: string;
  detail?: string;
}

interface InpaintResponse {
  success: boolean;
  imageBase64?: string;
  imageMime?: string;
  recipe?: InpaintRecipe;
  executorWarnings?: string[];
  error?: string;
  detail?: string;
}

const DEFAULT_SELECT_CONFIDENCE = 0.85;
const THUMB_PADDING = 16;
const THUMB_DISPLAY_HEIGHT = 96;

const TYPE_LABELS: Record<DistractionType, string> = {
  flash_strobe: 'Blits / modifier',
  light_stand: 'Lys-stativ',
  cable: 'Kabel',
  boom_arm: 'Boom-arm',
  tape_clip: 'Tape / klips',
  sensor_dust: 'Sensor-støv',
  other_distraction: 'Annet',
};

export interface AutoDistractionDetectorProps {
  imageUrl: string;
  onApply: (newImageDataUrl: string, recipe: InpaintRecipe | null, warnings: string[]) => void;
  onClose: () => void;
}

export const AutoDistractionDetector: React.FC<AutoDistractionDetectorProps> = ({
  imageUrl,
  onApply,
  onClose,
}) => {
  const [imgNative, setImgNative] = useState<{ w: number; h: number } | null>(null);
  const [imgBitmap, setImgBitmap] = useState<HTMLImageElement | null>(null);

  const [busyDetect, setBusyDetect] = useState(true);
  const [busyInpaint, setBusyInpaint] = useState(false);
  const [detections, setDetections] = useState<Detection[] | null>(null);
  const [rationale, setRationale] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<{
    imageDataUrl: string;
    recipe: InpaintRecipe | null;
    warnings: string[];
  } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const resultPreviewRef = useRef<HTMLImageElement>(null);
  const originalPreviewRef = useRef<HTMLImageElement>(null);

  // Load source image at native resolution; cached so thumbnail crops
  // don't re-fetch.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImgNative({ w: img.naturalWidth, h: img.naturalHeight });
      setImgBitmap(img);
    };
    img.onerror = () => setError('Kunne ikke laste bildet.');
    img.src = imageUrl;
  }, [imageUrl]);

  // Run detection once the source is loaded.
  const runDetection = useCallback(async () => {
    if (!imgNative) return;
    setBusyDetect(true);
    setError(null);
    setDetections(null);
    setSelectedIds(new Set());
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const fd = new FormData();
      fd.append('image', blob, 'image.jpg');
      const apiRes = await fetch('/api/photo-enhancer/detect-distractions', {
        method: 'POST',
        body: fd,
      });
      const json = (await apiRes.json()) as DetectResponse;
      if (!apiRes.ok || !json.success || !json.detections) {
        throw new Error(
          json.error
            ? `${json.error}${json.detail ? `: ${json.detail}` : ''}`
            : `detect feilet (HTTP ${apiRes.status})`,
        );
      }
      setDetections(json.detections);
      setRationale(json.rationale || '');
      // Auto-select high-confidence ones; let the photographer opt in to
      // the rest. Empty set if Claude found nothing — the UI handles it.
      const auto = new Set<string>();
      for (const d of json.detections) {
        if (d.confidence >= DEFAULT_SELECT_CONFIDENCE) auto.add(d.id);
      }
      setSelectedIds(auto);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyDetect(false);
    }
  }, [imageUrl, imgNative]);

  useEffect(() => {
    if (imgNative && !detections && !busyInpaint) {
      void runDetection();
    }
  }, [imgNative, detections, busyInpaint, runDetection]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Build a binary mask PNG covering every selected bbox. The
   *  executor's analyseMask handles arbitrary-shape masks, so the
   *  multi-region case becomes one /inpaint call. */
  const buildCombinedMask = useCallback(async (): Promise<Blob | null> => {
    if (!imgNative || !detections) return null;
    const canvas = document.createElement('canvas');
    canvas.width = imgNative.w;
    canvas.height = imgNative.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    for (const d of detections) {
      if (!selectedIds.has(d.id)) continue;
      ctx.fillRect(d.bbox.x, d.bbox.y, d.bbox.w, d.bbox.h);
    }
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
  }, [imgNative, detections, selectedIds]);

  const exportImageBlob = useCallback(async (): Promise<Blob | null> => {
    if (!imgBitmap || !imgNative) return null;
    const canvas = document.createElement('canvas');
    canvas.width = imgNative.w;
    canvas.height = imgNative.h;
    canvas.getContext('2d')?.drawImage(imgBitmap, 0, 0);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95),
    );
  }, [imgBitmap, imgNative]);

  const runInpaint = useCallback(async () => {
    setError(null);
    setBusyInpaint(true);
    try {
      const [imageBlob, maskBlob] = await Promise.all([exportImageBlob(), buildCombinedMask()]);
      if (!imageBlob || !maskBlob) throw new Error('Kunne ikke eksportere bilde + maske.');
      const fd = new FormData();
      fd.append('image', imageBlob, 'image.jpg');
      fd.append('mask', maskBlob, 'mask.png');
      fd.append('intensity', '1');
      // skipPlanner=1: detections are already what we want to remove,
      // and synthesised donors around each bbox handle the studio
      // backdrop case fine. Skipping Claude here keeps the round-trip
      // fast (one /detect + one /inpaint = ~3-5s total).
      fd.append('skipPlanner', '1');
      const res = await fetch('/api/photo-enhancer/inpaint', { method: 'POST', body: fd });
      const json = (await res.json()) as InpaintResponse;
      if (!res.ok || !json.success || !json.imageBase64) {
        throw new Error(
          json.error
            ? `${json.error}${json.detail ? `: ${json.detail}` : ''}`
            : `inpaint feilet (HTTP ${res.status})`,
        );
      }
      const dataUrl = `data:${json.imageMime || 'image/jpeg'};base64,${json.imageBase64}`;
      setResult({
        imageDataUrl: dataUrl,
        recipe: json.recipe || null,
        warnings: json.executorWarnings || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyInpaint(false);
    }
  }, [buildCombinedMask, exportImageBlob]);

  const apply = useCallback(() => {
    if (!result) return;
    onApply(result.imageDataUrl, result.recipe, result.warnings);
  }, [onApply, result]);

  /** Crop a thumbnail showing the bbox area with margin so the
   *  photographer can confirm WHAT Claude detected, not just see a
   *  pixel-tight strip. Returns a data URL or null if the canvas
   *  isn't ready yet. */
  const thumbForDetection = useCallback(
    (det: Detection): string | null => {
      if (!imgBitmap || !imgNative) return null;
      const sx = Math.max(0, det.bbox.x - THUMB_PADDING);
      const sy = Math.max(0, det.bbox.y - THUMB_PADDING);
      const sw = Math.min(imgNative.w - sx, det.bbox.w + THUMB_PADDING * 2);
      const sh = Math.min(imgNative.h - sy, det.bbox.h + THUMB_PADDING * 2);
      const aspect = sw / sh;
      const dh = THUMB_DISPLAY_HEIGHT;
      const dw = Math.max(40, Math.round(dh * aspect));
      const canvas = document.createElement('canvas');
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(imgBitmap, sx, sy, sw, sh, 0, 0, dw, dh);
      // Outline the actual bbox inside the thumb so it's clear which
      // part is the suggested removal vs surrounding context.
      const outlineX = ((det.bbox.x - sx) / sw) * dw;
      const outlineY = ((det.bbox.y - sy) / sh) * dh;
      const outlineW = (det.bbox.w / sw) * dw;
      const outlineH = (det.bbox.h / sh) * dh;
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(outlineX, outlineY, outlineW, outlineH);
      return canvas.toDataURL('image/jpeg', 0.85);
    },
    [imgBitmap, imgNative],
  );

  const thumbsByDetectionId = useMemo(() => {
    if (!detections) return {};
    const out: Record<string, string | null> = {};
    for (const d of detections) out[d.id] = thumbForDetection(d);
    return out;
  }, [detections, thumbForDetection]);

  const selectedCount = selectedIds.size;
  const detectionCount = detections?.length ?? 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, minWidth: 480 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Auto-finn objekter
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="Lukk">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Claude leser bildet og foreslår studio-utstyr som kan fjernes (blits, kabel, stativ, modifier).
        Du krysser av hva som skal fjernes — vi legger ikke noe til.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {busyDetect && (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 4, justifyContent: 'center' }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Claude analyserer bildet…</Typography>
        </Stack>
      )}

      {!busyDetect && detections && !result && (
        <>
          {rationale && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {rationale}
            </Typography>
          )}

          {detectionCount === 0 && (
            <Alert severity="info">
              Ingen åpenbart studio-utstyr funnet i dette bildet. Bruk &quot;Fjern objekter&quot; (manuelt) hvis du vil markere noe selv.
            </Alert>
          )}

          {detectionCount > 0 && (
            <Stack spacing={1}>
              {detections.map((det) => {
                const thumb = thumbsByDetectionId[det.id];
                const checked = selectedIds.has(det.id);
                return (
                  <Box
                    key={det.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      p: 1,
                      border: '1px solid',
                      borderColor: checked ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      backgroundColor: checked ? 'action.selected' : 'background.paper',
                    }}
                    onClick={() => toggleSelected(det.id)}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleSelected(det.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {thumb ? (
                      <Box
                        component="img"
                        src={thumb}
                        alt=""
                        sx={{ height: THUMB_DISPLAY_HEIGHT, borderRadius: 0.5 }}
                      />
                    ) : (
                      <Box
                        sx={{
                          height: THUMB_DISPLAY_HEIGHT,
                          width: THUMB_DISPLAY_HEIGHT * 1.4,
                          backgroundColor: 'grey.300',
                        }}
                      />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Chip
                          size="small"
                          label={TYPE_LABELS[det.type]}
                          color={checked ? 'primary' : 'default'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(det.confidence * 100)}% sikker
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {det.description}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </>
      )}

      {result && (
        <Stack spacing={1}>
          <Box
            sx={{
              position: 'relative',
              alignSelf: 'center',
              maxWidth: '100%',
              maxHeight: 480,
              backgroundColor: 'grey.900',
            }}
          >
            <Box
              ref={originalPreviewRef}
              component="img"
              src={imageUrl}
              alt="Original"
              sx={{
                maxWidth: '100%',
                maxHeight: 480,
                display: showOriginal ? 'block' : 'none',
              }}
            />
            <Box
              ref={resultPreviewRef}
              component="img"
              src={result.imageDataUrl}
              alt="Inpainted"
              sx={{
                maxWidth: '100%',
                maxHeight: 480,
                display: showOriginal ? 'none' : 'block',
              }}
            />
          </Box>
          {result.warnings.map((w, i) => (
            <Alert key={`exec-${i}`} severity="info">
              {w}
            </Alert>
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {!result && !busyDetect && (
          <>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => void runDetection()}
              disabled={busyInpaint}
            >
              Kjør på nytt
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              onClick={() => void runInpaint()}
              disabled={busyInpaint || selectedCount === 0}
              startIcon={busyInpaint ? <CircularProgress size={14} /> : undefined}
            >
              {busyInpaint ? 'Fjerner…' : `Fjern ${selectedCount} valgte`}
            </Button>
          </>
        )}
        {result && (
          <>
            <Button
              startIcon={<CompareIcon />}
              onClick={() => setShowOriginal((v) => !v)}
              variant={showOriginal ? 'contained' : 'outlined'}
            >
              {showOriginal ? 'Viser original' : 'Vis original'}
            </Button>
            <Button onClick={() => setResult(null)}>Tilbake</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" color="primary" onClick={apply}>
              Bruk
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
};

export default AutoDistractionDetector;

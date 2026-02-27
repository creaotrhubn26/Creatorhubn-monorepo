/**
 * AuthoringPanel — Artist attribution, signature pad, and licensing.
 *
 * Integrates into the DrawingToolsPanel sidebar so every frame asset package
 * can carry first-class authoring metadata that survives the full
 * build → save → parse roundtrip.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  Stack,
  Tooltip,
  IconButton,
  type SelectChangeEvent,
} from '@mui/material';
import {
  Delete as ClearIcon,
  ContentCopy as CopyIcon,
  Draw as DrawIcon,
} from '@mui/icons-material';
import type { AuthoringMetadata, AuthoringLicense } from '../../state/storyboardStore';
import { DEFAULT_AUTHORING_METADATA } from '../../state/storyboardStore';

// ─── License display helpers ────────────────────────────────────────────────

const LICENSE_OPTIONS: Array<{ value: AuthoringLicense; label: string; description: string }> = [
  { value: 'all-rights-reserved', label: 'All Rights Reserved', description: 'Standard copyright – no reuse without permission' },
  { value: 'cc-by', label: 'CC BY 4.0', description: 'Credit the author, any reuse allowed' },
  { value: 'cc-by-sa', label: 'CC BY-SA 4.0', description: 'Credit + share-alike (same license)' },
  { value: 'cc-by-nc', label: 'CC BY-NC 4.0', description: 'Credit, non-commercial use only' },
  { value: 'cc-by-nc-sa', label: 'CC BY-NC-SA 4.0', description: 'Credit, non-commercial, share-alike' },
  { value: 'cc0', label: 'CC0 (Public Domain)', description: 'No restrictions – public domain dedication' },
  { value: 'custom', label: 'Custom', description: 'Specify your own license terms' },
];

// ─── Signature Pad ──────────────────────────────────────────────────────────

interface SignaturePadProps {
  width: number;
  height: number;
  dataUrl?: string;
  onChange: (dataUrl: string | undefined) => void;
}

const SIGNATURE_LINE_WIDTH = 2;
const SIGNATURE_STROKE_COLOR = '#e2e8f0';

const SignaturePad: React.FC<SignaturePadProps> = ({ width, height, dataUrl, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const hasStrokes = useRef(false);
  const [isEmpty, setIsEmpty] = useState(!dataUrl);

  // Restore existing signature when component mounts or dataUrl changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    if (dataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        hasStrokes.current = true;
        setIsEmpty(false);
      };
      img.src = dataUrl;
    } else {
      hasStrokes.current = false;
      setIsEmpty(true);
    }
  }, [dataUrl, width, height]);

  const getPoint = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    lastPoint.current = getPoint(e);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = SIGNATURE_STROKE_COLOR;
    ctx.lineWidth = SIGNATURE_LINE_WIDTH;
  }, [getPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !lastPoint.current) return;

    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    hasStrokes.current = true;
    setIsEmpty(false);
  }, [getPoint]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    e.stopPropagation();
    isDrawing.current = false;
    lastPoint.current = null;

    // Emit data URL
    const canvas = canvasRef.current;
    if (canvas && hasStrokes.current) {
      onChange(canvas.toDataURL('image/png'));
    }
  }, [onChange]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, width, height);
    hasStrokes.current = false;
    setIsEmpty(true);
    onChange(undefined);
  }, [width, height, onChange]);

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          border: '1px dashed rgba(255,255,255,0.2)',
          borderRadius: 1,
          overflow: 'hidden',
          backgroundColor: 'rgba(0,0,0,0.3)',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ display: 'block', width, height }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </Box>
      {isEmpty && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: 0.35 }}>
            <DrawIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption" sx={{ fontSize: 10 }}>
              Draw your signature
            </Typography>
          </Stack>
        </Box>
      )}
      {!isEmpty && (
        <Tooltip title="Clear signature">
          <IconButton
            size="small"
            onClick={handleClear}
            sx={{
              position: 'absolute',
              top: 2,
              right: 2,
              backgroundColor: 'rgba(0,0,0,0.5)',
              '&:hover': { backgroundColor: 'rgba(220,38,38,0.4)' },
            }}
          >
            <ClearIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

// ─── Main AuthoringPanel ────────────────────────────────────────────────────

export interface AuthoringPanelProps {
  metadata: AuthoringMetadata;
  onChange: (metadata: AuthoringMetadata) => void;
}

export const AuthoringPanel: React.FC<AuthoringPanelProps> = ({ metadata, onChange }) => {
  const update = useCallback(
    (patch: Partial<AuthoringMetadata>) => onChange({ ...metadata, ...patch }),
    [metadata, onChange],
  );

  const handleLicenseChange = useCallback(
    (e: SelectChangeEvent) => {
      const license = e.target.value as AuthoringLicense;
      update({ license, customLicense: license === 'custom' ? metadata.customLicense : undefined });
    },
    [update, metadata.customLicense],
  );

  const handleCopyAttribution = useCallback(() => {
    const parts: string[] = [];
    if (metadata.authorName) parts.push(`Artist: ${metadata.authorName}`);
    const licenseLabel = LICENSE_OPTIONS.find((o) => o.value === metadata.license)?.label ?? metadata.license;
    parts.push(`License: ${licenseLabel}`);
    if (metadata.customLicense) parts.push(metadata.customLicense);
    if (metadata.notes) parts.push(`Notes: ${metadata.notes}`);
    navigator.clipboard.writeText(parts.join('\n')).catch(() => {
      // clipboard unavailable — silent
    });
  }, [metadata]);

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack spacing={1.5}>
        {/* Author name */}
        <TextField
          label="Author / Artist"
          placeholder="Your name or handle"
          value={metadata.authorName}
          onChange={(e) => update({ authorName: e.target.value })}
          size="small"
          fullWidth
          variant="outlined"
          slotProps={{
            inputLabel: { shrink: true, sx: { fontSize: 12 } },
            input: { sx: { fontSize: 12 } },
          }}
        />

        {/* Signature pad */}
        <Box>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary', fontSize: 11 }}>
            Signature
          </Typography>
          <SignaturePad
            width={268}
            height={80}
            dataUrl={metadata.signatureDataUrl}
            onChange={(dataUrl) => update({ signatureDataUrl: dataUrl })}
          />
        </Box>

        {/* License selector */}
        <Box>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary', fontSize: 11 }}>
            License
          </Typography>
          <Select
            value={metadata.license}
            onChange={handleLicenseChange}
            size="small"
            fullWidth
            sx={{ fontSize: 12 }}
          >
            {LICENSE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 12 }}>
                <Stack>
                  <Typography variant="body2" sx={{ fontSize: 12 }}>{opt.label}</Typography>
                  <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>
                    {opt.description}
                  </Typography>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* Custom license text area (only when "custom" selected) */}
        {metadata.license === 'custom' && (
          <TextField
            label="Custom License Terms"
            multiline
            minRows={2}
            maxRows={4}
            value={metadata.customLicense ?? ''}
            onChange={(e) => update({ customLicense: e.target.value })}
            size="small"
            fullWidth
            variant="outlined"
            slotProps={{
              inputLabel: { shrink: true, sx: { fontSize: 12 } },
              input: { sx: { fontSize: 12 } },
            }}
          />
        )}

        {/* Notes */}
        <TextField
          label="Notes"
          placeholder="Additional attribution notes…"
          multiline
          minRows={1}
          maxRows={3}
          value={metadata.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value || undefined })}
          size="small"
          fullWidth
          variant="outlined"
          slotProps={{
            inputLabel: { shrink: true, sx: { fontSize: 12 } },
            input: { sx: { fontSize: 12 } },
          }}
        />

        {/* Copy attribution button */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<CopyIcon sx={{ fontSize: 14 }} />}
          onClick={handleCopyAttribution}
          sx={{ fontSize: 11, textTransform: 'none' }}
        >
          Copy Attribution Text
        </Button>
      </Stack>
    </Box>
  );
};

export default AuthoringPanel;
export { DEFAULT_AUTHORING_METADATA };

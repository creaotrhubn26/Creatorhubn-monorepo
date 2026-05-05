/**
 * PosterEditorCanvas — Fase 3 redigeringsoverflate.
 *
 * Viser server-rendret PNG som bakgrunn og legger react-moveable-styrte,
 * frittflytende layers (CustomLayer[]) på toppen. Layers kan dras, resizes,
 * roteres med:
 *   - Snap-to-grid (8px, toggleable)
 *   - Smart-guides (snap til andre layers' edges/centers, toggleable)
 *   - Bounds (kan ikke dras utenfor canvas)
 *   - Linjaler topp + venstre
 *   - Safe-zone + bleed overlay-rammer
 *
 * Fase 3b utvider med inline text-edit (contentEditable), undo/redo,
 * og lagring av drafts via posterComposerService.saveDraft().
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  TextFields as TextFieldsIcon,
  Image as ImageIcon,
  Crop as CropIcon,
  GridOn as GridOnIcon,
  Layers as LayersIcon,
  Straighten as StraightenIcon,
  Crop54 as Crop54Icon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterFocusStrongIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import Moveable from "react-moveable";
import {
  type CustomLayer,
  type FormatInfo,
  uploadPosterImage,
} from "../../../../services/posterComposerService";

interface Props {
  previewUrl: string | null;
  canvasW: number;
  canvasH: number;
  formatInfo: FormatInfo | undefined;
  layers: CustomLayer[];
  onLayersChange: (next: CustomLayer[]) => void;
}

const GRID_PX = 8;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function PosterEditorCanvas({
  previewUrl,
  canvasW,
  canvasH,
  formatInfo,
  layers,
  onLayersChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [guides, setGuides] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [showProps, setShowProps] = useState(true);
  const [zoom, setZoom] = useState<number>(0);
  // 0 = "fit to viewport"; positive integers = explicit zoom levels (50, 75, 100, 150, 200%)

  // Beregn skala basert på viewport-størrelse for "fit"-modus
  const [fitScale, setFitScale] = useState(1);
  useEffect(() => {
    const recalc = () => {
      if (!containerRef.current) return;
      const wrap = containerRef.current.parentElement;
      if (!wrap) return;
      const padding = 80;
      const availW = wrap.clientWidth - padding;
      const availH = wrap.clientHeight - padding;
      const sW = availW / canvasW;
      const sH = availH / canvasH;
      setFitScale(Math.min(sW, sH, 1));
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [canvasW, canvasH]);

  const scale = zoom > 0 ? zoom / 100 : fitScale;

  // ── Layer-mutations ──
  const addLayer = useCallback(
    (type: "text" | "image" | "shape") => {
      const id = uid(type);
      const baseW = type === "text" ? 600 : 400;
      const baseH = type === "text" ? 120 : 400;
      const x = Math.round((canvasW - baseW) / 2 / GRID_PX) * GRID_PX;
      const y = Math.round((canvasH - baseH) / 2 / GRID_PX) * GRID_PX;
      let layer: CustomLayer;
      if (type === "text") {
        layer = {
          id,
          type: "text",
          x,
          y,
          w: baseW,
          h: baseH,
          text: "Ny tekst",
          fontFamily: "Bebas Neue",
          fontSize: 96,
          fontWeight: 700,
          color: "#FFFFFF",
          align: "center",
        };
      } else if (type === "image") {
        layer = {
          id,
          type: "image",
          x,
          y,
          w: baseW,
          h: baseH,
          imageUrl: "",
          objectFit: "contain",
        };
      } else {
        layer = {
          id,
          type: "shape",
          x,
          y,
          w: baseW,
          h: baseH,
          shape: "rect",
          fill: "#FFFFFF",
          opacity: 0.9,
        };
      }
      onLayersChange([...layers, layer]);
      setSelectedId(id);
    },
    [layers, onLayersChange, canvasW, canvasH],
  );

  const updateLayer = useCallback(
    (id: string, patch: Partial<CustomLayer>) => {
      onLayersChange(
        layers.map((l) => (l.id === id ? ({ ...l, ...patch } as CustomLayer) : l)),
      );
    },
    [layers, onLayersChange],
  );

  const deleteLayer = useCallback(
    (id: string) => {
      onLayersChange(layers.filter((l) => l.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [layers, onLayersChange, selectedId],
  );

  // Selected layer ref (target for Moveable). Hopper over Moveable mens
  // bruker er i text-edit-modus så contentEditable får input-events i fred.
  const selectedTarget =
    selectedId && !editingTextId ? layerRefs.current.get(selectedId) ?? null : null;
  const selectedLayer = selectedId ? layers.find((l) => l.id === selectedId) ?? null : null;

  // Element guidelines = alle ANDRE layers (smart guides)
  const elementGuidelines = useMemo(() => {
    const refs: HTMLElement[] = [];
    for (const [id, el] of layerRefs.current.entries()) {
      if (id !== selectedId) refs.push(el);
    }
    return refs;
  }, [selectedId, layers]);

  const bleed = formatInfo?.bleed ?? 0;
  const safe = formatInfo?.safeZone ?? 0;

  // ── Render ──
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1, borderBottom: 1, borderColor: "divider", flexWrap: "wrap" }}>
        <ButtonGroup size="small" variant="outlined">
          <Button startIcon={<TextFieldsIcon />} onClick={() => addLayer("text")}>Tekst</Button>
          <Button startIcon={<ImageIcon />} onClick={() => addLayer("image")}>Bilde</Button>
          <Button startIcon={<CropIcon />} onClick={() => addLayer("shape")}>Form</Button>
        </ButtonGroup>

        <Divider orientation="vertical" flexItem />

        <ToggleButtonGroup size="small" value={[snap && "snap", guides && "guides"].filter(Boolean)}>
          <Tooltip title="Snap til 8px-grid">
            <ToggleButton value="snap" selected={snap} onChange={() => setSnap((s) => !s)}>
              <GridOnIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Smart-guides (snap til andre layers)">
            <ToggleButton value="guides" selected={guides} onChange={() => setGuides((g) => !g)}>
              <LayersIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Linjaler">
            <ToggleButton value="rulers" selected={showRulers} onChange={() => setShowRulers((r) => !r)}>
              <StraightenIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Safe-zone + bleed-overlay">
            <ToggleButton value="safezone" selected={showSafeZone} onChange={() => setShowSafeZone((s) => !s)}>
              <Crop54Icon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Properties-panel">
            <ToggleButton value="props" selected={showProps} onChange={() => setShowProps((p) => !p)}>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>Props</span>
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem />

        {/* Zoom */}
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Zoom ut">
            <IconButton size="small" onClick={() => setZoom((z) => Math.max(25, (z || Math.round(fitScale * 100)) - 25))}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button size="small" sx={{ minWidth: 70 }} onClick={() => setZoom(0)}>
            {zoom > 0 ? `${zoom}%` : "Fit"}
          </Button>
          <Tooltip title="Zoom inn">
            <IconButton size="small" onClick={() => setZoom((z) => Math.min(400, (z || Math.round(fitScale * 100)) + 25))}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Tilbakestill til fit">
            <IconButton size="small" onClick={() => setZoom(0)}>
              <CenterFocusStrongIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        <Box flex={1} />

        {selectedId && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {layers.find((l) => l.id === selectedId)?.type} · {selectedId.slice(0, 8)}
            </Typography>
            <IconButton size="small" onClick={() => deleteLayer(selectedId)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Stack>

      {/* Hovedrad: canvas + props-panel */}
      <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "#3a3a3a",
          backgroundImage:
            "linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 5,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedId(null);
        }}
      >
        <Box
          ref={containerRef}
          sx={{
            position: "relative",
            width: canvasW,
            height: canvasH,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            backgroundColor: "white",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            flexShrink: 0,
          }}
        >
          {/* Backdrop: server-rendret PNG */}
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: canvasW,
                height: canvasH,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Custom layers */}
          {layers.map((layer) => (
            <LayerView
              key={layer.id}
              layer={layer}
              selected={selectedId === layer.id}
              editing={editingTextId === layer.id}
              onSelect={() => setSelectedId(layer.id)}
              onStartEdit={() => layer.type === "text" && setEditingTextId(layer.id)}
              onCommitEdit={(newText: string) => {
                updateLayer(layer.id, { text: newText } as Partial<CustomLayer>);
                setEditingTextId(null);
              }}
              onMount={(el) => {
                if (el) layerRefs.current.set(layer.id, el);
                else layerRefs.current.delete(layer.id);
              }}
            />
          ))}

          {/* Bleed + safe-zone overlay */}
          {showSafeZone && bleed > 0 && (
            <>
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  outline: `${bleed}px solid rgba(255, 0, 0, 0.15)`,
                  outlineOffset: `-${bleed}px`,
                  pointerEvents: "none",
                  boxSizing: "border-box",
                }}
              />
              {safe > 0 && (
                <Box
                  sx={{
                    position: "absolute",
                    top: bleed + safe,
                    left: bleed + safe,
                    right: bleed + safe,
                    bottom: bleed + safe,
                    border: "2px dashed rgba(0, 200, 100, 0.6)",
                    pointerEvents: "none",
                    boxSizing: "border-box",
                  }}
                />
              )}
            </>
          )}

          {/* Linjaler */}
          {showRulers && (
            <>
              <Ruler axis="horizontal" length={canvasW} scale={scale} />
              <Ruler axis="vertical" length={canvasH} scale={scale} />
            </>
          )}

          {/* react-moveable */}
          {selectedTarget && (
            <Moveable
              target={selectedTarget}
              draggable
              resizable
              rotatable
              keepRatio={false}
              throttleDrag={1}
              throttleResize={1}
              snappable={snap}
              snapGridWidth={GRID_PX}
              snapGridHeight={GRID_PX}
              snapThreshold={5}
              snapDirections={{ left: true, right: true, top: true, bottom: true, center: true, middle: true }}
              elementSnapDirections={{ left: true, right: true, top: true, bottom: true, center: true, middle: true }}
              elementGuidelines={guides ? elementGuidelines : []}
              snapGap
              isDisplaySnapDigit
              isDisplayInnerSnapDigit
              snapContainer={containerRef.current}
              bounds={{ left: 0, top: 0, right: canvasW, bottom: canvasH }}
              onDrag={({ target, beforeTranslate }) => {
                target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;
              }}
              onDragEnd={({ lastEvent }) => {
                if (!lastEvent || !selectedId) return;
                const dx = lastEvent.beforeTranslate[0] as number;
                const dy = lastEvent.beforeTranslate[1] as number;
                const layer = layers.find((l) => l.id === selectedId);
                if (!layer) return;
                updateLayer(selectedId, { x: layer.x + dx, y: layer.y + dy });
                // Reset transform — komponenten re-rendres med ny x/y
                if (selectedTarget) selectedTarget.style.transform = "";
              }}
              onResize={({ target, width, height, drag }) => {
                target.style.width = `${width}px`;
                target.style.height = `${height}px`;
                target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px)`;
              }}
              onResizeEnd={({ lastEvent }) => {
                if (!lastEvent || !selectedId) return;
                const w = lastEvent.width as number;
                const h = lastEvent.height as number;
                const dx = lastEvent.drag.beforeTranslate[0] as number;
                const dy = lastEvent.drag.beforeTranslate[1] as number;
                const layer = layers.find((l) => l.id === selectedId);
                if (!layer) return;
                updateLayer(selectedId, {
                  x: layer.x + dx,
                  y: layer.y + dy,
                  w,
                  h,
                });
                if (selectedTarget) selectedTarget.style.transform = "";
              }}
              onRotate={({ target, beforeRotate }) => {
                target.style.transform = `rotate(${beforeRotate}deg)`;
              }}
              onRotateEnd={({ lastEvent }) => {
                if (!lastEvent || !selectedId) return;
                updateLayer(selectedId, { rotation: lastEvent.beforeRotate as number });
                if (selectedTarget) selectedTarget.style.transform = "";
              }}
            />
          )}
        </Box>
      </Box>

      {/* Properties-panel (høyre sidebar når et lag er valgt) */}
      {showProps && selectedLayer && (
        <PropertiesPanel
          layer={selectedLayer}
          onChange={(patch) => updateLayer(selectedLayer.id, patch)}
          onClose={() => setShowProps(false)}
        />
      )}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PropertiesPanel — kontekst-meny for valgt lag
// ─────────────────────────────────────────────────────────────────────────

const FONT_FAMILIES = ["Inter", "Manrope", "Bebas Neue", "Anton", "Oswald", "Bowlby One", "Caveat", "Permanent Marker"];

function PropertiesPanel({
  layer,
  onChange,
  onClose,
}: {
  layer: CustomLayer;
  onChange: (patch: Partial<CustomLayer>) => void;
  onClose: () => void;
}) {
  return (
    <Paper
      elevation={2}
      sx={{
        width: 300,
        p: 2,
        overflow: "auto",
        borderLeft: 1,
        borderColor: "divider",
        flexShrink: 0,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          {layer.type === "text" ? "Tekst-lag" : layer.type === "image" ? "Bilde-lag" : "Form-lag"}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <DeleteIcon fontSize="small" sx={{ visibility: "hidden" }} />
          <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
        </IconButton>
      </Stack>

      {/* Posisjon + størrelse — felles for alle */}
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
        Posisjon (px)
      </Typography>
      <Stack direction="row" spacing={1} mb={1}>
        <TextField
          label="X"
          type="number"
          size="small"
          value={layer.x}
          onChange={(e) => onChange({ x: Number(e.target.value) } as Partial<CustomLayer>)}
        />
        <TextField
          label="Y"
          type="number"
          size="small"
          value={layer.y}
          onChange={(e) => onChange({ y: Number(e.target.value) } as Partial<CustomLayer>)}
        />
      </Stack>
      <Stack direction="row" spacing={1} mb={1}>
        <TextField
          label="Bredde"
          type="number"
          size="small"
          value={layer.w}
          onChange={(e) => onChange({ w: Number(e.target.value) } as Partial<CustomLayer>)}
        />
        <TextField
          label="Høyde"
          type="number"
          size="small"
          value={layer.h}
          onChange={(e) => onChange({ h: Number(e.target.value) } as Partial<CustomLayer>)}
        />
      </Stack>
      <Box mb={2}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Rotasjon: {Math.round(layer.rotation ?? 0)}°
        </Typography>
        <Slider
          size="small"
          value={layer.rotation ?? 0}
          min={-180}
          max={180}
          step={1}
          onChange={(_e, v) => onChange({ rotation: v as number } as Partial<CustomLayer>)}
        />
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* Type-spesifikke felter */}
      {layer.type === "text" && (
        <Stack spacing={1.5}>
          <TextField
            label="Tekst"
            value={layer.text}
            onChange={(e) => onChange({ text: e.target.value } as Partial<CustomLayer>)}
            multiline
            maxRows={4}
            fullWidth
            size="small"
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Font</InputLabel>
            <Select
              label="Font"
              value={layer.fontFamily ?? "Inter"}
              onChange={(e) => onChange({ fontFamily: e.target.value } as Partial<CustomLayer>)}
            >
              {FONT_FAMILIES.map((f) => (
                <MenuItem key={f} value={f}>{f}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Størrelse"
              type="number"
              size="small"
              value={layer.fontSize ?? 32}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) } as Partial<CustomLayer>)}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Vekt</InputLabel>
              <Select
                label="Vekt"
                value={layer.fontWeight ?? 400}
                onChange={(e) => onChange({ fontWeight: Number(e.target.value) as 400 | 700 } as Partial<CustomLayer>)}
              >
                <MenuItem value={400}>400 Regular</MenuItem>
                <MenuItem value={700}>700 Bold</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Tekstfarge"
              type="color"
              size="small"
              value={layer.color ?? "#000000"}
              onChange={(e) => onChange({ color: e.target.value } as Partial<CustomLayer>)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Bakgrunn"
              type="color"
              size="small"
              value={layer.backgroundColor ?? "#ffffff"}
              onChange={(e) => onChange({ backgroundColor: e.target.value } as Partial<CustomLayer>)}
              sx={{ flex: 1 }}
            />
          </Stack>
          <FormControl size="small" fullWidth>
            <InputLabel>Justering</InputLabel>
            <Select
              label="Justering"
              value={layer.align ?? "left"}
              onChange={(e) => onChange({ align: e.target.value as "left" | "center" | "right" } as Partial<CustomLayer>)}
            >
              <MenuItem value="left">Venstre</MenuItem>
              <MenuItem value="center">Midten</MenuItem>
              <MenuItem value="right">Høyre</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Padding (px)"
            type="number"
            size="small"
            value={layer.padding ?? 0}
            onChange={(e) => onChange({ padding: Number(e.target.value) } as Partial<CustomLayer>)}
          />
        </Stack>
      )}

      {layer.type === "image" && (
        <Stack spacing={1.5}>
          <TextField
            label="Bilde-URL"
            value={layer.imageUrl}
            onChange={(e) => onChange({ imageUrl: e.target.value } as Partial<CustomLayer>)}
            size="small"
            fullWidth
            multiline
            maxRows={3}
            sx={{ "& textarea": { fontFamily: "monospace", fontSize: 11 } }}
            helperText="Lim inn URL eller last opp en fil under"
          />
          <ImageUploadButton
            onUploaded={(url) => onChange({ imageUrl: url } as Partial<CustomLayer>)}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Object fit</InputLabel>
            <Select
              label="Object fit"
              value={layer.objectFit ?? "contain"}
              onChange={(e) => onChange({ objectFit: e.target.value as "contain" | "cover" } as Partial<CustomLayer>)}
            >
              <MenuItem value="contain">Contain</MenuItem>
              <MenuItem value="cover">Cover</MenuItem>
            </Select>
          </FormControl>
          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Opacity: {Math.round((layer.opacity ?? 1) * 100)}%
            </Typography>
            <Slider
              size="small"
              value={layer.opacity ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(_e, v) => onChange({ opacity: v as number } as Partial<CustomLayer>)}
            />
          </Box>
          <TextField
            label="Border radius (px)"
            type="number"
            size="small"
            value={layer.borderRadius ?? 0}
            onChange={(e) => onChange({ borderRadius: Number(e.target.value) } as Partial<CustomLayer>)}
          />
        </Stack>
      )}

      {layer.type === "shape" && (
        <Stack spacing={1.5}>
          <FormControl size="small" fullWidth>
            <InputLabel>Form</InputLabel>
            <Select
              label="Form"
              value={layer.shape}
              onChange={(e) => onChange({ shape: e.target.value as "rect" | "circle" } as Partial<CustomLayer>)}
            >
              <MenuItem value="rect">Rektangel</MenuItem>
              <MenuItem value="circle">Sirkel</MenuItem>
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Fyll"
              type="color"
              size="small"
              value={layer.fill ?? "#000000"}
              onChange={(e) => onChange({ fill: e.target.value } as Partial<CustomLayer>)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Strek"
              type="color"
              size="small"
              value={layer.stroke ?? "#ffffff"}
              onChange={(e) => onChange({ stroke: e.target.value } as Partial<CustomLayer>)}
              sx={{ flex: 1 }}
            />
          </Stack>
          <TextField
            label="Strek-tykkelse (px)"
            type="number"
            size="small"
            value={layer.strokeWidth ?? 0}
            onChange={(e) => onChange({ strokeWidth: Number(e.target.value) } as Partial<CustomLayer>)}
          />
          {layer.shape === "rect" && (
            <TextField
              label="Border radius (px)"
              type="number"
              size="small"
              value={layer.borderRadius ?? 0}
              onChange={(e) => onChange({ borderRadius: Number(e.target.value) } as Partial<CustomLayer>)}
            />
          )}
          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Opacity: {Math.round((layer.opacity ?? 1) * 100)}%
            </Typography>
            <Slider
              size="small"
              value={layer.opacity ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(_e, v) => onChange({ opacity: v as number } as Partial<CustomLayer>)}
            />
          </Box>
        </Stack>
      )}
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LayerView — rendrer en custom layer i DOM (matcher backend-render visuelt)
// ─────────────────────────────────────────────────────────────────────────

function LayerView({
  layer,
  selected,
  editing,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onMount,
}: {
  layer: CustomLayer;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onCommitEdit: (newText: string) => void;
  onMount: (el: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onMount(ref.current);
    return () => onMount(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.w,
    height: layer.h,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    transformOrigin: "center",
    cursor: "move",
    outline: selected ? "2px solid #FF6B35" : "1px dashed rgba(0,0,0,0.2)",
    outlineOffset: 0,
    boxSizing: "border-box",
  };

  if (layer.type === "text") {
    const textStyle: React.CSSProperties = {
      ...baseStyle,
      fontFamily: layer.fontFamily ?? "Inter",
      fontSize: layer.fontSize ?? 32,
      fontWeight: layer.fontWeight ?? 400,
      color: layer.color ?? "#000",
      textAlign: layer.align ?? "left",
      backgroundColor: layer.backgroundColor ?? "transparent",
      padding: layer.padding ?? 0,
      letterSpacing: layer.letterSpacing ?? "normal",
      lineHeight: layer.lineHeight ?? 1.2,
      display: "flex",
      alignItems: "center",
      justifyContent: layer.align === "center" ? "center" : layer.align === "right" ? "flex-end" : "flex-start",
      cursor: editing ? "text" : "move",
    };
    if (editing) {
      // Inline contentEditable mode
      return (
        <div
          ref={ref}
          style={{ ...textStyle, outline: "2px solid #FF6B35", boxShadow: "0 0 0 4px rgba(255,107,53,0.25)" }}
          contentEditable
          suppressContentEditableWarning
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => onCommitEdit(e.currentTarget.innerText)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget as HTMLDivElement).blur();
            }
            if (e.key === "Escape") {
              (e.currentTarget as HTMLDivElement).blur();
            }
          }}
        >
          {layer.text}
        </div>
      );
    }
    return (
      <div
        ref={ref}
        style={textStyle}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartEdit();
        }}
      >
        {layer.text}
      </div>
    );
  }

  if (layer.type === "image") {
    return (
      <div
        ref={ref}
        style={baseStyle}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {layer.imageUrl ? (
          <img
            src={layer.imageUrl}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: layer.objectFit ?? "contain",
              opacity: layer.opacity ?? 1,
              borderRadius: layer.borderRadius ?? 0,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", backgroundColor: "rgba(255,107,53,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF6B35", fontFamily: "Inter", fontSize: 14 }}>
            Bilde-URL ikke satt
          </div>
        )}
      </div>
    );
  }

  // shape
  return (
    <div
      ref={ref}
      style={{
        ...baseStyle,
        backgroundColor: layer.fill ?? "#000",
        border: layer.strokeWidth && layer.stroke ? `${layer.strokeWidth}px solid ${layer.stroke}` : "none",
        borderRadius: layer.shape === "circle" ? "50%" : layer.borderRadius ?? 0,
        opacity: layer.opacity ?? 1,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ImageUploadButton — multipart-upload til R2
// ─────────────────────────────────────────────────────────────────────────

function ImageUploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
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
    <Box>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        size="small"
        variant="outlined"
        startIcon={uploading ? <span style={{ width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> : <ImageIcon />}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        fullWidth
      >
        {uploading ? "Laster opp…" : "Last opp bilde fra fil"}
      </Button>
      {error && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Linjaler
// ─────────────────────────────────────────────────────────────────────────

function Ruler({ axis, length, scale }: { axis: "horizontal" | "vertical"; length: number; scale: number }) {
  const minorPx = 50;
  const majorPx = 250;
  const ticks = [];
  for (let p = 0; p <= length; p += minorPx) {
    ticks.push({ pos: p, major: p % majorPx === 0 });
  }
  const thickness = 22 / scale;

  if (axis === "horizontal") {
    return (
      <div
        style={{
          position: "absolute",
          top: -thickness,
          left: 0,
          width: length,
          height: thickness,
          background: "#fafafa",
          borderBottom: "1px solid #ccc",
          fontFamily: "monospace",
          fontSize: 10 / scale,
          color: "#666",
          pointerEvents: "none",
        }}
      >
        {ticks.map((t) => (
          <div
            key={t.pos}
            style={{
              position: "absolute",
              left: t.pos,
              top: t.major ? thickness * 0.4 : thickness * 0.7,
              bottom: 0,
              width: 1,
              background: "#888",
            }}
          >
            {t.major && (
              <span style={{ position: "absolute", left: 2, top: -thickness * 0.5, color: "#444" }}>
                {t.pos}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: -thickness,
        width: thickness,
        height: length,
        background: "#fafafa",
        borderRight: "1px solid #ccc",
        fontFamily: "monospace",
        fontSize: 10 / scale,
        color: "#666",
        pointerEvents: "none",
      }}
    >
      {ticks.map((t) => (
        <div
          key={t.pos}
          style={{
            position: "absolute",
            top: t.pos,
            left: t.major ? thickness * 0.4 : thickness * 0.7,
            right: 0,
            height: 1,
            background: "#888",
          }}
        >
          {t.major && (
            <span style={{ position: "absolute", left: -thickness * 0.5, top: 2, color: "#444" }}>
              {t.pos}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

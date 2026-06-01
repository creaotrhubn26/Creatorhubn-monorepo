/**
 * DemoStudioView — Product Demo Studio som egen flate i Post Agent.
 *
 * Egen view (ikke en fane i CreativeEditorView) — men layouten er INSPIRERT av
 * Story/CreativeEditor: sidebar/preview + bunn-timeline + scener-med-status.
 *
 * Fase 1 (MVP-skall):
 *   - URL-input → opprett demo-prosjekt med standard scene-flow
 *   - Scene-timeline (legg til / velg / fjern / status)
 *   - Script-per-scene editor (narration + required action + overlay)
 *   - Guided Recorder-panel: manuell Next Step / Mark Done / Retake (teleprompter)
 *
 * Gjenbruker device-variantene fra mockup-video-modulen og scene-modellen i
 * demoStudioModel. State i Zustand (demoStudioStore), autolagret til localStorage.
 * Manuell progresjon er kjernekravet — ingenting avanserer av seg selv.
 *
 * MUI-konvensjon (ingen emoji).
 */

import { useEffect, useState } from 'react';
import {
  Box, Button, Chip, Divider, IconButton, MenuItem, Select, Stack,
  TextField, Typography, LinearProgress, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';
import TabletMacIcon from '@mui/icons-material/TabletMac';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import LanguageIcon from '@mui/icons-material/Language';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';

import { useDemoStudio } from './demoStudioStore';
import {
  DEMO_TYPE_LABELS, SCENE_STATUS_LABELS, SCENE_STATUS_COLORS,
  totalDuration, type DemoDevice, type DemoType,
} from './demoStudioModel';

const DEVICE_ICON: Record<DemoDevice, JSX.Element> = {
  macbook: <LaptopMacIcon fontSize="small" />,
  ipad: <TabletMacIcon fontSize="small" />,
  iphone: <PhoneIphoneIcon fontSize="small" />,
};

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DemoStudioStoryTab() {
  const {
    project, selectedSceneId, recorderStepIndex,
    createProject, loadExisting, selectScene, addScene, updateScene,
    removeScene, setSceneStatus, setSceneDevice,
    startRecorder, nextStep, markCurrentDone, retakeCurrent, goToStep,
  } = useDemoStudio();

  const [urlInput, setUrlInput] = useState('');
  const [demoType, setDemoType] = useState<DemoType>('product_demo');
  const [recording, setRecording] = useState(false);

  // Last sist åpnede prosjekt ved mount.
  useEffect(() => { if (!project) loadExisting(); }, []); // eslint-disable-line

  // ── Tom tilstand: Create Demo ──
  if (!project) {
    return (
      <Box sx={{ p: 4, maxWidth: 640, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Product Demo Studio</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Lim inn en URL og bygg en scene-basert produktdemo. Du styrer opptaket steg for steg.
        </Typography>
        <Stack spacing={2}>
          <TextField
            fullWidth label="Website URL" placeholder="https://example.com"
            value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            InputProps={{ startAdornment: <LanguageIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
          />
          <Select size="small" value={demoType} onChange={(e) => setDemoType(e.target.value as DemoType)}>
            {(Object.keys(DEMO_TYPE_LABELS) as DemoType[]).map((t) => (
              <MenuItem key={t} value={t}>{DEMO_TYPE_LABELS[t]}</MenuItem>
            ))}
          </Select>
          <Button
            variant="contained" startIcon={<AddIcon />}
            disabled={!/^https?:\/\//.test(urlInput.trim())}
            onClick={() => createProject(urlInput.trim(), demoType)}
          >
            Generér demo-flow
          </Button>
        </Stack>
      </Box>
    );
  }

  const scenes = project.scenes;
  const selected = scenes.find((s) => s.id === selectedSceneId) ?? scenes[0];
  const recorderScene = scenes[recorderStepIndex];
  const doneCount = scenes.filter((s) => s.status === 'done' || s.status === 'approved').length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480 }}>
      {/* ── Topbar: prosjekt + URL + total ── */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <TextField
          variant="standard" value={project.name}
          onChange={(e) => useDemoStudio.getState().setProjectField('name', e.target.value)}
          sx={{ minWidth: 180 }}
        />
        <Chip size="small" icon={<LanguageIcon />} label={project.url} variant="outlined" />
        <Chip size="small" label={DEMO_TYPE_LABELS[project.demoType]} />
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {doneCount}/{scenes.length} ferdig · {fmtDur(totalDuration(scenes))}
        </Typography>
        <Button size="small" variant={recording ? 'contained' : 'outlined'} color={recording ? 'error' : 'primary'}
          startIcon={<PlayArrowIcon />}
          onClick={() => { setRecording(true); startRecorder(); }}>
          Start guided recording
        </Button>
      </Stack>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Venstre: scene-script editor ── */}
        <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
          {selected && (
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                  Scene {selected.index + 1} / {scenes.length}
                </Typography>
                <Chip size="small" label={SCENE_STATUS_LABELS[selected.status]}
                  sx={{ bgcolor: SCENE_STATUS_COLORS[selected.status], color: '#fff' }} />
                <Box sx={{ flex: 1 }} />
                {(['macbook', 'ipad', 'iphone'] as DemoDevice[]).map((d) => (
                  <Tooltip key={d} title={d}>
                    <IconButton size="small" color={selected.device === d ? 'primary' : 'default'}
                      onClick={() => setSceneDevice(selected.id, d)}>
                      {DEVICE_ICON[d]}
                    </IconButton>
                  </Tooltip>
                ))}
              </Stack>

              <TextField label="Scene-tittel" size="small" value={selected.title}
                onChange={(e) => updateScene(selected.id, { title: e.target.value })} />

              <TextField label="Manus / narration (teleprompter)" multiline minRows={3}
                value={selected.narration}
                onChange={(e) => updateScene(selected.id, { narration: e.target.value })}
                placeholder="Hva som skal sies i denne scenen…" />

              <TextField label="Required action" size="small" value={selected.requiredAction}
                onChange={(e) => updateScene(selected.id, { requiredAction: e.target.value })}
                placeholder="F.eks. Klikk på «Start free trial»" />

              <TextField label="Overlay-tekst (vises i video)" size="small" value={selected.overlayText ?? ''}
                onChange={(e) => updateScene(selected.id, { overlayText: e.target.value })} />

              <Stack direction="row" spacing={2} alignItems="center">
                <TextField label="Varighet (sek)" size="small" type="number" sx={{ width: 140 }}
                  value={selected.duration}
                  onChange={(e) => updateScene(selected.id, { duration: Number(e.target.value) || 0 })} />
                <Box sx={{ flex: 1 }} />
                <Button size="small" color="error" startIcon={<DeleteOutlineIcon />}
                  onClick={() => removeScene(selected.id)} disabled={scenes.length <= 1}>
                  Slett scene
                </Button>
              </Stack>
            </Stack>
          )}
        </Box>

        {/* ── Høyre: Guided Recorder-panel (teleprompter + manuell progresjon) ── */}
        {recording && recorderScene && (
          <Box sx={{ width: 320, p: 2, borderLeft: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(0,0,0,0.2)' }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Steg {recorderStepIndex + 1} av {scenes.length}
            </Typography>
            <LinearProgress variant="determinate" value={((recorderStepIndex + 1) / scenes.length) * 100} sx={{ my: 1 }} />

            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{recorderScene.title}</Typography>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Narration</Typography>
            <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
              {recorderScene.narration || <em>(ingen manus ennå)</em>}
            </Typography>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Required action</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {recorderScene.requiredAction || <em>(ingen handling angitt)</em>}
            </Typography>

            <Chip size="small" label={SCENE_STATUS_LABELS[recorderScene.status]}
              sx={{ bgcolor: SCENE_STATUS_COLORS[recorderScene.status], color: '#fff', mb: 2 }} />

            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 2 }}>
              Opptaket venter. Systemet går ikke videre før du bekrefter.
            </Typography>

            <Stack spacing={1}>
              <Button fullWidth variant="contained" color="success" startIcon={<CheckCircleIcon />}
                onClick={markCurrentDone}>Mark as Done</Button>
              <Button fullWidth variant="outlined" color="warning" startIcon={<ReplayIcon />}
                onClick={retakeCurrent}>Retake</Button>
              <Button fullWidth variant="outlined" startIcon={<SkipNextIcon />}
                onClick={nextStep} disabled={recorderStepIndex >= scenes.length - 1}>
                Next Step
              </Button>
            </Stack>
          </Box>
        )}
      </Box>

      {/* ── Bunn: scene-timeline ── */}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', p: 1.5, overflowX: 'auto' }}>
        <Stack direction="row" spacing={1} alignItems="stretch">
          {scenes.map((s, i) => (
            <Box key={s.id}
              onClick={() => { selectScene(s.id); if (recording) goToStep(i); }}
              sx={{
                minWidth: 130, p: 1, borderRadius: 1, cursor: 'pointer',
                border: '2px solid', borderColor: s.id === selectedSceneId ? 'primary.main' : 'transparent',
                bgcolor: 'rgba(255,255,255,0.04)',
              }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{i + 1}</Typography>
                {DEVICE_ICON[s.device]}
                <Box sx={{ flex: 1 }} />
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SCENE_STATUS_COLORS[s.status] }} />
              </Stack>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{s.title}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtDur(s.duration)}</Typography>
            </Box>
          ))}
          <Button variant="outlined" sx={{ minWidth: 56 }} onClick={() => addScene(scenes.length - 1)}>
            <AddIcon />
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

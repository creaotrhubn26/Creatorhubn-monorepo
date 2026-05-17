// @ts-nocheck
/**
 * DemoAnimaticPage — selvstendig demo-side for animatic + SFX-systemet.
 * 6 placeholder-frames med tekst som trigger SFX-detector (smell, regn,
 * telefon, torden, gisp). Lar deg verifisere hele flyten — playback,
 * SFX-foreslag, voiceover, opptak — uten å trenge en ekte
 * Role Room-scene.
 *
 * Mountes på /demo/animatic. Sceneid er statisk så IndexedDB-persistens
 * funker mellom reloads.
 */

import React from 'react';
import { Box, Container, Typography, Paper, Stack, Divider } from '@mui/material';
import { AnimaticPlayer } from '../components/drawing/AnimaticPlayer';

const DEMO_SCENE_ID = 'demo-animatic-scene-001';

/** Generer en farget SVG-placeholder som data-URL. */
function makePlaceholderSvg(opts: {
  bgColor: string;
  textColor: string;
  shotNumber: string;
  description: string;
}): string {
  const { bgColor, textColor, shotNumber, description } = opts;
  // Bryt beskrivelsen til 2-3 linjer for visuell luft.
  const lines: string[] = [];
  const words = description.split(' ');
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).length > 28) {
      lines.push(line.trim());
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  const lineHtml = lines
    .map((l, i) => `<tspan x="640" dy="${i === 0 ? 0 : 50}">${l}</tspan>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
    <rect width="1280" height="720" fill="${bgColor}"/>
    <text x="40" y="60" font-family="system-ui" font-size="32" font-weight="700" fill="${textColor}" opacity="0.6">SHOT ${shotNumber}</text>
    <text x="640" y="380" font-family="system-ui" font-size="36" fill="${textColor}" text-anchor="middle">${lineHtml}</text>
    <rect x="40" y="40" width="1200" height="640" fill="none" stroke="${textColor}" stroke-opacity="0.2" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const DEMO_FRAMES = [
  {
    id: 'demo-frame-1',
    duration: 3,
    shotNumber: '1',
    description: 'INT. SOVEROM — NATT. Telefonen ringer brått i mørket.',
    caption: 'KARI (V.O.)\nDet var midt på natten...',
    imageUrl: makePlaceholderSvg({
      bgColor: '#1a1a2e',
      textColor: '#e0e7ff',
      shotNumber: '1',
      description: 'Telefonen ringer',
    }),
  },
  {
    id: 'demo-frame-2',
    duration: 2,
    shotNumber: '2',
    description: 'CU på Kari. Hun gisper og setter seg opp i senga.',
    caption: 'KARI\nHallo?',
    imageUrl: makePlaceholderSvg({
      bgColor: '#2d1b4e',
      textColor: '#fde68a',
      shotNumber: '2',
      description: 'Hun gisper',
    }),
  },
  {
    id: 'demo-frame-3',
    duration: 4,
    shotNumber: '3',
    description: 'EXT. GATA — NATT. Regn pøser. Bil passerer i bakgrunnen.',
    caption: 'NARRATOR\nUte raste regnet, og verden var våt.',
    imageUrl: makePlaceholderSvg({
      bgColor: '#0f172a',
      textColor: '#94a3b8',
      shotNumber: '3',
      description: 'Regn på gata',
    }),
  },
  {
    id: 'demo-frame-4',
    duration: 2.5,
    shotNumber: '4',
    description: 'Hun løper mot døra og åpner den voldsomt.',
    caption: '',
    imageUrl: makePlaceholderSvg({
      bgColor: '#4c1d95',
      textColor: '#ede9fe',
      shotNumber: '4',
      description: 'Hun løper',
    }),
  },
  {
    id: 'demo-frame-5',
    duration: 3,
    shotNumber: '5',
    description: 'Døra smeller bak henne. Torden i det fjerne.',
    caption: 'NARRATOR\nDøra falt igjen med et brak.',
    imageUrl: makePlaceholderSvg({
      bgColor: '#7f1d1d',
      textColor: '#fecaca',
      shotNumber: '5',
      description: 'Dør smeller',
    }),
  },
  {
    id: 'demo-frame-6',
    duration: 3.5,
    shotNumber: '6',
    description: 'Wide shot. Hun står alene på gata mens torden ruller.',
    caption: 'KARI\nJeg er for sent ute.',
    imageUrl: makePlaceholderSvg({
      bgColor: '#1e1b4b',
      textColor: '#c7d2fe',
      shotNumber: '6',
      description: 'Alene på gata',
    }),
  },
];

export const DemoAnimaticPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Animatic-demo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            6 frames med handlingsord som trigger SFX-detector: ring, gisp, regn, løp, smell, torden.
            Bruk panelet til å teste hele flyten — playback, foreslå/generer SFX, last opp voiceover,
            ta opp WebM. Tilstand persisteres til IndexedDB under demo-scene-id.
          </Typography>
        </Box>

        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Hva å teste
              </Typography>
              <Box component="ol" sx={{ pl: 2.5, mt: 0.5, mb: 0, '& li': { fontSize: 14, mb: 0.5 } }}>
                <li>Trykk Play — frames bytter automatisk etter sin egen duration (3, 2, 4, 2.5, 3, 3.5s = 18s totalt)</li>
                <li>Scrubber-marks viser frame-grensene — klikk for å hoppe</li>
                <li>SFX-panelet auto-detekterer events for aktivt frame. Trykk ✨ for CLAP-foreslag eller 🧠 for ElevenLabs-generering</li>
                <li>Last opp en voiceover-fil på et frame via mic-knappen i strippen — den persisteres</li>
                <li>Trykk ⏺️ for å ta opp hele animaticen med canvas + lyd til WebM</li>
                <li>F-tasten åpner fullscreen, ←/→ navigerer mellom frames, Space er play/pause</li>
                <li>Reload siden — alt skal være igjen siden sceneId persisteres til IndexedDB</li>
              </Box>
            </Box>
          </Stack>
        </Paper>

        <Divider />

        <AnimaticPlayer
          frames={DEMO_FRAMES}
          sceneId={DEMO_SCENE_ID}
        />

        <Paper sx={{ p: 2, bgcolor: 'rgba(165,180,252,0.05)', border: '1px solid rgba(165,180,252,0.2)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', mb: 0.5 }}>
            For markedsføring
          </Typography>
          <Typography variant="body2">
            Ta opp en WebM her, last den opp, og bruk som demo-video i pitch eller landing-page.
            Husk: hvis du laster opp ekte SFX i CDN'en og bygger biblioteket via
            <code style={{ marginLeft: 4, marginRight: 4 }}>npm run sfx:build</code>
            blir foreslagene reelle og opptakets lyd-design profesjonell.
          </Typography>
        </Paper>
      </Stack>
    </Container>
  );
};

export default DemoAnimaticPage;

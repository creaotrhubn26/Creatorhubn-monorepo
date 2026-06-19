/**
 * preflight — «Sjekk oppsett» før en forbruker starter. Validerer de tingene som
 * faktisk kan svikte (Tauri, AI, capture-IPC, voiceover) og gir et klart klar/
 * ikke-klar-signal + hva som må fikses. Capture-proben er en EKTE test mot siden
 * — den hjelper også hardware-verifiseringen (mest sannsynlige bruddpunkt:
 * remote.urls-IPC i demo-capture.json).
 */
import { isCaptureAvailable, scanDom } from '../../services/demoCaptureService';
import { isAiConnected } from '../../services/claudeProxyService';
import { isWebSpeechSupported } from './webSpeechVoiceover';

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'pending';
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

/** Umiddelbare sjekker (ingen nettverk). */
export function staticChecks(): Check[] {
  const tauri = isCaptureAvailable();
  const ai = isAiConnected();
  const speech = isWebSpeechSupported();
  return [
    tauri
      ? { id: 'tauri', label: 'Native app (capture)', status: 'ok', detail: 'Kjører i Tauri — klikk-capture/scan tilgjengelig.' }
      : { id: 'tauri', label: 'Native app (capture)', status: 'warn', detail: 'Kjører i nettleser — capture/native-funksjoner er av.', fix: 'Åpne Post Agent / Tauri-appen for full funksjonalitet.' },
    ai
      ? { id: 'ai', label: 'AI (Role Room)', status: 'ok', detail: 'Koblet til — AI Director, brief, infographics m.m. virker.' }
      : { id: 'ai', label: 'AI (Role Room)', status: 'fail', detail: 'Ikke koblet til Role Room.', fix: 'Logg inn (Koble til AI) — kreves for det meste av Marketing mode.' },
    speech
      ? { id: 'speech', label: 'Voiceover (nettleser)', status: 'ok', detail: 'Web Speech tilgjengelig — Resolve-fri opplesing virker.' }
      : { id: 'speech', label: 'Voiceover (nettleser)', status: 'warn', detail: 'Web Speech ikke tilgjengelig her.', fix: 'Bruk Resolve-voiceover, eller en nettleser med talesyntese.' },
  ];
}

/** EKTE capture-test mot en URL (avdekker remote.urls-IPC-problemer). */
export async function captureProbe(url: string): Promise<Check> {
  if (!isCaptureAvailable()) {
    return { id: 'capture', label: 'Capture-test', status: 'warn', detail: 'Hoppet over — ikke i Tauri-appen.' };
  }
  if (!url) {
    return { id: 'capture', label: 'Capture-test', status: 'warn', detail: 'Ingen URL å teste mot.' };
  }
  const scan = await scanDom(url).catch(() => null);
  if (!scan) {
    return {
      id: 'capture', label: 'Capture-test', status: 'fail',
      detail: 'Capture-vinduet svarte ikke (ingen DOM-scan).',
      fix: 'Sjekk remote.urls-glob i capabilities/demo-capture.json + at IPC fra eksterne sider er tillatt.',
    };
  }
  if (!scan.elements.length) {
    return {
      id: 'capture', label: 'Capture-test', status: 'warn',
      detail: 'Capture svarte, men fant 0 interaktive elementer.',
      fix: 'Siden kan være tung/SPA — prøv en annen URL eller vision-fallback.',
    };
  }
  return {
    id: 'capture', label: 'Capture-test', status: 'ok',
    detail: `Fant ${scan.elements.length} elementer${scan.branding?.brandName ? ` · merkevare «${scan.branding.brandName}»` : ''}.`,
  };
}

/** Samlet vurdering: 'ready' hvis ingen fail. */
export function overallStatus(checks: Check[]): 'ready' | 'blocked' | 'partial' {
  if (checks.some((c) => c.status === 'fail')) return 'blocked';
  if (checks.some((c) => c.status === 'warn')) return 'partial';
  return 'ready';
}

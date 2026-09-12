/**
 * iosWalkthrough — autonom gjennomgang av en iOS-app i simulatoren.
 *
 * Der web-pipelinen (autonomousDemo.ts) FÅR scener og tar dem opp, MÅ en app
 * først UTFORSKES: vi vet ikke skjermene på forhånd. Denne motoren driver
 * appen selv og bygger et storyboard forankret i det den faktisk ser:
 *
 *   launch → [ skjermbilde → describe (accessibility-tre) → Claude (vision +
 *   element-liste) planlegger scene + velger neste navigasjon → tap/sveip ] ×N
 *
 * Slik «forstår scriptet appen»: accessibility-treet (idb describe-all) gir hvert
 * element sin label + type + koordinat — iOS-ekvivalenten til DOM — og vision gir
 * semantisk kontekst. Resultatet er ekte DemoScene-er (manus + hotspot) som
 * mates rett inn i det vanlige opptaks-/voiceover-løpet.
 */
import { invoke } from '@tauri-apps/api/core';
import {
  iosSimBoot, iosSimLaunch, iosSimScreenshot, iosSimDescribe, iosSimTap, iosSimSwipe,
  type SimElement,
} from '../../api';
import { makeScene, type DemoScene, type DemoDevice } from './demoStudioModel';

export interface WalkthroughProgress { (msg: string, pct: number): void }

interface ClaudeBlock { type: string; text?: string; name?: string; input?: Record<string, unknown> }
interface ClaudeResp { content: ClaudeBlock[]; stop_reason?: string }

interface ScenePlan {
  scene_title: string;
  narration: string;
  overlay_text?: string;
  next_action: 'tap' | 'swipe_up' | 'swipe_down' | 'done';
  target_index: number;
  reason?: string;
}

const PLAN_TOOL = {
  name: 'plan_scene',
  description: 'Planlegg én demo-scene for skjermen som vises nå, og velg neste navigasjon.',
  input_schema: {
    type: 'object',
    properties: {
      scene_title: { type: 'string', description: 'Kort norsk tittel på skjermen, f.eks. «Kart-oversikt».' },
      narration: { type: 'string', description: 'Norsk voiceover-manus (1–2 setninger) som selger DENNE skjermen — hva brukeren ser og hvorfor det er nyttig.' },
      overlay_text: { type: 'string', description: 'Kort tekst-overlay til videoen (maks ~6 ord). Kan være tom.' },
      next_action: { type: 'string', enum: ['tap', 'swipe_up', 'swipe_down', 'done'], description: 'Hva som skal gjøres for å komme videre til neste interessante skjerm. «done» når demoen har dekket de viktigste flatene.' },
      target_index: { type: 'integer', description: 'Indeks i element-lista som skal trykkes for å navigere videre (kun for next_action=tap). -1 ellers.' },
      reason: { type: 'string', description: 'Kort begrunnelse for valget (hvorfor denne skjermen/handlingen driver en god demo).' },
    },
    required: ['scene_title', 'narration', 'next_action', 'target_index', 'reason'],
  },
} as const;

const SYSTEM = `Du er en autonom produkt-demo-regissør som styrer en ekte iOS-app i en simulator.
Du får ET SKJERMBILDE av appen akkurat nå + en NUMMERERT LISTE over trykkbare elementer (fra iOS accessibility-treet, med label og type).
Oppgaven din: bygg en overbevisende produkt-demo ved å bevege deg gjennom appens viktigste skjermer, én scene om gangen.

For HVER skjerm:
- Skriv en kort, selgende norsk voiceover for det brukeren ser (konkret, ikke generisk «velkommen»-fyll).
- Velg neste navigasjon som fører til en NY, interessant skjerm (unngå å gå i ring — ikke trykk samme element to ganger, ikke bli på samme skjerm).
- Foretrekk å vise kjernefunksjonene: hovednavigasjon, lister/kart, detaljer, handlinger.
- Bruk 'done' når du har dekket 4–8 gode skjermer, eller hvis du sitter fast.
Velg target_index KUN fra den oppgitte element-lista.`;

function fmtElements(els: SimElement[]): string {
  return els.map((e, i) => {
    const label = e.label || '(uten navn)';
    return `[${i}] ${label} · ${e.type}`;
  }).join('\n');
}

/** Bygg en DemoScene fra Claudes plan + det tappede elementets ramme (→ hotspot). */
function toScene(
  index: number,
  device: DemoDevice,
  plan: { scene_title: string; narration: string; overlay_text?: string; reason?: string },
  target: SimElement | null,
  screenW: number,
  screenH: number,
): DemoScene {
  const s = makeScene(index, device);
  s.title = plan.scene_title || `Skjerm ${index + 1}`;
  s.narration = plan.narration || '';
  s.overlayText = plan.overlay_text || '';
  s.requiredAction = target ? `Trykk «${target.label || 'elementet'}»` : 'Vis skjermen';
  s.actionType = target ? 'click' : 'wait';
  s.targetLabel = target?.label || undefined;
  s.bindingConfidence = target ? 'high' : 'medium'; // hentet fra ekte accessibility-element
  s.notes = plan.reason || '';
  s.orientation = device === 'ipad' ? 'landscape' : 'portrait';
  // Hotspot i viewport-prosent (0–1) fra elementets ramme (x/y er sentrum).
  if (target && screenW > 0 && screenH > 0) {
    s.hotspot = {
      x: Math.max(0, (target.x - target.width / 2) / screenW),
      y: Math.max(0, (target.y - target.height / 2) / screenH),
      w: Math.min(1, target.width / screenW),
      h: Math.min(1, target.height / screenH),
    };
  }
  return s;
}

export interface IosWalkthroughResult {
  scenes: DemoScene[];
  warnings: string[];
}

/**
 * Kjør en autonom gjennomgang av appen `bundleId` i simulatoren `udid`.
 * Returnerer et storyboard (DemoScene[]) forankret i appens ekte skjermer.
 */
export async function runIosWalkthrough(
  udid: string,
  bundleId: string,
  opts: {
    device?: DemoDevice;
    goal?: string;
    maxSteps?: number;
    /** Sekunder å vente etter en navigasjon før neste skjermbilde. */
    settleMs?: number;
    onProgress?: WalkthroughProgress;
    /** Live: kalt med hvert skjermbilde (data-URL) mens vi utforsker. */
    onFrame?: (dataUrl: string) => void;
    /** Live: kalt når en ny scene er planlagt. */
    onScene?: (scene: DemoScene) => void;
  } = {},
): Promise<IosWalkthroughResult> {
  const { device = 'ipad', goal = '', maxSteps = 8, settleMs = 1400,
    onProgress = () => {}, onFrame, onScene } = opts;
  const warnings: string[] = [];
  const scenes: DemoScene[] = [];
  const history: string[] = [];       // scene-titler vi har besøkt
  const tappedLabels = new Set<string>(); // unngå å trykke samme element om igjen

  onProgress('Booter simulator…', 3);
  await iosSimBoot(udid);
  onProgress('Starter appen…', 8);
  await iosSimLaunch(udid, bundleId);
  await sleep(settleMs + 600); // la appen komme forbi splash

  for (let step = 0; step < maxSteps; step++) {
    const pct = 12 + Math.round((step / maxSteps) * 80);
    onProgress(`Utforsker skjerm ${step + 1}…`, pct);

    // 1) SE skjermen
    const shot = await iosSimScreenshot(udid).catch(() => null);
    if (!shot) { warnings.push('Klarte ikke å ta skjermbilde — avbryter.'); break; }
    onFrame?.(shot);

    // 2) FORSTÅ skjermen (accessibility-tre)
    let screen: Awaited<ReturnType<typeof iosSimDescribe>>;
    try {
      screen = await iosSimDescribe(udid);
    } catch (e) {
      // idb mangler eller feilet: uten treet kan vi ikke drive appen autonomt.
      throw new Error(
        `Autonom gjennomgang krever idb (Facebooks iOS Development Bridge). ${e instanceof Error ? e.message : ''}`.trim());
    }
    const els = screen.elements;
    if (!els.length) { warnings.push(`Skjerm ${step + 1}: fant ingen elementer i accessibility-treet.`); }

    // 3) PLANLEGG scene + neste navigasjon (vision + element-liste)
    const b64 = shot.replace(/^data:image\/\w+;base64,/, '');
    const userText =
      `MÅL: ${goal || 'Vis appens viktigste funksjoner i en kort demo.'}\n\n` +
      `Allerede besøkt: ${history.length ? history.join(' → ') : '(ingenting ennå)'}\n\n` +
      `TRYKKBARE ELEMENTER PÅ DENNE SKJERMEN:\n${fmtElements(els) || '(ingen)'}\n\n` +
      `Planlegg én scene for skjermen på bildet, og velg neste navigasjon. ` +
      `Ikke velg et element du allerede har trykket. Steg ${step + 1} av maks ${maxSteps}.`;

    let plan: ScenePlan | null = null;
    try {
      const resp = await invoke<ClaudeResp>('claude_chat', {
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
            { type: 'text', text: userText },
          ],
        }],
        system: SYSTEM,
        model: 'claude-opus-4-8',
        maxTokens: 1024,
        tools: [PLAN_TOOL],
      });
      const tool = resp.content.find((c) => c.type === 'tool_use' && c.name === 'plan_scene');
      if (tool?.input) plan = tool.input as unknown as ScenePlan;
    } catch (e) {
      warnings.push(`Scene ${step + 1}: AI-planlegging feilet (${e instanceof Error ? e.message : 'ukjent'}).`);
    }
    if (!plan) { warnings.push(`Scene ${step + 1}: ingen plan fra AI — avbryter.`); break; }

    // 4) Bygg scenen (hotspot fra mål-elementet) og legg til
    const targetEl = plan.next_action === 'tap' && plan.target_index >= 0 && plan.target_index < els.length
      ? els[plan.target_index] : null;
    const scene = toScene(scenes.length, device, plan, targetEl, screen.screenWidth, screen.screenHeight);
    scenes.push(scene);
    history.push(scene.title);
    onScene?.(scene);

    // 5) HANDLE for å komme til neste skjerm
    if (plan.next_action === 'done') { onProgress('Ferdig med gjennomgang.', 94); break; }
    if (plan.next_action === 'swipe_up' || plan.next_action === 'swipe_down') {
      const cx = screen.screenWidth / 2;
      const y1 = plan.next_action === 'swipe_up' ? screen.screenHeight * 0.7 : screen.screenHeight * 0.3;
      const y2 = plan.next_action === 'swipe_up' ? screen.screenHeight * 0.3 : screen.screenHeight * 0.7;
      await iosSimSwipe(udid, cx, y1, cx, y2).catch((e) => warnings.push(`Sveip feilet: ${e}`));
    } else if (targetEl) {
      if (targetEl.label) tappedLabels.add(targetEl.label);
      await iosSimTap(udid, targetEl.x, targetEl.y).catch((e) => warnings.push(`Tap feilet: ${e}`));
    } else {
      warnings.push(`Scene ${step + 1}: AI valgte «tap» uten gyldig mål — stopper.`);
      break;
    }
    await sleep(settleMs);
  }

  if (!scenes.length) throw new Error('Fant ingen skjermer å demonstrere — kjører appen i simulatoren?');
  onProgress('Storyboard klart!', 100);
  return { scenes, warnings };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

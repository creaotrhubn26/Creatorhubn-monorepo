/**
 * demoSessionActions — delte auto/verify-handlinger for den vedvarende
 * demo-økten (G22): Shell-ens innebygde recorder og GuidedRecorderView bruker
 * SAMME logikk, så «Verifiser»/«Kjør automatisk» ikke lenger bare finnes i én
 * av de to recorder-flatene.
 *
 * Opererer direkte på useDemoStudio-storen (ingen React); kalleren får utfall
 * + melding tilbake og bestemmer selv presentasjonen (alert/inline-tekst).
 */

import { useDemoStudio } from './demoStudioStore';
import { isCaptureAvailable, scanDom, sessionOpen, sessionExec, sessionVerify, sessionShot } from '../../services/demoCaptureService';
import { healTarget, verifyOutcomeVision } from './demoStudioAI';
import { sceneActionMatch, recordLearnedTarget } from './demoStudioModel';

export interface SessionActionResult {
  outcome: 'done' | 'healed' | 'needs_review' | 'cancelled' | 'unavailable' | 'no_target' | 'session_failed';
  /** Menneske-lesbar melding når det er noe å si (feil/heal/instruks). */
  message?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Auto-utfør gjeldende recorder-scenes handling i økten (multi-locators →
 * css-fallback), med AI-self-heal i SAMME økt ved brutt selector. Avanserer
 * til neste steg ved suksess.
 */
export async function sessionAutoRunCurrent(): Promise<SessionActionResult> {
  if (!isCaptureAvailable()) return { outcome: 'unavailable', message: 'Auto-utførelse krever Tauri-appen.' };
  const st = useDemoStudio.getState();
  const sc = st.project?.scenes[st.recorderStepIndex];
  if (!sc || !st.project) return { outcome: 'no_target' };
  if (!sc.targetSelector && !(sc.targetLocators?.length)) {
    return { outcome: 'no_target', message: 'Scenen mangler target-selector — bind elementet via AI Director eller capture først.' };
  }
  const { updateScene, nextStep } = st;
  if (!(await sessionOpen(st.project.url))) return { outcome: 'session_failed', message: 'Kunne ikke åpne demo-økt-vinduet.' };
  const advance = () => {
    const now = useDemoStudio.getState();
    if (now.recorderStepIndex < (now.project?.scenes.length ?? 0) - 1) nextStep();
  };
  const r = await sessionExec(sc.targetSelector ?? '', sc.actionType ?? 'click', undefined, sc.targetLocators);
  if (r?.ok && r.found) {
    updateScene(sc.id, { detectedSelector: r.selector || sc.targetSelector, status: 'done' });
    advance();
    return { outcome: 'done' };
  }
  if (r && !r.found) {
    // Self-healing: skann siden på nytt + la AI finne riktig element →
    // reparer og prøv igjen I SAMME ØKT (ingen omlasting av siden).
    const scan = await scanDom(st.project.url).catch(() => null);
    const els = scan?.elements ?? [];
    const idx = els.length ? await healTarget({ targetLabel: sc.targetLabel, actionType: sc.actionType, elements: els }).catch(() => null) : null;
    if (idx != null && els[idx]) {
      const el = els[idx];
      updateScene(sc.id, { targetSelector: el.selector, targetLocators: el.locators, targetLabel: el.label, hotspot: el.hotspot, startScrollPct: el.scrollPct != null ? Math.round(el.scrollPct * 100) : undefined });
      const r2 = await sessionExec(el.selector, sc.actionType ?? 'click', undefined, el.locators);
      if (r2?.ok && r2.found) {
        updateScene(sc.id, { detectedSelector: el.selector, status: 'done' });
        advance();
        return { outcome: 'healed', message: 'Selector var brutt — AI reparerte den automatisk og handlingen lyktes.' };
      }
      updateScene(sc.id, { status: 'needs_review' });
      return { outcome: 'needs_review', message: 'AI klarte ikke å reparere target. Scene merket «Needs Review».' };
    }
    updateScene(sc.id, { status: 'needs_review' });
    return { outcome: 'needs_review', message: 'Fant ikke elementet på siden. Scene merket «Needs Review».' };
  }
  if (r && !r.ok) {
    updateScene(sc.id, { status: 'needs_review' });
    return { outcome: 'needs_review', message: `Handlingen feilet på siden${r.error ? `: ${r.error}` : ''}. Scene merket «Needs Review».` };
  }
  return { outcome: 'needs_review', message: 'Ingen respons fra økt-vinduet.' };
}

/**
 * Verifiser gjeldende recorder-scene i økten: brukeren klikker elementet på
 * siden slik den ER nå → detectedSelector fylles → handlingen UTFØRES faktisk
 * → vision vurderer tilstanden ETTERPÅ (G6). Utfallet persisteres på scenen
 * (verifiedOutcome, G5) så valideringen bygger på virkelighet, ikke bare
 * selector-tekst. Lærer også riktig selector (brukerens klikk er fasit).
 */
export async function sessionVerifyCurrent(): Promise<SessionActionResult> {
  if (!isCaptureAvailable()) return { outcome: 'unavailable', message: 'Verifisering krever Tauri-appen.' };
  const st = useDemoStudio.getState();
  const sc = st.project?.scenes[st.recorderStepIndex];
  if (!sc || !st.project) return { outcome: 'no_target' };
  const { updateScene } = st;
  if (!(await sessionOpen(st.project.url))) return { outcome: 'session_failed', message: 'Kunne ikke åpne demo-økt-vinduet.' };
  const v = await sessionVerify(sc.targetLabel);
  if (!v || v.cancelled || !v.selector) return { outcome: 'cancelled' };

  // Vision-runtime-verifisering: utfør handlingen for ekte i økten, la
  // utfallet lande, og vis vision tilstanden ETTER handlingen.
  let visionOk: boolean | null = null;
  const expected = sc.validationRule || sc.targetLabel || sc.requiredAction;
  if (expected) {
    const ex = await sessionExec(v.selector, sc.actionType ?? 'click').catch(() => null);
    if (ex?.ok) {
      await sleep(1200);
      const shot = await sessionShot().catch(() => null);
      if (shot) { const o = await verifyOutcomeVision({ screenshot: shot, expected }).catch(() => null); if (o) visionOk = o.success; }
    }
  }
  const match = sceneActionMatch({ ...sc, detectedSelector: v.selector });
  const status = visionOk === false ? 'needs_review' : (match === 'match' || visionOk === true) ? 'done' : 'needs_review';
  updateScene(sc.id, {
    detectedSelector: v.selector, status, bindingConfidence: 'high',
    verifiedOutcome: visionOk === true ? 'ok' : visionOk === false ? 'failed' : undefined,
    verifiedAt: visionOk != null ? new Date().toISOString() : undefined,
  });
  // Lær av verifiseringen (A): det brukeren faktisk klikket er fasiten.
  // Avvik fra AI-ens gjetning → lær riktig selector + avvis den gamle.
  if (sc.targetLabel) {
    recordLearnedTarget(st.project.url, sc.targetLabel, {
      selector: v.selector, hotspot: sc.hotspot, source: 'manual',
      rejectSelector: sc.targetSelector && sc.targetSelector !== v.selector ? sc.targetSelector : undefined,
    });
  }
  return status === 'done'
    ? { outcome: 'done', message: visionOk === true ? '✓ Utfall verifisert med vision.' : '✓ Riktig element bekreftet.' }
    : { outcome: 'needs_review', message: visionOk === false ? 'Vision fant ikke forventet utfall etter handlingen — scene merket «Needs Review».' : 'Detektert element avviker fra forventet — scene merket «Needs Review».' };
}

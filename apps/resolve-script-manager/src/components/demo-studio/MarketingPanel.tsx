/**
 * MarketingPanel — Marketing mode for Product Demo Studio.
 *
 * Lar markedsføreren/innholdsprodusenten lage MÅLRETTET innhold i stedet for en
 * generisk feature-tur: AI forstår persona × funnel-steg × kanal × rammeverk.
 *   - Brief: AI auto-foreslår persona/smerte/verdi/funnel fra siden, brukeren justerer.
 *   - Marketing Director: rammeverk-drevet scene-flow med funnel-matchet CTA.
 *   - Variant-motor: samme demo i flere målrettede kutt (persona/kanal/vinkel).
 *   - Kanal-grammatikk: presets styrer format, lengde, tone, captions.
 *   - Lær min stemme (G): tommel opp/ned på manus → AI lærer produsentens tone.
 */
import { useRef, useState } from 'react';
import { isAiConnected } from '../../services/claudeProxyService';
import { scanDom, captureScreenshot, isCaptureAvailable } from '../../services/demoCaptureService';
import { useDemoStudio } from './demoStudioStore';
import {
  suggestMarketingBrief, generateMarketingFlow, generateVariants, fetchSiteContext,
  ocrDetectElements, analyzeProductEvidence, buildProductBrain, draftOnePager as aiDraftOnePager,
  gatherSiteContext, readScreenVision, critiqueOnePager, improveOnePager,
  type GeneratedVariant, type VariantSpec, type OnePagerCritique,
} from './demoStudioAI';
import {
  CHANNEL_PRESETS, FRAMEWORKS, FUNNEL_LABELS, emptyMarketingBrief, recordVoicePref,
  MARKETING_OBJECTIVES, applyObjectiveToBrief, BRAIN_KIND_LABELS, VERIFICATION_META,
  type MarketingBrief, type MarketingChannel, type MarketingFramework, type FunnelStage,
  type MarketingObjective, type ProductEvidence, type ProductBrain, type BrainNodeKind,
} from './demoStudioModel';

const C = {
  bg: '#f3efe9', panel: '#ffffff', cream: '#faf7f2', creamActive: '#f3ece2',
  line: '#ece7df', lineStrong: '#ddd6cc', ink: '#1d1b19', inkSoft: '#6b6358',
  inkFaint: '#9a9186', accent: '#ef8a5d', dark: '#3a2f2a', green: '#4a9d6b',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};
const btn: React.CSSProperties = { border: `1px solid ${C.lineStrong}`, background: '#fff', borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const field: React.CSSProperties = { width: '100%', border: `1px solid ${C.lineStrong}`, borderRadius: 8, padding: '8px 10px', fontSize: 12.5, color: C.ink, background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' };
const label: React.CSSProperties = { fontSize: 10.5, color: C.inkFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' };

const VARIANT_PRESETS: VariantSpec[] = [
  { label: 'Reels-kutt (9:16)', channel: 'reels', angle: 'rask hook + caption-vennlig' },
  { label: 'LinkedIn (B2B)', channel: 'linkedin', angle: 'autoritativ, ROI-vinkel' },
  { label: 'E-post', channel: 'email', angle: 'personlig, én CTA' },
  { label: 'Beslutter-vinkel', angle: 'fjern siste tvil, ROI + bevis' },
];

export function MarketingPanel({ onOpenSignIn }: { onOpenSignIn: () => void }) {
  const project = useDemoStudio((s) => s.project);
  const setProjectField = useDemoStudio((s) => s.setProjectField);
  const replaceScenes = useDemoStudio((s) => s.replaceScenes);

  const brief: MarketingBrief = project?.marketingBrief ?? emptyMarketingBrief();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<ProductEvidence | null>(null);
  const [onePager, setOnePager] = useState('');
  const [brain, setBrain] = useState<ProductBrain | null>(null);
  const [critique, setCritique] = useState<OnePagerCritique | null>(null);
  const [answers, setAnswers] = useState('');
  const visionCache = useRef<{ url: string; text: string } | null>(null);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(VARIANT_PRESETS.map((v) => [v.label, v.channel === 'reels'])),
  );

  if (!project) return <div style={{ padding: 24, color: C.inkSoft }}>Opprett en demo først.</div>;
  const aiReady = isAiConnected();
  const preset = CHANNEL_PRESETS[brief.channel];

  const patchBrief = (patch: Partial<MarketingBrief>) => setProjectField('marketingBrief', { ...brief, ...patch });
  const list = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);

  /** Skann siden én gang → elementer + kontekst + merkevare (delt av alle steg).
   *  vision=true legger på et vision-pass (Claude «ser» skjermbildet → tekst i
   *  bilder/grafikk) — cachet pr. URL så det ikke kjøres unødig flere ganger. */
  const scanContext = async (opts?: { vision?: boolean }) => {
    const scan = await scanDom(project.url).catch(() => null);
    let elements = scan?.elements ?? [];
    if (elements.length === 0 && isCaptureAvailable()) {
      const shot = await captureScreenshot(project.url).catch(() => null);
      if (shot) elements = await ocrDetectElements({ screenshot: shot }).catch(() => []);
    }
    // Fler-side-skann: berik forsiden med /pricing, /features, /about … for et
    // mye rikere grunnlag til one-pager + Product Brain.
    const gathered = await gatherSiteContext(project.url, { mainText: scan?.pageText, maxPages: 5 }).catch(() => null);
    let siteContext = gathered?.context || scan?.pageText || await fetchSiteContext(project.url).catch(() => '');
    const pagesScanned = gathered?.pages ?? [];
    // Vision-pass: fang tekst i bilder/grafikk DOM-scan mister (cachet pr. URL).
    if (opts?.vision && isCaptureAvailable()) {
      let vision = visionCache.current?.url === project.url ? visionCache.current.text : '';
      if (!vision) {
        const shot = await captureScreenshot(project.url).catch(() => null);
        if (shot) { vision = await readScreenVision({ screenshot: shot, url: project.url }).catch(() => ''); if (vision) visionCache.current = { url: project.url, text: vision }; }
      }
      if (vision) siteContext = `${siteContext}\n\n=== Vision (tekst i bilder/grafikk) ===\n${vision}`;
    }
    const branding = scan?.branding;
    // Auto-merkevare: hent navn/farge/logo fra siden og bruk på prosjektet (logo
    // + farger flyter inn i interaktiv guide + eksport) hvis ikke satt fra før.
    if (branding && (branding.brandName || branding.brandColor || branding.logoUrl)) {
      const cur = project.branding;
      if (!cur || (!cur.brandName && !cur.brandColor && !cur.logoUrl)) {
        setProjectField('branding', { brandName: branding.brandName || undefined, brandColor: branding.brandColor || undefined, logoUrl: branding.logoUrl || undefined });
      }
    }
    return { elements, siteContext, branding, pagesScanned };
  };

  const suggestBrief = async () => {
    if (!aiReady) return onOpenSignIn();
    setBusy('brief'); setMsg('AI analyserer siden og foreslår en brief…');
    try {
      const { elements, siteContext } = await scanContext();
      const s = await suggestMarketingBrief({ url: project.url, siteContext, elements });
      let next: MarketingBrief = { ...brief, ...s };
      // Foreslått mål → sett anbefalt metode/funnel/kanal (brukeren kan overstyre).
      if (s.objective) next = applyObjectiveToBrief(next, s.objective);
      patchBrief(next);
      setMsg('✓ Brief foreslått — juster og generér.');
    } catch (e) { setMsg('Feil: ' + (e as Error).message); }
    finally { setBusy(null); }
  };

  const draftOnePager = async () => {
    if (!aiReady) return onOpenSignIn();
    setBusy('draft'); setMsg('AI skriver et one-pager-utkast fra siden…');
    try {
      const { elements, siteContext, branding, pagesScanned } = await scanContext({ vision: true });
      let ev = evidence;
      if (!ev) { ev = await analyzeProductEvidence({ url: project.url, siteContext, elements }).catch(() => null); if (ev) setEvidence(ev); }
      const text = await aiDraftOnePager({ url: project.url, siteContext, elements, evidence: ev ?? undefined, branding });
      if (text) { setOnePager(text); setCritique(null); }
      setMsg(`✓ One-pager-utkast laget fra ${pagesScanned.length || 1} side${pagesScanned.length === 1 ? '' : 'r'}${pagesScanned.length > 1 ? ` (${pagesScanned.join(', ')})` : ''} + vision. Rediger eller «Vurder kvalitet».`);
    } catch (e) { setMsg('Feil: ' + (e as Error).message); }
    finally { setBusy(null); }
  };

  const critiqueDraft = async () => {
    if (!aiReady) return onOpenSignIn();
    if (!onePager.trim()) { setMsg('Lag eller lim inn en one-pager først.'); return; }
    setBusy('critique'); setMsg('AI vurderer kvaliteten på utkastet…');
    try {
      const c = await critiqueOnePager({ onePager, evidence: evidence ?? undefined, url: project.url });
      setCritique(c);
      setMsg(`✓ Kvalitet: ${c.score}/100 · ${c.weaknesses.length} svakheter · ${c.questions.length} spørsmål å besvare.`);
    } catch (e) { setMsg('Feil: ' + (e as Error).message); }
    finally { setBusy(null); }
  };

  const improveDraft = async () => {
    if (!aiReady || !critique) return;
    setBusy('improve'); setMsg('AI forbedrer utkastet…');
    try {
      const text = await improveOnePager({ onePager, critique, answers, evidence: evidence ?? undefined });
      if (text) { setOnePager(text); setCritique(null); setAnswers(''); }
      setMsg('✓ Utkast forbedret. Vurder på nytt eller «Bygg tankekart».');
    } catch (e) { setMsg('Feil: ' + (e as Error).message); }
    finally { setBusy(null); }
  };

  const buildBrain = async () => {
    if (!aiReady) return onOpenSignIn();
    if (!onePager.trim()) { setMsg('Lim inn one-pager-teksten først.'); return; }
    setBusy('brain'); setMsg('AI bygger tankekart og kryssverifiserer mot siden…');
    try {
      const { elements, siteContext } = await scanContext({ vision: true });
      let ev = evidence;
      if (!ev) { ev = await analyzeProductEvidence({ url: project.url, siteContext, elements }).catch(() => null); if (ev) setEvidence(ev); }
      const b = await buildProductBrain({ url: project.url, onePager, siteContext, elements, evidence: ev ?? undefined, objective: brief.objective });
      setBrain(b);
      const verified = b.nodes.filter((n) => n.status === 'verified').length;
      setMsg(`✓ Tankekart: ${verified} verifisert, ${b.gaps.length} gap, ${b.coveragePath.length} steg. Anbefalt: ${FRAMEWORKS[b.recommendedFramework].label.split(' (')[0]}.`);
    } catch (e) { setMsg('Feil: ' + (e as Error).message); }
    finally { setBusy(null); }
  };

  const applyBrainRecommendation = () => {
    if (!brain) return;
    let next = brain.recommendedObjective ? applyObjectiveToBrief(brief, brain.recommendedObjective) : { ...brief };
    next = { ...next, framework: brain.recommendedFramework };
    patchBrief(next);
    setMsg(`✓ Brukte anbefaling: ${FRAMEWORKS[brain.recommendedFramework].label.split(' (')[0]}${brain.recommendedObjective ? ` for ${MARKETING_OBJECTIVES[brain.recommendedObjective].label.toLowerCase()}` : ''}.`);
  };

  const analyzeProduct = async () => {
    if (!aiReady) return onOpenSignIn();
    setBusy('evidence'); setMsg('AI leser produktet inn i et bevis-inventar…');
    try {
      const { elements, siteContext } = await scanContext();
      const ev = await analyzeProductEvidence({ url: project.url, siteContext, elements });
      setEvidence(ev);
      setMsg(`✓ Produkt-forståelse: ${ev.features.length} funksjoner, ${ev.proof.length} bevis, ${ev.sections.length} seksjoner.`);
    } catch (e) { setMsg('Feil: ' + (e as Error).message); }
    finally { setBusy(null); }
  };

  const generate = async () => {
    if (!aiReady) return onOpenSignIn();
    if (!brief.persona.trim()) { setMsg('Fyll inn persona først (eller la AI foreslå en).'); return; }
    setBusy('flow'); setMsg(`Marketing Director lager ${preset.label}-demo (${FRAMEWORKS[brief.framework].label})…`);
    try {
      const { elements, siteContext } = await scanContext();
      // Sørg for at metoden festes til konkrete produktdeler (beat→bevis-binding).
      let ev = evidence;
      if (!ev) { ev = await analyzeProductEvidence({ url: project.url, siteContext, elements }).catch(() => null); if (ev) setEvidence(ev); }
      const coverageHint = brain?.coveragePath.map((c) => c.elementLabel ? `${c.label} (${c.elementLabel})` : c.label);
      const scenes = await generateMarketingFlow({ url: project.url, brief, devices: project.devices, elements, siteContext, meta: project.scriptMeta, evidence: ev ?? undefined, coverageHint });
      replaceScenes(scenes);
      setProjectField('format', preset.format);
      setProjectField('mode', 'marketing');
      setMsg(`✓ ${scenes.length} scener (${preset.label}, ${preset.format}). Åpne Script/Flow for å finpusse.`);
    } catch (e) { setMsg('Feil: ' + (e as Error).message); }
    finally { setBusy(null); }
  };

  const makeVariants = async () => {
    if (!aiReady) return onOpenSignIn();
    if (!project.scenes.length) { setMsg('Generér en marketing-demo først — så lager jeg varianter av den.'); return; }
    const specs = VARIANT_PRESETS.filter((v) => picked[v.label]);
    if (!specs.length) { setMsg('Velg minst én variant.'); return; }
    setBusy('variants'); setMsg(`Lager ${specs.length} målrettede varianter…`);
    try {
      const vs = await generateVariants({ url: project.url, baseScenes: project.scenes, brief, variants: specs });
      setVariants(vs);
      setMsg(`✓ ${vs.length} varianter klare. Bruk «Sett som aktiv» for å laste én inn.`);
    } catch (e) { setMsg('Feil: ' + (e as Error).message); }
    finally { setBusy(null); }
  };

  const useVariant = (v: GeneratedVariant) => {
    replaceScenes(v.scenes.map((s) => ({ ...s, id: s.id.replace(/__.*$/, '') })));
    if (v.format) setProjectField('format', v.format as typeof project.format);
    setMsg(`✓ Lastet variant «${v.label}» som aktiv flow.`);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px', fontFamily: C.font, color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Marketing mode</h2>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 7, background: '#fdeee6', color: C.accent, fontWeight: 600 }}>persona × funnel × kanal</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 6, marginBottom: 16, maxWidth: 620 }}>
        AI lager målrettet innhold som flytter én målgruppe ett funnel-steg på kanalens språk — ikke en generisk feature-tur.
      </p>

      {/* ── 0 · Product Brain (one-pager → verifisert tankekart) ── */}
      <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 16, maxWidth: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>0 · Product Brain</h3>
          <span style={{ fontSize: 11, color: C.inkFaint, marginLeft: 8 }}>— lim inn one-pager → AI kryssverifiserer mot siden</span>
          <div style={{ flex: 1 }} />
          <button style={{ ...btn, fontSize: 11.5, padding: '6px 10px', opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => void draftOnePager()}>
            {busy === 'draft' ? 'Skriver…' : 'Ingen one-pager? Lag utkast fra siden'}
          </button>
        </div>
        <textarea style={{ ...field, minHeight: 72, resize: 'vertical', marginBottom: 8 }} value={onePager}
          placeholder="Lim inn one-pager / produktbeskrivelse her — eller klikk «Lag utkast fra siden» så skriver AI et utkast du kan redigere."
          onChange={(e) => setOnePager(e.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => void buildBrain()}>
            {busy === 'brain' ? 'Bygger tankekart…' : '◈ Bygg tankekart + verifiser'}
          </button>
          <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy || !onePager.trim()} onClick={() => void critiqueDraft()}
            title="La AI score utkastet og peke på svakheter + spørsmål å besvare">
            {busy === 'critique' ? 'Vurderer…' : '★ Vurder kvalitet'}
          </button>
        </div>

        {critique && (
          <div style={{ marginTop: 12, border: `1px solid ${C.line}`, borderRadius: 9, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: `4px solid ${critique.score >= 75 ? C.green : critique.score >= 50 ? '#f59e0b' : '#ef4444'}`, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{critique.score}</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>Kvalitetsscore på one-pager-utkastet. Svar på spørsmålene under → «Forbedre med svar».</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
              {critique.strengths.length > 0 && (
                <div>
                  <div style={{ ...label, color: C.green }}>Styrker</div>
                  {critique.strengths.map((s, i) => <div key={i} style={{ fontSize: 11.5, color: C.ink, marginBottom: 2 }}>+ {s}</div>)}
                </div>
              )}
              {critique.weaknesses.length > 0 && (
                <div>
                  <div style={{ ...label, color: '#c4453b' }}>Svakheter</div>
                  {critique.weaknesses.map((s, i) => <div key={i} style={{ fontSize: 11.5, color: C.ink, marginBottom: 2 }}>− {s}</div>)}
                </div>
              )}
            </div>
            {critique.questions.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ ...label }}>Svar på dette så AI kan løfte utkastet</div>
                <ul style={{ margin: '2px 0 8px', paddingLeft: 18, fontSize: 11.5, color: C.inkSoft }}>
                  {critique.questions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
                <textarea style={{ ...field, minHeight: 56, resize: 'vertical', marginBottom: 8 }} value={answers}
                  placeholder="Skriv svarene her (pris, kunder, differensiering, ROI …)"
                  onChange={(e) => setAnswers(e.target.value)} />
              </div>
            )}
            <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => void improveDraft()}>
              {busy === 'improve' ? 'Forbedrer…' : '✦ Forbedre med svar'}
            </button>
          </div>
        )}

        {brain && (
          <div style={{ marginTop: 14 }}>
            {brain.summary && <div style={{ fontSize: 12.5, color: C.ink, marginBottom: 10 }}>{brain.summary}</div>}
            {/* Anbefalt metode */}
            <div style={{ background: '#fdeee6', border: `1px solid #f3d3c1`, borderRadius: 9, padding: '9px 11px', marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.dark }}>Anbefalt: {FRAMEWORKS[brain.recommendedFramework].label}{brain.recommendedObjective ? ` · ${MARKETING_OBJECTIVES[brain.recommendedObjective].label}` : ''}</div>
              {brain.reasoning && <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 3 }}>{brain.reasoning}</div>}
              <button style={{ ...btn, fontSize: 11.5, padding: '5px 10px', marginTop: 8 }} onClick={applyBrainRecommendation}>Bruk anbefaling</button>
            </div>
            {/* Verifiserte noder gruppert pr. type */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px,1fr))', gap: 12, marginBottom: 12 }}>
              {(Object.keys(BRAIN_KIND_LABELS) as BrainNodeKind[]).map((kind) => {
                const ns = brain.nodes.filter((n) => n.kind === kind);
                if (!ns.length) return null;
                return (
                  <div key={kind}>
                    <div style={{ ...label }}>{BRAIN_KIND_LABELS[kind]}</div>
                    {ns.map((n, i) => {
                      const m = VERIFICATION_META[n.status];
                      return (
                        <div key={i} style={{ fontSize: 11.5, color: C.ink, marginBottom: 3, display: 'flex', gap: 6 }}>
                          <span title={m.label} style={{ color: m.color, fontWeight: 700, width: 12, flexShrink: 0 }}>{m.icon}</span>
                          <span>{n.text}{n.matchedOn ? <span style={{ color: C.inkFaint }}> · {n.matchedOn}</span> : null}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {/* Dekningssti */}
            {brain.coveragePath.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...label }}>Hva vi må gjennom (dekningssti)</div>
                <ol style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 11.5, color: C.ink }}>
                  {brain.coveragePath.map((s, i) => <li key={i} style={{ marginBottom: 2 }}>{s.label}{s.elementLabel ? <span style={{ color: C.inkFaint }}> → {s.elementLabel}</span> : null}</li>)}
                </ol>
              </div>
            )}
            {/* Gap */}
            {brain.gaps.length > 0 && (
              <div style={{ background: '#fff8ec', border: '1px solid #f0d9a8', borderRadius: 9, padding: '8px 11px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#8a6516', marginBottom: 3 }}>Gap — hevdet i one-pager, ikke verifiserbart på siden:</div>
                {brain.gaps.map((g, i) => <div key={i} style={{ fontSize: 11.5, color: '#8a6516' }}>⚠ {g}</div>)}
              </div>
            )}
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, maxWidth: 900 }}>
        {/* ── Brief ── */}
        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>1 · Brief</h3>
            <div style={{ flex: 1 }} />
            <button style={{ ...btn, fontSize: 11.5, padding: '6px 10px', opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => void suggestBrief()}>
              {busy === 'brief' ? 'Analyserer…' : '✦ AI foreslå'}
            </button>
          </div>
          <label style={label}>Persona / ICP</label>
          <input style={{ ...field, marginBottom: 10 }} value={brief.persona} placeholder="f.eks. markedssjef i SMB-byrå"
            onChange={(e) => patchBrief({ persona: e.target.value })} />
          <label style={label}>Jobben de prøver å gjøre</label>
          <input style={{ ...field, marginBottom: 10 }} value={brief.jobToBeDone ?? ''} placeholder="f.eks. lage demoer raskere"
            onChange={(e) => patchBrief({ jobToBeDone: e.target.value })} />
          <label style={label}>Smertepunkter (én per linje)</label>
          <textarea style={{ ...field, marginBottom: 10, minHeight: 54, resize: 'vertical' }} value={brief.painPoints.join('\n')}
            onChange={(e) => patchBrief({ painPoints: list(e.target.value) })} />
          <label style={label}>Verdiløfter (én per linje)</label>
          <textarea style={{ ...field, marginBottom: 10, minHeight: 54, resize: 'vertical' }} value={brief.valueProps.join('\n')}
            onChange={(e) => patchBrief({ valueProps: list(e.target.value) })} />
          <label style={label}>Innvending å slå</label>
          <input style={{ ...field, marginBottom: 10 }} value={brief.objection ?? ''} placeholder="f.eks. «for dyrt / for vanskelig»"
            onChange={(e) => patchBrief({ objection: e.target.value })} />
          <label style={label}>Ønsket handling (CTA)</label>
          <input style={field} value={brief.desiredAction ?? ''} placeholder="f.eks. book demo"
            onChange={(e) => patchBrief({ desiredAction: e.target.value })} />
        </section>

        {/* ── Mål: funnel + kanal + rammeverk ── */}
        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>2 · Mål & kanal</h3>
          <label style={label}>Hva vil du oppnå? (velger metode automatisk)</label>
          <select style={{ ...field, marginBottom: 4 }} value={brief.objective ?? 'conversion'}
            onChange={(e) => patchBrief(applyObjectiveToBrief(brief, e.target.value as MarketingObjective))}>
            {(Object.keys(MARKETING_OBJECTIVES) as MarketingObjective[]).map((o) => (
              <option key={o} value={o}>{MARKETING_OBJECTIVES[o].label}</option>
            ))}
          </select>
          {brief.objective && <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 12 }}>{MARKETING_OBJECTIVES[brief.objective].description}. Anbefalt metode: {FRAMEWORKS[MARKETING_OBJECTIVES[brief.objective].framework].label.split(' (')[0]}.</div>}
          <label style={label}>Funnel-steg</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['tofu', 'mofu', 'bofu'] as FunnelStage[]).map((f) => (
              <button key={f} onClick={() => patchBrief({ funnelStage: f })}
                style={{ ...btn, flex: 1, justifyContent: 'center', fontSize: 11, padding: '7px 4px', background: brief.funnelStage === f ? C.accent : '#fff', color: brief.funnelStage === f ? '#fff' : C.ink, borderColor: brief.funnelStage === f ? C.accent : C.lineStrong }}>
                {FUNNEL_LABELS[f].replace(/ \(.*\)/, '')}
              </button>
            ))}
          </div>
          <label style={label}>Kanal (styrer format, lengde, tone)</label>
          <select style={{ ...field, marginBottom: 12 }} value={brief.channel}
            onChange={(e) => { const ch = e.target.value as MarketingChannel; patchBrief({ channel: ch, framework: CHANNEL_PRESETS[ch].framework }); }}>
            {(Object.keys(CHANNEL_PRESETS) as MarketingChannel[]).map((ch) => (
              <option key={ch} value={ch}>{CHANNEL_PRESETS[ch].label}</option>
            ))}
          </select>
          <label style={label}>Metode / rammeverk (dramaturgi)</label>
          <select style={{ ...field, marginBottom: 4 }} value={brief.framework}
            onChange={(e) => patchBrief({ framework: e.target.value as MarketingFramework })}>
            {(Object.keys(FRAMEWORKS) as MarketingFramework[]).map((fw) => (
              <option key={fw} value={fw}>{FRAMEWORKS[fw].label}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 12 }}>Best for: {FRAMEWORKS[brief.framework].bestFor}</div>
          <div style={{ background: C.cream, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
            <div><strong>{preset.label}</strong> · {preset.format} · ~{preset.maxSeconds}s · hook {preset.hookSeconds}s{preset.captions ? ' · captions' : ''}</div>
            <div style={{ marginTop: 4 }}>Beats: {FRAMEWORKS[brief.framework].beats.join(' → ')}</div>
          </div>
          <button style={{ ...btn, width: '100%', justifyContent: 'center', marginTop: 12, background: C.accent, color: '#fff', borderColor: C.accent, opacity: busy ? 0.6 : 1 }}
            disabled={!!busy} onClick={() => void generate()}>
            {busy === 'flow' ? 'Genererer…' : '▶ Generér markedsføringsdemo'}
          </button>
        </section>
      </div>

      {/* ── Produkt-forståelse: slik festes metoden til produktet ── */}
      <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginTop: 16, maxWidth: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Produkt-forståelse</h3>
          <span style={{ fontSize: 11, color: C.inkFaint, marginLeft: 8 }}>— hver metode-beat festes til en konkret del herfra</span>
          <div style={{ flex: 1 }} />
          <button style={{ ...btn, fontSize: 11.5, padding: '6px 10px', opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => void analyzeProduct()}>
            {busy === 'evidence' ? 'Leser…' : '✦ Analyser produktet'}
          </button>
        </div>
        {!evidence ? (
          <p style={{ fontSize: 12, color: C.inkSoft, margin: 0 }}>Kjør analysen (eller bare generér — den kjøres automatisk) så AI binder funksjoner, bevis og seksjoner til rammeverkets beats.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
            <div>
              <div style={{ ...label }}>Funksjoner ({evidence.features.length})</div>
              {evidence.features.slice(0, 6).map((f, i) => <div key={i} style={{ fontSize: 11.5, color: C.ink, marginBottom: 3 }}><strong>{f.name}</strong>{f.solves ? <span style={{ color: C.inkSoft }}> — {f.solves}</span> : null}</div>)}
            </div>
            <div>
              <div style={{ ...label }}>Bevis ({evidence.proof.length})</div>
              {evidence.proof.slice(0, 6).map((p, i) => <div key={i} style={{ fontSize: 11.5, color: C.ink, marginBottom: 3 }}>{p.claim} <span style={{ fontSize: 10, color: C.inkFaint }}>[{p.type}]</span></div>)}
              {!evidence.proof.length && <div style={{ fontSize: 11.5, color: C.inkFaint }}>Ingen bevis funnet — legg til tall/testimonials på siden for sterkere demoer.</div>}
            </div>
            <div>
              <div style={{ ...label }}>Seksjoner ({evidence.sections.length})</div>
              {evidence.sections.slice(0, 8).map((s, i) => <div key={i} style={{ fontSize: 11.5, color: C.ink, marginBottom: 3 }}>{s.label}</div>)}
            </div>
          </div>
        )}
      </section>

      {msg && <div style={{ fontSize: 12, color: msg.startsWith('Feil') ? '#c4453b' : C.inkSoft, margin: '14px 0 4px', maxWidth: 900 }}>{msg}</div>}

      {/* ── Variant-motor ── */}
      <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginTop: 16, maxWidth: 900 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>3 · Variant-motor</h3>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 12px' }}>Lag samme demo i flere målrettede kutt. Element-binding beholdes; kun budskap, hook og CTA endres.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {VARIANT_PRESETS.map((v) => (
            <button key={v.label} onClick={() => setPicked((p) => ({ ...p, [v.label]: !p[v.label] }))}
              style={{ ...btn, fontSize: 11.5, padding: '6px 11px', background: picked[v.label] ? C.creamActive : '#fff', borderColor: picked[v.label] ? C.accent : C.lineStrong }}>
              {picked[v.label] ? '✓ ' : ''}{v.label}
            </button>
          ))}
        </div>
        <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => void makeVariants()}>
          {busy === 'variants' ? 'Lager varianter…' : 'Generér valgte varianter'}
        </button>
        {variants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {variants.map((v) => (
              <div key={v.label} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>{v.label}</strong>
                  {v.format && <span style={{ fontSize: 10.5, color: C.inkFaint }}>{v.format}</span>}
                  <div style={{ flex: 1 }} />
                  <button style={{ ...btn, fontSize: 11.5, padding: '5px 10px' }} onClick={() => useVariant(v)}>Sett som aktiv</button>
                </div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
                  {v.scenes.slice(0, 3).map((s, i) => <div key={i}>· {s.narration.slice(0, 90)}</div>)}
                  {v.scenes.length > 3 && <div style={{ color: C.inkFaint }}>+{v.scenes.length - 3} scener til</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Lær min stemme (G) ── */}
      {project.scenes.some((s) => s.narration?.trim()) && (
        <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginTop: 16, maxWidth: 900 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>4 · Lær min stemme</h3>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 12px' }}>Tommel opp/ned på manuslinjer — AI lærer din tone og etterlikner den i nye demoer på {(() => { try { return new URL(project.url).host; } catch { return 'denne siden'; } })()}.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {project.scenes.filter((s) => s.narration?.trim()).slice(0, 8).map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 10px' }}>
                <div style={{ flex: 1, fontSize: 12, color: C.ink }}>{s.narration}</div>
                <button title="Lik denne tonen" style={{ ...btn, padding: '4px 11px', fontSize: 11.5, color: C.green }}
                  onClick={() => { recordVoicePref(project.url, s.narration, true); setMsg('✓ Lærte: AI vil etterlikne denne tonen.'); }}>Lik</button>
                <button title="Unngå denne tonen" style={{ ...btn, padding: '4px 11px', fontSize: 11.5, color: '#c4453b' }}
                  onClick={() => { recordVoicePref(project.url, s.narration, false); setMsg('✓ Lærte: AI vil unngå denne stilen.'); }}>Unngå</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

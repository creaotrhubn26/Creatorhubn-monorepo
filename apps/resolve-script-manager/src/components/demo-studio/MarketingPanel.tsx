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
import { useState } from 'react';
import { isAiConnected } from '../../services/claudeProxyService';
import { scanDom, captureScreenshot, isCaptureAvailable } from '../../services/demoCaptureService';
import { useDemoStudio } from './demoStudioStore';
import {
  suggestMarketingBrief, generateMarketingFlow, generateVariants, fetchSiteContext,
  ocrDetectElements, analyzeProductEvidence, type GeneratedVariant, type VariantSpec,
} from './demoStudioAI';
import {
  CHANNEL_PRESETS, FRAMEWORKS, FUNNEL_LABELS, emptyMarketingBrief, recordVoicePref,
  MARKETING_OBJECTIVES, applyObjectiveToBrief,
  type MarketingBrief, type MarketingChannel, type MarketingFramework, type FunnelStage,
  type MarketingObjective, type ProductEvidence,
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
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(VARIANT_PRESETS.map((v) => [v.label, v.channel === 'reels'])),
  );

  if (!project) return <div style={{ padding: 24, color: C.inkSoft }}>Opprett en demo først.</div>;
  const aiReady = isAiConnected();
  const preset = CHANNEL_PRESETS[brief.channel];

  const patchBrief = (patch: Partial<MarketingBrief>) => setProjectField('marketingBrief', { ...brief, ...patch });
  const list = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);

  /** Skann siden én gang → elementer + kontekst (delt av brief + flow). */
  const scanContext = async () => {
    const scan = await scanDom(project.url).catch(() => null);
    let elements = scan?.elements ?? [];
    if (elements.length === 0 && isCaptureAvailable()) {
      const shot = await captureScreenshot(project.url).catch(() => null);
      if (shot) elements = await ocrDetectElements({ screenshot: shot }).catch(() => []);
    }
    const siteContext = scan?.pageText || await fetchSiteContext(project.url).catch(() => '');
    return { elements, siteContext };
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
      const scenes = await generateMarketingFlow({ url: project.url, brief, devices: project.devices, elements, siteContext, meta: project.scriptMeta, evidence: ev ?? undefined });
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

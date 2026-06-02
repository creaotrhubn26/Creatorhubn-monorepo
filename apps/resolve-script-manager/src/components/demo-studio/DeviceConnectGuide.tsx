/**
 * DeviceConnectGuide — animert bruksanvisning for å koble til iPhone/iPad og
 * ta opp en app (inkl. App Store-apper) via USB.
 *
 * Rene CSS-keyframe-animasjoner (ingen avhengigheter): en USB-kabel som
 * "plugges inn", en enhet som dukker opp + lyser opp, og en "Stol på"-dialog.
 * Vises som overlay fra capture-velgeren når brukeren trenger hjelp.
 *
 * Steg (spec: App Store-app → kablet enhet → AVFoundation-opptak):
 *   1. Koble enheten til Mac med USB-kabel
 *   2. Lås opp + trykk "Stol på denne maskinen"
 *   3. Velg enheten som capture-kilde → ta opp appen
 */

import { useState } from 'react';

const C = {
  bg: 'rgba(20,18,16,0.55)', panel: '#ffffff', cream: '#faf7f2', line: '#eae5dd',
  ink: '#1d1b19', inkSoft: '#6b6358', inkFaint: '#9a9186', accent: '#ef8a5d', dark: '#2f2a26', green: '#4a9d6b',
  device: '#2a2a2e', screen: '#0e1830',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};

const KEYFRAMES = `
@keyframes dcg-cable { 0%,100% { transform: translateX(-14px); } 50% { transform: translateX(0); } }
@keyframes dcg-glow  { 0%,100% { box-shadow: 0 0 0 0 rgba(239,138,93,0); } 50% { box-shadow: 0 0 0 6px rgba(239,138,93,0.25); } }
@keyframes dcg-screen { 0% { opacity:0.25; } 50% { opacity:1; } 100% { opacity:0.25; } }
@keyframes dcg-trust { 0%,60% { opacity:0; transform: translateY(6px) scale(0.96); } 75%,100% { opacity:1; transform: translateY(0) scale(1); } }
@keyframes dcg-check { 0%,70% { opacity:0; transform: scale(0.6); } 85%,100% { opacity:1; transform: scale(1); } }
@keyframes dcg-pulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
@keyframes dcg-flow  { 0% { transform: translateX(0); opacity:0; } 30% { opacity:1; } 100% { transform: translateX(34px); opacity:0; } }
`;

type DeviceKind = 'iphone' | 'ipad';

/** Animert enhet + kabel for ett steg. */
function ConnectAnim({ device, step, connector }: { device: DeviceKind; step: number; connector: 'usbc' | 'lightning' }) {
  const isPad = device === 'ipad';
  const w = isPad ? 96 : 62;
  const h = isPad ? 130 : 128;
  const connected = step >= 1;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, gap: 0 }}>
      {/* Mac (venstre) */}
      <div style={{ width: 150, height: 96, borderRadius: '10px 10px 0 0', background: C.device, border: `3px solid ${C.device}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 4, borderRadius: 6, background: C.screen, display: 'grid', placeItems: 'center' }}>
          {connected && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: 'dcg-screen 2s ease-in-out infinite' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: C.accent, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 13 }}>▶</div>
              <div style={{ fontSize: 7, color: '#9fb3d9' }}>Demo Studio</div>
            </div>
          )}
        </div>
      </div>
      {/* Mac base */}
      <div style={{ position: 'absolute', left: 'calc(50% - 96px)', top: 132, width: 168, height: 8, background: '#3a352f', borderRadius: '0 0 8px 8px' }} />

      {/* Kabel */}
      <div style={{ position: 'relative', width: 46, height: 6, margin: '0 -2px' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: '#cbc6bf', borderRadius: 3, animation: connected ? 'none' : 'dcg-cable 1.6s ease-in-out infinite' }} />
        {/* Datastrøm-prikker når tilkoblet */}
        {connected && [0, 1, 2].map((i) => (
          <span key={i} style={{ position: 'absolute', top: 1, left: 4, width: 4, height: 4, borderRadius: '50%', background: C.accent, animation: `dcg-flow 1.4s linear ${i * 0.45}s infinite` }} />
        ))}
        {/* Plugg-form på enhets-enden: USB-C = bredt avrundet, Lightning = smalt */}
        <div style={{ position: 'absolute', top: connector === 'usbc' ? 0 : 1, right: -1,
          width: connector === 'usbc' ? 12 : 9, height: connector === 'usbc' ? 6 : 4,
          borderRadius: connector === 'usbc' ? 3 : 2, background: '#8a857d' }} />
      </div>

      {/* iPhone/iPad (høyre) */}
      <div style={{ width: w, height: h, borderRadius: isPad ? 12 : 14, background: C.device, padding: 4, position: 'relative', animation: connected ? 'dcg-glow 2s ease-in-out infinite' : 'none' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: isPad ? 9 : 11, background: C.screen, position: 'relative', overflow: 'hidden', opacity: connected ? 1 : 0.4 }}>
          {/* Notch/island */}
          {!isPad && <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', width: 22, height: 6, borderRadius: 4, background: '#000' }} />}
          {/* App-innhold */}
          {connected && (
            <div style={{ position: 'absolute', inset: 0, padding: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ height: 14, borderRadius: 3, background: 'linear-gradient(90deg,#3b5bdb,#6e8bef)' }} />
              <div style={{ height: 6, width: '70%', borderRadius: 2, background: '#2a3a5c' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginTop: 2 }}>
                {[0,1,2,3].map(i => <div key={i} style={{ height: 18, borderRadius: 3, background: '#1c2a45' }} />)}
              </div>
            </div>
          )}
          {/* "Stol på"-dialog på steg 2 */}
          {step === 2 && (
            <div style={{ position: 'absolute', inset: '20% 12%', background: '#fff', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, animation: 'dcg-trust 2.4s ease-in-out infinite' }}>
              <div style={{ fontSize: 6.5, fontWeight: 700, color: '#111', textAlign: 'center' }}>Stol på denne maskinen?</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 4, padding: '1px 8px' }}>Stol på</div>
            </div>
          )}
          {/* Grønt sjekk på steg 3 */}
          {step >= 3 && (
            <div style={{ position: 'absolute', bottom: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: C.green, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9, animation: 'dcg-check 2s ease-in-out infinite' }}>✓</div>
          )}
        </div>
      </div>
    </div>
  );
}

type Connector = 'usbc' | 'lightning';
const CONNECTOR_LABEL: Record<Connector, string> = { usbc: 'USB-C', lightning: 'Lightning' };

function buildSteps(device: DeviceKind, connector: Connector) {
  const cable = device === 'ipad' ? 'USB-C-kabel' : `${CONNECTOR_LABEL[connector]}-kabel`;
  const macEnd = 'USB-C-porten på Mac-en';
  return [
    { title: `1. Koble til med ${device === 'ipad' ? 'USB-C' : CONNECTOR_LABEL[connector]}`,
      body: `Bruk en ${cable}: enheten i den ene enden, ${macEnd} i den andre.${device === 'iphone' && connector === 'lightning' ? ' (eldre iPhone bruker Lightning — trenger Lightning-til-USB-C-kabel eller adapter.)' : ''}` },
    { title: '2. Trykk «Stol på»', body: 'Lås opp enheten. Når «Stol på denne maskinen?» dukker opp, trykk Stol på (og skriv kode hvis du blir bedt om det).' },
    { title: '3. Velg enheten + ta opp', body: 'Enheten dukker opp i capture-velgeren. Velg den, åpne appen din (også App Store-apper), og trykk Record.' },
  ];
}

export function DeviceConnectGuide({ onClose }: { onClose: () => void }) {
  const [device, setDevice] = useState<DeviceKind>('iphone');
  const [connector, setConnector] = useState<Connector>('usbc');
  const [step, setStep] = useState(1);
  const STEPS = buildSteps(device, device === 'ipad' ? 'usbc' : connector);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: C.bg, display: 'grid', placeItems: 'center', zIndex: 100, fontFamily: C.font }}>
      <style>{KEYFRAMES}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '92vw', background: C.panel, borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.35)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.line}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Koble til iPhone / iPad via USB-C</div>
            <div style={{ fontSize: 12, color: C.inkFaint }}>Ta opp en app — også apper fra App Store</div>
          </div>
          <div style={{ flex: 1 }} />
          {/* Device-toggle */}
          <div style={{ display: 'flex', gap: 4, border: `1px solid ${C.line}`, borderRadius: 9, padding: 3, marginRight: 10 }}>
            {(['iphone', 'ipad'] as DeviceKind[]).map((d) => (
              <div key={d} onClick={() => setDevice(d)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: device === d ? C.cream : 'transparent', color: device === d ? C.ink : C.inkFaint, fontWeight: device === d ? 600 : 400 }}>
                {d === 'iphone' ? 'iPhone' : 'iPad'}
              </div>
            ))}
          </div>
          <div onClick={onClose} style={{ cursor: 'pointer', color: C.inkFaint, fontSize: 18 }}>✕</div>
        </div>

        {/* Animasjon */}
        <div style={{ background: 'linear-gradient(180deg,#f6f3ee,#efe9e0)', padding: '24px 20px' }}>
          <ConnectAnim device={device} step={step} connector={device === 'ipad' ? 'usbc' : connector} />
        </div>

        {/* Kontakt-valg (kun iPhone; iPad er alltid USB-C) */}
        {device === 'iphone' && step === 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px 0' }}>
            <span style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>Kontakt:</span>
            {(['usbc', 'lightning'] as Connector[]).map((cn) => (
              <div key={cn} onClick={() => setConnector(cn)}
                style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: `1px solid ${connector === cn ? C.accent : C.line}`, background: connector === cn ? C.cream : '#fff', color: connector === cn ? C.ink : C.inkSoft, fontWeight: connector === cn ? 600 : 400 }}>
                {CONNECTOR_LABEL[cn]}
              </div>
            ))}
            <span style={{ fontSize: 10.5, color: C.inkFaint }}>{connector === 'usbc' ? 'iPhone 15 og nyere' : 'iPhone 14 og eldre'}</span>
          </div>
        )}

        {/* Steg-tekst + navigasjon */}
        <div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{STEPS[step - 1].title}</div>
          <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, minHeight: 40 }}>{STEPS[step - 1].body}</div>

          {/* Prikker */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '14px 0' }}>
            {STEPS.map((_, i) => (
              <span key={i} onClick={() => setStep(i + 1)} style={{ width: i === step - 1 ? 18 : 7, height: 7, borderRadius: 4, background: i === step - 1 ? C.accent : '#ddd6cc', cursor: 'pointer', transition: 'all .2s' }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}
              style={{ ...outlineBtn, opacity: step === 1 ? 0.5 : 1 }}>← Forrige</button>
            <div style={{ flex: 1 }} />
            {step < STEPS.length ? (
              <button onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))} style={primaryBtn}>Neste →</button>
            ) : (
              <button onClick={onClose} style={primaryBtn}>✓ Skjønner</button>
            )}
          </div>

          {/* Feilsøk-hint */}
          <div style={{ marginTop: 14, fontSize: 11, color: C.inkFaint, lineHeight: 1.5, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
            Ser du ikke enheten? Lås den opp, prøv en annen kabel/port, og bekreft «Stol på» på selve enheten. App Store-apper tas opp på en ekte enhet — ikke i simulatoren.
          </div>
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = { background: 'linear-gradient(135deg,#ef8a5d,#d96a3a)', border: 0, color: '#fff', fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 9, cursor: 'pointer' };
const outlineBtn: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, color: C.ink, fontSize: 13, padding: '9px 16px', borderRadius: 9, cursor: 'pointer' };

export default DeviceConnectGuide;

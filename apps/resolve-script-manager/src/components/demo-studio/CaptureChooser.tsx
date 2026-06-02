/**
 * CaptureChooser — Cover Flow-velger for opptaks-mål.
 *
 * Tre device-kort (Mac / iPad / iPhone) i 3D-perspektiv: det valgte står rett
 * mot deg, de andre er vippet bortover (svivel). Klikk et sidekort eller bruk
 * pilene → kortene glir sidelengs og den nye snurrer frem til midten — som å
 * bytte app på iPhone (Cover Flow / App Switcher).
 *
 * Bruker de ekte device-ramme-PNG-ene (DEVICE_FRAMES). Velger man Mac →
 * skrivebordsapp; iPad/iPhone → mobilapp. onChoose gir valgt variant videre.
 */

import { useState } from 'react';
import { DEVICE_FRAMES, type FrameVariant } from './deviceFrames';

const C = {
  bg: '#0e0c0b', panel: '#161412', ink: '#f2ede6', inkSoft: '#b7b0a6', inkFaint: '#7c756b',
  accent: '#ef8a5d', accentDk: '#d96a3a', line: '#2a2724',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};

interface CardDef {
  variant: FrameVariant;
  title: string;
  kind: string;       // hva slags app
  sub: string;
}
const CARDS: CardDef[] = [
  { variant: 'macbook', title: 'Mac', kind: 'Skrivebordsapp', sub: 'Nettside eller desktop-app' },
  { variant: 'ipad', title: 'iPad', kind: 'Mobilapp', sub: 'iPad-app, også fra App Store' },
  { variant: 'iphone', title: 'iPhone', kind: 'Mobilapp', sub: 'iPhone-app, også fra App Store' },
];

export function CaptureChooser({ onChoose, onClose }: {
  onChoose: (variant: FrameVariant) => void;
  onClose?: () => void;
}) {
  const [active, setActive] = useState(0); // 0=mac, 1=ipad, 2=iphone
  const go = (dir: -1 | 1) => setActive((a) => Math.min(CARDS.length - 1, Math.max(0, a + dir)));

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, display: 'flex', flexDirection: 'column', zIndex: 90, fontFamily: C.font, color: C.ink }}>
      {/* Topp */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Hva vil du ta opp?</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2 }}>Velg enhet — bla med pilene eller klikk et kort.</div>
        </div>
        <div style={{ flex: 1 }} />
        {onClose && <div onClick={onClose} style={{ cursor: 'pointer', color: C.inkFaint, fontSize: 22 }}>✕</div>}
      </div>

      {/* Cover Flow-scene */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 1400, overflow: 'hidden' }}>
        {/* Pil venstre */}
        <button onClick={() => go(-1)} disabled={active === 0}
          style={{ ...navBtn, left: 28, opacity: active === 0 ? 0.25 : 1 }}>‹</button>

        <div style={{ position: 'relative', width: 520, height: 460, transformStyle: 'preserve-3d' }}>
          {CARDS.map((card, i) => {
            const offset = i - active;          // -1 venstre, 0 midt, +1 høyre
            const abs = Math.abs(offset);
            const isActive = offset === 0;
            // Cover Flow-transform: sidekort skyves ut + vippes bortover.
            const tx = offset * 230;
            const rotY = offset === 0 ? 0 : (offset < 0 ? 42 : -42);
            const tz = isActive ? 60 : -120 - (abs - 1) * 80;
            const scale = isActive ? 1 : 0.82;
            return (
              <div key={card.variant}
                onClick={() => (isActive ? onChoose(card.variant) : setActive(i))}
                style={{
                  position: 'absolute', left: '50%', top: 0, width: 260, marginLeft: -130,
                  transform: `translateX(${tx}px) translateZ(${tz}px) rotateY(${rotY}deg) scale(${scale})`,
                  transition: 'transform .5s cubic-bezier(.22,.61,.36,1), opacity .4s',
                  opacity: abs > 1 ? 0 : 1,
                  cursor: 'pointer', zIndex: 10 - abs,
                  filter: isActive ? 'none' : 'brightness(.6)',
                }}>
                <DeviceCard card={card} active={isActive} />
              </div>
            );
          })}
        </div>

        {/* Pil høyre */}
        <button onClick={() => go(1)} disabled={active === CARDS.length - 1}
          style={{ ...navBtn, right: 28, opacity: active === CARDS.length - 1 ? 0.25 : 1 }}>›</button>
      </div>

      {/* Bunn: info + velg-knapp + prikker */}
      <div style={{ padding: '0 24px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: C.accent, fontWeight: 700 }}>{CARDS[active].kind}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{CARDS[active].title}</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 2, marginBottom: 18 }}>{CARDS[active].sub}</div>
        <button onClick={() => onChoose(CARDS[active].variant)}
          style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDk})`, border: 0, color: '#fff', fontSize: 14, fontWeight: 600, padding: '12px 30px', borderRadius: 10, cursor: 'pointer' }}>
          Velg {CARDS[active].title} →
        </button>
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginTop: 20 }}>
          {CARDS.map((_, i) => (
            <span key={i} onClick={() => setActive(i)}
              style={{ width: i === active ? 22 : 8, height: 8, borderRadius: 4, background: i === active ? C.accent : '#3a352f', cursor: 'pointer', transition: 'all .3s' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Ett device-kort med ekte ramme-PNG + glød/sokkel når aktivt. */
function DeviceCard({ card, active }: { card: CardDef; active: boolean }) {
  const f = DEVICE_FRAMES[card.variant];
  // Normaliser høyde så alle kort er omtrent like høye i scenen.
  const targetH = card.variant === 'macbook' ? 200 : 320;
  const w = targetH * f.aspect;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: w, height: targetH,
        filter: active
          ? `drop-shadow(0 30px 50px rgba(0,0,0,.6)) drop-shadow(0 0 0 rgba(239,138,93,.0))`
          : 'drop-shadow(0 18px 30px rgba(0,0,0,.5))',
      }}>
        {/* Skjerm-glød i aktivt kort */}
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div style={{
            position: 'absolute',
            left: `${f.screen.x * 100}%`, top: `${f.screen.y * 100}%`,
            width: `${f.screen.w * 100}%`, height: `${f.screen.h * 100}%`,
            borderRadius: `${f.radius * 100}%`,
            background: active
              ? `linear-gradient(150deg, ${C.accent}, ${C.accentDk})`
              : '#1a1a1f',
          }} />
          <img src={f.src} alt={card.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 30,
  width: 48, height: 48, borderRadius: '50%', border: `1px solid ${C.line}`,
  background: 'rgba(255,255,255,0.06)', color: C.ink, fontSize: 26, lineHeight: '44px',
  cursor: 'pointer', backdropFilter: 'blur(8px)',
};

export default CaptureChooser;

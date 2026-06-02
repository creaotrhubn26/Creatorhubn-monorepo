/**
 * CaptureChooser — velg opptaks-mål (åpnes inne i Guided Recorder).
 *
 * Tre enheter side om side med GOD PLASS (ikke overlappende). Hover løfter
 * enheten opp, viser en speilrefleksjon under, og en tittel ("Skrivebordsapp"
 * etc.) over enheten. Klikk velger. Ingen svivel — ren, rolig hover-effekt.
 *
 * Bruker de ekte device-ramme-PNG-ene (DEVICE_FRAMES).
 */

import { useState } from 'react';
import { DEVICE_FRAMES, type FrameVariant } from './deviceFrames';

const C = {
  bg: '#0e0c0b', ink: '#f2ede6', inkSoft: '#b7b0a6', inkFaint: '#7c756b',
  accent: '#ef8a5d', accentDk: '#d96a3a', line: '#2a2724',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Inter, sans-serif',
};

interface CardDef { variant: FrameVariant; title: string; kind: string; sub: string }
const CARDS: CardDef[] = [
  { variant: 'macbook', title: 'Mac', kind: 'Skrivebordsapp', sub: 'Nettside eller desktop-app' },
  { variant: 'ipad', title: 'iPad', kind: 'Mobilapp', sub: 'iPad-app, også fra App Store' },
  { variant: 'iphone', title: 'iPhone', kind: 'Mobilapp', sub: 'iPhone-app, også fra App Store' },
];

export function CaptureChooser({ onChoose, onClose }: {
  onChoose: (variant: FrameVariant) => void;
  onClose?: () => void;
}) {
  const [hover, setHover] = useState<FrameVariant | null>(null);

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, display: 'flex', flexDirection: 'column', zIndex: 90, fontFamily: C.font, color: C.ink }}>
      {/* Topp */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '24px 28px' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Hva vil du ta opp?</div>
          <div style={{ fontSize: 13.5, color: C.inkSoft, marginTop: 3 }}>Velg enheten du vil lage demoen for.</div>
        </div>
        <div style={{ flex: 1 }} />
        {onClose && <div onClick={onClose} style={{ cursor: 'pointer', color: C.inkFaint, fontSize: 24 }}>✕</div>}
      </div>

      {/* Tre enheter med god plass */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, padding: '0 60px 40px' }}>
        {CARDS.map((card) => (
          <DeviceChoice key={card.variant} card={card}
            hovered={hover === card.variant} dim={hover !== null && hover !== card.variant}
            onHover={(on) => setHover(on ? card.variant : null)}
            onClick={() => onChoose(card.variant)} />
        ))}
      </div>
    </div>
  );
}

/** Én enhet: tittel over, ekte ramme, refleksjon under, løft ved hover. */
function DeviceChoice({ card, hovered, dim, onHover, onClick }: {
  card: CardDef; hovered: boolean; dim: boolean;
  onHover: (on: boolean) => void; onClick: () => void;
}) {
  const f = DEVICE_FRAMES[card.variant];
  // Normaliser så alle blir omtrent like høye.
  const targetH = card.variant === 'macbook' ? 240 : 360;
  const w = targetH * f.aspect;

  return (
    <div
      onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: 'pointer', transition: 'opacity .3s', opacity: dim ? 0.45 : 1,
      }}
    >
      {/* Tittel over enheten */}
      <div style={{ textAlign: 'center', marginBottom: 18, transition: 'transform .35s, opacity .35s', transform: hovered ? 'translateY(0)' : 'translateY(8px)', opacity: hovered ? 1 : 0.7 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, color: C.accent, fontWeight: 700 }}>{card.kind}</div>
        <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{card.title}</div>
      </div>

      {/* Enhet (løftes ved hover) */}
      <div style={{
        width: w, height: targetH, position: 'relative',
        transition: 'transform .35s cubic-bezier(.22,.61,.36,1), filter .35s',
        transform: hovered ? 'translateY(-14px)' : 'translateY(0)',
        filter: hovered
          ? 'drop-shadow(0 40px 40px rgba(0,0,0,.55))'
          : 'drop-shadow(0 22px 30px rgba(0,0,0,.45))',
      }}>
        <img src={f.src} alt={card.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        {/* Brand-glød i skjermen ved hover (over rammen, klippet til skjerm-hullet) */}
        <div style={{
          position: 'absolute',
          left: `${f.screen.x * 100}%`, top: `${f.screen.y * 100}%`,
          width: `${f.screen.w * 100}%`, height: `${f.screen.h * 100}%`,
          borderRadius: `${f.radius * 100}%`,
          background: `linear-gradient(150deg, ${C.accent}, ${C.accentDk})`,
          opacity: hovered ? 1 : 0, transition: 'opacity .35s',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Speilrefleksjon under (sterkere ved hover) */}
      <div style={{
        width: w, height: targetH * 0.42, marginTop: 4, position: 'relative',
        transform: 'scaleY(-1)',
        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,.5), transparent 70%)',
        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,.5), transparent 70%)',
        opacity: hovered ? 0.5 : 0.22, transition: 'opacity .35s',
        pointerEvents: 'none',
      }}>
        <img src={f.src} alt="" style={{ width: '100%', height: 'auto' }} />
      </div>

      {/* Velg-knapp viser seg ved hover */}
      <button style={{
        marginTop: 6, background: `linear-gradient(135deg, ${C.accent}, ${C.accentDk})`,
        border: 0, color: '#fff', fontSize: 13, fontWeight: 600, padding: '9px 22px',
        borderRadius: 9, cursor: 'pointer',
        transition: 'opacity .3s, transform .3s',
        opacity: hovered ? 1 : 0, transform: hovered ? 'translateY(0)' : 'translateY(-6px)',
      }}>
        Velg {card.title} →
      </button>
    </div>
  );
}

export default CaptureChooser;

/**
 * LeadgridExperience.tsx — POV scroll-film for Leadgrid-landingssiden.
 *
 * «Feltet er grid-et.» En førsteperson-reise der du flyr gjennom et
 * rutenett av leads mens ekte app-skjermer (fanget fra iPad-simulatoren)
 * og fal.ai-genererte felt-scener veksler, scene for scene, drevet av
 * scroll-posisjon.
 *
 * Hybrid: fal.ai-cinematics (full-bleed felt/klokke/POV) blandet med ekte
 * app-skjermbilder i en 3D-tiltet iPad + animerte elementer (pulsende
 * pins, glødende grid som beveger seg mot deg) på topp.
 *
 * Ingen MUI — ren CSS + framer-motion for ytelse og selvstendighet.
 * Assets: /leadgrid/scenes/*.png (fal.ai) + /leadgrid/app/*.png (ekte app).
 */

import { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  type MotionValue,
} from 'framer-motion';

const P = {
  bg: '#05010f',
  accent: '#A78BFA',
  accentBright: '#C084FC',
  magenta: '#E879F9',
  text: '#F4F0FF',
  muted: 'rgba(244,240,255,0.66)',
};

type SceneKind = 'cinematic' | 'device';

interface Scene {
  id: string;
  kind: SceneKind;
  image: string;
  eyebrow?: string;
  title: string;
  body: string;
  align?: 'left' | 'center' | 'right';
  /** Skjermbildet er liggende iPad (bredere enhet i scenen). */
  landscape?: boolean;
}

// ── Manus: rekkefølgen du flyr gjennom ────────────────────────────────
const SCENES: Scene[] = [
  {
    id: 'intro', kind: 'cinematic', image: '/leadgrid/scenes/field-intro-1.png',
    eyebrow: 'Leadgrid', title: 'Feltet ditt er et grid.',
    body: 'Hver dør en mulighet. Leadgrid gjør nabolaget til et levende rutenett av leads — og du beveger deg gjennom det.',
    align: 'left',
  },
  {
    id: 'kart', kind: 'device', image: '/leadgrid/app/kart.png',
    eyebrow: 'Kartet', title: 'Se hele territoriet.',
    body: 'Alle leads på kartet, farget etter temperatur. Trykk en pin — hele historikken folder seg ut.',
    align: 'left',
  },
  {
    id: 'leads', kind: 'device', image: '/leadgrid/app/leads.png',
    eyebrow: 'Leads', title: '1 248 leads. Rangert av seg selv.',
    body: 'Lead-score løfter de varmeste øverst, med eier, verdi og neste steg klart.',
    align: 'right',
  },
  {
    id: 'moter', kind: 'device', image: '/leadgrid/app/moter.png',
    eyebrow: 'Møter', title: 'Dagen er planlagt for deg.',
    body: 'Agenda, kjørerute og AI-innsikt for hvert møte — klart før du går ut døra.',
    align: 'left',
  },
  {
    id: 'watch', kind: 'cinematic', image: '/leadgrid/scenes/watch-glance.png',
    eyebrow: 'Ute i feltet', title: 'Et blikk på håndleddet.',
    body: 'Ny lead tildelt deg — rett på Apple Watch. Du trenger aldri stoppe opp midt i feltet.',
    align: 'right',
  },
  {
    id: 'dorsalg', kind: 'device', image: '/leadgrid/app/dorsalg.png',
    eyebrow: 'Dørsalg & verving', title: 'Hver dør. Én farge.',
    body: 'Dørsalg-modus henter alle adressene i området og fargelegger dem etter utfall — vunnet, ikke hjemme, avslått. Registrer salget på døra, ferdig.',
    align: 'left', landscape: true,
  },
  {
    id: 'kvalitet', kind: 'device', image: '/leadgrid/app/kvalitet.png',
    eyebrow: 'Kvalitet', title: 'Hvert salg verifiseres.',
    body: 'Egen verifiseringskø med samtale-maler og kvalitetsgrad per selger. Kunden bekrefter — organisasjonen kan stole på tallene.',
    align: 'right', landscape: true,
  },
  {
    id: 'go', kind: 'device', image: '/leadgrid/app/kjorebok.png',
    eyebrow: 'Leadgrid Go', title: 'Kjøreboka skriver seg selv.',
    body: 'Automatisk trip-logg, kjøregodtgjørelse med ekte bomkostnad og Skatteetaten-klar rapport — for hele flåten.',
    align: 'left', landscape: true,
  },
  {
    id: 'team', kind: 'device', image: '/leadgrid/app/team.png',
    eyebrow: 'Team', title: 'Hver selger sin sone.',
    body: 'Territorie-grid med geofence. Ingen tråkker i hverandres felt — og lederen ser alt.',
    align: 'left',
  },
  {
    id: 'leadbook', kind: 'device', image: '/leadgrid/app/leadbook.png',
    eyebrow: 'Leadbook', title: 'Vinn med Pondus.',
    body: 'Manus som lukker — første kontakt, innvendinger, beslutningstaker — bygget inn i appen.',
    align: 'right',
  },
  {
    id: 'oversikt', kind: 'device', image: '/leadgrid/app/oversikt.png',
    eyebrow: 'Momentum', title: 'Se teamet vokse. Live.',
    body: '51 leads, +18 % denne uka. Momentum og prognoser oppdateres mens dere jobber.',
    align: 'left',
  },
];

const N = SCENES.length;

export default function LeadgridExperience({
  onStartFree,
}: {
  onStartFree?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  // Myk demping så scroll-koblede transformasjoner ikke rykker.
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <section
      ref={ref}
      aria-label="Leadgrid — en dag i feltet"
      style={{
        position: 'relative',
        // 85vh per scene (ikke 100): strammere reise uten døde soner nå som
        // manuset har flere scener — selve scroll-effekten er uendret.
        height: `${(N + 1) * 85}vh`,
        background: P.bg,
      }}
    >
      <div
        style={{
          position: 'sticky', top: 0, height: '100vh', width: '100%',
          overflow: 'hidden', perspective: '1400px',
        }}
      >
        {/* Ryggrad: grid-feltet som beveger seg mot deg */}
        <GridField progress={smooth} />

        {/* Scenene — hver toner inn/ut i sitt scroll-vindu */}
        {SCENES.map((s, i) => (
          <SceneLayer key={s.id} scene={s} index={i} progress={smooth} />
        ))}

        {/* Avsluttende CTA-scene */}
        <CtaLayer progress={smooth} onStartFree={onStartFree} />

        {/* Scroll-hint (kun helt i starten) */}
        <ScrollHint progress={smooth} />
      </div>
    </section>
  );
}

// ── Grid-feltet: perspektiv-rutenett med glødende noder ────────────────
function GridField({ progress }: { progress: MotionValue<number> }) {
  // Rutenettet «flyr» mot deg gjennom hele reisen (translateZ).
  const z = useTransform(progress, [0, 1], [0, 2200]);
  const opacity = useTransform(progress, [0, 0.06, 0.9, 1], [0.15, 0.55, 0.55, 0.2]);
  const rotateX = useTransform(progress, [0, 1], [62, 48]);

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute', inset: '-40% -20% -20% -20%',
        transformStyle: 'preserve-3d', opacity,
        backgroundImage:
          `linear-gradient(rgba(167,139,250,0.35) 1px, transparent 1px),` +
          `linear-gradient(90deg, rgba(167,139,250,0.35) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
        rotateX,
        translateZ: z,
        maskImage: 'radial-gradient(ellipse at 50% 40%, #000 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, #000 30%, transparent 75%)',
      }}
    />
  );
}

// ── Én scene ──────────────────────────────────────────────────────────
function SceneLayer({
  scene, index, progress,
}: {
  scene: Scene; index: number; progress: MotionValue<number>;
}) {
  // Scroll-vinduet for denne scenen (litt overlapp for myk krysstoning).
  const unit = 1 / (N + 1);
  const start = index * unit;
  const mid = start + unit * 0.5;
  const end = start + unit;
  const pad = unit * 0.42;

  // Rask inn-toning (0.3×pad, ikke 0.5×) gir lengre fullt synlig platå per
  // scene og fjerner «tomrommet» der begge nabo-scener lå under 50 %.
  const opacity = useTransform(
    progress,
    [start - pad, start + pad * 0.3, end - pad * 0.3, end + pad],
    [0, 1, 1, 0],
  );
  // Innhold glir og skalerer lett = POV-dybde.
  const scale = useTransform(progress, [start - pad, mid, end + pad], [1.12, 1, 0.92]);
  const y = useTransform(progress, [start - pad, mid, end + pad], [60, 0, -60]);

  const isCinematic = scene.kind === 'cinematic';

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0, opacity,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {isCinematic ? (
        <CinematicVisual image={scene.image} scale={scale} />
      ) : (
        <DeviceVisual
          image={scene.image} scale={scale} y={y} align={scene.align}
          landscape={scene.landscape}
        />
      )}
      <Callout scene={scene} progress={progress} start={start} mid={mid} end={end} pad={pad} />
    </motion.div>
  );
}

// ── Cinematic (fal.ai) full-bleed med Ken Burns ────────────────────────
function CinematicVisual({ image, scale }: { image: string; scale: MotionValue<number> }) {
  return (
    <>
      <motion.div
        style={{
          position: 'absolute', inset: 0, scale,
          backgroundImage: `url(${image})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(90deg, rgba(5,1,15,0.85) 0%, rgba(5,1,15,0.35) 45%, rgba(5,1,15,0.15) 100%),' +
            'linear-gradient(0deg, rgba(5,1,15,0.9) 0%, transparent 40%)',
        }}
      />
    </>
  );
}

// ── Ekte app-skjerm i 3D-tiltet iPad ──────────────────────────────────
function DeviceVisual({
  image, scale, y, align, landscape,
}: {
  image: string; scale: MotionValue<number>; y: MotionValue<number>;
  align?: 'left' | 'center' | 'right'; landscape?: boolean;
}) {
  // iPaden lener seg motsatt av tekst-siden for dybde.
  const rotateY = align === 'right' ? 9 : align === 'left' ? -9 : 0;
  const shiftX = align === 'right' ? '-16%' : align === 'left' ? '16%' : '0%';

  return (
    <motion.div
      style={{
        position: 'relative', scale, y, x: shiftX,
        transformStyle: 'preserve-3d', rotateY, rotateX: 4,
        // Liggende iPad trenger mer bredde for samme visuelle vekt.
        width: landscape ? 'min(58vw, 720px)' : 'min(46vw, 540px)',
      }}
    >
      {/* glød bak enheten */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: '-14% -18%',
          background: `radial-gradient(ellipse at center, ${P.accent}55, transparent 68%)`,
          filter: 'blur(30px)',
        }}
      />
      <div
        style={{
          position: 'relative', borderRadius: 34, padding: 12,
          background: 'linear-gradient(160deg, #23203a, #0c0a18)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <img
          src={image} alt=""
          style={{
            display: 'block', width: '100%', height: 'auto',
            borderRadius: 24, background: '#0b0518',
          }}
        />
        {/* pulsende «tap»-hint-pin */}
        <motion.span
          aria-hidden
          style={{
            position: 'absolute', left: '30%', top: '36%',
            width: 18, height: 18, borderRadius: '50%',
            background: P.magenta, boxShadow: `0 0 0 0 ${P.magenta}`,
          }}
          animate={{ boxShadow: [`0 0 0 0 ${P.magenta}aa`, `0 0 0 22px ${P.magenta}00`] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

// ── Tekst-callout per scene ───────────────────────────────────────────
function Callout({
  scene, progress, start, mid, end, pad,
}: {
  scene: Scene; progress: MotionValue<number>;
  start: number; mid: number; end: number; pad: number;
}) {
  const opacity = useTransform(
    progress, [start, start + pad * 0.7, end - pad * 0.7, end], [0, 1, 1, 0],
  );
  const y = useTransform(progress, [start, mid, end], [40, 0, -30]);
  const align = scene.align ?? 'left';

  return (
    <motion.div
      style={{
        position: 'absolute', opacity, y,
        maxWidth: 'min(90vw, 520px)',
        padding: '0 6vw',
        left: align === 'left' ? 0 : undefined,
        right: align === 'right' ? 0 : undefined,
        textAlign: align === 'center' ? 'center' : 'left',
        top: '50%', transform: 'translateY(-50%)',
      }}
    >
      {scene.eyebrow && (
        <div
          style={{
            display: 'inline-block', marginBottom: 16,
            fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
            color: P.accentBright,
            padding: '6px 12px', borderRadius: 999,
            border: `1px solid ${P.accent}44`, background: `${P.accent}14`,
          }}
        >
          {scene.eyebrow}
        </div>
      )}
      <h2
        style={{
          margin: 0, color: P.text, fontWeight: 800,
          fontSize: 'clamp(30px, 4.4vw, 62px)', lineHeight: 1.04,
          letterSpacing: -0.5,
        }}
      >
        {scene.title}
      </h2>
      <p
        style={{
          marginTop: 18, color: P.muted,
          fontSize: 'clamp(15px, 1.5vw, 20px)', lineHeight: 1.5, maxWidth: 460,
          marginLeft: align === 'center' ? 'auto' : 0,
          marginRight: align === 'center' ? 'auto' : 0,
        }}
      >
        {scene.body}
      </p>
    </motion.div>
  );
}

// ── Avsluttende CTA ───────────────────────────────────────────────────
function CtaLayer({
  progress, onStartFree,
}: {
  progress: MotionValue<number>; onStartFree?: () => void;
}) {
  const unit = 1 / (N + 1);
  const start = N * unit;
  const opacity = useTransform(progress, [start - unit * 0.4, start + unit * 0.3, 1], [0, 1, 1]);
  const scale = useTransform(progress, [start - unit * 0.4, 1], [0.9, 1]);

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0, opacity,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '0 6vw',
      }}
    >
      <motion.div style={{ scale }}>
        <div
          style={{
            fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
            color: P.accentBright, marginBottom: 18,
          }}
        >
          Kartbasert CRM for feltet
        </div>
        <h2
          style={{
            margin: 0, color: P.text, fontWeight: 800,
            fontSize: 'clamp(34px, 6vw, 84px)', lineHeight: 1.02, letterSpacing: -1,
          }}
        >
          Gjør kartet<br />om til kunder.
        </h2>
        <p style={{ color: P.muted, marginTop: 22, fontSize: 'clamp(16px,1.6vw,22px)' }}>
          Gratis å starte. Ingen kortkrav. Native iPad-app inkludert.
        </p>
        <button
          type="button"
          onClick={onStartFree}
          style={{
            marginTop: 34, cursor: 'pointer', border: 'none',
            padding: '18px 44px', borderRadius: 999,
            fontSize: 18, fontWeight: 800, color: '#160a2b',
            background: `linear-gradient(120deg, ${P.accentBright}, ${P.magenta})`,
            boxShadow: `0 20px 60px ${P.accent}55`,
          }}
        >
          Start gratis
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Scroll-hint ───────────────────────────────────────────────────────
function ScrollHint({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.04], [1, 0]);
  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute', bottom: 34, left: '50%', x: '-50%', opacity,
        color: P.muted, fontSize: 13, fontWeight: 600, letterSpacing: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}
    >
      Scroll for å gå inn i feltet
      <motion.div
        style={{
          width: 26, height: 42, borderRadius: 14,
          border: `2px solid ${P.accent}66`, position: 'relative',
        }}
      >
        <motion.div
          style={{
            position: 'absolute', left: '50%', top: 8, x: '-50%',
            width: 4, height: 8, borderRadius: 2, background: P.accentBright,
          }}
          animate={{ y: [0, 12, 0], opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </motion.div>
  );
}

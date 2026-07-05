/**
 * WarmupGuidePage — brukerguide for «Oppvarming & fokus» i Sound Room.
 * Åpen side på /guide/oppvarming (lenket fra byggeren og delingssiden), i
 * Sound Rooms mørke design. Skjermbildene ligger i /public/guides/warmup.
 * Pust-demoen bruker samme keyframe-oppsett som WarmupPlayer og skrus av
 * ved prefers-reduced-motion.
 */
import React from 'react';
import { Box, Stack, Typography, Chip, IconButton, Divider } from '@mui/material';
import { SelfImprovement, ArrowBack, CheckCircle, MusicNote, RecordVoiceOver, PlayArrow, BookmarkBorder, NotificationsActive } from '@mui/icons-material';

const BG = '#0E0E11', PANEL = '#131316', BORDER = 'rgba(255,255,255,0.08)', TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.62)', FAINT = 'rgba(245,242,234,0.4)', ACCENT = '#FF6B35', GREEN = '#5fb88a';

const Shot: React.FC<{ src: string; alt: string; caption: string }> = ({ src, alt, caption }) => (
  <Box component="figure" sx={{ m: 0, mt: 1.5 }}>
    <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '12px', p: 1 }}>
      <Box component="img" src={src} alt={alt} loading="lazy" sx={{ display: 'block', width: '100%', height: 'auto', borderRadius: '8px' }} />
    </Box>
    <Typography component="figcaption" sx={{ fontSize: '0.76rem', color: FAINT, mt: 0.75, lineHeight: 1.5 }}>{caption}</Typography>
  </Box>
);

const Step: React.FC<{ n: number; title: string; color?: string; children: React.ReactNode }> = ({ n, title, color = ACCENT, children }) => (
  <Stack component="li" direction="row" spacing={2} sx={{ mt: 4, listStyle: 'none' }}>
    <Box aria-hidden sx={{ width: 34, height: 34, minWidth: 34, borderRadius: '50%', border: `1.5px solid ${color}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.95rem', mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>{n}</Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography component="h3" sx={{ fontSize: '1.05rem', fontWeight: 700, mb: 0.5 }}>{title}</Typography>
      {children}
    </Box>
  </Stack>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: '0.9rem', color: MUTED, lineHeight: 1.65, maxWidth: '62ch' }}>{children}</Typography>
);
const Ui: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.82em', bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '5px', px: 0.75, py: 0.1, whiteSpace: 'nowrap', color: TEXT }}>{children}</Box>
);
const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="strong" sx={{ color: TEXT, fontWeight: 600 }}>{children}</Box>
);

const RoleHeading: React.FC<{ id: string; tag: string; tagColor: string; tagBg: string; title: string }> = ({ id, tag, tagColor, tagBg, title }) => (
  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
    <Chip label={tag} size="small" sx={{ bgcolor: tagBg, color: tagColor, fontWeight: 700, fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', height: 22 }} />
    <Typography component="h2" id={id} sx={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</Typography>
  </Stack>
);

// Live pust-demo: samme mønster som WarmupPlayer (boks-pust 4-4-4-2 → 14s).
const BreathDemo: React.FC = () => {
  const [phase, setPhase] = React.useState('Pust inn');
  React.useEffect(() => {
    const t0 = Date.now();
    const t = setInterval(() => {
      const c = ((Date.now() - t0) / 1000) % 14;
      setPhase(c < 4 ? 'Pust inn' : c < 8 ? 'Hold' : c < 12 ? 'Pust ut' : 'Hold');
    }, 250);
    return () => clearInterval(t);
  }, []);
  return (
    <Stack alignItems="center" spacing={1} sx={{ my: 2 }} aria-hidden>
      <Box sx={{
        width: 110, height: 110, borderRadius: '50%', border: `3px solid ${ACCENT}`, bgcolor: 'rgba(255,107,53,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'gbreathe 14s ease-in-out infinite',
        '@keyframes gbreathe': { '0%': { transform: 'scale(0.7)' }, '28.57%': { transform: 'scale(1.05)' }, '57.14%': { transform: 'scale(1.05)' }, '85.71%': { transform: 'scale(0.7)' }, '100%': { transform: 'scale(0.7)' } },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: ACCENT }}>{phase}</Typography>
      </Box>
      <Typography sx={{ fontSize: '0.72rem', color: FAINT }}>Slik puster sirkelen med boks-pust 4-4-4-2</Typography>
    </Stack>
  );
};

const WarmupGuidePage: React.FC = () => {
  React.useEffect(() => {
    const prev = document.title;
    document.title = 'Oppvarming & fokus — guide · CreatorHubn';
    return () => { document.title = prev; };
  }, []);
  const goBack = () => { if (window.history.length > 1) window.history.back(); else window.location.assign('/'); };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: BG, color: TEXT, '& :focus-visible': { outline: `2px solid ${ACCENT}`, outlineOffset: 2 } }}>
      <Box component="main" sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 4, sm: 7 } }}>
        {/* Topp */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 4 }}>
          <IconButton onClick={goBack} aria-label="Tilbake" sx={{ color: MUTED, border: `1px solid ${BORDER}` }}><ArrowBack fontSize="small" /></IconButton>
          <Chip icon={<SelfImprovement sx={{ fontSize: '16px !important', color: `${ACCENT} !important` }} />} label="Sound Room" size="small" sx={{ bgcolor: 'rgba(255,107,53,0.1)', color: ACCENT, fontWeight: 700 }} />
        </Stack>

        <Box component="header" sx={{ mb: 6 }}>
          <Typography component="h1" sx={{ fontSize: { xs: '1.9rem', sm: '2.4rem' }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.12, mb: 1.5 }}>Oppvarming &amp; fokus</Typography>
          <Typography sx={{ fontSize: '1rem', color: MUTED, maxWidth: '58ch', lineHeight: 1.6 }}>
            Produsenten setter sammen oppvarmings- og fokusrutiner — pust, vokal, mindfulness og egne lyder — og bandet kjører dem guidet før opptak. Denne guiden viser begge sidene av flyten.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2.5, fontFamily: 'ui-monospace, Menlo, monospace' }} aria-label="Hvor du finner det">
            {['Workspace', 'Sesjoner', 'Oppvarming & fokus'].map((c, i) => (
              <React.Fragment key={c}>
                {i > 0 && <Typography aria-hidden sx={{ color: FAINT, fontSize: '0.76rem' }}>→</Typography>}
                <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '6px', px: 1, py: 0.25, fontSize: '0.74rem', color: MUTED }}>{c}</Box>
              </React.Fragment>
            ))}
          </Stack>
        </Box>

        {/* Produsenten */}
        <Box component="section" aria-labelledby="guide-produsent">
          <RoleHeading id="guide-produsent" tag="Produsenten" tagColor={ACCENT} tagBg="rgba(255,107,53,0.12)" title="Bygg og tilordne rutiner" />
          <Typography sx={{ fontSize: '0.9rem', color: MUTED, mt: 1, maxWidth: '62ch', lineHeight: 1.65 }}>
            Byggeren åpnes fra <Em>Sesjoner-fanen</Em> i prosjekt-workspacet. Innholdet til venstre kommer fra EaseVerse; kolonnen til høyre viser malene dine og hvem som har fullført.
          </Typography>

          <Box component="ol" sx={{ m: 0, p: 0 }}>
            <Step n={1} title="Velg steg fra biblioteket">
              <P>Kryss av øvelsene rutinen skal bestå av — <Em>Vokal &amp; kropp</Em>, <Em>Pust</Em> (med mønsteret vist, f.eks. 4-4-4-2), <Em>Mindfulness</Em>, <Em>Visualisering</Em> og <Em>Affirmasjoner</Em>. Chip-raden øverst styrer hvem rutinen gjelder: <Ui>Alle</Ui>, <Ui>Vokalist</Ui> eller <Ui>Instrument</Ui>.</P>
              <Shot src="/guides/warmup/dialog-01-initial.png" alt="Byggeren: bibliotek med øvelser til venstre, «Mine lyder» under, «Mine maler» og tilordnede rutiner til høyre" caption="Byggeren: bibliotek til venstre, «Mine lyder» under, og «Mine maler» + tilordnede rutiner til høyre." />
            </Step>

            <Step n={2} title="Forhåndslytt før du tilordner">
              <P>Alle lyder i «Mine lyder» og opplastede filer har en <PlayArrow aria-label="play" sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: ACCENT }} />-knapp. Lyden spilles direkte i dialogen — trykk en gang til for å stoppe. Slik hører du at riktig fil ligger på riktig steg før bandet får den.</P>
              <Shot src="/guides/warmup/dialog-02-preview-playing.png" alt="Forhåndslytting aktiv på en lyd i Mine lyder — play-ikonet har skiftet til stopp" caption="Play-ikonet skifter til stopp mens lyden spiller." />
            </Step>

            <Step n={3} title="Last opp egne lyder">
              <P>To knapper under biblioteket: <Ui><MusicNote aria-hidden sx={{ fontSize: 12 }} /> Last opp mindfulness-musikk</Ui> og <Ui><RecordVoiceOver aria-hidden sx={{ fontSize: 12 }} /> Last opp voice-over (guidet)</Ui>. Fila legges rett inn som steg i rutinen <Em>og</Em> lagres i «Mine lyder», slik at den kan gjenbrukes i alle prosjektene dine. Grønn hake i biblioteket betyr at lyden allerede ligger i rutinen.</P>
              <Shot src="/guides/warmup/dialog-04-after-upload.png" alt="Etter opplasting ligger fila som steg i rutinen og øverst i Mine lyder med grønn hake" caption="Nyopplastet fil: den ligger som steg i rutinen og øverst i «Mine lyder» med hake." />
            </Step>

            <Step n={4} title="Bruk maler på tvers av prosjekter">
              <P><Ui>Bruk</Ui> på en mal fyller inn navn, målgruppe, beskjed og alle stegene på ett klikk. Når du har satt sammen en rutine du vil ta vare på, trykk <Ui><BookmarkBorder aria-hidden sx={{ fontSize: 12 }} /> Lagre som mal</Ui> — den dukker opp i «Mine maler» og følger deg til alle lydrom.</P>
              <Shot src="/guides/warmup/dialog-03-template-applied.png" alt="Malen «Vokal før opptak» er brukt: tittel, målgruppe Vokalist, avkryssede steg og beskjed er fylt inn" caption="Malen «Vokal før opptak» er brukt: tittel, målgruppe, steg og beskjed er fylt inn." />
              <Shot src="/guides/warmup/dialog-05-template-saved.png" alt="Ny mal lagret og synlig øverst i Mine maler" caption="«Lagre som mal» → den nye malen ligger øverst i «Mine maler»." />
            </Step>

            <Step n={5} title="Tilordne og følg med">
              <P><Ui>Tilordne rutine</Ui> sender rutinen til bandets delingsside. I «Tilordnet»-kolonnen ser du hvem som har fullført — hvert medlem får en grønn navnebrikke når de er ferdige. Trenger noen et puff, kan du sende påminnelse fra Sesjoner-fanen: nå eller på et valgt tidspunkt, til alle, vokalisten eller instrumentalistene — og bare til de som ikke har varmet opp.</P>
            </Step>
          </Box>
        </Box>

        <Divider sx={{ borderColor: BORDER, my: 6 }} />

        {/* Bandmedlemmet */}
        <Box component="section" aria-labelledby="guide-medlem">
          <RoleHeading id="guide-medlem" tag="Bandmedlemmet" tagColor={GREEN} tagBg="rgba(95,184,138,0.12)" title="Kjør rutinen før opptak" />
          <Typography sx={{ fontSize: '0.9rem', color: MUTED, mt: 1, maxWidth: '62ch', lineHeight: 1.65 }}>
            På delingssiden ligger rutinene under <Em>«Anbefalt før opptak»</Em>. Rutiner merket «Vokalist» eller «Instrument» vises bare for dem det gjelder.
          </Typography>

          <Box component="ol" sx={{ m: 0, p: 0 }}>
            <Step n={1} color={GREEN} title="Start rutinen">
              <P>Lista viser steg-antall, varighet og produsentens beskjed. Grønn hake betyr fullført — da skifter knappen til <Ui>Kjør igjen</Ui>.</P>
              <Shot src="/guides/warmup/player-01-list.png" alt="«Anbefalt før opptak» med to rutiner — én venter med Start-knapp, én er fullført" caption="«Pust & fokus før refrenget» venter; «Rask mindfulness» er alt fullført." />
            </Step>

            <Step n={2} color={GREEN} title="Pust i takt med sirkelen">
              <P>For pustesteg følger sirkelen <Em>det faktiske mønsteret</Em> produsenten valgte — her boks-pust 4-4-4-2: den vokser i 4 sekunder, står i 4, krymper i 4 og hviler i 2. Teksten i sirkelen sier hva du skal gjøre akkurat nå. <Ui>Pause</Ui> fryser både nedtelling og animasjon. Vokal-steg har egen <Ui>Referansetone</Ui> i låtas toneart.</P>
              <BreathDemo />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.25 }}>
                <Shot src="/guides/warmup/player-02-pust-inn.png" alt="Spilleren i fasen Pust inn — sirkelen vokser" caption="Sirkelen vokser: «Pust inn»." />
                <Shot src="/guides/warmup/player-03-hold.png" alt="Spilleren i fasen Hold — sirkelen står stille" caption="Sirkelen står stille: «Hold»." />
                <Shot src="/guides/warmup/player-04-pust-ut.png" alt="Spilleren i fasen Pust ut — sirkelen krymper" caption="Sirkelen krymper: «Pust ut»." />
              </Box>
            </Step>

            <Step n={3} color={GREEN} title="Lytt til produsentens lyder — og fullfør">
              <P>Steg med opplastet musikk eller voice-over spiller lyden automatisk med egen avspiller. På siste steg blir Neste-knappen til <Ui><CheckCircle aria-hidden sx={{ fontSize: 12 }} /> Fullfør</Ui> — da får du grønn hake, og produsenten ser navnet ditt i «Tilordnet»-kolonnen.</P>
              <Shot src="/guides/warmup/player-06-custom-audio-step.png" alt="Siste steg med «Musikk fra produsenten», innebygd avspiller og grønn Fullfør-knapp" caption="Siste steg: «Musikk fra produsenten» med avspiller og grønn Fullfør-knapp." />
            </Step>
          </Box>
        </Box>

        {/* Godt å vite */}
        <Box component="section" aria-labelledby="guide-tips" sx={{ mt: 7, bgcolor: PANEL, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: '10px', p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <NotificationsActive sx={{ color: ACCENT, fontSize: 18 }} aria-hidden />
            <Typography component="h2" id="guide-tips" sx={{ fontSize: '1.02rem', fontWeight: 800 }}>Godt å vite</Typography>
          </Stack>
          <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { fontSize: '0.88rem', color: MUTED, lineHeight: 1.6, mb: 1 }, '& li::marker': { color: FAINT } }}>
            <li><Em>Maler og «Mine lyder» er dine</Em> — de følger kontoen din på tvers av alle prosjekter, ikke bare dette lydrommet.</li>
            <li><Em>Sletting i «Mine lyder» er trygg</Em> — den fjerner bare lyden fra biblioteket. Rutiner som allerede bruker fila fortsetter å virke.</li>
            <li><Em>Påminnelser kan planlegges</Em> — velg tidspunkt (f.eks. kvelden før økta), målgruppe, og huk av «kun de som ikke har varmet opp». Planlagte påminnelser kan avlyses fram til de sendes.</li>
            <li><Em>Klar-status vises i Oversikt</Em> — studio-kortet viser hvor mange i bandet som er klare før neste økt.</li>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default WarmupGuidePage;

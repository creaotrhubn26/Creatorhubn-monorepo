/**
 * ChatActionsGuidePage — guide for «Handlinger» (Action-launcher) i Team Chat.
 * Åpen side på /guide/actions, workspace-design. Skjermbilder i
 * /public/guides/actions. Lenket fra chat-panelets «Flere valg»-meny.
 */
import React from 'react';
import { Box, Stack, Typography, Chip, IconButton, Divider } from '@mui/material';
import Bolt from '@mui/icons-material/Bolt';
import ArrowBack from '@mui/icons-material/ArrowBack';
import PlaylistAddCheck from '@mui/icons-material/PlaylistAddCheck';
import EventOutlined from '@mui/icons-material/EventOutlined';
import LinkIcon from '@mui/icons-material/Link';
import AttachFile from '@mui/icons-material/AttachFile';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import HelpOutline from '@mui/icons-material/HelpOutline';
import Lightbulb from '@mui/icons-material/Lightbulb';

const BG = '#0b1120', PANEL = '#0f1729', BORDER = 'rgba(255,255,255,0.12)', TEXT = 'rgba(255,255,255,0.95)', MUTED = 'rgba(255,255,255,0.62)', FAINT = 'rgba(255,255,255,0.4)', ACCENT = '#ff8c00', GREEN = '#34d399';

const Shot: React.FC<{ src: string; alt: string; caption: string; max?: number }> = ({ src, alt, caption, max = 420 }) => (
  <Box component="figure" sx={{ m: 0, mt: 1.5 }}>
    <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '12px', p: 1, display: 'inline-block', maxWidth: '100%' }}>
      <Box component="img" src={src} alt={alt} loading="lazy" sx={{ display: 'block', width: '100%', maxWidth: max, height: 'auto', borderRadius: '8px' }} />
    </Box>
    <Typography component="figcaption" sx={{ fontSize: '0.76rem', color: FAINT, mt: 0.75, lineHeight: 1.5 }}>{caption}</Typography>
  </Box>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: '0.9rem', color: MUTED, lineHeight: 1.65, maxWidth: '64ch' }}>{children}</Typography>
);
const Ui: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.82em', bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '5px', px: 0.75, py: 0.1, whiteSpace: 'nowrap', color: TEXT }}>{children}</Box>
);
const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box component="strong" sx={{ color: TEXT, fontWeight: 600 }}>{children}</Box>
);

const ActionRow: React.FC<{ icon: React.ReactNode; color: string; name: string; children: React.ReactNode }> = ({ icon, color, name, children }) => (
  <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
    <Box aria-hidden sx={{ width: 34, height: 34, minWidth: 34, borderRadius: '9px', bgcolor: `${color}1f`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.25 }}>{icon}</Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography component="h3" sx={{ fontSize: '1.02rem', fontWeight: 700, mb: 0.3 }}>{name}</Typography>
      <Typography sx={{ fontSize: '0.9rem', color: MUTED, lineHeight: 1.6, maxWidth: '64ch' }}>{children}</Typography>
    </Box>
  </Stack>
);

const SectionHeading: React.FC<{ id: string; tag: string; title: string }> = ({ id, tag, title }) => (
  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
    <Chip label={tag} size="small" sx={{ bgcolor: 'rgba(255,140,0,0.14)', color: ACCENT, fontWeight: 700, fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', height: 22 }} />
    <Typography component="h2" id={id} sx={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</Typography>
  </Stack>
);

const ChatActionsGuidePage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  React.useEffect(() => {
    const prev = document.title;
    document.title = 'Handlinger i Team Chat — guide · CreatorHubn';
    return () => { document.title = prev; };
  }, []);
  const goBack = () => { if (window.history.length > 1) window.history.back(); else window.location.assign('/'); };

  return (
    <Box sx={{ minHeight: embedded ? 'auto' : '100vh', bgcolor: BG, color: TEXT, '& :focus-visible': { outline: `2px solid ${ACCENT}`, outlineOffset: 2 } }}>
      <Box component="main" sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 }, py: embedded ? 2 : { xs: 4, sm: 7 } }}>
        {!embedded && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 4 }}>
          <IconButton onClick={goBack} aria-label="Tilbake" sx={{ color: MUTED, border: `1px solid ${BORDER}` }}><ArrowBack fontSize="small" /></IconButton>
          <Chip icon={<Bolt sx={{ fontSize: '16px !important', color: `${ACCENT} !important` }} />} label="Team Chat" size="small" sx={{ bgcolor: 'rgba(255,140,0,0.1)', color: ACCENT, fontWeight: 700 }} />
        </Stack>
        )}

        <Box component="header" sx={{ mb: 6 }}>
          <Typography component="h1" sx={{ fontSize: { xs: '1.9rem', sm: '2.4rem' }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.12, mb: 1.5 }}>Handlinger — gjør det fra chatten</Typography>
          <Typography sx={{ fontSize: '1rem', color: MUTED, maxWidth: '60ch', lineHeight: 1.6 }}>
            Team Chat er ikke bare meldinger. Med <Em>Handlinger</Em> kan du opprette oppgaver, booke møter, referere til arbeidet, be om filer og få AI-hjelp — uten å forlate samtalen. Menyen tilpasser seg profesjonen din.
          </Typography>
        </Box>

        {/* Åpne */}
        <Box component="section" aria-labelledby="a-open">
          <SectionHeading id="a-open" tag="Åpne" title="Tre måter inn" />
          <P>Trykk <Ui>+</Ui>-knappen til venstre for skrivefeltet, skriv <Ui>/</Ui> i et tomt felt, eller bruk <Ui>Ctrl/Cmd&nbsp;+&nbsp;K</Ui> hvor som helst i chatten. Da åpnes en søkbar meny — begynn å skrive for å filtrere.</P>
          <Shot src="/guides/actions/01-launcher.png" alt="Handlings-menyen åpen med søkefelt og handlinger: Ny oppgave, Planlegg møte, Referer til, Be om lydfil, AI-oppsummer, AI-foreslå" caption="Handlings-menyen — søkbar, åpnes med +, / eller Ctrl+K." max={520} />
        </Box>

        <Divider sx={{ borderColor: BORDER, my: 6 }} />

        {/* Handlingene */}
        <Box component="section" aria-labelledby="a-list">
          <SectionHeading id="a-list" tag="Handlinger" title="Hva du kan gjøre" />
          <ActionRow icon={<PlaylistAddCheck sx={{ fontSize: 19 }} />} color={GREEN} name="Ny oppgave på board">
            Gjør en idé i chatten til en <Em>crew-oppgave</Em>. Velg rolle (produsent, vokal, foto, video …), så lander oppgaven på Oppgaver-tavla — og et klikkbart kort dukker opp i tråden.
          </ActionRow>
          <ActionRow icon={<EventOutlined sx={{ fontSize: 19 }} />} color="#a5b4fc" name="Planlegg møte / booking">
            Book tid rett fra chatten. Velg dato/tid og huk av <Ui>Generer Google Meet</Ui> — det lages et ekte møte med Meet-lenke, og et kort med <Em>«Bli med (Google Meet)»</Em> deles i tråden.
          </ActionRow>
          <ActionRow icon={<LinkIcon sx={{ fontSize: 19 }} />} color={ACCENT} name="Referer til …">
            Pek på arbeidet: en <Em>låt</Em>, et <Em>media-utvalg</Em>, en <Em>leveranse</Em> eller en <Em>økt</Em>. Referansen blir et klikkbart kort som tar teamet rett til riktig fane.
          </ActionRow>
          <ActionRow icon={<AttachFile sx={{ fontSize: 19 }} />} color="#7dd3fc" name="Be om opplasting">
            Be motparten om en fil — <Em>lydfil</Em>, <Em>RAW/utvalg</Em> eller <Em>kildefiler</Em> alt etter profesjon. De laster opp rett i tråden via et <Ui>Last opp her</Ui>-kort.
          </ActionRow>
          <ActionRow icon={<CheckCircleOutline sx={{ fontSize: 19 }} />} color="#f0abfc" name="Send til kundegodkjenning">
            For klient-vendte fag: velg en leveranse → et godkjenn-kort deles i tråden. Ett trykk på <Ui>Godkjenn</Ui> markerer leveransen som levert.
          </ActionRow>
          <ActionRow icon={<AutoAwesome sx={{ fontSize: 19 }} />} color="#22d3ee" name="AI: oppsummer eller foreslå">
            La Claude lese samtalen og enten <Em>oppsummere</Em> hva som venter, eller <Em>foreslå en melding</Em>. Teksten legges i skrivefeltet — du redigerer og sender selv.
          </ActionRow>
          <Shot src="/guides/actions/02-cards.png" alt="Tråd med interaktive kort: oppgave-kort, referanse-kort (Nordlys), møte-kort med Bli med Google Meet, og en åpen forespørsel med Marker som løst" caption="Hver handling blir et interaktivt kort i tråden — oppgave, referanse og møte med «Bli med»-knapp." />
        </Box>

        <Divider sx={{ borderColor: BORDER, my: 6 }} />

        {/* Forespørsler */}
        <Box component="section" aria-labelledby="a-req">
          <SectionHeading id="a-req" tag="Forespørsler" title="Spørsmål som ikke faller mellom stolene" />
          <P>Merk en melding med <Em>Spørsmål</Em>, så blir den en <Em>forespørsel</Em> med status. Den viser <Ui>Åpen forespørsel</Ui> og <Ui>Marker som løst</Ui>, og en <Ui>X&nbsp;ubesvart</Ui>-teller øverst holder styr på hva som fortsatt venter på svar.</P>
          <Shot src="/guides/actions/03-request.png" alt="En Spørsmål-melding med «Åpen forespørsel» og «Marker som løst», og en «1 ubesvart»-teller øverst" caption="Forespørsler spores: «Åpen forespørsel» → «Marker som løst», med en ubesvart-teller øverst." />
        </Box>

        <Divider sx={{ borderColor: BORDER, my: 6 }} />

        {/* Kategori */}
        <Box component="section" aria-labelledby="a-cat">
          <SectionHeading id="a-cat" tag="Din profesjon" title="Menyen tilpasser seg deg" />
          <P>Handlingene og referanse-kildene følger workspace-kategorien. En <Em>musikkprodusent</Em> refererer til Låter og ber om lydfiler; en <Em>fotograf</Em> refererer til Media og ber om RAW/utvalg; <Em>service</Em> og <Em>foto</Em> får «Send til kundegodkjenning». Tomme kilder skjules automatisk.</P>
          <Shot src="/guides/actions/04-category.png" alt="Referanse-picker for en fotograf: Media-fane med RAW-filer i stedet for Låter" caption="Fotografens picker viser Media (RAW/utvalg) — musikeren ser Låter i samme meny." max={480} />
          <Shot src="/guides/actions/05-approval.png" alt="Godkjenn-kort for en leveranse med Godkjenn-knapp" caption="Godkjenn-kortet: ett trykk markerer leveransen som levert." />
        </Box>

        {/* Godt å vite */}
        <Box component="section" aria-labelledby="a-tips" sx={{ mt: 7, bgcolor: PANEL, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: '10px', p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Lightbulb sx={{ color: ACCENT, fontSize: 18 }} aria-hidden />
            <Typography component="h2" id="a-tips" sx={{ fontSize: '1.02rem', fontWeight: 800 }}>Godt å vite</Typography>
          </Stack>
          <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { fontSize: '0.88rem', color: MUTED, lineHeight: 1.6, mb: 1 }, '& li::marker': { color: FAINT } }}>
            <li><Em>Kortene er ekte snarveier</Em> — de peker på og endrer det virkelige arbeidet (oppgaver, møter, leveranser), ikke bare tekst.</li>
            <li><Em>AI sender aldri selv</Em> — forslaget legges i skrivefeltet, så du har alltid siste ord.</li>
            <li><Em>Alt skjer i prosjektets egen kanal</Em> — bare medlemmer ser og handler.</li>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatActionsGuidePage;

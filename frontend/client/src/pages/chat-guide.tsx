/**
 * ChatGuidePage — brukerguide for Team Chat i workspace. Åpen side på
 * /guide/chat (lenket fra chat-panelets «Flere valg»-meny), i workspacets
 * mørke design. Skjermbildene ligger i /public/guides/chat.
 */
import React from 'react';
import { Box, Stack, Typography, Chip, IconButton, Divider } from '@mui/material';
import Forum from '@mui/icons-material/Forum';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Send from '@mui/icons-material/Send';
import AlternateEmail from '@mui/icons-material/AlternateEmail';
import EmojiEmotions from '@mui/icons-material/EmojiEmotions';
import AttachFile from '@mui/icons-material/AttachFile';
import Search from '@mui/icons-material/Search';
import PushPin from '@mui/icons-material/PushPin';
import PeopleAlt from '@mui/icons-material/PeopleAlt';
import Lightbulb from '@mui/icons-material/Lightbulb';

const BG = '#0b1120', PANEL = '#0f1729', BORDER = 'rgba(255,255,255,0.12)', TEXT = 'rgba(255,255,255,0.95)', MUTED = 'rgba(255,255,255,0.62)', FAINT = 'rgba(255,255,255,0.4)', ACCENT = 'var(--ws-accent, #ff8c00)', GREEN = '#34d399';

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

const SectionHeading: React.FC<{ id: string; tag: string; title: string }> = ({ id, tag, title }) => (
  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
    <Chip label={tag} size="small" sx={{ bgcolor: 'rgba(255,140,0,0.14)', color: ACCENT, fontWeight: 700, fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', height: 22 }} />
    <Typography component="h2" id={id} sx={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</Typography>
  </Stack>
);

const ChatGuidePage: React.FC = () => {
  React.useEffect(() => {
    const prev = document.title;
    document.title = 'Team Chat — guide · CreatorHubn';
    return () => { document.title = prev; };
  }, []);
  const goBack = () => { if (window.history.length > 1) window.history.back(); else window.location.assign('/'); };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: BG, color: TEXT, '& :focus-visible': { outline: `2px solid ${ACCENT}`, outlineOffset: 2 } }}>
      <Box component="main" sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 4, sm: 7 } }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 4 }}>
          <IconButton onClick={goBack} aria-label="Tilbake" sx={{ color: MUTED, border: `1px solid ${BORDER}` }}><ArrowBack fontSize="small" /></IconButton>
          <Chip icon={<Forum sx={{ fontSize: '16px !important', color: `${ACCENT} !important` }} />} label="Workspace" size="small" sx={{ bgcolor: 'rgba(255,140,0,0.1)', color: ACCENT, fontWeight: 700 }} />
        </Stack>

        <Box component="header" sx={{ mb: 6 }}>
          <Typography component="h1" sx={{ fontSize: { xs: '1.9rem', sm: '2.4rem' }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.12, mb: 1.5 }}>Team Chat</Typography>
          <Typography sx={{ fontSize: '1rem', color: MUTED, maxWidth: '58ch', lineHeight: 1.6 }}>
            Hvert prosjekt har sin egen chat i høyre panel — der holder hele teamet seg samkjørt. Denne guiden viser hvordan du skriver, deler og finner fram.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2.5, fontFamily: 'ui-monospace, Menlo, monospace' }} aria-label="Hvor du finner det">
            {['Workspace', 'Oversikt', 'Team Chat'].map((c, i) => (
              <React.Fragment key={c}>
                {i > 0 && <Typography aria-hidden sx={{ color: FAINT, fontSize: '0.76rem' }}>→</Typography>}
                <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '6px', px: 1, py: 0.25, fontSize: '0.74rem', color: MUTED }}>{c}</Box>
              </React.Fragment>
            ))}
          </Stack>
          <Shot src="/guides/chat/01-overview.png" alt="Team Chat-panelet med meldinger fra teamet — egne meldinger høyrestilt med oransje boble" caption="Team Chat: teamets meldinger i én tråd. Dine egne står til høyre med oransje boble og «Deg»." />
        </Box>

        {/* Skriv & send */}
        <Box component="section" aria-labelledby="chat-skriv">
          <SectionHeading id="chat-skriv" tag="Skriv" title="Send meldinger" />
          <Box component="ol" sx={{ m: 0, p: 0 }}>
            <Step n={1} title="Skriv og send">
              <P>Skriv i feltet nederst og trykk <Ui>Enter</Ui> eller <Send sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: ACCENT }} aria-hidden />-knappen for å sende. <Ui>Shift&nbsp;+&nbsp;Enter</Ui> gir linjeskift så du kan skrive avsnitt. Dine egne meldinger legger seg til høyre med oransje boble — teamets til venstre med avatar og navn.</P>
            </Step>
            <Step n={2} title="Merk viktige meldinger">
              <P>Under skrivefeltet ligger tre merkelapper: <Em>Oppdatering</Em>, <Em>Spørsmål</Em> og <Em>Viktig</Em>. Trykk én før du sender, så festes den på meldingen som en farget chip — lett å skanne senere, og «Viktig» kan filtreres fram.</P>
              <Shot src="/guides/chat/02-compose.png" alt="Skrivefeltet med valgt merkelapp «Oppdatering» og et vedlagt bilde klart til sending" caption="Merkelappen «Oppdatering» er valgt, og et bilde er lagt ved — klart til å sendes." />
            </Step>
          </Box>
        </Box>

        <Divider sx={{ borderColor: BORDER, my: 6 }} />

        {/* Del mer */}
        <Box component="section" aria-labelledby="chat-del">
          <SectionHeading id="chat-del" tag="Del" title="Emoji, omtaler og vedlegg" />
          <Box component="ol" sx={{ m: 0, p: 0 }}>
            <Step n={1} color={GREEN} title="Emoji og omtaler">
              <P><EmojiEmotions sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: MUTED }} aria-hidden /> åpner en emoji-plukker som setter tegnet inn der markøren står. <AlternateEmail sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: MUTED }} aria-hidden /> lar deg <Em>nevne</Em> noen — velg fra deltakerlista, så settes <Ui>@Navn</Ui> inn i meldingen.</P>
              <Shot src="/guides/chat/04-emoji.png" alt="Emoji-plukkeren åpen over skrivefeltet med et rutenett av emojis" caption="Emoji-plukkeren — trykk en emoji for å sette den inn i meldingen." />
            </Step>
            <Step n={2} color={GREEN} title="Legg ved bilde">
              <P><AttachFile sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: MUTED }} aria-hidden /> laster opp et bilde (f.eks. cover, skjermbilde eller referanse). Det vises som miniatyr før du sender, og som klikkbart bilde i tråden — trykk for å åpne i full størrelse.</P>
              <Shot src="/guides/chat/03-sent-attachment.png" alt="En sendt melding med «Oppdatering»-merkelapp og et vedlagt album-cover-bilde" caption="Sendt melding med merkelapp og vedlagt bilde, klikkbart i tråden." />
            </Step>
          </Box>
        </Box>

        <Divider sx={{ borderColor: BORDER, my: 6 }} />

        {/* Finn fram */}
        <Box component="section" aria-labelledby="chat-finn">
          <SectionHeading id="chat-finn" tag="Finn fram" title="Søk, filter og deltakere" />
          <Box component="ol" sx={{ m: 0, p: 0 }}>
            <Step n={1} title="Søk i meldinger">
              <P><Search sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: MUTED }} aria-hidden /> øverst åpner et søkefelt som filtrerer tråden på innhold og avsender mens du skriver.</P>
              <Shot src="/guides/chat/06-search.png" alt="Søkefeltet aktivt med søkeordet «bassen», tråden filtrert til treffet" caption="Søk på «bassen» → kun meldinger som matcher vises." />
            </Step>
            <Step n={2} title="Vis kun viktige">
              <P><PushPin sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: MUTED }} aria-hidden />-knappen ved kanalnavnet filtrerer tråden til bare meldinger merket <Em>Viktig</Em> — nyttig for å hente fram beslutninger og deadlines. Trykk igjen for å vise alt.</P>
            </Step>
            <Step n={3} title="Se hvem som er med">
              <P><PeopleAlt sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: MUTED }} aria-hidden /> viser deltakerne i kanalen. Klikk et navn for å nevne personen i meldingen. <Em>Flere valg</Em>-menyen (⋮) har <Ui>Hopp til nyeste</Ui> og <Ui>Oppdater</Ui>.</P>
              <Shot src="/guides/chat/05-members.png" alt="Deltaker-popover som lister Nora Vik, Daniel (Deg) og Amir Hassan" caption="Deltakerlista — klikk et navn for å nevne personen." />
            </Step>
          </Box>
        </Box>

        {/* Godt å vite */}
        <Box component="section" aria-labelledby="chat-tips" sx={{ mt: 7, bgcolor: PANEL, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: '10px', p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Lightbulb sx={{ color: ACCENT, fontSize: 18 }} aria-hidden />
            <Typography component="h2" id="chat-tips" sx={{ fontSize: '1.02rem', fontWeight: 800 }}>Godt å vite</Typography>
          </Stack>
          <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { fontSize: '0.88rem', color: MUTED, lineHeight: 1.6, mb: 1 }, '& li::marker': { color: FAINT } }}>
            <li><Em>Chatten er per prosjekt</Em> — hver workspace har sin egen kanal, så samtaler holder seg til riktig produksjon.</li>
            <li><Em>Nye meldinger hentes automatisk</Em> — panelet oppdaterer seg selv, og du kan alltids trykke «Oppdater» i ⋮-menyen.</li>
            <li><Em>Utenlandske samarbeidspartnere</Em> ser panelet på engelsk automatisk — samme tråd, oversatt grensesnitt.</li>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatGuidePage;

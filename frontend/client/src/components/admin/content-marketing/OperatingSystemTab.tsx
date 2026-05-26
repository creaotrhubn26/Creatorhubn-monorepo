import { Box, Chip, Divider, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Paper } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VerifiedIcon from '@mui/icons-material/Verified';
import PsychologyIcon from '@mui/icons-material/Psychology';
import HubIcon from '@mui/icons-material/Hub';
import ShieldIcon from '@mui/icons-material/Shield';
import GroupsIcon from '@mui/icons-material/Groups';
import EmailIcon from '@mui/icons-material/Email';

/**
 * Operating System-tab — synlig dokumentasjon av hvorfor Admin Room-systemet
 * er bygd som det er. Speiler `TheRoleRoom-Admin-Room-Operating-System.md` i
 * monorepo-root. Skal være første-tab så Daniel og fremtidige team-medlemmer
 * forstår motivasjonen før de møter verktøyene.
 */

const SECTIONS: Array<{
  icon: React.ReactNode;
  number: string;
  title: string;
  body: React.ReactNode;
}> = [
  {
    icon: <AccessTimeIcon sx={{ color: '#22d3ee', fontSize: 26 }} />,
    number: '1',
    title: 'Tid-multiplikator for solo-lead',
    body: (
      <Stack spacing={1.5}>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          Solo-lead må gjøre arbeid for 5 personer. Systemet automatiserer det som ellers ville spist 10+ timer/uke.
        </Typography>
        <TableContainer component={Paper} sx={{ bgcolor: 'rgba(15,23,42,0.5)' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Aktivitet</TableCell>
                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Manuelt</TableCell>
                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Med systemet</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                ['Voice memo → LinkedIn + newsletter-intro + quote-cards', '3-4 timer', '30 min'],
                ['Personlig CD-DM med spesifikke referanser', '8-10 min', '30 sek'],
                ['Newsletter → LinkedIn + IG + quote-cards', '2-3 timer', '5 min'],
                ['Sjekke hvem som trenger Touch 2 denne uka', 'Umulig uten CRM', '1 blikk på Tier-1-tab'],
              ].map(([activity, manual, system]) => (
                <TableRow key={activity}>
                  <TableCell sx={{ color: '#e2e8f0', fontSize: '0.86rem' }}>{activity}</TableCell>
                  <TableCell sx={{ color: 'rgba(248,113,113,0.85)', fontSize: '0.86rem', fontWeight: 600 }}>{manual}</TableCell>
                  <TableCell sx={{ color: '#22d3ee', fontSize: '0.86rem', fontWeight: 700 }}>{system}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.86rem', lineHeight: 1.65, fontStyle: 'italic' }}>
          Konkret utfall: ~10 timer/uke frigjort. Den tiden går til møter — den eneste aktiviteten som faktisk bygger relasjoner i Norge.
        </Typography>
      </Stack>
    ),
  },
  {
    icon: <VerifiedIcon sx={{ color: '#f472b6', fontSize: 26 }} />,
    number: '2',
    title: 'Quality at scale i et 500-personers marked',
    body: (
      <Stack spacing={1.5}>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          Outreach Plan-prinsippet <em>"20 deeply personalised &gt; 200 generiske"</em> er nå håndhevet av systemet. Du kan ikke sende en outreach-DM uten at Claude ser:
        </Typography>
        <Stack spacing={0.5} sx={{ pl: 2 }}>
          {[
            { code: 'recent_productions', desc: 'hva de jobber med' },
            { code: 'mutual_connection', desc: 'hvem som kan introdusere' },
            { code: 'city, segment, notes', desc: 'kontekst' },
          ].map((row) => (
            <Stack key={row.code} direction="row" alignItems="center" spacing={1}>
              <Chip label={row.code} size="small" sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd', fontFamily: 'monospace', fontSize: '0.72rem', height: 20 }} />
              <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.86rem' }}>{row.desc}</Typography>
            </Stack>
          ))}
        </Stack>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          Systemet gjør spamming vanskeligere enn å gjøre det riktig. Det er den eneste defansable B2B-strategien i Norge — én generisk mail og ryktet er satt.
        </Typography>
      </Stack>
    ),
  },
  {
    icon: <PsychologyIcon sx={{ color: '#a78bfa', fontSize: 26 }} />,
    number: '3',
    title: 'Memory-extension som CRM',
    body: (
      <Stack spacing={1.5}>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          Ingen husker 500 mennesker. Touch-cadence-prikkene (0 → 1 → 2 → 3) viser per target hvor du er i 3-touch-regelen:
        </Typography>
        <Stack spacing={0.5} sx={{ pl: 2 }}>
          {[
            { lvl: '0', text: 'Ingen touch' },
            { lvl: '1', text: 'Engaged offentlig (kommentar, repost)' },
            { lvl: '2', text: 'Ga substantiv value (artikkel, stat, intro)' },
            { lvl: '3', text: 'ASK (DM, mail, møte)' },
          ].map((row) => (
            <Stack key={row.lvl} direction="row" alignItems="center" spacing={1.25}>
              <Chip label={row.lvl} size="small" sx={{ bgcolor: row.lvl === '3' ? 'rgba(34,211,238,0.18)' : 'rgba(167,139,250,0.18)', color: row.lvl === '3' ? '#22d3ee' : '#c4b5fd', fontWeight: 800, fontSize: '0.74rem', height: 22, minWidth: 24 }} />
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.88rem' }}>{row.text}</Typography>
            </Stack>
          ))}
        </Stack>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          "Klar for ask"-statkortet teller targets ferdig med Touch 1+2. Hver fredag morgen ser du nøyaktig hvem du skal følge opp. Det er forskjellen på 18 mnd relasjonsbygging vs. 3 mnd kaos.
        </Typography>
      </Stack>
    ),
  },
  {
    icon: <HubIcon sx={{ color: '#34d399', fontSize: 26 }} />,
    number: '4',
    title: 'GEO / AI-citation som moat — 18-måneders spillet',
    body: (
      <Stack spacing={1.5}>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          6 pillar-sider med Article-schema JSON-LD, Speakable-metadata og sitemap-registrering trener ChatGPT, Perplexity og Claude på at The Role Room er kilden for:
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          {[
            '/casting-svindel-tegn',
            '/barn-samtykke-film',
            '/casting-rapport-2026',
            '/bak-castingen',
            '/vart-syn',
            '/selvtape-tips',
          ].map((p) => (
            <Chip key={p} label={p} size="small" sx={{ bgcolor: 'rgba(52,211,153,0.12)', color: '#86efac', fontFamily: 'monospace', fontSize: '0.74rem', fontWeight: 600 }} />
          ))}
        </Stack>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          I 2027 spør folk AI før Google. Hver pillar-side er et frø som vokser uten at du gjør noe mer. Det er gratis brand som konkurrenter (Skuespillerkatalogen, Backstage) ikke kan kjøpe seg ut av. Krever 12-18 mnd å bygge — så jo tidligere, desto bedre.
        </Typography>
      </Stack>
    ),
  },
  {
    icon: <ShieldIcon sx={{ color: '#fbbf24', fontSize: 26 }} />,
    number: '5',
    title: 'Compliance + safety som differensiering',
    body: (
      <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
        Hele tone-stacken er bevisst: Pillar 1 Trust &amp; Safety definerer kategorien, Pillar 4 Compliance taler til produsentens skjulte smerte (Arbeidstilsynet, GDPR, A-melding), og Outreach-template for produsenter leder med <em>"Hvordan håndterer dere Arbeidstilsynet-forhåndssamtykke?"</em>. Hver touchpoint trener markedet på at The Role Room er "the safe choice" vs. konkurrentenes volume play.
        <br /><br />
        Det er en moat AI ikke kan bryte (AI har ikke en mening om sikkerhet) og volum-konkurrenter ikke vil bygge (de tjener på volum, ikke kvalitet). Det selger seg selv hos produsenter med juridisk eksponering — og <strong>alle</strong> norske produsenter har juridisk eksponering når barn er involvert.
      </Typography>
    ),
  },
  {
    icon: <GroupsIcon sx={{ color: '#f472b6', fontSize: 26 }} />,
    number: '6',
    title: 'Referral-graf som vekstmotor',
    body: (
      <Stack spacing={1.5}>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          Når 5 CDs er onboardet, flipper playbook-en fra cold outreach til varm intro. Referral-graf-feltet sporer kjeden:
        </Typography>
        <Stack spacing={0.5} sx={{ pl: 2 }}>
          <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.88rem' }}>
            <Chip label="G1" size="small" sx={{ bgcolor: 'rgba(244,114,182,0.16)', color: '#f9a8d4', fontWeight: 800, fontSize: '0.72rem', height: 20, mr: 1 }} />
            Direkte intro fra Daniels nettverk
          </Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.88rem' }}>
            <Chip label="G2" size="small" sx={{ bgcolor: 'rgba(244,114,182,0.16)', color: '#f9a8d4', fontWeight: 800, fontSize: '0.72rem', height: 20, mr: 1 }} />
            Intro fra en jeg ble intro'ert til
          </Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.88rem' }}>
            <Chip label="G3" size="small" sx={{ bgcolor: 'rgba(244,114,182,0.16)', color: '#f9a8d4', fontWeight: 800, fontSize: '0.72rem', height: 20, mr: 1 }} />
            Tredje grad — fastest growth loop for norsk B2B
          </Typography>
        </Stack>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          Ved Generation 3 bør du være på ~50 CDs uten en eneste kald DM. Systemet er klart for det — du trenger bare data.
        </Typography>
      </Stack>
    ),
  },
  {
    icon: <EmailIcon sx={{ color: '#22d3ee', fontSize: 26 }} />,
    number: '7',
    title: 'Newsletter som relasjons-trener',
    body: (
      <Stack spacing={1.5}>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          Norwegian Casting Brief (egen stack, ingen Beehiiv) gjør tre ting samtidig:
        </Typography>
        <Stack spacing={0.5} sx={{ pl: 2 }}>
          <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.88rem' }}>
            <strong style={{ color: '#22d3ee' }}>Mental availability</strong> — Byron Sharp-prinsippet. Ukentlig touchpoint på 500 mennesker uten å mase
          </Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.88rem' }}>
            <strong style={{ color: '#22d3ee' }}>GEO-bonus</strong> — hver sendte utgave publiseres på /brief/[slug] med Article-schema
          </Typography>
          <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.88rem' }}>
            <strong style={{ color: '#22d3ee' }}>Audience-segmentering</strong> — opens/clicks tracker hvem som faktisk er engaged
          </Typography>
        </Stack>
        <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.93rem', lineHeight: 1.65 }}>
          Repurpose-knappen (Phase 4d) gjør hver utgave til 5 kanaler. Cross-post er systemets håndtering av "1 piece → 10 outputs"-prinsippet fra Content Marketing Plan.
        </Typography>
      </Stack>
    ),
  },
];

export function OperatingSystemTab() {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
        <RocketLaunchIcon sx={{ color: '#a78bfa', fontSize: 28 }} />
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem' }}>
          Operativsystemet bak The Role Room
        </Typography>
      </Stack>
      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.92rem', mb: 3 }}>
        Hvorfor Admin Room er bygd som det er, og hvordan det gir leverage. Søsterdokumenter:{' '}
        <code style={{ color: '#c4b5fd', fontSize: '0.85rem' }}>TheRoleRoom-Content-Marketing-Plan.md</code>,{' '}
        <code style={{ color: '#c4b5fd', fontSize: '0.85rem' }}>TheRoleRoom-Outreach-Plan.md</code>.
      </Typography>

      {/* Kjernepremisset */}
      <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.3)' }}>
        <Typography sx={{ color: '#c4b5fd', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1.5 }}>
          Kjernepremisset
        </Typography>
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.96rem', lineHeight: 1.7, mb: 1.5 }}>
          Norsk filmbransje er ~500 mennesker. Klassisk B2B SaaS-strategi (volum-outreach, paid acquisition, growth hacking) er ikke bare ineffektiv her — den er aktiv skadelig. Én generisk mail som treffer feil casting director i Oslo, og ryktet er satt før The Role Room rekker å bygges.
        </Typography>
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.96rem', lineHeight: 1.7, mb: 1.5 }}>
          Samtidig er Daniel solo-lead. Han må gjøre arbeidet til 5 mennesker uten å sende en eneste generisk melding. Det krever et operativsystem, ikke en SaaS-bunke.
        </Typography>
        <Typography sx={{ color: '#a78bfa', fontWeight: 700, fontSize: '1rem' }}>
          Admin Room er det operativsystemet.
        </Typography>
      </Paper>

      {/* 7 prinsipper */}
      <Stack spacing={3} sx={{ mb: 4 }}>
        {SECTIONS.map((section) => (
          <Paper
            key={section.number}
            sx={{
              p: 2.5,
              bgcolor: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(148,163,184,0.16)',
            }}
          >
            <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 1.5 }}>
              {section.icon}
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {section.number} / 7
                </Typography>
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.3 }}>
                  {section.title}
                </Typography>
              </Box>
            </Stack>
            {section.body}
          </Paper>
        ))}
      </Stack>

      {/* Den korte versjonen */}
      <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.35)' }}>
        <Typography sx={{ color: '#22d3ee', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1.5 }}>
          Den korte versjonen
        </Typography>
        <Typography sx={{ color: '#e2e8f0', fontSize: '1.02rem', lineHeight: 1.75, fontStyle: 'italic' }}>
          Admin Room er bygd så <strong>én person kan drive forretningsutvikling i norsk filmbransje med disiplinen til et 10-personers team</strong> — og samtidig la 18 måneders kompounding fra GEO + relasjoner + brand bygge moat-en mens du sover.
        </Typography>
      </Paper>

      {/* Hva som faktisk må gjøres */}
      <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.3)' }}>
        <Typography sx={{ color: '#fbbf24', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>
          Det viktigste å huske
        </Typography>
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.96rem', lineHeight: 1.7, mb: 2 }}>
          Systemet er verdiløst uten data. Konkret startpunkt (uke 1 fra Outreach Plan finnes som checklist i Tier-1 CRM):
        </Typography>
        <Stack spacing={1}>
          {[
            ['Mandag', 'Voice memo 30 min om denne uka → 3 utkast levert av Claude'],
            ['Tirsdag', 'Fyll inn recent_productions for 15 Tier-1 CDs (10 min/target = 2.5 t)'],
            ['Onsdag', 'Generér AI-personlig DM for én CD → send'],
            ['Torsdag', 'Samme for én produsent'],
            ['Fredag', 'Sjekk Tier-1-tab — hvem er klar for Touch 2?'],
            ['Sluttuka', 'Newsletter sendes automatisk fredag 08:00'],
          ].map(([day, action]) => (
            <Stack key={day} direction="row" spacing={1.5} alignItems="flex-start">
              <Chip label={day} size="small" sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fde68a', fontWeight: 700, fontSize: '0.74rem', minWidth: 68, height: 22 }} />
              <Typography sx={{ color: 'rgba(229,231,235,0.88)', fontSize: '0.88rem', lineHeight: 1.6, flex: 1 }}>{action}</Typography>
            </Stack>
          ))}
        </Stack>
        <Divider sx={{ my: 2, borderColor: 'rgba(251,191,36,0.18)' }} />
        <Typography sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.88rem', lineHeight: 1.7 }}>
          Etter 4 uker: ~60 mennesker i CRM, ~20 med engagement-historikk, ~5 møter booket, GEO-frøene begynner å spire. Det er da moat-en blir synlig.
        </Typography>
      </Paper>
    </Box>
  );
}

export default OperatingSystemTab;

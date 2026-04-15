// @ts-nocheck
import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  Box,
  Chip,
  CssBaseline,
  Divider,
  Stack,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material';

type SceneVariant =
  | 'resume-editor'
  | 'resume-templates'
  | 'resume-insights'
  | 'gallery-grid'
  | 'feature-story'
  | 'analytics'
  | 'contract-builder'
  | 'contract-review'
  | 'contract-signing'
  | 'finance-pipeline'
  | 'finance-ledger'
  | 'invoice-composer'
  | 'invoice-tracking'
  | 'crm-pipeline'
  | 'crm-conversation'
  | 'crm-success'
  | 'time-capture'
  | 'time-timeline'
  | 'time-insights';

type SceneConfig = {
  id: string;
  productId: string;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  variant: SceneVariant;
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#06070b',
      paper: '#10131a',
    },
  },
  typography: {
    fontFamily: '"Manrope", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

const scenes: SceneConfig[] = [
  {
    id: 'resume-builder-editor',
    productId: 'resume-builder',
    label: 'Editor',
    eyebrow: 'ResumeBuilder',
    title: 'CV med målrettet erfaring og konkrete resultater',
    subtitle: 'Finpuss tekst, kompetanse og høydepunkter i ett arbeidsrom.',
    accent: '#ff8c00',
    variant: 'resume-editor',
  },
  {
    id: 'resume-builder-templates',
    productId: 'resume-builder',
    label: 'Maler',
    eyebrow: 'ResumeBuilder',
    title: 'Velg uttrykk før du eksporterer eller deler',
    subtitle: 'Maler, fargeprofil og kort tilpasning for ulike roller.',
    accent: '#ff8c00',
    variant: 'resume-templates',
  },
  {
    id: 'resume-builder-insights',
    productId: 'resume-builder',
    label: 'Analyse',
    eyebrow: 'ResumeBuilder',
    title: 'Match score, nøkkelord og forslag til forbedring',
    subtitle: 'Se hva som styrker søknaden før du sender.',
    accent: '#ff8c00',
    variant: 'resume-insights',
  },
  {
    id: 'portfolio-pro-gallery',
    productId: 'portfolio-pro',
    label: 'Galleri',
    eyebrow: 'Portfolio Pro',
    title: 'Kurater prosjekter med tydelig bildehierarki',
    subtitle: 'Sorter serier, cover og case-studier uten støy.',
    accent: '#7c3aed',
    variant: 'gallery-grid',
  },
  {
    id: 'portfolio-pro-story',
    productId: 'portfolio-pro',
    label: 'Case study',
    eyebrow: 'Portfolio Pro',
    title: 'Bygg en fortelling rundt hver leveranse',
    subtitle: 'Vis prosess, leveranser og utvalgte detaljer i samme visning.',
    accent: '#ec4899',
    variant: 'feature-story',
  },
  {
    id: 'portfolio-pro-insights',
    productId: 'portfolio-pro',
    label: 'Innsikt',
    eyebrow: 'Portfolio Pro',
    title: 'Følg visninger, respons og kontaktforespørsler',
    subtitle: 'Se hvilke prosjekter som faktisk skaper handling.',
    accent: '#6366f1',
    variant: 'analytics',
  },
  {
    id: 'contract-genius-builder',
    productId: 'contract-genius',
    label: 'Bygging',
    eyebrow: 'Contract Genius',
    title: 'Sett opp avtaler med moduler for ansvar, levering og pris',
    subtitle: 'Kontrakten formes i seksjoner i stedet for lange dokumenttrinn.',
    accent: '#10b981',
    variant: 'contract-builder',
  },
  {
    id: 'contract-genius-review',
    productId: 'contract-genius',
    label: 'Gjennomgang',
    eyebrow: 'Contract Genius',
    title: 'Se endringer, kommentarer og risiko i samme løp',
    subtitle: 'Ryddig revisjon før dokumentet sendes videre.',
    accent: '#0f766e',
    variant: 'contract-review',
  },
  {
    id: 'contract-genius-signing',
    productId: 'contract-genius',
    label: 'Signering',
    eyebrow: 'Contract Genius',
    title: 'Hold orden på signaturer, vedlegg og fremdrift',
    subtitle: 'Avklar hvem som mangler og hva som er låst.',
    accent: '#22c55e',
    variant: 'contract-signing',
  },
  {
    id: 'accounting-integration-flow',
    productId: 'accounting-integration',
    label: 'Flyt',
    eyebrow: 'Fakturaflyt og regnskapsoppsett',
    title: 'Fra avtale til faktura, betaling og bokføringsgrunnlag',
    subtitle: 'Én oversikt over hva som er synket og hva som gjenstår.',
    accent: '#0f172a',
    variant: 'finance-pipeline',
  },
  {
    id: 'accounting-integration-ledger',
    productId: 'accounting-integration',
    label: 'Avstemming',
    eyebrow: 'Fakturaflyt og regnskapsoppsett',
    title: 'Bilag, kvitteringer og statuslinjer for videre bokføring',
    subtitle: 'Se hva som er klart for regnskap uten manuell sortering.',
    accent: '#334155',
    variant: 'finance-ledger',
  },
  {
    id: 'accounting-integration-payouts',
    productId: 'accounting-integration',
    label: 'Oppfølging',
    eyebrow: 'Fakturaflyt og regnskapsoppsett',
    title: 'Følg opp innbetalinger og manglende dokumentasjon',
    subtitle: 'Marker hva som krever handling før perioden lukkes.',
    accent: '#475569',
    variant: 'invoice-tracking',
  },
  {
    id: 'invoice-pro-compose',
    productId: 'invoice-pro',
    label: 'Fakturering',
    eyebrow: 'Invoice Pro',
    title: 'Sett opp fakturaer med tydelige linjer og leveransegrunnlag',
    subtitle: 'Alt som skal sendes blir kontrollert før utsending.',
    accent: '#f59e0b',
    variant: 'invoice-composer',
  },
  {
    id: 'invoice-pro-tracking',
    productId: 'invoice-pro',
    label: 'Sporing',
    eyebrow: 'Invoice Pro',
    title: 'Se hvilke fakturaer som er sendt, åpnet og betalt',
    subtitle: 'Varsler og neste steg samlet i én finansvisning.',
    accent: '#d97706',
    variant: 'invoice-tracking',
  },
  {
    id: 'invoice-pro-recurring',
    productId: 'invoice-pro',
    label: 'Oppsett',
    eyebrow: 'Invoice Pro',
    title: 'Klargjør faste løp og gjentakende fakturaregler',
    subtitle: 'Passer for avtaler med forutsigbar levering over tid.',
    accent: '#b45309',
    variant: 'finance-pipeline',
  },
  {
    id: 'client-management-pipeline',
    productId: 'client-management',
    label: 'Pipeline',
    eyebrow: 'Client Hub',
    title: 'Følg nye leads, aktive kunder og leveranser i flyt',
    subtitle: 'Se hvor hver relasjon står uten å hoppe mellom verktøy.',
    accent: '#8b5cf6',
    variant: 'crm-pipeline',
  },
  {
    id: 'client-management-communication',
    productId: 'client-management',
    label: 'Kommunikasjon',
    eyebrow: 'Client Hub',
    title: 'Saml tråder, notater og oppgaver rundt hver kunde',
    subtitle: 'Hold fokus på dialog og neste respons.',
    accent: '#7c3aed',
    variant: 'crm-conversation',
  },
  {
    id: 'client-management-outcomes',
    productId: 'client-management',
    label: 'Oppfølging',
    eyebrow: 'Client Hub',
    title: 'Se hva som har konvertert og hva som trenger oppfølging',
    subtitle: 'Mål respons, tilbud og leveransehastighet samlet.',
    accent: '#6366f1',
    variant: 'crm-success',
  },
  {
    id: 'time-tracker-capture',
    productId: 'time-tracker',
    label: 'Føring',
    eyebrow: 'Time Tracker',
    title: 'Start, stopp og loggfør arbeid uten å miste kontekst',
    subtitle: 'Timer, tags og prosjektvalg i samme arbeidsflate.',
    accent: '#06b6d4',
    variant: 'time-capture',
  },
  {
    id: 'time-tracker-timeline',
    productId: 'time-tracker',
    label: 'Oversikt',
    eyebrow: 'Time Tracker',
    title: 'Se dager, blokker og prosjektfordeling i én tidslinje',
    subtitle: 'Oppdag hull, dobbeltarbeid og tunge perioder tidlig.',
    accent: '#0891b2',
    variant: 'time-timeline',
  },
  {
    id: 'time-tracker-insights',
    productId: 'time-tracker',
    label: 'Analyse',
    eyebrow: 'Time Tracker',
    title: 'Bryt ned tidsbruk, lønnsomhet og kapasitet per uke',
    subtitle: 'Gjør arbeidstid om til tydelige beslutninger.',
    accent: '#0e7490',
    variant: 'time-insights',
  },
];

const barGradient = (accent: string) =>
  `linear-gradient(135deg, ${accent} 0%, rgba(255,255,255,0.08) 100%)`;

const previewSurface = (accent: string) => ({
  '--accent': accent,
  width: 1180,
  height: 720,
  borderRadius: '34px',
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  background:
    `radial-gradient(circle at top left, ${accent}22 0%, rgba(6,7,11,0.96) 32%), linear-gradient(180deg, rgba(18,22,31,0.98) 0%, rgba(9,11,16,1) 100%)`,
  boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
});

function MetricBar({ label, value, width, accent }: { label: string; value: string; width: number; accent: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '132px 1fr auto', alignItems: 'center', gap: 1.5 }}>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)', letterSpacing: '0.03em' }}>
        {label}
      </Typography>
      <Box sx={{ height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <Box sx={{ width: `${width}%`, height: '100%', background: barGradient(accent) }} />
      </Box>
      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700 }}>
        {value}
      </Typography>
    </Box>
  );
}

function Tile({ title, caption, accent }: { title: string; caption: string; accent: string }) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        p: 2,
        minHeight: 132,
        background: `linear-gradient(180deg, ${accent}20 0%, rgba(255,255,255,0.02) 100%)`,
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Box sx={{ width: 44, height: 4, borderRadius: 999, mb: 2, background: barGradient(accent) }} />
      <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.75 }}>{title}</Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.82rem', lineHeight: 1.5 }}>{caption}</Typography>
    </Box>
  );
}

function DataTable({
  rows,
  accent,
}: {
  rows: Array<{ primary: string; secondary: string; amount?: string; status: string }>;
  accent: string;
}) {
  return (
    <Box sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      {rows.map((row, index) => (
        <Box
          key={`${row.primary}-${index}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr auto auto',
            gap: 2,
            px: 2.25,
            py: 1.55,
            alignItems: 'center',
            background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
            borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{row.primary}</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.75rem' }}>{row.secondary}</Typography>
          </Box>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
            {row.amount || 'Klar'}
          </Typography>
          <Chip
            label={row.status}
            size="small"
            sx={{
              color: '#fff',
              background: `${accent}25`,
              border: `1px solid ${accent}55`,
              fontWeight: 700,
            }}
          />
          <Box sx={{ width: 8, height: 8, borderRadius: 999, background: accent }} />
        </Box>
      ))}
    </Box>
  );
}

function MediaGrid({ accent }: { accent: string }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: 1.5,
        height: '100%',
      }}
    >
      <Box
        sx={{
          gridRow: 'span 2',
          borderRadius: 3,
          overflow: 'hidden',
          background: `linear-gradient(180deg, ${accent}30 0%, rgba(255,255,255,0.03) 100%)`,
          border: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
        }}
      >
        <Box sx={{ position: 'absolute', inset: 22, borderRadius: 3, background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02))' }} />
        <Box sx={{ position: 'absolute', left: 28, right: 28, bottom: 28 }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem', mb: 0.75 }}>Utvalgt prosjekt</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.64)', fontSize: '0.84rem' }}>
            Cover, utdrag og prosjekttekst i en ren showcase-visning.
          </Typography>
        </Box>
      </Box>
      {['Detaljer', 'Galleri', 'Leveranse', 'Respons'].map((label, index) => (
        <Box
          key={label}
          sx={{
            borderRadius: 3,
            background: index % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'absolute', inset: 14, borderRadius: 2.5, background: 'rgba(255,255,255,0.07)' }} />
          <Typography sx={{ position: 'absolute', left: 18, bottom: 14, color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>
            {label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function SceneBody({ scene }: { scene: SceneConfig }) {
  const accent = scene.accent;
  switch (scene.variant) {
    case 'resume-editor':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1.2, borderRadius: 3, p: 2.25, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', mb: 1.5 }}>Erfaringsseksjon</Typography>
            <Stack spacing={1.5}>
              {[
                'Ledet leveranse fra første brief til ferdig publisering',
                'Koordinerte klientdialog, budsjettramme og overlevering',
                'Dokumenterte resultater med tydelige KPI-er og kontekst',
              ].map((line) => (
                <Box key={line} sx={{ p: 1.5, borderRadius: 2.5, background: 'rgba(255,255,255,0.04)' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.88rem' }}>{line}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
          <Box sx={{ flex: 0.9, display: 'grid', gap: 1.5 }}>
            <Tile title="Nøkkelkvalifikasjoner" caption="Prosjektledelse, visuell historiefortelling og strukturert levering." accent={accent} />
            <Tile title="Eksportklare versjoner" caption="Ulike versjoner tilpasset spesifikke roller og søknadstyper." accent={accent} />
            <Tile title="ATS-vennlig struktur" caption="Format og språk holdes konsistent før deling." accent={accent} />
          </Box>
        </Stack>
      );
    case 'resume-templates':
      return (
        <Stack direction="row" spacing={2}>
          {[1, 2, 3].map((template) => (
            <Box key={template} sx={{ flex: 1, borderRadius: 3, p: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Box sx={{ height: 220, borderRadius: 2.5, background: `linear-gradient(180deg, ${accent}22 0%, rgba(255,255,255,0.02) 100%)`, border: '1px solid rgba(255,255,255,0.05)', mb: 1.75, p: 2 }}>
                <Box sx={{ width: '46%', height: 12, borderRadius: 999, background: barGradient(accent), mb: 1.5 }} />
                <Stack spacing={1}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Box key={i} sx={{ height: i === 0 ? 10 : 8, width: i % 3 === 0 ? '78%' : i % 2 === 0 ? '92%' : '66%', borderRadius: 999, background: 'rgba(255,255,255,0.2)' }} />
                  ))}
                </Stack>
              </Box>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>Oppsett {template}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.8rem' }}>Rolig typografi, tydelig erfaring og rene seksjoner.</Typography>
            </Box>
          ))}
        </Stack>
      );
    case 'resume-insights':
    case 'analytics':
    case 'time-insights':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1.1, borderRadius: 3, p: 2.25, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Stack spacing={1.65}>
              <MetricBar label="Match score" value="92%" width={92} accent={accent} />
              <MetricBar label="Responsrate" value="68%" width={68} accent={accent} />
              <MetricBar label="Prioriterte treff" value="81%" width={81} accent={accent} />
              <MetricBar label="Kvalitetsnivå" value="87%" width={87} accent={accent} />
            </Stack>
          </Box>
          <Box sx={{ flex: 0.9, display: 'grid', gap: 1.5 }}>
            <Tile title="Sterkeste seksjon" caption="Prosjektbeskrivelser med tydelige leveranser og resultater." accent={accent} />
            <Tile title="Neste justering" caption="Legg til noen flere målbare resultater der det passer." accent={accent} />
            <Tile title="Delingsklar" caption="Oppsettet er konsistent på tvers av eksport og visning." accent={accent} />
          </Box>
        </Stack>
      );
    case 'gallery-grid':
      return <MediaGrid accent={accent} />;
    case 'feature-story':
      return (
        <Stack direction="row" spacing={2} sx={{ height: '100%' }}>
          <Box sx={{ flex: 1.15, borderRadius: 3, background: `linear-gradient(180deg, ${accent}32 0%, rgba(255,255,255,0.03) 100%)`, border: '1px solid rgba(255,255,255,0.06)', p: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <Chip label="Case study" size="small" sx={{ alignSelf: 'flex-start', mb: 1.5, background: '#fff', color: '#111827', fontWeight: 800 }} />
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.15rem', mb: 0.75 }}>Prosess, leveranse og effekt i ett narrativ</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.86rem', maxWidth: 420 }}>
              Presenter målet, utvalget og sluttproduktet som én sammenhengende historie.
            </Typography>
          </Box>
          <Box sx={{ flex: 0.95, display: 'grid', gap: 1.5 }}>
            <Tile title="Forside" caption="Hovedbilde, nøkkeltekst og utvalgte highlights." accent={accent} />
            <Tile title="Leveranser" caption="Vis filer, formater og utdrag uten å bryte flyten." accent={accent} />
            <Tile title="Respons" caption="Følg visninger, delinger og kontaktpunkter per case." accent={accent} />
          </Box>
        </Stack>
      );
    case 'contract-builder':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1.15, borderRadius: 3, p: 2.25, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1.6 }}>Avtalestruktur</Typography>
            <Stack spacing={1.2}>
              {['Oppdrag og leveranse', 'Pris og betalingsløp', 'Ansvar og revisjoner', 'Bruk av materiale'].map((item) => (
                <Box key={item} sx={{ px: 1.75, py: 1.35, borderRadius: 2.5, background: 'rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.86rem' }}>{item}</Typography>
                  <Box sx={{ width: 8, height: 8, borderRadius: 999, background: accent }} />
                </Box>
              ))}
            </Stack>
          </Box>
          <Box sx={{ flex: 0.95, display: 'grid', gap: 1.5 }}>
            <Tile title="Maler" caption="Start fra oppdragstype og legg til bare relevante moduler." accent={accent} />
            <Tile title="Versjoner" caption="Hold styr på endringer før dokumentet låses." accent={accent} />
            <Tile title="Sendeklart" caption="Kontrakten går videre med vedlegg og signatursteg." accent={accent} />
          </Box>
        </Stack>
      );
    case 'contract-review':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1.15 }}>
            <DataTable
              accent={accent}
              rows={[
                { primary: 'Leveransefrist', secondary: 'Tydelig formulert', status: 'Godkjent' },
                { primary: 'Endringsrunder', secondary: 'Avklart i to steg', status: 'Justert' },
                { primary: 'Bruksrett', secondary: 'Krever siste kontroll', status: 'Avventer' },
                { primary: 'Betalingsplan', secondary: 'Oppdatert med milepæler', status: 'Godkjent' },
              ]}
            />
          </Box>
          <Box sx={{ flex: 0.9, display: 'grid', gap: 1.5 }}>
            <Tile title="Kommentarspor" caption="Vis hva som er nytt siden forrige runde og hvem som må svare." accent={accent} />
            <Tile title="Risikovarsel" caption="Flagg seksjoner som fortsatt trenger tydeligere avklaring." accent={accent} />
            <Tile title="Beslutning" caption="Klargjør dokumentet for utsending når alt er avklart." accent={accent} />
          </Box>
        </Stack>
      );
    case 'contract-signing':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1, display: 'grid', gap: 1.5 }}>
            <Tile title="Signaturløp" caption="Send ut dokumentet og se hvem som gjenstår." accent={accent} />
            <Tile title="Vedlegg" caption="Hold vedlegg og dokumentversjon samlet i samme kjede." accent={accent} />
            <Tile title="Arkiv" caption="Signeringsstatus og tilgang er lett å spore i etterkant." accent={accent} />
          </Box>
          <Box sx={{ flex: 1.05, borderRadius: 3, p: 2.25, background: `linear-gradient(180deg, ${accent}20 0%, rgba(255,255,255,0.03) 100%)`, border: '1px solid rgba(255,255,255,0.06)' }}>
            <DataTable
              accent={accent}
              rows={[
                { primary: 'Avsender', secondary: 'Dokumentet er sendt', status: 'Klart' },
                { primary: 'Part 1', secondary: 'Har sett dokumentet', status: 'Pågår' },
                { primary: 'Part 2', secondary: 'Mangler bekreftelse', status: 'Venter' },
              ]}
            />
          </Box>
        </Stack>
      );
    case 'finance-pipeline':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1.2, borderRadius: 3, p: 2.25, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Stack direction="row" spacing={1.2} sx={{ mb: 2.2 }}>
              {['Avtale', 'Fakturakladd', 'Sendt', 'Betalt', 'Bokført'].map((step, index) => (
                <Box key={step} sx={{ flex: 1, borderRadius: 2.5, p: 1.2, background: index < 4 ? `${accent}1f` : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>{step}</Typography>
                </Box>
              ))}
            </Stack>
            <DataTable
              accent={accent}
              rows={[
                { primary: 'Periodeoversikt', secondary: 'Klar til utsending', amount: '4 løp', status: 'Aktiv' },
                { primary: 'Fakturagrunnlag', secondary: 'Venter dokumentasjon', amount: '2 løp', status: 'Sjekk' },
                { primary: 'Betalingsoppfølging', secondary: 'Neste frist om 3 dager', amount: '3 løp', status: 'Pågår' },
              ]}
            />
          </Box>
          <Box sx={{ flex: 0.85, display: 'grid', gap: 1.5 }}>
            <Tile title="Synkstatus" caption="Se hvilke steg som er klare før de går videre til regnskap." accent={accent} />
            <Tile title="Dokumentasjon" caption="Mangler blir synlige før perioden avsluttes." accent={accent} />
            <Tile title="Kontroll" caption="Flyten er gjort tydelig for både oppfølging og bokføring." accent={accent} />
          </Box>
        </Stack>
      );
    case 'finance-ledger':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1.1 }}>
            <DataTable
              accent={accent}
              rows={[
                { primary: 'Bilag 014', secondary: 'Kvittering registrert', amount: '3 450 kr', status: 'OK' },
                { primary: 'Bilag 019', secondary: 'Manglende vedlegg', amount: '1 280 kr', status: 'Sjekk' },
                { primary: 'Bilag 024', secondary: 'Avstemt mot betaling', amount: '6 900 kr', status: 'OK' },
                { primary: 'Bilag 027', secondary: 'Klar for eksport', amount: '2 140 kr', status: 'Klar' },
              ]}
            />
          </Box>
          <Box sx={{ flex: 0.9, display: 'grid', gap: 1.5 }}>
            <Tile title="Kvitteringer" caption="Få oversikt over hva som mangler uten ekstra manuell sjekk." accent={accent} />
            <Tile title="Eksportgrunnlag" caption="Perioden blir enklere å lukke når status er synlig." accent={accent} />
            <Tile title="Historikk" caption="Se hva som allerede er avklart og hva som gjenstår." accent={accent} />
          </Box>
        </Stack>
      );
    case 'invoice-composer':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1.2, borderRadius: 3, p: 2.2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1.5 }}>Fakturalinjer</Typography>
            <DataTable
              accent={accent}
              rows={[
                { primary: 'Forarbeid', secondary: 'Planlegging og brief', amount: '2 900 kr', status: 'Klar' },
                { primary: 'Produksjon', secondary: 'Leveranse og opptak', amount: '8 200 kr', status: 'Klar' },
                { primary: 'Etterarbeid', secondary: 'Utvalg og eksport', amount: '3 100 kr', status: 'Klar' },
              ]}
            />
          </Box>
          <Box sx={{ flex: 0.85, display: 'grid', gap: 1.5 }}>
            <Tile title="Sendeklart" caption="Kontroller språk, linjer og total før utsending." accent={accent} />
            <Tile title="Mottaker" caption="Hver faktura holdes knyttet til riktig leveranse og kunde." accent={accent} />
            <Tile title="Integrasjon" caption="Gå videre til regnskap eller oppfølging uten ekstra eksportsteg." accent={accent} />
          </Box>
        </Stack>
      );
    case 'invoice-tracking':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1.1 }}>
            <DataTable
              accent={accent}
              rows={[
                { primary: 'INV-104', secondary: 'Sendt i går', amount: '7 800 kr', status: 'Åpnet' },
                { primary: 'INV-105', secondary: 'Forfalt om 2 dager', amount: '3 100 kr', status: 'Pågår' },
                { primary: 'INV-106', secondary: 'Betalt i dag', amount: '12 400 kr', status: 'Betalt' },
                { primary: 'INV-107', secondary: 'Venter godkjenning', amount: '5 600 kr', status: 'Klargjør' },
              ]}
            />
          </Box>
          <Box sx={{ flex: 0.9, display: 'grid', gap: 1.5 }}>
            <Tile title="Statussporing" caption="Se hvilke fakturaer som trenger handling før noe glipper." accent={accent} />
            <Tile title="Varsler" caption="Fremhev åpning, betaling og oppfølging på riktig tidspunkt." accent={accent} />
            <Tile title="Kontrollpanel" caption="Samle tall og tiltak i samme finansflate." accent={accent} />
          </Box>
        </Stack>
      );
    case 'crm-pipeline':
      return (
        <Stack direction="row" spacing={1.5}>
          {[
            ['Nye henvendelser', ['Brief mottatt', 'Forespørsel under vurdering']],
            ['Tilbud sendt', ['Tilbud sendt', 'Møte foreslått']],
            ['Aktive løp', ['Produksjon pågår', 'Leveranse klar']],
            ['Oppfølging', ['Be om tilbakemelding', 'Planlegg neste steg']],
          ].map(([title, items], columnIndex) => (
            <Box key={title} sx={{ flex: 1, borderRadius: 3, p: 1.8, background: columnIndex === 1 ? `${accent}14` : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1.35 }}>{title}</Typography>
              <Stack spacing={1}>
                {(items as string[]).map((item) => (
                  <Box key={item} sx={{ px: 1.2, py: 1.1, borderRadius: 2.5, background: 'rgba(255,255,255,0.05)' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.8rem' }}>{item}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      );
    case 'crm-conversation':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 0.8, borderRadius: 3, p: 1.6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Stack spacing={1}>
              {['Ny forespørsel', 'Briefoppfølging', 'Tilbudspassasje', 'Leveranseplan'].map((thread, index) => (
                <Box key={thread} sx={{ px: 1.2, py: 1.1, borderRadius: 2.2, background: index === 1 ? `${accent}18` : 'rgba(255,255,255,0.04)' }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>{thread}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.74rem' }}>Siste oppdatering for 2 timer siden</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
          <Box sx={{ flex: 1.2, borderRadius: 3, p: 2.1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Stack spacing={1.2}>
              {[
                'Hei, her ligger neste forslag til leveranseplan.',
                'Fint, da følger vi samme tidslinje som avtalt.',
                'Jeg legger inn siste oppgave og sender oppdatert oversikt.',
              ].map((message, index) => (
                <Box key={message} sx={{ alignSelf: index === 1 ? 'flex-end' : 'flex-start', maxWidth: '74%', px: 1.35, py: 1.1, borderRadius: 2.5, background: index === 1 ? `${accent}24` : 'rgba(255,255,255,0.05)' }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.82rem', lineHeight: 1.45 }}>{message}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      );
    case 'crm-success':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1.1, borderRadius: 3, p: 2.2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Stack spacing={1.55}>
              <MetricBar label="Nye leads" value="18" width={74} accent={accent} />
              <MetricBar label="Aktive tilbud" value="9" width={58} accent={accent} />
              <MetricBar label="Konvertering" value="42%" width={42} accent={accent} />
              <MetricBar label="Oppfølging innen frist" value="91%" width={91} accent={accent} />
            </Stack>
          </Box>
          <Box sx={{ flex: 0.9, display: 'grid', gap: 1.5 }}>
            <Tile title="Oversikt" caption="Vit hvor i prosessen hver relasjon står uten ekstra friksjon." accent={accent} />
            <Tile title="Mønstre" caption="Se hvor responsen faktisk faller og hvor oppfølging fungerer." accent={accent} />
            <Tile title="Neste trekk" caption="Prioriter riktige samtaler og oppgaver fra samme view." accent={accent} />
          </Box>
        </Stack>
      );
    case 'time-capture':
      return (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 0.85, display: 'grid', gap: 1.5 }}>
            <Tile title="Pågående økt" caption="Start og stopp føring uten å miste prosjektkontekst." accent={accent} />
            <Tile title="Kategorier" caption="Fordel arbeid mellom produksjon, koordinering og etterarbeid." accent={accent} />
            <Tile title="Rask logg" caption="Legg til notat og timeføring på samme sted." accent={accent} />
          </Box>
          <Box sx={{ flex: 1.15, borderRadius: 3, p: 2.2, background: `linear-gradient(180deg, ${accent}18 0%, rgba(255,255,255,0.03) 100%)`, border: '1px solid rgba(255,255,255,0.06)' }}>
            <Box sx={{ mb: 2.3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.12rem' }}>Timer</Typography>
              <Chip label="03:42:18" sx={{ color: '#fff', background: `${accent}22`, border: `1px solid ${accent}55`, fontWeight: 800 }} />
            </Box>
            <DataTable
              accent={accent}
              rows={[
                { primary: 'Produksjon', secondary: 'Føring aktiv', amount: '2 t 10 m', status: 'Live' },
                { primary: 'Koordinering', secondary: 'Logget tidligere i dag', amount: '54 m', status: 'OK' },
                { primary: 'Etterarbeid', secondary: 'Planlagt senere', amount: '38 m', status: 'Neste' },
              ]}
            />
          </Box>
        </Stack>
      );
    case 'time-timeline':
      return (
        <Stack spacing={1.5}>
          {[
            ['Mandag', [82, 38, 64]],
            ['Tirsdag', [54, 70, 46]],
            ['Onsdag', [91, 28, 58]],
            ['Torsdag', [66, 52, 72]],
          ].map(([day, widths]) => (
            <Box key={day as string} sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1.5, alignItems: 'center' }}>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>{day as string}</Typography>
              <Box sx={{ display: 'flex', gap: 1, height: 24 }}>
                {(widths as number[]).map((width, index) => (
                  <Box
                    key={index}
                    sx={{
                      width: `${width}%`,
                      borderRadius: 999,
                      background: index === 1 ? 'rgba(255,255,255,0.12)' : barGradient(accent),
                    }}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      );
  }
}

function PreviewScene({ scene }: { scene: SceneConfig }) {
  return (
    <Box
      data-scene={scene.id}
      sx={{
        ...previewSurface(scene.accent),
        position: 'relative',
        p: 3,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        {['#fb7185', '#fbbf24', '#34d399'].map((dot) => (
          <Box key={dot} sx={{ width: 10, height: 10, borderRadius: 999, background: dot, opacity: 0.92 }} />
        ))}
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={3} sx={{ mb: 2.6 }}>
        <Box sx={{ maxWidth: 560 }}>
          <Typography sx={{ color: scene.accent, fontSize: '0.74rem', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 800, mb: 1.2 }}>
            {scene.eyebrow}
          </Typography>
          <Typography sx={{ color: '#fff', fontSize: '2rem', lineHeight: 1.1, fontWeight: 800, mb: 1.2 }}>
            {scene.title}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.96rem', maxWidth: 520 }}>
            {scene.subtitle}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip
            label={scene.label}
            size="small"
            sx={{
              color: '#fff',
              background: `${scene.accent}22`,
              border: `1px solid ${scene.accent}50`,
              fontWeight: 800,
            }}
          />
          <Chip
            label="Anonym demo"
            size="small"
            sx={{
              color: 'rgba(255,255,255,0.82)',
              background: 'rgba(255,255,255,0.06)',
              fontWeight: 700,
            }}
          />
        </Stack>
      </Stack>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2.6 }} />
      <SceneBody scene={scene} />
    </Box>
  );
}

function MarketplacePreviewsPage() {
  const grouped = scenes.reduce<Record<string, SceneConfig[]>>((acc, scene) => {
    acc[scene.productId] = acc[scene.productId] || [];
    acc[scene.productId].push(scene);
    return acc;
  }, {});

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background:
            'radial-gradient(circle at top, rgba(255,140,0,0.08), transparent 22%), linear-gradient(180deg, #05060a 0%, #090b10 100%)',
          px: 4,
          py: 6,
        }}
      >
        <Box sx={{ maxWidth: 1260, mx: 'auto', mb: 5 }}>
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '2.4rem', mb: 1.25 }}>
            Marketplace preview board
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.62)', maxWidth: 760, fontSize: '1rem' }}>
            Anonyme, kuraterte produktscener for screenshot-batch til CreatorHub Marketplace. Hver scene er laget for å være ren, konsistent og uten bedriftsnavn.
          </Typography>
        </Box>
        <Stack spacing={5} sx={{ maxWidth: 1260, mx: 'auto' }}>
          {Object.values(grouped).map((productScenes) => (
            <Stack key={productScenes[0].productId} spacing={2}>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.74 }}>
                {productScenes[0].eyebrow}
              </Typography>
              <Stack spacing={3.5}>
                {productScenes.map((scene) => (
                  <PreviewScene key={scene.id} scene={scene} />
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Box>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MarketplacePreviewsPage />
  </React.StrictMode>
);

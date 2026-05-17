/**
 * VaultSecurityGuide — full sikkerhetsguide for The Role Room Vault.
 *
 * Vises som modal når bruker klikker "Slik fungerer sikkerheten" i
 * Client Access Vault-headeren. Forklarer kryptering, 2FA-step-up,
 * reveal-flyt, audit-log og rolle-modell på lekmannsspråk så
 * markedsføreren kan forsikre klienten om at deres passord er trygge.
 *
 * Strukturen følger Bruce Schneiers prinsipp: "trust through
 * transparency" — vis nøyaktig hva som skjer i bakgrunnen så
 * brukeren kan bestemme om de stoler på løsningen.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  Key as KeyIcon,
  Visibility as VisibilityIcon,
  History as HistoryIcon,
  AdminPanelSettings as RoleIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

export interface VaultSecurityGuideProps {
  open: boolean;
  onClose: () => void;
}

interface GuideSection {
  id: string;
  title: string;
  Icon: React.ElementType;
  iconColor: string;
  oneLineSummary: string;
  details: React.ReactNode;
}

// ── Helpers (deklarert FØR SECTIONS siden de refereres i details-feltet
//   ved modul-evaluering, ikke senere ved render) ───────────────────────

interface RoleCardProps {
  role: string;
  permissions: string[];
  color: string;
}

const RoleCard: React.FC<RoleCardProps> = ({ role, permissions, color }) => (
  <Box
    sx={{
      p: 1.2,
      borderRadius: 1,
      bgcolor: 'rgba(15,23,42,0.5)',
      borderLeft: `3px solid ${color}`,
    }}
  >
    <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc', mb: 0.4 }}>
      {role}
    </Typography>
    <Stack spacing={0.2}>
      {permissions.map((p) => (
        <Typography key={p} sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.7)' }}>
          • {p}
        </Typography>
      ))}
    </Stack>
  </Box>
);

const infoBoxSx = {
  p: 1.4,
  borderRadius: 1,
  bgcolor: 'rgba(15,23,42,0.45)',
  border: '1px solid rgba(148,163,184,0.16)',
} as const;

const codeSx: React.CSSProperties = {
  fontFamily: '"SF Mono", Menlo, monospace',
  fontSize: '0.85em',
  background: 'rgba(34,211,238,0.12)',
  color: '#22d3ee',
  padding: '1px 5px',
  borderRadius: 3,
};

const SECTIONS: GuideSection[] = [
  {
    id: 'encryption',
    title: '1. Passord krypteres før de skrives til database',
    Icon: LockIcon,
    iconColor: '#22d3ee',
    oneLineSummary: 'AES-256-GCM — samme standard som banker og myndigheter bruker.',
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          Når en klient deler et passord eller en API-nøkkel med markedsføreren,
          lagres det ikke som klartekst noe sted. Før vi skriver til databasen,
          krypterer vi verdien med <strong>AES-256-GCM</strong> — en algoritme
          NIST har godkjent for klassifisert informasjon i USA, og som
          finansinstitusjoner verden over baserer sin transaksjons-sikkerhet på.
        </Typography>
        <Box sx={infoBoxSx}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#22d3ee', mb: 0.4 }}>
            Hva betyr det i praksis?
          </Typography>
          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.78)', lineHeight: 1.6 }}>
            Hvis noen skulle få tak i en kopi av databasen vår (f.eks. via en stjålet backup), ville de
            bare se en ulesbar streng som <code style={codeSx}>v1.A3kQ...gT4=.x9pK...zR2=</code> for hvert passord.
            Uten krypteringsnøkkelen kan den strengen ikke dekrypteres — selv med dagens raskeste
            datamaskiner ville det tatt milliarder av år å brute-force'e.
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>
          Krypteringsnøkkelen lagres aldri i samme system som de krypterte dataene — den
          er en separat miljøvariabel som kun produksjons-serveren har tilgang til.
        </Typography>
      </Stack>
    ),
  },
  {
    id: 'mfa',
    title: '2. 2FA-step-up for hver gang du ser et passord',
    Icon: ShieldIcon,
    iconColor: '#a78bfa',
    oneLineSummary: 'Selv om du er logget inn, må du bekrefte med kode for å se klartekst.',
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          Innlogging gir deg ikke automatisk tilgang til klartekst-passord. Hver gang
          du faktisk vil <strong>se</strong> en passord, krever Vault-en at du bekrefter
          identiteten din på nytt — akkurat som 1Password eller Bitwarden.
        </Typography>
        <Box sx={infoBoxSx}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#a78bfa', mb: 0.6 }}>
            To måter å bekrefte:
          </Typography>
          <Stack spacing={0.8}>
            <Stack direction="row" spacing={1.2} alignItems="flex-start">
              <CheckIcon sx={{ color: '#a78bfa', fontSize: 18, mt: 0.2 }} />
              <Box>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc' }}>
                  Authenticator-app (TOTP)
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.65)' }}>
                  Google Authenticator, 1Password eller Authy genererer en 6-sifret kode hvert 30. sekund.
                  Koden virker bare i et 30-sekunders vindu og kan ikke gjenbrukes.
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.2} alignItems="flex-start">
              <CheckIcon sx={{ color: '#a78bfa', fontSize: 18, mt: 0.2 }} />
              <Box>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc' }}>
                  E-post-kode (fallback)
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.65)' }}>
                  Hvis du ikke har Authenticator, sender vi en 6-sifret kode til e-posten registrert
                  på kontoen. Koden er gyldig i 10 min, max 5 forsøk, så blokkert.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)', lineHeight: 1.6 }}>
          <strong>Hvorfor er dette viktig?</strong> Hvis noen stjeler laptopen din mens du er logget inn,
          har de fortsatt ikke tilgang til klient-passordene uten Authenticator-appen din. Det er
          to-faktor-prinsippet: "noe du vet" + "noe du har".
        </Typography>
      </Stack>
    ),
  },
  {
    id: 'reveal',
    title: '3. Reveal-flyt med valgfri godkjenning fra teammedlem',
    Icon: VisibilityIcon,
    iconColor: '#34d399',
    oneLineSummary: 'For sensitive secrets kreves det at en kollega også godkjenner.',
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          Hver gang du vil se et passord, går du gjennom en strukturert flyt — ikke bare
          et klikk. Dette skaper et naturlig audit-spor og lar teamet ditt fange opp
          uvanlige forespørsler:
        </Typography>
        <Stepper orientation="vertical" sx={{ pl: 0, '& .MuiStepIcon-root': { color: '#34d399' } }}>
          <Step active>
            <StepLabel sx={{ '& .MuiStepLabel-label': { color: '#f8fafc', fontWeight: 700 } }}>
              Be om reveal
            </StepLabel>
            <StepContent sx={{ borderColor: 'rgba(52,211,153,0.3)' }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)' }}>
                Du klikker "Be om innsyn", skriver en kort begrunnelse, og bekrefter med 2FA-kode.
                Request opprettes med status <code style={codeSx}>pending</code>.
              </Typography>
            </StepContent>
          </Step>
          <Step active>
            <StepLabel sx={{ '& .MuiStepLabel-label': { color: '#f8fafc', fontWeight: 700 } }}>
              Godkjenning (hvis policy krever det)
            </StepLabel>
            <StepContent sx={{ borderColor: 'rgba(52,211,153,0.3)' }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)' }}>
                Hvis secret-en har policy <code style={codeSx}>approval_required</code>, må en kollega
                med riktig rolle (director, producer eller klient-godkjenner) godkjenne. De ser hvem som ba,
                hva begrunnelsen var, og kan velge å avvise.
              </Typography>
            </StepContent>
          </Step>
          <Step active>
            <StepLabel sx={{ '& .MuiStepLabel-label': { color: '#f8fafc', fontWeight: 700 } }}>
              Reveal — klartekst i 5 minutter
            </StepLabel>
            <StepContent sx={{ borderColor: 'rgba(52,211,153,0.3)' }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)' }}>
                Når godkjent, dekrypteres passordet på serveren og sendes til deg over HTTPS. Det
                lagres aldri i nettleser-cache eller localStorage. Etter 5 minutter må du be på nytt.
              </Typography>
            </StepContent>
          </Step>
        </Stepper>
        <Box sx={infoBoxSx}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#34d399', mb: 0.4 }}>
            Reveal-policy per secret
          </Typography>
          <Stack spacing={0.4}>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
              • <code style={codeSx}>approval_required</code> — annen rolle må godkjenne (default)
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
              • <code style={codeSx}>mfa_required</code> — strengeste, krever fersk 2FA hver gang
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
              • <code style={codeSx}>one_time</code> — secret kan kun reveals én gang, så låses
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
              • <code style={codeSx}>manual_only</code> — vises aldri i app, kun via personlig overlevering
            </Typography>
          </Stack>
        </Box>
      </Stack>
    ),
  },
  {
    id: 'audit',
    title: '4. Audit-log som ikke kan slettes',
    Icon: HistoryIcon,
    iconColor: '#fbbf24',
    oneLineSummary: 'Hver tilgang loggføres med tidspunkt, person og metode.',
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          Hver eneste handling i Vault-en logges automatisk i en separat tabell — uavhengig av
          om noe gikk bra eller feilet. Loggen er <strong>append-only</strong>: ingen, inkludert admin,
          kan slette eller redigere historikken.
        </Typography>
        <Box sx={infoBoxSx}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24', mb: 0.6 }}>
            Det som logges:
          </Typography>
          <Stack spacing={0.4}>
            {[
              'Hvem ba om reveal (bruker-ID + rolle)',
              'Når (millisekund-nøyaktig tidsstempel)',
              'Hvilken secret (platform + secret-ID)',
              'Begrunnelsen som ble skrevet inn',
              'MFA-metode brukt (TOTP, e-post-kode eller ingen)',
              'Hvem som godkjente (eller avviste)',
              'IP-adresse forespørselen kom fra',
              'Suksess eller feil — også feilede forsøk',
            ].map((item) => (
              <Stack key={item} direction="row" spacing={0.8} alignItems="flex-start">
                <CheckIcon sx={{ color: '#fbbf24', fontSize: 14, mt: 0.3 }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.78)' }}>
                  {item}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(226,232,240,0.7)', lineHeight: 1.6 }}>
          Hvis en klient noensinne lurer på "hvem så på Facebook-passordet vårt i mars?", kan vi
          gi dem nøyaktig svar på ett minutt. Dette er kravet både GDPR og NIS2 stiller til
          tjenester som håndterer klient-credentials.
        </Typography>
      </Stack>
    ),
  },
  {
    id: 'roles',
    title: '5. Rolle-basert tilgang — minst mulig privilegium',
    Icon: RoleIcon,
    iconColor: '#f87171',
    oneLineSummary: 'Bare de som faktisk trenger en secret kan be om å se den.',
    details: (
      <Stack spacing={1.4}>
        <Typography sx={{ fontSize: '0.88rem', color: 'rgba(226,232,240,0.8)', lineHeight: 1.6 }}>
          Ikke alle i et prosjekt har samme tilgang. Vault-en respekterer
          rolle-strukturen i Role Room — basert på "principle of least privilege":
          hver person får minst mulig tilgang som lar dem gjøre jobben.
        </Typography>
        <Stack spacing={0.8}>
          <RoleCard
            role="Director / Producer / Content Producer"
            permissions={['Kan opprette/oppdatere secrets', 'Kan be om reveal', 'Kan godkjenne andres reveal-requests']}
            color="#34d399"
          />
          <RoleCard
            role="Production Manager"
            permissions={['Kan be om reveal med begrunnelse', 'Kan IKKE opprette nye secrets', 'Kan IKKE godkjenne egne requests']}
            color="#fbbf24"
          />
          <RoleCard
            role="Client Reviewer (klient-kontakt)"
            permissions={['Kan godkjenne reveal-requests fra teamet', 'Kan IKKE selv be om eller se secrets']}
            color="#a78bfa"
          />
          <RoleCard
            role="Crew / andre roller"
            permissions={['Kan ikke se at Vault eksisterer', 'Får aldri tilgang til klient-credentials']}
            color="#94a3b8"
          />
        </Stack>
      </Stack>
    ),
  },
  {
    id: 'integrity',
    title: '6. Hva som gjør passord-integritet trygt hos oss',
    Icon: KeyIcon,
    iconColor: '#22d3ee',
    oneLineSummary: 'Oppsummering av sikkerhetsgarantiene vi gir klientene dine.',
    details: (
      <Stack spacing={1}>
        {[
          {
            title: 'Aldri klartekst i database',
            body: 'AES-256-GCM-kryptering før insert. Klartekst eksisterer kun midlertidig i minne under aktiv reveal.',
          },
          {
            title: 'Aldri klartekst i logger',
            body: 'Vi logger ALDRI det dekrypterte passordet — kun metadata (hvem, når, hvilken secret).',
          },
          {
            title: 'Aldri klartekst i nettleser-cache',
            body: 'Reveal sendes over HTTPS direkte til UI, vises i 5 min, så er det borte fra minne.',
          },
          {
            title: 'Aldri klartekst i backup',
            body: 'Database-backups krypteres med samme nøkkel — så også en kompromittert backup er trygt.',
          },
          {
            title: 'To-faktor for hver visning',
            body: 'Selv stjålet session-cookie gir IKKE tilgang til klartekst-passord uten 2FA-kode.',
          },
          {
            title: 'Append-only audit-spor',
            body: 'Hver handling logges uten mulighet for sletting — klient kan forevises full historikk på forespørsel.',
          },
          {
            title: 'Reveal-policy gir klient kontroll',
            body: 'Klienten kan kreve at deres mest sensitive passord krever 2FA hver gang — du kan ikke overstyre det.',
          },
        ].map((item) => (
          <Stack key={item.title} direction="row" spacing={1} alignItems="flex-start" sx={{ p: 1.2, borderRadius: 1, bgcolor: 'rgba(34,211,238,0.04)' }}>
            <CheckIcon sx={{ color: '#22d3ee', fontSize: 18, mt: 0.2 }} />
            <Box>
              <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc' }}>
                {item.title}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.7)', lineHeight: 1.55 }}>
                {item.body}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    ),
  },
];

const VaultSecurityGuide: React.FC<VaultSecurityGuideProps> = ({ open, onClose }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('encryption');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          bgcolor: '#0b1226',
          color: '#f8fafc',
          maxHeight: '92vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.4, borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: 'rgba(34,211,238,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldIcon sx={{ color: '#22d3ee', fontSize: 24 }} />
            </Box>
            <Stack spacing={0.2}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: '#f8fafc' }}>
                Slik fungerer The Role Room Vault
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.6)' }}>
                Vi bryr oss om at klient-passord aldri kommer på avveie.
              </Typography>
            </Stack>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: '#cbd5e1' }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.4 }}>
        <Box
          sx={{
            mb: 2.4,
            p: 1.8,
            borderRadius: 1.5,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.2)',
          }}
        >
          <Typography sx={{ fontSize: '0.92rem', color: '#f8fafc', fontWeight: 700, mb: 0.6 }}>
            For din sikkerhet
          </Typography>
          <Typography sx={{ fontSize: '0.86rem', color: 'rgba(226,232,240,0.78)', lineHeight: 1.6 }}>
            Vi har utviklet The Role Room Vault for å løse et reelt problem: markedsføringsbyråer må
            ofte håndtere passord og API-nøkler på vegne av klienter, men det er ingen god standard
            for hvordan det skal gjøres trygt. Vault-en kombinerer kryptering, 2FA-step-up,
            godkjennings-flyt og audit-log slik at klient-passord aldri kommer på avveie — selv ved
            laptop-tyveri, lekket session-cookie eller intern feilbruk.
          </Typography>
        </Box>

        <Stack spacing={1}>
          {SECTIONS.map((section) => {
            const isExpanded = expandedSection === section.id;
            const Icon = section.Icon;
            return (
              <Box
                key={section.id}
                sx={{
                  borderRadius: 1.5,
                  border: `1px solid ${isExpanded ? `${section.iconColor}55` : 'rgba(148,163,184,0.18)'}`,
                  bgcolor: isExpanded ? `${section.iconColor}08` : 'rgba(15,23,42,0.45)',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
              >
                <Button
                  fullWidth
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  sx={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    py: 1.4,
                    px: 1.8,
                    textTransform: 'none',
                    color: 'inherit',
                    '&:hover': { bgcolor: 'transparent' },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.4} sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: `${section.iconColor}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon sx={{ color: section.iconColor, fontSize: 18 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                        {section.title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.62)', mt: 0.1 }}>
                        {section.oneLineSummary}
                      </Typography>
                    </Box>
                    <ExpandMoreIcon
                      sx={{
                        color: 'rgba(226,232,240,0.5)',
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </Stack>
                </Button>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ px: 2.2, pb: 2.2, pt: 0.4 }}>
                    {section.details}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>

        <Box
          sx={{
            mt: 3,
            p: 1.8,
            borderRadius: 1.5,
            bgcolor: 'rgba(52,211,153,0.06)',
            border: '1px solid rgba(52,211,153,0.2)',
          }}
        >
          <Stack direction="row" alignItems="flex-start" spacing={1.2}>
            <CheckIcon sx={{ color: '#34d399', mt: 0.2 }} />
            <Box>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#f0fdf4', mb: 0.4 }}>
                Hva betyr dette for klienten din?
              </Typography>
              <Typography sx={{ fontSize: '0.84rem', color: 'rgba(220,252,231,0.78)', lineHeight: 1.6 }}>
                Du kan si til klienten din: <em>"Når jeg skal logge inn for å lage en Facebook-annonse for
                deg, henter jeg passordet fra et kryptert hvelv. Jeg må bekrefte identiteten min hver gang
                jeg ser det, og hver visning logges. Hvis du noen gang lurer på hvem som har sett
                passordet ditt og når, kan jeg gi deg full historikk."</em>
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(220,252,231,0.6)', mt: 1, lineHeight: 1.55 }}>
                Mange klienter har ikke møtt denne typen håndtering før — det skaper tillit fra dag én.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ mt: 2.4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            onClick={onClose}
            variant="contained"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: '#22d3ee',
              color: '#0b1226',
              px: 2.4,
              '&:hover': { bgcolor: '#06b6d4' },
            }}
          >
            Greit, lukk
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default VaultSecurityGuide;

/**
 * RoleCardPage — det statisten åpner på telefonen.
 *
 * Designet rundt ett spørsmål: hva trenger et menneske som står på et sett
 * om tolv minutter, og som ikke har lest manus?
 *
 * Fire ting, i den rekkefølgen hen trenger dem:
 *
 *   1  hva jeg gjør      størst på siden, i imperativ
 *   2  når               signalet mitt — uten det gjør folk tingen for tidlig
 *   3  hvor jeg står     plantegningen med MIN prikk, ikke hele riggen
 *   4  hvordan det ser ut rammen jeg er med i
 *
 * Alt annet er utelatt med vilje. Ingen scene-liste, ingen andre statister,
 * ingen kontaktliste. Den som får hele oppsettet må lete etter seg selv i
 * det; den som får ett kort vet hva hen skal gjøre.
 *
 * Alle tilstander er tegnet, ikke bare den ferdige: laster, lenken gjelder
 * ikke lenger, og kortet uten plantegning eller bilde — som er det vanlige
 * første døgnet, før noen har rukket å legge dem inn.
 */

import { Alert, Box, CircularProgress, Link, Stack, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckroomIcon from '@mui/icons-material/CheckroomOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import { useEffect, useState } from 'react';

import { palette, radius } from '../talents-app/theme';

/** /statist/<token> — lenken personen får. */
export function isRoleCardPath(): boolean {
  if (typeof window === 'undefined') return false;
  return /^\/statist\/[A-Za-z0-9_-]{8,}\/?$/.test(window.location.pathname);
}

function tokenFromPath(): string {
  const m = window.location.pathname.match(/^\/statist\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

interface RoleCard {
  person_name: string;
  person_kind: string;
  action: string;
  cue: string | null;
  position: { x: number; y: number } | null;
  wardrobe: string | null;
  frame_image_url: string | null;
  call_time: string | null;
}

interface Scene {
  title: string | null;
  setting: string | null;
  time_of_day: string | null;
  int_ext: string | null;
  blocking: { planUrl?: string; camera?: { x: number; y: number } } | null;
}

/** Hvor dagen starter. Null når produksjonsdagen ikke har et sted ennå. */
interface Meeting {
  name: string | null;
  address: string | null;
  access_notes: string | null;
  date: string | null;
}

/** Én scene personen er med i denne dagen. */
interface KortDel {
  card: RoleCard;
  scene: Scene;
}

interface Svar {
  person: { name: string; kind: string };
  /** Alle scenene bak lenken, i den rekkefølgen dagen går. */
  cards: KortDel[];
  meeting: Meeting | null;
  project: { name: string | null };
}

const kortSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

/** Plantegning med personens egen prikk — og kameraet, så hen vet hvor «fram» er. */
function Plantegning({ plan, meg, kamera }: {
  plan: string;
  meg: { x: number; y: number } | null;
  kamera?: { x: number; y: number };
}) {
  return (
    <Box sx={{ position: 'relative', borderRadius: radius.md, overflow: 'hidden', border: `1px solid ${palette.border}` }}>
      <Box component="img" src={plan} alt="Plantegning" sx={{ width: '100%', display: 'block' }} />
      {kamera && (
        <Box
          sx={{
            position: 'absolute',
            left: `${kamera.x * 100}%`,
            top: `${kamera.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            px: 0.8,
            py: 0.3,
            bgcolor: palette.bgRoot,
            border: `1px solid ${palette.secondaryEdge}`,
            borderRadius: radius.xs,
            fontSize: '0.62rem',
            color: palette.textSecondary,
            letterSpacing: '0.1em',
          }}
        >
          KAMERA
        </Box>
      )}
      {meg && (
        <Box
          sx={{
            position: 'absolute',
            left: `${meg.x * 100}%`,
            top: `${meg.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.4,
          }}
        >
          <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: palette.accentBright, border: '2px solid #fff' }} />
          <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#fff', textShadow: '0 1px 4px #000' }}>
            DU
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default function RoleCardPage() {
  const [svar, setSvar] = useState<Svar | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(true);

  useEffect(() => {
    const token = tokenFromPath();
    if (!token) { setFeil('Lenken mangler.'); setLaster(false); return; }
    fetch(`/api/role-room/role-cards/r/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'Lenken gjelder ikke lenger');
        return r.json();
      })
      .then((d: Svar) => setSvar(d))
      .catch((e: Error) => setFeil(e.message))
      .finally(() => setLaster(false));
  }, []);

  if (laster) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: palette.bgRoot, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
        <CircularProgress size={20} sx={{ color: palette.accentBright }} />
        <Typography sx={{ color: palette.textSecondary }}>Henter kortet ditt…</Typography>
      </Box>
    );
  }

  if (feil || !svar) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: palette.bgRoot, p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ ...kortSx, maxWidth: 420, textAlign: 'center' }}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.1rem' }}>
            {feil ?? 'Lenken gjelder ikke lenger'}
          </Typography>
          {/* Personen står kanskje på settet allerede. Da hjelper det ikke å
              forklare hvorfor — bare hvem hen skal spørre. */}
          <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mt: 1, lineHeight: 1.6 }}>
            Spør innspillingslederen om en ny lenke. Er du på settet nå, ta kontakt med den som ga deg beskjed om oppmøtet.
          </Typography>
        </Box>
      </Box>
    );
  }

  const { cards, meeting, project, person } = svar;
  const flere = cards.length > 1;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: palette.bgRoot, pb: 6 }}>
      <Box sx={{ maxWidth: 560, mx: 'auto', px: 2.2, pt: 3 }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {project.name ?? 'Produksjon'}
        </Typography>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.32rem', mt: 0.4 }}>
          {person.name}
        </Typography>
        {/* Med flere scener er antallet det første man trenger å vite: da vet du
            at du skal bla, i stedet for å tro at kortet slutter etter den første. */}
        <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem', mt: 0.2 }}>
          {flere
            ? `${cards.length} scener denne dagen`
            : [cards[0].scene.int_ext, cards[0].scene.title, cards[0].scene.setting].filter(Boolean).join(' · ')}
        </Typography>

        {/* Sted og adresse hører til DAGEN, ikke til hver scene — én gang øverst. */}
        {meeting && (meeting.name || meeting.address) && (
          <Box sx={{ ...kortSx, mt: 2, py: 1.6 }}>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <PlaceIcon sx={{ color: palette.secondarySoft, fontSize: 18 }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Sted
              </Typography>
            </Stack>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem', mt: 0.3 }}>
              {meeting.name ?? meeting.address}
            </Typography>
            {meeting.name && meeting.address && (
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.9rem', mt: 0.2 }}>
                {meeting.address}
              </Typography>
            )}
            {meeting.access_notes && (
              // «Inngang bak bygget» er verdt mer enn adressen når du står der.
              <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', mt: 0.6, lineHeight: 1.5 }}>
                {meeting.access_notes}
              </Typography>
            )}
            {meeting.address && (
              <Link
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meeting.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: palette.accentBright, fontSize: '0.86rem', mt: 0.8, display: 'inline-block' }}
              >
                Vis i kart
              </Link>
            )}
          </Box>
        )}

        {cards.map((del, i) => (
          <SceneDel key={i} del={del} nummer={flere ? i + 1 : null} />
        ))}

        <Alert
          severity="info"
          sx={{ mt: 2.4, bgcolor: 'rgba(75, 61, 143, 0.14)', color: palette.textSecondary, border: `1px solid ${palette.border}` }}
        >
          {flere
            ? 'Kortet gjelder bare deg, og viser alle scenene du er med i denne dagen. Andre på settet har sine egne.'
            : 'Dette kortet gjelder bare deg. Andre på settet har sine egne.'}
        </Alert>
      </Box>
    </Box>
  );
}

/**
 * Én scene: hva du gjør, når, hvor du står, hvordan bildet ser ut.
 *
 * Rekkefølgen er den samme uansett hvor mange scener kortet har — en statist
 * som har lest den første vet hvor tingene står i den neste.
 */
function SceneDel({ del, nummer }: { del: KortDel; nummer: number | null }) {
  const { card, scene } = del;
  const plan = scene.blocking?.planUrl;

  return (
    <Box sx={{ mt: 2.4 }}>
      {nummer !== null && (
        // Med flere scener må hver del si hvilken scene den gjelder, ellers
        // blir kortet en vegg av tekst der alt ser likt ut.
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1 }}>
          <Typography sx={{ color: palette.accentBright, fontWeight: 800, fontSize: '0.9rem' }}>{nummer}</Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
            {[scene.int_ext, scene.title, scene.setting].filter(Boolean).join(' · ') || 'Scene'}
          </Typography>
          {card.call_time && (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', ml: 'auto' }}>
              {new Date(card.call_time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          )}
        </Stack>
      )}

      {/* 1 — hva jeg gjør. Størst på siden, fordi det er hele grunnen til
          at kortet finnes. */}
      <Box sx={{ ...kortSx, borderColor: palette.accent }}>
        <Typography sx={{ color: palette.accentBright, fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Dette gjør du
        </Typography>
        <Typography sx={{ color: palette.textPrimary, fontSize: '1.22rem', lineHeight: 1.5, mt: 0.8, fontWeight: 600 }}>
          {card.action}
        </Typography>
      </Box>

      {/* 2 — når. Uten signalet gjør folk tingen for tidlig. */}
      {card.cue && (
        <Box sx={{ ...kortSx, mt: 1.6 }}>
          <Stack direction="row" spacing={1.2} alignItems="flex-start">
            <AccessTimeIcon sx={{ color: palette.secondarySoft, fontSize: 20, mt: 0.2 }} />
            <Box>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Signalet ditt
              </Typography>
              <Typography sx={{ color: palette.textPrimary, fontSize: '1rem', mt: 0.3 }}>{card.cue}</Typography>
            </Box>
          </Stack>
        </Box>
      )}

      {/* 3 — hvor jeg står. */}
      <Box sx={{ ...kortSx, mt: 1.6 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: plan ? 1.4 : 0 }}>
          <PlaceIcon sx={{ color: palette.secondarySoft, fontSize: 20 }} />
          <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Her står du
          </Typography>
        </Stack>
        {plan ? (
          <Plantegning plan={plan} meg={card.position} kamera={scene.blocking?.camera} />
        ) : (
          // Vanlig første døgn: plantegningen er ikke laget ennå. Si det
          // rett ut i stedet for å vise en tom ramme.
          <Typography sx={{ color: palette.textMuted, fontSize: '0.92rem' }}>
            Plantegningen er ikke klar ennå. Innspillingslederen viser deg plassen på settet.
          </Typography>
        )}
      </Box>

      {/* 4 — hvordan det ser ut. */}
      {card.frame_image_url && (
        <Box sx={{ ...kortSx, mt: 1.6 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', mb: 1.2 }}>
            Slik ser bildet ut
          </Typography>
          <Box
            component="img"
            src={card.frame_image_url}
            alt="Rammen du er med i"
            sx={{ width: '100%', borderRadius: radius.md, display: 'block', border: `1px solid ${palette.border}` }}
          />
        </Box>
      )}

      <Stack direction="row" spacing={1.6} sx={{ mt: 1.6 }} flexWrap="wrap" useFlexGap>
        {card.call_time && nummer === null && (
          <Box sx={{ ...kortSx, flex: '1 1 160px', py: 1.6 }}>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Oppmøte
            </Typography>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem', mt: 0.3 }}>
              {new Date(card.call_time).toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        )}
        {card.wardrobe && (
          <Box sx={{ ...kortSx, flex: '1 1 160px', py: 1.6 }}>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <CheckroomIcon sx={{ color: palette.secondarySoft, fontSize: 18 }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Klær
              </Typography>
            </Stack>
            <Typography sx={{ color: palette.textPrimary, fontSize: '0.96rem', mt: 0.3 }}>{card.wardrobe}</Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

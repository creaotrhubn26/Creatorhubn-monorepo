/**
 * ProjectQuickCreate — første steg i prosjektopprettelsen.
 *
 * Den gamle dialogen spurte om kontaktnavn, e-post, telefon, gjester,
 * prosjektnavn, dato, lokasjon, prosjekttype og bryllupstidslinje — og kjørte
 * så en helsesjekk som BLOKKERTE opprettelsen med «2 kritiske feil» hvis
 * klientnavn og kontaktinfo manglet. Brukeren møtte altså et skjema som sa nei
 * før de hadde sett verdien av noe som helst.
 *
 * Helsesjekken løser et ekte problem — nedstrøms trenger kontrakt, prising og
 * leveranse fullstendige data — men den var plassert på verst tenkelige sted.
 * Den hører hjemme der den hjelper: «kan ikke sende kontrakt, mangler
 * klientnavn» er nyttig. «Kan ikke opprette prosjekt» er i veien.
 *
 * Dette steget spør om én ting: hva jobber du med. Alt annet fylles ut senere,
 * i prosjektet, når brukeren har noe å forholde seg til.
 *
 * Startpunktene er ikke dekorasjon: hvert av dem setter prosjekttype, som
 * styrer hvilke maler, oppgaver og leveranser prosjektet får videre. Blank er
 * med for den som vet hva de gjør.
 */
import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowForward from '@mui/icons-material/ArrowForward';

export interface QuickCreateResult {
  name: string;
  projectType: string;
}

export interface StartingPoint {
  /** Verdien som lagres som projectType — styrer maler nedstrøms. */
  id: string;
  label: string;
  /** Kort forklaring, vist som hjelpetekst når valget er aktivt. */
  hint: string;
}

/**
 * Startpunktene. Rekkefølgen er bevisst: de vanligste først, «Blank» sist.
 * `id` må matche prosjekttypene systemet allerede kjenner, ellers faller
 * nedstrøms maler tilbake til generisk oppsett.
 */
export const STARTING_POINTS: StartingPoint[] = [
  { id: 'campaign', label: 'Kampanje', hint: 'Annonser, flere leveranser, én tidsfrist' },
  { id: 'film', label: 'Film & video', hint: 'Opptak, etterarbeid og levering' },
  { id: 'product-launch', label: 'Produktlansering', hint: 'Lansering med flere flater' },
  { id: 'content', label: 'Innhold', hint: 'Løpende produksjon, ikke ett sluttpunkt' },
  { id: 'client-project', label: 'Kundeprosjekt', hint: 'Levering til en ekstern kunde' },
  { id: 'event', label: 'Arrangement', hint: 'Dekning av noe som skjer én gang' },
  { id: 'website', label: 'Nettside', hint: 'Design og bygg' },
  { id: 'internal', label: 'Internt', hint: 'Eget arbeid, ingen kunde' },
  { id: 'blank', label: 'Tomt', hint: 'Ingen mal — du setter opp selv' },
];

interface Props {
  /** Kalles når brukeren har bestemt seg. Skal opprette prosjektet. */
  onContinue: (result: QuickCreateResult) => Promise<void> | void;
  onCancel?: () => void;
  busy?: boolean;
  /** Feiltekst fra opprettelsen, vist under knappen. */
  error?: string | null;
}

const ProjectQuickCreate: React.FC<Props> = ({ onContinue, onCancel, busy = false, error = null }) => {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const trimmed = name.trim();
  // Navn ELLER startpunkt holder. Krever vi begge, er vi tilbake til et skjema
  // som sier nei.
  const canContinue = trimmed.length > 0 || selected !== null;

  const activeHint = useMemo(
    () => STARTING_POINTS.find((p) => p.id === selected)?.hint ?? null,
    [selected],
  );

  const submit = async () => {
    if (!canContinue || busy) return;
    const chosenType = selected ?? 'blank';
    await onContinue({
      // Uten navn bruker vi startpunktets etikett. Brukeren kan døpe om
      // inne i prosjektet — bedre enn å blokkere her.
      name: trimmed || STARTING_POINTS.find((p) => p.id === chosenType)?.label || 'Nytt prosjekt',
      projectType: chosenType,
    });
  };

  return (
    <Box sx={{ p: 4, maxWidth: 640 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
        Hva jobber du med?
      </Typography>

      <TextField
        fullWidth
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canContinue) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="f.eks. Lanseringskampanje for Holy Crust"
        inputProps={{ 'aria-label': 'Hva jobber du med' }}
        sx={{ mb: 3 }}
      />

      <Typography variant="body2" sx={{ opacity: 0.75, mb: 1.5 }}>
        Eller velg et startpunkt
      </Typography>

      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
        {STARTING_POINTS.map((point) => (
          <Chip
            key={point.id}
            label={point.label}
            clickable
            aria-pressed={selected === point.id}
            onClick={() => setSelected((cur) => (cur === point.id ? null : point.id))}
            color={selected === point.id ? 'primary' : 'default'}
            variant={selected === point.id ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600 }}
          />
        ))}
      </Stack>

      <Box sx={{ minHeight: 24, mb: 2 }}>
        {activeHint && (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {activeHint}
          </Typography>
        )}
      </Box>

      <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
        {onCancel && (
          <Button onClick={onCancel} disabled={busy} color="inherit">
            Avbryt
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={!canContinue || busy}
          endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ArrowForward />}
        >
          {busy ? 'Oppretter…' : 'Fortsett'}
        </Button>
      </Stack>

      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 2, textAlign: 'right' }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default ProjectQuickCreate;

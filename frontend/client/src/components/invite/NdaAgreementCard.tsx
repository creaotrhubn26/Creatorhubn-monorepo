/**
 * NdaAgreementCard — viser NDA-tekst og samler digital signatur.
 *
 * Bruker en konsensbasert signatur: tester skriver inn fullt navn,
 * checker en boks, og vi tidsstempler. Returnerer signaturobjektet til
 * forelderen via onSign-callback.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  Lock as LockIcon,
} from '@mui/icons-material';

export interface NdaSignature {
  fullName: string;
  signedAt: string; // ISO-8601
  ndaVersion: string;
  agreed: boolean;
}

interface NdaAgreementCardProps {
  /** NDA-versjon. Endre når du oppdaterer teksten — tidligere signaturer
   * gjelder kun for den versjonen de signerte. */
  ndaVersion?: string;
  /** Hovedtekst. Hvis ikke gitt brukes standard prototype-tester-NDA. */
  ndaText?: string;
  /** Forelderen får en signatur når brukeren har fylt inn alt og krysset av. */
  onSign: (signature: NdaSignature | null) => void;
  /** Pre-fyll navn (typisk admin-invitasjon med navn allerede kjent). */
  defaultFullName?: string;
  /** Disable inputs (etter at signatur er låst inn). */
  readOnly?: boolean;
}

const DEFAULT_NDA_VERSION = '1.0';

const DEFAULT_NDA_TEXT = `
Mellom Creatorhubn AS ("Selskapet") og deg som prototype-tester ("Tester") inngås følgende konfidensialitetsavtale:

1. KONFIDENSIELL INFORMASJON
Tester anerkjenner at all tilgang til The Role Room-prototypen, dens funksjonalitet, design, kildekode-glimt, AI-prompts, demo-prosjekter, klient-data og forretningslogikk er konfidensiell informasjon.

2. BEGRENSNINGER
Tester forplikter seg til:
  (a) å ikke dele skjermbilder, video, kode eller funksjonell beskrivelse av prototypen offentlig (sosiale medier, foredrag, blog, konkurrenter)
  (b) å bare snakke med andre testere/Selskapets ansatte om prototypen
  (c) å ikke benytte innsikt fra prototypen til å bygge konkurrerende produkter
  (d) å varsle Selskapet umiddelbart om ev. utilsiktet lekkasje

3. VARIGHET
Denne avtalen gjelder så lenge prototypen er upublisert, pluss 12 måneder etter offentlig lansering.

4. FEEDBACK
Tilbakemeldinger og forslag som Tester gir kan brukes fritt av Selskapet uten kompensasjon.

5. ANSVAR
Brudd kan medføre erstatningskrav. Tester signerer ved å skrive inn fullt navn under.
`.trim();

export const NdaAgreementCard = ({
  ndaVersion = DEFAULT_NDA_VERSION,
  ndaText = DEFAULT_NDA_TEXT,
  onSign,
  defaultFullName,
  readOnly,
}: NdaAgreementCardProps) => {
  const [fullName, setFullName] = useState(defaultFullName ?? '');
  const [agreed, setAgreed] = useState(false);
  const [hasScrolledThrough, setHasScrolledThrough] = useState(false);

  const isComplete = fullName.trim().length >= 2 && agreed && hasScrolledThrough;

  // Notify parent whenever signature-state changes
  useEffect(() => {
    if (isComplete) {
      onSign({
        fullName: fullName.trim(),
        signedAt: new Date().toISOString(),
        ndaVersion,
        agreed: true,
      });
    } else {
      onSign(null);
    }
  }, [isComplete, fullName, agreed, ndaVersion, onSign]);

  const scrollRequiredLabel = useMemo(() => {
    if (hasScrolledThrough) return 'Du har lest gjennom NDA-teksten';
    return 'Bla helt ned i NDA-teksten for å aktivere signatur';
  }, [hasScrolledThrough]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        border: '1px solid rgba(184,107,255,0.32)',
        bgcolor: 'rgba(15,23,42,0.5)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <GavelIcon sx={{ color: '#b86bff' }} />
        <Box>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>
            Konfidensialitetsavtale (NDA)
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
            Versjon {ndaVersion} — gjelder all tilgang til The Role Room-prototypen
          </Typography>
        </Box>
      </Stack>

      <Box
        role="document"
        aria-label="NDA-tekst"
        onScroll={(event) => {
          const target = event.currentTarget;
          if (target.scrollTop + target.clientHeight >= target.scrollHeight - 8) {
            setHasScrolledThrough(true);
          }
        }}
        sx={{
          maxHeight: 280,
          overflowY: 'auto',
          p: 2,
          bgcolor: 'rgba(2,6,15,0.6)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 1.5,
          mb: 2,
          whiteSpace: 'pre-wrap',
          color: 'rgba(255,255,255,0.86)',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          lineHeight: 1.55,
        }}
      >
        {ndaText}
      </Box>

      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: hasScrolledThrough ? '#86efac' : 'rgba(255,255,255,0.55)',
          mb: 2,
        }}
      >
        {hasScrolledThrough ? '✓ ' : '↓ '}{scrollRequiredLabel}
      </Typography>

      <Stack spacing={1.5}>
        <TextField
          label="Fullt juridisk navn"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          disabled={readOnly || !hasScrolledThrough}
          fullWidth
          size="small"
          InputProps={{
            startAdornment: <LockIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', mr: 1 }} />,
            sx: { color: '#fff' },
          }}
          InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.65)' } }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              disabled={readOnly || !hasScrolledThrough}
              sx={{
                color: 'rgba(184,107,255,0.7)',
                '&.Mui-checked': { color: '#b86bff' },
              }}
            />
          }
          label={(
            <Typography sx={{ color: 'rgba(255,255,255,0.86)', fontSize: '0.88rem' }}>
              Jeg har lest og forstått NDA-avtalen og signerer som angitt over.
            </Typography>
          )}
        />
      </Stack>

      {isComplete && (
        <Box
          sx={{
            mt: 2,
            p: 1.25,
            bgcolor: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: 1,
          }}
        >
          <Typography sx={{ color: '#86efac', fontSize: '0.82rem', fontWeight: 700 }}>
            ✓ NDA klar til innsending — vil tidsstemples ved godkjenning
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default NdaAgreementCard;

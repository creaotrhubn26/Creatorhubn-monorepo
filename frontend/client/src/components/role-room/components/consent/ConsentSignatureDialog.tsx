import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Stack,
  IconButton,
  Checkbox,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  VerifiedUserOutlined as VerifiedIcon,
  DrawOutlined as DrawIcon,
  KeyboardOutlined as TypeIcon,
} from '@mui/icons-material';
import type { Consent, ConsentSignatureData, ConsentType } from '../../models/casting';
import SignaturePad from './SignaturePad';

interface ConsentSignatureDialogProps {
  open: boolean;
  consent: Consent | null;
  candidateName: string;
  projectName: string;
  onSign: (signatureData: ConsentSignatureData) => void;
  onClose: () => void;
}

// ── Merkevare (matcher logoen / ConsentPortalView) ──
const BRAND = '#9d38c6';
const BRAND_DARK = '#7a2a9c';
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`;

const lightFieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: alpha(BRAND, 0.03) },
} as const;

const getConsentTypeLabel = (type: ConsentType): string => {
  const labels: Record<ConsentType, string> = {
    photo_release: 'Foto-samtykke',
    video_release: 'Video-samtykke',
    audio_release: 'Lyd-samtykke',
    location_release: 'Lokasjon-samtykke',
    minor_consent: 'Mindreårig-samtykke',
    other: 'Annet samtykke',
  };
  return labels[type] || type;
};

const getConsentDescription = (type: ConsentType): string => {
  const descriptions: Record<ConsentType, string> = {
    photo_release: 'Jeg gir herved tillatelse til å bruke fotografier av meg i forbindelse med dette prosjektet for markedsføring, publisering og andre kommersielle formål.',
    video_release: 'Jeg gir herved tillatelse til å bruke videoopptak av meg i forbindelse med dette prosjektet for kringkasting, streaming og andre kommersielle formål.',
    audio_release: 'Jeg gir herved tillatelse til å bruke lydopptak av meg i forbindelse med dette prosjektet for publisering, streaming og andre kommersielle formål.',
    location_release: 'Jeg gir herved tillatelse til å filme/fotografere på min eiendom i forbindelse med dette prosjektet.',
    minor_consent: 'Som foresatt/verge gir jeg herved tillatelse til at den mindreårige kan delta i dette prosjektet under de angitte vilkårene.',
    other: 'Jeg bekrefter herved samtykke til de angitte vilkårene i dette dokumentet.',
  };
  return descriptions[type] || '';
};

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 120 }}>
      <Typography
        variant="overline"
        sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.6 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

export default function ConsentSignatureDialog({
  open,
  consent,
  candidateName,
  projectName,
  onSign,
  onClose,
}: ConsentSignatureDialogProps) {
  const [signature, setSignature] = useState('');
  const [signedByName, setSignedByName] = useState(candidateName || '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');

  const handleSign = () => {
    if (!signature.trim() || !signedByName.trim() || !acceptedTerms) {
      return;
    }

    const signatureData: ConsentSignatureData = {
      signature: signature.trim(),
      signed_by: signedByName.trim(),
      signed_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
      method: mode === 'draw' ? 'drawn' : 'typed',
    };

    onSign(signatureData);
    setSignature('');
    setSignedByName(candidateName || '');
    setAcceptedTerms(false);
  };

  if (!consent) return null;

  const canSign = Boolean(signature.trim() && signedByName.trim() && acceptedTerms);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(31, 17, 51, 0.25)',
        },
      }}
    >
      {/* Branded header */}
      <Box
        sx={{
          px: { xs: 2.5, sm: 3 },
          py: 2.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          background: BRAND_GRADIENT,
          color: '#fff',
        }}
      >
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(255,255,255,0.18)',
          }}
        >
          <VerifiedIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
            Signer samtykke
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.92 }} noWrap>
            {consent.title || getConsentTypeLabel(consent.type)}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Lukk" sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ p: 2, mb: 2.5, borderRadius: 3, bgcolor: alpha(BRAND, 0.05) }}
        >
          <InfoCell label="Prosjekt" value={projectName} />
          <InfoCell label="Type" value={getConsentTypeLabel(consent.type)} />
        </Stack>

        <Box sx={{ mb: 3 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}
          >
            Samtykketekst
          </Typography>
          <Box
            sx={{
              mt: 0.5,
              p: 2.5,
              borderRadius: 3,
              bgcolor: '#fafafa',
              borderLeft: '4px solid',
              borderColor: BRAND,
            }}
          >
            <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
              {consent.description || getConsentDescription(consent.type)}
            </Typography>
          </Box>
        </Box>

        <TextField
          label="Fullt navn"
          value={signedByName}
          onChange={(e) => setSignedByName(e.target.value)}
          fullWidth
          required
          sx={{ mb: 2.5, ...lightFieldSx }}
        />

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em' }}
          >
            Signatur
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, v) => { if (v) { setMode(v); setSignature(''); } }}
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 600,
                px: 1.5,
                py: 0.4,
                borderColor: alpha(BRAND, 0.3),
              },
              '& .Mui-selected': {
                bgcolor: `${alpha(BRAND, 0.12)} !important`,
                color: `${BRAND_DARK} !important`,
              },
            }}
          >
            <ToggleButton value="draw"><DrawIcon sx={{ fontSize: 16, mr: 0.5 }} />Tegn</ToggleButton>
            <ToggleButton value="type"><TypeIcon sx={{ fontSize: 16, mr: 0.5 }} />Skriv</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {mode === 'draw' ? (
          <SignaturePad brand={BRAND} onChange={(d) => setSignature(d || '')} />
        ) : (
          <TextField
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            fullWidth
            required
            multiline
            rows={3}
            placeholder="Skriv din signatur her…"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                bgcolor: alpha(BRAND, 0.03),
                fontFamily: '"Brush Script MT", "Segoe Script", cursive',
                fontSize: '1.6rem',
                color: BRAND_DARK,
              },
            }}
          />
        )}
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, mb: 2.5, color: 'text.secondary' }}>
          Signaturen lagres med tidspunkt og enhet for sporbarhet.
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              sx={{ color: alpha(BRAND, 0.6), '&.Mui-checked': { color: BRAND } }}
            />
          }
          label={
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Jeg har lest og forstått vilkårene, og samtykker til bruken som beskrevet ovenfor.
            </Typography>
          }
          sx={{ alignItems: 'flex-start', mr: 0 }}
        />
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2.5, sm: 3 }, pb: 3, pt: 0, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2.5, color: 'text.secondary' }}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleSign}
          disabled={!canSign}
          startIcon={<VerifiedIcon />}
          sx={{
            py: 1.25,
            px: 3,
            borderRadius: 2.5,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: `0 10px 24px ${alpha(BRAND, 0.35)}`,
            background: BRAND_GRADIENT,
            '&:hover': { background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #5f2079 100%)` },
            '&.Mui-disabled': { background: alpha(BRAND, 0.35), color: 'rgba(255,255,255,0.85)' },
          }}
        >
          Signer samtykke
        </Button>
      </DialogActions>
    </Dialog>
  );
}

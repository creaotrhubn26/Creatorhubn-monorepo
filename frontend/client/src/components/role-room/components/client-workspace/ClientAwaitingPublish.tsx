/**
 * ClientAwaitingPublish — tomtilstand i klientportalen når produsenten ennå
 * ikke har publisert innholdet på en flate. Del av draft→publiser→synk-grensen:
 * klienten ser kun publisert innhold, så «tomt» kan bety «ikke publisert ennå»
 * — det skal kommuniseres tydelig, ikke se ut som en feil.
 */
import { Box, Stack, Typography } from '@mui/material';
import { HourglassEmptyOutlined as AwaitingIcon } from '@mui/icons-material';

export default function ClientAwaitingPublish({
  noun,
  detail,
}: {
  /** Hva som mangler, f.eks. "briefen", "planen". */
  noun: string;
  detail?: string;
}) {
  return (
    <Box
      sx={{
        borderRadius: 2, border: '1px dashed rgba(148,163,184,0.32)',
        background: 'rgba(255,255,255,0.02)', px: 2, py: 4, textAlign: 'center',
      }}
    >
      <Stack spacing={1} alignItems="center">
        <AwaitingIcon sx={{ fontSize: 32, color: 'rgba(226,232,240,0.55)' }} />
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 700 }}>
          Produsenten har ikke publisert {noun} ennå
        </Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.82rem', maxWidth: 360 }}>
          {detail ?? `Du får ${noun} her så snart produsenten publiserer. Du blir varslet når den er klar.`}
        </Typography>
      </Stack>
    </Box>
  );
}

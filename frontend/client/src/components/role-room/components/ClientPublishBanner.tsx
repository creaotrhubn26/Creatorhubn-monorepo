/**
 * ClientPublishBanner — synk-status mellom produsent og klient på en flate.
 * Viser hvor mye som er publisert (synlig for klient) vs draft (privat), med
 * en bulk-publiser-handling. Del av draft→publiser→synk-grensen: klienten ser
 * KUN publisert innhold, så produsenten må aktivt publisere.
 *
 * Status alltid ikon-FORM + tekst (aldri farge alene), WCAG-toner, 44px touch.
 */
import { useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import {
  CloudUploadOutlined as PublishIcon,
  CheckCircleOutline as SyncedIcon,
  VisibilityOffOutlined as DraftIcon,
} from '@mui/icons-material';

type ClientPublishBannerProps = {
  /** Antall draft (upubliserte, private) elementer. */
  draftCount: number;
  /** Antall publiserte (synlige for klient) elementer. */
  publishedCount: number;
  /** Substantiv for elementene, f.eks. "budsjettlinjer", "tidslinjeelementer". */
  noun: string;
  /** Publiser alle draft til klient. */
  onPublishAll: () => Promise<void> | void;
  /** Skjul hele banneret når det ikke finnes elementer i det hele tatt. */
  hideWhenEmpty?: boolean;
};

export default function ClientPublishBanner({
  draftCount,
  publishedCount,
  noun,
  onPublishAll,
  hideWhenEmpty = true,
}: ClientPublishBannerProps) {
  const [busy, setBusy] = useState(false);
  const total = draftCount + publishedCount;
  if (hideWhenEmpty && total === 0) return null;

  const allPublished = draftCount === 0;

  const handlePublish = async () => {
    if (busy || draftCount === 0) return;
    setBusy(true);
    try {
      await onPublishAll();
    } finally {
      setBusy(false);
    }
  };

  const tone = allPublished
    ? { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', c: '#6ee7b7' }
    : { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.42)', c: '#fcd34d' };
  const ToneIcon = allPublished ? SyncedIcon : DraftIcon;

  return (
    <Box
      sx={{
        mt: 1.25, mb: 0.5, p: { xs: 1.25, md: 1.5 }, borderRadius: 2,
        backgroundColor: tone.bg, border: `1px solid ${tone.border}`,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25,
        justifyContent: 'space-between',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <ToneIcon sx={{ fontSize: 20, color: tone.c, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: '#f1f5f9', fontSize: '0.92rem', fontWeight: 700 }}>
            {allPublished
              ? `Alt er publisert til klienten`
              : `${draftCount} av ${total} ${noun} er ikke publisert ennå`}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.78rem' }}>
            {allPublished
              ? `Klienten ser alle ${publishedCount} ${noun}.`
              : `Klienten ser kun de ${publishedCount} publiserte. Draft holdes privat til du publiserer.`}
          </Typography>
        </Box>
      </Stack>
      {!allPublished ? (
        <Button
          onClick={handlePublish}
          disabled={busy}
          variant="contained"
          startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <PublishIcon />}
          sx={{
            textTransform: 'none', fontWeight: 700, minHeight: 44, flexShrink: 0,
            bgcolor: '#0f766e', '&:hover': { bgcolor: '#0d655e' },
          }}
        >
          {busy ? 'Publiserer …' : `Publiser ${draftCount} til klient`}
        </Button>
      ) : null}
    </Box>
  );
}

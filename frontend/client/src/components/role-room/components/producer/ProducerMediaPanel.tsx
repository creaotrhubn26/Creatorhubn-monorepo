import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { PermMedia as PermMediaIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';

interface ProducerMediaPanelProps {
  mediaCount?: number;
  storyboardCount?: number;
  shotCount?: number;
  onOpenStoryboard?: () => void;
  onOpenManuscript?: () => void;
  onOpenShotList?: () => void;
  onOpenSceneNotes?: () => void;
  onSendStoryboardReview?: () => void;
  onSendManuscriptReview?: () => void;
  onSendShotListReview?: () => void;
}

export default function ProducerMediaPanel({
  mediaCount = 0,
  storyboardCount = 0,
  shotCount = 0,
  onOpenStoryboard,
  onOpenManuscript,
  onOpenShotList,
  onOpenSceneNotes,
  onSendStoryboardReview,
  onSendManuscriptReview,
  onSendShotListReview,
}: ProducerMediaPanelProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.82) 100%)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Stack direction="row" spacing={1} alignItems="center">
          <PermMediaIcon sx={{ color: '#60a5fa' }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Media & leveranser
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip size="small" label={`Media ${mediaCount}`} />
          <Chip size="small" label={`Storyboards ${storyboardCount}`} />
          <Chip size="small" label={`Shots ${shotCount}`} />
        </Stack>
      </Stack>

      <Typography sx={{ color: 'rgba(203,213,225,0.9)' }}>
        Bruk dette panelet til å hoppe raskt til storyboard/manus og shotlist med riktig produsentfokus.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="outlined"
          endIcon={<OpenInNewIcon />}
          onClick={onOpenStoryboard}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Åpne storyboard/manus
        </Button>
        <Button
          variant="outlined"
          endIcon={<OpenInNewIcon />}
          onClick={onOpenManuscript}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Åpne manus
        </Button>
        <Button
          variant="outlined"
          endIcon={<OpenInNewIcon />}
          onClick={onOpenShotList}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Åpne shotlist
        </Button>
        <Button
          variant="outlined"
          endIcon={<OpenInNewIcon />}
          onClick={onOpenSceneNotes}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Åpne scene-notater
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="contained"
          onClick={onSendStoryboardReview}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: '#fbbf24',
            color: '#111827',
            '&:hover': { bgcolor: '#f59e0b' },
          }}
        >
          Send storyboard til klient
        </Button>
        <Button
          variant="contained"
          onClick={onSendManuscriptReview}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: '#fbbf24',
            color: '#111827',
            '&:hover': { bgcolor: '#f59e0b' },
          }}
        >
          Send manus til klient
        </Button>
        <Button
          variant="contained"
          onClick={onSendShotListReview}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: '#fbbf24',
            color: '#111827',
            '&:hover': { bgcolor: '#f59e0b' },
          }}
        >
          Send shotlist til klient
        </Button>
      </Stack>
    </Box>
  );
}

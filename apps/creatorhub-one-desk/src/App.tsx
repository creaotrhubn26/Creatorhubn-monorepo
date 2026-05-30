import { Box, Container, Stack, Typography } from "@mui/material";

export default function App() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            CreatorHub
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            One Desk
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1 }}>
            Mac-companion til iPad CaptureApp og minnekort-ingest etter oppdrag.
          </Typography>
        </Box>
        <Box
          sx={{
            p: 3,
            borderRadius: 2,
            border: "1px dashed",
            borderColor: "divider",
            color: "text.secondary",
          }}
        >
          <Typography variant="body2">
            F0 — scaffold. Auth + projects, mount-deteksjon, copy-engine,
            backend-rapportering, iPad-paring og live mirror kommer i F1–F6.
          </Typography>
        </Box>
      </Stack>
    </Container>
  );
}

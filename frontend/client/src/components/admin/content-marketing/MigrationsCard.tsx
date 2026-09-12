import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const MIGRATION_WORKFLOW_URL =
  "https://github.com/creaotrhubn26/Creatorhubn-monorepo/actions/workflows/auto-migrate-on-push.yml";

/**
 * Read-only production migration status. Execution belongs to the protected
 * GitHub Actions deploy gate and is intentionally unavailable from the web app.
 */
export function MigrationsCard() {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "rgba(34,197,94,0.08)",
        border: "1px solid rgba(34,197,94,0.3)",
        mb: 2,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <StorageIcon sx={{ color: "#22c55e", fontSize: "1.1rem" }} />
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem" }}>
                Database-migrasjoner
              </Typography>
              <Chip
                label="Deploy-gated"
                size="small"
                sx={{
                  bgcolor: "rgba(34,197,94,0.18)",
                  color: "#bbf7d0",
                  fontWeight: 700,
                  fontSize: "0.68rem",
                  height: 18,
                }}
              />
            </Stack>
            <Typography sx={{ color: "rgba(203,213,225,0.7)", fontSize: "0.76rem", mt: 0.4 }}>
              GitHub låser databasen og kjører migrasjoner før Render-deploy. Første SQL-feil stopper deployen.
            </Typography>
          </Box>
        </Stack>
        <Button
          component="a"
          href={MIGRATION_WORKFLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          variant="outlined"
          endIcon={<OpenInNewIcon />}
          sx={{ textTransform: "none", fontWeight: 700, color: "#c4b5fd", borderColor: "rgba(196,181,253,0.45)" }}
        >
          Åpne deploy-jobb
        </Button>
      </Stack>
      <Alert severity="info" sx={{ mt: 1.5 }}>
        Manuell migrering fra Admin Room er fjernet. Bruk den beskyttede workflowen for rerun eller status.
      </Alert>
    </Box>
  );
}

export default MigrationsCard;

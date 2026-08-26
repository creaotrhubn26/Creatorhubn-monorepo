import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const MIGRATION_WORKFLOW_URL =
  "https://github.com/creaotrhubn26/Creatorhubn-monorepo/actions/workflows/auto-migrate-on-push.yml";

/**
 * Production migrations are deliberately read-only in Admin Room. The protected
 * GitHub Actions job is the sole execution path.
 */
export function MigrationsTab(): JSX.Element {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: "1.1rem" }}>
          Migrasjoner
        </Typography>
        <Typography sx={{ color: "rgba(203,213,225,0.7)", fontSize: "0.86rem" }}>
          Produksjonsmigrering er flyttet ut av den offentlige backendprosessen.
        </Typography>
      </Box>

      <Alert severity="info" icon={<LockOutlinedIcon />}>
        GitHub Actions tar en PostgreSQL advisory lock, stopper på første SQL-feil og deployer deretter eksakt commit til Render.
      </Alert>

      <Paper
        sx={{
          p: 2,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip
              size="small"
              color="success"
              icon={<CheckCircleOutlineIcon />}
              label="Deploy-gated"
            />
            <Typography sx={{ color: "rgba(203,213,225,0.72)", fontSize: "0.82rem" }}>
              main → migrering → Render → health/smoke
            </Typography>
          </Stack>
          <Button
            component="a"
            href={MIGRATION_WORKFLOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            size="small"
            endIcon={<OpenInNewIcon />}
            sx={{ color: "#fff" }}
          >
            Åpne GitHub Actions
          </Button>
        </Stack>
      </Paper>

      <Alert severity="warning">
        Det finnes ikke lenger en knapp eller et HTTP-endepunkt som kan starte migrering fra webtjenesten. Rerun gjøres i Production-workflowen.
      </Alert>
    </Stack>
  );
}

export default MigrationsTab;

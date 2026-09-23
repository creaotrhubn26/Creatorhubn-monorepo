import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LightroomIntegrationCard from "./LightroomIntegrationCard";

interface Props {
  compact?: boolean;
}

interface CompanionPlugin {
  id: string;
  monogram: string;
  name: string;
  category: "Video" | "Lyd";
  description: string;
  availability: string;
  accent: string;
  foreground: string;
}

const companionPlugins: CompanionPlugin[] = [
  {
    id: "premiere-pro",
    monogram: "Pr",
    name: "Adobe Premiere Pro",
    category: "Video",
    description: "Send sekvenser til Video Room og synk kommentarer og markører.",
    availability: "UXP-pakke",
    accent: "#2f2458",
    foreground: "#d8b8ff",
  },
  {
    id: "davinci-resolve",
    monogram: "DR",
    name: "DaVinci Resolve",
    category: "Video",
    description: "Bakgrunnssynk for review, markører og leveranser via CreatorHub Bridge.",
    availability: "Bridge-integrasjon",
    accent: "#162f3c",
    foreground: "#62d7ff",
  },
  {
    id: "pro-tools",
    monogram: "PT",
    name: "Avid Pro Tools",
    category: "Lyd",
    description: "Koble bounces, revisjoner og Sound Room til CreatorHub Companion.",
    availability: "Companion-app",
    accent: "#301d45",
    foreground: "#cf8cff",
  },
];

function CompanionPluginCard({ plugin }: { plugin: CompanionPlugin }) {
  return (
    <Card
      variant="outlined"
      component="article"
      sx={{ height: "100%", bgcolor: "background.paper" }}
    >
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: 1.5,
              bgcolor: plugin.accent,
              color: plugin.foreground,
              border: "1px solid",
              borderColor: `${plugin.foreground}55`,
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            {plugin.monogram}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {plugin.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {plugin.category}
            </Typography>
          </Box>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {plugin.description}
        </Typography>

        <Chip
          label={plugin.availability}
          size="small"
          variant="outlined"
          sx={{ alignSelf: "flex-start" }}
        />
      </CardContent>
    </Card>
  );
}

function CatalogContent() {
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800 }}>
          CreatorHub Plugins
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75 }}>
          Koble verktøyene dine til samme arbeidsflyt
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 680 }}>
          Installer og administrer CreatorHub-integrasjoner for foto, video og lyd. Lightroom
          Classic kan installeres direkte her; øvrige integrasjoner beholder sine dedikerte
          pakker mens de samles i katalogen.
        </Typography>
      </Box>

      <LightroomIntegrationCard />

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
          Flere CreatorHub-integrasjoner
        </Typography>
        <Grid container spacing={1.5}>
          {companionPlugins.map((plugin) => (
            <Grid key={plugin.id} size={{ xs: 12, sm: 4 }}>
              <CompanionPluginCard plugin={plugin} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Stack>
  );
}

export default function PluginsCatalog({ compact = false }: Props) {
  const [open, setOpen] = useState(false);

  if (!compact) {
    return <CatalogContent />;
  }

  return (
    <>
      <Button
        variant="outlined"
        size="large"
        startIcon={<AppsOutlinedIcon />}
        endIcon={<ArrowForwardIcon />}
        onClick={() => setOpen(true)}
        sx={{ justifyContent: "space-between" }}
      >
        CreatorHub Plugins
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AppsOutlinedIcon color="primary" />
          CreatorHub Plugins
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          <CatalogContent />
        </DialogContent>
      </Dialog>
    </>
  );
}

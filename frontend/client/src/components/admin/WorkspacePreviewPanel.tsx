/**
 * WorkspacePreviewPanel.tsx
 *
 * Super_admin «Workspace-velger» — Del 1 (forhåndsvis UI per profesjon).
 * Daniel kan velge en profesjon og se den workspacen sitt grensesnitt
 * (UniversalDashboard(profession)) med egne/tomme data, for å inspisere
 * layout/flyt for hver rolle. «Vis som ekte bruker» (impersonation) er Del 2.
 */

import React, { useState } from "react";
import { Box, Typography, Card, CardActionArea, CardContent, Stack, Alert, Button } from "@mui/material";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import Videocam from "@mui/icons-material/Videocam";
import GraphicEq from "@mui/icons-material/GraphicEq";
import Storefront from "@mui/icons-material/Storefront";
import ArrowBack from "@mui/icons-material/ArrowBack";
import UniversalDashboard from "@/components/universal/UniversalDashboard";

type Prof = "photographer" | "videographer" | "music_producer" | "vendor";

const PROFS: Array<{ id: Prof; label: string; icon: React.ReactNode; desc: string }> = [
  { id: "photographer", label: "Fotograf", icon: <PhotoCamera />, desc: "Prosjekter, kunder, utstyr, lønnsomhet" },
  { id: "videographer", label: "Videograf", icon: <Videocam />, desc: "Video-workspace" },
  { id: "music_producer", label: "Musikkprodusent", icon: <GraphicEq />, desc: "Produsent-workspace" },
  { id: "vendor", label: "Vendor", icon: <Storefront />, desc: "Vendor-/leverandør-workspace" },
];

export default function WorkspacePreviewPanel() {
  const [preview, setPreview] = useState<Prof | null>(null);

  if (preview) {
    const p = PROFS.find((x) => x.id === preview)!;
    return (
      <Box>
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" startIcon={<ArrowBack />} onClick={() => setPreview(null)}>Tilbake til valg</Button>}
        >
          <b>Forhåndsvisning: {p.label}-workspace</b> — dette er grensesnittet rollen ser (med dine/tomme data). For ekte data, bruk «vis som bruker» (Del 2, kommer).
        </Alert>
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
          <UniversalDashboard profession={preview} />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Workspaces — forhåndsvis per profesjon</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
        Velg en profesjon for å se dens workspace-grensesnitt (for å inspisere layout/flyt for hver rolle).
        «Vis som en ekte bruker» med deres data + editing-partner-workspacen kommer i Del 2 (impersonation).
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {PROFS.map((p) => (
          <Card key={p.id} variant="outlined" sx={{ width: 240 }}>
            <CardActionArea onClick={() => setPreview(p.id)}>
              <CardContent>
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 0.5 }}>
                  {p.icon}
                  <Typography sx={{ fontWeight: 700 }}>{p.label}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">{p.desc}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

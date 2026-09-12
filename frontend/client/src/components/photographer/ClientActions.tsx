/**
 * ClientActions.tsx
 *
 * EGEN, frittstående «smarte handlinger»-løsning for fotograf ↔ KLIENT —
 * speiler mønsteret fra editing-chattens EditingJobActions (og inspirert av,
 * men IKKE koblet til, Role Rooms «Actions»). Gir fotografen kontekst-bevisste
 * hurtighandlinger rett i klient-chatten: ett klikk fyller en profesjonell,
 * personalisert mal inn i meldingsfeltet, som så sendes via den eksisterende
 * klient-meldings-API-en (Gmail-tråd). Fotografen ser over teksten før sending.
 *
 * Utvidbart via TEMPLATES-registeret. Helt frikoblet fra editing- og Role
 * Room-løsningene.
 */

import React from "react";
import { Box, Stack, Button, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CollectionsIcon from "@mui/icons-material/Collections";
import StarIcon from "@mui/icons-material/StarBorder";
import EventIcon from "@mui/icons-material/Event";
import NotificationsIcon from "@mui/icons-material/NotificationsActive";

interface Template {
  id: string;
  label: string;
  icon: React.ReactNode;
  text: (name: string) => string;
}

const TEMPLATES: Template[] = [
  {
    id: "gallery",
    label: "Del galleri",
    icon: <CollectionsIcon fontSize="small" />,
    text: (n) =>
      `Hei ${n}! Galleriet ditt er klart 🎉 Her er lenken: [lim inn galleri-lenke]. Håper du blir like fornøyd som meg — gi gjerne beskjed hva du synes!`,
  },
  {
    id: "approve",
    label: "Be om godkjenning",
    icon: <CheckCircleIcon fontSize="small" />,
    text: (n) =>
      `Hei ${n}! Kan du se over leveransen og bekrefte at alt ser bra ut? Si fra om du ønsker noen justeringer 😊`,
  },
  {
    id: "review",
    label: "Be om anmeldelse",
    icon: <StarIcon fontSize="small" />,
    text: (n) =>
      `Tusen takk for at jeg fikk jobbe med deg, ${n}! Hvis du er fornøyd, ville en kort anmeldelse betydd enormt mye: [lim inn lenke] 🙏`,
  },
  {
    id: "booking",
    label: "Book neste",
    icon: <EventIcon fontSize="small" />,
    text: (n) =>
      `Hei ${n}! Skal vi finne en dato for neste shoot? Si fra hva som passer, så finner vi et tidspunkt 📅`,
  },
  {
    id: "reminder",
    label: "Vennlig påminnelse",
    icon: <NotificationsIcon fontSize="small" />,
    text: (n) =>
      `Hei ${n}, bare en vennlig påminnelse 🙂 Gi beskjed om du har spørsmål eller trenger noe fra meg!`,
  },
];

export default function ClientActions({
  clientName,
  onPrefill,
}: {
  clientName: string | null;
  onPrefill: (text: string) => void;
}) {
  const name = (clientName || "").trim() || "der";
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        Hurtighandlinger
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {TEMPLATES.map((tpl) => (
          <Button
            key={tpl.id}
            size="small"
            variant="outlined"
            startIcon={tpl.icon}
            onClick={() => onPrefill(tpl.text(name))}
          >
            {tpl.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}

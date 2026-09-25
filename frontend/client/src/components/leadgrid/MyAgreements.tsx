/**
 * Mine avtaler — kundens eget arkiv.
 *
 * Folk signerer én gang og leter etter avtalen et halvt år senere, som regel
 * fordi noen har spurt hva som står i den. Da skal den ligge i profilen,
 * ikke i en innboks: teksten som ble signert, hvem som signerte, når, og
 * sjekksummen som viser at det er samme dokument.
 *
 * Kun bedriftens egen admin ser denne. Serveren avgjør det (403), klienten
 * viser bare begrunnelsen.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip,
  CircularProgress, Stack, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockIcon from "@mui/icons-material/Lock";
import { apiRequest } from "@/lib/queryClient";
import { SignaturVisning, type SignaturStil } from "./Signatur";

interface SignertAvtale {
  agreement_type: string;
  label: string;
  document_version: string;
  document_sha256: string;
  signed_at: string;
  signer_name: string;
  signer_title: string | null;
  signer_email: string;
  provider_legal_name: string;
  provider_org_number: string;
  signature_text: string | null;
  signature_style: SignaturStil | null;
  receipt_sent_at: string | null;
}

interface Svar {
  agreements: SignertAvtale[];
  documents: Record<string, { title: string; body: string; version: string }>;
  provider: { legalName: string; orgNumber: string; address: string };
}

function tid(iso: string): string {
  return new Date(iso).toLocaleString("nb-NO", { dateStyle: "long", timeStyle: "short" });
}

export function MyAgreements({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery<Svar>({
    queryKey: ["leadgrid-mine-avtaler", projectId],
    queryFn: () =>
      apiRequest(`/api/leadgrid/avtaler?project_id=${encodeURIComponent(projectId)}`),
    enabled: Boolean(projectId),
    retry: false,
  });

  if (isLoading) return <CircularProgress />;

  // 403 her er ikke en feil, det er svaret: du er ikke admin i bedriften.
  if (error) {
    const nektet = /403|org_admin_required/.test((error as Error).message ?? "");
    return (
      <Alert severity={nektet ? "info" : "error"} icon={nektet ? <LockIcon /> : undefined}>
        {nektet
          ? "Bare administratoren i bedriften din kan se signerte avtaler."
          : ((error as Error).message || "Fikk ikke hentet avtalene.")}
      </Alert>
    );
  }

  const avtaler = data?.agreements ?? [];
  if (avtaler.length === 0) {
    return <Alert severity="info">Ingen avtaler er signert ennå.</Alert>;
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Box>
        <Typography variant="h6">Mine avtaler</Typography>
        <Typography variant="body2" color="text.secondary">
          Avtalene bedriften din har signert med {data?.provider.legalName}
          {data?.provider.orgNumber ? `, org.nr ${data.provider.orgNumber}` : ""}.
        </Typography>
      </Box>

      {avtaler.map((a) => {
        const dok = data?.documents?.[a.agreement_type];
        const utdatert = dok && dok.version !== a.document_version;
        return (
          <Accordion key={a.agreement_type}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
                <Typography sx={{ fontWeight: 600, flex: 1 }}>{a.label}</Typography>
                <Chip size="small" label={tid(a.signed_at).split(" kl")[0]} variant="outlined" />
                {utdatert && <Chip size="small" color="warning" label="Ny versjon finnes" />}
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {a.signature_text && a.signature_style ? (
                  <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2.5 }}>
                    <SignaturVisning
                      tekst={a.signature_text}
                      stil={a.signature_style}
                      undertekst={
                        <>
                          {a.signer_name}{a.signer_title ? ` · ${a.signer_title}` : ""}
                          {" · "}{tid(a.signed_at)}
                        </>
                      }
                    />
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Signert av {a.signer_name} {tid(a.signed_at)}.
                  </Typography>
                )}

                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Versjon {a.document_version} · motpart {a.provider_legal_name},
                    org.nr {a.provider_org_number}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                    Sjekksum {a.document_sha256}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.receipt_sent_at
                      ? `Kvittering sendt til ${a.signer_email} ${tid(a.receipt_sent_at)}`
                      : `Kvittering til ${a.signer_email} er ikke registrert sendt`}
                  </Typography>
                </Stack>

                {dok && (
                  <Box
                    sx={{
                      maxHeight: 340, overflowY: "auto", p: 2, borderRadius: 1,
                      bgcolor: "action.hover", fontSize: "0.85rem", whiteSpace: "pre-wrap",
                    }}
                  >
                    {dok.body}
                  </Box>
                )}
                {utdatert && (
                  <Alert severity="warning">
                    Teksten over er gjeldende versjon ({dok?.version}). Du signerte
                    versjon {a.document_version} — sjekksummen tilhører den.
                  </Alert>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
}

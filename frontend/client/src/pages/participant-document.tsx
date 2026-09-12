import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import GavelOutlined from "@mui/icons-material/GavelOutlined";
import PolicyOutlined from "@mui/icons-material/PolicyOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import type {
  WorkspaceParticipantCompensationSnapshot,
  WorkspaceParticipantContractTermsInput,
  WorkspaceParticipantDocumentPublicResponse,
  WorkspaceParticipantMediaConsentTermsInput,
} from "@shared/workspace-participant-documents";
import {
  consumeWorkspaceParticipantDocumentToken,
  isExactWorkspaceParticipantSignerName,
} from "@/components/workspace/participants/workspaceParticipantDocumentModel";
import { workspaceParticipantDocumentPublicApi } from "@/components/workspace/participants/workspaceParticipantDocumentPublicApi";
import { workspaceParticipantDocumentsError } from "@/components/workspace/participants/workspaceParticipantDocumentErrors";
import { takeWorkspaceParticipantDocumentCredential } from "@/lib/workspaceParticipantDocumentCredential";

const COLOR = {
  bg: "#071019",
  panel: "#101b26",
  panelAlt: "#142230",
  border: "rgba(255,255,255,0.11)",
  text: "#f7f7f3",
  dim: "rgba(247,247,243,0.68)",
  faint: "rgba(247,247,243,0.46)",
  accent: "#68d5c8",
  accentDark: "#062b29",
  green: "#78d6a3",
  amber: "#f2c66d",
  red: "#ff8d8d",
};

const STATUS: Record<string, string> = {
  draft: "Utkast",
  issued: "Utstedt",
  viewed: "Åpnet",
  signed: "Signert",
  declined: "Avvist",
  withdrawn: "Trukket tilbake",
  expired: "Utløpt",
  superseded: "Erstattet",
};

const FIELD_SX = {
  "& .MuiInputBase-input": { color: COLOR.text },
  "& .MuiInputLabel-root": { color: COLOR.dim },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: COLOR.border },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.28)",
  },
};

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("nb-NO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography
        component="dt"
        sx={{
          color: COLOR.faint,
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{
          color: COLOR.text,
          fontSize: 13.5,
          m: 0,
          mt: 0.25,
          whiteSpace: "pre-wrap",
        }}
      >
        {children || "—"}
      </Typography>
    </Box>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="dl"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        gap: 2,
        m: 0,
      }}
    >
      {children}
    </Box>
  );
}

function StringList({ values }: { values: string[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.2 }}>
      {values.map((value) => (
        <Typography
          component="li"
          key={value}
          sx={{ color: COLOR.text, fontSize: 13.5, mb: 0.35 }}
        >
          {value}
        </Typography>
      ))}
    </Box>
  );
}

function compensationMoney(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: currency || "NOK",
    maximumFractionDigits: 2,
  }).format(value);
}

function CompensationTerms({
  compensation,
}: {
  compensation: WorkspaceParticipantCompensationSnapshot | null | undefined;
}) {
  if (compensation === undefined) {
    return (
      <Detail label="Honorar og betaling">
        Ikke tilgjengelig i denne eldre dokumentversjonen
      </Detail>
    );
  }
  if (compensation === null) {
    return (
      <Detail label="Honorar og betaling">
        Ingen honorarvilkår er knyttet til kontrakten
      </Detail>
    );
  }

  return (
    <Stack spacing={1.25}>
      <DetailGrid>
        <Detail label="Honorartype">
          {compensation.type === "hourly"
            ? "Timesats"
            : compensation.type === "fixed"
              ? "Fast honorar"
              : "Ubetalt oppdrag"}
        </Detail>
        <Detail label="Vilkårsversjon">{compensation.version}</Detail>
        {compensation.type === "hourly" && (
          <>
            <Detail label="Timesats">
              {compensationMoney(
                compensation.hourlyRate,
                compensation.currency,
              )}
            </Detail>
            <Detail label="Estimerte timer">
              {compensation.estimatedHours}
            </Detail>
            <Detail label="Beregnet total">
              {compensationMoney(
                compensation.estimatedAmount,
                compensation.currency,
              )}
            </Detail>
          </>
        )}
        {compensation.type === "fixed" && (
          <Detail label="Fast beløp">
            {compensationMoney(
              compensation.fixedAmount ?? compensation.estimatedAmount,
              compensation.currency,
            )}
          </Detail>
        )}
      </DetailGrid>
      {compensation.note && (
        <Detail label="Merknad">{compensation.note}</Detail>
      )}
    </Stack>
  );
}

function ContractTerms({
  terms,
  compensation,
}: {
  terms: WorkspaceParticipantContractTermsInput;
  compensation: WorkspaceParticipantCompensationSnapshot | null | undefined;
}) {
  return (
    <Stack spacing={2}>
      <Detail label="Oppdrag">{terms.workDescription}</Detail>
      <DetailGrid>
        <Detail label="Rolle">{terms.role}</Detail>
        <Detail label="Periode">
          {terms.startsOn || terms.endsOn
            ? dateLabel(terms.startsOn ?? null) +
              " – " +
              dateLabel(terms.endsOn ?? null)
            : "Ikke datofestet"}
        </Detail>
        <Detail label="Avbestilling">{terms.cancellationTerms}</Detail>
        <Detail label="Sikkerhet">{terms.safetyTerms}</Detail>
        <Detail label="Konfidensialitet">{terms.confidentialityTerms}</Detail>
      </DetailGrid>
      <CompensationTerms compensation={compensation} />
      {terms.additionalTerms && (
        <Detail label="Andre vilkår">{terms.additionalTerms}</Detail>
      )}
    </Stack>
  );
}

function MediaConsentTerms({
  terms,
}: {
  terms: WorkspaceParticipantMediaConsentTermsInput;
}) {
  const mediaLabel: Record<string, string> = {
    photo: "Foto",
    video: "Video",
    audio: "Lyd",
  };
  return (
    <Stack spacing={2}>
      <DetailGrid>
        <Detail label="Medietyper">
          {terms.mediaTypes.map((item) => mediaLabel[item] ?? item).join(", ")}
        </Detail>
        <Detail label="Geografisk område">{terms.territory}</Detail>
        <Detail label="Bruksperiode">{terms.duration}</Detail>
        <Detail label="Lagring og sletting">{terms.retention}</Detail>
        <Detail label="Redigering">
          {terms.editingAllowed ? "Tillatt" : "Ikke tillatt"}
        </Detail>
        <Detail label="Betalt annonsering">
          {terms.paidMediaAllowed ? "Tillatt" : "Ikke tillatt"}
        </Detail>
      </DetailGrid>
      <Box>
        <Typography
          sx={{ color: COLOR.faint, fontSize: 10.5, fontWeight: 800, mb: 0.5 }}
        >
          FORMÅL
        </Typography>
        <StringList values={terms.purposes} />
      </Box>
      <Box>
        <Typography
          sx={{ color: COLOR.faint, fontSize: 10.5, fontWeight: 800, mb: 0.5 }}
        >
          KANALER
        </Typography>
        <StringList values={terms.channels} />
      </Box>
      <Detail label="Kontakt for tilbaketrekking">
        {terms.withdrawalContact}
      </Detail>
      {terms.additionalTerms && (
        <Detail label="Andre vilkår">{terms.additionalTerms}</Detail>
      )}
    </Stack>
  );
}

function PublicError({ message }: { message: string }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: COLOR.bg,
        color: COLOR.text,
        display: "grid",
        placeItems: "center",
        p: 3,
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid " + COLOR.border,
          bgcolor: COLOR.panel,
          borderRadius: 3,
          p: 3,
          textAlign: "center",
        }}
      >
        <WarningAmberOutlined sx={{ color: COLOR.amber, fontSize: 44 }} />
        <Typography sx={{ fontWeight: 850, fontSize: 19, mt: 1 }}>
          Dokumentet kan ikke åpnes
        </Typography>
        <Typography sx={{ color: COLOR.dim, fontSize: 13.5, mt: 1 }}>
          {message}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ParticipantDocumentPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const tokenRef = useRef<string | null>(null);
  const consumedRef = useRef(false);
  const [credentialReady, setCredentialReady] = useState(false);
  const [document, setDocument] =
    useState<WorkspaceParticipantDocumentPublicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typedName, setTypedName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawConfirmed, setWithdrawConfirmed] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");

  useLayoutEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;
    tokenRef.current =
      (documentId
        ? takeWorkspaceParticipantDocumentCredential(documentId)
        : null) ??
      consumeWorkspaceParticipantDocumentToken(window.location, (cleanUrl) => {
        window.history.replaceState(
          window.history.state,
          window.document.title,
          cleanUrl,
        );
      });
    setCredentialReady(true);
  }, [documentId]);

  useEffect(() => {
    if (!credentialReady) return;
    const token = tokenRef.current;
    if (!documentId || !token) {
      setError("Den personlige lenken er ugyldig eller mangler tilgangskoden.");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    workspaceParticipantDocumentPublicApi
      .get(documentId, token)
      .then((result) => {
        if (active) setDocument(result);
      })
      .catch((requestError) => {
        if (!active) return;
        const apiError = workspaceParticipantDocumentsError(requestError);
        setError(
          apiError.status === 410
            ? "Denne personlige lenken er utløpt eller tilbakekalt. Be prosjektansvarlig om en ny lenke."
            : apiError.message,
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [credentialReady, documentId]);

  const sign = async () => {
    const token = tokenRef.current;
    if (!document || !documentId || !token) return;
    if (
      !accepted ||
      !isExactWorkspaceParticipantSignerName(typedName, document.signerName)
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await workspaceParticipantDocumentPublicApi.sign(
        documentId,
        token,
        { signerName: typedName, accepted: true, signatureMethod: "typed" },
      );
      setDocument(result.document);
      setNotice(
        result.alreadySigned
          ? "Dokumentet var allerede signert."
          : "Dokumentet er signert.",
      );
    } catch (requestError) {
      setError(workspaceParticipantDocumentsError(requestError).message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    const token = tokenRef.current;
    if (
      !document ||
      !documentId ||
      !token ||
      document.documentType !== "media_consent" ||
      document.status !== "signed" ||
      !document.canWithdraw ||
      !withdrawConfirmed
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await workspaceParticipantDocumentPublicApi.withdraw(
        documentId,
        token,
        {
          confirmed: true,
          ...(withdrawReason.trim() ? { reason: withdrawReason.trim() } : {}),
        },
      );
      setDocument(result.document);
      setWithdrawOpen(false);
      setNotice(
        result.alreadyWithdrawn
          ? "Samtykket var allerede trukket tilbake."
          : "Mediesamtykket er trukket tilbake.",
      );
    } catch (requestError) {
      setError(workspaceParticipantDocumentsError(requestError).message);
    } finally {
      setBusy(false);
    }
  };

  if (!credentialReady || loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: COLOR.bg,
          display: "grid",
          placeItems: "center",
        }}
      >
        <CircularProgress sx={{ color: COLOR.accent }} />
      </Box>
    );
  }
  if (!document) {
    return <PublicError message={error || "Dokumentet finnes ikke."} />;
  }

  const snapshot = document.terms;
  const isContract = document.documentType === "contract";
  const canSign =
    document.canSign &&
    accepted &&
    isExactWorkspaceParticipantSignerName(typedName, document.signerName);
  const canWithdraw =
    document.documentType === "media_consent" &&
    document.status === "signed" &&
    document.canWithdraw;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: COLOR.bg,
        color: COLOR.text,
        py: { xs: 2, md: 5 },
        px: { xs: 1.5, md: 3 },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 860, mx: "auto" }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              display: "grid",
              placeItems: "center",
              borderRadius: 2,
              bgcolor: "rgba(104,213,200,0.14)",
            }}
          >
            {isContract ? (
              <GavelOutlined sx={{ color: COLOR.accent }} />
            ) : (
              <PolicyOutlined sx={{ color: COLOR.accent }} />
            )}
          </Box>
          <Box>
            <Typography
              sx={{
                color: COLOR.faint,
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              CreatorHub · prosjektdokument
            </Typography>
            <Typography sx={{ color: COLOR.dim, fontSize: 12 }}>
              Personlig og konfidensiell dokumentvisning
            </Typography>
          </Box>
        </Stack>

        <Box
          component="main"
          sx={{
            bgcolor: COLOR.panel,
            border: "1px solid " + COLOR.border,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <Box sx={{ p: { xs: 2.25, md: 4 } }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography
                  component="h1"
                  sx={{
                    fontWeight: 900,
                    fontSize: { xs: 24, md: 31 },
                    lineHeight: 1.15,
                  }}
                >
                  {document.title}
                </Typography>
                <Typography sx={{ color: COLOR.dim, fontSize: 13, mt: 0.75 }}>
                  {snapshot.project.title + " · " + snapshot.participant.name}
                </Typography>
              </Box>
              <Box
                sx={{
                  alignSelf: { sm: "flex-start" },
                  borderRadius: 999,
                  px: 1.4,
                  py: 0.6,
                  bgcolor:
                    document.status === "signed"
                      ? "rgba(120,214,163,0.14)"
                      : document.status === "withdrawn"
                        ? "rgba(255,141,141,0.13)"
                        : "rgba(104,213,200,0.12)",
                  color:
                    document.status === "signed"
                      ? COLOR.green
                      : document.status === "withdrawn"
                        ? COLOR.red
                        : COLOR.accent,
                  fontWeight: 850,
                  fontSize: 12,
                }}
              >
                {STATUS[document.status] ?? document.status}
              </Box>
            </Stack>

            <Divider sx={{ borderColor: COLOR.border, my: 3 }} />

            <DetailGrid>
              <Detail label="Prosjekt">{snapshot.project.title}</Detail>
              <Detail label="Dokumenttype">
                {isContract ? "Kontrakt" : "Mediesamtykke"}
              </Detail>
              <Detail label="Produsent">
                {snapshot.producer.companyName || snapshot.producer.name}
              </Detail>
              <Detail label="Medvirkende">{snapshot.participant.name}</Detail>
              <Detail label="Mottaker / signerer">
                {snapshot.signer.name +
                  (snapshot.signer.role === "guardian" ? " (foresatt)" : "")}
              </Detail>
              <Detail label="Utstedt">{dateLabel(document.issuedAt)}</Detail>
              {snapshot.signer.guardianRelationship && (
                <Detail label="Relasjon">
                  {snapshot.signer.guardianRelationship}
                </Detail>
              )}
            </DetailGrid>

            <Divider sx={{ borderColor: COLOR.border, my: 3 }} />

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <DescriptionOutlined sx={{ color: COLOR.accent }} />
              <Typography component="h2" sx={{ fontWeight: 850, fontSize: 18 }}>
                Vilkår
              </Typography>
            </Stack>
            {snapshot.terms.kind === "contract" ? (
              <ContractTerms
                terms={snapshot.terms}
                compensation={snapshot.compensation}
              />
            ) : (
              <MediaConsentTerms terms={snapshot.terms} />
            )}

            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: 2,
                bgcolor: COLOR.panelAlt,
                border: "1px solid " + COLOR.border,
              }}
            >
              <Typography
                sx={{ color: COLOR.faint, fontSize: 10.5, fontWeight: 800 }}
              >
                BEKREFTELSE
              </Typography>
              <Typography sx={{ color: COLOR.text, fontSize: 13.5, mt: 0.5 }}>
                {snapshot.acceptance.text}
              </Typography>
              <Typography sx={{ color: COLOR.faint, fontSize: 10.5, mt: 1.2 }}>
                Dokumentversjon {document.version} · dokumentfingeravtrykk{" "}
                {document.contentHash}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              p: { xs: 2.25, md: 4 },
              bgcolor: COLOR.panelAlt,
              borderTop: "1px solid " + COLOR.border,
            }}
          >
            {!!error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {!!notice && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {notice}
              </Alert>
            )}

            {document.canSign ? (
              <Stack spacing={1.5}>
                <Typography
                  component="h2"
                  sx={{ fontWeight: 850, fontSize: 18 }}
                >
                  Signer dokumentet
                </Typography>
                <Alert severity="warning">
                  Denne prosessen dokumenterer tilgang til den personlige lenken
                  sendt til den registrerte e-postadressen. Navnet skrives
                  manuelt; identiteten er ikke verifisert med eID eller BankID.
                </Alert>
                <Alert severity="info">
                  Skriv mottakernavnet nøyaktig som vist:{" "}
                  <strong>{document.signerName}</strong>
                </Alert>
                <TextField
                  label="Mottakernavn"
                  value={typedName}
                  onChange={(event) => setTypedName(event.target.value)}
                  error={
                    !!typedName &&
                    !isExactWorkspaceParticipantSignerName(
                      typedName,
                      document.signerName,
                    )
                  }
                  helperText={
                    typedName &&
                    !isExactWorkspaceParticipantSignerName(
                      typedName,
                      document.signerName,
                    )
                      ? "Navnet må være helt likt mottakernavnet over."
                      : " "
                  }
                  fullWidth
                  sx={FIELD_SX}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={accepted}
                      onChange={(event) => setAccepted(event.target.checked)}
                      sx={{
                        color: COLOR.dim,
                        "&.Mui-checked": { color: COLOR.accent },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ color: COLOR.text, fontSize: 13 }}>
                      Jeg har lest vilkårene og gir den bekreftelsen som står i
                      dokumentet.
                    </Typography>
                  }
                />
                <Button
                  variant="contained"
                  onClick={() => void sign()}
                  disabled={!canSign || busy}
                  startIcon={busy ? <CircularProgress size={16} /> : undefined}
                  sx={{
                    alignSelf: { sm: "flex-start" },
                    bgcolor: COLOR.accent,
                    color: COLOR.accentDark,
                    fontWeight: 850,
                    textTransform: "none",
                    "&:hover": { bgcolor: "#88e4da" },
                  }}
                >
                  {busy ? "Signerer…" : "Signer med skrevet navn"}
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1.2} alignItems="flex-start">
                <CheckCircleOutline
                  sx={{
                    color:
                      document.status === "withdrawn" ? COLOR.red : COLOR.green,
                    mt: 0.15,
                  }}
                />
                <Box>
                  <Typography sx={{ fontWeight: 850, fontSize: 15 }}>
                    {document.status === "withdrawn"
                      ? "Samtykket er trukket tilbake"
                      : document.status === "signed"
                        ? "Dokumentet er signert"
                        : "Dokumentet kan ikke signeres"}
                  </Typography>
                  {document.signedAt && (
                    <Typography
                      sx={{ color: COLOR.dim, fontSize: 12.5, mt: 0.25 }}
                    >
                      Signert {dateLabel(document.signedAt)}
                    </Typography>
                  )}
                  {document.withdrawnAt && (
                    <Typography
                      sx={{ color: COLOR.dim, fontSize: 12.5, mt: 0.25 }}
                    >
                      Trukket tilbake {dateLabel(document.withdrawnAt)}
                    </Typography>
                  )}
                </Box>
              </Stack>
            )}

            {canWithdraw && (
              <Box
                sx={{
                  mt: 3,
                  pt: 2.5,
                  borderTop: "1px solid " + COLOR.border,
                }}
              >
                <Typography
                  sx={{ color: COLOR.text, fontWeight: 850, fontSize: 14 }}
                >
                  Tilbaketrekking av mediesamtykke
                </Typography>
                <Typography
                  sx={{
                    color: COLOR.dim,
                    fontSize: 12.5,
                    mt: 0.5,
                    maxWidth: 660,
                  }}
                >
                  Dette er en egen handling. Kontrakten påvirkes ikke. Videre
                  bruk av materialet må håndteres etter vilkårene og gjeldende
                  regler.
                </Typography>
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() => {
                    setWithdrawConfirmed(false);
                    setWithdrawReason("");
                    setWithdrawOpen(true);
                  }}
                  sx={{ mt: 1.5, textTransform: "none" }}
                >
                  Trekk tilbake mediesamtykke
                </Button>
              </Box>
            )}
          </Box>
        </Box>
        <Typography
          sx={{
            color: COLOR.faint,
            fontSize: 10.5,
            textAlign: "center",
            mt: 2,
          }}
        >
          Denne personlige lenken skal ikke videresendes.
        </Typography>
      </Box>

      <Dialog
        open={withdrawOpen}
        onClose={() => {
          if (!busy) setWithdrawOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Trekk tilbake mediesamtykke?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning">
              Tilbaketrekkingen gjelder bare dette mediesamtykket. Handlingen
              registreres med tidspunkt.
            </Alert>
            <TextField
              label="Begrunnelse (valgfritt)"
              value={withdrawReason}
              onChange={(event) => setWithdrawReason(event.target.value)}
              multiline
              minRows={3}
              inputProps={{ maxLength: 1000 }}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={withdrawConfirmed}
                  onChange={(event) =>
                    setWithdrawConfirmed(event.target.checked)
                  }
                />
              }
              label="Jeg bekrefter uttrykkelig at jeg vil trekke tilbake dette mediesamtykket."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawOpen(false)} disabled={busy}>
            Avbryt
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void withdraw()}
            disabled={!withdrawConfirmed || busy}
          >
            {busy ? "Trekker tilbake…" : "Bekreft tilbaketrekking"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

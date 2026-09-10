import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import {
  AssignmentOutlined,
  CheckCircle as CheckIcon,
  Close as CloseIcon,
  GavelOutlined,
  HandshakeOutlined,
  HowToRegOutlined,
  LockOutlined,
  MailOutline,
  MenuBookOutlined,
  PrivacyTipOutlined,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { trackEvent } from "@/utils/ga4-client-tracking";
import { testerEvents } from "@/utils/creatorhub-events";
import { ws, workspaceDarkTheme } from "@/components/workspace/workspaceTheme";
import type {
  PrototypeTesterAgreementDocument,
  PrototypeTesterAgreementKey,
} from "@shared/prototype-tester-agreements";

type MemberProfession =
  | "photographer"
  | "videographer"
  | "music_producer"
  | "vendor"
  | null;

interface Invite {
  id: string;
  email: string;
  name: string;
  testingAreas: string[];
  personalMessage: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  programDurationWeeks: number;
  memberProfession: MemberProfession;
  memberCompany: string | null;
  memberOrganizationNumber?: string | null;
  memberBusinessAddress?: string | null;
  agreements: PrototypeTesterAgreementDocument[];
  accountProvisioningComplete: boolean;
  agreementAcceptance?: {
    complete: boolean;
    signerName: string | null;
    confirmedSigningAuthority: boolean;
    documents: Array<{ key: PrototypeTesterAgreementKey; accepted: boolean }>;
  };
}

const dashboardForProfession = (profession: MemberProfession): string => {
  const routes: Record<Exclude<MemberProfession, null>, string> = {
    photographer: "/photographer-dashboard-material",
    videographer: "/videographer-dashboard-material",
    music_producer: "/music_producer-dashboard-material",
    vendor: "/vendor-dashboard-material",
  };
  return profession ? routes[profession] : "/workspace";
};

const readToken = (): string => {
  try {
    return new URLSearchParams(window.location.search).get("token") ?? "";
  } catch {
    return "";
  }
};

const agreementIcon = (
  key: PrototypeTesterAgreementKey,
  completed: boolean,
) => {
  const sx = { color: completed ? ws.green : ws.accent, fontSize: 23 };
  switch (key) {
    case "program_terms":
      return <AssignmentOutlined sx={sx} />;
    case "nda":
      return <GavelOutlined sx={sx} />;
    case "dpa":
      return <PrivacyTipOutlined sx={sx} />;
    case "letter_of_intent":
      return <HandshakeOutlined sx={sx} />;
  }
};

const emptyDocumentState = (): Record<
  PrototypeTesterAgreementKey,
  boolean
> => ({
  program_terms: false,
  nda: false,
  dpa: false,
  letter_of_intent: false,
});

function PrototypeInvitePageFrame({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={workspaceDarkTheme}>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: ws.bg,
          color: ws.text,
          backgroundImage:
            "radial-gradient(circle at 80% 0%, rgba(255,140,0,0.13), transparent 32%), radial-gradient(circle at 12% 65%, rgba(96,165,250,0.07), transparent 30%)",
          py: { xs: 2, sm: 4 },
        }}
      >
        <Container maxWidth="md">
          <Box component="header" sx={{ mb: { xs: 2.5, sm: 3.5 } }}>
            <Box
              component="img"
              src="/creatorhub-wordmark-light.png"
              alt="Creatorhub"
              referrerPolicy="no-referrer"
              sx={{
                width: { xs: 154, sm: 184 },
                height: "auto",
                display: "block",
              }}
            />
          </Box>
          {children}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

const AcceptPrototypeTesterInvite: React.FC = () => {
  const [, navigate] = useLocation();
  const compactReader = useMediaQuery(
    workspaceDarkTheme.breakpoints.down("sm"),
  );
  const token = readToken();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(emptyDocumentState);
  const [reviewed, setReviewed] = useState(emptyDocumentState);
  const [activeDocumentKey, setActiveDocumentKey] =
    useState<PrototypeTesterAgreementKey | null>(null);
  const [confirmedAuthority, setConfirmedAuthority] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptEmailSent, setReceiptEmailSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Token mangler i URL-en.");
      setLoading(false);
      return;
    }
    apiRequest(`/api/prototype-tester-invites/${encodeURIComponent(token)}`)
      .then((response: Invite) => {
        if (
          !Array.isArray(response.agreements) ||
          response.agreements.length !== 4
        ) {
          throw new Error(
            "Avtaledokumentene er ikke tilgjengelige. Kontakt CreatorHub.",
          );
        }
        setInvite(response);
        setSignerName(response.name || "");
        if (
          response.status === "accepted" &&
          !response.accountProvisioningComplete &&
          response.agreementAcceptance?.complete
        ) {
          const restoredAcceptance = emptyDocumentState();
          const restoredReview = emptyDocumentState();
          for (const document of response.agreementAcceptance.documents) {
            restoredAcceptance[document.key] = document.accepted;
            restoredReview[document.key] = document.accepted;
          }
          setAccepted(restoredAcceptance);
          setReviewed(restoredReview);
          setConfirmedAuthority(
            response.agreementAcceptance.confirmedSigningAuthority,
          );
          setSignerName(
            response.agreementAcceptance.signerName || response.name || "",
          );
        }
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Invitasjonen ble ikke funnet.",
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  const agreements = invite?.agreements ?? [];
  const activeDocument =
    agreements.find((document) => document.key === activeDocumentKey) ?? null;
  const acceptedCount = agreements.filter(
    (document) => accepted[document.key],
  ).length;
  const allAccepted =
    agreements.length === 4 &&
    agreements.every((document) => accepted[document.key]);
  const activationRetry = Boolean(
    invite?.status === "accepted" &&
    !invite.accountProvisioningComplete &&
    invite.agreementAcceptance?.complete,
  );

  const markActiveDocumentReviewed = () => {
    if (!activeDocument) return;
    setReviewed((current) => ({ ...current, [activeDocument.key]: true }));
    setActiveDocumentKey(null);
  };

  const handleSendVerificationCode = async () => {
    setSendingCode(true);
    setError(null);
    try {
      const result = await apiRequest(
        `/api/prototype-tester-invites/${encodeURIComponent(token)}/signing-code`,
        { method: "POST" },
      );
      setCodeSent(true);
      setMaskedEmail(String(result?.maskedEmail || invite?.email || ""));
      setCodeExpiresAt(result?.expiresAt ? String(result.expiresAt) : null);
      setVerificationCode("");
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Kunne ikke sende bekreftelseskoden.",
      );
    } finally {
      setSendingCode(false);
    }
  };

  const handleAccept = async () => {
    if (!allAccepted) {
      setError("Du må lese og godta alle fire dokumentene.");
      return;
    }
    if (!confirmedAuthority) {
      setError("Du må bekrefte at du kan inngå avtalene.");
      return;
    }
    if (signerName.trim().length < 2) {
      setError("Skriv fullt navn.");
      return;
    }
    if (!activationRetry && !/^\d{6}$/.test(verificationCode)) {
      setError("Skriv inn den sekssifrede koden fra e-posten.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const agreementVersions = Object.fromEntries(
        agreements.map((document) => [document.key, document.version]),
      );
      const result = await apiRequest(
        `/api/prototype-tester-invites/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          body: {
            ndaName: signerName.trim(),
            acceptedProgramTerms: true,
            programTermsVersion: agreementVersions.program_terms,
            acceptedAgreements: accepted,
            agreementVersions,
            confirmedSigningAuthority: true,
            verificationCode,
          },
        },
      );
      setReceiptEmailSent(Boolean(result?.receiptEmailDelivery?.sent));
      trackEvent(
        activationRetry
          ? "prototype_tester_activation_retried"
          : "prototype_tester_agreements_signed",
        { agreement_versions: agreementVersions },
      );
      testerEvents.sessionStarted(token);
      setSuccess(true);
      try {
        sessionStorage.setItem("prototype-tester-just-signed", "1");
      } catch {
        // Storage can be disabled; activation has already succeeded server-side.
      }
      setTimeout(() => {
        const dashboard = dashboardForProfession(
          invite?.memberProfession ?? null,
        );
        navigate(`/login?redirect=${encodeURIComponent(dashboard)}`);
      }, 2500);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Signering feilet — prøv igjen.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PrototypeInvitePageFrame>
        <Box sx={{ py: 8, textAlign: "center" }}>
          <CircularProgress aria-label="Laster avtaledokumenter" />
        </Box>
      </PrototypeInvitePageFrame>
    );
  }
  if (error && !invite) {
    return (
      <PrototypeInvitePageFrame>
        <Alert severity="error">{error}</Alert>
      </PrototypeInvitePageFrame>
    );
  }
  if (!invite) return null;
  if (invite.status !== "pending" && !activationRetry) {
    return (
      <PrototypeInvitePageFrame>
        <Alert severity={invite.status === "accepted" ? "success" : "warning"}>
          Denne invitasjonen er{" "}
          {invite.status === "accepted" ? "allerede signert" : invite.status}.
        </Alert>
      </PrototypeInvitePageFrame>
    );
  }
  if (success) {
    return (
      <PrototypeInvitePageFrame>
        <Card sx={{ bgcolor: ws.panel, border: `1px solid ${ws.border}` }}>
          <CardContent sx={{ py: 7, textAlign: "center" }}>
            <CheckIcon sx={{ color: ws.green, fontSize: 72 }} />
            <Typography variant="h5" sx={{ mt: 2, fontWeight: 800 }}>
              Avtalene er registrert
            </Typography>
            <Typography sx={{ color: ws.textDim, mt: 1 }}>
              CreatorHub-tilgangen er aktivert. Du sendes til innlogging og
              deretter videre til dashbordet.
            </Typography>
            <Typography variant="body2" sx={{ color: ws.textDim, mt: 1.5 }}>
              En etterprøvbar PDF-kvittering ligger i Mine avtaler
              {receiptEmailSent ? " og lenken er sendt til e-posten din." : "."}
            </Typography>
          </CardContent>
        </Card>
      </PrototypeInvitePageFrame>
    );
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (new Date(invite.expiresAt).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000),
    ),
  );

  return (
    <PrototypeInvitePageFrame>
      <Card
        data-testid="prototype-agreement-card"
        sx={{
          bgcolor: ws.panel,
          border: `1px solid ${ws.border}`,
          borderRadius: `${ws.radius}px`,
          backdropFilter: "blur(18px)",
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3.5 } }}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2.5,
                bgcolor: ws.accentSoft,
                border: `1px solid ${ws.accentBorder}`,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <LockOutlined sx={{ color: ws.accent }} />
            </Box>
            <Box>
              <Typography
                variant="overline"
                sx={{
                  color: ws.accent,
                  fontWeight: 800,
                  letterSpacing: "0.13em",
                }}
              >
                Godkjent prototype-tester
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: -0.25 }}>
                Les og signer avtalegrunnlaget
              </Typography>
            </Box>
          </Stack>

          <Typography sx={{ color: ws.textDim, mt: 2, maxWidth: 700 }}>
            Hei {invite.name}. Åpne hvert dokument, les hele teksten og bekreft
            det separat før du signerer samlet.
          </Typography>

          {invite.memberCompany && (
            <Alert
              severity="info"
              variant="outlined"
              sx={{ mt: 2, color: ws.text, bgcolor: ws.blueSoft }}
            >
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                Avtalepart: {invite.memberCompany}
              </Typography>
              <Typography variant="caption" sx={{ color: ws.textDim, display: "block" }}>
                {invite.memberOrganizationNumber
                  ? `BRREG-verifisert · Org.nr. ${invite.memberOrganizationNumber.replace(
                      /(\d{3})(\d{3})(\d{3})/,
                      "$1 $2 $3",
                    )}`
                  : "Virksomhetsnavn oppgitt i invitasjonen"}
                {invite.memberBusinessAddress ? ` · ${invite.memberBusinessAddress}` : ""}
              </Typography>
            </Alert>
          )}

          <Box sx={{ mt: 3, mb: 3 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mb: 0.75 }}
            >
              <Typography variant="caption" sx={{ color: ws.textDim }}>
                Avtalegjennomgang
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: ws.text, fontWeight: 700 }}
              >
                {acceptedCount} av 4 godkjent
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(acceptedCount / 4) * 100}
              sx={{ height: 7, borderRadius: 99, bgcolor: ws.panelAlt }}
            />
          </Box>

          {activationRetry && (
            <Alert severity="warning" sx={{ mb: 2.5 }}>
              Avtalene er allerede registrert, men kontoaktiveringen ble ikke
              fullført. Kontroller navnet og prøv aktiveringen på nytt.
            </Alert>
          )}
          <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
            Databehandleravtalen gjelder behandling av personopplysninger.
            Intensjonsavtalen er ikke-bindende; de tre øvrige dokumentene er
            bindende når de aksepteres.
          </Alert>

          {invite.personalMessage && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mb: 3,
                bgcolor: ws.panelInput,
                borderColor: ws.border,
              }}
            >
              <Typography variant="caption" sx={{ color: ws.textDim }}>
                Personlig melding fra CreatorHub
              </Typography>
              <Typography sx={{ mt: 0.5, fontStyle: "italic" }}>
                “{invite.personalMessage}”
              </Typography>
            </Paper>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {agreements.map((document) => {
              const hasBeenRead = reviewed[document.key];
              const hasBeenAccepted = accepted[document.key];
              return (
                <Card
                  key={document.key}
                  variant="outlined"
                  data-testid={`agreement-summary-${document.key}`}
                  sx={{
                    bgcolor: ws.panelInput,
                    borderColor: hasBeenAccepted ? ws.green : ws.border,
                    borderRadius: `${ws.radiusSm}px`,
                    display: "flex",
                  }}
                >
                  <CardContent
                    sx={{
                      p: 2.25,
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.25}
                      alignItems="flex-start"
                    >
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: 2,
                          bgcolor: hasBeenAccepted
                            ? ws.greenSoft
                            : ws.accentSoft,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {agreementIcon(document.key, hasBeenAccepted)}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={800} sx={{ lineHeight: 1.3 }}>
                          {document.title}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          useFlexGap
                          flexWrap="wrap"
                          sx={{ mt: 1 }}
                        >
                          <Chip
                            size="small"
                            label={`v${document.version}`}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={
                              document.bindingNature === "binding"
                                ? "Bindende"
                                : "Ikke-bindende"
                            }
                            color={
                              document.bindingNature === "binding"
                                ? "warning"
                                : "default"
                            }
                          />
                          {hasBeenRead && (
                            <Chip size="small" label="Lest" color="success" />
                          )}
                        </Stack>
                      </Box>
                    </Stack>

                    <Typography
                      variant="body2"
                      sx={{ color: ws.textDim, mt: 2, mb: 2 }}
                    >
                      Åpne dokumentleseren for å se hele teksten før du godtar.
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<MenuBookOutlined />}
                      data-testid={`read-${document.key}`}
                      onClick={() => setActiveDocumentKey(document.key)}
                      sx={{ alignSelf: "flex-start", mb: 1.5 }}
                    >
                      {hasBeenRead
                        ? "Les dokumentet igjen"
                        : "Åpne og les dokumentet"}
                    </Button>
                    <FormControlLabel
                      sx={{ alignItems: "flex-start", mt: "auto", mr: 0 }}
                      disabled={!hasBeenRead}
                      control={
                        <Checkbox
                          disabled={!hasBeenRead}
                          checked={hasBeenAccepted}
                          data-testid={`accept-${document.key}`}
                          onChange={(event) =>
                            setAccepted((current) => ({
                              ...current,
                              [document.key]: event.target.checked,
                            }))
                          }
                          sx={{ pt: 0.35 }}
                        />
                      }
                      label={
                        <Typography
                          variant="body2"
                          sx={{ color: hasBeenRead ? ws.text : ws.textFaint }}
                        >
                          {document.acceptanceLabel}
                        </Typography>
                      }
                    />
                  </CardContent>
                </Card>
              );
            })}
          </Box>

          <Divider sx={{ my: 3.5, borderColor: ws.border }} />

          <Card
            variant="outlined"
            sx={{
              bgcolor: ws.panelInput,
              borderColor: allAccepted ? ws.accentBorder : ws.border,
              borderRadius: `${ws.radiusSm}px`,
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack
                direction="row"
                spacing={1.25}
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <HowToRegOutlined
                  sx={{ color: allAccepted ? ws.accent : ws.textFaint }}
                />
                <Box>
                  <Typography fontWeight={800}>Elektronisk signatur</Typography>
                  <Typography variant="caption" sx={{ color: ws.textDim }}>
                    Aktiveres når alle fire dokumentene er lest og godkjent.
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: ws.textDim, mb: 2 }}>
                Vi lagrer navn, e-post, tidspunkt, IP-adresse, brukeragent, full
                dokumenttekst, versjoner og SHA-256-kontrollsum som
                dokumentasjon. Dette er en enkel elektronisk signatur med
                e-postbekreftelse, ikke BankID eller en kvalifisert elektronisk
                signatur. Ved å fullføre bekrefter du at aksepten er ment å være
                bindende for de tre dokumentene som er merket «Bindende».
              </Typography>
              <FormControlLabel
                disabled={!allAccepted}
                sx={{ alignItems: "flex-start", mb: 1 }}
                control={
                  <Checkbox
                    disabled={!allAccepted}
                    checked={confirmedAuthority}
                    data-testid="confirm-signing-authority"
                    onChange={(event) =>
                      setConfirmedAuthority(event.target.checked)
                    }
                    sx={{ pt: 0.5 }}
                  />
                }
                label={
                  <Typography variant="body2">
                    Jeg bekrefter at jeg inngår avtalene for meg selv og, dersom
                    virksomhet er oppgitt, at jeg har fullmakt til å akseptere
                    databehandleravtalen på dens vegne.
                  </Typography>
                }
              />
              <TextField
                fullWidth
                required
                disabled={!allAccepted}
                label="Fullt navn"
                value={signerName}
                onChange={(event) => setSignerName(event.target.value)}
                helperText="Navnet brukes som din elektroniske signatur"
                inputProps={{ "data-testid": "agreement-signer-name" }}
                sx={{ mt: 1 }}
              />
              {!activationRetry && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: `${ws.radiusSm}px`,
                    bgcolor: ws.bg,
                    border: `1px solid ${codeSent ? ws.accentBorder : ws.border}`,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={800}>
                    Bekreft den inviterte e-postadressen
                  </Typography>
                  <Typography variant="body2" sx={{ color: ws.textDim, mt: 0.5 }}>
                    Vi sender en engangskode til {maskedEmail || invite.email}.
                    Koden må oppgis sammen med navnet for å signere.
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    alignItems={{ sm: "flex-start" }}
                    sx={{ mt: 1.5 }}
                  >
                    <Button
                      variant={codeSent ? "outlined" : "contained"}
                      disabled={!allAccepted || sendingCode}
                      onClick={handleSendVerificationCode}
                      data-testid="send-signing-code"
                      sx={!codeSent ? {
                        bgcolor: ws.accent,
                        color: ws.accentContrast,
                        fontWeight: 800,
                      } : undefined}
                    >
                      {sendingCode
                        ? "Sender…"
                        : codeSent
                          ? "Send ny kode"
                          : "Send bekreftelseskode"}
                    </Button>
                    <TextField
                      label="Sekssifret kode"
                      value={verificationCode}
                      disabled={!codeSent}
                      onChange={(event) =>
                        setVerificationCode(
                          event.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      inputProps={{
                        inputMode: "numeric",
                        autoComplete: "one-time-code",
                        maxLength: 6,
                        "data-testid": "signing-verification-code",
                        "aria-label": "Sekssifret bekreftelseskode",
                      }}
                      helperText={
                        codeSent
                          ? `Koden er gyldig i 10 minutter${
                              codeExpiresAt ? ` (til ${new Date(codeExpiresAt).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })})` : ""
                            }.`
                          : "Be om en kode for å fortsette"
                      }
                      sx={{ flex: 1, minWidth: { sm: 240 } }}
                    />
                  </Stack>
                </Box>
              )}
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
              <Button
                variant="contained"
                data-testid="sign-and-activate"
                onClick={handleAccept}
                disabled={
                  submitting ||
                  !allAccepted ||
                  !confirmedAuthority ||
                  signerName.trim().length < 2 ||
                  (!activationRetry && !/^\d{6}$/.test(verificationCode))
                }
                sx={{
                  mt: 2,
                  bgcolor: ws.accent,
                  color: ws.accentContrast,
                  fontWeight: 800,
                }}
              >
                {submitting
                  ? "Registrerer…"
                  : activationRetry
                    ? "Prøv kontoaktivering på nytt"
                    : "Signer alle og aktiver tilgang"}
              </Button>
            </CardContent>
          </Card>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{ color: ws.textDim, mt: 3, textAlign: "center" }}
          >
            <MailOutline fontSize="small" />
            <Typography variant="caption">
              Den personlige invitasjonen utløper om {daysRemaining} dager.
              Spørsmål kan sendes til daniel@creatorhubn.com.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(activeDocument)}
        onClose={() => setActiveDocumentKey(null)}
        maxWidth="md"
        fullWidth
        fullScreen={compactReader}
        aria-labelledby="agreement-reader-title"
        PaperProps={{
          sx: {
            bgcolor: ws.panelSolid,
            color: ws.text,
            border: `1px solid ${ws.border}`,
            backgroundImage: "none",
          },
        }}
      >
        {activeDocument && (
          <>
            <DialogTitle id="agreement-reader-title" sx={{ pr: 7 }}>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                alignItems="center"
              >
                <Typography variant="h6" component="span" fontWeight={800}>
                  {activeDocument.title}
                </Typography>
                <Chip
                  size="small"
                  label={`v${activeDocument.version}`}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={
                    activeDocument.bindingNature === "binding"
                      ? "Bindende"
                      : "Ikke-bindende"
                  }
                  color={
                    activeDocument.bindingNature === "binding"
                      ? "warning"
                      : "default"
                  }
                />
              </Stack>
              <IconButton
                onClick={() => setActiveDocumentKey(null)}
                aria-label="Lukk dokumentet"
                sx={{
                  position: "absolute",
                  right: 14,
                  top: 14,
                  color: ws.textDim,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent
              dividers
              sx={{ borderColor: ws.border, p: { xs: 2, sm: 3 } }}
            >
              <Paper
                variant="outlined"
                data-testid={`agreement-content-${activeDocument.key}`}
                sx={{
                  p: { xs: 2, sm: 3 },
                  bgcolor: ws.bg,
                  borderColor: ws.border,
                  minHeight: { sm: 420 },
                }}
              >
                <Typography
                  component="pre"
                  variant="body2"
                  sx={{
                    m: 0,
                    color: ws.text,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    fontFamily: "inherit",
                    fontSize: { xs: "0.88rem", sm: "0.95rem" },
                    lineHeight: 1.75,
                  }}
                >
                  {activeDocument.content}
                </Typography>
              </Paper>
            </DialogContent>
            <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
              <Button onClick={() => setActiveDocumentKey(null)}>Lukk</Button>
              <Button
                variant="contained"
                data-testid={`mark-read-${activeDocument.key}`}
                onClick={markActiveDocumentReviewed}
                sx={{
                  bgcolor: ws.accent,
                  color: ws.accentContrast,
                  fontWeight: 800,
                }}
              >
                Merk som lest og lukk
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </PrototypeInvitePageFrame>
  );
};

export default AcceptPrototypeTesterInvite;

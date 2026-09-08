import React, { useEffect, useMemo, useState } from "react";
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
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import {
  AssignmentOutlined,
  CheckCircle as CheckIcon,
  GavelOutlined,
  HandshakeOutlined,
  HowToRegOutlined,
  LockOutlined,
  MailOutline,
  PrivacyTipOutlined,
} from "@mui/icons-material";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { trackEvent } from "@/utils/ga4-client-tracking";
import { testerEvents } from "@/utils/creatorhub-events";
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

const agreementIcon = (key: PrototypeTesterAgreementKey, active: boolean) => {
  const color = active ? "primary" : "disabled";
  switch (key) {
    case "program_terms":
      return <AssignmentOutlined color={color} />;
    case "nda":
      return <GavelOutlined color={color} />;
    case "dpa":
      return <PrivacyTipOutlined color={color} />;
    case "letter_of_intent":
      return <HandshakeOutlined color={color} />;
  }
};

const emptyAcceptance = (): Record<PrototypeTesterAgreementKey, boolean> => ({
  program_terms: false,
  nda: false,
  dpa: false,
  letter_of_intent: false,
});

const AcceptPrototypeTesterInvite: React.FC = () => {
  const [, navigate] = useLocation();
  const token = readToken();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [accepted, setAccepted] = useState(emptyAcceptance);
  const [confirmedAuthority, setConfirmedAuthority] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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
          const restoredAcceptance = emptyAcceptance();
          for (const document of response.agreementAcceptance.documents) {
            restoredAcceptance[document.key] = document.accepted;
          }
          setAccepted(restoredAcceptance);
          setConfirmedAuthority(
            response.agreementAcceptance.confirmedSigningAuthority,
          );
          setSignerName(
            response.agreementAcceptance.signerName || response.name || "",
          );
          setActiveStep(response.agreements.length);
        }
      })
      .catch((cause: unknown) => {
        const message =
          cause instanceof Error
            ? cause.message
            : "Invitasjonen ble ikke funnet.";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const agreements = invite?.agreements ?? [];
  const signatureStep = agreements.length;
  const allAccepted = useMemo(
    () =>
      agreements.length === 4 &&
      agreements.every((document) => accepted[document.key]),
    [accepted, agreements],
  );
  const activationRetry = Boolean(
    invite?.status === "accepted" &&
    !invite.accountProvisioningComplete &&
    invite.agreementAcceptance?.complete,
  );

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

    setSubmitting(true);
    setError(null);
    try {
      const agreementVersions = Object.fromEntries(
        agreements.map((document) => [document.key, document.version]),
      );
      await apiRequest(
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
          },
        },
      );
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
      const message =
        cause instanceof Error
          ? cause.message
          : "Signering feilet — prøv igjen.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 6, textAlign: "center" }}>
        <CircularProgress aria-label="Laster avtaledokumenter" />
      </Container>
    );
  }
  if (error && !invite) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }
  if (!invite) return null;
  if (invite.status !== "pending" && !activationRetry) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity={invite.status === "accepted" ? "success" : "warning"}>
          Denne invitasjonen er{" "}
          {invite.status === "accepted" ? "allerede signert" : invite.status}.
        </Alert>
      </Container>
    );
  }
  if (success) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Card>
          <CardContent sx={{ py: 6, textAlign: "center" }}>
            <CheckIcon sx={{ color: "success.main", fontSize: 72 }} />
            <Typography variant="h5" sx={{ mt: 2 }}>
              Avtalene er registrert
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              CreatorHub-tilgangen er aktivert. Du sendes til innlogging og
              deretter videre til dashbordet.
            </Typography>
          </CardContent>
        </Card>
      </Container>
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
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card>
        <CardContent>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ mb: 1 }}
          >
            <LockOutlined color="primary" sx={{ fontSize: 32 }} />
            <Stack>
              <Typography variant="overline" color="primary">
                Godkjent prototype-tester
              </Typography>
              <Typography variant="h5">
                Les og signer avtalegrunnlaget
              </Typography>
            </Stack>
          </Stack>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Hei {invite.name}. Før kontoen aktiveres må du lese fire dokumenter
            og signere elektronisk med fullt navn.
          </Typography>
          {activationRetry && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Avtalene er allerede registrert, men kontoaktiveringen ble ikke
              fullført. Kontroller navnet og prøv aktiveringen på nytt.
            </Alert>
          )}
          <Alert severity="info" sx={{ mb: 3 }}>
            Databehandleravtalen gjelder når du bruker CreatorHub til å behandle
            personopplysninger på vegne av egen virksomhet. Intensjonsavtalen er
            uttrykkelig ikke-bindende; de tre øvrige dokumentene er bindende når
            de aksepteres.
          </Alert>

          {invite.personalMessage && (
            <Paper
              variant="outlined"
              sx={{ p: 2, mb: 3, bgcolor: "action.hover" }}
            >
              <Typography variant="caption" color="text.secondary">
                Personlig melding fra CreatorHub
              </Typography>
              <Typography sx={{ mt: 0.5, fontStyle: "italic" }}>
                “{invite.personalMessage}”
              </Typography>
            </Paper>
          )}

          <Stepper activeStep={activeStep} orientation="vertical">
            {agreements.map((document, index) => (
              <Step
                key={document.key}
                expanded={activeStep === index}
                completed={accepted[document.key]}
              >
                <StepLabel
                  icon={agreementIcon(document.key, activeStep >= index)}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Typography fontWeight={700}>{document.title}</Typography>
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
                  </Stack>
                </StepLabel>
                {activeStep === index && (
                  <Box sx={{ ml: 4, mb: 3 }}>
                    <Paper
                      variant="outlined"
                      data-testid={`agreement-content-${document.key}`}
                      sx={{ p: 2, maxHeight: 360, overflow: "auto", mb: 2 }}
                    >
                      <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                          whiteSpace: "pre-wrap",
                          fontFamily: "inherit",
                          lineHeight: 1.65,
                        }}
                      >
                        {document.content}
                      </Typography>
                    </Paper>
                    <FormControlLabel
                      sx={{ alignItems: "flex-start" }}
                      control={
                        <Checkbox
                          checked={accepted[document.key]}
                          data-testid={`accept-${document.key}`}
                          onChange={(event) => {
                            setAccepted((current) => ({
                              ...current,
                              [document.key]: event.target.checked,
                            }));
                          }}
                          sx={{ pt: 0.5 }}
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {document.acceptanceLabel}
                        </Typography>
                      }
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                      {index > 0 && (
                        <Button onClick={() => setActiveStep(index - 1)}>
                          Tilbake
                        </Button>
                      )}
                      <Button
                        variant="contained"
                        disabled={!accepted[document.key]}
                        onClick={() => setActiveStep(index + 1)}
                      >
                        Neste dokument
                      </Button>
                    </Stack>
                  </Box>
                )}
              </Step>
            ))}

            <Step expanded={activeStep === signatureStep} completed={success}>
              <StepLabel
                icon={
                  <HowToRegOutlined
                    color={activeStep >= signatureStep ? "primary" : "disabled"}
                  />
                }
              >
                <Typography fontWeight={700}>Elektronisk signatur</Typography>
              </StepLabel>
              {activeStep === signatureStep && (
                <Box sx={{ ml: 4, mb: 2 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Vi lagrer navn, e-post, tidspunkt, IP-adresse, brukeragent,
                    full dokumenttekst, versjoner og SHA-256-kontrollsum som
                    dokumentasjon på aksepten.
                  </Typography>
                  <FormControlLabel
                    sx={{ alignItems: "flex-start", mb: 1 }}
                    control={
                      <Checkbox
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
                        Jeg bekrefter at jeg inngår avtalene for meg selv og,
                        dersom virksomhet er oppgitt, at jeg har fullmakt til å
                        akseptere databehandleravtalen på dens vegne.
                      </Typography>
                    }
                  />
                  <TextField
                    fullWidth
                    required
                    label="Fullt navn"
                    value={signerName}
                    onChange={(event) => setSignerName(event.target.value)}
                    helperText="Navnet brukes som din elektroniske signatur"
                    inputProps={{ "data-testid": "agreement-signer-name" }}
                  />
                  {error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {error}
                    </Alert>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button
                      onClick={() =>
                        setActiveStep(Math.max(0, signatureStep - 1))
                      }
                      disabled={submitting}
                    >
                      Tilbake
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      data-testid="sign-and-activate"
                      onClick={handleAccept}
                      disabled={
                        submitting ||
                        !allAccepted ||
                        !confirmedAuthority ||
                        signerName.trim().length < 2
                      }
                    >
                      {submitting
                        ? "Registrerer…"
                        : activationRetry
                          ? "Prøv kontoaktivering på nytt"
                          : "Signer alle og aktiver tilgang"}
                    </Button>
                  </Stack>
                </Box>
              )}
            </Step>
          </Stepper>

          <Divider sx={{ my: 2 }} />
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="center"
            color="text.secondary"
          >
            <MailOutline fontSize="small" />
            <Typography variant="caption">
              Den personlige invitasjonen utløper om {daysRemaining} dager.
              Spørsmål kan sendes til daniel@creatorhubn.com.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
};

export default AcceptPrototypeTesterInvite;

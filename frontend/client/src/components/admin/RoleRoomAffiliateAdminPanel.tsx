import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountBalanceWallet,
  AddBusiness,
  ExpandMore,
  Groups,
  Handshake,
  Payments,
  Refresh,
  VerifiedUser,
} from "@mui/icons-material";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AdminButton,
  AdminCard,
  AdminTableContainer,
  StatusChip,
} from "./design-system";

type Member = {
  userId: string;
  email: string | null;
  name: string | null;
  platformRole: string | null;
  memberRole: string;
  active: boolean;
  joinedAt: string | null;
  lastLoginAt: string | null;
};

type AffiliateAgreement = {
  id: string;
  title: string;
  status: string;
  partnerType: string | null;
  templateVersion: string | null;
  signerEmail: string;
  signerName: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  scope: "organization_partner_intent";
};

type AffiliatePartner = {
  id: string;
  organization: {
    id: string;
    name: string;
    organizationNumber: string | null;
    contactEmail: string | null;
    billingEmail: string | null;
    ownerUserId: string | null;
    adminCount: number;
    members: Member[];
  };
  referralCode: string;
  status: string;
  terms: {
    subscriptionCommissionBasisPoints: number;
    storageCommissionBasisPoints: number;
    commissionMonths: number;
    referredOrganizationBonusBytes: number;
    referredOrganizationBonusMonths: number;
    minimumPayoutMinor: number;
    payoutCurrency: string;
  };
  connect: {
    accountId: string | null;
    country: string;
    onboardingStatus: string;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    transfersStatus: string | null;
    requirements: Record<string, unknown>;
    syncedAt: string | null;
    ready: boolean;
    lastBankPayout: {
      id: string | null;
      status: string | null;
      at: string | null;
    };
  };
  agreement: AffiliateAgreement | null;
  referrals: { total: number; paying: number };
  balance: {
    currency: string;
    accruedMinor: number;
    adjustmentMinor: number;
    reservedOrTransferredMinor: number;
    availableMinor: number;
    nextMaturityAt: string | null;
  };
  payoutReadiness: {
    connectReady: boolean;
    minimumReached: boolean;
    partnerActive: boolean;
  };
  payouts: {
    transferredMinor: number;
    failedCount: number;
    pendingCount: number;
    latest: {
      id: string;
      status: string | null;
      amountMinor: number;
      createdAt: string | null;
    } | null;
  };
};

type AffiliateOrganization = {
  id: string;
  name: string;
  organizationNumber: string | null;
  contactEmail: string | null;
  billingEmail: string | null;
  ownerUserId: string | null;
  memberCount: number;
  adminCount: number;
  affiliatePartnerId: string | null;
  readiness: {
    ready: boolean;
    issues: string[];
  };
};

type AffiliatePayout = {
  id: string;
  partnerId: string;
  organizationName: string;
  amountMinor: number;
  currency: string;
  batchPeriod: string | null;
  status: string;
  stripeTransferId: string | null;
  reversedMinor: number;
  attemptCount: number;
  lastError: string | null;
  initiatedBy: string;
  createdAt: string | null;
  transferredAt: string | null;
  reversedAt: string | null;
};

type ConnectedBankPayout = {
  id: string;
  partnerId: string;
  organizationName: string;
  amountMinor: number;
  currency: string;
  status: string;
  arrivalAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  updatedAt: string | null;
};

type AffiliateOverview = {
  config: {
    payoutsEnabled: boolean;
    stripeConfigured: boolean;
    connectWebhookConfigured: boolean;
    oneTiBCheckoutEnabled: boolean;
    maturityHoldDays: number;
    currency: string;
    agreementRegistryAvailable: boolean;
  };
  summary: {
    totalPartners: number;
    activePartners: number;
    connectReadyPartners: number;
    partnersNeedingKyc: number;
    availableMinor: number;
    accruedMinor: number;
    transferredMinor: number;
    failedPayouts: number;
  };
  partners: AffiliatePartner[];
  organizations: AffiliateOrganization[];
  payouts: AffiliatePayout[];
  connectedBankPayouts: ConnectedBankPayout[];
};

type CreatePartnerInput = {
  organizationId: string;
  referralCode: string;
  commissionBasisPoints: number;
  storageCommissionBasisPoints: number;
  commissionMonths: number;
  minimumPayoutMinor: number;
};

const OVERVIEW_QUERY_KEY = [
  "/api/admin/role-room/affiliates/overview",
] as const;

const createInitialState = {
  organizationId: "",
  referralCode: "",
  subscriptionCommissionPercent: "15",
  storageCommissionPercent: "5",
  commissionMonths: "12",
  minimumPayoutNok: "1000",
};

const issueLabels: Record<string, string> = {
  organization_number_missing: "Organisasjonsnummer mangler",
  contact_email_missing: "Kontakt-/faktura-e-post mangler",
  organization_admin_missing: "Eier eller organisasjonsadmin mangler",
};

function amount(minor: number, currency = "nok"): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function percent(basisPoints: number): string {
  return `${new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(basisPoints / 100)} %`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Ikke registrert";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ikke registrert";
  return date.toLocaleString("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGiB(bytes: number): string {
  return `${new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 }).format(bytes / 1024 ** 3)} GiB`;
}

function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : String(error ?? "Ukjent feil");
  if (raw.includes("affiliate_payouts_deaktivert")) {
    return "Utbetalinger er låst av serverens driftsflagg.";
  }
  if (raw.includes("super_admin_tilgang_kreves")) {
    return "Denne flaten krever superadmin-tilgang.";
  }
  if (raw.includes("affiliate_partner_eller_kode_finnes")) {
    return "Organisasjonen eller vervingskoden er allerede registrert.";
  }
  if (raw.includes("affiliate_organization_not_ready")) {
    return "Organisasjonen mangler organisasjonsnummer, kontaktadresse eller en eier/admin.";
  }
  return raw.replace(/^\d{3}:\s*/, "");
}

function readinessTone(ready: boolean): "success" | "warning" {
  return ready ? "success" : "warning";
}

function statusTone(
  status: string | null | undefined,
): "success" | "warning" | "error" | "info" | "neutral" {
  switch (status) {
    case "active":
    case "complete":
    case "transferred":
    case "paid":
    case "signed":
    case "succeeded":
      return "success";
    case "failed":
    case "restricted":
    case "reversed":
    case "canceled":
      return "error";
    case "pending":
    case "processing":
    case "not_started":
    case "sent":
    case "viewed":
      return "warning";
    case "paused":
      return "info";
    default:
      return "neutral";
  }
}

function Metric({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  helper: string;
}) {
  return (
    <AdminCard sx={{ height: "100%" }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ color: "#ff9d2e", display: "flex", mt: 0.25 }}>{icon}</Box>
        <Box>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)" }}>
            {label}
          </Typography>
          <Typography
            variant="h5"
            sx={{ color: "#fff", fontWeight: 750, mt: 0.25 }}
          >
            {value}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.52)" }}
          >
            {helper}
          </Typography>
        </Box>
      </Stack>
    </AdminCard>
  );
}

export default function RoleRoomAffiliateAdminPanel() {
  const [section, setSection] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(createInitialState);
  const [detailPartner, setDetailPartner] = useState<AffiliatePartner | null>(
    null,
  );
  const [statusPartner, setStatusPartner] = useState<AffiliatePartner | null>(
    null,
  );
  const [payoutPartner, setPayoutPartner] = useState<
    AffiliatePartner | null | undefined
  >();
  const [payoutConfirmation, setPayoutConfirmation] = useState("");
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const overviewQuery = useQuery<AffiliateOverview>({
    queryKey: OVERVIEW_QUERY_KEY,
    queryFn: () => apiRequest("/api/admin/role-room/affiliates/overview"),
  });
  const overview = overviewQuery.data;

  const selectableOrganizations = useMemo(
    () =>
      (overview?.organizations ?? []).filter(
        (organization) => !organization.affiliatePartnerId,
      ),
    [overview?.organizations],
  );
  const selectedOrganization = selectableOrganizations.find(
    (organization) => organization.id === createForm.organizationId,
  );

  const invalidateOverview = async () => {
    await queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreatePartnerInput) =>
      apiRequest("/api/admin/role-room/affiliates/partners", {
        method: "POST",
        body: input,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setCreateForm(createInitialState);
      setNotice({
        tone: "success",
        message: "Affiliatepartneren er opprettet.",
      });
      await invalidateOverview();
    },
    onError: (error) =>
      setNotice({ tone: "error", message: errorMessage(error) }),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { partnerId: string; status: "active" | "paused" }) =>
      apiRequest(
        `/api/admin/role-room/affiliates/partners/${input.partnerId}/status`,
        {
          method: "PATCH",
          body: { status: input.status },
        },
      ),
    onSuccess: async () => {
      setNotice({
        tone: "success",
        message: "Partnerstatusen er oppdatert og audit-logget.",
      });
      setStatusPartner(null);
      await invalidateOverview();
    },
    onError: (error) =>
      setNotice({ tone: "error", message: errorMessage(error) }),
  });

  const payoutMutation = useMutation({
    mutationFn: (partnerId?: string) =>
      apiRequest("/api/admin/role-room/affiliates/payouts/run", {
        method: "POST",
        body: partnerId ? { partnerId } : {},
      }),
    onSuccess: async (result: { processedPartners?: number }) => {
      setNotice({
        tone: "success",
        message: `Utbetalingsbatch ferdig. ${result.processedPartners ?? 0} partner(e) ble kontrollert.`,
      });
      setPayoutPartner(undefined);
      setPayoutConfirmation("");
      await invalidateOverview();
    },
    onError: (error) =>
      setNotice({ tone: "error", message: errorMessage(error) }),
  });

  const submitCreate = () => {
    const subscriptionPercent = Number(
      createForm.subscriptionCommissionPercent,
    );
    const storagePercent = Number(createForm.storageCommissionPercent);
    const months = Number(createForm.commissionMonths);
    const minimumNok = Number(createForm.minimumPayoutNok);
    createMutation.mutate({
      organizationId: createForm.organizationId,
      referralCode: createForm.referralCode.trim(),
      commissionBasisPoints: Math.round(subscriptionPercent * 100),
      storageCommissionBasisPoints: Math.round(storagePercent * 100),
      commissionMonths: Math.round(months),
      minimumPayoutMinor: Math.round(minimumNok * 100),
    });
  };

  const numericCreateValuesValid =
    Number(createForm.subscriptionCommissionPercent) >= 0 &&
    Number(createForm.subscriptionCommissionPercent) <= 100 &&
    Number(createForm.storageCommissionPercent) >= 0 &&
    Number(createForm.storageCommissionPercent) <= 100 &&
    Number.isInteger(Number(createForm.commissionMonths)) &&
    Number(createForm.commissionMonths) >= 0 &&
    Number(createForm.commissionMonths) <= 120 &&
    Number(createForm.minimumPayoutNok) >= 0 &&
    Number(createForm.minimumPayoutNok) <= 1_000_000;
  const createValid = Boolean(
    selectedOrganization?.readiness.ready &&
      /^[A-Za-z0-9_-]{3,80}$/.test(createForm.referralCode.trim()) &&
      numericCreateValuesValid,
  );

  if (overviewQuery.isLoading) {
    return (
      <AdminCard title="The Role Room – affiliate & utbetalinger">
        <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>
          Henter partner- og utbetalingsdata …
        </Typography>
      </AdminCard>
    );
  }

  if (overviewQuery.isError || !overview) {
    return (
      <AdminCard title="The Role Room – affiliate & utbetalinger">
        <Alert
          severity="error"
          action={
            <Button onClick={() => overviewQuery.refetch()}>Prøv igjen</Button>
          }
        >
          {errorMessage(overviewQuery.error)}
        </Alert>
      </AdminCard>
    );
  }

  const configReady =
    overview.config.stripeConfigured &&
    overview.config.connectWebhookConfigured;

  return (
    <Stack spacing={2.5} data-testid="role-room-affiliate-admin-panel">
      <AdminCard
        title="The Role Room – affiliate & utbetalinger"
        subtitle="Kontroll på organisasjoner, brukere, avtaledokumentasjon, Stripe Connect og provisjonsledger."
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <AdminButton
              tone="secondary"
              startIcon={<Refresh />}
              loading={overviewQuery.isFetching}
              onClick={() => overviewQuery.refetch()}
            >
              Oppdater
            </AdminButton>
            <AdminButton
              startIcon={<AddBusiness />}
              onClick={() => setCreateOpen(true)}
            >
              Ny affiliatepartner
            </AdminButton>
          </Stack>
        }
      >
        <Stack spacing={1.5}>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
            <StatusChip
              tone={overview.config.payoutsEnabled ? "success" : "warning"}
              label={`Utbetalinger: ${overview.config.payoutsEnabled ? "aktivert" : "låst"}`}
            />
            <StatusChip
              tone={overview.config.stripeConfigured ? "success" : "error"}
              label={`Stripe: ${overview.config.stripeConfigured ? "konfigurert" : "mangler"}`}
            />
            <StatusChip
              tone={
                overview.config.connectWebhookConfigured ? "success" : "error"
              }
              label={`Connect-webhook: ${overview.config.connectWebhookConfigured ? "konfigurert" : "mangler"}`}
            />
            <StatusChip
              tone={overview.config.oneTiBCheckoutEnabled ? "warning" : "info"}
              label={`1 TiB-kjøp: ${overview.config.oneTiBCheckoutEnabled ? "åpent" : "låst"}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${overview.config.maturityHoldDays} dagers modning`}
              sx={{
                color: "rgba(255,255,255,0.72)",
                borderColor: "rgba(255,255,255,0.22)",
              }}
            />
          </Stack>
          {!overview.config.payoutsEnabled && (
            <Alert severity="warning">
              Manuelle og planlagte utbetalinger er stoppet av serverflagget.
              Panelet kan overvåke og klargjøre, men kan ikke slå av
              sikkerhetslåsen fra nettleseren.
            </Alert>
          )}
          {!overview.config.agreementRegistryAvailable && (
            <Alert severity="error">
              Avtaleregisteret er utilgjengelig. Avtalestatus vises derfor ikke,
              og må verifiseres før partneren aktiveres for betaling.
            </Alert>
          )}
        </Stack>
      </AdminCard>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <Metric
            icon={<Handshake />}
            label="Affiliatepartnere"
            value={overview.summary.totalPartners}
            helper={`${overview.summary.activePartners} aktive`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Metric
            icon={<VerifiedUser />}
            label="Connect klare"
            value={`${overview.summary.connectReadyPartners}/${overview.summary.totalPartners}`}
            helper={`${overview.summary.partnersNeedingKyc} krever KYC/oppfølging`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Metric
            icon={<AccountBalanceWallet />}
            label="Tilgjengelig saldo"
            value={amount(overview.summary.availableMinor)}
            helper={`${amount(overview.summary.accruedMinor)} opptjent totalt`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Metric
            icon={<Payments />}
            label="Overført"
            value={amount(overview.summary.transferredMinor)}
            helper={`${overview.summary.failedPayouts} feilede batcher`}
          />
        </Grid>
      </Grid>

      {notice && (
        <Alert severity={notice.tone} onClose={() => setNotice(null)}>
          {notice.message}
        </Alert>
      )}

      <AdminCard disablePadding>
        <Box
          sx={{
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            px: { xs: 1, sm: 2 },
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
          >
            <Box sx={{ overflowX: "auto" }}>
              <Stack direction="row" alignItems="center">
                <Tabs
                  value={section}
                  onChange={(_event, value: number) => setSection(value)}
                  aria-label="Affiliatekontroll"
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab label={`Partnere (${overview.partners.length})`} />
                  <Tab label="Brukere & avtaler" />
                  <Tab label={`Utbetalinger (${overview.payouts.length})`} />
                </Tabs>
              </Stack>
            </Box>
            <Box sx={{ p: { xs: 1.5, md: 1 } }}>
              <Tooltip
                title={
                  !overview.config.payoutsEnabled
                    ? "Serverens utbetalingsflagg er låst"
                    : !configReady
                      ? "Stripe og Connect-webhook må være konfigurert"
                      : ""
                }
              >
                <span>
                  <AdminButton
                    tone="secondary"
                    startIcon={<Payments />}
                    disabled={
                      !overview.config.payoutsEnabled ||
                      !configReady ||
                      overview.partners.length === 0
                    }
                    onClick={() => {
                      setPayoutPartner(null);
                      setPayoutConfirmation("");
                    }}
                  >
                    Kjør månedlig batch
                  </AdminButton>
                </span>
              </Tooltip>
            </Box>
          </Stack>
        </Box>

        {section === 0 && (
          <AdminTableContainer ariaLabel="Affiliatepartnere">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Organisasjon</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Stripe Connect / KYC</TableCell>
                  <TableCell>Avtale</TableCell>
                  <TableCell align="right">Tilgjengelig</TableCell>
                  <TableCell align="right">Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overview.partners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Box sx={{ py: 5, textAlign: "center" }}>
                        <Typography sx={{ color: "#fff", fontWeight: 650 }}>
                          Ingen affiliatepartnere ennå
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "rgba(255,255,255,0.62)", mt: 0.5 }}
                        >
                          Opprett først når organisasjonsnummer, kontakt og
                          administrator er registrert.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  overview.partners.map((partner) => (
                    <TableRow key={partner.id} hover>
                      <TableCell>
                        <Typography sx={{ color: "#fff", fontWeight: 650 }}>
                          {partner.organization.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "rgba(255,255,255,0.6)" }}
                        >
                          {partner.organization.organizationNumber ||
                            "Org.nr. mangler"}{" "}
                          · kode {partner.referralCode}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          tone={statusTone(partner.status)}
                          label={
                            partner.status === "active" ? "Aktiv" : "Pauset"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5} alignItems="flex-start">
                          <StatusChip
                            tone={readinessTone(partner.connect.ready)}
                            label={
                              partner.connect.ready
                                ? "Klar for overføring"
                                : `KYC: ${partner.connect.onboardingStatus}`
                            }
                          />
                          <Typography
                            variant="caption"
                            sx={{ color: "rgba(255,255,255,0.55)" }}
                          >
                            {partner.connect.accountId ||
                              "Connect-konto ikke opprettet"}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          tone={
                            partner.agreement?.status === "signed"
                              ? "success"
                              : "warning"
                          }
                          label={
                            partner.agreement?.status === "signed"
                              ? "Signert"
                              : partner.agreement
                                ? partner.agreement.status
                                : "Mangler"
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ color: "#fff", fontWeight: 650 }}>
                          {amount(
                            partner.balance.availableMinor,
                            partner.balance.currency,
                          )}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "rgba(255,255,255,0.55)" }}
                        >
                          terskel{" "}
                          {amount(
                            partner.terms.minimumPayoutMinor,
                            partner.terms.payoutCurrency,
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                        >
                          <Button
                            size="small"
                            onClick={() => setDetailPartner(partner)}
                          >
                            Detaljer
                          </Button>
                          <Button
                            size="small"
                            color={
                              partner.status === "active"
                                ? "warning"
                                : "success"
                            }
                            onClick={() => setStatusPartner(partner)}
                          >
                            {partner.status === "active" ? "Pause" : "Aktiver"}
                          </Button>
                          <Tooltip
                            title={
                              !overview.config.payoutsEnabled
                                ? "Utbetalingsflagget er låst"
                                : !partner.payoutReadiness.connectReady
                                  ? "Connect/KYC er ikke klar"
                                  : !partner.payoutReadiness.minimumReached
                                    ? "Minimumsgrensen er ikke nådd"
                                    : ""
                            }
                          >
                            <span>
                              <Button
                                size="small"
                                disabled={
                                  !overview.config.payoutsEnabled ||
                                  !partner.payoutReadiness.connectReady ||
                                  !partner.payoutReadiness.minimumReached ||
                                  partner.status !== "active"
                                }
                                onClick={() => {
                                  setPayoutPartner(partner);
                                  setPayoutConfirmation("");
                                }}
                              >
                                Utbetal
                              </Button>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </AdminTableContainer>
        )}

        {section === 1 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Her vises medlemskap og siste organisasjonstilknyttede
              partner-intensjonsavtale. Dette er ikke automatisk det samme som
              en dedikert affiliateavtale; tittelen og omfanget må kontrolleres
              før utbetaling aktiveres.
            </Alert>
            {overview.partners.length === 0 ? (
              <Typography sx={{ color: "rgba(255,255,255,0.65)" }}>
                Ingen partnerorganisasjoner å vise.
              </Typography>
            ) : (
              overview.partners.map((partner) => (
                <Accordion
                  key={partner.id}
                  disableGutters
                  sx={{
                    bgcolor: "rgba(255,255,255,0.035)",
                    color: "#fff",
                    mb: 1.5,
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "14px !important",
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMore sx={{ color: "#fff" }} />}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      alignItems={{ sm: "center" }}
                      sx={{ width: "100%", pr: 2 }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {partner.organization.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "rgba(255,255,255,0.58)" }}
                        >
                          {partner.organization.members.length} registrerte
                          medlemmer · {partner.organization.adminCount}{" "}
                          organisasjonsadmin
                        </Typography>
                      </Box>
                      <StatusChip
                        tone={
                          partner.agreement?.status === "signed"
                            ? "success"
                            : "warning"
                        }
                        label={
                          partner.agreement?.status === "signed"
                            ? "Avtale signert"
                            : "Avtale må følges opp"
                        }
                      />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Brukere og roller
                        </Typography>
                        <Stack spacing={1}>
                          {partner.organization.members.length === 0 ? (
                            <Alert severity="warning">
                              Ingen brukere er knyttet til organisasjonen.
                            </Alert>
                          ) : (
                            partner.organization.members.map((member) => (
                              <Box
                                key={member.userId}
                                sx={{
                                  p: 1.5,
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  borderRadius: 2,
                                }}
                              >
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                  gap={1}
                                >
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                      variant="body2"
                                      sx={{ fontWeight: 650 }}
                                    >
                                      {member.name ||
                                        member.email ||
                                        member.userId}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: "rgba(255,255,255,0.58)",
                                        overflowWrap: "anywhere",
                                      }}
                                    >
                                      {member.email || "E-post mangler"} · sist
                                      innlogget {formatDate(member.lastLoginAt)}
                                    </Typography>
                                  </Box>
                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="center"
                                  >
                                    <StatusChip
                                      tone={member.active ? "success" : "error"}
                                      label={
                                        member.active
                                          ? "Aktiv konto"
                                          : "Deaktivert"
                                      }
                                    />
                                    <StatusChip
                                      tone={
                                        member.memberRole === "admin"
                                          ? "brand"
                                          : "neutral"
                                      }
                                      label={member.memberRole}
                                    />
                                  </Stack>
                                </Stack>
                              </Box>
                            ))
                          )}
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Siste relaterte avtale
                        </Typography>
                        {partner.agreement ? (
                          <Box
                            sx={{
                              p: 2,
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 2,
                            }}
                          >
                            <Stack spacing={0.75}>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                gap={1}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 700 }}
                                >
                                  {partner.agreement.title}
                                </Typography>
                                <StatusChip
                                  tone={statusTone(partner.agreement.status)}
                                  label={partner.agreement.status}
                                />
                              </Stack>
                              <Typography
                                variant="caption"
                                sx={{ color: "rgba(255,255,255,0.62)" }}
                              >
                                Signatar:{" "}
                                {partner.agreement.signerName || "Ikke oppgitt"}{" "}
                                ({partner.agreement.signerEmail})
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: "rgba(255,255,255,0.62)" }}
                              >
                                Mal:{" "}
                                {partner.agreement.templateVersion || "ukjent"}{" "}
                                · signert{" "}
                                {formatDate(partner.agreement.signedAt)}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "rgba(255,255,255,0.5)",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                Avtale-ID {partner.agreement.id}
                              </Typography>
                            </Stack>
                          </Box>
                        ) : (
                          <Alert severity="warning">
                            Ingen organisasjonstilknyttet partneravtale er
                            funnet. KYC-status må ikke brukes som bevis på
                            avtaleaksept.
                          </Alert>
                        )}
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </Box>
        )}

        {section === 2 && (
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" sx={{ color: "#fff", mb: 1 }}>
              CreatorHub → Stripe Connect-overføringer
            </Typography>
            <AdminTableContainer ariaLabel="Affiliateutbetalinger">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Organisasjon</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Beløp</TableCell>
                    <TableCell>Stripe Transfer</TableCell>
                    <TableCell>Forsøk / feil</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview.payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        Ingen utbetalingsbatcher er opprettet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    overview.payouts.map((payout) => (
                      <TableRow key={payout.id} hover>
                        <TableCell>{payout.organizationName}</TableCell>
                        <TableCell>{formatDate(payout.createdAt)}</TableCell>
                        <TableCell>
                          <StatusChip
                            tone={statusTone(payout.status)}
                            label={payout.status}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {amount(payout.amountMinor, payout.currency)}
                        </TableCell>
                        <TableCell sx={{ overflowWrap: "anywhere" }}>
                          {payout.stripeTransferId || "Ikke opprettet"}
                        </TableCell>
                        <TableCell>
                          {payout.attemptCount}
                          {payout.lastError && (
                            <Typography
                              variant="caption"
                              color="error"
                              display="block"
                            >
                              {payout.lastError}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </AdminTableContainer>

            <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.1)" }} />
            <Typography variant="h6" sx={{ color: "#fff", mb: 0.5 }}>
              Stripe Connect → partnerens bank
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "rgba(255,255,255,0.62)", mb: 1.5 }}
            >
              Bankutbetalinger er en egen livssyklus og er ikke det samme som
              CreatorHubs Transfer-batch.
            </Typography>
            <AdminTableContainer ariaLabel="Tilknyttede bankutbetalinger">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Organisasjon</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Beløp</TableCell>
                    <TableCell>Forventet bankdato</TableCell>
                    <TableCell>Feil</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview.connectedBankPayouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        Ingen bankutbetalingshendelser mottatt.
                      </TableCell>
                    </TableRow>
                  ) : (
                    overview.connectedBankPayouts.map((event) => (
                      <TableRow key={event.id} hover>
                        <TableCell>{event.organizationName}</TableCell>
                        <TableCell>
                          <StatusChip
                            tone={statusTone(event.status)}
                            label={event.status}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {amount(event.amountMinor, event.currency)}
                        </TableCell>
                        <TableCell>{formatDate(event.arrivalAt)}</TableCell>
                        <TableCell>
                          {event.failureMessage || event.failureCode || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </AdminTableContainer>
          </Box>
        )}
      </AdminCard>

      <Dialog
        open={createOpen}
        onClose={() => !createMutation.isPending && setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Opprett affiliatepartner</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Organisasjonen må ha organisasjonsnummer, kontaktadresse og
              eier/admin. Stripe Connect opprettes senere av organisasjonsadmin
              gjennom KYC-onboarding.
            </Alert>
            <FormControl fullWidth>
              <InputLabel id="affiliate-organization-label">
                Organisasjon
              </InputLabel>
              <Select
                labelId="affiliate-organization-label"
                label="Organisasjon"
                value={createForm.organizationId}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    organizationId: event.target.value,
                  }))
                }
              >
                {selectableOrganizations.map((organization) => (
                  <MenuItem key={organization.id} value={organization.id}>
                    {organization.name}
                    {organization.readiness.ready ? "" : " – mangler data"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedOrganization && !selectedOrganization.readiness.ready && (
              <Alert severity="warning">
                {selectedOrganization.readiness.issues
                  .map((issue) => issueLabels[issue] || issue)
                  .join(" · ")}
              </Alert>
            )}
            <TextField
              label="Vervingskode"
              value={createForm.referralCode}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  referralCode: event.target.value.toUpperCase(),
                }))
              }
              helperText="3–80 tegn: bokstaver, tall, bindestrek eller understrek"
              inputProps={{ maxLength: 80 }}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Provisjon abonnement (%)"
                  type="number"
                  value={createForm.subscriptionCommissionPercent}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      subscriptionCommissionPercent: event.target.value,
                    }))
                  }
                  inputProps={{ min: 0, max: 100, step: 0.25 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Provisjon lagring (%)"
                  type="number"
                  value={createForm.storageCommissionPercent}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      storageCommissionPercent: event.target.value,
                    }))
                  }
                  inputProps={{ min: 0, max: 100, step: 0.25 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Provisjonsperiode (måneder)"
                  type="number"
                  value={createForm.commissionMonths}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      commissionMonths: event.target.value,
                    }))
                  }
                  inputProps={{ min: 0, max: 120, step: 1 }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Minimum utbetaling (NOK)"
                  type="number"
                  value={createForm.minimumPayoutNok}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      minimumPayoutNok: event.target.value,
                    }))
                  }
                  inputProps={{ min: 0, max: 1_000_000, step: 1 }}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCreateOpen(false)}
            disabled={createMutation.isPending}
          >
            Avbryt
          </Button>
          <AdminButton
            loading={createMutation.isPending}
            disabled={!createValid}
            onClick={submitCreate}
          >
            Opprett partner
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(detailPartner)}
        onClose={() => setDetailPartner(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {detailPartner?.organization.name || "Partnerdetaljer"}
        </DialogTitle>
        <DialogContent>
          {detailPartner && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Avtalevilkår</Typography>
                  <Typography variant="body2">
                    Abonnement:{" "}
                    {percent(
                      detailPartner.terms.subscriptionCommissionBasisPoints,
                    )}
                  </Typography>
                  <Typography variant="body2">
                    Lagring:{" "}
                    {percent(detailPartner.terms.storageCommissionBasisPoints)}
                  </Typography>
                  <Typography variant="body2">
                    Varighet: {detailPartner.terms.commissionMonths} måneder
                  </Typography>
                  <Typography variant="body2">
                    Kundebonus:{" "}
                    {formatGiB(
                      detailPartner.terms.referredOrganizationBonusBytes,
                    )}{" "}
                    i {detailPartner.terms.referredOrganizationBonusMonths}{" "}
                    måneder
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Saldo og vervinger
                  </Typography>
                  <Typography variant="body2">
                    Opptjent: {amount(detailPartner.balance.accruedMinor)}
                  </Typography>
                  <Typography variant="body2">
                    Justeringer: {amount(detailPartner.balance.adjustmentMinor)}
                  </Typography>
                  <Typography variant="body2">
                    Tilgjengelig: {amount(detailPartner.balance.availableMinor)}
                  </Typography>
                  <Typography variant="body2">
                    Vervinger: {detailPartner.referrals.total} (
                    {detailPartner.referrals.paying} betalende)
                  </Typography>
                  <Typography variant="body2">
                    Neste modning:{" "}
                    {formatDate(detailPartner.balance.nextMaturityAt)}
                  </Typography>
                </Grid>
              </Grid>
              <Divider />
              <Typography variant="subtitle2">Stripe Connect</Typography>
              <Typography variant="body2">
                Konto: {detailPartner.connect.accountId || "Ikke opprettet"}
              </Typography>
              <Typography variant="body2">
                Onboarding: {detailPartner.connect.onboardingStatus} ·
                transfers:{" "}
                {detailPartner.connect.transfersStatus || "ikke tilgjengelig"}
              </Typography>
              <Typography variant="body2">
                Sist synkronisert: {formatDate(detailPartner.connect.syncedAt)}
              </Typography>
              {Object.keys(detailPartner.connect.requirements || {}).length >
                0 && (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1.5,
                    bgcolor: "rgba(0,0,0,0.08)",
                    borderRadius: 2,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(detailPartner.connect.requirements, null, 2)}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailPartner(null)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(statusPartner)}
        onClose={() => !statusMutation.isPending && setStatusPartner(null)}
      >
        <DialogTitle>
          {statusPartner?.status === "active"
            ? "Pause affiliatepartner?"
            : "Aktiver affiliatepartner?"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {statusPartner?.status === "active"
              ? "Partneren tas ut av nye utbetalingsbatcher. Opptjent ledgerdata blir ikke slettet."
              : "Partneren kan igjen inngå i utbetalingsbatcher når alle øvrige krav er oppfylt."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setStatusPartner(null)}
            disabled={statusMutation.isPending}
          >
            Avbryt
          </Button>
          <AdminButton
            tone={statusPartner?.status === "active" ? "danger" : "primary"}
            loading={statusMutation.isPending}
            onClick={() =>
              statusPartner &&
              statusMutation.mutate({
                partnerId: statusPartner.id,
                status: statusPartner.status === "active" ? "paused" : "active",
              })
            }
          >
            {statusPartner?.status === "active"
              ? "Pause partner"
              : "Aktiver partner"}
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={payoutPartner !== undefined}
        onClose={() => !payoutMutation.isPending && setPayoutPartner(undefined)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Bekreft ekte Stripe-overføring</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              Dette kan opprette irreversible pengeoverføringer fra CreatorHub
              til én eller flere Connect-kontoer. Ledger, minimumsgrense,
              modning og idempotens kontrolleres på serveren.
            </Alert>
            <Typography variant="body2">
              Omfang:{" "}
              {payoutPartner
                ? payoutPartner.organization.name
                : "alle aktive og kvalifiserte affiliatepartnere"}
            </Typography>
            <TextField
              autoFocus
              label="Skriv UTBETAL for å bekrefte"
              value={payoutConfirmation}
              onChange={(event) => setPayoutConfirmation(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPayoutPartner(undefined)}
            disabled={payoutMutation.isPending}
          >
            Avbryt
          </Button>
          <AdminButton
            tone="danger"
            loading={payoutMutation.isPending}
            disabled={payoutConfirmation !== "UTBETAL"}
            onClick={() => payoutMutation.mutate(payoutPartner?.id)}
          >
            Kjør utbetalingsbatch
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RoleRoomAffiliateAdminPanel from "./RoleRoomAffiliateAdminPanel";

const apiRequest = vi.fn();
const invalidateQueries = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateQueries(...args),
  },
}));

const partner = {
  id: "22222222-2222-4222-8222-222222222222",
  organization: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Nordic Casting AS",
    organizationNumber: "999888777",
    contactEmail: "kontakt@example.test",
    billingEmail: "faktura@example.test",
    ownerUserId: "user-1",
    adminCount: 1,
    members: [
      {
        userId: "user-1",
        email: "owner@example.test",
        name: "Nora Nordmann",
        platformRole: "user",
        memberRole: "admin",
        active: true,
        joinedAt: "2026-08-01T08:00:00.000Z",
        lastLoginAt: "2026-09-11T07:00:00.000Z",
      },
    ],
  },
  referralCode: "NORDIC15",
  status: "active",
  terms: {
    subscriptionCommissionBasisPoints: 1500,
    storageCommissionBasisPoints: 500,
    commissionMonths: 12,
    referredOrganizationBonusBytes: 10_737_418_240,
    referredOrganizationBonusMonths: 3,
    minimumPayoutMinor: 100_000,
    payoutCurrency: "nok",
  },
  connect: {
    accountId: "acct_affiliate",
    country: "NO",
    onboardingStatus: "complete",
    detailsSubmitted: true,
    payoutsEnabled: true,
    transfersStatus: "active",
    requirements: {},
    syncedAt: "2026-09-11T08:00:00.000Z",
    ready: true,
    lastBankPayout: { id: null, status: null, at: null },
  },
  agreement: {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Partneravtale",
    status: "signed",
    partnerType: "reseller",
    templateVersion: "reseller_v2",
    signerEmail: "owner@example.test",
    signerName: "Nora Nordmann",
    sentAt: "2026-08-02T08:00:00.000Z",
    viewedAt: "2026-08-02T09:00:00.000Z",
    signedAt: "2026-08-02T09:30:00.000Z",
    scope: "organization_partner_intent",
  },
  referrals: { total: 3, paying: 2 },
  balance: {
    currency: "nok",
    accruedMinor: 160_000,
    adjustmentMinor: -10_000,
    reservedOrTransferredMinor: 20_000,
    availableMinor: 130_000,
    nextMaturityAt: null,
  },
  payoutReadiness: {
    connectReady: true,
    minimumReached: true,
    partnerActive: true,
  },
  payouts: {
    transferredMinor: 20_000,
    failedCount: 0,
    pendingCount: 0,
    latest: null,
  },
};

const overview = {
  config: {
    payoutsEnabled: false,
    stripeConfigured: true,
    connectWebhookConfigured: true,
    oneTiBCheckoutEnabled: false,
    maturityHoldDays: 30,
    currency: "nok",
    agreementRegistryAvailable: true,
  },
  summary: {
    totalPartners: 1,
    activePartners: 1,
    connectReadyPartners: 1,
    partnersNeedingKyc: 0,
    availableMinor: 130_000,
    accruedMinor: 160_000,
    transferredMinor: 20_000,
    failedPayouts: 0,
  },
  partners: [partner],
  organizations: [
    {
      id: partner.organization.id,
      name: partner.organization.name,
      organizationNumber: partner.organization.organizationNumber,
      contactEmail: partner.organization.contactEmail,
      billingEmail: partner.organization.billingEmail,
      ownerUserId: partner.organization.ownerUserId,
      memberCount: 1,
      adminCount: 1,
      affiliatePartnerId: partner.id,
      readiness: { ready: true, issues: [] },
    },
  ],
  payouts: [],
  connectedBankPayouts: [],
};

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RoleRoomAffiliateAdminPanel />
    </QueryClientProvider>,
  );
}

describe("RoleRoomAffiliateAdminPanel", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    invalidateQueries.mockReset();
    apiRequest.mockResolvedValue(overview);
  });

  it("shows financial locks and keeps a manual payout unavailable while the server flag is off", async () => {
    renderPanel();

    expect(await screen.findByText("Nordic Casting AS")).toBeInTheDocument();
    expect(
      screen.getByText("The Role Room – affiliate & utbetalinger"),
    ).toBeInTheDocument();
    expect(screen.getByText("Utbetalinger: låst")).toBeInTheDocument();
    expect(screen.getByText("1 TiB-kjøp: låst")).toBeInTheDocument();
    expect(screen.getByText("Nordic Casting AS")).toBeInTheDocument();
    expect(screen.getByText("Klar for overføring")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kjør månedlig batch" }),
    ).toBeDisabled();
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/admin/role-room/affiliates/overview",
    );
  });

  it("exposes organization members and the actual related agreement scope separately from KYC", async () => {
    renderPanel();
    await screen.findByText("Nordic Casting AS");

    fireEvent.click(screen.getByRole("tab", { name: "Brukere & avtaler" }));
    const organizationSummary = screen
      .getByText("Nordic Casting AS")
      .closest(".MuiAccordionSummary-root");
    expect(organizationSummary).not.toBeNull();
    fireEvent.click(organizationSummary!);

    expect(await screen.findByText("Nora Nordmann")).toBeInTheDocument();
    expect(screen.getAllByText(/owner@example\.test/)).toHaveLength(2);
    const agreementHeading = screen.getByText("Siste relaterte avtale");
    const agreementColumn = agreementHeading.parentElement;
    expect(agreementColumn).not.toBeNull();
    expect(
      within(agreementColumn!).getByText("Partneravtale"),
    ).toBeInTheDocument();
    expect(within(agreementColumn!).getByText("signed")).toBeInTheDocument();
    expect(
      screen.getByText(
        /ikke automatisk det samme som en dedikert affiliateavtale/i,
      ),
    ).toBeInTheDocument();
  });
});

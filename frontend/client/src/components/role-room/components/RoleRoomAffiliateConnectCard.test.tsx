import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RoleRoomAffiliateConnectCard, {
  isStripeConnectOnboardingUrl,
} from "./RoleRoomAffiliateConnectCard";

describe("RoleRoomAffiliateConnectCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the organization payout readiness and threshold", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        partner: {
          referralCode: "CREATOR15",
          minimumPayoutMinor: 100000,
          payoutCurrency: "nok",
        },
        connect: {
          onboardingStatus: "pending",
          detailsSubmitted: false,
          payoutsEnabled: false,
          transfersStatus: "pending",
        },
        balance: {
          currency: "nok",
          accruedMinor: 125000,
          adjustmentMinor: 0,
          reservedOrTransferredMinor: 0,
          availableMinor: 125000,
          nextMaturityAt: null,
        },
      }),
    } as Response);

    render(
      <RoleRoomAffiliateConnectCard organizationId="10000000-0000-4000-8000-000000000001" />,
    );

    expect(
      await screen.findByText("Affiliate-utbetalinger"),
    ).toBeInTheDocument();
    expect(screen.getByText("KYC gjenstår")).toBeInTheDocument();
    expect(screen.getByText(/1\s250,00\skr/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fullfør sikker Stripe-onboarding" }),
    ).toBeInTheDocument();
  });

  it("does not expose the card to organizations without an affiliate partner", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    render(
      <RoleRoomAffiliateConnectCard organizationId="10000000-0000-4000-8000-000000000001" />,
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("role-room-affiliate-connect-card"),
      ).not.toBeInTheDocument();
    });
  });

  it("only accepts an exact Stripe Connect HTTPS onboarding host", () => {
    expect(
      isStripeConnectOnboardingUrl("https://connect.stripe.com/setup/e/acct_1"),
    ).toBe(true);
    expect(
      isStripeConnectOnboardingUrl("http://connect.stripe.com/setup/e/acct_1"),
    ).toBe(false);
    expect(
      isStripeConnectOnboardingUrl(
        "https://connect.stripe.com.attacker.example/path",
      ),
    ).toBe(false);
    expect(isStripeConnectOnboardingUrl("not-a-url")).toBe(false);
  });
});

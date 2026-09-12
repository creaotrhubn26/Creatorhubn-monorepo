import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClientLinkedinSuitePanel from "./ClientLinkedinSuitePanel";

describe("ClientLinkedinSuitePanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps OAuth reconnect available when an ad account is already connected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        accounts: [
          {
            id: "123",
            urn: "urn:li:sponsoredAccount:123",
            name: "CreatorHub",
            currency: "NOK",
          },
        ],
      }),
    } as Response);

    render(
      <ClientLinkedinSuitePanel configId="config-1" clientName="CreatorHub" />,
    );

    expect(
      await screen.findByRole("button", { name: "Koble LinkedIn på nytt" }),
    ).toBeTruthy();
  });
});

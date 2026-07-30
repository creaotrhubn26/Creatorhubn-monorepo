import { describe, it, expect, afterEach } from "vitest";
import {
  StubSigningProvider,
  deriveOrderStatus,
  getSigningProvider,
  listSigningProviders,
  registerSigningProvider,
  type SigningProvider,
} from "./role-room-signing-provider.js";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

describe("deriveOrderStatus", () => {
  it("er fullført først når alle har signert", () => {
    expect(deriveOrderStatus([{ status: "signed" }, { status: "signed" }])).toBe("completed");
  });

  it("er delvis signert når noen har signert", () => {
    expect(deriveOrderStatus([{ status: "signed" }, { status: "sent" }])).toBe("partially_signed");
  });

  it("lar én avslag gjøre hele oppdraget avslått", () => {
    // En kontrakt der én part har sagt nei er ikke «delvis signert» — den er
    // død inntil noen gjør noe med den.
    expect(deriveOrderStatus([{ status: "signed" }, { status: "declined" }])).toBe("declined");
  });

  it("lar avslag veie tyngre enn utløp", () => {
    expect(deriveOrderStatus([{ status: "declined" }, { status: "expired" }])).toBe("declined");
  });

  it("er utløpt når noen har gått ut på tid og ingen har avslått", () => {
    expect(deriveOrderStatus([{ status: "expired" }, { status: "sent" }])).toBe("expired");
  });

  it("er sendt når ingen har gjort noe ennå", () => {
    expect(deriveOrderStatus([{ status: "sent" }, { status: "pending" }])).toBe("sent");
  });

  it("takler tom signatarliste", () => {
    expect(deriveOrderStatus([])).toBe("sent");
  });
});

describe("StubSigningProvider", () => {
  it("nekter å være konfigurert i produksjon", () => {
    // Et signeringsbevis som ikke er ekte er verre enn ingen signering.
    process.env.NODE_ENV = "production";
    expect(new StubSigningProvider().isConfigured()).toBe(false);
  });

  it("er brukbar utenfor produksjon", () => {
    process.env.NODE_ENV = "test";
    expect(new StubSigningProvider().isConfigured()).toBe(true);
  });

  it("verifiserer aldri callbacks i produksjon", () => {
    process.env.NODE_ENV = "production";
    expect(new StubSigningProvider().verifyCallback()).toBe(false);
  });

  it("gir én signeringslenke per signatar", async () => {
    const p = new StubSigningProvider();
    const order = await p.createOrder({
      title: "Kontrakt",
      reference: "ref1",
      signers: [
        { fullName: "Kari" },
        { fullName: "Foresatt for Ola", signsOnBehalfOf: "Ola (14)" },
      ],
    });
    expect(order.signerLinks).toHaveLength(2);
    expect(order.signerLinks[1].fullName).toBe("Foresatt for Ola");
  });

  it("går til fullført først når siste signatar er ferdig", async () => {
    const p = new StubSigningProvider();
    const order = await p.createOrder({
      title: "Kontrakt", reference: "ref2",
      signers: [{ fullName: "A" }, { fullName: "B" }],
    });
    p.markSigned(order.providerOrderId, 0);
    expect((await p.getOrderStatus(order.providerOrderId)).status).toBe("partially_signed");
    p.markSigned(order.providerOrderId, 1);
    expect((await p.getOrderStatus(order.providerOrderId)).status).toBe("completed");
  });

  it("kan kanselleres", async () => {
    const p = new StubSigningProvider();
    const order = await p.createOrder({ title: "K", reference: "ref3", signers: [{ fullName: "A" }] });
    await p.cancelOrder(order.providerOrderId);
    expect((await p.getOrderStatus(order.providerOrderId)).status).toBe("cancelled");
  });

  it("kaster på ukjent oppdrag", async () => {
    await expect(new StubSigningProvider().getOrderStatus("nope")).rejects.toThrow(/Ukjent/);
  });
});

describe("leverandør-registeret", () => {
  it("har stub registrert som standard", () => {
    expect(listSigningProviders().map((p) => p.name)).toContain("stub");
  });

  it("peker på beslutningsnotatet når leverandøren er ukjent", () => {
    // Leverandør er ikke valgt ennå — feilmeldingen skal si hvor beslutningen
    // ligger, ikke bare at noe mangler.
    expect(() => getSigningProvider("idura")).toThrow(/BESLUTNINGSNOTAT/);
  });

  it("nekter stub i produksjon med en handlingsrettet melding", () => {
    process.env.NODE_ENV = "production";
    expect(() => getSigningProvider("stub")).toThrow(/signerer ingenting/);
  });

  it("kan registrere en ny leverandør uten å endre kallsteder", () => {
    const fake: SigningProvider = {
      name: "test-leverandor",
      isConfigured: () => true,
      createOrder: async () => ({ providerOrderId: "x", signerLinks: [] }),
      getOrderStatus: async () => ({ providerOrderId: "x", status: "sent", signers: [] }),
      cancelOrder: async () => undefined,
      verifyCallback: () => true,
    };
    registerSigningProvider(fake);
    expect(getSigningProvider("test-leverandor").name).toBe("test-leverandor");
  });
});

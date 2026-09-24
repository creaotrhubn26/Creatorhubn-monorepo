import { describe, expect, it, vi, beforeEach } from "vitest";

const sendTransactionalEmail = vi.fn();
const notifyAdmins = vi.fn();

vi.mock("./transactional-email-service.js", () => ({ sendTransactionalEmail }));
vi.mock("./admin-notify.js", () => ({ notifyAdmins }));

const { sendAgreementReceipt } = await import("./leadgrid-agreement-receipt.js");

const kvittering = {
  agreementId: "22222222-2222-4222-8222-222222222222",
  agreementType: "dpa" as const,
  documentTitle: "Databehandleravtale",
  documentVersion: "2026-09-24",
  documentSha256: "abc123",
  organizationName: "Neras Direkte AS",
  organizationId: "11111111-1111-4111-8111-111111111111",
  signerName: "Jon Christian Hillestad",
  signerTitle: "Daglig leder",
  signerEmail: "jon@nerasdirekte.no",
  signatureText: "Jon Christian Hillestad",
  signatureStyle: "flyt" as const,
  signedAt: "2026-09-24T08:00:00.000Z",
};

const pool = () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  return { pool: { query } as never, query };
};

beforeEach(() => {
  sendTransactionalEmail.mockReset();
  notifyAdmins.mockReset();
  notifyAdmins.mockResolvedValue(undefined);
});

describe("sendAgreementReceipt", () => {
  it("sender kvittering til signataren og varsler super admin", async () => {
    sendTransactionalEmail.mockResolvedValue({ sent: true });
    const { pool: p, query } = pool();

    const ut = await sendAgreementReceipt(p, kvittering);

    expect(ut.sent).toBe(true);
    const epost = sendTransactionalEmail.mock.calls[0][0];
    expect(epost.to).toBe("jon@nerasdirekte.no");
    expect(epost.subject).toContain("Databehandleravtale");
    // Sjekksummen er hele poenget med kvitteringen.
    expect(epost.text).toContain("abc123");
    expect(epost.html).toContain("Jon Christian Hillestad");
    // Avtaleteksten skal IKKE være med — innbokser kan endres, hasher ikke.
    expect(epost.text).not.toContain("Databehandleravtale mellom");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("receipt_sent_at = NOW()"),
      [kvittering.agreementId],
    );
    expect(notifyAdmins.mock.calls[0][1].title).toContain("Neras Direkte AS");
  });

  it("varsler fortsatt super admin når e-posten feiler, og merker den ikke sendt", async () => {
    sendTransactionalEmail.mockResolvedValue({ sent: false, reason: "missing_email_config" });
    const { pool: p, query } = pool();

    const ut = await sendAgreementReceipt(p, kvittering);

    expect(ut.sent).toBe(false);
    expect(query).not.toHaveBeenCalled();
    expect(notifyAdmins.mock.calls[0][1].summary).toContain("KVITTERING IKKE SENDT");
  });

  it("kaster aldri — signeringen står selv om varslingen ryker", async () => {
    sendTransactionalEmail.mockRejectedValue(new Error("SMTP nede"));
    notifyAdmins.mockRejectedValue(new Error("DB nede"));
    const { pool: p } = pool();

    await expect(sendAgreementReceipt(p, kvittering)).resolves.toEqual({ sent: false });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();
const recordProductionUsageMock = vi.fn();
const recordStorageUsageMock = vi.fn();
const handleMock = vi.fn();

vi.mock("./capture-upload-service.js", () => ({
  captureStoreHandleForKey: (key: string) => handleMock(key),
}));
vi.mock("./production-storage-service.js", () => ({
  recordProductionUsage: (...a: unknown[]) => recordProductionUsageMock(...a),
}));
vi.mock("./storage-quota-service.js", () => ({
  recordStorageUsage: (...a: unknown[]) => recordStorageUsageMock(...a),
}));

const { releaseCaptureObject, releaseCaptureObjects } = await import(
  "./capture-asset-release-service.js"
);

const pool = {} as never;

beforeEach(() => {
  sendMock.mockReset().mockResolvedValue({});
  recordProductionUsageMock.mockReset().mockResolvedValue(0);
  recordStorageUsageMock.mockReset().mockResolvedValue(0);
  handleMock.mockReset().mockReturnValue({
    client: { send: sendMock },
    bucket: "the-role-room-prod",
    backend: "b2",
    prefix: "capture-b2/",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("releaseCaptureObject", () => {
  const base = {
    key: "capture-b2/u1/s1/a1/full/DSC.arw",
    sizeBytes: 500,
    projectId: "nordlys",
    billingUserId: "produsent",
    reason: "retention_expiry",
  };

  it("sletter objektet før regnskapet trekkes ned", async () => {
    // Motsatt rekkefølge ville gitt en kunde som betaler for noe
    // regnskapet sier er borte — en usynlig kostnad ingen leter etter.
    const order: string[] = [];
    sendMock.mockImplementation(async () => {
      order.push("delete");
      return {};
    });
    recordProductionUsageMock.mockImplementation(async () => {
      order.push("ledger");
      return 0;
    });

    await releaseCaptureObject(pool, base);
    expect(order).toEqual(["delete", "ledger"]);
  });

  it("trekker ned begge regnskapene", async () => {
    // Bare ett ville enten aldri frigitt kvoten eller vist prosjektet
    // tommere enn det er.
    const r = await releaseCaptureObject(pool, base);
    expect(r).toEqual({ ok: true, backend: "b2", freedBytes: 500 });
    expect(recordProductionUsageMock).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({ projectId: "nordlys", deltaBytes: -500 }),
    );
    expect(recordStorageUsageMock).toHaveBeenCalledWith(
      pool, "produsent", -500, "b2", "retention_expiry",
      expect.anything(), expect.anything(),
    );
  });

  it("rører ikke regnskapet når slettingen feiler", async () => {
    // Bytene skal stå igjen og kunne prøves på nytt. En synlig feil er
    // den riktige å ha her.
    sendMock.mockRejectedValue(new Error("403 forbidden"));
    const r = await releaseCaptureObject(pool, base);
    expect(r.ok).toBe(false);
    expect(recordProductionUsageMock).not.toHaveBeenCalled();
    expect(recordStorageUsageMock).not.toHaveBeenCalled();
  });

  it("belaster bare kontoen når objektet ikke tilhører en produksjon", async () => {
    await releaseCaptureObject(pool, { ...base, projectId: null });
    expect(recordProductionUsageMock).not.toHaveBeenCalled();
    expect(recordStorageUsageMock).toHaveBeenCalled();
  });

  it("trekker ikke ned kontoen uten en kjent betaler", async () => {
    await releaseCaptureObject(pool, { ...base, billingUserId: null });
    expect(recordProductionUsageMock).toHaveBeenCalled();
    expect(recordStorageUsageMock).not.toHaveBeenCalled();
  });

  it("gir opp når lageret ikke er konfigurert, uten å slette noe", async () => {
    handleMock.mockReturnValue(null);
    const r = await releaseCaptureObject(pool, base);
    expect(r).toEqual({ ok: false, error: "not_configured" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("ruter slettingen til lageret nøkkelen faktisk ligger i", async () => {
    // Sletter vi i B2 en nøkkel som ligger i R2, blir objektet stående
    // og koste penger mens regnskapet sier det er borte.
    await releaseCaptureObject(pool, { ...base, key: "capture/u1/s1/a1/full/x.arw" });
    expect(handleMock).toHaveBeenCalledWith("capture/u1/s1/a1/full/x.arw");
  });

  it("hopper over regnskapet på null bytes, men sletter likevel", async () => {
    const r = await releaseCaptureObject(pool, { ...base, sizeBytes: 0 });
    expect(r).toEqual({ ok: true, backend: "b2", freedBytes: 0 });
    expect(sendMock).toHaveBeenCalled();
    expect(recordProductionUsageMock).not.toHaveBeenCalled();
  });

  it("behandler negativ størrelse som null i stedet for å øke regnskapet", async () => {
    // Et negativt delta her ville lagt bytes TIL ved en sletting.
    const r = await releaseCaptureObject(pool, { ...base, sizeBytes: -500 });
    expect(r).toEqual({ ok: true, backend: "b2", freedBytes: 0 });
    expect(recordProductionUsageMock).not.toHaveBeenCalled();
  });
});

describe("releaseCaptureObjects", () => {
  const item = (key: string, size = 100) => ({
    key, sizeBytes: size, projectId: "nordlys",
    billingUserId: "produsent", reason: "retention_expiry",
  });

  it("summerer det som faktisk ble frigjort", async () => {
    const r = await releaseCaptureObjects(pool, [item("a", 100), item("b", 250)]);
    expect(r.released).toBe(2);
    expect(r.freedBytes).toBe(350);
    expect(r.failed).toEqual([]);
  });

  it("lar én feilet sletting stoppe seg selv, ikke resten", async () => {
    sendMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({});
    const r = await releaseCaptureObjects(pool, [
      item("a"), item("b"), item("c"),
    ]);
    expect(r.released).toBe(2);
    expect(r.freedBytes).toBe(200);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].key).toBe("b");
  });

  it("sletter serielt, ikke i parallell", async () => {
    // En sletterunde som metter forbindelsen mot lageret ville gått ut
    // over opplastingene fra settet, og de haster faktisk.
    let inFlight = 0;
    let maxInFlight = 0;
    sendMock.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return {};
    });
    await releaseCaptureObjects(pool, [item("a"), item("b"), item("c")]);
    expect(maxInFlight).toBe(1);
  });

  it("gir et tomt resultat for en tom liste", async () => {
    const r = await releaseCaptureObjects(pool, []);
    expect(r).toEqual({ released: 0, freedBytes: 0, failed: [] });
    expect(sendMock).not.toHaveBeenCalled();
  });
});

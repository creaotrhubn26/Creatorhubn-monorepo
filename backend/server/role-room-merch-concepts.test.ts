import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  buildMerchConceptKey,
  MerchConceptError,
  normalizeMerchConceptInput,
  saveMerchConcept,
} from "./role-room-merch-concepts.js";
import { listMerchProductSpecs } from "./role-room-merch-mockup.js";

const validInput = {
  productId: "tshirt",
  supplierKey: "org-1",
  supplierName: "Norsk Profil AS",
  provider: "printful",
  providerProductId: 71,
  providerVariantId: 4011,
  providerColorName: "White",
  providerColorHex: "#ffffff",
  requestedColorHex: "#0f766e",
  logoUrl: "https://example.test/logo.svg",
  logoVariant: "original",
  placement: "front",
  printWidthMm: 220,
  printHeightMm: 180,
  technique: "dtg",
  mockupUrls: [
    "https://example.test/mockup.jpg",
    "https://example.test/mockup.jpg",
  ],
};

describe("Role Room merch concept dataflow", () => {
  it("publishes production specifications for all six supported products", () => {
    const specs = listMerchProductSpecs();
    expect(specs.map((spec) => spec.productId)).toEqual([
      "tshirt",
      "hoodie",
      "polo",
      "cap",
      "totebag",
      "mug",
    ]);
    expect(
      specs.every(
        (spec) =>
          spec.placements.length > 0 &&
          spec.techniques.length > 0 &&
          spec.placements.every((placement) => placement.techniques.length > 0),
      ),
    ).toBe(true);
  });

  it("normalizes colors and mockup URLs before building a stable deduplication key", () => {
    const first = normalizeMerchConceptInput(validInput);
    const second = normalizeMerchConceptInput({
      ...validInput,
      providerColorHex: "#FFFFFF",
      requestedColorHex: "#0F766E",
    });
    expect(first.providerColorHex).toBe("#FFFFFF");
    expect(first.requestedColorHex).toBe("#0F766E");
    expect(first.mockupUrls).toEqual(["https://example.test/mockup.jpg"]);
    expect(buildMerchConceptKey(first)).toBe(buildMerchConceptKey(second));
    expect(buildMerchConceptKey(first)).not.toBe(
      buildMerchConceptKey({ ...second, placement: "back" }),
    );
  });

  it("rejects mismatched provider products and insecure logo URLs", () => {
    expect(() =>
      normalizeMerchConceptInput({ ...validInput, providerProductId: 146 }),
    ).toThrow("does not match");
    expect(() =>
      normalizeMerchConceptInput({
        ...validInput,
        logoUrl: "http://example.test/logo.svg",
      }),
    ).toThrow("HTTPS");
    expect(() =>
      normalizeMerchConceptInput({
        ...validInput,
        placement: "left_chest",
        technique: "dtg",
      }),
    ).toThrow("not available");
  });

  it("rejects production dimensions outside the selected product print area", () => {
    expect(() =>
      normalizeMerchConceptInput({ ...validInput, printWidthMm: 301 }),
    ).toThrowError(MerchConceptError);
  });

  it("saves with project-scoped ON CONFLICT deduplication", async () => {
    const normalized = normalizeMerchConceptInput(validInput);
    const row = {
      id: "00000000-0000-4000-8000-000000000001",
      project_id: "project-1",
      concept_key: buildMerchConceptKey(normalized),
      product_id: normalized.productId,
      supplier_key: normalized.supplierKey,
      supplier_name: normalized.supplierName,
      provider: normalized.provider,
      provider_product_id: normalized.providerProductId,
      provider_variant_id: normalized.providerVariantId,
      provider_color_name: normalized.providerColorName,
      provider_color_hex: normalized.providerColorHex,
      requested_color_hex: normalized.requestedColorHex,
      logo_url: normalized.logoUrl,
      logo_variant: normalized.logoVariant,
      placement: normalized.placement,
      print_width_mm: normalized.printWidthMm,
      print_height_mm: normalized.printHeightMm,
      technique: normalized.technique,
      mockup_urls: normalized.mockupUrls,
      status: "draft",
      created_by_user_id: "user-1",
      updated_by_user_id: "user-1",
      approved_by_user_id: null,
      approved_at: null,
      created_at: new Date("2026-09-03T10:00:00Z"),
      updated_at: new Date("2026-09-03T10:00:00Z"),
      deduplicated: false,
    };
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const pool = { query } as unknown as Pool;

    const result = await saveMerchConcept(
      pool,
      "project-1",
      "user-1",
      validInput,
    );

    expect(result.concept.projectId).toBe("project-1");
    expect(result.deduplicated).toBe(false);
    expect(String(query.mock.calls[0][0])).toContain(
      "ON CONFLICT (project_id, concept_key)",
    );
    expect(query.mock.calls[0][1][1]).toBe(row.concept_key);
  });
});

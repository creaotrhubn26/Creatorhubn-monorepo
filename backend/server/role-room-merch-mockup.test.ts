import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { generateMerchMockup } from "./role-room-merch-mockup.js";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Role Room Printful production mapping", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.PRINTFUL_API_KEY;
    delete process.env.PRINTFUL_STORE_ID;
  });

  it("resolves the selected technique to a variant-supported provider placement", async () => {
    process.env.PRINTFUL_API_KEY = "test-key";
    process.env.PRINTFUL_STORE_ID = "test-store";
    vi.useFakeTimers();

    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/mockup-generator/printfiles/71")) {
          expect(url).toContain("technique=EMBROIDERY");
          return Promise.resolve(
            jsonResponse({
              result: {
                printfiles: [{ printfile_id: 19, width: 1200, height: 1200 }],
                variant_printfiles: [
                  {
                    variant_id: 4011,
                    placements: { embroidery_chest_left: 19 },
                  },
                ],
              },
            }),
          );
        }
        if (url.includes("/mockup-generator/create-task/71")) {
          const body = JSON.parse(String(init?.body)) as {
            files: Array<{
              placement: string;
              position: { area_width: number; area_height: number };
            }>;
          };
          expect(body.files[0].placement).toBe("embroidery_chest_left");
          expect(body.files[0].position).toMatchObject({
            area_width: 1200,
            area_height: 1200,
          });
          return Promise.resolve(
            jsonResponse({ result: { task_key: "task-1", status: "pending" } }),
          );
        }
        if (url.includes("/mockup-generator/task?")) {
          return Promise.resolve(
            jsonResponse({
              result: {
                status: "completed",
                mockups: [
                  {
                    mockup_url: "https://example.test/mockup.jpg",
                    extra: [{ url: "https://example.test/mockup-detail.jpg" }],
                  },
                ],
              },
            }),
          );
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pending = generateMerchMockup({ query } as unknown as Pool, {
      productId: "tshirt",
      designImageUrl: "https://example.test/logo.png",
      placement: "left_chest",
      technique: "embroidery",
    });

    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;

    expect(result).toMatchObject({
      providerProductId: 71,
      providerVariantId: 4011,
      placement: "left_chest",
      providerPlacement: "embroidery_chest_left",
      technique: "embroidery",
      mockupUrls: [
        "https://example.test/mockup.jpg",
        "https://example.test/mockup-detail.jpg",
      ],
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});

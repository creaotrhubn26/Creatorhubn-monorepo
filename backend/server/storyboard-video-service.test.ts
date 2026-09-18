import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectFileDownloadUrl } from "./role-room-user-storage-service.js";
import {
  buildStoryboardVideoInput,
  listStoryboardVideoModels,
  isPrivateNetworkAddress,
  normalizeStoryboardVideoDuration,
  resolveStoryboardVideoModel,
} from "./storyboard-video-service.js";

describe("storyboard-video-service model routing", () => {
  const originalFalKey = process.env.FAL_KEY;
  const originalHiggsfieldKey = process.env.HIGGSFIELD_API_KEY;

  beforeEach(() => {
    process.env.FAL_KEY = "test-fal-key";
    delete process.env.HIGGSFIELD_API_KEY;
  });

  afterEach(() => {
    if (originalFalKey === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = originalFalKey;
    if (originalHiggsfieldKey === undefined) delete process.env.HIGGSFIELD_API_KEY;
    else process.env.HIGGSFIELD_API_KEY = originalHiggsfieldKey;
  });

  it("velger LongCat som billigste auto-modell når FAL er konfigurert", () => {
    const model = resolveStoryboardVideoModel("auto");
    expect(model?.key).toBe("longcat-video-i2v");
    expect(model?.costPerSecondUsd).toBe(0.04);
  });

  it("viser Higgsfield som valgfri, men ikke konfigurert", () => {
    const models = listStoryboardVideoModels();
    expect(models.find((model) => model.key === "longcat-video-i2v")?.configured).toBe(true);
    expect(models.find((model) => model.key === "seedance-2-i2v")?.costPerSecondUsd).toBe(0.2419);
    expect(models.find((model) => model.key === "higgsfield-dop-i2v")?.configured).toBe(false);
  });

  it("avviser modellnavn som ikke finnes i allowlisten", () => {
    expect(resolveStoryboardVideoModel("https://evil.example/model")).toBeNull();
  });

  it("bygger LongCat-kontrakten med 30 bilder per sekund", () => {
    expect(buildStoryboardVideoInput(
      "longcat-video-i2v",
      "https://storage.example/frame.jpg",
      "slow dolly in",
      4,
    )).toEqual({
      image_url: "https://storage.example/frame.jpg",
      prompt: "slow dolly in",
      num_frames: 120,
    });
  });

  it("normaliserer varighet per modellgrense", () => {
    expect(normalizeStoryboardVideoDuration("longcat-video-i2v", 1)).toBe(2);
    expect(normalizeStoryboardVideoDuration("longcat-video-i2v", 20)).toBe(10);
    expect(normalizeStoryboardVideoDuration("seedance-2-i2v", 2)).toBe(4);
    expect(normalizeStoryboardVideoDuration("seedance-2-i2v", 20)).toBe(15);
  });

  it("blokkerer interne provider-output-adresser mot SSRF", () => {
    expect(isPrivateNetworkAddress("127.0.0.1")).toBe(true);
    expect(isPrivateNetworkAddress("169.254.169.254")).toBe(true);
    expect(isPrivateNetworkAddress("10.0.0.8")).toBe(true);
    expect(isPrivateNetworkAddress("203.0.113.4")).toBe(true);
    expect(isPrivateNetworkAddress("::1")).toBe(true);
    expect(isPrivateNetworkAddress("2001:db8::1")).toBe(true);
    expect(isPrivateNetworkAddress("8.8.8.8")).toBe(false);
    expect(isPrivateNetworkAddress("2606:4700:4700::1111")).toBe(false);
  });
});

describe("storyboard video source boundary", () => {
  it("binder kildefilen til både prosjekt, entity-type og frame", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const result = await getProjectFileDownloadUrl({ query } as never, {
      projectId: "project-1",
      fileId: "123e4567-e89b-12d3-a456-426614174000",
      attachedToEntityType: "storyboard_frame",
      attachedToEntityId: "frame-9",
      requireImage: true,
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(query).toHaveBeenCalledOnce();
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("project_id::text = $2");
    expect(sql).toContain("attached_to_entity_type = $3");
    expect(sql).toContain("attached_to_entity_id = $4");
    expect(sql).toContain("LIKE 'image/%'");
    expect(values).toEqual([
      "123e4567-e89b-12d3-a456-426614174000",
      "project-1",
      "storyboard_frame",
      "frame-9",
    ]);
  });
});

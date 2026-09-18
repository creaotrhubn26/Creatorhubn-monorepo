import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeDataUrlToBlob } from "./mockupProjectRepository";
import { buildMockupAssetForm } from "../../services/cloudMockupProjectsService";

describe("decodeDataUrlToBlob", () => {
  afterEach(() => vi.restoreAllMocks());

  it("dekoder base64 lokalt uten fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const blob = decodeDataUrlToBlob("data:image/jpeg;base64,TWVkU2lkZQ==");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(blob.type).toBe("image/jpeg");
    expect(await blob.text()).toBe("MedSide");
  });

  it("dekoder prosentkodet data-URL", async () => {
    const blob = decodeDataUrlToBlob("data:text/plain,PreVisit%20klar");

    expect(blob.type).toBe("text/plain");
    expect(await blob.text()).toBe("PreVisit klar");
  });

  it("avviser andre kildetyper med en tydelig feil", () => {
    expect(() => decodeDataUrlToBlob("/tmp/medside.jpg"))
      .toThrow("Ugyldig data-URL for mockup-bilde");
  });
});

describe("buildMockupAssetForm", () => {
  it("binder mockup-ID som entity uten casting-project FK", () => {
    const form = buildMockupAssetForm(new Blob(["MedSide"], { type: "image/jpeg" }), "medside.jpg", "doc_medside_1");

    expect(form.get("projectId")).toBeNull();
    expect(form.get("sourceModule")).toBe("mockup-studio");
    expect(form.get("attachedToEntityType")).toBe("mockup-project");
    expect(form.get("attachedToEntityId")).toBe("doc_medside_1");
    expect(JSON.parse(String(form.get("metadata")))).toEqual({ mockupProjectId: "doc_medside_1" });
  });
});

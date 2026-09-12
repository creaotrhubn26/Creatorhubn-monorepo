import { describe, expect, it } from "vitest";
import {
  buildPostAgentOpenAiImagePayload,
  buildPostAgentVisualAuditPayload,
  postAgentOpenAiImageSize,
} from "./post-agent-anthropic-routes.js";

describe("Post Agent high-fidelity image provider contract", () => {
  it("maps editable mockup formats to supported gpt-image-2 sizes", () => {
    expect(postAgentOpenAiImageSize("portrait_4_3")).toBe("1024x1536");
    expect(postAgentOpenAiImageSize("portrait_16_9")).toBe("1024x1536");
    expect(postAgentOpenAiImageSize("landscape_16_9")).toBe("1536x1024");
    expect(postAgentOpenAiImageSize("square_hd")).toBe("1024x1024");
  });

  it("builds a high-quality transparent PNG request without a fake provider seed", () => {
    const payload = buildPostAgentOpenAiImagePayload({
      prompt: "Original cinematic clinician",
      imageSize: "portrait_4_3",
      quality: "high",
      background: "transparent",
      outputFormat: "png",
    });

    expect(payload).toEqual({
      model: "gpt-image-2",
      prompt: "Original cinematic clinician",
      n: 1,
      size: "1024x1536",
      quality: "high",
      background: "transparent",
      output_format: "png",
    });
    expect(payload).not.toHaveProperty("seed");
  });

  it("builds a structured visual QA request with current and identity-reference images", () => {
    const payload = buildPostAgentVisualAuditPayload({
      imageDataUrl: "data:image/png;base64,AAA=",
      referenceDataUrl: "data:image/png;base64,BBB=",
      primaryColor: "#102A43",
      accentColor: "#2CB1A6",
      model: "gpt-5-mini",
    }) as any;
    expect(payload.model).toBe("gpt-5-mini");
    expect(payload.store).toBe(false);
    expect(payload.input[0].content.filter((part: any) => part.type === "input_image")).toHaveLength(2);
    expect(payload.text.format.type).toBe("json_schema");
    expect(payload.text.format.schema.required).toEqual(expect.arrayContaining([
      "anatomy", "hands", "symmetry", "collisions", "subject_isolation", "brand_harmony", "identity_continuity",
    ]));
  });
});

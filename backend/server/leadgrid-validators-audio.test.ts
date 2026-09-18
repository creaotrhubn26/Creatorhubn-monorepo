import { describe, expect, it } from "vitest";

import {
  decodeLeadgridAudioBase64,
  MAX_LEADGRID_AUDIO_BASE64_CHARS,
  MAX_LEADGRID_AUDIO_DECODED_BYTES,
  uploadAudioBody,
} from "./leadgrid-validators.js";

describe("Leadgrid meeting-note audio limits", () => {
  it("keeps the encoded cap inside the authenticated 46 MiB parser budget", () => {
    expect(MAX_LEADGRID_AUDIO_BASE64_CHARS).toBe(
      Math.ceil(MAX_LEADGRID_AUDIO_DECODED_BYTES / 3) * 4,
    );
    expect(MAX_LEADGRID_AUDIO_BASE64_CHARS).toBeLessThan(46 * 1024 * 1024);
  });

  it("accepts canonical audio base64 and rejects malformed input", () => {
    const encoded = Buffer.alloc(96, 7).toString("base64");
    expect(
      uploadAudioBody.safeParse({ audio_base64: encoded, language: "no" })
        .success,
    ).toBe(true);
    expect(
      uploadAudioBody.safeParse({
        audio_base64: `${encoded.slice(0, -1)}!`,
        language: "no",
      }).success,
    ).toBe(false);
  });

  it("checks decoded bytes before transcription", () => {
    const encoded = Buffer.from("four").toString("base64");
    expect(decodeLeadgridAudioBase64(encoded, 4)?.toString()).toBe("four");
    expect(decodeLeadgridAudioBase64(encoded, 3)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  inspectCaptionTracks,
  isTrustedLegacyVideoUrl,
  parseVideoProbeJson,
  parseVideoQcLog,
} from "./project-video-qc-service";

describe("Video Room technical QC", () => {
  it("parses black, freeze, silence and EBU R128 measurements", () => {
    const parsed = parseVideoQcLog(`
      [blackdetect] black_start:1 black_end:3.5 black_duration:2.5
      [freezedetect] lavfi.freezedetect.freeze_start: 4
      [freezedetect] lavfi.freezedetect.freeze_duration: 3.2
      [freezedetect] lavfi.freezedetect.freeze_end: 7.2
      [silencedetect] silence_start: 8
      [silencedetect] silence_end: 12.5 | silence_duration: 4.5
      Integrated loudness:\n I: -18.2 LUFS
      True peak:\n Peak: -0.4 dBFS
    `, 20);
    expect(parsed.blackSegments).toEqual([{ startSec: 1, endSec: 3.5, durationSec: 2.5 }]);
    expect(parsed.freezeSegments).toEqual([{ startSec: 4, endSec: 7.2, durationSec: 3.2 }]);
    expect(parsed.silenceSegments).toEqual([{ startSec: 8, endSec: 12.5, durationSec: 4.5 }]);
    expect(parsed.integratedLufs).toBe(-18.2);
    expect(parsed.truePeakDbfs).toBe(-0.4);
  });

  it("keeps only the safe probe contract", () => {
    expect(parseVideoProbeJson(JSON.stringify({
      format: { duration: "61.5", size: "1234", format_name: "mov,mp4", bit_rate: "8000000" },
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1920, height: 1080, avg_frame_rate: "25/1", pix_fmt: "yuv420p" },
        { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2, channel_layout: "stereo" },
      ],
    }))).toMatchObject({
      durationSec: 61.5,
      sizeBytes: 1234,
      video: { codec: "h264", width: 1920, height: 1080, frameRate: 25 },
      audio: { codec: "aac", sampleRate: 48000, channels: 2 },
    });
  });

  it("reports invalid, overlapping, fast and long captions", () => {
    const result = inspectCaptionTracks([{
      id: "1", language: "no", label: "Norsk", status: "ready", content: `WEBVTT

00:00:00.000 --> 00:00:01.000
Denne caption-linjen er altfor lang til anbefalt visning

00:00:00.800 --> 00:00:01.100
Veldig mange tegn på svært kort tid

00:00:03.000 --> 00:00:02.000
Ugyldig
`,
    }], "client_delivery");
    expect(result.metrics).toMatchObject({ cueCount: 2, invalidCueCount: 1, overlapCount: 1 });
    expect(result.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "captions_invalid_cues", "captions_overlap", "captions_too_fast", "captions_long_lines",
    ]));
  });

  it("rejects arbitrary and private legacy media URLs", () => {
    expect(isTrustedLegacyVideoUrl("https://customer.example/private.mov")).toBe(false);
    expect(isTrustedLegacyVideoUrl("http://127.0.0.1/internal")).toBe(false);
    expect(isTrustedLegacyVideoUrl("https://cdn.creatorhubn.com/video.mov")).toBe(true);
    expect(isTrustedLegacyVideoUrl("https://example.s3.eu-north-1.amazonaws.com/video.mov")).toBe(true);
  });
});

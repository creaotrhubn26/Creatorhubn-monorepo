import { describe, expect, it } from "vitest";
import {
  parseAvidFrameRate,
  parseAvidMarkerText,
  serializeAvidMarkerText,
  validateAvidTrack,
} from "./avid-marker-interchange";

describe("Avid Media Composer marker interchange", () => {
  it("writes Avid's required tab-delimited field order", () => {
    expect(
      serializeAvidMarkerText(
        [{
          id: "creatorhub:123e4567-e89b-12d3-a456-426614174000",
          timecodeSec: 8.12,
          title: "Correct tint",
          note: "Correct tint",
          color: "blue",
          completed: false,
          mustFix: true,
        }],
        { frameRate: 25, track: "V1", author: "CreatorHub" },
      ),
    ).toBe(
      "CreatorHub\t203\tV1\tred\t[MÅ FIKSES] Correct tint [[creatorhub:id=creatorhub:123e4567-e89b-12d3-a456-426614174000]]",
    );
  });

  it("round-trips stable marker identity, status and fractional frame rate", () => {
    const source = [{
      id: "creatorhub:123e4567-e89b-12d3-a456-426614174000",
      timecodeSec: 10,
      title: "Approved beat",
      note: "Approved beat",
      color: "red",
      completed: true,
      mustFix: true,
    }];
    const text = serializeAvidMarkerText(source, { frameRate: "24000/1001" });
    const parsed = parseAvidMarkerText(text, { frameRate: "24000/1001" });
    expect(parsed.rejected).toEqual([]);
    expect(parsed.markers[0]).toMatchObject({
      id: source[0].id,
      title: "Approved beat",
      color: "green",
      completed: true,
      mustFix: false,
    });
    expect(parsed.markers[0].timecodeSec).toBeCloseTo(10.01, 5);
  });

  it("accepts a BOM and optional spreadsheet header", () => {
    const parsed = parseAvidMarkerText(
      "\uFEFFName\tFrame\tTrack\tColor\tComment\r\nMary\t354\tA1\tblue\tA voice-over",
      { frameRate: 25 },
    );
    expect(parsed.rejected).toEqual([]);
    expect(parsed.markers).toHaveLength(1);
    expect(parsed.markers[0]).toMatchObject({
      timecodeSec: 14.16,
      title: "A voice-over",
      color: "blue",
    });
  });

  it("gives untagged Avid markers a deterministic identity", () => {
    const row = "Editor\t100\tV2\tyellow\tTry the alternate take";
    const first = parseAvidMarkerText(row).markers[0];
    const second = parseAvidMarkerText(row).markers[0];
    expect(first.id).toMatch(/^avid:[a-f0-9]{32}$/);
    expect(first.id).toBe(second.id);
  });

  it("keeps the identity tag when a long comment is truncated", () => {
    const text = serializeAvidMarkerText([{ id: "creatorhub:stable", note: "x".repeat(8_000) }]);
    expect(text.length).toBeLessThanOrEqual(4_100);
    expect(parseAvidMarkerText(text).markers[0].id).toBe("creatorhub:stable");
  });

  it("sanitizes control characters without changing the five-column shape", () => {
    const text = serializeAvidMarkerText([{ id: "creatorhub:safe", note: "Line one\nLine\ttwo" }]);
    expect(text.split("\t")).toHaveLength(5);
    expect(text).toContain("Line one Line two");
  });

  it("rejects malformed rows without accepting a partial field shape", () => {
    const result = parseAvidMarkerText([
      "\t19\tV1\tred\tMissing name",
      "Editor\tnot-a-frame\tV1\tred\tBad frame",
      "Editor\t20\tV0\tred\tBad track",
      "Editor\t21\tV1\torange\tBad color",
      "Editor\t22\tV1\tblue\tGood marker",
    ].join("\n"));
    expect(result.markers).toHaveLength(1);
    expect(result.rejected.map((row) => row.reason)).toEqual([
      "name_required",
      "non_negative_integer_frame_required",
      "invalid_track",
      "invalid_color",
    ]);
  });

  it("validates rational frame rates and documented Avid track names", () => {
    expect(parseAvidFrameRate("30000/1001").value).toBeCloseTo(29.97002997);
    expect(validateAvidTrack("tc1")).toBe("TC1");
    expect(validateAvidTrack("a24")).toBe("A24");
    expect(() => parseAvidFrameRate("0/0")).toThrow("invalid_avid_frame_rate");
    expect(() => validateAvidTrack("S1")).toThrow("invalid_avid_track");
  });
});

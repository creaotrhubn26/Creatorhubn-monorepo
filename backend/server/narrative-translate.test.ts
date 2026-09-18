import { describe, expect, it, vi } from "vitest";

const { callMock } = vi.hoisted(() => ({ callMock: vi.fn() }));
vi.mock("./claude-json-helper.js", () => ({ callClaudeForJson: callMock }));

import { normalizeSegments, translateSegments, MAX_TRANSLATE_SEGMENTS } from "./narrative-translate.js";

describe("narrative-translate", () => {
  it("normalizeSegments: dedupliserer, kutter lengde og antall, dropper tomme", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ key: `k${i}`, text: `t${i}` }));
    const out = normalizeSegments([{ key: "a", text: "  Hei \r\n" }, { key: "a", text: "dup" }, { key: "", text: "x" }, { key: "b", text: "" }, ...many]);
    expect(out[0]).toEqual({ key: "a", text: "Hei" });
    expect(out).toHaveLength(MAX_TRANSLATE_SEGMENTS);
  });

  it("sender kun prose-segmenter til Claude og mapper svaret på nøkkel; ukjente nøkler ignoreres, manglende rapporteres", async () => {
    callMock.mockResolvedValueOnce({
      data: { translations: [{ key: "element:nel_1:contentHtml:0", text: "You find a purse." }, { key: "fremmed", text: "x" }] },
      model: "claude-opus-5", usage: {}, latencyMs: 1, raw: "",
    });
    const res = await translateSegments({
      sourceLocale: "nb", targetLocale: "en", storyContext: "Pungen",
      segments: [
        { key: "element:nel_1:contentHtml:0", text: "Du finner en pung.", context: "Innhold i «Landsbyen»" },
        { key: "connection:ncn_1:labelHtml:0", text: "Gå til markedet", context: "Valg fra «Landsbyen» til «Markedet»" },
      ],
    });
    expect(res.translations).toEqual([{ key: "element:nel_1:contentHtml:0", text: "You find a purse." }]);
    expect(res.missing).toEqual(["connection:ncn_1:labelHtml:0"]);
    const call = callMock.mock.calls[0][0];
    expect(call.model).toBe("claude-opus-5");
    expect(call.userMessage).toContain("Målspråk: engelsk (en)");
    expect(call.userMessage).toContain("Historie: Pungen");
    expect(call.userMessage).not.toContain("<pre>");
    expect(call.cachedSystem).toContain("Oversett bare \"text\"");
  });

  it("tom liste → ingen Claude-kall", async () => {
    callMock.mockClear();
    const res = await translateSegments({ sourceLocale: "nb", targetLocale: "en", segments: [] });
    expect(res.translations).toEqual([]);
    expect(callMock).not.toHaveBeenCalled();
  });
});

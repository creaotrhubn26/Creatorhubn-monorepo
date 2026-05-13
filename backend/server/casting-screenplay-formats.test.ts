import { describe, expect, it } from "vitest";

import {
  exportFdx,
  exportFountain,
  parseFdx,
  parseFountain,
  type ParsedScreenplay,
} from "./casting-screenplay-formats.js";

// ── Fountain ────────────────────────────────────────────────────────

describe("parseFountain", () => {
  it("parser title-page key/values", () => {
    const input = `Title: A Test Story
Author: Daniel Q

INT. OFFICE - DAY

The hero enters.`;
    const result = parseFountain(input);
    expect(result.title).toBe("A Test Story");
    expect(result.author).toBe("Daniel Q");
    expect(result.scenes).toHaveLength(1);
  });

  it("parser scene headings", () => {
    const input = `INT. OFFICE - DAY

A simple action.

EXT. STREET - NIGHT

Another action.`;
    const result = parseFountain(input);
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0].heading).toBe("INT. OFFICE - DAY");
    expect(result.scenes[1].heading).toBe("EXT. STREET - NIGHT");
  });

  it("parser character + dialogue", () => {
    const input = `INT. OFFICE - DAY

HERO
Hello world.`;
    const result = parseFountain(input);
    expect(result.scenes[0].dialogue).toHaveLength(1);
    expect(result.scenes[0].dialogue[0].character).toBe("HERO");
    expect(result.scenes[0].dialogue[0].text).toBe("Hello world.");
  });

  it("parser parentetikk under character", () => {
    const input = `INT. OFFICE - DAY

HERO
(whispering)
Hello.`;
    const result = parseFountain(input);
    expect(result.scenes[0].dialogue[0].parenthetical).toBe("whispering");
    expect(result.scenes[0].dialogue[0].text).toBe("Hello.");
  });

  it("parser action-blokker", () => {
    const input = `INT. OFFICE - DAY

The hero enters.

She looks around.`;
    const result = parseFountain(input);
    expect(result.scenes[0].action).toContain("The hero enters.");
    expect(result.scenes[0].action).toContain("She looks around.");
  });
});

describe("exportFountain", () => {
  it("emitter kanonisk Fountain", () => {
    const script: ParsedScreenplay = {
      title: "Test",
      scenes: [
        {
          heading: "INT. OFFICE - DAY",
          action: ["The hero enters."],
          dialogue: [
            { character: "HERO", text: "Hello." },
            { character: "VILLAIN", parenthetical: "smirking", text: "Goodbye." },
          ],
        },
      ],
    };
    const output = exportFountain(script);
    expect(output).toContain("Title: Test");
    expect(output).toContain("INT. OFFICE - DAY");
    expect(output).toContain("HERO");
    expect(output).toContain("Hello.");
    expect(output).toContain("(smirking)");
    expect(output).toContain("Goodbye.");
  });
});

describe("Fountain roundtrip", () => {
  it("parse → export → parse er stabil", () => {
    const original = `Title: Roundtrip
Author: Test

INT. OFFICE - DAY

The hero enters.

HERO
(curious)
What is this place?

EXT. STREET - NIGHT

She walks away.

VILLAIN
You'll regret this.`;
    const first = parseFountain(original);
    const emitted = exportFountain(first);
    const second = parseFountain(emitted);

    expect(second.title).toBe(first.title);
    expect(second.author).toBe(first.author);
    expect(second.scenes).toHaveLength(first.scenes.length);
    expect(second.scenes[0].heading).toBe(first.scenes[0].heading);
    expect(second.scenes[0].dialogue).toEqual(first.scenes[0].dialogue);
  });
});

// ── FDX ─────────────────────────────────────────────────────────────

describe("parseFdx", () => {
  it("parser FDX scene + dialogue", () => {
    const input = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="3">
  <Content>
    <Paragraph Type="Scene Heading"><Text>INT. OFFICE - DAY</Text></Paragraph>
    <Paragraph Type="Action"><Text>The hero enters.</Text></Paragraph>
    <Paragraph Type="Character"><Text>HERO</Text></Paragraph>
    <Paragraph Type="Parenthetical"><Text>(curious)</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>What is this place?</Text></Paragraph>
  </Content>
</FinalDraft>`;
    const result = parseFdx(input);
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].heading).toBe("INT. OFFICE - DAY");
    expect(result.scenes[0].action).toContain("The hero enters.");
    expect(result.scenes[0].dialogue[0].character).toBe("HERO");
    expect(result.scenes[0].dialogue[0].parenthetical).toBe("curious");
    expect(result.scenes[0].dialogue[0].text).toBe("What is this place?");
  });
});

describe("exportFdx", () => {
  it("emitter FDX-XML med korrekt struktur", () => {
    const script: ParsedScreenplay = {
      scenes: [
        {
          heading: "INT. OFFICE - DAY",
          action: ["The hero enters."],
          dialogue: [{ character: "HERO", text: "Hello." }],
        },
      ],
    };
    const output = exportFdx(script);
    expect(output).toContain("<FinalDraft");
    expect(output).toContain('Type="Scene Heading"');
    expect(output).toContain("INT. OFFICE - DAY");
    expect(output).toContain('Type="Character"');
    expect(output).toContain("HERO");
    expect(output).toContain('Type="Dialogue"');
  });
});

describe("FDX roundtrip", () => {
  it("parse → export → parse er stabil", () => {
    const input = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="3">
  <Content>
    <Paragraph Type="Scene Heading"><Text>EXT. PARK - DAY</Text></Paragraph>
    <Paragraph Type="Action"><Text>Birds chirp.</Text></Paragraph>
    <Paragraph Type="Character"><Text>JANE</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Good morning.</Text></Paragraph>
  </Content>
</FinalDraft>`;
    const first = parseFdx(input);
    const emitted = exportFdx(first);
    const second = parseFdx(emitted);

    expect(second.scenes).toHaveLength(first.scenes.length);
    expect(second.scenes[0].heading).toBe(first.scenes[0].heading);
    expect(second.scenes[0].dialogue).toEqual(first.scenes[0].dialogue);
  });
});

// ── Cross-format ────────────────────────────────────────────────────

describe("Fountain ↔ FDX interop", () => {
  it("Fountain → FDX bevarer struktur", () => {
    const fountainInput = `INT. OFFICE - DAY

The hero enters.

HERO
Hello.`;
    const parsed = parseFountain(fountainInput);
    const fdx = exportFdx(parsed);
    const reparsed = parseFdx(fdx);

    expect(reparsed.scenes[0].heading).toBe("INT. OFFICE - DAY");
    expect(reparsed.scenes[0].dialogue[0].character).toBe("HERO");
    expect(reparsed.scenes[0].dialogue[0].text).toBe("Hello.");
  });

  it("FDX → Fountain bevarer struktur", () => {
    const fdxInput = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft Version="3">
  <Content>
    <Paragraph Type="Scene Heading"><Text>EXT. PARK - DAY</Text></Paragraph>
    <Paragraph Type="Character"><Text>JANE</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Hi.</Text></Paragraph>
  </Content>
</FinalDraft>`;
    const parsed = parseFdx(fdxInput);
    const fountain = exportFountain(parsed);
    const reparsed = parseFountain(fountain);

    expect(reparsed.scenes[0].heading).toBe("EXT. PARK - DAY");
    expect(reparsed.scenes[0].dialogue[0].character).toBe("JANE");
    expect(reparsed.scenes[0].dialogue[0].text).toBe("Hi.");
  });
});

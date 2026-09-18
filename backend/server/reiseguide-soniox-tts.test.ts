import { describe, expect, it, vi } from "vitest";
import { SONIOX_TTS_MODEL, SonioxTtsError, createSonioxTts, sonioxLanguageCode, type TtsSocket } from "./reiseguide-soniox-tts.js";

type Listener = (...args: unknown[]) => void;

/** Falsk WebSocket som svarer med et fast manus av server-hendelser. */
function fakeSocket(script: (sent: string[], emit: (event: string, ...args: unknown[]) => void) => void) {
  const listeners = new Map<string, Listener[]>();
  const sent: string[] = [];
  const emit = (event: string, ...args: unknown[]) => {
    for (const l of listeners.get(event) ?? []) l(...args);
  };
  const socket: TtsSocket & { closed: boolean } = {
    closed: false,
    send: (data) => {
      sent.push(data);
      if (sent.length === 2) script(sent, emit);
    },
    close: () => {
      socket.closed = true;
    },
    on: (event, listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      if (event === "close") queueMicrotask(() => emit("open"));
    },
  };
  return { socket, sent };
}

describe("sonioxLanguageCode", () => {
  it("gjør nb/nn til «no» og stripper region", () => {
    expect(sonioxLanguageCode("nb")).toBe("no");
    expect(sonioxLanguageCode("nn-NO")).toBe("no");
    expect(sonioxLanguageCode("en-GB")).toBe("en");
    expect(() => sonioxLanguageCode("  ")).toThrow(SonioxTtsError);
  });
});

describe("createSonioxTts", () => {
  it("sender konfig med nøkkel, modell og return_timestamps, så teksten med text_end", async () => {
    const { socket, sent } = fakeSocket((_sent, emit) => {
      emit("message", Buffer.from(JSON.stringify({
        audio: Buffer.from("abc").toString("base64"),
        timestamps: { characters: ["H", "e", "i", "."], character_start_times_seconds: [0, 0.1, 0.2, 0.3], character_end_times_seconds: [0.1, 0.2, 0.3, 0.35] },
      })));
      emit("message", JSON.stringify({ audio: Buffer.from("def").toString("base64") }));
      emit("message", JSON.stringify({ audio_end: true }));
      emit("message", JSON.stringify({ terminated: true }));
    });
    const tts = createSonioxTts({ apiKey: "hemmelig", connect: () => socket });

    const result = await tts.synthesize({ text: "Hei.", lang: "nb", voice: "Adrian" });

    const config = JSON.parse(sent[0]!);
    expect(config).toMatchObject({
      api_key: "hemmelig",
      model: SONIOX_TTS_MODEL,
      language: "no",
      voice: "Adrian",
      audio_format: "mp3",
      bitrate: 96000,
      return_timestamps: true,
    });
    expect(JSON.parse(sent[1]!)).toMatchObject({ text: "Hei.", text_end: true, stream_id: config.stream_id });
    expect(result.audio.toString()).toBe("abcdef");
    expect(result.characters.map((c) => c.char).join("")).toBe("Hei.");
    expect(result.durationS).toBe(0.35);
    expect(result.bitrateKbps).toBe(96);
    expect(result.provider).toBe("soniox");
    expect(socket.closed).toBe(true);
  });

  it("feiler med Soniox' feilkode", async () => {
    const { socket } = fakeSocket((_sent, emit) => {
      emit("message", JSON.stringify({ error_code: 401, error_message: "Invalid API key" }));
    });
    const tts = createSonioxTts({ apiKey: "x", connect: () => socket });
    await expect(tts.synthesize({ text: "Hei.", lang: "nb", voice: "Adrian" })).rejects.toMatchObject({
      name: "SonioxTtsError",
      code: "401",
      message: expect.stringContaining("Invalid API key"),
    });
  });

  it("feiler når forbindelsen lukkes før terminated", async () => {
    const { socket } = fakeSocket((_sent, emit) => {
      emit("message", JSON.stringify({ audio: Buffer.from("a").toString("base64") }));
      emit("close");
    });
    const tts = createSonioxTts({ apiKey: "x", connect: () => socket });
    await expect(tts.synthesize({ text: "Hei.", lang: "nb", voice: "Adrian" })).rejects.toMatchObject({ code: "closed" });
  });

  it("feiler når det kommer lyd uten tidsstempler, siden tekstingen trenger dem", async () => {
    const { socket } = fakeSocket((_sent, emit) => {
      emit("message", JSON.stringify({ audio: Buffer.from("a").toString("base64") }));
      emit("message", JSON.stringify({ terminated: true }));
    });
    const tts = createSonioxTts({ apiKey: "x", connect: () => socket });
    await expect(tts.synthesize({ text: "Hei.", lang: "nb", voice: "Adrian" })).rejects.toMatchObject({ code: "no_timestamps" });
  });

  it("gir opp etter tidsavbrudd", async () => {
    vi.useFakeTimers();
    try {
      const { socket } = fakeSocket(() => undefined);
      const tts = createSonioxTts({ apiKey: "x", connect: () => socket, timeoutMs: 1000 });
      const pending = tts.synthesize({ text: "Hei.", lang: "nb", voice: "Adrian" });
      const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("avviser tom tekst og manglende nøkkel", async () => {
    expect(() => createSonioxTts({ apiKey: " " })).toThrow(SonioxTtsError);
    const tts = createSonioxTts({ apiKey: "x", connect: () => fakeSocket(() => undefined).socket });
    await expect(tts.synthesize({ text: "  ", lang: "nb", voice: "Adrian" })).rejects.toThrow(/tomt/);
  });
});

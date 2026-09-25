import { describe, expect, it, vi } from "vitest";
import {
  audioStorageKey,
  generateAreaAudio,
  generateScriptAudio,
  isAudioUpToDate,
  listScriptAudioJobs,
  type MediaStore,
  type ScriptAudioJob,
} from "./reiseguide-content-pipeline.js";
import type { CharacterTiming, SpeechSynthesis, SpeechSynthesizer } from "./reiseguide-soniox-tts.js";

const job: ScriptAudioJob = {
  scriptId: "scr_akershus_nb_narration_1",
  areaSlug: "oslo-kvadraturen-festningen-operaen",
  poiSlug: "akershus-festning",
  lang: "nb",
  kind: "narration",
  chapterNo: 1,
  version: 2,
  text: "Velkommen til Akershus festning. Borgen ble påbegynt rundt 1300.",
  activeAudio: [{ voice: "Adrian", version: 1 }],
};

function timings(spoken: string): CharacterTiming[] {
  return Array.from(spoken).map((char, i) => ({ char, startS: i * 0.1, endS: (i + 1) * 0.1 }));
}

function fakeTts(spoken = job.text): SpeechSynthesizer & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async synthesize(request) {
      calls.push(request);
      const chars = timings(spoken);
      const synthesis: SpeechSynthesis = {
        audio: Buffer.from("mp3-bytes"),
        format: "mp3",
        bitrateKbps: 96,
        characters: chars,
        durationS: chars.length * 0.1,
        provider: "soniox",
        model: "tts-rt-v2",
        voice: request.voice,
      };
      return synthesis;
    },
  };
}

function fakeStore(): MediaStore & { objects: Array<{ key: string; contentType: string; size: number }> } {
  const objects: Array<{ key: string; contentType: string; size: number }> = [];
  return {
    objects,
    async put({ key, body, contentType }) {
      objects.push({ key, contentType, size: body.length });
    },
  };
}

function fakeDb(rows: unknown[] = []) {
  const clientQuery = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] as unknown[], rowCount: 0 }));
  const release = vi.fn();
  const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows, rowCount: rows.length }));
  const connect = vi.fn(async () => ({ query: clientQuery, release }));
  return { db: { query, connect } as never, query, clientQuery, release, connect };
}

describe("audioStorageKey", () => {
  it("er deterministisk, versjonert og egen per stemme", () => {
    expect(audioStorageKey(job, "Hazel")).toBe(
      "products/senseaid-explore/areas/oslo-kvadraturen-festningen-operaen/pois/akershus-festning/audio/narration-1-nb-v2-hazel.mp3",
    );
    expect(audioStorageKey(job, "Walter")).not.toBe(audioStorageKey(job, "Hazel"));
  });
});

describe("generateScriptAudio", () => {
  it("syntetiserer, laster opp og skriver lyd + cues i én transaksjon", async () => {
    const tts = fakeTts();
    const store = fakeStore();
    const { db, clientQuery, release } = fakeDb();

    const result = await generateScriptAudio(job, "Hazel", { db, tts, store, voice: ["Hazel", "Walter"], languageVoices: ["Hazel", "Walter"] });

    expect(tts.calls).toEqual([{ text: job.text, lang: "nb", voice: "Hazel" }]);
    expect(store.objects).toEqual([{ key: audioStorageKey(job, "Hazel"), contentType: "audio/mpeg", size: 9 }]);
    const sql = clientQuery.mock.calls.map((c) => c[0].replace(/\s+/g, " ").trim());
    expect(sql[0]).toBe("BEGIN");
    // Deaktiverer samme stemme og stemmer språket ikke lenger bruker (Adrian), ikke Walter.
    expect(sql[1]).toMatch(/UPDATE guide_poi_audio SET is_active = FALSE WHERE script_id = \$1 AND is_active AND \(voice_id = \$2 OR NOT \(voice_id = ANY\(\$3::text\[\]\)\)\)/);
    expect(clientQuery.mock.calls[1]![1]).toEqual([job.scriptId, "Hazel", ["Hazel", "Walter"]]);
    expect(sql[2]).toMatch(/INSERT INTO guide_poi_audio/);
    expect(sql[3]).toMatch(/INSERT INTO guide_poi_captions/);
    expect(sql[4]).toBe("COMMIT");
    expect(release).toHaveBeenCalledTimes(1);

    const audioParams = clientQuery.mock.calls[2]![1]!;
    expect(audioParams.slice(1, 4)).toEqual([job.scriptId, 2, audioStorageKey(job, "Hazel")]);
    expect(audioParams[4]).toBe(96);
    expect(audioParams[5]).toBe(6.4);
    expect(audioParams[6]).toBe("soniox");
    expect(audioParams[7]).toBe("Hazel");
    expect(audioParams[8]).toMatch(/^[0-9a-f]{64}$/);

    const captionParams = clientQuery.mock.calls[3]![1]!;
    expect(captionParams[1]).toBe(audioParams[0]);
    const cues = JSON.parse(String(captionParams[2])) as Array<{ text: string }>;
    expect(cues.map((c) => c.text)).toEqual(["Velkommen til Akershus festning.", "Borgen ble påbegynt rundt 1300."]);
    expect(captionParams[3]).toBe("soniox");

    expect(result).toMatchObject({ status: "generated", voice: "Hazel", durationS: 6.4, cueCount: 2, storageKey: audioStorageKey(job, "Hazel") });
  });

  it("hopper over manus som allerede har lyd for samme versjon, med mindre force", async () => {
    const tts = fakeTts();
    const store = fakeStore();
    const { db, connect } = fakeDb();
    const current = { ...job, activeAudio: [{ voice: "Adrian", version: job.version }] };

    expect(await generateScriptAudio(current, "Adrian", { db, tts, store, voice: "Adrian" })).toMatchObject({ status: "skipped", reason: "up_to_date" });
    expect(tts.calls).toHaveLength(0);
    expect(connect).not.toHaveBeenCalled();

    expect(await generateScriptAudio(current, "Adrian", { db, tts, store, voice: "Adrian", force: true })).toMatchObject({ status: "generated" });
  });

  it("regner lyd som oppdatert bare for samme stemme og samme versjon", () => {
    const withHazel = { ...job, activeAudio: [{ voice: "Hazel", version: job.version }, { voice: "Adrian", version: 1 }] };
    expect(isAudioUpToDate(withHazel, "Hazel")).toBe(true);
    expect(isAudioUpToDate(withHazel, "Walter")).toBe(false);
    expect(isAudioUpToDate(withHazel, "Adrian")).toBe(false);
  });

  it("lager lyd for hver stemme språket har, og hopper over stemmer som alt har lyd", async () => {
    const tts = fakeTts();
    const { db } = fakeDb([
      {
        id: "scr_1", lang: "nb", kind: "narration", chapter_no: 1, version: 2, script_text: job.text,
        poi_slug: "akershus-festning", area_slug: "oslo", active_audio: [{ voice: "Hazel", version: 2 }, { voice: "Adrian", version: 2 }],
      },
      {
        id: "scr_2", lang: "en", kind: "narration", chapter_no: 1, version: 1, script_text: job.text,
        poi_slug: "akershus-festning", area_slug: "oslo", active_audio: "[]",
      },
    ]);
    const voices = (lang: string) => (lang === "nb" ? ["Hazel", "Walter"] : ["Adrian"]);
    const results = await generateAreaAudio({ areaSlug: "oslo" }, { db, tts, store: fakeStore(), voice: voices });
    expect(results.map((r) => [r.job.lang, r.voice, r.status])).toEqual([
      ["nb", "Hazel", "skipped"],
      ["nb", "Walter", "generated"],
      ["en", "Adrian", "generated"],
    ]);
    expect(tts.calls.map((c) => (c as { voice: string }).voice)).toEqual(["Walter", "Adrian"]);
  });

  it("rører verken Soniox, R2 eller DB ved tørrkjøring", async () => {
    const tts = fakeTts();
    const store = fakeStore();
    const { db, connect } = fakeDb();
    expect(await generateScriptAudio(job, "Adrian", { db, tts, store, voice: "Adrian", dryRun: true })).toMatchObject({ status: "skipped", reason: "dry_run" });
    expect(tts.calls).toHaveLength(0);
    expect(store.objects).toHaveLength(0);
    expect(connect).not.toHaveBeenCalled();
  });

  it("ruller tilbake og slipper klienten når en insert feiler", async () => {
    const { db, clientQuery, release } = fakeDb();
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("guide_poi_captions")) throw new Error("captions-feil");
      return { rows: [] as unknown[], rowCount: 0 };
    });
    await expect(generateScriptAudio(job, "Adrian", { db, tts: fakeTts(), store: fakeStore(), voice: "Adrian" })).rejects.toThrow("captions-feil");
    const sql = clientQuery.mock.calls.map((c) => c[0]);
    expect(sql.at(-1)).toBe("ROLLBACK");
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe("listScriptAudioJobs + generateAreaAudio", () => {
  it("leser jobber fra DB med filter og samler resultater per manus", async () => {
    const { db, query } = fakeDb([
      {
        id: "scr_1", lang: "nb", kind: "narration", chapter_no: 1, version: 2, script_text: "Hei der. Bra.",
        poi_slug: "akershus-festning", area_slug: "oslo", active_audio: null,
      },
      {
        id: "scr_2", lang: "nb", kind: "audio_description", chapter_no: 1, version: 1, script_text: "Slik ser det ut.",
        poi_slug: "akershus-festning", area_slug: "oslo", active_audio: [{ voice: "Adrian", version: 1 }],
      },
    ]);
    const jobs = await listScriptAudioJobs(db, { areaSlug: "oslo", lang: "nb" });
    expect(query.mock.calls[0]?.[1]).toEqual(["oslo", "nb", null, null]);
    expect(jobs.map((j) => [j.scriptId, j.activeAudio])).toEqual([["scr_1", []], ["scr_2", [{ voice: "Adrian", version: 1 }]]]);

    const seen: string[] = [];
    const results = await generateAreaAudio(
      { areaSlug: "oslo", lang: "nb" },
      { db, tts: fakeTts("Hei der. Bra."), store: fakeStore(), voice: "Adrian", onResult: (r) => seen.push(r.status) },
    );
    expect(results.map((r) => r.status)).toEqual(["generated", "skipped"]);
    expect(seen).toEqual(["generated", "skipped"]);
  });

  it("fanger feil per manus i stedet for å stoppe hele kjøringen", async () => {
    const { db } = fakeDb([
      { id: "scr_1", lang: "nb", kind: "narration", chapter_no: 1, version: 1, script_text: "Hei.", poi_slug: "a", area_slug: "oslo", active_audio: [] },
    ]);
    const tts: SpeechSynthesizer = { synthesize: async () => { throw new Error("Soniox nede"); } };
    const results = await generateAreaAudio({ areaSlug: "oslo" }, { db, tts, store: fakeStore(), voice: "Adrian" });
    expect(results).toEqual([expect.objectContaining({ status: "failed", error: "Soniox nede" })]);
  });
});

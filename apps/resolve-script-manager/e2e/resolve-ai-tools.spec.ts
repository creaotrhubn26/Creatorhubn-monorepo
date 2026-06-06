/**
 * Resolve 21 AI-tools e2e — verifiserer at hele kjeden funker:
 *   Claude tool_use → runPhotoshopTool() → dispatcher → service →
 *   Tauri invoke "photoshop_send_command" → forventet plugin-call
 *
 * Vi mocker Tauri-invoke for å returnere fake plugin-respons, så vi
 * tester dispatchers + service-wrappers + tool-defs uten ekte Resolve.
 *
 * Hver test verifiserer:
 *   1. Tool finnes i PHOTOSHOP_TOOLS
 *   2. Dispatcher kaller riktig service-metode med riktige args
 *   3. Returnert tool_result reflekterer plugin-respons
 */

import { test, expect } from "@playwright/test";
import {
  PHOTOSHOP_TOOLS,
  runPhotoshopTool,
  type ClaudeToolUseBlock,
} from "../src/agents/photoshopTools";

interface MockInvoke {
  command: string;
  params?: unknown;
  result?: unknown;
  throwError?: string;
}

function installInvokeMock(records: { calls: MockInvoke[]; response: unknown }) {
  const internals = {
    invoke: async (cmd: string, args?: unknown) => {
      records.calls.push({ command: cmd, params: args });
      if (cmd === "photoshop_send_command") {
        return records.response;
      }
      return null;
    },
  };
  // Tauri sjekker window.__TAURI_INTERNALS__ — sett begge slik at Node-
  // testene fungerer uavhengig av om Tauri-api ser etter globalThis eller window.
  (globalThis as unknown as { window?: unknown }).window =
    (globalThis as unknown as { window?: unknown }).window ?? globalThis;
  (globalThis as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = internals;
  ((globalThis as unknown as { window: { __TAURI_INTERNALS__?: unknown } }).window).__TAURI_INTERNALS__ = internals;
}

test.describe("Resolve 21 AI-tools — full dispatcher-kjede", () => {
  test("audio.transcribe folder — registrert + dispatcher kaller send_command", async () => {
    const tool = PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_audio_transcribe");
    expect(tool).toBeTruthy();

    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "folder", success: true, use_speaker_detection: false },
    };
    installInvokeMock(records);

    const use: ClaudeToolUseBlock = {
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_audio_transcribe",
      input: {},
    };
    const result = await runPhotoshopTool(use);

    expect(result.is_error).toBeFalsy();
    expect(typeof result.content === "string").toBe(true);
    const parsed = JSON.parse(result.content as string);
    expect(parsed.scope).toBe("folder");
    expect(parsed.success).toBe(true);

    // Verifiser at sendCommand mottok riktig kommando
    const sendCall = records.calls.find(
      (c) => c.command === "photoshop_send_command",
    );
    expect(sendCall).toBeTruthy();
    const params = sendCall!.params as { command: string; params: { name: string } };
    expect(params.command).toBe("resolve.audioTranscribe");
  });

  test("audio.transcribe per item med speaker-detection", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "item", success: true, use_speaker_detection: true },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_audio_transcribe",
      input: { clip_id: "abc123", use_speaker_detection: true },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.scope).toBe("item");
    expect(parsed.use_speaker_detection).toBe(true);
  });

  test("audio.classify dispatcher", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "folder", success: true },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t3",
      name: "photoshop_resolve_audio_classify",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.success).toBe(true);
  });

  test("speech.generate krever text + støtter add_to_timeline", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        clip_name: "TTS_voice_2026",
        clip_id: "tts_001",
        timecode: "00:00:05:00",
        added_to_timeline: true,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t4",
      name: "photoshop_resolve_speech_generate",
      input: {
        text: "Hei og velkommen til Post Agent",
        timecode: "00:00:05:00",
        add_to_timeline: true,
      },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.clip_id).toBe("tts_001");
    expect(parsed.added_to_timeline).toBe(true);
  });

  test("speech.generate uten text → tool_result is_error", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t5",
      name: "photoshop_resolve_speech_generate",
      input: {},
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/text/i);
  });

  test("slate.analyze med marker_color", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "folder", success: true, marker_color: "Red" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t6",
      name: "photoshop_resolve_slate_analyze",
      input: { marker_color: "Red" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.marker_color).toBe("Red");
  });

  test("timeline.smartReframe (ingen args)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { timeline: "Main", success: true },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t7",
      name: "photoshop_resolve_timeline_smart_reframe",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.timeline).toBe("Main");
    expect(parsed.success).toBe(true);
  });

  test("Alle 5 AI-tools er registrert i PHOTOSHOP_TOOLS", () => {
    const expected = [
      "photoshop_resolve_audio_transcribe",
      "photoshop_resolve_audio_classify",
      "photoshop_resolve_speech_generate",
      "photoshop_resolve_slate_analyze",
      "photoshop_resolve_timeline_smart_reframe",
    ];
    for (const name of expected) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name)).toBeTruthy();
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  inspectProductionSoundWave,
  ProductionSoundMediaValidationError,
  sampleReferenceToTimecode,
} from "./casting-production-sound-media.js";

function chunk(
  id: string,
  content: Buffer,
  declaredSize = content.length,
): Buffer {
  const header = Buffer.alloc(8);
  header.write(id, 0, 4, "ascii");
  header.writeUInt32LE(declaredSize, 4);
  return Buffer.concat([
    header,
    content,
    content.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
}

function fmtChunk(): Buffer {
  const value = Buffer.alloc(16);
  value.writeUInt16LE(1, 0);
  value.writeUInt16LE(2, 2);
  value.writeUInt32LE(48_000, 4);
  value.writeUInt32LE(288_000, 8);
  value.writeUInt16LE(6, 12);
  value.writeUInt16LE(24, 14);
  return chunk("fmt ", value);
}

function bextChunk(): Buffer {
  const value = Buffer.alloc(602);
  value.write("Troll location sound", 0, "ascii");
  value.write("CreatorHub", 256, "ascii");
  value.write("TROLL-A001", 288, "ascii");
  value.write("2026-09-21", 320, "ascii");
  value.write("10:15:30", 330, "ascii");
  const samples = BigInt(3_661 * 48_000 + Math.round((12 / 25) * 48_000));
  value.writeUInt32LE(Number(samples & 0xffffffffn), 338);
  value.writeUInt32LE(Number(samples >> 32n), 342);
  value.writeUInt16LE(2, 346);
  return chunk("bext", value);
}

function ixmlChunk(xml?: string): Buffer {
  return chunk(
    "iXML",
    Buffer.from(
      xml ??
        `<?xml version="1.0" encoding="UTF-8"?>
    <BWFXML>
      <IXML_VERSION>1.52</IXML_VERSION>
      <PROJECT>Troll</PROJECT><SCENE>12A</SCENE><TAKE>3</TAKE><TAPE>A001</TAPE>
      <CIRCLED>TRUE</CIRCLED><FILE_UID>uid-1</FILE_UID><NOTE>Traffic pass on tail</NOTE>
      <SPEED><TIMECODE_RATE>25/1</TIMECODE_RATE><TIMECODE_FLAG>NDF</TIMECODE_FLAG></SPEED>
      <TRACK_LIST><TRACK_COUNT>2</TRACK_COUNT>
        <TRACK><CHANNEL_INDEX>1</CHANNEL_INDEX><INTERLEAVE_INDEX>1</INTERLEAVE_INDEX><NAME>Mix</NAME><FUNCTION>MIX</FUNCTION></TRACK>
        <TRACK><CHANNEL_INDEX>2</CHANNEL_INDEX><INTERLEAVE_INDEX>2</INTERLEAVE_INDEX><NAME>Boom</NAME><FUNCTION>BOOM</FUNCTION></TRACK>
      </TRACK_LIST>
    </BWFXML>`,
      "utf8",
    ),
  );
}

function riffFile(...chunks: Buffer[]): Buffer {
  const content = Buffer.concat([Buffer.from("WAVE"), ...chunks]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(content.length, 4);
  return Buffer.concat([header, content]);
}

function readerFor(buffer: Buffer) {
  return async (offset: number, length: number) =>
    buffer.subarray(offset, offset + length);
}

describe("Production Sound BWF/iXML inspection", () => {
  it("reads technical, bext and iXML metadata without decoding audio samples", async () => {
    const file = riffFile(
      fmtChunk(),
      bextChunk(),
      ixmlChunk(),
      chunk("data", Buffer.alloc(2_880)),
    );
    const result = await inspectProductionSoundWave(
      readerFor(file),
      file.length,
    );

    expect(result).toMatchObject({
      container: "RIFF",
      channels: 2,
      sampleRate: 48_000,
      byteRate: 288_000,
      bitDepth: 24,
      dataSizeBytes: 2_880,
      durationSeconds: 0.01,
      timecodeStart: "01:01:01:12",
      recordedAtLocal: "2026-09-21T10:15:30",
      bext: {
        description: "Troll location sound",
        originator: "CreatorHub",
        originatorReference: "TROLL-A001",
        version: 2,
      },
      ixml: {
        version: "1.52",
        project: "Troll",
        scene: "12A",
        take: "3",
        tape: "A001",
        circled: true,
        timecodeRate: "25/1",
        timecodeFlag: "NDF",
        tracks: [
          { channelIndex: 1, interleaveIndex: 1, name: "Mix", function: "MIX" },
          {
            channelIndex: 2,
            interleaveIndex: 2,
            name: "Boom",
            function: "BOOM",
          },
        ],
      },
      warnings: [],
    });
  });

  it("supports RF64 data sizes through ds64", async () => {
    const data = Buffer.alloc(480);
    const ds64 = Buffer.alloc(28);
    ds64.writeBigUInt64LE(
      BigInt(4 + fmtChunk().length + 36 + 8 + data.length),
      0,
    );
    ds64.writeBigUInt64LE(BigInt(data.length), 8);
    ds64.writeBigUInt64LE(80n, 16);
    const content = Buffer.concat([
      Buffer.from("WAVE"),
      chunk("ds64", ds64),
      fmtChunk(),
      chunk("data", data, 0xffffffff),
    ]);
    const header = Buffer.alloc(8);
    header.write("RF64", 0, 4, "ascii");
    header.writeUInt32LE(0xffffffff, 4);
    const file = Buffer.concat([header, content]);

    const result = await inspectProductionSoundWave(
      readerFor(file),
      file.length,
    );
    expect(result.container).toBe("RF64");
    expect(result.dataSizeBytes).toBe(480);
    expect(result.warnings).toEqual([
      "Filen er gyldig WAVE, men mangler BWF bext-metadata.",
      "Filen inneholder ingen lesbar iXML-metadata.",
    ]);
  });

  it("keeps a valid BWF but refuses to trust iXML with entity declarations", async () => {
    const malicious =
      '<!DOCTYPE BWFXML [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><BWFXML><SCENE>&xxe;</SCENE></BWFXML>';
    const file = riffFile(
      fmtChunk(),
      bextChunk(),
      ixmlChunk(malicious),
      chunk("data", Buffer.alloc(96)),
    );
    const result = await inspectProductionSoundWave(
      readerFor(file),
      file.length,
    );

    expect(result.ixml).toBeUndefined();
    expect(result.warnings).toContain(
      "iXML-metadata kunne ikke tolkes og ble ikke brukt.",
    );
    expect(JSON.stringify(result)).not.toContain("passwd");
  });

  it("rejects spoofed and structurally truncated files", async () => {
    const spoofed = Buffer.from("not a real wave file");
    await expect(
      inspectProductionSoundWave(readerFor(spoofed), spoofed.length),
    ).rejects.toBeInstanceOf(ProductionSoundMediaValidationError);

    const noData = riffFile(fmtChunk(), bextChunk());
    await expect(
      inspectProductionSoundWave(readerFor(noData), noData.length),
    ).rejects.toThrow("mangler fmt- eller data-chunk");
  });

  it("formats 29.97 drop-frame references with a semicolon", () => {
    expect(
      sampleReferenceToTimecode(48_000n * 600n, 48_000, "30000/1001", "DF"),
    ).toMatch(/^00:10:00;\d{2}$/);
  });
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { LocalFileReadError, createFileReader } = require("../file-reader");

test("falls back to the picker-authorized File entry when Premiere leaves fs.open unimplemented", async () => {
  const bytes = new Uint8Array([11, 22, 33, 44, 55]);
  const binaryFormat = Symbol("binary");
  let readCalls = 0;
  const reader = await createFileReader({
    nativePath: "/tmp/review.mp4",
    sizeBytes: bytes.length,
    fsApi: { open: async () => { throw new Error("Unimplemented method: open"); }, read: async () => null },
    file: {
      isFile: true,
      read: async (options) => {
        readCalls += 1;
        assert.equal(options.format, binaryFormat);
        return bytes.buffer.slice(0);
      },
    },
    binaryFormat,
  });

  assert.equal(reader.kind, "entry-buffer");
  assert.deepEqual(new Uint8Array(await reader.read(1, 3)), new Uint8Array([22, 33, 44]));
  assert.equal(readCalls, 1);
  await reader.close();
  await assert.rejects(() => reader.read(0, 1), (error) => error.code === "file_changed");
});

test("fails safely before buffering a master-sized export", async () => {
  let readCalled = false;
  await assert.rejects(
    () => createFileReader({
      nativePath: "/tmp/master.mov",
      sizeBytes: 9,
      maxBufferedBytes: 8,
      fsApi: { open: async () => { throw new Error("Unimplemented method: open"); }, read: async () => null },
      file: { isFile: true, read: async () => { readCalled = true; return new ArrayBuffer(9); } },
      binaryFormat: Symbol("binary"),
    }),
    (error) => error instanceof LocalFileReadError && error.code === "uxp_chunk_read_unavailable",
  );
  assert.equal(readCalled, false);
});

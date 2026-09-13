"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("every statically referenced panel element exists in the manifest HTML", () => {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "index.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const referenced = new Set(Array.from(source.matchAll(/\bel\("([^"]+)"\)/g), (match) => match[1]));
  const declared = new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]));
  const missing = [...referenced].filter((id) => !declared.has(id));
  assert.deepEqual(missing, []);
});

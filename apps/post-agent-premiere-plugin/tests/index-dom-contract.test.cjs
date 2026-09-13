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

test("the full panel remains reachable at the minimum UXP window height", () => {
  const root = path.resolve(__dirname, "..");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  assert.match(css, /html,\s*body\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.panel\s*\{[^}]*height:\s*100%[^}]*overflow-y:\s*auto/s);
});

test("the manifest requests picker-scoped filesystem access", () => {
  const root = path.resolve(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

  assert.equal(manifest.requiredPermissions.localFileSystem, "request");
  assert.notEqual(manifest.requiredPermissions.localFileSystem, "fullAccess");
  assert.ok(manifest.requiredPermissions.network.domains.includes("https://*.amazonaws.com"));
  assert.ok(manifest.requiredPermissions.network.domains.includes("https://*.backblazeb2.com"));
});

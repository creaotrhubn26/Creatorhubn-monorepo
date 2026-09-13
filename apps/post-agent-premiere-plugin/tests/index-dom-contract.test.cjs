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

test("panel ids and top-level tab relationships are unique and complete", () => {
  const root = path.resolve(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]);
  const tabTags = Array.from(html.matchAll(/<button\b[^>]*data-workspace-tab[^>]*>/g), (match) => match[0]);
  const controls = tabTags.map((tag) => [
    tag.match(/data-workspace-tab="([^"]+)"/)[1],
    tag.match(/aria-controls="([^"]+)"/)[1],
  ]);

  assert.equal(new Set(ids).size, ids.length, "every panel id must be unique");
  assert.deepEqual(
    controls,
    [
      ["review", "workspace-pane-review"],
      ["sync", "workspace-pane-sync"],
      ["publish", "workspace-pane-publish"],
      ["activity", "workspace-pane-activity"],
    ],
  );
  for (const [, controlledId] of controls) assert.ok(ids.includes(controlledId));
});

test("the full panel remains reachable at the minimum UXP window height", () => {
  const root = path.resolve(__dirname, "..");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  assert.match(css, /html,\s*body\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.panel\s*\{[^}]*height:\s*100%[^}]*overflow-y:\s*auto/s);
});

test("the editorial workspace separates review, sync, publish and activity", () => {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "index.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const tabs = Array.from(html.matchAll(/data-workspace-tab="([^"]+)"/g), (match) => match[1]);
  const panes = Array.from(html.matchAll(/data-workspace-pane="([^"]+)"/g), (match) => match[1]);

  assert.deepEqual(tabs, ["review", "sync", "publish", "activity"]);
  assert.deepEqual(panes, tabs);
  assert.match(html, /class="workspace-tabs hidden" role="tablist"/);
  assert.equal((html.match(/role="tabpanel" data-workspace-pane=/g) || []).length, 4);
  assert.match(source, /function activateWorkspaceTab\(/);
  assert.match(source, /\["ArrowLeft", "ArrowRight"\]/);
  assert.match(css, /\.workspace-tabs\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /button:focus-visible[^{]*\{[^}]*outline:/s);
  assert.doesNotMatch(css, /display:\s*grid/, "Premiere 26.5 UXP collapses CSS Grid containers");
});

test("sync and publishing expose adjacent readiness guidance", () => {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "index.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

  assert.match(html, /id="sync-eligibility-note" class="readiness-note"/);
  assert.match(html, /id="publish-readiness" class="readiness-note"/);
  assert.match(source, /setReadiness\("sync-eligibility-note"/);
  assert.match(source, /setReadiness\("publish-readiness"/);
  assert.match(source, /sendButton\.classList\.toggle\("primary", !publishCheckpoint\)/);
});

test("the manifest requests picker-scoped filesystem access", () => {
  const root = path.resolve(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

  assert.equal(manifest.requiredPermissions.localFileSystem, "request");
  assert.notEqual(manifest.requiredPermissions.localFileSystem, "fullAccess");
  assert.ok(manifest.requiredPermissions.network.domains.includes("https://*.amazonaws.com"));
  assert.ok(manifest.requiredPermissions.network.domains.includes("https://*.backblazeb2.com"));
});

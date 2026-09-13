"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildVerificationUrl,
  cloudMarkerPresentation,
  createReconciliationPlan,
  decodeManagedComment,
  markerSnapshotSignature,
  premiereMarkersToVideoRoom,
} = require("../sync-core");

test("verification links are restricted to CreatorHub-owned HTTPS hosts", () => {
  assert.equal(
    buildVerificationUrl("https://theroleroom.com/link", "ABC 123"),
    "https://theroleroom.com/link?code=ABC%20123",
  );
  assert.throws(() => buildVerificationUrl("https://creatorhubn.com.evil.example/link", "ABC123"));
  assert.throws(() => buildVerificationUrl("http://creatorhubn.com/link", "ABC123"));
});

test("canonical id, must-fix and completion round-trip through Premiere metadata", () => {
  const desired = cloudMarkerPresentation({
    id: "creatorhub:550e8400-e29b-41d4-a716-446655440000",
    timecodeSec: 12.5,
    title: "Bytt musikk",
    note: "Bruk den godkjente låten",
    mustFix: true,
  });
  assert.equal(desired.name, "[MÅ FIKSES] Bytt musikk");
  assert.deepEqual(decodeManagedComment(desired.comments), {
    id: "creatorhub:550e8400-e29b-41d4-a716-446655440000",
    note: "Bruk den godkjente låten",
  });
  const [mapped] = premiereMarkersToVideoRoom([{
    name: "[FERDIG] Bytt musikk",
    comments: desired.comments,
    startSeconds: 12.5,
    startTicks: "1000",
    colorName: "Green",
  }], "sequence-guid");
  assert.equal(mapped.id, "creatorhub:550e8400-e29b-41d4-a716-446655440000");
  assert.equal(mapped.completed, true);
});

test("native marker ids are deterministic inside one Premiere sequence", () => {
  const marker = {
    name: "Stabiliser bildet",
    comments: "Rister etter klipp",
    startSeconds: 4,
    startTicks: "1016064000000",
    colorName: "Red",
  };
  const first = premiereMarkersToVideoRoom([marker], "sequence-a")[0];
  const second = premiereMarkersToVideoRoom([marker], "sequence-a")[0];
  assert.match(first.id, /^premiere-native:/);
  assert.equal(first.id, second.id);
  assert.equal(first.mustFix, true);
});

test("reconciliation adopts exact native markers, removes only managed tombstones and reports collisions", () => {
  const stale = {
    name: "Gammel",
    comments: "[[creatorhub:id=creatorhub:deleted]]",
    startSeconds: 1,
    startTicks: "1",
    colorName: "Blue",
  };
  const adoptable = {
    name: "Ny kommentar",
    comments: "Detalj",
    startSeconds: 2,
    startTicks: "2",
    colorName: "Blue",
  };
  const collision = {
    name: "Privat markør",
    comments: "Skal bevares",
    startSeconds: 3,
    startTicks: "3",
    colorName: "Yellow",
  };
  const plan = createReconciliationPlan([stale, adoptable, collision], [
    { id: "creatorhub:new", timecodeSec: 2, title: "Ny kommentar", note: "Detalj" },
    { id: "creatorhub:collision", timecodeSec: 3, title: "Annen kommentar", note: "Annet" },
  ]);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].current, adoptable);
  assert.deepEqual(plan.removals, [stale]);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.additions.length, 0);
});

test("marker signatures ignore backend ordering", () => {
  const a = { id: "a", timecodeSec: 1, title: "A" };
  const b = { id: "b", timecodeSec: 2, title: "B" };
  assert.equal(markerSnapshotSignature([a, b]), markerSnapshotSignature([b, a]));
});

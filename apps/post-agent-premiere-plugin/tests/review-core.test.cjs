"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildVideoRoomUrl,
  collaborationSummary,
  formatTimecode,
  itemTimecode,
  normalizeCollaboration,
} = require("../review-core");

test("normalizes incomplete collaboration payloads and summarizes open work", () => {
  const data = normalizeCollaboration({
    comments: [
      { id: "root", status: "open", parentId: null },
      { id: "reply", status: "open", parentId: "root" },
      { id: "resolved", status: "resolved", parentId: null },
    ],
    tasks: [{ status: "todo" }, { status: "done" }],
    approvalSteps: [{ status: "approved" }, { status: "in_review" }],
    rounds: [{ round_number: 2, status: "open" }],
  });
  const summary = collaborationSummary(data);

  assert.equal(summary.openComments, 1);
  assert.equal(summary.openTasks, 1);
  assert.equal(summary.totalTasks, 2);
  assert.equal(summary.approvedSteps, 1);
  assert.equal(summary.activeRound.round_number, 2);
  assert.deepEqual(data.transcript, []);
});

test("formats timecodes and accepts backend or panel time fields", () => {
  assert.equal(formatTimecode(65.25), "01:05.250");
  assert.equal(formatTimecode(3661), "01:01:01");
  assert.equal(itemTimecode({ timecode_sec: "4.5" }), 4.5);
  assert.equal(itemTimecode({ playhead_sec: 9 }), 9);
  assert.equal(itemTimecode({}), null);
});

test("builds an owned HTTPS Video Room link for the exact selected version", () => {
  assert.equal(
    buildVideoRoomUrl("project/one", "version two"),
    "https://www.creatorhubn.com/workspace/project%2Fone/video-room?versionId=version+two",
  );
});

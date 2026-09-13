"use strict";

const CREATORHUB_ORIGIN = "https://www.creatorhubn.com";

function array(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (fallback === undefined ? 0 : fallback);
}

function emptyCollaboration() {
  return {
    viewerUserId: "",
    comments: [],
    tasks: [],
    rounds: [],
    approvalSteps: [],
    transcript: [],
    captions: [],
    qc: [],
    liveSession: null,
    members: [],
  };
}

function normalizeCollaboration(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    viewerUserId: String(source.viewerUserId || ""),
    comments: array(source.comments),
    tasks: array(source.tasks),
    rounds: array(source.rounds),
    approvalSteps: array(source.approvalSteps),
    transcript: array(source.transcript),
    captions: array(source.captions),
    qc: array(source.qc),
    liveSession: source.liveSession && typeof source.liveSession === "object" ? source.liveSession : null,
    members: array(source.members),
  };
}

function collaborationSummary(collaboration) {
  const data = normalizeCollaboration(collaboration);
  const openTasks = data.tasks.filter((task) => task.status !== "done").length;
  const openComments = data.comments.filter((comment) =>
    !comment.parentId && comment.status !== "resolved" && comment.status !== "archived"
  ).length;
  const approvedSteps = data.approvalSteps.filter((step) => step.status === "approved").length;
  const activeRound = data.rounds.find((round) => round.status === "open") || null;
  return {
    openTasks,
    totalTasks: data.tasks.length,
    openComments,
    approvedSteps,
    totalApprovalSteps: data.approvalSteps.length,
    activeRound,
  };
}

function formatTimecode(value) {
  const totalMilliseconds = Math.max(0, Math.round(number(value) * 1000));
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = totalMilliseconds % 1000;
  const pad = (part) => String(part).padStart(2, "0");
  const base = hours ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return milliseconds ? `${base}.${String(milliseconds).padStart(3, "0")}` : base;
}

function itemTimecode(item) {
  if (!item || typeof item !== "object") return null;
  const raw = item.timecodeSec ?? item.timecode_sec ?? item.startSec ?? item.start_sec ?? item.playheadSec ?? item.playhead_sec;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function buildVideoRoomUrl(projectId, versionId) {
  const project = encodeURIComponent(String(projectId || ""));
  if (!project) throw new Error("Velg et CreatorHub-prosjekt først.");
  const url = new URL(`/workspace/${project}/video-room`, CREATORHUB_ORIGIN);
  if (versionId) url.searchParams.set("versionId", String(versionId));
  return url.toString();
}

module.exports = {
  CREATORHUB_ORIGIN,
  buildVideoRoomUrl,
  collaborationSummary,
  emptyCollaboration,
  formatTimecode,
  itemTimecode,
  normalizeCollaboration,
};

"use strict";

const ppro = require("premierepro");
const { entrypoints, shell, storage } = require("uxp");
const fs = require("fs");
const { API_ORIGIN, ApiError, createApiClient } = require("./api-client");
const { createPremiereHost } = require("./premiere-host");
const {
  buildExportFileName,
  contentTypeForExtension,
  validateUploadTicket,
} = require("./publish-core");
const { TusUploadError, uploadFileTus } = require("./tus-upload");
const {
  buildVerificationUrl,
  markerSnapshotSignature,
  premiereMarkersToVideoRoom,
} = require("./sync-core");
const {
  buildVideoRoomUrl,
  collaborationSummary,
  emptyCollaboration,
  formatTimecode,
  itemTimecode,
  normalizeCollaboration,
} = require("./review-core");

const TOKEN_KEY = "creatorhub.video-room.bearer";
const CONFIG_KEY = "creatorhub.video-room.premiere-sync";
const PUBLISH_PREFS_KEY = "creatorhub.video-room.premiere-publish-prefs";
const PUBLISH_CHECKPOINT_KEY = "creatorhub.video-room.premiere-publish-checkpoint";
const SYNC_INTERVAL_MS = 8000;
const MAX_PAIRING_MS = 10 * 60 * 1000;
const REVIEW_INTERVAL_MS = 10000;

const api = createApiClient();
const premiere = createPremiereHost(ppro);

let token = "";
let projects = [];
let config = loadConfig();
let pairing = null;
let pairingTimer = null;
let pairingGeneration = 0;
let syncTimer = null;
let syncRunning = false;
let syncGeneration = 0;
let connectedKey = "";
let lastLocalSignature = "";
let collaboration = emptyCollaboration();
let reviewTimer = null;
let reviewGeneration = 0;
let reviewLoading = false;
let activeReviewTab = "feedback";
let replyingToId = "";
let editingCommentId = "";
let transcriptQuery = "";
let approvalInvitations = [];
let publishPrefs = {};
let publishCheckpoint = null;
let publishPresetFile = null;
let publishOutputFolder = null;
let publishRunning = false;

const el = (id) => document.getElementById(id);

function loadConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    return {
      enabled: parsed.enabled === true,
      projectId: String(parsed.projectId || ""),
      projectName: String(parsed.projectName || ""),
      versionId: String(parsed.versionId || ""),
      versionLabel: String(parsed.versionLabel || ""),
      premiereProjectGuid: String(parsed.premiereProjectGuid || ""),
      premiereProjectName: String(parsed.premiereProjectName || ""),
      premiereSequenceGuid: String(parsed.premiereSequenceGuid || ""),
      premiereSequenceName: String(parsed.premiereSequenceName || ""),
    };
  } catch (_) {
    return null;
  }
}

function saveConfig() {
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  else localStorage.removeItem(CONFIG_KEY);
}

function decodeSecureValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return Array.from(value).map((byte) => String.fromCharCode(byte)).join("");
}

async function loadToken() {
  try {
    token = decodeSecureValue(await storage.secureStorage.getItem(TOKEN_KEY)).trim();
  } catch (_) {
    token = "";
  }
  return token;
}

async function storeToken(value) {
  await storage.secureStorage.setItem(TOKEN_KEY, value);
  token = value;
}

async function clearToken() {
  try { await storage.secureStorage.removeItem(TOKEN_KEY); }
  catch (_) { /* already removed */ }
  token = "";
}

async function loadSecureJson(key) {
  try {
    const raw = decodeSecureValue(await storage.secureStorage.getItem(key));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

async function storeSecureJson(key, value) {
  if (value == null) {
    await storage.secureStorage.removeItem(key).catch(() => undefined);
    return;
  }
  await storage.secureStorage.setItem(key, JSON.stringify(value));
}

async function loadPublishState() {
  publishPrefs = await loadSecureJson(PUBLISH_PREFS_KEY) || {};
  publishCheckpoint = await loadSecureJson(PUBLISH_CHECKPOINT_KEY);
  publishPresetFile = publishPrefs.presetToken
    ? await storage.localFileSystem.getEntryForPersistentToken(publishPrefs.presetToken).catch(() => null)
    : null;
  publishOutputFolder = publishPrefs.folderToken
    ? await storage.localFileSystem.getEntryForPersistentToken(publishPrefs.folderToken).catch(() => null)
    : null;
  if (!publishPresetFile) delete publishPrefs.presetToken;
  if (!publishOutputFolder) delete publishPrefs.folderToken;
}

async function savePublishPrefs() {
  await storeSecureJson(PUBLISH_PREFS_KEY, publishPrefs);
}

async function savePublishCheckpoint(value) {
  publishCheckpoint = value;
  await storeSecureJson(PUBLISH_CHECKPOINT_KEY, value);
  renderPublishControls();
}

function setVisible(id, visible) {
  el(id).classList.toggle("hidden", !visible);
}

function log(message, kind) {
  const row = document.createElement("div");
  row.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (kind) row.classList.add(kind);
  el("log").appendChild(row);
  while (el("log").children.length > 80) el("log").removeChild(el("log").firstChild);
  el("log").scrollTop = el("log").scrollHeight;
  setVisible("log-card", true);
}

function setConnection(label, tone) {
  const pill = el("connection-pill");
  pill.textContent = label;
  pill.className = `pill ${tone || "muted"}`;
}

function setStatus(title, message, tone, meta) {
  const card = el("status-card");
  card.className = `status-card ${tone || ""}`.trim();
  el("status-title").textContent = title;
  el("status-message").textContent = message;
  el("status-meta").textContent = meta || "";
  setVisible("status-card", true);
}

function setPublishProgress(percent, label) {
  const progress = el("publish-progress");
  const text = el("publish-progress-label");
  progress.value = Math.max(0, Math.min(100, Number(percent) || 0));
  text.textContent = label || "";
  setVisible("publish-progress", Boolean(label));
  setVisible("publish-progress-label", Boolean(label));
}

function renderPublishControls() {
  if (!el("publish-preset-name")) return;
  el("publish-preset-name").textContent = publishPresetFile?.name || publishPrefs.presetName || "Ikke valgt";
  el("publish-folder-name").textContent = publishOutputFolder?.name || publishPrefs.folderName || "Ikke valgt";
  const project = selectedProject();
  el("send-review-button").disabled = publishRunning || !token || !project || !project.canEdit;
  el("choose-preset-button").disabled = publishRunning;
  el("choose-folder-button").disabled = publishRunning;
  el("resume-upload-button").disabled = publishRunning;
  setVisible("resume-upload-button", Boolean(publishCheckpoint));
}

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function createButton(label, handler, className) {
  const button = createNode("button", className || "", label);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function createBadge(label, tone) {
  return createNode("span", `badge ${tone || ""}`.trim(), label);
}

function replaceChildren(id, children, emptyMessage) {
  const container = el(id);
  container.textContent = "";
  if (!children.length && emptyMessage) {
    container.appendChild(createNode("div", "empty-state", emptyMessage));
    return;
  }
  for (const child of children) container.appendChild(child);
}

function renderAuthState() {
  const signedIn = Boolean(token);
  setVisible("auth-card", !signedIn);
  setVisible("workspace-card", signedIn);
  setVisible("premiere-card", signedIn);
  setVisible("review-card", signedIn && Boolean(selectedVersion()));
  setVisible("disconnect-button", signedIn);
  setConnection(signedIn ? (config && config.enabled ? "Synk aktiv" : "Tilkoblet") : "Frakoblet", signedIn ? "ok" : "muted");
}

function option(value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  return node;
}

function selectedProject() {
  return projects.find((project) => project.id === el("project-select").value) || null;
}

function selectedVersion() {
  const project = selectedProject();
  return project ? project.versions.find((version) => version.id === el("version-select").value) || null : null;
}

function renderVersions(preferredVersionId) {
  const select = el("version-select");
  select.textContent = "";
  const project = selectedProject();
  for (const version of project ? project.versions : []) {
    select.appendChild(option(version.id, `${version.label} · ${version.status || "ukjent status"}`));
  }
  if (preferredVersionId && Array.from(select.options).some((candidate) => candidate.value === preferredVersionId)) {
    select.value = preferredVersionId;
  }
  if (config && config.enabled && project && project.id === config.projectId &&
      !project.versions.some((version) => version.id === config.versionId)) {
    config.enabled = false;
    saveConfig();
    stopSyncTimer();
    setStatus("Synk stoppet", "Den valgte Video Room-versjonen er ikke lenger tilgjengelig.", "warn");
  }
  el("access-note").textContent = project && !project.canEdit
    ? "Du har lesetilgang. Kommentarer er tilgjengelige, mens oppgaver og workflow krever editor-tilgang."
    : project && !project.versions.length
      ? "Prosjektet er klart for V1 direkte fra en aktiv Premiere-sekvens."
      : "Review-data, oppgaver og native markører er bundet til denne eksakte versjonen.";
  const defaultLabel = `V${Math.max(0, ...(project ? project.versions.map((version) => Number(version.number) || 0) : [])) + 1}`;
  if (!el("publish-version-label").value || /^V\d+$/i.test(el("publish-version-label").value.trim())) {
    el("publish-version-label").value = defaultLabel;
  }
  setVisible("review-card", Boolean(token && selectedVersion()));
  renderButtons();
  renderReview();
}

function renderProjects() {
  const select = el("project-select");
  select.textContent = "";
  for (const project of projects) {
    select.appendChild(option(project.id, project.name));
  }
  const configuredProject = config ? projects.find((project) => project.id === config.projectId) : null;
  if (configuredProject) {
    select.value = config.projectId;
  }
  if (config && config.enabled && (!configuredProject || !configuredProject.canEdit)) {
    config.enabled = false;
    saveConfig();
    stopSyncTimer();
    setStatus("Synk stoppet", "Editor-tilgangen til det valgte prosjektet er ikke lenger aktiv.", "warn");
  }
  renderVersions(config ? config.versionId : "");
}

function renderButtons() {
  const active = Boolean(config && config.enabled);
  const project = selectedProject();
  el("start-sync-button").disabled = active || !project || !project.canEdit || !selectedVersion();
  el("sync-now-button").disabled = !active || syncRunning;
  el("project-select").disabled = active;
  el("version-select").disabled = active;
  setVisible("start-sync-button", !active);
  setVisible("stop-sync-button", active);
  setConnection(token ? (active ? "Synk aktiv" : "Tilkoblet") : "Frakoblet", token ? "ok" : "muted");
  renderPublishControls();
}

function selectedMember() {
  const selected = el("assignee-select").value;
  const member = collaboration.members.find((candidate) =>
    String(candidate.user_id || candidate.userId || candidate.email || "") === selected
  );
  if (member) return member;
  return selected && selected === collaboration.viewerUserId
    ? { user_id: selected, name: "Innlogget editor" }
    : null;
}

function renderAssignees() {
  const select = el("assignee-select");
  const previous = select.value;
  select.textContent = "";
  select.appendChild(option("", "Ikke tildelt"));
  const memberIds = new Set();
  for (const member of collaboration.members) {
    const value = String(member.user_id || member.userId || member.email || "");
    if (!value) continue;
    memberIds.add(value);
    select.appendChild(option(value, member.name || member.email || "Teammedlem"));
  }
  if (collaboration.viewerUserId && !memberIds.has(collaboration.viewerUserId)) {
    select.appendChild(option(collaboration.viewerUserId, "Meg (innlogget editor)"));
  }
  if (previous && Array.from(select.options).some((candidate) => candidate.value === previous)) {
    select.value = previous;
  } else if (collaboration.viewerUserId && Array.from(select.options).some((candidate) => candidate.value === collaboration.viewerUserId)) {
    select.value = collaboration.viewerUserId;
  }
}

function renderReviewTabs() {
  for (const tab of document.querySelectorAll("[data-review-tab]")) {
    tab.classList.toggle("active", tab.dataset.reviewTab === activeReviewTab);
  }
  for (const pane of document.querySelectorAll("[data-review-pane]")) {
    pane.classList.toggle("hidden", pane.dataset.reviewPane !== activeReviewTab);
  }
}

function renderComments() {
  const project = selectedProject();
  const comments = collaboration.comments.slice().sort((a, b) =>
    (itemTimecode(a) || 0) - (itemTimecode(b) || 0) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
  );
  const rows = comments.map((comment) => {
    const row = createNode("article", `item${comment.parentId ? " reply" : ""}`);
    const head = createNode("div", "item-head");
    const time = itemTimecode(comment);
    head.appendChild(createNode("span", "timecode", formatTimecode(time)));
    const tags = createNode("div", "item-actions");
    if (comment.isDecision) tags.appendChild(createBadge("Beslutning", "in_review"));
    tags.appendChild(createBadge(comment.priority || "forslag", comment.priority));
    tags.appendChild(createBadge(comment.status || "open", comment.status));
    head.appendChild(tags);
    row.appendChild(head);
    row.appendChild(createNode("div", "item-title", comment.authorName || comment.authorKind || "CreatorHub"));
    row.appendChild(createNode("div", "item-body", comment.comment || ""));
    row.appendChild(createNode("div", "item-meta", comment.category || "annet"));
    const actions = createNode("div", "item-actions");
    actions.appendChild(createButton("Gå til", () => void seekToItem(comment)));
    actions.appendChild(createButton("Svar", () => beginReply(comment)));
    if (project && project.canEdit) {
      actions.appendChild(createButton("Rediger", () => beginEdit(comment)));
      actions.appendChild(createButton(
        comment.status === "resolved" ? "Gjenåpne" : "Løs",
        () => void updateCommentStatus(comment),
      ));
      if (comment.priority === "must-fix" && !comment.taskId && !comment.parentId) {
        actions.appendChild(createButton("Lag oppgave", () => void createTaskFromComment(comment), "primary"));
      }
    }
    row.appendChild(actions);
    return row;
  });
  replaceChildren("comments-list", rows, "Ingen kommentarer på denne versjonen.");
}

function taskAssigneeLabel(task) {
  return task.assigned_to_name || task.assignedToName || task.assigned_to_email || task.assignedToEmail || "Ikke tildelt";
}

function renderTasks() {
  const project = selectedProject();
  const rows = collaboration.tasks.map((task) => {
    const row = createNode("article", "item");
    const head = createNode("div", "item-head");
    const time = itemTimecode(task);
    head.appendChild(createNode("span", "timecode", time == null ? "Uten tidskode" : formatTimecode(time)));
    head.appendChild(createBadge(task.status || "todo", task.status));
    row.appendChild(head);
    row.appendChild(createNode("div", "item-title", task.title || "Editoroppgave"));
    row.appendChild(createNode("div", "item-meta", `${taskAssigneeLabel(task)} · ${task.priority || "must-fix"}`));
    const actions = createNode("div", "item-actions");
    if (time != null) actions.appendChild(createButton("Gå til", () => void seekToItem(task)));
    if (project && project.canEdit) {
      for (const [status, label] of [["todo", "Åpen"], ["in_progress", "Pågår"], ["blocked", "Blokkert"], ["done", "Ferdig"]]) {
        if (task.status !== status) actions.appendChild(createButton(label, () => void updateTaskStatus(task, status)));
      }
      actions.appendChild(createButton("Tildel valgt editor", () => void assignTask(task)));
    }
    row.appendChild(actions);
    return row;
  });
  replaceChildren("tasks-list", rows, "Ingen editoroppgaver på denne versjonen.");
}

function renderRounds() {
  const project = selectedProject();
  const rows = collaboration.rounds.map((round) => {
    const row = createNode("article", "item");
    const head = createNode("div", "item-head");
    head.appendChild(createNode("span", "item-title", round.name || `Runde ${round.round_number}`));
    head.appendChild(createBadge(round.status || "open", round.status));
    row.appendChild(head);
    row.appendChild(createNode("div", "item-meta", `Runde ${round.round_number || "–"} av ${round.max_rounds || "∞"}`));
    if (project && project.canEdit && round.status === "open") {
      const actions = createNode("div", "item-actions");
      actions.appendChild(createButton("Lukk runden", () => void closeReviewRound(round)));
      row.appendChild(actions);
    }
    return row;
  });
  replaceChildren("rounds-list", rows, "Ingen revisjonsrunde er opprettet.");
}

function renderApprovals() {
  const rows = collaboration.approvalSteps.map((step) => {
    const row = createNode("article", "item");
    const approved = (step.approvers || []).filter((person) => person.status === "approved").length;
    const head = createNode("div", "item-head");
    head.appendChild(createNode("span", "item-title", `${Number(step.order || 0) + 1}. ${step.name || "Godkjenning"}`));
    head.appendChild(createBadge(step.status || "pending", step.status));
    row.appendChild(head);
    row.appendChild(createNode("div", "item-meta", `${approved}/${step.requiredApprovals || 1} godkjenninger`));
    for (const person of step.approvers || []) {
      row.appendChild(createNode("div", "item-meta", `${person.name || person.email} · ${person.status}`));
    }
    return row;
  });
  replaceChildren("approvals-list", rows, "Ingen formelle approval-steg.");

  const invitationBox = el("approval-invitations");
  invitationBox.textContent = "";
  setVisible("approval-invitations", approvalInvitations.length > 0);
  if (approvalInvitations.length) {
    invitationBox.appendChild(createNode("span", "", "Nye approval-lenker:"));
    for (const invitation of approvalInvitations) {
      invitationBox.appendChild(createButton(invitation.email || "Åpne", () => void openApprovalInvitation(invitation), "quiet"));
    }
  }
}

function renderTranscriptAndQc() {
  replaceChildren("captions-list", collaboration.captions.map((caption) =>
    createBadge(`${String(caption.language || "").toUpperCase()} · ${caption.status}`, caption.status)
  ));
  const transcriptRows = collaboration.transcript.map((segment) => {
    const row = createNode("article", "item transcript-item");
    row.appendChild(createNode("span", "timecode", formatTimecode(itemTimecode(segment))));
    row.appendChild(createNode("span", "", segment.text || ""));
    row.addEventListener("click", () => void seekToItem(segment));
    return row;
  });
  replaceChildren("transcript-list", transcriptRows, transcriptQuery ? "Ingen treff i transkripsjonen." : "Ingen transkripsjon ennå.");

  const qcRows = [];
  const latest = collaboration.qc[0];
  if (latest) {
    const summary = latest.summary || {};
    const row = createNode("article", "item");
    const head = createNode("div", "item-head");
    head.appendChild(createNode("span", "item-title", `QC · ${latest.profile || "leveranse"}`));
    head.appendChild(createBadge(latest.status || "running", latest.status));
    row.appendChild(head);
    row.appendChild(createNode("div", "item-meta", `${summary.findingCount || 0} funn${summary.integratedLufs != null ? ` · ${Number(summary.integratedLufs).toFixed(1)} LUFS` : ""}`));
    qcRows.push(row);
    for (const finding of Array.isArray(latest.findings) ? latest.findings.slice(0, 20) : []) {
      const findingRow = createNode("article", "item");
      const findingTime = itemTimecode(finding);
      const findingHead = createNode("div", "item-head");
      findingHead.appendChild(createNode("span", "timecode", findingTime == null ? "QC" : formatTimecode(findingTime)));
      findingHead.appendChild(createBadge(finding.severity || "info", finding.severity));
      findingRow.appendChild(findingHead);
      findingRow.appendChild(createNode("div", "item-body", finding.message || finding.code || "Teknisk funn"));
      if (findingTime != null) findingRow.addEventListener("click", () => void seekToItem(finding));
      qcRows.push(findingRow);
    }
  }
  replaceChildren("qc-list", qcRows, "Ingen QC er kjørt på denne versjonen.");
}

function renderLive() {
  const live = collaboration.liveSession;
  setVisible("live-empty", !live);
  setVisible("live-session", Boolean(live));
  if (!live) return;
  el("live-revision").textContent = `rev. ${live.revision || 0}`;
  el("live-position").textContent = `Delt playhead ${formatTimecode(live.playhead_sec)}`;
  const project = selectedProject();
  el("end-live-button").disabled = !project || !project.canEdit;
}

function renderReview() {
  const version = selectedVersion();
  setVisible("review-card", Boolean(token && version));
  if (!token || !version) return;
  const summary = collaborationSummary(collaboration);
  el("metric-comments").textContent = String(summary.openComments);
  el("metric-tasks").textContent = `${summary.openTasks}/${summary.totalTasks}`;
  el("metric-round").textContent = summary.activeRound ? String(summary.activeRound.round_number || "aktiv") : "–";
  el("metric-approvals").textContent = `${summary.approvedSteps}/${summary.totalApprovalSteps}`;
  const project = selectedProject();
  const canEdit = Boolean(project && project.canEdit);
  for (const id of ["create-round-button", "create-approval-button", "generate-transcript-button", "run-qc-button", "start-live-button"]) {
    el(id).disabled = !canEdit;
  }
  renderAssignees();
  renderReviewTabs();
  renderComments();
  renderTasks();
  renderRounds();
  renderApprovals();
  renderTranscriptAndQc();
  renderLive();
}

function stopReviewTimer() {
  reviewGeneration += 1;
  if (reviewTimer) clearInterval(reviewTimer);
  reviewTimer = null;
}

function startReviewTimer() {
  if (reviewTimer) clearInterval(reviewTimer);
  reviewTimer = null;
  if (!token || !selectedVersion()) return;
  reviewTimer = setInterval(() => void refreshCollaboration(true), REVIEW_INTERVAL_MS);
}

function resetReviewState() {
  reviewGeneration += 1;
  reviewLoading = false;
  collaboration = emptyCollaboration();
  replyingToId = "";
  editingCommentId = "";
  transcriptQuery = "";
  approvalInvitations = [];
  if (el("comment-text")) el("comment-text").value = "";
  if (el("transcript-search")) el("transcript-search").value = "";
  renderComposerMode();
  renderReview();
}

async function refreshCollaboration(silent) {
  if (reviewLoading || !token) return;
  const project = selectedProject();
  const version = selectedVersion();
  if (!project || !version) {
    resetReviewState();
    return;
  }
  const bearer = token;
  const key = `${project.id}:${version.id}`;
  const generation = reviewGeneration;
  reviewLoading = true;
  el("refresh-review-button").disabled = true;
  try {
    const response = await api.fetchCollaboration(bearer, project.id, version.id, transcriptQuery);
    const currentProject = selectedProject();
    const currentVersion = selectedVersion();
    if (generation !== reviewGeneration || bearer !== token || !currentProject || !currentVersion ||
        `${currentProject.id}:${currentVersion.id}` !== key) return;
    collaboration = normalizeCollaboration(response);
    renderReview();
    if (!silent) log(`Review-data oppdatert for ${version.label}.`, "ok");
  } catch (error) {
    if (!await handleAuthError(error, bearer) && !silent) {
      setStatus("Kunne ikke hente review-data", error.message || String(error), "bad");
      log(error.message || String(error), "bad");
    }
  } finally {
    reviewLoading = false;
    el("refresh-review-button").disabled = false;
  }
}

async function runReviewMutation(progressTitle, operation, successMessage) {
  const bearer = token;
  if (!bearer) return null;
  try {
    setStatus(progressTitle, "Oppdaterer valgt Video Room-versjon…", "warn");
    const result = await operation(bearer);
    await refreshCollaboration(true);
    const outcome = typeof successMessage === "function" ? successMessage(result) : { message: successMessage };
    setStatus(outcome.title || "Video Room oppdatert", outcome.message || "Endringen er lagret.", outcome.tone || "ok");
    return result;
  } catch (error) {
    if (!await handleAuthError(error, bearer)) {
      setStatus("Kunne ikke oppdatere Video Room", error.message || String(error), "bad");
      log(error.message || String(error), "bad");
    }
    return null;
  }
}

async function seekToItem(item) {
  const seconds = itemTimecode(item);
  if (seconds == null) return;
  try {
    await premiere.setPlayheadSeconds(seconds);
    el("comment-playhead").textContent = `Premiere-playhead ${formatTimecode(seconds)}`;
  } catch (error) {
    setStatus("Kunne ikke flytte playhead", error.message || String(error), "warn");
  }
}

function renderComposerMode() {
  const banner = el("reply-banner");
  if (!banner) return;
  const comment = collaboration.comments.find((candidate) => candidate.id === (editingCommentId || replyingToId));
  const active = Boolean(comment);
  setVisible("reply-banner", active);
  if (active) {
    el("reply-label").textContent = editingCommentId
      ? `Redigerer kommentar ved ${formatTimecode(itemTimecode(comment))}`
      : `Svarer ${comment.authorName || "kommentaren"} ved ${formatTimecode(itemTimecode(comment))}`;
  }
  el("create-comment-button").textContent = editingCommentId
    ? "Lagre endring"
    : replyingToId ? "Publiser svar" : "Legg til ved playhead";
}

function beginReply(comment) {
  replyingToId = comment.id;
  editingCommentId = "";
  el("comment-text").value = "";
  el("comment-category").value = comment.category || "edit";
  el("comment-priority").value = comment.priority || "suggestion";
  el("comment-decision").checked = false;
  renderComposerMode();
  el("comment-text").focus();
}

function beginEdit(comment) {
  editingCommentId = comment.id;
  replyingToId = "";
  el("comment-text").value = comment.comment || "";
  el("comment-category").value = comment.category || "edit";
  el("comment-priority").value = comment.priority || "suggestion";
  el("comment-decision").checked = Boolean(comment.isDecision);
  renderComposerMode();
  el("comment-text").focus();
}

function cancelComposerMode() {
  replyingToId = "";
  editingCommentId = "";
  el("comment-text").value = "";
  el("comment-decision").checked = false;
  renderComposerMode();
}

function assigneePayload() {
  const member = selectedMember();
  if (!member) {
    return collaboration.viewerUserId
      ? { assignedToUserId: collaboration.viewerUserId, assignedToName: "Innlogget editor" }
      : {};
  }
  return {
    assignedToUserId: member.user_id || member.userId || null,
    assignedToName: member.name || null,
    assignedToEmail: member.email || null,
  };
}

async function submitComment() {
  const project = selectedProject();
  const version = selectedVersion();
  const commentText = el("comment-text").value.trim();
  if (!project || !version || !commentText) {
    setStatus("Kommentar mangler", "Skriv en kommentar før du lagrer.", "warn");
    return;
  }
  const category = el("comment-category").value;
  const priority = el("comment-priority").value;
  const isDecision = el("comment-decision").checked;
  if (editingCommentId) {
    const commentId = editingCommentId;
    const result = await runReviewMutation(
      "Lagrer kommentar",
      (bearer) => api.updateComment(bearer, project.id, commentId, { comment: commentText, category, priority, isDecision }),
      "Kommentaren er oppdatert.",
    );
    if (result) cancelComposerMode();
    return;
  }
  let timecodeSec;
  if (replyingToId) {
    const parent = collaboration.comments.find((comment) => comment.id === replyingToId);
    timecodeSec = itemTimecode(parent) || 0;
  } else {
    try { timecodeSec = await premiere.getPlayheadSeconds(); }
    catch (error) {
      setStatus("Premiere er ikke klar", error.message || String(error), "warn");
      return;
    }
  }
  const parentId = replyingToId || null;
  const created = await runReviewMutation(
    parentId ? "Publiserer svar" : "Publiserer kommentar",
    async (bearer) => {
      const comment = await api.createComment(bearer, project.id, version.id, {
        timecodeSec,
        comment: commentText,
        category,
        priority,
        isDecision,
        ...(parentId ? { parentId } : {}),
      });
      if (!parentId && priority === "must-fix" && project.canEdit && comment.id) {
        try {
          await api.createTask(bearer, project.id, comment.id, { title: commentText, ...assigneePayload() });
          return { ...comment, taskCreated: true };
        } catch (taskError) {
          log(`Kommentaren ble lagret, men oppgaven feilet: ${taskError.message || String(taskError)}`, "bad");
          return { ...comment, taskAssignmentFailed: true };
        }
      }
      return comment;
    },
    (result) => result.taskAssignmentFailed
      ? { title: "Kommentar lagret", message: "Editoroppgaven feilet. Bruk «Lag oppgave» på kommentaren for å prøve igjen.", tone: "warn" }
      : { message: parentId ? "Svaret er publisert." : result.taskCreated ? "Kommentaren og editoroppgaven er opprettet." : "Kommentaren er publisert." },
  );
  if (created) cancelComposerMode();
}

async function updateCommentStatus(comment) {
  const project = selectedProject();
  if (!project) return;
  const next = comment.status === "resolved" ? "open" : "resolved";
  await runReviewMutation(
    next === "resolved" ? "Løser kommentar" : "Gjenåpner kommentar",
    (bearer) => api.updateComment(bearer, project.id, comment.id, { status: next }),
    next === "resolved" ? "Kommentaren er løst." : "Kommentaren er gjenåpnet.",
  );
}

async function createTaskFromComment(comment) {
  const project = selectedProject();
  if (!project) return;
  await runReviewMutation(
    "Oppretter editoroppgave",
    (bearer) => api.createTask(bearer, project.id, comment.id, { title: comment.comment, ...assigneePayload() }),
    "Kommentaren er gjort om til en tildelt editoroppgave.",
  );
}

async function updateTaskStatus(task, status) {
  const project = selectedProject();
  if (!project) return;
  await runReviewMutation(
    "Oppdaterer editoroppgave",
    (bearer) => api.updateTask(bearer, project.id, task.id, { status }),
    `Oppgaven er satt til ${status}.`,
  );
}

async function assignTask(task) {
  const project = selectedProject();
  if (!project) return;
  const member = selectedMember();
  if (!member) {
    setStatus("Velg en editor", "Velg et aktivt teammedlem før du tildeler oppgaven.", "warn");
    return;
  }
  await runReviewMutation(
    "Tildeler editoroppgave",
    (bearer) => api.updateTask(bearer, project.id, task.id, assigneePayload()),
    `Oppgaven er tildelt ${member.name || member.email || "valgt editor"}.`,
  );
}

async function createReviewRound() {
  const project = selectedProject();
  const version = selectedVersion();
  if (!project || !version) return;
  const maxRounds = Math.max(1, Math.min(99, Number(el("round-max").value) || 3));
  const name = el("round-name").value.trim();
  await runReviewMutation(
    "Starter revisjonsrunde",
    (bearer) => api.createRound(bearer, project.id, version.id, { maxRounds, ...(name ? { name } : {}) }),
    "En ny revisjonsrunde er startet.",
  );
}

async function closeReviewRound(round) {
  const project = selectedProject();
  if (!project) return;
  await runReviewMutation(
    "Lukker revisjonsrunde",
    (bearer) => api.closeRound(bearer, project.id, round.id),
    "Revisjonsrunden er lukket.",
  );
}

async function createApprovalWorkflow() {
  const project = selectedProject();
  const version = selectedVersion();
  if (!project || !version) return;
  const name = el("approval-name").value.trim() || "Kundegodkjenning";
  const emails = el("approval-emails").value.split(",").map((email) => email.trim()).filter(Boolean);
  if (!emails.length) {
    setStatus("Godkjennere mangler", "Legg inn minst én e-postadresse.", "warn");
    return;
  }
  const requiredApprovals = Math.min(emails.length, Math.max(1, Number(el("approval-required").value) || 1));
  const result = await runReviewMutation(
    "Oppretter approval-steg",
    (bearer) => api.createApprovalStep(bearer, project.id, version.id, {
      name,
      approvers: emails.map((email) => ({ email })),
      requiredApprovals,
    }),
    "Approval-steget er opprettet. Åpne lenkene under steget for å dele dem.",
  );
  if (result) {
    approvalInvitations = Array.isArray(result.invitations) ? result.invitations : [];
    renderApprovals();
  }
}

async function openApprovalInvitation(invitation) {
  try {
    const url = new URL(String(invitation.path || ""), API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith("/video-approval/")) throw new Error("Ugyldig approval-lenke.");
    const result = await shell.openExternal(url.toString(), "Åpner CreatorHub-godkjenning");
    if (result) throw new Error(result);
  } catch (error) {
    setStatus("Kunne ikke åpne approval", error.message || String(error), "bad");
  }
}

async function generateTranscript() {
  const project = selectedProject();
  const version = selectedVersion();
  if (!project || !version) return;
  const language = el("transcript-language").value.trim() || "no";
  await runReviewMutation(
    "Starter transkripsjon",
    (bearer) => api.generateTranscript(bearer, project.id, version.id, language),
    "Transkripsjonen er satt i gang og oppdateres automatisk.",
  );
}

async function runTechnicalQc() {
  const project = selectedProject();
  const version = selectedVersion();
  if (!project || !version) return;
  await runReviewMutation(
    "Starter teknisk QC",
    (bearer) => api.runQc(bearer, project.id, version.id, el("qc-profile").value),
    "Teknisk QC er satt i gang og oppdateres automatisk.",
  );
}

async function startLiveReview() {
  const project = selectedProject();
  const version = selectedVersion();
  if (!project || !version) return;
  try {
    const playheadSec = await premiere.getPlayheadSeconds();
    await runReviewMutation(
      "Starter live review",
      (bearer) => api.startLiveReview(bearer, project.id, version.id, playheadSec),
      "Live review er startet ved Premiere-playhead.",
    );
  } catch (error) {
    setStatus("Premiere er ikke klar", error.message || String(error), "warn");
  }
}

async function pushLivePlayhead() {
  const project = selectedProject();
  const live = collaboration.liveSession;
  if (!project || !live) return;
  try {
    const playheadSec = await premiere.getPlayheadSeconds();
    await runReviewMutation(
      "Deler Premiere-playhead",
      (bearer) => api.updateLiveReview(bearer, project.id, live.id, {
        revision: Number(live.revision || 0),
        playheadSec,
        isPlaying: false,
        drawing: live.drawing || null,
      }),
      `Delt playhead er ${formatTimecode(playheadSec)}.`,
    );
  } catch (error) {
    setStatus("Kunne ikke dele playhead", error.message || String(error), "warn");
  }
}

async function followLivePlayhead() {
  const live = collaboration.liveSession;
  if (!live) return;
  await seekToItem({ timecodeSec: live.playhead_sec });
}

async function endLiveReview() {
  const project = selectedProject();
  const live = collaboration.liveSession;
  if (!project || !live) return;
  await runReviewMutation(
    "Avslutter live review",
    (bearer) => api.endLiveReview(bearer, project.id, live.id),
    "Live review er avsluttet.",
  );
}

async function openVideoRoom() {
  const project = selectedProject();
  const version = selectedVersion();
  if (!project || !version) return;
  try {
    const result = await shell.openExternal(
      buildVideoRoomUrl(project.id, version.id),
      "Åpner valgt versjon i CreatorHub Video Room",
    );
    if (result) throw new Error(result);
  } catch (error) {
    setStatus("Kunne ikke åpne Video Room", error.message || String(error), "bad");
  }
}

async function choosePublishPreset() {
  const file = await storage.localFileSystem.getFileForOpening({ types: ["epr"] });
  if (!file) return null;
  if (!file.isFile || !String(file.name || "").toLowerCase().endsWith(".epr")) {
    throw new Error("Velg et gyldig Premiere/Media Encoder-preset med .epr-filtype.");
  }
  publishPresetFile = file;
  publishPrefs.presetToken = await storage.localFileSystem.createPersistentToken(file);
  publishPrefs.presetName = file.name;
  await savePublishPrefs();
  renderPublishControls();
  return file;
}

async function choosePublishFolder() {
  const folder = await storage.localFileSystem.getFolder();
  if (!folder) return null;
  if (!folder.isFolder) throw new Error("Velg en gyldig eksportmappe.");
  publishOutputFolder = folder;
  publishPrefs.folderToken = await storage.localFileSystem.createPersistentToken(folder);
  publishPrefs.folderName = folder.name;
  await savePublishPrefs();
  renderPublishControls();
  return folder;
}

function publishApprovers() {
  return el("publish-approver-emails").value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, all) => email && all.indexOf(email) === index);
}

function selectPublishedVersion(projectId, versionId) {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project || !project.versions.some((version) => version.id === versionId)) return null;
  el("project-select").value = projectId;
  renderVersions(versionId);
  el("version-select").value = versionId;
  renderButtons();
  return project.versions.find((version) => version.id === versionId) || null;
}

function bindPublishedVersion(checkpoint, version) {
  const binding = checkpoint.premiereBinding;
  stopSyncTimer();
  config = {
    enabled: false,
    projectId: checkpoint.projectId,
    projectName: checkpoint.projectName,
    versionId: checkpoint.ticket.versionId,
    versionLabel: version?.label || checkpoint.versionLabel,
    premiereProjectGuid: binding.projectGuid,
    premiereProjectName: binding.projectName,
    premiereSequenceGuid: binding.sequenceGuid,
    premiereSequenceName: binding.sequenceName,
  };
  saveConfig();
}

async function retryExpiredUpload(checkpoint) {
  const replacement = await api.retryVideoVersionTus(token, checkpoint.projectId, checkpoint.ticket.versionId, {
    expectedStreamUid: checkpoint.ticket.uid,
    fileName: checkpoint.fileName,
  });
  checkpoint.ticket = validateUploadTicket(replacement);
  checkpoint.stage = "uploading";
  await savePublishCheckpoint(checkpoint);
}

async function uploadCheckpointFile(checkpoint, file) {
  const metadata = await file.getMetadata();
  if (Number(metadata && metadata.size) !== Number(checkpoint.sizeBytes)) {
    throw new Error("Eksportfilen er endret siden sendingen startet. Start en ny eksport.");
  }
  const runUpload = () => uploadFileTus({
    ticket: checkpoint.ticket,
    nativePath: file.nativePath,
    sizeBytes: checkpoint.sizeBytes,
    fsApi: fs,
    fetchImpl: fetch,
    onProgress: ({ percent, offset, sizeBytes }) => {
      setPublishProgress(percent, `Laster opp ${percent}% · ${Math.round(offset / 1024 / 1024)} av ${Math.round(sizeBytes / 1024 / 1024)} MiB`);
    },
  });
  try {
    await runUpload();
  } catch (error) {
    if (!(error instanceof TusUploadError) || error.code !== "ticket_expired") throw error;
    setPublishProgress(0, "Fornyer utløpt opplastingsbillett…");
    await retryExpiredUpload(checkpoint);
    await runUpload();
  }
  checkpoint.stage = "processing";
  checkpoint.uploadComplete = true;
  await savePublishCheckpoint(checkpoint);
}

async function waitForPublishedVersion(checkpoint) {
  for (let attempt = 0; attempt < 7200; attempt += 1) {
    const status = await api.fetchVideoVersionStreamStatus(token, checkpoint.projectId, checkpoint.ticket.versionId);
    const progress = Number.isFinite(Number(status.progressPercent)) ? Math.round(Number(status.progressPercent)) : null;
    setPublishProgress(
      progress == null ? 100 : progress,
      status.ready ? "Videoen er klar." : `Cloudflare behandler videoen${progress == null ? "…" : ` · ${progress}%`}`,
    );
    if (status.ready && status.status === "under_review") return status;
    if (status.ready) {
      setPublishProgress(100, "Videoen er ferdig behandlet. Aktiverer review-versjonen…");
    }
    if (status.error || ["error", "failed"].includes(String(status.state || "").toLowerCase())) {
      throw new Error(status.error || "Cloudflare kunne ikke behandle videoen.");
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Videoen er lastet opp, men behandlingen tok for lang tid. Du kan fortsette sendingen senere.");
}

async function finishPublishWorkflow(checkpoint) {
  await refreshProjects();
  const version = selectPublishedVersion(checkpoint.projectId, checkpoint.ticket.versionId);
  if (!version) throw new Error("Den ferdige versjonen finnes ikke i prosjektvelgeren ennå. Prøv «Fortsett avbrutt sending».");
  bindPublishedVersion(checkpoint, version);

  const currentContext = await premiere.getContext().catch(() => null);
  const sameSequence = currentContext &&
    currentContext.projectGuid === checkpoint.premiereBinding.projectGuid &&
    currentContext.sequenceGuid === checkpoint.premiereBinding.sequenceGuid;
  if (sameSequence) {
    config.enabled = true;
    saveConfig();
    startSyncTimer();
  }

  const warnings = [];
  if (checkpoint.createRound && !checkpoint.roundCreated) {
    try {
      await api.createRound(token, checkpoint.projectId, checkpoint.ticket.versionId, {
        name: `${checkpoint.versionLabel} review`,
        maxRounds: 3,
      });
      checkpoint.roundCreated = true;
      await savePublishCheckpoint(checkpoint);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) checkpoint.roundCreated = true;
      else warnings.push(`revisjonsrunde: ${error.message || String(error)}`);
    }
  }
  if (checkpoint.approvers.length && !checkpoint.approvalCreated) {
    try {
      const result = await api.createApprovalStep(token, checkpoint.projectId, checkpoint.ticket.versionId, {
        name: `${checkpoint.versionLabel} godkjenning`,
        approvers: checkpoint.approvers.map((email) => ({ email })),
        requiredApprovals: checkpoint.requiredApprovals,
      });
      checkpoint.approvalCreated = true;
      approvalInvitations = Array.isArray(result.invitations) ? result.invitations : [];
      await savePublishCheckpoint(checkpoint);
    } catch (error) {
      warnings.push(`approval: ${error.message || String(error)}`);
    }
  }

  await savePublishCheckpoint(null);
  await refreshCollaboration(true);
  renderReview();
  if (warnings.length) {
    setStatus("Versjonen er sendt", `Videoen er klar, men workflow trenger oppfølging: ${warnings.join(" · ")}`, "warn");
  } else if (!sameSequence) {
    setStatus("Versjonen er sendt", "Bindingen er lagret. Bytt tilbake til den eksporterte sekvensen og start synk når du vil hente review-markører.", "warn");
  } else {
    setStatus("Sendt til review", `${checkpoint.projectName} · ${version.label} er klar og bundet til aktiv sekvens.`, "ok");
  }
  log(`Sendt ${checkpoint.fileName} til ${checkpoint.projectName} · ${version.label}.`, "ok");
}

async function continuePublishCheckpoint() {
  if (!publishCheckpoint) throw new Error("Ingen avbrutt sending ble funnet.");
  const checkpoint = publishCheckpoint;
  checkpoint.ticket = validateUploadTicket(checkpoint.ticket);
  if (checkpoint.stage === "uploading") {
    const file = await storage.localFileSystem.getEntryForPersistentToken(checkpoint.fileToken).catch(() => null);
    if (!file?.isFile || !file.nativePath) throw new Error("Eksportfilen finnes ikke lenger. Start en ny eksport.");
    await uploadCheckpointFile(checkpoint, file);
  }
  if (checkpoint.stage === "processing") {
    await waitForPublishedVersion(checkpoint);
    checkpoint.stage = "workflow";
    await savePublishCheckpoint(checkpoint);
  }
  await finishPublishWorkflow(checkpoint);
}

async function sendSequenceToReview() {
  if (publishRunning) return;
  const project = selectedProject();
  if (!token || !project?.canEdit) {
    setStatus("Kan ikke sende", "Velg et prosjekt der du har editor-tilgang.", "warn");
    return;
  }
  publishRunning = true;
  renderButtons();
  try {
    if (!publishPresetFile && !await choosePublishPreset()) throw new Error("Eksportpreset ble ikke valgt.");
    if (!publishOutputFolder && !await choosePublishFolder()) throw new Error("Eksportmappe ble ikke valgt.");
    const versionLabel = el("publish-version-label").value.trim().slice(0, 80) || "Review";
    const approvers = publishApprovers();
    const requiredApprovals = approvers.length
      ? Math.min(approvers.length, Math.max(1, Number(el("publish-required-approvals").value) || 1))
      : 0;
    setStatus("Eksporterer sekvens", "Premiere lager review-filen med valgt .epr-preset.", "warn");
    setPublishProgress(0, "Eksporterer i Premiere…");
    const exported = await premiere.exportActiveSequence({
      presetFile: publishPresetFile,
      outputFolder: publishOutputFolder,
      fileNameForExtension: (extension, context) => buildExportFileName(context.sequenceName, versionLabel, extension),
    });
    const fileName = exported.fileName;
    const fileToken = await storage.localFileSystem.createPersistentToken(exported.file);
    setStatus("Klargjør opplasting", "CreatorHub oppretter en privat, resumérbar Stream-versjon.", "warn");
    const rawTicket = await api.provisionVideoVersionTus(token, project.id, {
      fileName,
      sizeBytes: exported.sizeBytes,
      contentType: contentTypeForExtension(exported.extension),
      versionLabel,
    });
    const ticket = validateUploadTicket(rawTicket);
    await savePublishCheckpoint({
      stage: "uploading",
      projectId: project.id,
      projectName: project.name,
      versionLabel,
      fileName,
      fileToken,
      sizeBytes: exported.sizeBytes,
      contentType: contentTypeForExtension(exported.extension),
      ticket,
      premiereBinding: {
        projectGuid: exported.context.projectGuid,
        projectName: exported.context.projectName,
        sequenceGuid: exported.context.sequenceGuid,
        sequenceName: exported.context.sequenceName,
      },
      createRound: el("publish-create-round").checked,
      approvers,
      requiredApprovals,
      roundCreated: false,
      approvalCreated: false,
    });
    await continuePublishCheckpoint();
  } catch (error) {
    if (!await handleAuthError(error, token)) {
      setStatus("Sendingen stoppet", error.message || String(error), "bad", publishCheckpoint ? "Du kan fortsette uten ny eksport." : "Ingen aktiv review-versjon ble erstattet.");
      log(error.message || String(error), "bad");
    }
  } finally {
    publishRunning = false;
    renderButtons();
  }
}

async function resumeSequencePublish() {
  if (publishRunning || !publishCheckpoint) return;
  publishRunning = true;
  renderButtons();
  try {
    await continuePublishCheckpoint();
  } catch (error) {
    if (!await handleAuthError(error, token)) {
      setStatus("Kunne ikke fortsette sendingen", error.message || String(error), "bad");
      log(error.message || String(error), "bad");
    }
  } finally {
    publishRunning = false;
    renderButtons();
  }
}

async function handleAuthError(error, attemptedToken) {
  if (error instanceof ApiError && error.status === 401) {
    if (attemptedToken && token !== attemptedToken) return true;
    await clearToken();
    if (config) config.enabled = false;
    saveConfig();
    stopSyncTimer();
    stopReviewTimer();
    collaboration = emptyCollaboration();
    renderAuthState();
    renderReview();
    setStatus("Økten er utløpt", "Logg inn på nytt for å fortsette.", "bad");
    return true;
  }
  return false;
}

async function refreshProjects() {
  if (!token) return;
  const attemptedToken = token;
  el("refresh-projects-button").disabled = true;
  try {
    const response = await api.listProjects(attemptedToken);
    projects = Array.isArray(response.projects) ? response.projects : [];
    renderProjects();
    if (!projects.length) {
      resetReviewState();
      setStatus("Ingen Video Room-prosjekter", "Du har foreløpig ingen tilgjengelige videoversjoner.", "warn");
    } else {
      await refreshCollaboration(true);
      startReviewTimer();
    }
  } catch (error) {
    if (!await handleAuthError(error, attemptedToken)) {
      setStatus("Kunne ikke hente prosjekter", error.message || String(error), "bad");
      log(error.message || String(error), "bad");
    }
  } finally {
    el("refresh-projects-button").disabled = false;
  }
}

async function refreshPremiereContext() {
  try {
    const context = await premiere.getContext();
    el("premiere-project").textContent = context.projectName;
    el("premiere-sequence").textContent = context.sequenceName;
    el("premiere-marker-count").textContent = String(context.markers.length);
    return context;
  } catch (error) {
    el("premiere-project").textContent = "Ikke tilgjengelig";
    el("premiere-sequence").textContent = "Ikke tilgjengelig";
    el("premiere-marker-count").textContent = "–";
    setStatus("Premiere er ikke klar", error.message || String(error), "warn");
    return null;
  }
}

function assertBoundContext(context) {
  if (!config || !config.enabled) throw new Error("Start synk før du synkroniserer.");
  if (context.projectGuid !== config.premiereProjectGuid || context.sequenceGuid !== config.premiereSequenceGuid) {
    throw new Error(
      `Synken er bundet til ${config.premiereProjectName} · ${config.premiereSequenceName}. ` +
      "Bytt tilbake til riktig sekvens eller stopp og start synken på nytt.",
    );
  }
}

async function syncOnce() {
  if (syncRunning || !token || !config || !config.enabled) return;
  const bearer = token;
  const generation = syncGeneration;
  const isCurrent = () => generation === syncGeneration && token === bearer && Boolean(config && config.enabled);
  syncRunning = true;
  renderButtons();
  const key = [config.projectId, config.versionId, config.premiereProjectGuid, config.premiereSequenceGuid].join(":");
  try {
    setStatus("Synkroniserer", `${config.projectName} · ${config.versionLabel}`, "warn");
    let context = await premiere.getContext();
    if (!isCurrent()) return;
    assertBoundContext(context);
    let cloud;
    let conflictCount = 0;

    if (connectedKey !== key) {
      // Canonical browser feedback wins at first connect. Unmanaged Premiere
      // markers survive the pull and are imported immediately afterwards.
      cloud = await api.fetchMarkers(bearer, config.projectId, config.versionId);
      if (!isCurrent()) return;
      context = await premiere.getContext();
      assertBoundContext(context);
      if (!isCurrent()) return;
      conflictCount = Math.max(conflictCount, (await premiere.applyCloudMarkers(context, cloud.markers || [])).conflicts);
      if (!isCurrent()) return;
      context = await premiere.getContext();
      if (!isCurrent()) return;
      const firstLocal = premiereMarkersToVideoRoom(context.markers, context.sequenceGuid);
      if (firstLocal.length) await api.pushMarkers(bearer, config.projectId, config.versionId, firstLocal);
      if (!isCurrent()) return;
      cloud = await api.fetchMarkers(bearer, config.projectId, config.versionId);
      if (!isCurrent()) return;
      context = await premiere.getContext();
      assertBoundContext(context);
      if (!isCurrent()) return;
      conflictCount = Math.max(conflictCount, (await premiere.applyCloudMarkers(context, cloud.markers || [])).conflicts);
      connectedKey = key;
    } else {
      const local = premiereMarkersToVideoRoom(context.markers, context.sequenceGuid);
      const signature = markerSnapshotSignature(local);
      if (local.length && signature !== lastLocalSignature) {
        await api.pushMarkers(bearer, config.projectId, config.versionId, local);
        if (!isCurrent()) return;
        lastLocalSignature = signature;
      }
      cloud = await api.fetchMarkers(bearer, config.projectId, config.versionId);
      if (!isCurrent()) return;
      context = await premiere.getContext();
      assertBoundContext(context);
      if (!isCurrent()) return;
      conflictCount = Math.max(conflictCount, (await premiere.applyCloudMarkers(context, cloud.markers || [])).conflicts);
    }

    if (!isCurrent()) return;
    context = await premiere.getContext();
    if (!isCurrent()) return;
    assertBoundContext(context);
    const finalLocal = premiereMarkersToVideoRoom(context.markers, context.sequenceGuid);
    const finalSignature = markerSnapshotSignature(finalLocal);
    if (finalLocal.length && finalSignature !== lastLocalSignature) {
      if (!isCurrent()) return;
      await api.pushMarkers(bearer, config.projectId, config.versionId, finalLocal);
    }
    lastLocalSignature = finalSignature;
    el("premiere-marker-count").textContent = String(context.markers.length);
    const cloudCount = Array.isArray(cloud.markers) ? cloud.markers.length : 0;
    if (conflictCount) {
      setStatus(
        "Synkronisert med konflikt",
        `${conflictCount} Video Room-markør${conflictCount === 1 ? "" : "er"} deler tidspunkt med en privat Premiere-markør. Ingen private markører ble endret.`,
        "warn",
        `${cloudCount} Video Room-markører · ${new Date().toLocaleTimeString()}`,
      );
    } else {
      setStatus(
        "Synkronisert",
        `${config.projectName} · ${config.versionLabel}`,
        "ok",
        `${cloudCount} Video Room-markører · ${new Date().toLocaleTimeString()}`,
      );
    }
    void refreshCollaboration(true);
  } catch (error) {
    if (!await handleAuthError(error, bearer)) {
      setStatus("Synkfeil", error.message || String(error), "bad");
      log(error.message || String(error), "bad");
    }
  } finally {
    syncRunning = false;
    renderButtons();
  }
}

function stopSyncTimer() {
  syncGeneration += 1;
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
  connectedKey = "";
  lastLocalSignature = "";
}

function startSyncTimer() {
  stopSyncTimer();
  if (!config || !config.enabled) return;
  syncTimer = setInterval(() => void syncOnce(), SYNC_INTERVAL_MS);
  void syncOnce();
}

async function startSync() {
  const project = selectedProject();
  const version = selectedVersion();
  if (!project || !version || !project.canEdit) return;
  const context = await refreshPremiereContext();
  if (!context) return;
  config = {
    enabled: true,
    projectId: project.id,
    projectName: project.name,
    versionId: version.id,
    versionLabel: version.label,
    premiereProjectGuid: context.projectGuid,
    premiereProjectName: context.projectName,
    premiereSequenceGuid: context.sequenceGuid,
    premiereSequenceName: context.sequenceName,
  };
  saveConfig();
  log(`Bundet til ${context.projectName} · ${context.sequenceName}`, "ok");
  renderButtons();
  startSyncTimer();
}

function stopSync() {
  if (config) config.enabled = false;
  saveConfig();
  stopSyncTimer();
  renderButtons();
  setStatus("Synk stoppet", "Ingen markører endres før synken startes igjen.", "warn");
}

function stopPairing() {
  pairingGeneration += 1;
  if (pairingTimer) clearTimeout(pairingTimer);
  pairingTimer = null;
  pairing = null;
}

async function openVerificationPage() {
  if (!pairing) return;
  const url = buildVerificationUrl(pairing.verificationUrl, pairing.code);
  const result = await shell.openExternal(
    url,
    "Åpner CreatorHub-innlogging for å koble Premiere-pluginen",
  );
  if (result) log(`Kunne ikke åpne nettleseren: ${result}`, "bad");
}

async function pollPairing(startedAt, generation) {
  if (generation !== pairingGeneration) return;
  if (!pairing || Date.now() - startedAt > MAX_PAIRING_MS) {
    stopPairing();
    setStatus("Innlogging utløpt", "Start en ny engangskode.", "bad");
    return;
  }
  try {
    const result = await api.pollPairing(pairing.code);
    if (generation !== pairingGeneration) return;
    if (result.bearerToken) {
      const pairedToken = result.bearerToken;
      await storeToken(pairedToken);
      if (generation !== pairingGeneration) {
        if (token === pairedToken) await clearToken();
        return;
      }
      stopPairing();
      setVisible("pairing-box", false);
      renderAuthState();
      setStatus("Tilkoblet", "CreatorHub-kontoen er klar.", "ok");
      log("Sikker innlogging fullført.", "ok");
      await refreshProjects();
      await refreshPremiereContext();
      if (config && config.enabled) startSyncTimer();
      return;
    }
  } catch (error) {
    if (generation !== pairingGeneration) return;
    if (error instanceof ApiError && error.status === 410) {
      stopPairing();
      setStatus("Innlogging utløpt", "Start en ny engangskode.", "bad");
      return;
    }
    log(`Midlertidig innloggingsfeil: ${error.message || String(error)}`, "bad");
  }
  const interval = Math.max(1500, Number(pairing && pairing.pollIntervalMs) || 2000);
  pairingTimer = setTimeout(() => void pollPairing(startedAt, generation), interval);
}

async function startPairing() {
  stopPairing();
  el("pair-button").disabled = true;
  try {
    pairing = await api.startPairing();
    el("pairing-code").textContent = pairing.code;
    el("pairing-expiry").textContent = "Venter på godkjenning i nettleseren…";
    setVisible("pairing-box", true);
    try { await openVerificationPage(); }
    catch (error) { log(error.message || String(error), "bad"); }
    const generation = pairingGeneration;
    void pollPairing(Date.now(), generation);
  } catch (error) {
    setStatus("Kunne ikke starte innlogging", error.message || String(error), "bad");
  } finally {
    el("pair-button").disabled = false;
  }
}

async function disconnect() {
  stopPairing();
  stopSync();
  await clearToken();
  projects = [];
  stopReviewTimer();
  collaboration = emptyCollaboration();
  renderAuthState();
  renderReview();
  setStatus("Logget ut", "Det krypterte plugin-tokenet er fjernet.", "warn");
}

function bindUi() {
  el("pair-button").addEventListener("click", () => void startPairing());
  el("open-verification-button").addEventListener("click", () => void openVerificationPage());
  el("refresh-projects-button").addEventListener("click", () => void refreshProjects());
  el("refresh-context-button").addEventListener("click", () => void refreshPremiereContext());
  el("project-select").addEventListener("change", () => {
    stopReviewTimer();
    resetReviewState();
    renderVersions("");
    void refreshCollaboration();
    startReviewTimer();
  });
  el("version-select").addEventListener("change", () => {
    stopReviewTimer();
    resetReviewState();
    renderButtons();
    renderReview();
    void refreshCollaboration();
    startReviewTimer();
  });
  el("start-sync-button").addEventListener("click", () => void startSync());
  el("sync-now-button").addEventListener("click", () => void syncOnce());
  el("stop-sync-button").addEventListener("click", stopSync);
  el("choose-preset-button").addEventListener("click", () => void choosePublishPreset().catch((error) => {
    setStatus("Kunne ikke velge preset", error.message || String(error), "bad");
  }));
  el("choose-folder-button").addEventListener("click", () => void choosePublishFolder().catch((error) => {
    setStatus("Kunne ikke velge mappe", error.message || String(error), "bad");
  }));
  el("send-review-button").addEventListener("click", () => void sendSequenceToReview());
  el("resume-upload-button").addEventListener("click", () => void resumeSequencePublish());
  el("disconnect-button").addEventListener("click", () => void disconnect());
  el("refresh-review-button").addEventListener("click", () => void refreshCollaboration());
  el("open-video-room-button").addEventListener("click", () => void openVideoRoom());
  for (const tab of document.querySelectorAll("[data-review-tab]")) {
    tab.addEventListener("click", () => {
      activeReviewTab = tab.dataset.reviewTab;
      renderReviewTabs();
    });
  }
  el("cancel-reply-button").addEventListener("click", cancelComposerMode);
  el("create-comment-button").addEventListener("click", () => void submitComment());
  el("create-round-button").addEventListener("click", () => void createReviewRound());
  el("create-approval-button").addEventListener("click", () => void createApprovalWorkflow());
  el("generate-transcript-button").addEventListener("click", () => void generateTranscript());
  el("search-transcript-button").addEventListener("click", () => {
    transcriptQuery = el("transcript-search").value.trim();
    void refreshCollaboration();
  });
  el("run-qc-button").addEventListener("click", () => void runTechnicalQc());
  el("start-live-button").addEventListener("click", () => void startLiveReview());
  el("push-live-button").addEventListener("click", () => void pushLivePlayhead());
  el("follow-live-button").addEventListener("click", () => void followLivePlayhead());
  el("end-live-button").addEventListener("click", () => void endLiveReview());
  el("clear-log-button").addEventListener("click", () => {
    el("log").textContent = "";
    setVisible("log-card", false);
  });
}

async function initialize() {
  bindUi();
  await Promise.all([loadToken(), loadPublishState()]);
  renderAuthState();
  renderButtons();
  if (publishCheckpoint) {
    const stage = publishCheckpoint.stage === "processing" ? "Cloudflare-behandling" : publishCheckpoint.stage === "workflow" ? "review-workflow" : "opplasting";
    setPublishProgress(0, `Avbrutt ${stage} kan fortsettes.`);
  }
  if (!token) return;
  await refreshProjects();
  await refreshPremiereContext();
  if (config && config.enabled) startSyncTimer();
}

entrypoints.setup({
  panels: {
    creatorHubVideoRoomPanel: {
      show() {
        if (config && config.enabled && !syncTimer) startSyncTimer();
        if (token && selectedVersion() && !reviewTimer) startReviewTimer();
      },
      destroy() {
        stopPairing();
        stopSyncTimer();
        stopReviewTimer();
      },
    },
  },
});

window.addEventListener("load", () => void initialize());

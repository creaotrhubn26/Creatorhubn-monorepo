"use strict";

const API_ORIGIN = "https://www.creatorhubn.com";
const POST_AGENT_BASE = `${API_ORIGIN}/api/post-agent`;

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code || null;
  }
}

function createApiClient(options) {
  const fetchImpl = options && options.fetchImpl ? options.fetchImpl : fetch;
  const timeoutMs = options && options.timeoutMs ? options.timeoutMs : 15000;

  async function request(url, init) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchImpl(url, {
        credentials: "omit",
        ...init,
        ...(controller ? { signal: controller.signal } : {}),
      });
      const raw = await response.text();
      let body = {};
      if (raw) {
        try { body = JSON.parse(raw); }
        catch (_) { body = { detail: raw.slice(0, 500) }; }
      }
      if (!response.ok) {
        throw new ApiError(
          body.error || body.detail || `CreatorHub svarte HTTP ${response.status}`,
          response.status,
          body.error,
        );
      }
      return body;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  function authHeaders(token, json) {
    if (!token) throw new ApiError("Logg inn før du synkroniserer.", 401, "auth_required");
    return {
      Authorization: `Bearer ${token}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    };
  }

  function projectUrl(projectId, suffix) {
    return `${API_ORIGIN}/api/projects/${encodeURIComponent(projectId)}/${suffix}`;
  }

  function authenticatedJson(token, method, url, body) {
    return request(url, {
      method,
      headers: authHeaders(token, body !== undefined),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  return {
    startPairing() {
      return request(`${POST_AGENT_BASE}/pairing/start`, { method: "POST" });
    },
    pollPairing(code) {
      return request(`${POST_AGENT_BASE}/pairing/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
    },
    listProjects(token) {
      return request(`${API_ORIGIN}/api/video-nle/projects`, {
        method: "GET",
        headers: authHeaders(token, false),
      });
    },
    fetchMarkers(token, projectId, versionId) {
      const project = encodeURIComponent(projectId);
      const version = encodeURIComponent(versionId);
      return request(`${API_ORIGIN}/api/projects/${project}/video-marker-sync/premiere?versionId=${version}`, {
        method: "GET",
        headers: authHeaders(token, false),
      });
    },
    pushMarkers(token, projectId, versionId, markers) {
      return authenticatedJson(token, "POST", projectUrl(projectId, "video-marker-sync/premiere"), { versionId, markers });
    },
    fetchCollaboration(token, projectId, versionId, query) {
      const params = new URLSearchParams({ versionId: String(versionId) });
      if (query) params.set("q", String(query));
      return authenticatedJson(token, "GET", `${projectUrl(projectId, "video-collaboration")}?${params.toString()}`);
    },
    createComment(token, projectId, versionId, input) {
      return authenticatedJson(token, "POST", projectUrl(projectId, "video-comments"), { ...input, versionId });
    },
    updateComment(token, projectId, commentId, change) {
      return authenticatedJson(token, "PATCH", projectUrl(projectId, `video-comments/${encodeURIComponent(commentId)}`), change);
    },
    createTask(token, projectId, commentId, input) {
      return authenticatedJson(token, "POST", projectUrl(projectId, `video-comments/${encodeURIComponent(commentId)}/task`), input);
    },
    updateTask(token, projectId, taskId, change) {
      return authenticatedJson(token, "PATCH", projectUrl(projectId, `video-tasks/${encodeURIComponent(taskId)}`), change);
    },
    createRound(token, projectId, versionId, input) {
      return authenticatedJson(token, "POST", projectUrl(projectId, "video-rounds"), { ...input, versionId });
    },
    closeRound(token, projectId, roundId) {
      return authenticatedJson(token, "PATCH", projectUrl(projectId, `video-rounds/${encodeURIComponent(roundId)}`), { status: "closed" });
    },
    createApprovalStep(token, projectId, versionId, input) {
      return authenticatedJson(token, "POST", projectUrl(projectId, "video-approval-steps"), { ...input, versionId });
    },
    generateTranscript(token, projectId, versionId, language) {
      return authenticatedJson(token, "POST", projectUrl(projectId, "video-transcription/generate"), { versionId, language });
    },
    runQc(token, projectId, versionId, profile) {
      return authenticatedJson(token, "POST", projectUrl(projectId, "video-qc"), { versionId, profile });
    },
    startLiveReview(token, projectId, versionId, playheadSec) {
      return authenticatedJson(token, "POST", projectUrl(projectId, "video-live"), { versionId, playheadSec, isPlaying: false });
    },
    updateLiveReview(token, projectId, sessionId, change) {
      return authenticatedJson(token, "PATCH", projectUrl(projectId, `video-live/${encodeURIComponent(sessionId)}`), change);
    },
    endLiveReview(token, projectId, sessionId) {
      return authenticatedJson(token, "DELETE", projectUrl(projectId, `video-live/${encodeURIComponent(sessionId)}`));
    },
  };
}

module.exports = { API_ORIGIN, POST_AGENT_BASE, ApiError, createApiClient };

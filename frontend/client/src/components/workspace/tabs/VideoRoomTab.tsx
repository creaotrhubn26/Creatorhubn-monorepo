// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  Chip,
  TextField,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Switch,
  FormControlLabel,
  Divider,
} from "@mui/material";
import CloudUpload from "@mui/icons-material/CloudUpload";
import CheckCircle from "@mui/icons-material/CheckCircle";
import EditNote from "@mui/icons-material/EditNote";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Reply from "@mui/icons-material/Reply";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import DriveFileRenameOutline from "@mui/icons-material/DriveFileRenameOutline";
import Download from "@mui/icons-material/Download";
import Share from "@mui/icons-material/Share";
import Compare from "@mui/icons-material/Compare";
import Summarize from "@mui/icons-material/Summarize";
import Segment from "@mui/icons-material/Segment";
import ContentCopy from "@mui/icons-material/ContentCopy";
import AssignmentTurnedIn from "@mui/icons-material/AssignmentTurnedIn";
import Groups from "@mui/icons-material/Groups";
import Subtitles from "@mui/icons-material/Subtitles";
import FactCheck from "@mui/icons-material/FactCheck";
import SyncAlt from "@mui/icons-material/SyncAlt";
import { apiRequest } from "@/lib/queryClient";
import { uploadVideoToCloudflareStream } from "@/lib/cloudflareStreamTusUpload";
import CinematicVideoPlayer from "@/components/gallery/CinematicVideoPlayer";
import EditFeedbackSummary from "@/components/gallery/EditFeedbackSummary";
import { ws } from "../workspaceTheme";
import { wsIcon } from "../crewIcons";
import { WsCard, WsTag, WsModal } from "../ui";
import AiBuyCreditsModal from "../AiBuyCreditsModal";
import VideoVersionCompare from "../video-room/VideoVersionCompare";
import {
  buildVideoRoomStateUrl,
  filterVideoComments,
  groupVideoCommentReplies,
} from "../video-room/videoRoomModel";

const PHASES = ["Brief", "V1", "Klient-review", "Revisjoner", "Levert"];
const VIDEO_ROOM_EVENTS_WS_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_WS_BASE
    ? import.meta.env.VITE_WS_BASE
    : "wss://creatorhub-backend-rtbl.onrender.com";

const fmtTc = (seconds: number) => {
  const value = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
};
const downloadPath = async (path: string) => {
  const result: any = await apiRequest(
    `${path}${path.includes("?") ? "&" : "?"}format=json`,
  );
  if (!result?.url) throw new Error("download_unavailable");
  const anchor = document.createElement("a");
  anchor.href = result.url;
  anchor.download = "";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const VideoRoomTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = Boolean(projectId && projectId !== "sample");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [filter, setFilter] = useState("alle");
  const [seekToSec, setSeekToSec] = useState<number | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [vrLive, setVrLive] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [vFile, setVFile] = useState<any>(null);
  const [vLabel, setVLabel] = useState("");
  const [vImportUrl, setVImportUrl] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [chapterOpen, setChapterOpen] = useState(false);
  const [chapterDraft, setChapterDraft] = useState<any[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [shareAccess, setShareAccess] = useState("approve");
  const [sharePassword, setSharePassword] = useState("");
  const [shareHistory, setShareHistory] = useState(true);
  const [shareDownload, setShareDownload] = useState(false);
  const [shareRecipientName, setShareRecipientName] = useState("");
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [shareWatermark, setShareWatermark] = useState(true);
  const [shareWatermarkText, setShareWatermarkText] = useState("");
  const [newShareUrl, setNewShareUrl] = useState("");
  const [collab, setCollab] = useState<any>({ tasks: [], rounds: [], approvalSteps: [], transcript: [], captions: [], qc: [], liveSession: null, members: [] });
  const livePushTimer = useRef<any>(null);
  const markerImportInput = useRef<HTMLInputElement | null>(null);

  const [aiCfg, setAiCfg] = useState<any | null>(null);
  const [credits, setCredits] = useState<any | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [reOpen, setReOpen] = useState(false);
  const [rePrompt, setRePrompt] = useState("");
  const [reRes, setReRes] = useState(720);
  const [reJob, setReJob] = useState<any | null>(null);
  const [aiVideoJobs, setAiVideoJobs] = useState<any[]>([]);
  const [reBusy, setReBusy] = useState(false);
  const RE_PRESETS = [
    "Golden hour — varmt, filmatisk motlys",
    "Blå time — kjølig, stemningsfull",
    "Natt-neon — urbant, fargerikt",
    "Overskyet studio — mykt, nøytralt lys",
  ];

  const loadAi = useCallback(async () => {
    if (!isReal) return;
    const [cfg, wallet, history] = await Promise.all([
      apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/ai/config`,
      ).catch(() => null),
      apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/ai/credits`,
      ).catch(() => null),
      apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/ai/jobs`,
      ).catch(() => ({ jobs: [] })),
    ]);
    setAiCfg(cfg);
    setCredits(wallet);
    const videoJobs = (history?.jobs || []).filter(
      (job: any) => job.kind === "video-to-video",
    );
    setAiVideoJobs(videoJobs);
    const previous = videoJobs[0];
    if (previous) setReJob(previous);
  }, [isReal, projectId]);

  const load = useCallback(
    async (versionId?: string | null, quiet = false) => {
      if (!isReal) {
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      try {
        const result: any = await apiRequest(
          buildVideoRoomStateUrl(projectId, versionId),
        );
        setData(result || null);
        setSelectedVersionId(result?.currentVersionId || null);
      } catch {
        /* existing error surface handles empty state */
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [isReal, projectId],
  );

  useEffect(() => {
    load();
    loadAi();
  }, [load, loadAi]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("ai_credits") !== "ok" || !params.get("cs")) return;
      apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/ai/credits/confirm`,
        { method: "POST", body: { sessionId: params.get("cs") } },
      )
        .then(() => {
          loadAi();
          window.alert("Kreditter lagt til ✓");
        })
        .catch(() => {})
        .finally(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("ai_credits");
          url.searchParams.delete("cs");
          window.history.replaceState({}, "", url.toString());
        });
    } catch {
      /* no-op */
    }
  }, [projectId, loadAi]);

  useEffect(() => {
    const runningId =
      reJob?.id && ["queued", "running"].includes(reJob.status)
        ? reJob.id
        : null;
    if (!runningId) return;
    const poll = async () => {
      const status: any = await apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${runningId}`,
      ).catch(() => null);
      if (status) setReJob({ ...status, id: runningId });
    };
    poll();
    const interval = window.setInterval(poll, 5000);
    return () => window.clearInterval(interval);
  }, [projectId, reJob?.id, reJob?.status]);

  useEffect(() => {
    if (!isReal) return;
    const token =
      localStorage.getItem("creatorhub_auth_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("role_room_auth_token");
    if (!token) return;
    let alive = true;
    let socket: WebSocket | null = null;
    let retry: any = null;
    let debounce: any = null;
    const connect = () => {
      if (!alive) return;
      try {
        socket = new WebSocket(
          `${VIDEO_ROOM_EVENTS_WS_BASE}/api/ipad/ws/events?token=${encodeURIComponent(token)}`,
        );
      } catch {
        retry = setTimeout(connect, 8000);
        return;
      }
      socket.onopen = () => alive && setVrLive(true);
      socket.onclose = () => {
        if (alive) {
          setVrLive(false);
          retry = setTimeout(connect, 8000);
        }
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (event) => {
        let payload: any = null;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (
          payload?.event?.kind !== "video-room.updated" ||
          payload.event.projectId !== projectId
        )
          return;
        clearTimeout(debounce);
        debounce = setTimeout(() => load(selectedVersionId, true), 250);
      };
    };
    connect();
    return () => {
      alive = false;
      clearTimeout(retry);
      clearTimeout(debounce);
      socket?.close();
    };
  }, [isReal, projectId, load, selectedVersionId]);

  const versions = data?.versions || [];
  const current =
    versions.find((version: any) => version.id === data?.currentVersionId) ||
    null;
  const comments = data?.comments || [];
  const chapters = (data?.chapters || []).map((chapter: any) => ({
    startSec: chapter.startSec ?? chapter.start_sec ?? 0,
    title: chapter.title || "",
    intro: chapter.intro || null,
  }));
  const canEdit = Boolean(data?.permissions?.canEdit);
  const counts = useMemo(
    () => ({
      all: comments.length,
      open: comments.filter(
        (comment: any) => !["resolved", "done"].includes(comment.status),
      ).length,
      resolved: comments.filter((comment: any) =>
        ["resolved", "done"].includes(comment.status),
      ).length,
      decisions: comments.filter((comment: any) => comment.isDecision).length,
    }),
    [comments],
  );
  const repliesByParent = useMemo(
    () => groupVideoCommentReplies(comments),
    [comments],
  );
  const shown = filterVideoComments(comments, filter);

  const loadCollaboration = useCallback(async (versionId: string, quiet = true) => {
    if (!versionId) return;
    const result: any = await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-collaboration?versionId=${encodeURIComponent(versionId)}`,
    ).catch(() => null);
    if (result) setCollab(result);
  }, [projectId]);

  useEffect(() => {
    if (!current?.id) return;
    void loadCollaboration(current.id, false);
    const needsPolling = collab.liveSession ||
      collab.captions?.some((caption: any) => caption.status === "inprogress") ||
      collab.qc?.some((result: any) => result.status === "running");
    if (!needsPolling) return;
    const interval = window.setInterval(() => loadCollaboration(current.id), collab.liveSession ? 1200 : 5000);
    return () => window.clearInterval(interval);
  }, [current?.id, collab.liveSession?.id, collab.captions?.map((caption: any) => caption.status).join(","), collab.qc?.map((result: any) => result.status).join(","), loadCollaboration]);

  useEffect(() => {
    if (!current?.streamUid || current.streamReady || current.streamState === "error") return;
    const interval = window.setInterval(() => load(current.id, true), 5000);
    return () => window.clearInterval(interval);
  }, [current?.id, current?.streamUid, current?.streamReady, current?.streamState, load]);

  const selectVersion = async (id: string) => {
    setSelectedVersionId(id);
    await load(id);
  };
  const addComment = async (input: any) => {
    if (!current) return;
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-comments`,
      { method: "POST", body: { ...input, versionId: current.id } },
    );
    await load(current.id, true);
  };
  const replyTo = async (comment: any) => {
    const reply = window.prompt(
      `Svar på kommentaren fra ${comment.clientName || "teamet"}:`,
    );
    if (!reply?.trim()) return;
    await addComment({
      parentId: comment.id,
      timecodeSec: comment.timecodeSec,
      comment: reply.trim(),
      category: comment.category,
      priority: comment.priority,
    });
  };
  const updateComment = async (comment: any, change: any) => {
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-comments/${comment.id}`,
      { method: "PATCH", body: change },
    );
    await load(current?.id, true);
  };
  const editComment = async (comment: any) => {
    const next = window.prompt("Rediger kommentar:", comment.comment);
    if (!next?.trim() || next === comment.comment) return;
    await updateComment(comment, { comment: next.trim() });
  };
  const removeComment = async (comment: any) => {
    if (!window.confirm("Slette kommentaren og eventuelle svar?")) return;
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-comments/${comment.id}`,
      { method: "DELETE" },
    );
    await load(current?.id, true);
  };
  const turnIntoTask = async (comment: any) => {
    const member = collab.members?.[0];
    const assignedToName = window.prompt("Tildel editor (navn):", member?.name || "");
    if (assignedToName === null) return;
    const assignedToEmail = window.prompt("Editorens e-post (valgfritt):", member?.email || "");
    if (assignedToEmail === null) return;
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-comments/${comment.id}/task`, {
      method: "POST", body: { title: comment.comment, assignedToName: assignedToName.trim(), assignedToEmail: assignedToEmail.trim() },
    });
    await loadCollaboration(current.id);
  };
  const updateTask = async (task: any, status: string) => {
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-tasks/${task.id}`, { method: "PATCH", body: { status } });
    await Promise.all([loadCollaboration(current.id), load(current.id, true)]);
  };
  const startRound = async () => {
    const maxRounds = Number(window.prompt("Maks antall revisjonsrunder:", "3")); if (!maxRounds) return;
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-rounds`, { method: "POST", body: { versionId: current.id, maxRounds } });
    await loadCollaboration(current.id);
  };
  const closeRound = async (round: any) => {
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-rounds/${round.id}`, { method: "PATCH", body: { status: "closed" } });
    await loadCollaboration(current.id);
  };
  const createApprovalStep = async () => {
    const name = window.prompt("Navn på approval-steget:", "Kundegodkjenning"); if (!name?.trim()) return;
    const emails = (window.prompt("Godkjennere (kommaseparerte e-poster):", "") || "").split(",").map((email) => email.trim()).filter(Boolean);
    if (!emails.length) return;
    const result: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-approval-steps`, { method: "POST", body: { versionId: current.id, name, approvers: emails.map((email) => ({ email })), requiredApprovals: emails.length } });
    const links = (result.invitations || []).map((invite: any) => `${invite.email}: ${new URL(invite.path, window.location.origin)}`).join("\n");
    await navigator.clipboard?.writeText(links); window.alert("Approval-lenkene er kopiert.\n\n" + links);
    await loadCollaboration(current.id);
  };
  const generateTranscript = async () => {
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-transcription/generate`, { method: "POST", body: { versionId: current.id, language: "no" } });
    await loadCollaboration(current.id);
  };
  const runQc = async () => {
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-qc`, { method: "POST", body: { versionId: current.id, profile: "client_delivery" } });
    await loadCollaboration(current.id);
  };
  const exportMarkers = async (editor: string, format?: string) => {
    const base = `/api/projects/${encodeURIComponent(projectId)}/video-marker-sync/${editor}?versionId=${encodeURIComponent(current.id)}`;
    if (format === "fcpxml") { window.open(`${base}&format=fcpxml`, "_blank", "noopener"); return; }
    const payload = await apiRequest(base); const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `creatorhub-${editor}-markers.json`; anchor.click(); URL.revokeObjectURL(url);
  };
  const importMarkers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      const content = await file.text();
      let editor = "generic";
      let markers: any[] = [];
      if (/\.(?:fcpxml|xml)$/i.test(file.name) || content.trimStart().startsWith("<")) {
        editor = "final_cut";
        const documentXml = new DOMParser().parseFromString(content, "application/xml");
        if (documentXml.querySelector("parsererror")) throw new Error("Ugyldig FCPXML-fil");
        const seconds = (raw: string | null) => {
          const match = String(raw || "0s").match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?s$/);
          return match ? Number(match[1]) / Number(match[2] || 1) : 0;
        };
        markers = Array.from(documentXml.querySelectorAll("marker")).map((node, index) => {
          const rawTitle = node.getAttribute("value") || `FCP-markør ${index + 1}`;
          const mustFix = rawTitle.startsWith("[MÅ FIKSES] ");
          const timecodeSec = seconds(node.getAttribute("start"));
          return {
            id: node.getAttribute("id") || `final-cut:${timecodeSec.toFixed(3)}:${rawTitle}`,
            timecodeSec,
            title: rawTitle.replace(/^\[MÅ FIKSES\]\s*/, ""),
            note: node.getAttribute("note") || rawTitle,
            completed: node.getAttribute("completed") === "1",
            mustFix,
          };
        });
      } else {
        const parsed = JSON.parse(content);
        markers = Array.isArray(parsed) ? parsed : parsed.markers;
        const suggestedEditor = ["resolve", "premiere", "final_cut"].includes(parsed.editor) ? parsed.editor : "resolve";
        const selected = window.prompt("Kilde: resolve, premiere eller final_cut", suggestedEditor);
        if (selected === null) return;
        if (!["resolve", "premiere", "final_cut"].includes(selected)) throw new Error("Ukjent NLE-kilde");
        editor = selected;
      }
      if (!Array.isArray(markers) || !markers.length) throw new Error("Fant ingen markører i filen");
      const result: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-marker-sync/${editor}`, {
        method: "POST", body: { versionId: current.id, markers },
      });
      window.alert(`${result.imported || 0} markører synkronisert fra ${editor}.`);
      await Promise.all([load(current.id, true), loadCollaboration(current.id)]);
    } catch (error: any) {
      window.alert(error?.message || "Kunne ikke importere markørene");
    }
  };
  const startLive = async () => {
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-live`, { method: "POST", body: { versionId: current.id, playheadSec: 0, isPlaying: false } });
    await loadCollaboration(current.id);
  };
  const stopLive = async () => {
    if (!collab.liveSession) return;
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-live/${collab.liveSession.id}`, { method: "DELETE" });
    setCollab((previous: any) => ({ ...previous, liveSession: null }));
  };
  const pushLive = useCallback((state: any) => {
    const live = collab.liveSession;
    if (!live || live.host_user_id !== collab.viewerUserId) return;
    clearTimeout(livePushTimer.current);
    livePushTimer.current = setTimeout(async () => {
      const updated: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-live/${live.id}`, {
        method: "PATCH", body: { revision: live.revision, playheadSec: state.timecodeSec, isPlaying: state.isPlaying, drawing: live.drawing },
      }).catch((error) => error?.current || null);
      if (updated?.id) setCollab((previous: any) => ({ ...previous, liveSession: updated }));
    }, state.reason === "time" ? 450 : 0);
  }, [collab.liveSession, collab.viewerUserId, projectId]);
  const pushLiveDrawing = useCallback(async (annotation: any, timecodeSec: number) => {
    const live = collab.liveSession; if (!live) return;
    const updated: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/video-live/${live.id}`, {
      method: "PATCH", body: { revision: live.revision, playheadSec: timecodeSec, isPlaying: false, drawing: annotation },
    });
    setCollab((previous: any) => ({ ...previous, liveSession: updated }));
  }, [collab.liveSession, projectId]);
  const makeDecision = async (decision: "approved" | "changes_requested") => {
    if (!current) return;
    const note =
      window.prompt(
        decision === "approved"
          ? "Valgfri godkjenningsnote:"
          : "Hva må endres?",
      ) ?? "";
    if (decision === "changes_requested" && !note.trim()) return;
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-versions/${current.id}/${decision === "approved" ? "approve" : "request-changes"}`,
      { method: "POST", body: { note } },
    );
    await load(current.id);
  };
  const renameVersion = async (version: any) => {
    const label = window.prompt("Nytt versjonsnavn:", version.versionLabel);
    if (!label?.trim()) return;
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-versions/${version.id}`,
      { method: "PATCH", body: { versionLabel: label.trim() } },
    );
    await load(version.id);
  };
  const removeVersion = async (version: any) => {
    if (
      !window.confirm(
        `Slette ${version.versionLabel}, alle kommentarer og lagret videofil? Dette kan ikke angres.`,
      )
    )
      return;
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-versions/${version.id}`,
      { method: "DELETE" },
    );
    await load();
  };

  const uploadVersion = async () => {
    if (!vFile) return;
    setBusy(true);
    setUploadPct(0);
    try {
      const uploaded = await uploadVideoToCloudflareStream({
        projectId,
        file: vFile,
        versionLabel: vLabel.trim() || undefined,
        onProgress: setUploadPct,
      });
      setAddOpen(false);
      setVFile(null);
      setVLabel("");
      setUploadPct(0);
      await load(uploaded.versionId);
    } catch (error: any) {
      window.alert(error?.message || "Kunne ikke laste opp");
    } finally {
      setBusy(false);
    }
  };

  const importVersion = async () => {
    if (!vImportUrl.trim()) return;
    setBusy(true);
    try {
      const uploaded: any = await apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/video-versions/import`,
        { method: "POST", body: { sourceUrl: vImportUrl.trim(), versionLabel: vLabel.trim() || undefined } },
      );
      setAddOpen(false); setVImportUrl(""); setVLabel("");
      await load(uploaded.id);
    } catch (error: any) {
      window.alert(error?.message || "Kunne ikke importere videolenken");
    } finally { setBusy(false); }
  };

  const openChapters = () => {
    setChapterDraft(
      chapters.length
        ? chapters
        : [{ startSec: 0, title: "Introduksjon", intro: "" }],
    );
    setChapterOpen(true);
  };
  const saveChapters = async () => {
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-versions/${current.id}/chapters`,
      { method: "PATCH", body: { chapters: chapterDraft } },
    );
    setChapterOpen(false);
    await load(current.id);
  };
  const openCompare = () => {
    const alternative = versions.find(
      (version: any) => version.id !== current?.id,
    );
    if (!alternative) return;
    setCompareVersionId(alternative.id);
    setCompareOpen(true);
  };
  const loadShares = async () => {
    const result: any = await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-review-links`,
    ).catch(() => ({ links: [] }));
    setShareLinks(result?.links || []);
  };
  const openShare = () => {
    setNewShareUrl("");
    setShareOpen(true);
    loadShares();
  };
  const createShare = async () => {
    const result: any = await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-review-links`,
      {
        method: "POST",
        body: {
          accessMode: shareAccess,
          versionId: current.id,
          password: sharePassword || undefined,
          allowVersionHistory: shareHistory,
          requireIdentity: true,
          allowDownload: shareDownload,
          recipientName: shareRecipientName.trim() || undefined,
          recipientEmail: shareRecipientEmail.trim() || undefined,
          watermarkEnabled: shareWatermark,
          watermarkText: shareWatermarkText.trim() || undefined,
        },
      },
    );
    const url = new URL(result.path, window.location.origin).toString();
    setNewShareUrl(url);
    await navigator.clipboard?.writeText(url);
    loadShares();
  };
  const revokeShare = async (id: string) => {
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/video-review-links/${id}`,
      { method: "DELETE" },
    );
    loadShares();
  };

  const setConsent = async (consented: boolean) => {
    await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/ai/consent`,
      { method: "PUT", body: { consented } },
    );
    await loadAi();
  };
  const buyPack = async (packId: string) => {
    const result: any = await apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/ai/credits/checkout`,
      {
        method: "POST",
        body: { packId, returnPath: `/workspace/${projectId}/video-room` },
      },
    );
    if (result?.url) window.location.href = result.url;
  };
  const startRestyle = async () => {
    if (!current?.id || !rePrompt.trim() || reBusy) return;
    setReBusy(true);
    try {
      const result: any = await apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/ai/video-restyle`,
        {
          method: "POST",
          body: {
            versionId: current.id,
            prompt: rePrompt.trim(),
            maxResolution: reRes,
          },
        },
      );
      setReJob({
        id: result.jobId,
        status: "queued",
        kind: "video-to-video",
        prompt: rePrompt.trim(),
      });
    } catch (error: any) {
      if (/kreditt|insufficient/i.test(String(error?.message))) {
        setReOpen(false);
        setBuyOpen(true);
      } else window.alert(error?.message || "Restyle feilet");
    } finally {
      setReBusy(false);
    }
  };

  if (loading && !data)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress sx={{ color: ws.accent }} />
      </Box>
    );
  const phaseIdx =
    current?.status === "approved"
      ? 4
      : versions.length === 0
        ? 0
        : counts.open > 0 || current?.status === "changes_requested"
          ? 2
          : 3;
  const statusTag = (status: string) =>
    status === "approved" ? (
      <WsTag label="Godkjent" tone="green" />
    ) : status === "under_review" ? (
      <WsTag label="Under review" tone="amber" />
    ) : status === "changes_requested" ? (
      <WsTag label="Endringer ønsket" tone="red" />
    ) : status === "superseded" ? (
      <WsTag label="Erstattet" tone="neutral" />
    ) : (
      <WsTag label={status || "Pending"} tone="neutral" />
    );

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        gap={1.5}
        alignItems={{ md: "flex-start" }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>
              Video Room
            </Typography>
            {current && statusTag(current.status)}
            {vrLive && (
              <Chip
                size="small"
                label="● Live"
                sx={{ color: ws.green, bgcolor: ws.greenSoft }}
              />
            )}
          </Stack>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>
            Ett felles review-rom for team og klient: versjoner, frame-presis
            feedback, beslutninger og eksport.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {current && (
            <Button
              startIcon={<Summarize />}
              onClick={() => setReportOpen(true)}
              sx={{ color: ws.text, textTransform: "none" }}
            >
              Review-rapport
            </Button>
          )}
          {canEdit && (
            <Button
              startIcon={<Share />}
              onClick={openShare}
              sx={{ color: ws.text, textTransform: "none" }}
            >
              Klientlenke
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            onClick={() => setAddOpen(true)}
            disabled={!canEdit}
            sx={{
              color: ws.accent,
              borderColor: ws.accentBorder,
              textTransform: "none",
              fontWeight: 700,
            }}
          >
            Ny versjon
          </Button>
        </Stack>
      </Stack>

      {!current && (
        <WsCard
          sx={{
            bgcolor: ws.accentSoft,
            border: `1px solid ${ws.accentBorder}`,
          }}
        >
          <Typography sx={{ fontSize: 13.5, mb: 1 }}>
            Ingen video er lastet opp ennå.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setAddOpen(true)}
            disabled={!canEdit}
            sx={{ bgcolor: ws.accent }}
          >
            Legg til V1
          </Button>
        </WsCard>
      )}

      {current && (
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2.5}
          alignItems="flex-start"
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <WsCard pad={0} sx={{ overflow: "hidden", mb: 2 }}>
              {current.fileUrl ? (
                <CinematicVideoPlayer
                  key={current.id}
                  src={current.fileUrl}
                  poster={current.thumbnailUrl}
                  title={current.versionLabel}
                  chapters={chapters}
                  comments={comments}
                  aspectRatio="16 / 9"
                  onAddComment={addComment}
                  activeCommentId={activeCommentId}
                  seekToSec={collab.liveSession && collab.liveSession.host_user_id !== collab.viewerUserId
                    ? Number(collab.liveSession.playhead_sec)
                    : seekToSec}
                  syncIsPlaying={collab.liveSession && collab.liveSession.host_user_id !== collab.viewerUserId
                    ? Boolean(collab.liveSession.is_playing)
                    : null}
                  liveAnnotation={collab.liveSession?.drawing || null}
                  onPlaybackState={collab.liveSession ? pushLive : undefined}
                  onLiveAnnotation={collab.liveSession ? pushLiveDrawing : undefined}
                />
              ) : (
                <Box
                  sx={{
                    aspectRatio: "16 / 9",
                    display: "grid",
                    placeItems: "center",
                    color: ws.textFaint,
                  }}
                >
                  <Stack alignItems="center" spacing={1}>
                    <CircularProgress size={24} sx={{ color: ws.accent }} />
                    <Typography sx={{ fontSize: 12, color: ws.textFaint }}>
                      {current.streamState === "error"
                        ? `Behandling feilet: ${current.streamError || "ukjent feil"}`
                        : current.streamProgress != null
                          ? `Cloudflare behandler videoen · ${Math.round(current.streamProgress)} %`
                          : "Cloudflare behandler videoen. Avspilling aktiveres når alle kvaliteter er klare."}
                    </Typography>
                  </Stack>
                </Box>
              )}
            </WsCard>

            <WsCard sx={{ mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ mb: 1.25 }}>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Etterarbeidsflyt</Typography>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint }}>Oppgaver → NLE-markører → revisjonsrunde → formell godkjenning</Typography>
                </Box>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  <Button size="small" startIcon={<SyncAlt />} onClick={() => exportMarkers("resolve")}>Resolve ut</Button>
                  <Button size="small" startIcon={<SyncAlt />} onClick={() => exportMarkers("premiere")}>Premiere ut</Button>
                  <Button size="small" startIcon={<SyncAlt />} onClick={() => exportMarkers("final_cut", "fcpxml")}>FCPXML ut</Button>
                  {canEdit && <Button size="small" variant="outlined" startIcon={<CloudUpload />} onClick={() => markerImportInput.current?.click()}>Markører inn</Button>}
                  <Box component="input" ref={markerImportInput} type="file" accept=".json,.xml,.fcpxml,application/json,application/xml,text/xml" onChange={importMarkers} sx={{ display: "none" }} />
                </Stack>
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                {canEdit && <Button size="small" variant="outlined" startIcon={<AssignmentTurnedIn />} onClick={startRound}>Ny revisjonsrunde</Button>}
                {canEdit && <Button size="small" variant="outlined" startIcon={<Groups />} onClick={createApprovalStep}>Approval-steg</Button>}
                {canEdit && <Button size="small" variant="outlined" startIcon={<Subtitles />} onClick={generateTranscript} disabled={!current.streamReady}>Transkriber</Button>}
                {canEdit && <Button size="small" variant="outlined" startIcon={<FactCheck />} onClick={runQc} disabled={collab.qc?.some((result: any) => result.status === "running")}>{collab.qc?.some((result: any) => result.status === "running") ? "QC kjører …" : "Teknisk QC"}</Button>}
                {canEdit && !collab.liveSession && <Button size="small" variant="contained" onClick={startLive}>Start live review</Button>}
                {canEdit && collab.liveSession && <Button size="small" color="error" onClick={stopLive}>Avslutt live</Button>}
              </Stack>
              {collab.liveSession && <Typography sx={{ fontSize: 11.5, color: ws.green, mb: 1 }}>● Live review er aktiv · delt playhead og tegning · revisjon {collab.liveSession.revision}</Typography>}
              <Stack spacing={0.75}>
                {(collab.tasks || []).map((task: any) => (
                  <Stack key={task.id} direction="row" alignItems="center" spacing={1} sx={{ p: 1, bgcolor: ws.panelAlt, borderRadius: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 12, fontWeight: 700 }}>{task.title}</Typography>
                      <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{task.assigned_to_name || task.assigned_to_email || "Ikke tildelt"} · {task.priority}</Typography>
                    </Box>
                    <Select size="small" value={task.status} onChange={(event) => updateTask(task, event.target.value)} sx={{ fontSize: 11, minWidth: 112 }}>
                      <MenuItem value="todo">Må gjøres</MenuItem><MenuItem value="in_progress">Pågår</MenuItem><MenuItem value="blocked">Blokkert</MenuItem><MenuItem value="done">Ferdig</MenuItem>
                    </Select>
                  </Stack>
                ))}
                {!collab.tasks?.length && <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>Ingen editoroppgaver ennå. Gjør en «må fikses»-kommentar om til oppgave fra kommentarlisten.</Typography>}
              </Stack>
              {!!collab.rounds?.length && <Stack spacing={0.5} sx={{ mt: 1.5, pt: 1, borderTop: `1px solid ${ws.borderSoft}` }}>
                {collab.rounds.map((round: any) => <Stack key={round.id} direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Typography sx={{ fontSize: 11.5 }}>{round.name} · {round.round_number}/{round.max_rounds || "∞"}</Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <WsTag label={round.status} tone={round.status === "open" ? "amber" : "muted"} />
                    {canEdit && round.status === "open" && <Button size="small" onClick={() => closeRound(round)}>Lukk runde</Button>}
                  </Stack>
                </Stack>)}
              </Stack>}
              {!!collab.approvalSteps?.length && <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                {collab.approvalSteps.map((step: any) => <Stack key={step.id} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11.5 }}>{step.order + 1}. {step.name} · {step.approvers.filter((person: any) => person.status === "approved").length}/{step.requiredApprovals}</Typography><WsTag label={step.status} tone={step.status === "approved" ? "green" : step.status === "changes_requested" ? "red" : "amber"} /></Stack>)}
              </Stack>}
              {!!collab.transcript?.length && <Box sx={{ mt: 1.5, maxHeight: 150, overflowY: "auto", borderTop: `1px solid ${ws.borderSoft}`, pt: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, mb: 0.5 }}>Transkripsjon og tekstnavigasjon</Typography>
                {collab.transcript.map((segment: any) => <Stack key={segment.id} direction="row" spacing={1} onClick={() => setSeekToSec(Number(segment.start_sec))} sx={{ py: 0.35, cursor: "pointer", '&:hover': { bgcolor: ws.panelAlt } }}><Typography sx={{ fontSize: 10.5, color: ws.accent, minWidth: 40 }}>{fmtTc(segment.start_sec)}</Typography><Typography sx={{ fontSize: 11.5 }}>{segment.text}</Typography></Stack>)}
              </Box>}
              {!!collab.qc?.length && <Box sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: 11.5, color: collab.qc[0].status === "passed" ? ws.green : collab.qc[0].status === "failed" ? ws.red : ws.amber }}>
                  Siste QC: {collab.qc[0].status === "running" ? "kjører full filskann …" : `${collab.qc[0].status} · ${collab.qc[0].summary?.findingCount || 0} funn`}
                </Typography>
                {collab.qc[0].status !== "running" && <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.35 }}>
                  {collab.qc[0].summary?.integratedLufs != null && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{Number(collab.qc[0].summary.integratedLufs).toFixed(1)} LUFS</Typography>}
                  {collab.qc[0].summary?.truePeakDbfs != null && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{Number(collab.qc[0].summary.truePeakDbfs).toFixed(1)} dBFS peak</Typography>}
                  {!!collab.qc[0].summary?.blackSegmentCount && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{collab.qc[0].summary.blackSegmentCount} svarte partier</Typography>}
                  {!!collab.qc[0].summary?.freezeSegmentCount && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{collab.qc[0].summary.freezeSegmentCount} frys</Typography>}
                  {!!collab.qc[0].summary?.silenceSegmentCount && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{collab.qc[0].summary.silenceSegmentCount} stille partier</Typography>}
                  {collab.qc[0].summary?.captionCueCount != null && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{collab.qc[0].summary.captionCueCount} captions</Typography>}
                </Stack>}
                {collab.qc[0].status !== "running" && !!collab.qc[0].findings?.length && <Stack spacing={0.35} sx={{ mt: 0.75 }}>
                  {collab.qc[0].findings.slice(0, 6).map((finding: any, index: number) => <Stack key={`${finding.code}-${index}`} direction="row" spacing={0.75} alignItems="center" onClick={() => finding.startSec != null && setSeekToSec(Number(finding.startSec))} sx={{ cursor: finding.startSec != null ? "pointer" : "default" }}>
                    {finding.startSec != null && <Typography sx={{ minWidth: 34, fontSize: 10, color: ws.accent }}>{fmtTc(finding.startSec)}</Typography>}
                    <WsTag label={finding.severity} tone={finding.severity === "error" ? "red" : finding.severity === "warning" ? "amber" : "muted"} />
                    <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>{finding.message}</Typography>
                  </Stack>)}
                  {collab.qc[0].findings.length > 6 && <Typography sx={{ fontSize: 10, color: ws.textFaint }}>+ {collab.qc[0].findings.length - 6} flere funn i QC-resultatet</Typography>}
                </Stack>}
              </Box>}
            </WsCard>

            <WsCard sx={{ mb: 2 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1.25 }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                  Kapitler
                </Typography>
                {canEdit && (
                  <Button
                    size="small"
                    startIcon={<Segment />}
                    onClick={openChapters}
                    sx={{ textTransform: "none" }}
                  >
                    Rediger
                  </Button>
                )}
              </Stack>
              {chapters.length ? (
                <Stack direction="row" spacing={0.5}>
                  {chapters.map((chapter: any, index: number) => (
                    <Box
                      key={`${chapter.startSec}-${index}`}
                      sx={{
                        flex: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: ws.panelAlt,
                        borderTop: `2px solid ${[ws.accent, ws.amber, ws.green, ws.blue][index % 4]}`,
                      }}
                    >
                      <Typography noWrap sx={{ fontSize: 11, fontWeight: 700 }}>
                        {chapter.title}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: ws.textFaint }}>
                        {fmtTc(chapter.startSec)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: ws.textFaint, fontSize: 12 }}>
                  Ingen kapitler lagt inn.
                </Typography>
              )}
            </WsCard>

            <WsCard sx={{ mb: 2 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1.25 }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                  Versjoner
                </Typography>
                <Button
                  size="small"
                  startIcon={<Compare />}
                  onClick={openCompare}
                  disabled={versions.length < 2}
                  sx={{ textTransform: "none" }}
                >
                  Sammenlign
                </Button>
              </Stack>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ overflowX: "auto", pb: 0.5 }}
              >
                {versions.map((version: any) => (
                  <Box
                    key={version.id}
                    data-testid={`video-version-${version.id}`}
                    onClick={() => selectVersion(version.id)}
                    sx={{
                      minWidth: 180,
                      p: 1.25,
                      borderRadius: `${ws.radiusSm}px`,
                      bgcolor: ws.panelAlt,
                      border: `1px solid ${version.id === current.id ? ws.accentBorder : ws.borderSoft}`,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>
                        {version.versionLabel}
                      </Typography>
                      {statusTag(version.status)}
                    </Stack>
                    <Typography
                      sx={{ fontSize: 10.5, color: ws.textFaint, mt: 0.5 }}
                    >
                      {version.commentCount} kommentarer
                      {version.openCount ? ` · ${version.openCount} uløst` : ""}
                      {!version.streamReady && version.streamUid ? ` · ${version.streamState || "behandles"}` : ""}
                    </Typography>
                    {canEdit && version.id === current.id && (
                      <Stack
                        direction="row"
                        spacing={0.25}
                        sx={{ mt: 0.5 }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <IconButton
                          size="small"
                          aria-label="Gi versjonen nytt navn"
                          onClick={() => renameVersion(version)}
                        >
                          <DriveFileRenameOutline fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Last ned versjon"
                          onClick={() =>
                            downloadPath(
                              `/api/projects/${encodeURIComponent(projectId)}/video-versions/${version.id}/download`,
                            )
                          }
                        >
                          <Download fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Slett versjon"
                          onClick={() => removeVersion(version)}
                          sx={{ color: ws.red }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </Box>
                ))}
              </Stack>
            </WsCard>

            <WsCard>
              <Stack direction="row" spacing={1} alignItems="center">
                {PHASES.map((phase, index) => (
                  <React.Fragment key={phase}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          bgcolor:
                            index < phaseIdx
                              ? ws.green
                              : index === phaseIdx
                                ? ws.accent
                                : "transparent",
                          border:
                            index > phaseIdx
                              ? `1.5px solid ${ws.border}`
                              : "none",
                        }}
                      >
                        {index < phaseIdx ? (
                          <CheckCircle sx={{ fontSize: 12, color: "#fff" }} />
                        ) : (
                          <Typography sx={{ fontSize: 10 }}>
                            {index + 1}
                          </Typography>
                        )}
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 11.5,
                          fontWeight: index === phaseIdx ? 700 : 500,
                          color: index <= phaseIdx ? ws.text : ws.textFaint,
                        }}
                      >
                        {phase}
                      </Typography>
                    </Stack>
                    {index < PHASES.length - 1 && (
                      <Box
                        sx={{
                          flex: 1,
                          height: 1.5,
                          bgcolor: index < phaseIdx ? ws.green : ws.border,
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </Stack>
            </WsCard>
          </Box>

          <Box sx={{ width: { xs: "100%", lg: 360 }, flexShrink: 0 }}>
            <WsCard sx={{ p: 0, overflow: "hidden" }}>
              <Box sx={{ p: 1.5, borderBottom: `1px solid ${ws.borderSoft}` }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, mb: 1 }}>
                  Kommentarer · {current.versionLabel}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {[
                    ["alle", `Alle ${counts.all}`],
                    ["uloste", `Uløste ${counts.open}`],
                    ["loste", `Løste ${counts.resolved}`],
                    ["beslutninger", `Beslutninger ${counts.decisions}`],
                  ].map(([key, label]) => (
                    <Box
                      key={key}
                      onClick={() => setFilter(key)}
                      sx={{
                        px: 1,
                        py: 0.4,
                        borderRadius: 2,
                        cursor: "pointer",
                        fontSize: 11.5,
                        fontWeight: filter === key ? 700 : 500,
                        color: filter === key ? ws.accent : ws.textDim,
                        bgcolor:
                          filter === key
                            ? ws.accentSoft
                            : "rgba(255,255,255,.04)",
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Stack>
              </Box>
              <Stack
                sx={{ maxHeight: "calc(100dvh - 310px)", overflowY: "auto" }}
              >
                {!shown.length && (
                  <Typography
                    sx={{
                      fontSize: 12.5,
                      color: ws.textDim,
                      p: 2,
                      textAlign: "center",
                    }}
                  >
                    Ingen kommentarer på denne versjonen.
                  </Typography>
                )}
                {shown.map((comment: any) => (
                  <Box
                    key={comment.id}
                    onMouseEnter={() => setActiveCommentId(comment.id)}
                    onMouseLeave={() => setActiveCommentId(null)}
                    sx={{ p: 1.5, borderBottom: `1px solid ${ws.borderSoft}` }}
                  >
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                    >
                      <Chip
                        onClick={() => {
                          setSeekToSec(comment.timecodeSec);
                          setActiveCommentId(comment.id);
                        }}
                        label={fmtTc(comment.timecodeSec)}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10.5,
                          color: ws.accent,
                          bgcolor: ws.accentSoft,
                          cursor: "pointer",
                        }}
                      />
                      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                        {comment.clientName || "Team"}
                      </Typography>
                      {comment.isDecision && (
                        <WsTag label="Beslutning" tone="blue" />
                      )}
                      {comment.annotation && (
                        <WsTag label="Markering" tone="amber" />
                      )}
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ my: 0.6 }}>
                      {comment.category && (
                        <Chip
                          size="small"
                          label={comment.category}
                          sx={{ height: 18, fontSize: 9 }}
                        />
                      )}
                      {comment.priority && (
                        <Chip
                          size="small"
                          label={comment.priority}
                          sx={{ height: 18, fontSize: 9 }}
                        />
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: ws.text }}>
                      {comment.comment}
                    </Typography>
                    {(repliesByParent[comment.id] || []).map((reply: any) => (
                      <Box
                        key={reply.id}
                        sx={{
                          ml: 2,
                          mt: 1,
                          pl: 1,
                          borderLeft: `2px solid ${ws.accentBorder}`,
                        }}
                      >
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700 }}>
                          {reply.clientName || "Team"} ·{" "}
                          {fmtTc(reply.timecodeSec)}
                        </Typography>
                        <Typography sx={{ fontSize: 12 }}>
                          {reply.comment}
                        </Typography>
                        {canEdit && (
                          <Stack direction="row" spacing={0.5}>
                            <Button
                              size="small"
                              onClick={() => editComment(reply)}
                              sx={{
                                minWidth: 0,
                                fontSize: 10,
                                textTransform: "none",
                              }}
                            >
                              Rediger
                            </Button>
                            <IconButton
                              size="small"
                              aria-label="Slett svar"
                              onClick={() => removeComment(reply)}
                            >
                              <DeleteOutline sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Stack>
                        )}
                      </Box>
                    ))}
                    <Stack direction="row" spacing={0.25} sx={{ mt: 0.75 }}>
                      <Button
                        size="small"
                        startIcon={<Reply />}
                        onClick={() => replyTo(comment)}
                        sx={{ fontSize: 10.5, textTransform: "none" }}
                      >
                        Svar
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            size="small"
                            startIcon={<CheckCircle />}
                            onClick={() =>
                              updateComment(comment, {
                                status: ["resolved", "done"].includes(
                                  comment.status,
                                )
                                  ? "open"
                                  : "resolved",
                              })
                            }
                            sx={{
                              fontSize: 10.5,
                              textTransform: "none",
                              color: ["resolved", "done"].includes(
                                comment.status,
                              )
                                ? ws.green
                                : ws.textDim,
                            }}
                          >
                            {["resolved", "done"].includes(comment.status)
                              ? "Løst"
                              : "Løs"}
                          </Button>
                          {comment.priority === "must-fix" && !collab.tasks?.some((task: any) => task.comment_id === comment.id) && (
                            <Button size="small" startIcon={<AssignmentTurnedIn />} onClick={() => turnIntoTask(comment)} sx={{ fontSize: 10.5, textTransform: "none", color: ws.amber }}>
                              Tildel som oppgave
                            </Button>
                          )}
                          <Button
                            size="small"
                            onClick={() => editComment(comment)}
                            sx={{
                              minWidth: 0,
                              fontSize: 10.5,
                              textTransform: "none",
                            }}
                          >
                            Rediger
                          </Button>
                          <IconButton
                            size="small"
                            aria-label="Slett kommentar"
                            onClick={() => removeComment(comment)}
                          >
                            <DeleteOutline sx={{ fontSize: 15 }} />
                          </IconButton>
                        </>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </WsCard>
          </Box>
        </Stack>
      )}

      {current && canEdit && (
        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 2.5 }}
        >
          <Button
            variant="outlined"
            startIcon={<EditNote />}
            onClick={() => makeDecision("changes_requested")}
            sx={{
              color: ws.textDim,
              borderColor: ws.border,
              textTransform: "none",
            }}
          >
            Be om endringer
          </Button>
          {aiCfg?.settingsEnabled && aiCfg?.whitelisted && (
            <Button
              variant="outlined"
              startIcon={<AutoAwesome />}
              onClick={() => setReOpen(true)}
              sx={{
                color: ws.accent,
                borderColor: ws.accentBorder,
                textTransform: "none",
              }}
            >
              Restyle / Relight
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            onClick={() => setAddOpen(true)}
            sx={{
              color: ws.text,
              borderColor: ws.border,
              textTransform: "none",
            }}
          >
            Last opp ny versjon
          </Button>
          <Button
            variant="contained"
            startIcon={<CheckCircle />}
            onClick={() => makeDecision("approved")}
            disabled={current.status === "approved"}
            sx={{
              bgcolor: ws.green,
              color: ws.bg,
              textTransform: "none",
              fontWeight: 700,
            }}
          >
            {current.status === "approved" ? "Godkjent" : "Godkjenn video"}
          </Button>
        </Stack>
      )}

      <WsModal
        open={addOpen}
        onClose={() => !busy && setAddOpen(false)}
        title="Ny videoversjon"
        maxWidth="sm"
      >
        <Stack spacing={2}>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>
            Store videofiler lastes direkte og resumérbart til privat
            Cloudflare Stream. Du kan også importere en offentlig HTTPS-lenke.
          </Typography>
          <Box
            component="label"
            sx={{
              p: 2,
              border: `1.5px dashed ${ws.accentBorder}`,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <input
              type="file"
              accept="video/*"
              hidden
              disabled={busy}
              onChange={(event) => setVFile(event.target.files?.[0] || null)}
            />
            <CloudUpload sx={{ color: ws.accent }} />
            <Typography>{vFile?.name || "Velg videofil"}</Typography>
          </Box>
          <TextField
            label="Versjonsnavn"
            value={vLabel}
            onChange={(event) => setVLabel(event.target.value)}
          />
          {busy && <Typography>Laster opp… {uploadPct}%</Typography>}
          <Divider>eller importer via lenke</Divider>
          <TextField
            label="Offentlig HTTPS-lenke til videofil"
            value={vImportUrl}
            onChange={(event) => setVImportUrl(event.target.value)}
            placeholder="https://…/video.mp4"
            disabled={busy}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setAddOpen(false)}>Avbryt</Button>
            <Button onClick={importVersion} disabled={!vImportUrl.trim() || busy}>
              Importer lenke
            </Button>
            <Button
              variant="contained"
              onClick={uploadVersion}
              disabled={!vFile || busy}
            >
              Last opp
            </Button>
          </Stack>
        </Stack>
      </WsModal>

      <WsModal
        open={chapterOpen}
        onClose={() => setChapterOpen(false)}
        title={`Kapitler · ${current?.versionLabel || ""}`}
        maxWidth="sm"
      >
        <Stack spacing={1.5}>
          {chapterDraft.map((chapter, index) => (
            <Stack key={index} direction="row" spacing={1}>
              <TextField
                size="small"
                type="number"
                label="Sekund"
                value={chapter.startSec}
                onChange={(event) =>
                  setChapterDraft((rows) =>
                    rows.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, startSec: Number(event.target.value) }
                        : row,
                    ),
                  )
                }
                sx={{ width: 100 }}
              />
              <TextField
                size="small"
                label="Tittel"
                value={chapter.title}
                onChange={(event) =>
                  setChapterDraft((rows) =>
                    rows.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, title: event.target.value }
                        : row,
                    ),
                  )
                }
                fullWidth
              />
              <IconButton
                onClick={() =>
                  setChapterDraft((rows) =>
                    rows.filter((_, rowIndex) => rowIndex !== index),
                  )
                }
              >
                <DeleteOutline />
              </IconButton>
            </Stack>
          ))}
          <Button
            onClick={() =>
              setChapterDraft((rows) => [
                ...rows,
                { startSec: 0, title: "", intro: "" },
              ])
            }
          >
            + Kapittel
          </Button>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button onClick={() => setChapterOpen(false)}>Avbryt</Button>
            <Button variant="contained" onClick={saveChapters}>
              Lagre kapitler
            </Button>
          </Stack>
        </Stack>
      </WsModal>

      <WsModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Sammenlign versjoner"
        maxWidth="xl"
      >
        <Stack spacing={2}>
          <Select
            size="small"
            value={compareVersionId}
            onChange={(event) => setCompareVersionId(event.target.value)}
          >
            {versions
              .filter((version: any) => version.id !== current?.id)
              .map((version: any) => (
                <MenuItem key={version.id} value={version.id}>
                  {version.versionLabel}
                </MenuItem>
              ))}
          </Select>
          {current &&
            versions.find(
              (version: any) => version.id === compareVersionId,
            ) && (
              <VideoVersionCompare
                left={versions.find(
                  (version: any) => version.id === compareVersionId,
                )}
                right={current}
              />
            )}
        </Stack>
      </WsModal>

      <WsModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={`Review-rapport · ${current?.versionLabel || ""}`}
        maxWidth="lg"
      >
        <EditFeedbackSummary
          entries={comments}
          projectTitle={current?.versionLabel}
          onSeek={(seconds) => {
            setSeekToSec(seconds);
            setReportOpen(false);
          }}
          onToggleResolved={
            canEdit
              ? (id, status) => {
                  const comment = comments.find((item: any) => item.id === id);
                  if (comment) updateComment(comment, { status });
                }
              : undefined
          }
          onReply={(parentId, comment) => {
            const parent = comments.find((item: any) => item.id === parentId);
            return addComment({
              parentId,
              timecodeSec: parent?.timecodeSec || 0,
              comment,
            });
          }}
        />
      </WsModal>

      <WsModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Del klient-review"
        maxWidth="sm"
      >
        <Stack spacing={2}>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>
            Lenken viser de samme versjonene, kommentarene, trådene og
            beslutningene som teamet ser her.
          </Typography>
          <Select
            value={shareAccess}
            onChange={(event) => setShareAccess(event.target.value)}
          >
            <MenuItem value="view">Kun visning</MenuItem>
            <MenuItem value="comment">Kommentere</MenuItem>
            <MenuItem value="approve">Kommentere og godkjenne</MenuItem>
          </Select>
          <TextField
            label="Passord (valgfritt)"
            type="password"
            value={sharePassword}
            onChange={(event) => setSharePassword(event.target.value)}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              fullWidth
              label="Mottakerens navn"
              value={shareRecipientName}
              onChange={(event) => setShareRecipientName(event.target.value)}
            />
            <TextField
              fullWidth
              type="email"
              label="Mottakerens e-post"
              value={shareRecipientEmail}
              onChange={(event) => setShareRecipientEmail(event.target.value)}
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={shareWatermark}
                onChange={(event) => {
                  setShareWatermark(event.target.checked);
                  if (event.target.checked) setShareDownload(false);
                }}
              />
            }
            label="Vis mottakerspesifikt vannmerke over videoen"
          />
          {shareWatermark && (
            <TextField
              label="Vannmerketekst (valgfritt)"
              helperText="Bruker mottakerens e-post eller navn hvis feltet er tomt."
              value={shareWatermarkText}
              onChange={(event) => setShareWatermarkText(event.target.value)}
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={shareHistory}
                onChange={(event) => setShareHistory(event.target.checked)}
              />
            }
            label="Vis versjonshistorikk"
          />
          <FormControlLabel
            control={
              <Switch
                checked={shareDownload}
                onChange={(event) => setShareDownload(event.target.checked)}
                disabled={shareWatermark}
              />
            }
            label={shareWatermark ? "Nedlasting er av for vannmerkede reviewer" : "Tillat nedlasting"}
          />
          <Button
            variant="contained"
            startIcon={<Share />}
            onClick={createShare}
          >
            Opprett og kopier lenke
          </Button>
          {newShareUrl && (
            <Stack direction="row">
              <TextField
                size="small"
                fullWidth
                value={newShareUrl}
                InputProps={{ readOnly: true }}
              />
              <IconButton
                onClick={() => navigator.clipboard?.writeText(newShareUrl)}
              >
                <ContentCopy />
              </IconButton>
            </Stack>
          )}
          <Divider />
          <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
            Aktive og tidligere lenker
          </Typography>
          {!shareLinks.length && (
            <Typography sx={{ fontSize: 12, color: ws.textFaint }}>
              Ingen lenker ennå.
            </Typography>
          )}
          {shareLinks.map((link) => (
            <Stack
              key={link.id}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography
                sx={{
                  fontSize: 12,
                  color: link.revokedAt ? ws.textFaint : ws.text,
                }}
              >
                {link.accessMode} ·{" "}
                {link.allowVersionHistory ? "alle versjoner" : "aktiv versjon"}
                {link.recipientEmail ? ` · ${link.recipientEmail}` : ""}
                {link.watermarkEnabled ? " · vannmerket" : ""}
                {link.revokedAt ? " · deaktivert" : ""}
              </Typography>
              {!link.revokedAt && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => revokeShare(link.id)}
                >
                  Deaktiver
                </Button>
              )}
            </Stack>
          ))}
        </Stack>
      </WsModal>

      <WsModal
        open={reOpen}
        onClose={() => !reBusy && setReOpen(false)}
        title="Restyle / Relight (AI)"
        maxWidth="sm"
      >
        {!aiCfg?.beebleConfigured ? (
          <Typography>SwitchX (Beeble) er ikke konfigurert.</Typography>
        ) : !aiCfg?.consent?.consented ? (
          <Stack spacing={2}>
            <Typography sx={{ color: ws.amber }}>
              {wsIcon("WarningAmber", { fontSize: 15 })} Samtykke kreves fordi
              videoen sendes til tredjeparts AI.
            </Typography>
            <Button variant="contained" onClick={() => setConsent(true)}>
              Samtykk og fortsett
            </Button>
          </Stack>
        ) : reJob?.status === "completed" && reJob.afterUrl ? (
          <Stack spacing={2}>
            <Box
              component="video"
              src={reJob.afterUrl}
              controls
              sx={{ width: "100%", aspectRatio: "16 / 9", bgcolor: "#000" }}
            />
            <Stack direction="row" justifyContent="space-between">
              <Button onClick={() => setReJob(null)}>Ny</Button>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={() =>
                  downloadPath(
                    `/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${reJob.id}/download`,
                  )
                }
              >
                Last ned fil
              </Button>
            </Stack>
          </Stack>
        ) : ["queued", "running"].includes(reJob?.status) ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 3 }}>
            <CircularProgress />
            <Typography>
              AI-jobben fortsetter på serveren. Du kan forlate siden og komme
              tilbake.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField
              multiline
              minRows={2}
              label="Beskriv lys og stil"
              value={rePrompt}
              onChange={(event) => setRePrompt(event.target.value)}
            />
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {RE_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  label={preset}
                  onClick={() => setRePrompt(preset)}
                />
              ))}
            </Stack>
            <Select
              value={reRes}
              onChange={(event) => setReRes(Number(event.target.value))}
            >
              <MenuItem value={720}>720p</MenuItem>
              <MenuItem value={1080}>1080p</MenuItem>
            </Select>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: 11, color: ws.textFaint }}>
                ~$0,80 · saldo ${(credits?.balanceUsd || 0).toFixed(2)}
              </Typography>
              <Button
                variant="contained"
                disabled={!rePrompt.trim() || reBusy}
                onClick={startRestyle}
              >
                Start
              </Button>
            </Stack>
          </Stack>
        )}
        {aiVideoJobs.length > 0 && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${ws.borderSoft}` }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1 }}>
              Tidligere AI-jobber
            </Typography>
            <Stack spacing={0.75}>
              {aiVideoJobs.slice(0, 8).map((job) => (
                <Stack
                  key={job.id}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 11.5 }}>
                      {job.prompt || "Restyle / Relight"}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: ws.textFaint }}>
                      {job.status} ·{" "}
                      {new Date(job.createdAt).toLocaleString("nb-NO")}
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => setReJob(job)}>
                    Åpne
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </WsModal>
      <AiBuyCreditsModal
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        credits={credits}
        onBuy={buyPack}
      />
    </Box>
  );
};

export default VideoRoomTab;

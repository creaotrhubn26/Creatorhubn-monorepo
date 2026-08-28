import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRoute } from "wouter";
import "./mockup-review.css";

type ReviewTool = "select" | "pin" | "freehand" | "arrow" | "rect";
type ReviewPoint = { x: number; y: number };
type ReviewMark = {
  id: string;
  kind: "freehand" | "arrow" | "rect";
  points: ReviewPoint[];
  color: string;
  width: number;
};
type ReviewElement = {
  ref: string;
  kind: "device" | "image" | "text" | "annotation";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  path?: ReviewPoint[];
};
type PendingReviewAnchor = ReviewPoint & {
  marks: ReviewMark[];
  anchorKind: "canvas" | "element";
  anchorRef: string | null;
  anchorOffsetX: number | null;
  anchorOffsetY: number | null;
  elementLabel?: string;
};
type Version = {
  id: string;
  label: string;
  reviewStatus: string;
  preview?: string | null;
  payload?: { reviewPreview?: string };
};
type Attachment = {
  id: string;
  displayName: string;
  isRecording: boolean;
};
type Comment = {
  id: string;
  number: number;
  parentId: string | null;
  reviewerSessionId: string | null;
  authorDisplayName: string;
  body: string;
  anchorKind: "general" | "canvas" | "element";
  anchorRef?: string | null;
  anchorX: number | null;
  anchorY: number | null;
  anchorOffsetX?: number | null;
  anchorOffsetY?: number | null;
  marks?: ReviewMark[];
  status: string;
  createdAt: string;
  attachments: Attachment[];
  reactions: Record<string, number>;
};
type Decision = {
  id: string;
  versionId: string;
  decision: "approved" | "changes_requested" | "reset";
  note?: string | null;
  actorDisplayName: string;
  createdAt: string;
};
type ReviewData = {
  project: {
    name: string;
    preview: string | null;
    canvas?: { width?: number; height?: number };
    reviewElements?: ReviewElement[];
  };
  version: Version;
  versions: Version[];
  comments: Comment[];
  decisions?: Decision[];
  participants?: string[];
  share: {
    accessMode: "view" | "comment" | "approve";
    requireIdentity: boolean;
    allowRecordings: boolean;
    allowVersionHistory: boolean;
    commentsPaused: boolean;
  };
};
type Reviewer = { id: string; display_name?: string; displayName?: string };
type Presence = {
  participant_key: string;
  display_name: string;
  cursor_x: number | null;
  cursor_y: number | null;
};
type RecordingPreview = {
  blob: Blob;
  url: string;
  durationMs: number;
  transcript: string;
};
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  start: () => void;
  stop: () => void;
};

const API = "/api/role-room/mockup-shared";
const FILTERS = ["open", "all", "pinned", "general", "resolved"] as const;
const TOOLS: Array<[ReviewTool, string, string]> = [
  ["select", "Velg", "V"],
  ["pin", "Pin", "P"],
  ["freehand", "Frihånd", "F"],
  ["arrow", "Pil", "A"],
  ["rect", "Ramme", "R"],
];
const TOUR = [
  ["Marker i designet", "Velg Pin, Frihånd, Pil eller Ramme i verktøylinjen og klikk eller dra direkte på canvaset."],
  ["Jobb i tråder", "Klikk en pin for å åpne riktig tråd. Egne pins kan flyttes med Velg-verktøyet."],
  ["Avslutt runden", "Filtrer åpne kommentarer, legg ved filer eller opptak, og godkjenn når alt er avklart."],
];

function stored(key: string): string {
  try { return sessionStorage.getItem(key) || ""; } catch { return ""; }
}
function storedJson<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(key) || "null") as T | null; } catch { return null; }
}
function reviewStatusLabel(status?: string): string {
  return ({
    draft: "Kladd",
    in_review: "Til gjennomgang",
    changes_requested: "Endringer ønsket",
    approved: "Godkjent",
    superseded: "Erstattet",
  } as Record<string, string>)[status || ""] || status || "Kladd";
}
function decisionLabel(decision: Decision["decision"]): string {
  return decision === "approved" ? "Godkjent" : decision === "reset" ? "Tilbakestilt" : "Endringer ønsket";
}
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
function distanceToSegment(point: ReviewPoint, a: ReviewPoint, b: ReviewPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
function reviewElementAtPoint(elements: ReviewElement[], point: ReviewPoint): ReviewElement | null {
  return elements.filter((element) => {
    if (element.path?.length === 2 && distanceToSegment(point, element.path[0], element.path[1]) <= 0.025) return true;
    return point.x >= element.x && point.x <= element.x + element.w
      && point.y >= element.y && point.y <= element.y + element.h;
  }).sort((a, b) => {
    if (a.kind === "annotation" && b.kind !== "annotation") return -1;
    if (b.kind === "annotation" && a.kind !== "annotation") return 1;
    return a.w * a.h - b.w * b.h;
  })[0] || null;
}
function reviewAnchor(elements: ReviewElement[], point: ReviewPoint, marks: ReviewMark[]): PendingReviewAnchor {
  const element = reviewElementAtPoint(elements, point);
  if (!element) return {
    ...point, marks, anchorKind: "canvas", anchorRef: null,
    anchorOffsetX: null, anchorOffsetY: null,
  };
  return {
    ...point,
    marks,
    anchorKind: "element",
    anchorRef: element.ref,
    anchorOffsetX: clamp((point.x - element.x) / Math.max(0.0001, element.w)),
    anchorOffsetY: clamp((point.y - element.y) / Math.max(0.0001, element.h)),
    elementLabel: element.label,
  };
}
function makeId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "review-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}
async function requestJson<T>(url: string, init: RequestInit = {}, session = ""): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body instanceof FormData ? {} : init.body ? { "Content-Type": "application/json" } : {}),
      ...(session ? { "x-mockup-reviewer": session } : {}),
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    let message = "HTTP " + response.status;
    try {
      const body = await response.json() as { error?: string; detail?: string };
      message = body.detail || body.error || message;
    } catch { /* tom respons */ }
    throw new Error(message.replaceAll("_", " "));
  }
  return response.json() as Promise<T>;
}
function uploadAttachment(
  url: string,
  session: string,
  blob: Blob,
  name: string,
  recording: boolean,
  onProgress: (value: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", blob, name);
    form.append("isRecording", String(recording));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("x-mockup-reviewer", session);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Opplastingen mistet forbindelsen."));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error("Opplasting feilet (HTTP " + xhr.status + ")."));
    xhr.send(form);
  });
}

export default function MockupReviewPage() {
  const route = useRoute("/mockup-review/:token");
  const params = route[1] as { token: string } | null;
  const token = params?.token || "";
  const base = API + "/" + encodeURIComponent(token);
  const sessionKey = "mr:" + token;
  const [data, setData] = useState<ReviewData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [session, setSession] = useState(() => stored(sessionKey));
  const [reviewer, setReviewer] = useState<Reviewer | null>(() => storedJson<Reviewer>(sessionKey + "p"));
  const [identity, setIdentity] = useState({ displayName: "", email: "" });
  const [showIdentity, setShowIdentity] = useState(false);
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReviewAnchor | null>(null);
  const [draftMark, setDraftMark] = useState<ReviewMark | null>(null);
  const draftMarkRef = useRef<ReviewMark | null>(null);
  const [tool, setTool] = useState<ReviewTool>("select");
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pinsVisible, setPinsVisible] = useState(true);
  const [draggedPins, setDraggedPins] = useState<Record<string, ReviewPoint>>({});
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("open");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [presence, setPresence] = useState<Presence[]>([]);
  const [version, setVersion] = useState<Version | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reviewElements, setReviewElements] = useState<ReviewElement[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [compare, setCompare] = useState<Version | null>(null);
  const [split, setSplit] = useState(50);
  const [tourStep, setTourStep] = useState(() => {
    try { return localStorage.getItem("mr-tour-v2") === "1" ? -1 : 0; } catch { return 0; }
  });

  const [showRecorder, setShowRecorder] = useState(false);
  const [recordState, setRecordState] = useState<"setup" | "recording" | "paused" | "preview">("setup");
  const [recordOptions, setRecordOptions] = useState({ microphone: true, camera: false, systemAudio: true, transcript: false });
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [recordPreview, setRecordPreview] = useState<RecordingPreview | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const drawFrameRef = useRef<number | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartedRef = useRef(0);
  const transcriptRef = useRef("");
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const [liveCamera, setLiveCamera] = useState<MediaStream | null>(null);
  const presenceThrottle = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const next = await requestJson<ReviewData>(base);
      setData(next);
      if (!version || version.id === next.version.id) {
        setComments(next.comments || []);
        setVersion(next.version);
        setPreview(next.project.preview);
        setReviewElements(next.project.reviewElements || []);
        setDecisions(next.decisions || []);
      }
      setError("");
      if (!session && !next.share.requireIdentity) {
        const joined = await requestJson<{ reviewerToken: string; reviewer: Reviewer }>(
          base + "/session",
          { method: "POST", body: JSON.stringify({ displayName: "" }) },
        );
        sessionStorage.setItem(sessionKey, joined.reviewerToken);
        sessionStorage.setItem(sessionKey + "p", JSON.stringify(joined.reviewer));
        setSession(joined.reviewerToken);
        setReviewer(joined.reviewer);
      } else if (!session && next.share.accessMode !== "view") {
        setShowIdentity(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [base, session, sessionKey, token, version]);

  useEffect(() => { void load(); }, [token]);
  useEffect(() => {
    if (!base) return;
    const poll = () => void requestJson<{ presence: Presence[] }>(base + "/presence")
      .then((result) => setPresence(result.presence || []))
      .catch(() => undefined);
    poll();
    const id = window.setInterval(poll, 4_000);
    return () => window.clearInterval(id);
  }, [base]);
  useEffect(() => {
    if (!cameraPreviewRef.current) return;
    cameraPreviewRef.current.srcObject = liveCamera;
    if (liveCamera) void cameraPreviewRef.current.play().catch(() => undefined);
  }, [liveCamera, showRecorder, recordState]);
  useEffect(() => () => {
    if (recordPreview?.url) URL.revokeObjectURL(recordPreview.url);
    streamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
  }, [recordPreview?.url]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTool("select");
        setPending(null);
        setActiveCommentId(null);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const roots = useMemo(() => comments.filter((comment) => !comment.parentId), [comments]);
  const shown = useMemo(() => roots.filter((comment) => {
    if (filter === "open") return comment.status !== "resolved" && comment.status !== "wontfix";
    if (filter === "resolved") return comment.status === "resolved" || comment.status === "wontfix";
    if (filter === "pinned") return comment.anchorKind !== "general";
    if (filter === "general") return comment.anchorKind === "general";
    return true;
  }), [filter, roots]);
  const replies = useCallback((id: string) => comments.filter((comment) => comment.parentId === id), [comments]);
  const currentVersion = Boolean(version && data && version.id === data.version.id);
  const canComment = Boolean(
    data && session && data.share.accessMode !== "view" && !data.share.commentsPaused && currentVersion,
  );
  const reviewerName = reviewer?.display_name || reviewer?.displayName || "Gjest";
  const ratio = data?.project.canvas?.width && data.project.canvas.height
    ? String(data.project.canvas.width) + "/" + String(data.project.canvas.height)
    : "1/1";
  const currentDecisions = decisions.filter((item) => item.versionId === version?.id);
  const allMarks = [
    ...(pinsVisible ? shown.flatMap((comment) => comment.marks || []) : []),
    ...(pending?.marks || []),
    ...(draftMark ? [draftMark] : []),
  ];

  async function enter(event: FormEvent) {
    event.preventDefault();
    setBusy("identity");
    try {
      const joined = await requestJson<{ reviewerToken: string; reviewer: Reviewer }>(
        base + "/session",
        { method: "POST", body: JSON.stringify(identity) },
      );
      sessionStorage.setItem(sessionKey, joined.reviewerToken);
      sessionStorage.setItem(sessionKey + "p", JSON.stringify(joined.reviewer));
      setSession(joined.reviewerToken);
      setReviewer(joined.reviewer);
      setShowIdentity(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("");
    }
  }

  async function postComment(parentId?: string, recording?: RecordingPreview) {
    const body = recording ? (text.trim() || "Skjermopptak vedlagt") : parentId ? reply.trim() : text.trim();
    if (!session) { setShowIdentity(true); return; }
    if (!body) return;
    setBusy("comment");
    setUploadProgress(0);
    try {
      const result = await requestJson<{ comment: Comment }>(
        base + "/comments",
        {
          method: "POST",
          body: JSON.stringify({
            body,
            parentId,
            anchorKind: parentId || !pending ? "general" : pending.anchorKind,
            anchorRef: parentId ? null : pending?.anchorRef,
            anchorX: parentId ? null : pending?.x,
            anchorY: parentId ? null : pending?.y,
            anchorOffsetX: parentId ? null : pending?.anchorOffsetX,
            anchorOffsetY: parentId ? null : pending?.anchorOffsetY,
            marks: parentId ? [] : pending?.marks,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            context: recording ? {
              transcript: recording.transcript,
              recordingDurationMs: recording.durationMs,
            } : undefined,
          }),
        },
        session,
      );
      if (recording) {
        await uploadAttachment(
          base + "/comments/" + result.comment.id + "/attachments",
          session,
          recording.blob,
          "review-opptak.webm",
          true,
          setUploadProgress,
        );
      } else if (file && !parentId) {
        await uploadAttachment(
          base + "/comments/" + result.comment.id + "/attachments",
          session,
          file,
          file.name,
          false,
          setUploadProgress,
        );
      }
      setText("");
      setReply("");
      setReplyTo(null);
      setPending(null);
      setFile(null);
      setTool("select");
      setSuccess("Kommentaren er sendt.");
      if (recording) closeRecorder();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("");
      setUploadProgress(0);
    }
  }

  function react(comment: Comment, emoji: string) {
    if (!session) { setShowIdentity(true); return; }
    void requestJson(
      base + "/comments/" + comment.id + "/reactions",
      { method: "POST", body: JSON.stringify({ emoji }) },
      session,
    ).then(load).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }
  function toggleResolved(comment: Comment) {
    void requestJson(
      base + "/comments/" + comment.id,
      { method: "PATCH", body: JSON.stringify({ status: comment.status === "resolved" ? "open" : "resolved" }) },
      session,
    ).then(load).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }
  async function decision(value: "approved" | "changes_requested") {
    if (!session) { setShowIdentity(true); return; }
    setBusy("decision");
    try {
      await requestJson(
        base + "/decision",
        { method: "POST", body: JSON.stringify({ decision: value, note }) },
        session,
      );
      setSuccess(value === "approved" ? "Versjonen er godkjent." : "Endringsønsket er sendt.");
      setNote("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("");
    }
  }
  async function chooseVersion(next: Version) {
    if (next.id === data?.version.id) {
      setVersion(data.version);
      setPreview(data.project.preview);
      setComments(data.comments);
      setReviewElements(data.project.reviewElements || []);
      setDecisions(data.decisions || []);
      return;
    }
    try {
      const result = await requestJson<{
        version: Version;
        project?: { preview?: string | null; reviewElements?: ReviewElement[] };
        comments: Comment[];
        decisions?: Decision[];
      }>(base + "/versions/" + next.id);
      setVersion(result.version);
      setPreview(result.project?.preview || result.version.preview || result.version.payload?.reviewPreview || next.preview || null);
      setComments(result.comments);
      setReviewElements(result.project?.reviewElements || []);
      setDecisions(result.decisions || []);
      setActiveCommentId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function stagePoint(event: { clientX: number; clientY: number }, element: HTMLElement): ReviewPoint {
    const rect = element.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width)),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height)),
    };
  }
  function updateDraft(mark: ReviewMark | null) {
    draftMarkRef.current = mark;
    setDraftMark(mark);
  }
  function beginMarkup(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canComment || tool === "select") return;
    if ((event.target as HTMLElement).closest("button,a,input,select")) return;
    event.preventDefault();
    const point = stagePoint(event, event.currentTarget);
    if (tool === "pin") {
      setPending(reviewAnchor(reviewElements, point, []));
      setTool("select");
      return;
    }
    const mark: ReviewMark = {
      id: makeId(),
      kind: tool,
      points: [point, point],
      color: "#f97316",
      width: 3,
    };
    updateDraft(mark);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveMarkup(event: ReactPointerEvent<HTMLDivElement>) {
    const mark = draftMarkRef.current;
    if (!mark) return;
    const point = stagePoint(event, event.currentTarget);
    updateDraft({
      ...mark,
      points: mark.kind === "freehand" ? [...mark.points.slice(0, 499), point] : [mark.points[0], point],
    });
  }
  function finishMarkup(event: ReactPointerEvent<HTMLDivElement>) {
    const mark = draftMarkRef.current;
    if (!mark) return;
    event.preventDefault();
    const point = stagePoint(event, event.currentTarget);
    const finished = {
      ...mark,
      points: mark.kind === "freehand" ? mark.points : [mark.points[0], point],
    };
    updateDraft(null);
    setPending(reviewAnchor(reviewElements, finished.points[0], [finished]));
    setTool("select");
  }
  function movePresence(event: ReactPointerEvent<HTMLDivElement>) {
    if (!session || Date.now() - presenceThrottle.current < 900) return;
    presenceThrottle.current = Date.now();
    const point = stagePoint(event, event.currentTarget);
    void requestJson(
      base + "/presence",
      {
        method: "POST",
        body: JSON.stringify({
          cursorX: point.x,
          cursorY: point.y,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        }),
      },
      session,
    ).catch(() => undefined);
  }
  function beginPinDrag(comment: Comment, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setActiveCommentId(comment.id);
    document.getElementById("comment-" + comment.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (tool !== "select" || reviewer?.id !== comment.reviewerSessionId) return;
    const stage = event.currentTarget.closest(".mockup-review-stage") as HTMLElement | null;
    if (!stage) return;
    const abort = new AbortController();
    let moved = false;
    const move = (next: PointerEvent) => {
      moved = true;
      const point = stagePoint(next, stage);
      setDraggedPins((current) => ({ ...current, [comment.id]: point }));
    };
    const up = (next: PointerEvent) => {
      const point = stagePoint(next, stage);
      abort.abort();
      setDraggedPins((current) => {
        const copy = { ...current };
        delete copy[comment.id];
        return copy;
      });
      if (!moved) return;
      const anchor = reviewAnchor(reviewElements, point, comment.marks || []);
      void requestJson(
        base + "/comments/" + comment.id,
        {
          method: "PATCH",
          body: JSON.stringify({
            anchorKind: anchor.anchorKind,
            anchorRef: anchor.anchorRef,
            anchorX: anchor.x,
            anchorY: anchor.y,
            anchorOffsetX: anchor.anchorOffsetX,
            anchorOffsetY: anchor.anchorOffsetY,
            marks: comment.marks || [],
          }),
        },
        session,
      ).then(load).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    };
    window.addEventListener("pointermove", move, { signal: abort.signal });
    window.addEventListener("pointerup", up, { once: true, signal: abort.signal });
  }

  function cleanupRecordingStreams() {
    streamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    streamsRef.current = [];
    setLiveCamera(null);
    if (drawFrameRef.current != null) cancelAnimationFrame(drawFrameRef.current);
    drawFrameRef.current = null;
    if (recordTimerRef.current != null) window.clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    speechRef.current?.stop();
    speechRef.current = null;
  }
  function closeRecorder() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    cleanupRecordingStreams();
    if (recordPreview?.url) URL.revokeObjectURL(recordPreview.url);
    setRecordPreview(null);
    setRecordState("setup");
    setRecordElapsed(0);
    setShowRecorder(false);
  }
  function openRecorder() {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setError("Skjermopptak støttes ikke i denne nettleseren.");
      return;
    }
    setRecordState("setup");
    setShowRecorder(true);
  }
  async function startRecording() {
    try {
      setError("");
      transcriptRef.current = "";
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: recordOptions.systemAudio,
      });
      streamsRef.current = [display];
      let userMedia: MediaStream | null = null;
      if (recordOptions.microphone || recordOptions.camera) {
        userMedia = await navigator.mediaDevices.getUserMedia({
          audio: recordOptions.microphone,
          video: recordOptions.camera ? { width: { ideal: 640 }, height: { ideal: 360 } } : false,
        });
        streamsRef.current.push(userMedia);
      }
      const output = new MediaStream();
      if (recordOptions.camera && userMedia?.getVideoTracks().length) {
        setLiveCamera(userMedia);
        const displayVideo = document.createElement("video");
        const cameraVideo = document.createElement("video");
        displayVideo.srcObject = display;
        cameraVideo.srcObject = userMedia;
        displayVideo.muted = true;
        cameraVideo.muted = true;
        await Promise.all([displayVideo.play(), cameraVideo.play()]);
        const settings = display.getVideoTracks()[0]?.getSettings();
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(1920, settings.width || 1920);
        canvas.height = Math.min(1080, settings.height || 1080);
        const context = canvas.getContext("2d");
        const draw = () => {
          if (!context) return;
          context.drawImage(displayVideo, 0, 0, canvas.width, canvas.height);
          const cameraWidth = Math.round(canvas.width * 0.22);
          const cameraHeight = Math.round(cameraWidth * 9 / 16);
          const x = canvas.width - cameraWidth - 28;
          const y = canvas.height - cameraHeight - 28;
          context.save();
          context.beginPath();
          context.roundRect(x, y, cameraWidth, cameraHeight, 18);
          context.clip();
          context.drawImage(cameraVideo, x, y, cameraWidth, cameraHeight);
          context.restore();
          drawFrameRef.current = requestAnimationFrame(draw);
        };
        draw();
        canvas.captureStream(30).getVideoTracks().forEach((track) => output.addTrack(track));
      } else {
        display.getVideoTracks().forEach((track) => output.addTrack(track));
      }
      const audioTracks = [
        ...display.getAudioTracks(),
        ...(userMedia?.getAudioTracks() || []),
      ];
      if (audioTracks.length === 1) {
        output.addTrack(audioTracks[0]);
      } else if (audioTracks.length > 1) {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();
        audioTracks.forEach((track) => {
          const source = audioContext.createMediaStreamSource(new MediaStream([track]));
          source.connect(destination);
        });
        destination.stream.getAudioTracks().forEach((track) => output.addTrack(track));
      }
      streamsRef.current.push(output);
      if (recordOptions.transcript) {
        const SpeechCtor = (window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }).SpeechRecognition || (window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }).webkitSpeechRecognition;
        if (SpeechCtor) {
          const speech = new SpeechCtor();
          speech.continuous = true;
          speech.interimResults = false;
          speech.lang = "nb-NO";
          speech.onresult = (event) => {
            for (let index = 0; index < event.results.length; index += 1) {
              if (event.results[index].isFinal) transcriptRef.current += event.results[index][0].transcript + " ";
            }
          };
          speech.start();
          speechRef.current = speech;
        }
      }
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(output, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const durationMs = Math.min(600_000, Date.now() - recordStartedRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        cleanupRecordingStreams();
        if (!blob.size) { setError("Opptaket ble tomt. Prøv på nytt."); setRecordState("setup"); return; }
        const url = URL.createObjectURL(blob);
        setRecordPreview({ blob, url, durationMs, transcript: transcriptRef.current.trim() });
        setRecordState("preview");
      };
      display.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state !== "inactive") recorder.stop();
      });
      recorderRef.current = recorder;
      recorder.start(1_000);
      recordStartedRef.current = Date.now();
      setRecordElapsed(0);
      setRecordState("recording");
      recordTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - recordStartedRef.current;
        setRecordElapsed(elapsed);
        if (elapsed >= 600_000 && recorder.state !== "inactive") recorder.stop();
      }, 500);
    } catch (cause) {
      cleanupRecordingStreams();
      setRecordState("setup");
      if (cause instanceof DOMException && cause.name === "NotAllowedError") return;
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }
  function toggleRecordingPause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setRecordState("paused");
    } else if (recorder.state === "paused") {
      recorder.resume();
      setRecordState("recording");
    }
  }
  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }
  function reshoot() {
    if (recordPreview?.url) URL.revokeObjectURL(recordPreview.url);
    setRecordPreview(null);
    setRecordState("setup");
    setRecordElapsed(0);
  }

  if (!data) {
    return <div className="mockup-review-loading">{error || "Åpner Review Room…"}</div>;
  }

  return <div className="mockup-review">
    <header className="mockup-review-header">
      <div className="review-brand">
        <i>M</i>
        <span>
          <b>{data.project.name}</b>
          <small>{version?.label} · {reviewStatusLabel(version?.reviewStatus)}</small>
        </span>
      </div>
      <div className="review-header-actions">
        <span className={"review-status status-" + (version?.reviewStatus || "draft")}>{reviewStatusLabel(version?.reviewStatus)}</span>
        {presence.slice(0, 4).map((person) => <i className="review-avatar" key={person.participant_key} title={person.display_name}>{person.display_name.slice(0, 2)}</i>)}
        {reviewer && <button onClick={() => setShowIdentity(true)}>{reviewerName}</button>}
        {data.share.accessMode === "approve" && currentVersion && <>
          <button disabled={busy === "decision"} onClick={() => void decision("changes_requested")}>Be om endringer</button>
          <button className="review-approve" disabled={busy === "decision"} onClick={() => void decision("approved")}>✓ Godkjenn</button>
        </>}
      </div>
    </header>

    <main className="mockup-review-main">
      <section className="review-canvas-column">
        <nav className="review-canvas-nav">
          <b>{version?.label}</b>
          {data.share.allowVersionHistory && <select value={version?.id} onChange={(event) => {
            const next = data.versions.find((item) => item.id === event.target.value);
            if (next) void chooseVersion(next);
          }}>{data.versions.map((item) => <option key={item.id} value={item.id}>{item.label} · {reviewStatusLabel(item.reviewStatus)}</option>)}</select>}
          {data.share.allowVersionHistory && data.versions.length > 1 && <select value={compare?.id || ""} onChange={(event) => setCompare(data.versions.find((item) => item.id === event.target.value) || null)}>
            <option value="">Sammenlign…</option>
            {data.versions.filter((item) => item.id !== version?.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>}
          <button onClick={() => setPinsVisible((visible) => !visible)}>{pinsVisible ? "Skjul pins" : "Vis pins"}</button>
        </nav>

        <div className="review-toolbar" role="toolbar" aria-label="Review-verktøy">
          {TOOLS.map(([value, label, shortcut]) => <button
            key={value}
            className={tool === value ? "active" : ""}
            aria-pressed={tool === value}
            disabled={!canComment && value !== "select"}
            onClick={() => { setTool(value); if (value !== "select") setActiveCommentId(null); }}
          ><span>{label}</span><kbd>{shortcut}</kbd></button>)}
        </div>

        <div
          className={"mockup-review-stage tool-" + tool}
          style={{ aspectRatio: ratio }}
          onPointerDown={beginMarkup}
          onPointerMove={(event) => { moveMarkup(event); movePresence(event); }}
          onPointerUp={finishMarkup}
          onPointerCancel={() => updateDraft(null)}
        >
          {preview ? <img src={preview} alt={data.project.name} /> : <p>Forhåndsvisning mangler</p>}
          {compare?.preview && <img className="review-compare-image" src={compare.preview} alt="" style={{ clipPath: "inset(0 0 0 " + split + "%)" }} />}
          {compare && <i className="review-compare-line" style={{ left: split + "%" }} />}
          {allMarks.length > 0 && <svg className="review-marks" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Review-markeringer">
            <defs><marker id="public-review-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#f97316" /></marker></defs>
            {allMarks.map((mark) => {
              const first = mark.points[0];
              const last = mark.points[mark.points.length - 1];
              if (!first || !last) return null;
              if (mark.kind === "rect") return <rect key={mark.id} x={Math.min(first.x, last.x) * 1000} y={Math.min(first.y, last.y) * 1000} width={Math.abs(last.x - first.x) * 1000} height={Math.abs(last.y - first.y) * 1000} fill="rgba(249,115,22,.08)" stroke={mark.color} strokeWidth={mark.width} vectorEffect="non-scaling-stroke" />;
              if (mark.kind === "arrow") return <line key={mark.id} x1={first.x * 1000} y1={first.y * 1000} x2={last.x * 1000} y2={last.y * 1000} stroke={mark.color} strokeWidth={mark.width} vectorEffect="non-scaling-stroke" markerEnd="url(#public-review-arrow)" />;
              return <polyline key={mark.id} points={mark.points.map((point) => String(point.x * 1000) + "," + String(point.y * 1000)).join(" ")} fill="none" stroke={mark.color} strokeWidth={mark.width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
            })}
          </svg>}
          {pinsVisible && shown.filter((comment) => comment.anchorX != null && comment.anchorY != null).map((comment) => {
            const position = draggedPins[comment.id] || { x: comment.anchorX || 0, y: comment.anchorY || 0 };
            return <button
              className={"review-pin " + (comment.status === "resolved" ? "done " : "") + (activeCommentId === comment.id ? "active" : "")}
              key={comment.id}
              style={{ left: position.x * 100 + "%", top: position.y * 100 + "%" }}
              aria-label={"Kommentar #" + comment.number + " fra " + comment.authorDisplayName}
              onPointerDown={(event) => beginPinDrag(comment, event)}
            >{comment.number}</button>;
          })}
          {pending && <i className="review-pin pending" style={{ left: pending.x * 100 + "%", top: pending.y * 100 + "%" }}>+</i>}
          {presence.filter((person) => person.cursor_x != null).map((person) => <i className="review-cursor" key={person.participant_key} style={{ left: (person.cursor_x || 0) * 100 + "%", top: (person.cursor_y || 0) * 100 + "%" }}>⌁<small>{person.display_name}</small></i>)}
        </div>
        {compare && <input className="review-range" aria-label="Sammenligningsskille" type="range" min="0" max="100" value={split} onChange={(event) => setSplit(Number(event.target.value))} />}
        <small className="review-stage-hint">{canComment ? tool === "select" ? "Velg en tråd eller dra din egen pin for å flytte den." : tool === "pin" ? "Klikk i designet for å feste en kommentar." : "Dra i designet for å markere." : data.share.commentsPaused ? "Kommentarer er pauset." : "Kun visning."}</small>
      </section>

      <aside className="review-sidebar">
        <div className="review-sidebar-head">
          <span><b>Feedback</b><small>{roots.length} kommentarer</small></span>
          <nav>{FILTERS.map((value) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{({ open: "Åpne", all: "Alle", pinned: "Festede", general: "Generelle", resolved: "Løst" })[value]}</button>)}</nav>
        </div>
        {error && <p className="review-error" role="alert">{error}<button onClick={() => setError("")}>×</button></p>}
        {success && <p className="review-success">{success}<button onClick={() => setSuccess("")}>×</button></p>}
        {canComment && <div className="review-compose">
          {pending && <small>
            {pending.marks.length ? "Markering valgt" : "Pin valgt"}
            {pending.elementLabel ? ` · festet til ${pending.elementLabel}` : " · festet til canvas"}
            {" "}<button onClick={() => setPending(null)}>fjern</button>
          </small>}
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={pending ? "Hva skal endres her?" : "Skriv en generell kommentar…"} />
          <small>Bruk @navn for å varsle en deltaker.</small>
          <div>
            <label>📎 {file?.name || "Vedlegg"}<input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
            {data.share.allowRecordings && <button onClick={openRecorder}>● Opptak</button>}
            <button className="review-send" disabled={!text.trim() || busy === "comment"} onClick={() => void postComment()}>{busy === "comment" ? uploadProgress ? "Laster opp " + uploadProgress + "%" : "Sender…" : "Send"}</button>
          </div>
        </div>}
        <div className="review-comments">
          {shown.length === 0 && <p className="review-empty">Ingen kommentarer i dette filteret.</p>}
          {shown.map((comment) => <article
            id={"comment-" + comment.id}
            className={(comment.status === "resolved" ? "resolved " : "") + (activeCommentId === comment.id ? "active" : "")}
            key={comment.id}
            onClick={() => setActiveCommentId(comment.anchorKind === "general" ? null : comment.id)}
          >
            <div className="review-comment-head">
              <i>#{comment.number}</i>
              <span><b>{comment.authorDisplayName}</b><small>{new Date(comment.createdAt).toLocaleString("no-NO")} · {comment.anchorKind === "general" ? "Generell" : "Festet"}</small></span>
            </div>
            <p>{comment.body}</p>
            {comment.attachments.map((attachment) => <a href={base + "/attachments/" + attachment.id} target="_blank" rel="noreferrer" key={attachment.id}>{attachment.isRecording ? "🎬" : "📎"} {attachment.displayName}</a>)}
            {replies(comment.id).map((item) => <blockquote key={item.id}><b>{item.authorDisplayName}</b> {item.body}</blockquote>)}
            {canComment && <div className="review-comment-actions">
              {["👍", "❤️", "👀"].map((emoji) => <button onClick={(event) => { event.stopPropagation(); react(comment, emoji); }} key={emoji}>{emoji} {comment.reactions[emoji] || ""}</button>)}
              <button onClick={(event) => { event.stopPropagation(); setReplyTo(replyTo === comment.id ? null : comment.id); }}>Svar</button>
              {reviewer?.id === comment.reviewerSessionId && <button onClick={(event) => { event.stopPropagation(); toggleResolved(comment); }}>{comment.status === "resolved" ? "Åpne" : "Løs"}</button>}
            </div>}
            {replyTo === comment.id && <div className="review-reply" onClick={(event) => event.stopPropagation()}><input autoFocus value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void postComment(comment.id); }} /><button onClick={() => void postComment(comment.id)}>Send</button></div>}
          </article>)}
          {currentDecisions.length > 0 && <section className="review-decisions">
            <b>Beslutningshistorikk</b>
            {currentDecisions.map((item) => <div key={item.id}><span className={"decision-" + item.decision}>{decisionLabel(item.decision)}</span><small>{item.actorDisplayName} · {new Date(item.createdAt).toLocaleString("no-NO")}</small>{item.note && <p>{item.note}</p>}</div>)}
          </section>}
        </div>
        {data.share.accessMode === "approve" && currentVersion && <div className="review-decision">
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Valgfri merknad" />
          <button disabled={busy === "decision"} onClick={() => void decision("changes_requested")}>Be om endringer</button>
          <button className="review-approve" disabled={busy === "decision"} onClick={() => void decision("approved")}>✓ Godkjenn</button>
        </div>}
      </aside>
    </main>

    {showIdentity && <div className="review-modal-backdrop"><form className="review-identity" onSubmit={enter}>
      <h1>Bli med i gjennomgangen</h1>
      <p>Ingen konto er nødvendig. Navnet vises ved kommentarene dine.</p>
      <input required autoFocus placeholder="Navn" value={identity.displayName} onChange={(event) => setIdentity({ ...identity, displayName: event.target.value })} />
      <input type="email" placeholder="E-post for varsler (valgfritt)" value={identity.email} onChange={(event) => setIdentity({ ...identity, email: event.target.value })} />
      <button className="review-send">{busy === "identity" ? "Åpner…" : "Åpne Review Room"}</button>
      {session && <button type="button" onClick={() => setShowIdentity(false)}>Avbryt</button>}
    </form></div>}

    {showRecorder && <div className="review-modal-backdrop"><section className="review-recorder" role="dialog" aria-modal="true" aria-label="Skjermopptak">
      <header><div><b>Skjermopptak</b><small>Maks 10 minutter</small></div><button onClick={closeRecorder} aria-label="Lukk">×</button></header>
      {recordState === "setup" && <>
        <div className="recording-options">
          <label><input type="checkbox" checked={recordOptions.microphone} onChange={(event) => setRecordOptions({ ...recordOptions, microphone: event.target.checked })} /> Mikrofon</label>
          <label><input type="checkbox" checked={recordOptions.camera} onChange={(event) => setRecordOptions({ ...recordOptions, camera: event.target.checked })} /> Kamera i hjørnet</label>
          <label><input type="checkbox" checked={recordOptions.systemAudio} onChange={(event) => setRecordOptions({ ...recordOptions, systemAudio: event.target.checked })} /> Systemlyd</label>
          <label><input type="checkbox" checked={recordOptions.transcript} onChange={(event) => setRecordOptions({ ...recordOptions, transcript: event.target.checked })} /> Automatisk transkripsjon</label>
        </div>
        <p>Velg skjermen eller fanen du vil forklare. Nettleseren ber om tillatelse før opptaket starter.</p>
        <button className="review-send" onClick={() => void startRecording()}>Velg skjerm og start</button>
      </>}
      {(recordState === "recording" || recordState === "paused") && <div className="recording-live">
        <div className="recording-clock"><i />{new Date(recordElapsed).toISOString().slice(14, 19)} / 10:00</div>
        {liveCamera && <video ref={cameraPreviewRef} muted playsInline />}
        <p>{recordState === "paused" ? "Opptaket er satt på pause." : "Forklar det du ser. Kameraet legges inn nederst til høyre."}</p>
        <div><button onClick={toggleRecordingPause}>{recordState === "paused" ? "Fortsett" : "Pause"}</button><button className="record-stop" onClick={stopRecording}>■ Stopp</button></div>
      </div>}
      {recordState === "preview" && recordPreview && <>
        <video className="recording-preview" src={recordPreview.url} controls />
        {recordPreview.transcript && <details><summary>Transkripsjon</summary><p>{recordPreview.transcript}</p></details>}
        <div className="recording-finish"><button onClick={reshoot}>Ta opp på nytt</button><button className="review-send" disabled={busy === "comment"} onClick={() => void postComment(undefined, recordPreview)}>{busy === "comment" ? "Laster opp " + uploadProgress + "%" : "Legg ved kommentar"}</button></div>
      </>}
    </section></div>}

    {tourStep >= 0 && <div className="review-tour" role="dialog" aria-label="Rask omvisning">
      <small>{tourStep + 1} / {TOUR.length}</small>
      <b>{TOUR[tourStep][0]}</b>
      <span>{TOUR[tourStep][1]}</span>
      <div><button onClick={() => { localStorage.setItem("mr-tour-v2", "1"); setTourStep(-1); }}>Hopp over</button><button className="review-send" onClick={() => {
        if (tourStep === TOUR.length - 1) { localStorage.setItem("mr-tour-v2", "1"); setTourStep(-1); }
        else setTourStep((step) => step + 1);
      }}>{tourStep === TOUR.length - 1 ? "Ferdig" : "Neste"}</button></div>
    </div>}
  </div>;
}

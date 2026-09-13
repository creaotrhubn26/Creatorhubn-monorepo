// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Download from "@mui/icons-material/Download";
import Reply from "@mui/icons-material/Reply";
import CinematicVideoPlayer from "@/components/gallery/CinematicVideoPlayer";
import { apiRequest } from "@/lib/queryClient";

const fmtTime = (seconds: number) =>
  `${Math.floor((Number(seconds) || 0) / 60)}:${String(Math.floor((Number(seconds) || 0) % 60)).padStart(2, "0")}`;

const VideoReviewPage: React.FC = () => {
  const [, params] = useRoute("/video-review/:token");
  const token = params?.token || "";
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordNeeded, setPasswordNeeded] = useState(false);
  const [name, setName] = useState(
    () => localStorage.getItem("video_review_name") || "",
  );
  const [email, setEmail] = useState(
    () => localStorage.getItem("video_review_email") || "",
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [seekToSec, setSeekToSec] = useState<number | null>(null);
  const [liveSession, setLiveSession] = useState<any | null>(null);
  const headers = password ? { "x-video-review-password": password } : {};
  const load = useCallback(
    async (versionId?: string | null, quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const query = versionId
          ? `?versionId=${encodeURIComponent(versionId)}`
          : "";
        const result: any = await apiRequest(
          `/api/video-review/${encodeURIComponent(token)}${query}`,
          { headers },
        );
        setData(result);
        setSelectedVersionId(result.currentVersionId);
        setPasswordNeeded(false);
      } catch (error: any) {
        if (/password_required|401/i.test(String(error?.message || error)))
          setPasswordNeeded(true);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [token, password],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!data?.access) return;
    if (!name && data.access.recipientName) setName(data.access.recipientName);
    if (!email && data.access.recipientEmail) setEmail(data.access.recipientEmail);
  }, [data?.access?.recipientName, data?.access?.recipientEmail]);
  useEffect(() => {
    if (!data) return;
    const interval = window.setInterval(
      () => load(selectedVersionId, true),
      5000,
    );
    return () => window.clearInterval(interval);
  }, [data, load, selectedVersionId]);
  const loadLive = useCallback(async () => {
    if (!token || !data) return;
    const result: any = await apiRequest(
      `/api/video-review/${encodeURIComponent(token)}/live`,
      { headers },
    ).catch(() => ({ liveSession: null }));
    setLiveSession(result?.liveSession || null);
  }, [token, password, Boolean(data)]);
  useEffect(() => {
    if (!data) return;
    loadLive();
    const interval = window.setInterval(loadLive, 1200);
    return () => window.clearInterval(interval);
  }, [data, loadLive]);
  useEffect(() => {
    if (liveSession?.version_id && liveSession.version_id !== selectedVersionId) {
      load(liveSession.version_id, true);
    }
  }, [liveSession?.version_id, selectedVersionId, load]);
  const versions = data?.versions || [];
  const current =
    versions.find((version: any) => version.id === data?.currentVersionId) ||
    versions[0];
  const comments = data?.comments || [];
  const chapters = data?.chapters || [];
  const replies = useMemo(
    () =>
      comments.reduce((map: any, comment: any) => {
        if (comment.parentId) (map[comment.parentId] ||= []).push(comment);
        return map;
      }, {}),
    [comments],
  );
  const identity = () => {
    if (data?.access?.requireIdentity && (!name.trim() || !email.trim())) {
      window.alert(
        "Skriv inn navn og e-post før du kommenterer eller tar en beslutning.",
      );
      return false;
    }
    localStorage.setItem("video_review_name", name.trim());
    localStorage.setItem("video_review_email", email.trim());
    return true;
  };
  const addComment = async (input: any) => {
    if (!identity()) return;
    await apiRequest(
      `/api/video-review/${encodeURIComponent(token)}/comments`,
      {
        method: "POST",
        headers,
        body: {
          ...input,
          versionId: current.id,
          authorName: name.trim(),
          authorEmail: email.trim(),
        },
      },
    );
    await load(current.id, true);
  };
  const replyTo = async (comment: any) => {
    const reply = window.prompt("Skriv svar:");
    if (!reply?.trim()) return;
    await addComment({
      parentId: comment.id,
      timecodeSec: comment.timecodeSec,
      comment: reply.trim(),
      category: comment.category,
      priority: comment.priority,
    });
  };
  const decide = async (decision: string) => {
    if (!identity()) return;
    const note =
      window.prompt(
        decision === "approved"
          ? "Valgfri godkjenningsnote:"
          : "Beskriv endringene du ønsker:",
      ) ?? "";
    if (decision === "changes_requested" && !note.trim()) return;
    await apiRequest(
      `/api/video-review/${encodeURIComponent(token)}/decisions`,
      {
        method: "POST",
        headers,
        body: {
          versionId: current.id,
          decision,
          note,
          reviewerName: name.trim(),
          reviewerEmail: email.trim(),
        },
      },
    );
    await load(current.id, true);
  };
  const download = async () => {
    const result: any = await apiRequest(
      `/api/video-review/${encodeURIComponent(token)}/versions/${current.id}/download?format=json`,
      { headers },
    ).catch(() => null);
    if (!result?.url) return window.alert("Nedlasting er ikke tilgjengelig.");
    const anchor = document.createElement("a");
    anchor.href = result.url;
    anchor.download = `${current.versionLabel || "video"}.mp4`;
    anchor.click();
  };

  if (loading && !data)
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#0a0807",
          display: "grid",
          placeItems: "center",
        }}
      >
        <CircularProgress sx={{ color: "#d97706" }} />
      </Box>
    );
  if (passwordNeeded)
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#0a0807",
          color: "#fdfaf5",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Stack spacing={2} sx={{ width: 360, maxWidth: "calc(100vw - 32px)" }}>
          <Typography variant="h5">Passordbeskyttet review</Typography>
          <TextField
            type="password"
            value={passwordDraft}
            onChange={(event) => setPasswordDraft(event.target.value)}
            label="Passord"
            sx={{ bgcolor: "#fff", borderRadius: 1 }}
          />
          <Button
            variant="contained"
            onClick={() => setPassword(passwordDraft)}
          >
            Åpne review
          </Button>
        </Stack>
      </Box>
    );
  if (!current)
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#0a0807",
          color: "#fdfaf5",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Typography>Ingen video er klar for review.</Typography>
      </Box>
    );

  return (
    <Box
      sx={{ minHeight: "100vh", bgcolor: "#0a0807", color: "#fdfaf5", py: 4 }}
    >
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            gap={2}
          >
            <Box>
              <Typography
                sx={{
                  letterSpacing: ".22em",
                  color: "#d97706",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                CREATORHUB VIDEO REVIEW
              </Typography>
              <Typography variant="h4" sx={{ fontFamily: "Georgia, serif" }}>
                {current.versionLabel}
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,.55)" }}>
                Kommentarene dine går direkte inn i videoteamets Video Room.
              </Typography>
              {(data?.access?.recipientName || data?.access?.recipientEmail) && (
                <Typography sx={{ color: "rgba(255,255,255,.42)", fontSize: 12, mt: 0.5 }}>
                  Personlig review for {data.access.recipientName || data.access.recipientEmail}
                </Typography>
              )}
            </Box>
            {data?.access?.requireIdentity && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  label="Navn"
                  sx={{ bgcolor: "#fff", borderRadius: 1 }}
                />
                <TextField
                  size="small"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  label="E-post"
                  sx={{ bgcolor: "#fff", borderRadius: 1 }}
                />
              </Stack>
            )}
          </Stack>
          {versions.length > 1 && (
            <Stack direction="row" spacing={1} overflow="auto">
              {versions.map((version: any) => (
                <Chip
                  key={version.id}
                  label={`${version.versionLabel} · ${version.status}`}
                  onClick={() => load(version.id)}
                  sx={{
                    color: version.id === current.id ? "#0a0807" : "#fff",
                    bgcolor:
                      version.id === current.id
                        ? "#d97706"
                        : "rgba(255,255,255,.1)",
                  }}
                />
              ))}
            </Stack>
          )}
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={3}
            alignItems="flex-start"
          >
            <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
              {liveSession && (
                <Typography sx={{ color: "#22c55e", fontSize: 12, fontWeight: 800, mb: 1 }}>
                  ● LIVE REVIEW · du følger videoteamets playhead og tegninger
                </Typography>
              )}
              <CinematicVideoPlayer
                key={current.id}
                src={current.fileUrl}
                poster={current.thumbnailUrl}
                title={current.versionLabel}
                chapters={chapters}
                comments={comments}
                onAddComment={
                  data.access.mode === "view" ? undefined : addComment
                }
                seekToSec={liveSession ? Number(liveSession.playhead_sec) : seekToSec}
                syncIsPlaying={liveSession ? Boolean(liveSession.is_playing) : null}
                liveAnnotation={liveSession?.drawing || null}
                watermark={data?.access?.watermark || null}
              />
              {data.access.allowDownload && (
                <Button
                  startIcon={<Download />}
                  onClick={download}
                  sx={{ color: "#fdfaf5", mt: 1 }}
                >
                  Last ned original review-fil
                </Button>
              )}
            </Box>
            <Box
              sx={{
                width: { xs: "100%", lg: 360 },
                bgcolor: "rgba(255,255,255,.055)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 1,
                overflow: "hidden",
              }}
            >
              <Typography sx={{ p: 2, fontWeight: 800 }}>
                Kommentarer ·{" "}
                {comments.filter((comment: any) => !comment.parentId).length}
              </Typography>
              {comments
                .filter((comment: any) => !comment.parentId)
                .map((comment: any) => (
                  <Box
                    key={comment.id}
                    sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,.1)" }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={fmtTime(comment.timecodeSec)}
                        onClick={() => setSeekToSec(comment.timecodeSec)}
                        size="small"
                        sx={{ bgcolor: "#d97706", color: "#0a0807" }}
                      />
                      <Typography sx={{ fontWeight: 700 }}>
                        {comment.clientName || "Videoteamet"}
                      </Typography>
                      {comment.isDecision && (
                        <Chip label="Beslutning" size="small" />
                      )}
                    </Stack>
                    <Typography sx={{ mt: 1, color: "rgba(255,255,255,.82)" }}>
                      {comment.comment}
                    </Typography>
                    {(replies[comment.id] || []).map((reply: any) => (
                      <Box
                        key={reply.id}
                        sx={{ pl: 1.5, mt: 1, borderLeft: "2px solid #d97706" }}
                      >
                        <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                          {reply.clientName || "Videoteamet"}
                        </Typography>
                        <Typography sx={{ fontSize: 13 }}>
                          {reply.comment}
                        </Typography>
                      </Box>
                    ))}
                    {data.access.mode !== "view" && (
                      <Button
                        size="small"
                        startIcon={<Reply />}
                        onClick={() => replyTo(comment)}
                        sx={{ mt: 1, color: "#d97706" }}
                      >
                        Svar
                      </Button>
                    )}
                  </Box>
                ))}
            </Box>
          </Stack>
          {data.access.mode === "approve" && (
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                onClick={() => decide("changes_requested")}
                sx={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }}
              >
                Be om endringer
              </Button>
              <Button
                variant="contained"
                startIcon={<CheckCircle />}
                onClick={() => decide("approved")}
                sx={{ bgcolor: "#22c55e", color: "#08110b" }}
              >
                Godkjenn {current.versionLabel}
              </Button>
            </Stack>
          )}
          {!!data.decisions?.length && (
            <Box>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>
                Beslutningslogg
              </Typography>
              {data.decisions.map((decision: any) => (
                <Typography
                  key={decision.id}
                  sx={{ fontSize: 13, color: "rgba(255,255,255,.65)" }}
                >
                  {new Date(decision.createdAt).toLocaleString("nb-NO")} ·{" "}
                  {decision.reviewerName || "Team"} ·{" "}
                  {decision.decision === "approved"
                    ? "Godkjent"
                    : "Endringer ønsket"}
                  {decision.note ? ` — ${decision.note}` : ""}
                </Typography>
              ))}
            </Box>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default VideoReviewPage;

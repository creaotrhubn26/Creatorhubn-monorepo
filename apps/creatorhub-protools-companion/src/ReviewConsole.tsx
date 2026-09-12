import { useMemo, useState } from "react";
import { Alert, Box, Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import TaskAlt from "@mui/icons-material/TaskAlt";
import SkipNext from "@mui/icons-material/SkipNext";
import AddLocationAltOutlined from "@mui/icons-material/AddLocationAltOutlined";
import * as api from "./api";
import type { FeedbackInbox } from "./api";

const ORANGE = "#ff8c00";
const CATEGORY_COLORS: Record<string, string> = {
  timing: "#e0606a", performance: "#9b7de2", arrangement: "#3fa7d6",
  mix: "#ff8c00", mastering: "#e1b85a", general: "#8ea0b8",
};

export function ReviewConsole({ feedback, refresh, report }: {
  feedback: FeedbackInbox | null;
  refresh: () => Promise<void>;
  report: (kind: "info" | "marker" | "bounce" | "error", message: string) => void;
}) {
  const [working, setWorking] = useState<string | null>(null);
  const openComments = useMemo(() => (feedback?.comments || [])
    .filter((comment) => comment.status !== "resolved")
    .sort((left, right) => left.timecode_seconds - right.timecode_seconds), [feedback]);

  const run = async (id: string, operation: () => Promise<unknown>, message: string) => {
    setWorking(id);
    try { await operation(); report("marker", message); await refresh(); }
    catch (error) { report("error", String(error)); }
    finally { setWorking(null); }
  };

  const nextRevision = async () => {
    const next = openComments[0];
    if (!next) { report("info", "Alle kommentarer er løst"); return; }
    await run(next.id, () => api.locateFeedback(next.timecode_seconds), `Neste revisjon: ${formatTimecode(next.timecode_seconds)} · ${next.body}`);
  };

  return (
    <Stack spacing={1.5}>
      {feedback?.offline && <Alert severity="warning">Offline-visning · siste lagrede feedback. {feedback.syncError}</Alert>}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <ForumOutlined sx={{ color: ORANGE }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{feedback?.project?.title || "Sound Room Review"}</Typography>
          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
            {feedback?.version ? `${feedback.version.version_label} · ${feedback.project?.status || feedback.version.status}` : "Ingen versjon publisert ennå"}
          </Typography>
        </Box>
        <Button size="small" onClick={() => void refresh()} sx={{ color: ORANGE }}>Oppdater</Button>
      </Stack>

      <Waveform comments={feedback?.comments || []} duration={Math.max(1, ...((feedback?.comments || []).map((comment) => comment.timecode_seconds + 10)))} />

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button variant="contained" startIcon={<SkipNext />} onClick={() => void nextRevision()} disabled={!openComments.length || working != null}
          sx={{ bgcolor: ORANGE, fontWeight: 800, "&:hover": { bgcolor: "#e07e00" } }}>
          Neste revisjon ({openComments.length})
        </Button>
        {(feedback?.signoffs || []).map((signoff) => (
          <Chip key={signoff.id} size="small" label={`${signoff.stage}: ${signoff.status}`}
            sx={{ color: signoff.status === "approved" ? "#5fb88a" : "#e1b85a" }} />
        ))}
        {(feedback?.decisions || []).map((decision) => (
          <Chip key={decision.id} size="small" label={`${decision.status === "open" ? "Blind A/B åpen" : "A/B avgjort"} · ${decision.vote_count} stemmer`}
            sx={{ color: decision.status === "open" ? ORANGE : "#5fb88a" }} />
        ))}
      </Stack>

      {feedback?.brief && (
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(255,140,0,.07)", border: "1px solid rgba(255,140,0,.22)" }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: ORANGE }}>{feedback.brief.title}</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", my: .5 }}>{feedback.brief.summary}</Typography>
          {feedback.brief.priorities.slice(0, 5).map((priority, index) => (
            <Typography key={`${priority.title}-${index}`} sx={{ fontSize: 11.5, mt: .35 }}>
              <strong>{index + 1}. {priority.title}</strong> · {priority.detail}
            </Typography>
          ))}
        </Box>
      )}

      {(feedback?.tasks || []).filter((task) => task.status !== "done").length > 0 && (
        <Stack spacing={.7}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", textTransform: "uppercase" }}>Oppgaver</Typography>
          {feedback!.tasks.filter((task) => task.status !== "done").map((task) => (
            <Stack key={task.id} direction="row" spacing={1} sx={{ p: 1, bgcolor: "rgba(63,167,214,.07)", borderRadius: 1.5 }}>
              <TaskAlt sx={{ color: "#3fa7d6", fontSize: 17 }} />
              <Typography sx={{ fontSize: 12.5 }}>{task.title}</Typography>
              <Chip size="small" label={task.status === "in_progress" ? "Pågår" : "Ny"} sx={{ ml: "auto!important", height: 20 }} />
            </Stack>
          ))}
        </Stack>
      )}

      <Stack spacing={.8}>
        {[...(feedback?.comments || [])].sort((left, right) => left.timecode_seconds - right.timecode_seconds).map((comment) => {
          const color = CATEGORY_COLORS[comment.category || "general"] || CATEGORY_COLORS.general;
          return (
            <Box key={comment.id} sx={{ p: 1.2, borderRadius: 1.5, opacity: comment.status === "resolved" ? .55 : 1,
              bgcolor: "rgba(255,255,255,.025)", borderLeft: `3px solid ${color}` }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography sx={{ color, fontWeight: 800, fontSize: 11 }}>{formatTimecode(comment.timecode_seconds)}</Typography>
                <Chip label={comment.category || "generelt"} size="small" sx={{ height: 19, color }} />
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{comment.author || "Reviewer"}</Typography>
                {comment.status === "resolved" && <Chip label="Løst" size="small" color="success" sx={{ height: 19, ml: "auto!important" }} />}
              </Stack>
              <Typography sx={{ fontSize: 12.5, my: .7 }}>{comment.body}</Typography>
              <Stack direction="row" spacing={1.2} sx={{ flexWrap: "wrap" }}>
                <Button size="small" disabled={working != null} onClick={() => void run(comment.id, () => api.locateFeedback(comment.timecode_seconds), "Playhead flyttet i Pro Tools")} sx={{ color: ORANGE, p: 0 }}>Finn</Button>
                <Button size="small" startIcon={<AddLocationAltOutlined />} disabled={working != null || comment.status === "resolved"}
                  onClick={() => void run(comment.id, () => api.markFeedback(comment.id, comment.timecode_seconds, comment.body.slice(0, 120), comment.category), "Fargekodet markør opprettet i Pro Tools")}
                  sx={{ color, p: 0 }}>Lag markør</Button>
                <Button size="small" disabled={working != null || comment.status === "resolved"}
                  onClick={() => void run(comment.id, () => api.resolveFeedback(comment.id), "Kommentaren er løst i Sound Room")}
                  sx={{ color: "#5fb88a", p: 0 }}>Løst</Button>
                <Button size="small" disabled={working != null} onClick={() => {
                  const body = window.prompt("Svar i Sound Room");
                  if (body?.trim()) void run(comment.id, () => api.replyFeedback(comment.id, body.trim()), "Svar sendt til Sound Room");
                }} sx={{ color: "#3fa7d6", p: 0 }}>Svar</Button>
              </Stack>
              {working === comment.id && <LinearProgress sx={{ mt: 1 }} />}
            </Box>
          );
        })}
        {!feedback?.comments.length && <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Ingen kommentarer ennå.</Typography>}
      </Stack>
    </Stack>
  );
}

function Waveform({ comments, duration }: { comments: FeedbackInbox["comments"]; duration: number }) {
  const bars = [20,38,62,34,75,48,82,55,91,42,64,30,78,53,87,40,68,29,72,46,84,50,70,36,59,26,65,44,76,32,58,23,49,35,69,41,61,28,55,21];
  return (
    <Box sx={{ position: "relative", height: 74, borderRadius: 2, bgcolor: "#08111f", overflow: "hidden", border: "1px solid rgba(255,255,255,.08)" }}>
      <Stack direction="row" spacing={.35} sx={{ height: "100%", px: 1, alignItems: "center" }}>
        {bars.map((height, index) => <Box key={index} sx={{ flex: 1, height: `${height}%`, minWidth: 2, borderRadius: 1, bgcolor: "rgba(255,140,0,.46)" }} />)}
      </Stack>
      {comments.map((comment) => <Box key={comment.id} title={`${formatTimecode(comment.timecode_seconds)} ${comment.body}`}
        sx={{ position: "absolute", left: `${Math.min(99, comment.timecode_seconds / duration * 100)}%`, top: 0, bottom: 0, width: 2,
          bgcolor: CATEGORY_COLORS[comment.category || "general"] || CATEGORY_COLORS.general }} />)}
    </Box>
  );
}

function formatTimecode(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}

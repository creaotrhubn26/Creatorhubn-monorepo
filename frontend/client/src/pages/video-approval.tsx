// @ts-nocheck
import React, { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircle from "@mui/icons-material/CheckCircle";
import RateReview from "@mui/icons-material/RateReview";
import { apiRequest } from "@/lib/queryClient";

const statusLabel: Record<string, string> = {
  pending: "Venter på forrige steg",
  in_review: "Klar for din godkjenning",
  approved: "Godkjent",
  changes_requested: "Endringer er bedt om",
  cancelled: "Avbrutt",
};

const VideoApprovalPage: React.FC = () => {
  const [, params] = useRoute("/video-approval/:token");
  const token = params?.token || "";
  const [approval, setApproval] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setApproval(await apiRequest(`/api/video-approval/${encodeURIComponent(token)}`));
    } catch (requestError: any) {
      setError(requestError?.message || "Approval-lenken finnes ikke eller er utløpt.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const decide = async (decision: "approved" | "changes_requested") => {
    if (decision === "changes_requested" && !note.trim()) {
      setError("Beskriv hva som må endres før du sender inn.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiRequest(`/api/video-approval/${encodeURIComponent(token)}`, {
        method: "POST",
        body: { decision, note: note.trim() || undefined },
      });
      await load();
    } catch (requestError: any) {
      setError(requestError?.message || "Beslutningen kunne ikke lagres.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0a0807", color: "#fdfaf5", py: { xs: 4, md: 10 } }}>
      <Container maxWidth="sm">
        <Typography sx={{ color: "#d97706", fontWeight: 900, fontSize: 12, letterSpacing: ".2em", mb: 2 }}>
          CREATORHUB FORMELL GODKJENNING
        </Typography>
        {loading && !approval ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 12 }}><CircularProgress sx={{ color: "#d97706" }} /></Box>
        ) : !approval ? (
          <Alert severity="error">{error || "Approval-lenken er ikke tilgjengelig."}</Alert>
        ) : (
          <Paper sx={{ p: { xs: 3, md: 5 }, bgcolor: "#171311", color: "#fdfaf5", border: "1px solid rgba(255,255,255,.1)" }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" sx={{ fontFamily: "Georgia, serif" }}>{approval.project_title}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,.58)", mt: 1 }}>
                  {approval.version_label} · {approval.step_name}
                </Typography>
              </Box>
              <Alert severity={approval.status === "approved" ? "success" : approval.status === "changes_requested" ? "warning" : "info"}>
                {statusLabel[approval.step_status] || approval.step_status}
                {approval.status !== "pending" ? ` · Din beslutning: ${statusLabel[approval.status] || approval.status}` : ""}
              </Alert>
              <Typography sx={{ color: "rgba(255,255,255,.78)" }}>
                Invitasjonen gjelder {approval.name || approval.email}. Beslutningen loggføres med tidspunkt og flytter neste approval-steg frem automatisk når kravet er oppfylt.
              </Typography>
              {approval.status === "pending" && approval.step_status === "in_review" && (
                <>
                  <TextField
                    multiline
                    minRows={4}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    label="Notat eller endringsønske"
                    sx={{ bgcolor: "#fff", borderRadius: 1 }}
                  />
                  {error && <Alert severity="error">{error}</Alert>}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Button fullWidth variant="outlined" disabled={submitting} startIcon={<RateReview />} onClick={() => decide("changes_requested")} sx={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }}>
                      Be om endringer
                    </Button>
                    <Button fullWidth variant="contained" disabled={submitting} startIcon={<CheckCircle />} onClick={() => decide("approved")} sx={{ bgcolor: "#22c55e", color: "#08110b" }}>
                      Godkjenn
                    </Button>
                  </Stack>
                </>
              )}
              {approval.step_status === "pending" && (
                <Typography sx={{ color: "rgba(255,255,255,.6)" }}>Dette steget åpnes automatisk når forrige approval-steg er ferdig.</Typography>
              )}
              {approval.note && <Typography sx={{ fontStyle: "italic", color: "rgba(255,255,255,.65)" }}>«{approval.note}»</Typography>}
            </Stack>
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default VideoApprovalPage;

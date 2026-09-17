/**
 * LinkedInPublishCard — «Neste post» for Markedssjef-modus (fase 1b).
 *
 * Én primærhandling per tilstand:
 *   - ikke koblet / utløpt   → «Koble til LinkedIn» (popup, eksisterende OAuth)
 *   - klar                   → «Publiser på LinkedIn» (tekst redigerbar,
 *                              avsender = profil eller bedriftsside når scope finnes)
 *   - publiserer             → knapp låst + spinner
 *   - feil                   → norsk årsak fra backend + «Prøv igjen»
 *   - tom kø                 → «Alle LinkedIn-poster er publisert»
 * Sekundært (overflow): «Hopp over».
 *
 * Tilkoblingen startes UTEN projectId: da lagres den som brukerens globale
 * LinkedIn-kobling (project_id IS NULL), som er den publisher-en leser.
 * Med projectId ville raden blitt prosjekt-scopet (klientportal-varianten)
 * og publiseringen ville feilet med «ikke koblet».
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SendIcon from "@mui/icons-material/Send";
import roleRoomAgentService, {
  MarketingPlanPublishError,
  type MarketingPlanLinkedInPublishOptions,
  type MarketingPlanPost,
} from "@/components/role-room/services/roleRoomAgentService";
import { buildPublishQueue, defaultCaptionFor } from "./nextPostToPublish";

const PROFILE_SENDER = "__profile__";

interface Props {
  projectKey: string;
  planId: string;
  /** Bump for å laste poster på nytt (f.eks. når postgenerering er ferdig). */
  reloadSignal?: number;
  onPublished: (post: MarketingPlanPost, permalink: string | null) => void;
  onNotice: (kind: "ok" | "error", message: string) => void;
}

type CardState =
  | { kind: "loading" }
  | { kind: "no_connection"; state: string }
  | { kind: "queue_empty"; published: number; total: number }
  | { kind: "ready"; post: MarketingPlanPost }
  | { kind: "publishing"; post: MarketingPlanPost };

export function LinkedInPublishCard({ projectKey, planId, reloadSignal, onPublished, onNotice }: Props) {
  const [options, setOptions] = useState<MarketingPlanLinkedInPublishOptions | null>(null);
  const [posts, setPosts] = useState<MarketingPlanPost[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sender, setSender] = useState<string>(PROFILE_SENDER);
  const [publishing, setPublishing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const captionForPostRef = useRef<string | null>(null);

  const loadOptions = useCallback(async () => {
    const next = await roleRoomAgentService.getMarketingPlanLinkedInPublishOptions(projectKey);
    setOptions(
      next ?? { connected: false, state: "unknown", memberName: null, scopeMissing: false, companies: [], captionMax: 3000 },
    );
  }, [projectKey]);

  const loadPosts = useCallback(async () => {
    try {
      const list = await roleRoomAgentService.listMarketingPlanPosts(planId);
      setPosts(list);
      setLoadError(null);
    } catch {
      setLoadError("Kunne ikke hente postene. Last siden på nytt.");
    }
  }, [planId]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts, reloadSignal]);

  // OAuth-popupen sender postMessage når koblingen er ferdig (samme kontrakt
  // som Role Rooms LinkedInConnectionCard).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      if (type === "linkedin-connected") {
        setConnecting(false);
        void loadOptions();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadOptions]);

  const queue = useMemo(() => buildPublishQueue(posts ?? []), [posts]);
  const nextPost = queue.next;

  // Forhåndsfyll teksten én gang per post; brukerens redigering beholdes.
  useEffect(() => {
    if (!nextPost) return;
    if (captionForPostRef.current === nextPost.id) return;
    captionForPostRef.current = nextPost.id;
    setCaption(defaultCaptionFor(nextPost));
    setPublishError(null);
  }, [nextPost]);

  const state: CardState = useMemo(() => {
    if (!options || posts === null) return { kind: "loading" };
    if (!options.connected) return { kind: "no_connection", state: options.state };
    if (!nextPost) return { kind: "queue_empty", published: queue.published, total: queue.total };
    return publishing ? { kind: "publishing", post: nextPost } : { kind: "ready", post: nextPost };
  }, [options, posts, nextPost, publishing, queue.published, queue.total]);

  const captionMax = options?.captionMax ?? 3000;
  const trimmedCaption = caption.trim();
  const captionTooLong = trimmedCaption.length > captionMax;
  const canPublish = trimmedCaption.length > 0 && !captionTooLong && !publishing;

  const startConnect = async () => {
    setConnecting(true);
    setPublishError(null);
    try {
      const response = await fetch("/api/role-room/linkedin/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnPath: window.location.pathname + window.location.search,
          browserOrigin: window.location.origin,
        }),
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; authorizationUrl?: string; error?: string }
        | null;
      if (!response.ok || !data?.success || !data.authorizationUrl) {
        onNotice("error", data?.error ?? "Kunne ikke starte LinkedIn-tilkoblingen.");
        setConnecting(false);
        return;
      }
      const popup = window.open(data.authorizationUrl, "li-oauth", "width=720,height=820,resizable=yes");
      if (!popup) {
        onNotice("error", "Popupen ble blokkert. Tillat popup for denne siden og prøv igjen.");
        setConnecting(false);
      }
    } catch (err) {
      onNotice("error", err instanceof Error ? err.message : "Kunne ikke starte LinkedIn-tilkoblingen.");
      setConnecting(false);
    }
  };

  const publish = async () => {
    if (!nextPost || !canPublish) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await roleRoomAgentService.publishMarketingPlanPost({
        postId: nextPost.id,
        projectId: projectKey,
        platform: "linkedin",
        caption: trimmedCaption,
        organizationUrn: sender === PROFILE_SENDER ? null : sender,
      });
      setPosts((prev) => (prev ?? []).map((p) => (p.id === result.post.id ? result.post : p)));
      onPublished(result.post, result.permalink);
    } catch (err) {
      if (err instanceof MarketingPlanPublishError) {
        if (err.reason === "connection_not_found" || err.reason === "auth_failed") {
          // Tilkoblingen er borte: vis «Koble til» i stedet for en død «Prøv igjen».
          setOptions((prev) => (prev ? { ...prev, connected: false, state: "expired" } : prev));
        }
        if (err.status === 409) {
          // Allerede publisert (f.eks. dobbeltklikk i en annen fane): hent kø på nytt.
          void loadPosts();
        }
        setPublishError(err.message);
      } else {
        setPublishError("Kunne ikke publisere. Prøv igjen.");
      }
    } finally {
      setPublishing(false);
    }
  };

  const skip = async () => {
    setMenuAnchor(null);
    if (!nextPost) return;
    try {
      const updated = await roleRoomAgentService.updateMarketingPlanPost(nextPost.id, { status: "skipped" });
      setPosts((prev) => (prev ?? []).map((p) => (p.id === updated.id ? updated : p)));
      onNotice("ok", "Posten er hoppet over.");
    } catch (err) {
      onNotice("error", err instanceof Error ? err.message : "Kunne ikke hoppe over posten.");
    }
  };

  const header = (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
      <LinkedInIcon sx={{ color: "#0a66c2" }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Neste post på LinkedIn
      </Typography>
      {queue.total > 0 && (
        <Chip size="small" variant="outlined" label={`${queue.published} av ${queue.total} publisert`} />
      )}
      <Box sx={{ flex: 1 }} />
      {options?.connected && options.memberName && (
        <Typography variant="caption" color="text.secondary">
          Koblet som {options.memberName}
        </Typography>
      )}
    </Stack>
  );

  return (
    <Card sx={{ border: "1px solid rgba(10,102,194,0.35)" }} data-testid="linkedin-publish-card">
      <CardContent>
        {header}
        {loadError && <Alert severity="error">{loadError}</Alert>}

        {state.kind === "loading" && (
          <Box sx={{ py: 2, textAlign: "center" }} aria-busy="true">
            <CircularProgress size={20} />
          </Box>
        )}

        {state.kind === "no_connection" && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {state.state === "expired"
                ? "LinkedIn-tilkoblingen er utløpt. Koble til på nytt for å publisere."
                : "Koble LinkedIn-kontoen din til, så publiserer du postene herfra. Ingenting publiseres før du trykker publiser."}
            </Typography>
            <Button
              variant="contained"
              onClick={startConnect}
              disabled={connecting}
              startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <LinkedInIcon />}
              sx={{ bgcolor: "#0a66c2", "&:hover": { bgcolor: "#004182" } }}
            >
              {state.state === "expired" ? "Koble til på nytt" : "Koble til LinkedIn"}
            </Button>
          </Box>
        )}

        {state.kind === "queue_empty" && (
          <Typography variant="body2" color="text.secondary">
            {state.total === 0
              ? "Planen har ingen LinkedIn-poster ennå."
              : `Alle ${state.total} LinkedIn-postene er publisert. Lag en ny plan når du vil ha neste runde.`}
          </Typography>
        )}

        {(state.kind === "ready" || state.kind === "publishing") && (
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              {state.post.dayOffset !== null && (
                <Chip size="small" label={`Dag ${state.post.dayOffset + 1}`} variant="outlined" />
              )}
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {state.post.hook}
              </Typography>
            </Stack>
            <TextField
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              multiline
              minRows={4}
              maxRows={14}
              fullWidth
              disabled={publishing}
              error={captionTooLong}
              helperText={
                captionTooLong
                  ? `${trimmedCaption.length} av ${captionMax} tegn. Kort ned før du publiserer.`
                  : `${trimmedCaption.length} av ${captionMax} tegn`
              }
              label="Tekst som publiseres"
            />
            {options && options.companies.length > 0 && (
              <TextField
                select
                label="Publiser som"
                value={sender}
                onChange={(event) => setSender(event.target.value)}
                size="small"
                disabled={publishing}
                sx={{ mt: 1.5, minWidth: 260 }}
              >
                <MenuItem value={PROFILE_SENDER}>
                  {options.memberName ? `Min profil (${options.memberName})` : "Min profil"}
                </MenuItem>
                {options.companies.map((company) => (
                  <MenuItem key={company.urn} value={company.urn}>
                    {company.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {publishError && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {publishError}
              </Alert>
            )}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={publish}
                disabled={!canPublish}
                startIcon={publishing ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                sx={{ bgcolor: "#0a66c2", "&:hover": { bgcolor: "#004182" } }}
              >
                {publishing ? "Publiserer …" : publishError ? "Prøv igjen" : "Publiser på LinkedIn"}
              </Button>
              <IconButton
                size="small"
                aria-label="Flere handlinger"
                aria-haspopup="menu"
                disabled={publishing}
                onClick={(event) => setMenuAnchor(event.currentTarget)}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu open={Boolean(menuAnchor)} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)}>
                <MenuItem onClick={skip}>Hopp over denne posten</MenuItem>
              </Menu>
              {state.post.externalPermalink && (
                <Link href={state.post.externalPermalink} target="_blank" rel="noreferrer" variant="body2">
                  Åpne posten <OpenInNewIcon sx={{ fontSize: 14, verticalAlign: "middle" }} />
                </Link>
              )}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default LinkedInPublishCard;

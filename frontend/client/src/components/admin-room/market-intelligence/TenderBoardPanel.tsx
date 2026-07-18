/**
 * TenderBoardPanel.tsx — anbuds-arbeidsflaten (cockpit-fanen «Anbud»)
 *
 * Tre visninger over samme dedupede datasett (/api/integrations/tenders/board):
 *   Tavle  — triage-kolonner Nye → Vurderes → Tilbud levert → Vunnet/Tapt/Droppet
 *   Frister — frist-først-liste med nedtelling (rød < 7 dager)
 *   Radar  — forventede re-utlysningsvinduer (ESTIMAT, merket som det)
 *
 * Krav-match vises som chips: grønn = dokumentert i leverandørprofilen,
 * rød = mangler, grå = ubesvart i profilen. Sammenslåtte kort viser alle
 * kildelenker — dedup skal kunne verifiseres, ikke stoles blindt på.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Link, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Tooltip, Typography,
} from "@mui/material";
import {
  Gavel as BoardIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import PanelStateContainer, { toLoadingState } from "./PanelStateContainer";

type BidStatus = "new" | "interested" | "bid" | "won" | "lost" | "dropped";

interface Fit {
  have: string[];
  missing: string[];
  unknown: string[];
  scorePct: number | null;
}

interface BoardTender {
  source: string;
  eventId: string;
  title: string;
  url: string | null;
  publishedAt: string | null;
  topic: string;
  deadline: string | null;
  valueNok: number | null;
  buyerName: string | null;
  isRfi: boolean;
  requirements: string[];
  fit: Fit | null;
  bidStatus: BidStatus;
  bidReason: string | null;
  altSources: Array<{ source: string; eventId: string; url: string | null }>;
}

interface RetenderWindow {
  title: string;
  buyerName: string | null;
  winnerName: string | null;
  valueNok: number | null;
  receivedTenders: number | null;
  awardedAt: string;
  url: string | null;
  topic: string;
  expectedRetender: string;
}

const COLUMNS: Array<{ status: BidStatus; label: string; color: string }> = [
  { status: "new", label: "Nye", color: "#60a5fa" },
  { status: "interested", label: "Vurderes", color: "#f59e0b" },
  { status: "bid", label: "Tilbud levert", color: "#c084fc" },
  { status: "won", label: "Vunnet", color: "#4ade80" },
  { status: "lost", label: "Tapt", color: "#f87171" },
  { status: "dropped", label: "Droppet", color: "#94a3b8" },
];

const REQUIREMENT_LABELS: Record<string, string> = {
  miljo: "Miljø", kvalitet: "ISO 9001", rammeavtale: "Rammeavtale",
  sikkerhet: "Sikkerhetsklarering", personvern: "GDPR", universell: "WCAG",
  laerling: "Lærling", ehf: "EHF",
};

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function daysToDeadline(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(`${deadline}T23:59:59`).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function formatNok(v: number | null): string | null {
  if (v == null) return null;
  return v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("nb-NO", { maximumFractionDigits: 1 })} MNOK` : `${Math.round(v / 1000)}k NOK`;
}

function DeadlineChip({ deadline }: { deadline: string | null }) {
  const days = daysToDeadline(deadline);
  if (days === null) return null;
  const fg = days < 0 ? "#94a3b8" : days <= 7 ? "#f87171" : days <= 14 ? "#f59e0b" : "#4ade80";
  const label = days < 0 ? `frist utløpt` : days === 0 ? "frist I DAG" : `${days} d til frist`;
  return (
    <Chip size="small" label={label}
      sx={{ bgcolor: `${fg}22`, color: fg, fontWeight: 700, fontSize: 10, height: 18 }} />
  );
}

function FitChips({ fit }: { fit: Fit | null }) {
  if (!fit) return null;
  const chip = (key: string, fg: string, tip: string) => (
    <Tooltip key={`${tip}-${key}`} title={tip}>
      <Chip size="small" label={REQUIREMENT_LABELS[key] ?? key}
        sx={{ bgcolor: `${fg}1e`, color: fg, fontSize: 10, height: 18 }} />
    </Tooltip>
  );
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
      {fit.have.map((k) => chip(k, "#4ade80", "Krav dere kan dokumentere (fra leverandørprofilen)"))}
      {fit.missing.map((k) => chip(k, "#f87171", "Krav dere IKKE oppfyller iflg. profilen"))}
      {fit.unknown.map((k) => chip(k, "#94a3b8", "Ubesvart i leverandørprofilen — fyll profilen under for å få svar"))}
    </Stack>
  );
}

function TenderCard({
  tender, onStatus,
}: {
  tender: BoardTender;
  onStatus: (t: BoardTender, status: BidStatus) => void;
}) {
  const col = COLUMNS.find((c) => c.status === tender.bidStatus) ?? COLUMNS[0];
  return (
    <Box sx={{
      border: `1px solid ${col.color}33`, borderLeft: `3px solid ${col.color}`,
      borderRadius: 1.5, p: 1.25, bgcolor: "rgba(15,23,42,0.5)",
    }}>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
        <DeadlineChip deadline={tender.deadline} />
        {tender.isRfi && (
          <Tooltip title="Markedsdialog/RFI — kravene formes NÅ, før utlysning">
            <Chip size="small" label="RFI" sx={{ bgcolor: "#f59e0b22", color: "#f59e0b", fontSize: 10, height: 18, fontWeight: 700 }} />
          </Tooltip>
        )}
        {formatNok(tender.valueNok) && (
          <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {formatNok(tender.valueNok)}
          </Typography>
        )}
      </Stack>
      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem", lineHeight: 1.3 }}>
        {tender.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
        {[tender.buyerName, tender.topic.split(" — ")[0]].filter(Boolean).join(" · ")}
      </Typography>
      <FitChips fit={tender.fit} />
      {tender.bidStatus === "dropped" && tender.bidReason && (
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5, fontStyle: "italic" }}>
          Hvorfor droppet: {tender.bidReason}
        </Typography>
      )}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
        {tender.url && (
          <Link href={tender.url} target="_blank" rel="noreferrer" variant="caption">
            {tender.source}
          </Link>
        )}
        {tender.altSources.map((s) => (
          <Tooltip key={`${s.source}|${s.eventId}`} title="Slått sammen med denne kunngjøringen — verifiser at det er samme anbud">
            <Link href={s.url ?? undefined} target="_blank" rel="noreferrer" variant="caption" sx={{ opacity: 0.7 }}>
              +{s.source}
            </Link>
          </Tooltip>
        ))}
        <Box sx={{ flex: 1 }} />
        {COLUMNS.filter((c) => c.status !== tender.bidStatus && c.status !== "new").map((c) => (
          <Button key={c.status} size="small" onClick={() => onStatus(tender, c.status)}
            sx={{ fontSize: 10, px: 0.5, minWidth: 0, color: c.color, opacity: 0.85 }}>
            {c.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}

export default function TenderBoardPanel() {
  const [tenders, setTenders] = useState<BoardTender[]>([]);
  const [windows, setWindows] = useState<RetenderWindow[]>([]);
  const [notes, setNotes] = useState<{ dedup?: string; radar?: string }>({});
  const [profileAnswered, setProfileAnswered] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"tavle" | "frister" | "radar">("tavle");
  const [dropTarget, setDropTarget] = useState<BoardTender | null>(null);
  const [dropReason, setDropReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/integrations/tenders/board", {
        credentials: "include", headers: authHeaders(),
      });
      if (!r.ok) { setError(`HTTP ${r.status}`); return; }
      const body = await r.json();
      setTenders(body.tenders ?? []);
      setWindows(body.retenderWindows ?? []);
      setNotes(body.notes ?? {});
      setProfileAnswered(Boolean(body.profileAnswered));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patchStatus = async (t: BoardTender, status: BidStatus, reason?: string) => {
    // Optimistisk flytt — tavlen skal føles som en tavle
    setTenders((list) => list.map((x) =>
      x.eventId === t.eventId && x.source === t.source
        ? { ...x, bidStatus: status, bidReason: reason ?? x.bidReason }
        : x));
    const r = await fetch("/api/integrations/tenders/bid-status", {
      method: "PATCH", credentials: "include",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ source: t.source, eventId: t.eventId, bidStatus: status, reason }),
    });
    if (!r.ok) void load(); // server sa nei — hent sannheten på nytt
  };

  const requestStatus = (t: BoardTender, status: BidStatus) => {
    if (status === "dropped") {
      // Grunn kreves ved dropp — det er slik dere lærer hva dere sier nei til
      setDropTarget(t);
      setDropReason("");
      return;
    }
    void patchStatus(t, status);
  };

  const withDeadline = tenders
    .filter((t) => t.deadline && (daysToDeadline(t.deadline) ?? -1) >= 0 && !["won", "lost", "dropped"].includes(t.bidStatus))
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <BoardIcon sx={{ color: "#c084fc" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Anbuds-tavla
            </Typography>
            {tenders.length > 0 && (
              <Chip size="small" label={`${tenders.length} anbud`}
                sx={{ bgcolor: "#c084fc22", color: "#c084fc", fontWeight: 700 }} />
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButtonGroup size="small" exclusive value={view}
              onChange={(_, v) => v && setView(v)}>
              <ToggleButton value="tavle" sx={{ fontSize: 11, px: 1.25 }}>Tavle</ToggleButton>
              <ToggleButton value="frister" sx={{ fontSize: 11, px: 1.25 }}>
                Frister{withDeadline.length > 0 ? ` (${withDeadline.length})` : ""}
              </ToggleButton>
              <ToggleButton value="radar" sx={{ fontSize: 11, px: 1.25 }}>
                Radar{windows.length > 0 ? ` (${windows.length})` : ""}
              </ToggleButton>
            </ToggleButtonGroup>
            <Button size="small" startIcon={<RefreshIcon />} onClick={() => void load()}>
              Oppdater
            </Button>
          </Stack>
        </Stack>

        {!profileAnswered && !loading && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Leverandørprofilen er ikke utfylt — krav-chipene under blir grå
            (ubesvart) til den er på plass. Profilen ligger i panelet under tavla.
          </Alert>
        )}

        <PanelStateContainer
          state={toLoadingState({ loading, error })}
          error={error}
          onRetry={load}
          isEmpty={tenders.length === 0 && windows.length === 0}
          empty="Ingen anbud i vinduet ennå — kortene kommer etter hvert som anbuds-sourcingen fyller på (TED + Doffin, siste 90 dager)."
        >
          {view === "tavle" && (
            <Box sx={{ overflowX: "auto", pb: 1 }}>
              <Stack direction="row" spacing={1.5} sx={{ minWidth: 900 }}>
                {COLUMNS.map((col) => {
                  const cards = tenders.filter((t) => t.bidStatus === col.status);
                  return (
                    <Box key={col.status} sx={{ flex: 1, minWidth: 190 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: col.color }} />
                        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                          {col.label}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ fontVariantNumeric: "tabular-nums" }}>
                          {cards.length}
                        </Typography>
                      </Stack>
                      <Stack spacing={1}>
                        {cards.map((t) => (
                          <TenderCard key={`${t.source}|${t.eventId}`} tender={t} onStatus={requestStatus} />
                        ))}
                        {cards.length === 0 && (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}

          {view === "frister" && (
            <Stack spacing={1}>
              {withDeadline.length === 0 && (
                <Typography variant="caption" color="text.disabled">
                  Ingen åpne anbud med kjent frist — TED/Doffin oppgir ikke alltid frist i kunngjørings-API-et; sjekk kildelenkene på kortene.
                </Typography>
              )}
              {withDeadline.map((t) => (
                <TenderCard key={`${t.source}|${t.eventId}`} tender={t} onStatus={requestStatus} />
              ))}
            </Stack>
          )}

          {view === "radar" && (
            <Stack spacing={1}>
              {windows.map((w, i) => (
                <Box key={`${w.url ?? w.title}-${i}`} sx={{
                  border: "1px solid rgba(148,163,184,0.2)", borderRadius: 1.5, p: 1.25,
                  display: "flex", gap: 1.5, alignItems: "baseline", flexWrap: "wrap",
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#c084fc" }}>
                    ~{w.expectedRetender}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 240 }}>
                    <Typography variant="body2" sx={{ fontSize: "0.82rem", fontWeight: 600 }}>
                      {w.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[
                        w.buyerName,
                        w.winnerName ? `vant: ${w.winnerName}` : null,
                        formatNok(w.valueNok),
                        w.receivedTenders != null ? `${w.receivedTenders} tilbud` : null,
                        `tildelt ${w.awardedAt}`,
                      ].filter(Boolean).join(" · ")}
                    </Typography>
                  </Box>
                  {w.url && (
                    <Link href={w.url} target="_blank" rel="noreferrer" variant="caption">
                      tildelingen
                    </Link>
                  )}
                </Box>
              ))}
              {notes.radar && (
                <Typography variant="caption" color="text.disabled">{notes.radar}</Typography>
              )}
            </Stack>
          )}
        </PanelStateContainer>

        {view === "tavle" && notes.dedup && tenders.some((t) => t.altSources.length > 0) && (
          <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1 }}>
            {notes.dedup}
          </Typography>
        )}
      </CardContent>

      <Dialog open={dropTarget !== null} onClose={() => setDropTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>Hvorfor dropper dere anbudet?</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Grunnen lagres på kortet — over tid blir dette fasiten for hva dere
            sier nei til (kapasitet, krav, pris, feil marked …).
          </Typography>
          <TextField autoFocus fullWidth size="small" value={dropReason}
            onChange={(e) => setDropReason(e.target.value)}
            placeholder="F.eks. mangler ISO 9001-krav, for lav verdi, feil geografi" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDropTarget(null)}>Avbryt</Button>
          <Button variant="contained" disabled={dropReason.trim().length < 3}
            onClick={() => {
              if (dropTarget) void patchStatus(dropTarget, "dropped", dropReason.trim());
              setDropTarget(null);
            }}>
            Dropp
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

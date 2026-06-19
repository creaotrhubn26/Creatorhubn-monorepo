/**
 * LeadStatusChanger.tsx
 *
 * Dropdown for å endre status på en lead. Spesial-håndtering:
 *   - 'won'  → åpner dialog: beløp + recurring + valgfri note + 🎉 confetti
 *   - 'lost' → åpner dialog: påkrevd årsak fra liste + valgfri detalj
 *
 * Etter endring trigger backend notify til alle interessenter.
 */

import React, { useState } from "react";
import {
  Box, Stack, Typography, Button, Chip, IconButton, Tooltip, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem as MIt,
  Alert, Snackbar, InputAdornment,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import FiberNewIcon from "@mui/icons-material/FiberNew";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import EventIcon from "@mui/icons-material/Event";
import DescriptionIcon from "@mui/icons-material/Description";
import HandshakeIcon from "@mui/icons-material/Handshake";
import ArchiveIcon from "@mui/icons-material/Archive";
import PauseIcon from "@mui/icons-material/Pause";

const STATUSES = [
  { key: "new",            label: "Ny",                icon: <FiberNewIcon fontSize="small" />, color: "default" as const },
  { key: "contacted",      label: "Kontaktet",         icon: <PhoneInTalkIcon fontSize="small" />, color: "info" as const },
  { key: "meeting_booked", label: "Møte booket",       icon: <EventIcon fontSize="small" />, color: "primary" as const },
  { key: "proposal_sent",  label: "Forslag sendt",     icon: <DescriptionIcon fontSize="small" />, color: "secondary" as const },
  { key: "negotiating",    label: "I forhandling",     icon: <HandshakeIcon fontSize="small" />, color: "warning" as const },
  { key: "won",            label: "Vunnet 🎉",         icon: <CheckCircleIcon fontSize="small" />, color: "success" as const },
  { key: "lost",           label: "Tapt",              icon: <CancelIcon fontSize="small" />, color: "error" as const },
  { key: "paused",         label: "Pauset",            icon: <PauseIcon fontSize="small" />, color: "default" as const },
  { key: "archived",       label: "Arkivert",          icon: <ArchiveIcon fontSize="small" />, color: "default" as const },
];

const LOST_REASONS = [
  { key: "no_budget",          label: "Ingen budsjett" },
  { key: "no_decision_maker",  label: "Ingen avgjørelsestaker" },
  { key: "no_timeline",        label: "Ingen tidshorisont" },
  { key: "competitor",         label: "Tapt til konkurrent" },
  { key: "bad_fit",            label: "Dårlig fit" },
  { key: "unresponsive",       label: "Ikke responderer" },
  { key: "too_expensive",      label: "For dyrt" },
  { key: "other",              label: "Annet" },
];

interface Props {
  customerId: string;
  currentStatus: string;
  customerName?: string;
  onChange?: (newStatus: string) => void;
}

export function LeadStatusChanger({ customerId, currentStatus, customerName, onChange }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [wonOpen, setWonOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const current = STATUSES.find((s) => s.key === currentStatus)
                ?? STATUSES.find((s) => s.key === "new")!;

  const pick = (statusKey: string) => {
    setAnchor(null);
    if (statusKey === "won") { setWonOpen(true); return; }
    if (statusKey === "lost") { setLostOpen(true); return; }
    submit(statusKey, {});
  };

  const submit = async (toStatus: string, extra: any) => {
    setSubmitting(true);
    try {
      const r = await fetch(`/api/leadgrid/customers/${customerId}/status`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_status: toStatus, ...extra }),
      });
      const j = await r.json();
      if (r.ok) {
        setSnack({ kind: "ok", msg: `Status: ${STATUSES.find(s => s.key === toStatus)?.label ?? toStatus}` });
        onChange?.(toStatus);
        if (toStatus === "won") {
          // Mini-confetti effekt
          fireConfetti();
        }
      } else {
        setSnack({ kind: "err", msg: j?.error ?? "Feilet" });
      }
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <Chip
        icon={current.icon}
        label={current.label}
        color={current.color}
        clickable
        disabled={submitting}
        onClick={(e) => setAnchor(e.currentTarget as HTMLElement)}
        onDelete={(e) => setAnchor((e as any).currentTarget as HTMLElement)}
        deleteIcon={<ArrowDropDownIcon />}
        sx={{ fontWeight: 600, fontSize: 12 }}
      />

      <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}>
        {STATUSES.map((s) => (
          <MenuItem key={s.key} onClick={() => pick(s.key)}
                    selected={s.key === currentStatus}
                    sx={{ minWidth: 220 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
              <Box sx={{ color: s.color === "default" ? "text.secondary" : `${s.color}.main` }}>
                {s.icon}
              </Box>
              <Typography variant="body2" sx={{ flex: 1 }}>{s.label}</Typography>
              {s.key === currentStatus && (
                <Typography variant="caption" color="text.disabled">(nåværende)</Typography>
              )}
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      {wonOpen && (
        <WonDialog customerName={customerName} onClose={() => setWonOpen(false)}
                    onSubmit={(data) => { setWonOpen(false); submit("won", data); }} />
      )}
      {lostOpen && (
        <LostDialog customerName={customerName} onClose={() => setLostOpen(false)}
                     onSubmit={(data) => { setLostOpen(false); submit("lost", data); }} />
      )}

      <Snackbar open={!!snack} autoHideDuration={3500} onClose={() => setSnack(null)}>
        <Alert severity={snack?.kind === "ok" ? "success" : "error"}
               onClose={() => setSnack(null)}>{snack?.msg}</Alert>
      </Snackbar>
    </>
  );
}

function WonDialog({ customerName, onClose, onSubmit }: {
  customerName?: string; onClose: () => void;
  onSubmit: (data: { won_amount_oere?: number; won_recurring_oere?: number; won_note?: string }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState("");
  const [note, setNote] = useState("");

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        🎉 Marker som vunnet
        {customerName && (
          <Typography variant="body2" color="text.secondary">{customerName}</Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            Gratulerer! Fyll inn deal-info så får alle markedssjefer og hele teamet beskjed.
          </Alert>
          <TextField label="Engangs-beløp" value={amount}
                     onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                     fullWidth size="small" type="text"
                     InputProps={{ endAdornment: <InputAdornment position="end">kr</InputAdornment> }}
                     helperText="Hva ble det betalt i engangs-honorar?" />
          <TextField label="Månedlig recurring" value={recurring}
                     onChange={(e) => setRecurring(e.target.value.replace(/[^0-9]/g, ""))}
                     fullWidth size="small" type="text"
                     InputProps={{ endAdornment: <InputAdornment position="end">kr/mnd</InputAdornment> }}
                     helperText="Månedlig recurring revenue" />
          <TextField label="Notat (valgfri)" value={note}
                     onChange={(e) => setNote(e.target.value)}
                     fullWidth multiline rows={2} size="small"
                     placeholder="F.eks. 'Signert 12-mnd avtale, kicker i juli'" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" color="success"
                onClick={() => onSubmit({
                  won_amount_oere: amount ? Number(amount) * 100 : undefined,
                  won_recurring_oere: recurring ? Number(recurring) * 100 : undefined,
                  won_note: note || undefined,
                })}>
          🎉 Marker som vunnet
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LostDialog({ customerName, onClose, onSubmit }: {
  customerName?: string; onClose: () => void;
  onSubmit: (data: { lost_reason: string; lost_reason_detail?: string }) => void;
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Marker som tapt
        {customerName && (
          <Typography variant="body2" color="text.secondary">{customerName}</Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            Du må velge en årsak. Vi bruker dette til læring + statistikk.
          </Alert>
          <TextField label="Årsak" value={reason}
                     onChange={(e) => setReason(e.target.value)}
                     select fullWidth size="small" required>
            {LOST_REASONS.map((r) => (
              <MIt key={r.key} value={r.key}>{r.label}</MIt>
            ))}
          </TextField>
          <TextField label="Detalj (valgfri)" value={detail}
                     onChange={(e) => setDetail(e.target.value)}
                     fullWidth multiline rows={2} size="small"
                     placeholder="F.eks. 'Valgte konkurrent X på pris'" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" color="error" disabled={!reason}
                onClick={() => onSubmit({ lost_reason: reason, lost_reason_detail: detail || undefined })}>
          Marker som tapt
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function fireConfetti() {
  // Lett-vekt confetti (uten ekstra dep)
  const colors = ["#a78bfa", "#9be15d", "#fbbf24", "#f87171", "#60a5fa"];
  for (let i = 0; i < 36; i++) {
    const d = document.createElement("div");
    d.style.cssText = `
      position: fixed; left: 50%; top: 30%;
      width: 8px; height: 8px;
      background: ${colors[i % colors.length]};
      border-radius: 50%;
      pointer-events: none; z-index: 99999;
      transition: all 1.2s ease-out;
    `;
    document.body.appendChild(d);
    requestAnimationFrame(() => {
      const angle = (Math.PI * 2 * i) / 36;
      const dist = 200 + Math.random() * 150;
      d.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 200}px) rotate(${Math.random() * 720}deg)`;
      d.style.opacity = "0";
    });
    setTimeout(() => d.remove(), 1500);
  }
}

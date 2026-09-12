/**
 * OrgSwitcher.tsx
 *
 * Top-nav drop-down for å bytte aktiv org-kontekst.
 *
 * Vises kun hvis:
 *   - users.role = 'super_admin' (kan velge hvilken som helst org)
 *   - eller bruker har medlemskap i >1 org
 *
 * Henter:
 *   - GET /api/users/me/organizations (medlemskaps-orgs)
 *   - GET /api/superadmin/organizations (kun for super_admin, alle orgs)
 *
 * Skifter via:
 *   - POST /api/users/me/active-org (vanlig medlem)
 *   - POST /api/superadmin/switch-context (super_admin → audit-logget)
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Button, Menu, MenuItem, Stack, Typography, Chip, Avatar, Divider,
  TextField, ListItemText, ListItemAvatar, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import LogoutIcon from "@mui/icons-material/Logout";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";

interface OrgOption {
  id: string;
  name: string;
  org_type: string;
  plan: string;
  logo_url: string | null;
  role?: string;
  is_active_member?: boolean;
}

interface Props {
  /** Vises kun for innloggede brukere — caller bestemmer mounting */
  currentUserId: string;
  currentRole: string;            // 'super_admin' | 'admin' | 'member' | ...
  activeOrgId?: string | null;
  activeOrgName?: string;
  onSwitched?: (orgId: string, orgName: string) => void;
}

export function OrgSwitcher({
  currentUserId, currentRole, activeOrgId, activeOrgName, onSwitched,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [memberships, setMemberships] = useState<OrgOption[]>([]);
  const [allOrgs, setAllOrgs] = useState<OrgOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [impersonation, setImpersonation] = useState<{ active_org_id: string; org_name: string; expires_at: string } | null>(null);
  const [reasonDialog, setReasonDialog] = useState<{ orgId: string; orgName: string } | null>(null);
  const [reason, setReason] = useState("");

  const isSuperAdmin = currentRole === "super_admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Memberships (alle brukere)
      const r1 = await fetch("/api/users/me/organizations");
      if (r1.ok) {
        const d = await r1.json();
        setMemberships(d.organizations ?? []);
      }
      if (isSuperAdmin) {
        const r2 = await fetch("/api/superadmin/organizations");
        if (r2.ok) {
          const d = await r2.json();
          setAllOrgs(d.organizations ?? []);
        }
        const r3 = await fetch("/api/superadmin/active-impersonation");
        if (r3.ok) {
          const d = await r3.json();
          setImpersonation(d.active ?? null);
        }
      }
    } catch { /* swallow */ }
    setLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => { if (anchorEl) load(); }, [anchorEl, load]);

  // Bestem om OrgSwitcher skal vises i det hele tatt
  const shouldShow = isSuperAdmin || memberships.length > 1;
  // Trigger load én gang for å vite om vi har > 1
  useEffect(() => { load(); }, [load]);

  if (!shouldShow && memberships.length <= 1) {
    return null;
  }

  const handleSwitch = async (orgId: string, orgName: string) => {
    if (isSuperAdmin) {
      // Super-admin må gi grunn
      const isOwnOrg = memberships.some((m) => m.id === orgId);
      if (!isOwnOrg) {
        setReasonDialog({ orgId, orgName });
        setAnchorEl(null);
        return;
      }
    }
    // Vanlig membership-bytte
    try {
      const r = await fetch("/api/users/me/active-org", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      if (r.ok) {
        onSwitched?.(orgId, orgName);
        setAnchorEl(null);
        // Soft reload så app-state bytter
        window.location.reload();
      }
    } catch { /* swallow */ }
  };

  const handleSuperAdminSwitch = async () => {
    if (!reasonDialog || !reason.trim()) return;
    try {
      const r = await fetch("/api/superadmin/switch-context", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: reasonDialog.orgId, reason }),
      });
      if (r.ok) {
        onSwitched?.(reasonDialog.orgId, reasonDialog.orgName);
        setReasonDialog(null);
        setReason("");
        window.location.reload();
      }
    } catch { /* swallow */ }
  };

  const endImpersonation = async () => {
    try {
      await fetch("/api/superadmin/end-impersonation", { method: "POST" });
      setImpersonation(null);
      window.location.reload();
    } catch { /* swallow */ }
  };

  // Filtrer + slå sammen
  const displayList = isSuperAdmin && allOrgs ? allOrgs : memberships;
  const filtered = search
    ? displayList.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : displayList;
  // Egne medlemskaps-orgs sorteres øverst
  const sorted = [...filtered].sort((a, b) => {
    const aOwn = memberships.some((m) => m.id === a.id) ? -1 : 0;
    const bOwn = memberships.some((m) => m.id === b.id) ? -1 : 0;
    return aOwn - bOwn;
  });

  return (
    <>
      <Button
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<KeyboardArrowDownIcon />}
        sx={{
          color: "#fff",
          bgcolor: impersonation ? "rgba(255,184,107,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${impersonation ? "#ffb86b40" : "rgba(255,255,255,0.1)"}`,
          textTransform: "none",
          px: 2, py: 0.6,
          "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {impersonation && <VerifiedUserIcon sx={{ fontSize: 16, color: "#ffb86b" }} />}
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {impersonation?.org_name ?? activeOrgName ?? "Velg org"}
          </Typography>
        </Stack>
      </Button>

      <Menu
        anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            bgcolor: "#0a0512", color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
            minWidth: 340, maxHeight: 500,
          },
        }}
      >
        {impersonation && (
          <Box sx={{ p: 2, borderBottom: "1px solid rgba(255,255,255,0.08)",
                      bgcolor: "rgba(255,184,107,0.08)" }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <VerifiedUserIcon sx={{ color: "#ffb86b", fontSize: 20 }} />
              <Typography variant="caption" sx={{ color: "#ffb86b", fontWeight: 600 }}>
                Du låner {impersonation.org_name}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", display: "block" }}>
              Utløper {new Date(impersonation.expires_at).toLocaleTimeString("no-NO")}
            </Typography>
            <Button size="small" startIcon={<LogoutIcon />} onClick={endImpersonation}
                    sx={{ mt: 1, color: "#ffb86b" }}>
              Avslutt impersonation
            </Button>
          </Box>
        )}

        {isSuperAdmin && (allOrgs?.length ?? 0) > 5 && (
          <Box sx={{ p: 1, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <TextField
              fullWidth size="small" placeholder="Søk org…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ color: "rgba(255,255,255,0.4)", mr: 1 }} /> }}
              sx={{ "& .MuiOutlinedInput-root": { color: "#fff",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.1)" } } }}
            />
          </Box>
        )}

        {loading ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <CircularProgress size={20} />
          </Box>
        ) : sorted.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
              Ingen organisasjoner
            </Typography>
          </Box>
        ) : (
          sorted.slice(0, 50).map((o) => {
            const isOwnMembership = memberships.some((m) => m.id === o.id);
            const isActive = o.id === activeOrgId;
            return (
              <MenuItem key={o.id} onClick={() => handleSwitch(o.id, o.name)}
                        selected={isActive}
                        sx={{ "&.Mui-selected": { bgcolor: "rgba(167,139,250,0.15)" } }}>
                <ListItemAvatar>
                  {o.logo_url ? (
                    <Avatar src={o.logo_url} sx={{ bgcolor: "#fff", "& img": { objectFit: "contain", p: 0.5 } }} />
                  ) : (
                    <Avatar sx={{ bgcolor:
                      o.org_type === "developer" ? "#9be15d"
                        : o.org_type === "agency" ? "#7ab8ff"
                        : "#ffb86b", color: "#0a0512", fontWeight: 700 }}>
                      {o.name.substring(0, 2).toUpperCase()}
                    </Avatar>
                  )}
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography sx={{ color: "#fff", fontSize: 14 }}>{o.name}</Typography>
                      {isOwnMembership && <StarIcon sx={{ fontSize: 14, color: "#ffb86b" }} />}
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" spacing={0.5} mt={0.3}>
                      <Chip size="small" label={o.org_type}
                            sx={{ height: 16, fontSize: 9, bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }} />
                      <Chip size="small" label={o.plan}
                            sx={{ height: 16, fontSize: 9, bgcolor: "rgba(167,139,250,0.10)", color: "#a78bfa" }} />
                    </Stack>
                  }
                />
              </MenuItem>
            );
          })
        )}
      </Menu>

      {/* Reason-dialog for super-admin switch */}
      <Dialog open={!!reasonDialog} onClose={() => { setReasonDialog(null); setReason(""); }}
              maxWidth="sm" fullWidth
              PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
        <DialogTitle>Lån {reasonDialog?.orgName}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Du vil se org'ens data som super-admin. Alle handlinger logges i
            superadmin_audit_log. Utløper automatisk om 2 timer.
          </Alert>
          <TextField
            fullWidth multiline rows={3} autoFocus required
            label="Begrunnelse (kreves)"
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="F.eks. 'Hjelp m/ Meta Pixel-feilsøking'"
            sx={{ "& .MuiOutlinedInput-root": { color: "#fff",
                   "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
                   "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setReasonDialog(null); setReason(""); }}>Avbryt</Button>
          <Button variant="contained" disabled={!reason.trim()} onClick={handleSuperAdminSwitch}
                  sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700 }}>
            Bytt kontekst
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

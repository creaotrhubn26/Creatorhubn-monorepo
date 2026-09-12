/**
 * CrmCustomerDetailDrawer.tsx
 *
 * Detalj-drawer for én CRM-kunde m/ all relevant info:
 *   - Header: navn, logo, score, tier-chip
 *   - LeadStatusChanger (kan endre status direkte)
 *   - AssignmentStatusChip (hvem er tildelt + sett-status)
 *   - Re-tildel-knapp m/ AssignLeadDialog
 *   - Kontaktinfo (e-post, telefon, website)
 *   - LeadStatusHistory timeline
 *   - Claude talking points (hvis tilgjengelig)
 *   - Notater-felt (TODO: backend)
 */

import React, { useEffect, useState } from "react";
import {
  Drawer, Box, Stack, Typography, IconButton, Chip, Avatar, Divider,
  Button, Tabs, Tab, Tooltip, CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LanguageIcon from "@mui/icons-material/Language";
import EditIcon from "@mui/icons-material/Edit";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import { LeadStatusChanger } from "./LeadStatusChanger";
import { LeadStatusHistory } from "./LeadStatusHistory";
import { AssignmentStatusChip } from "./AssignmentStatusChip";
import { AssignLeadDialog } from "./AssignLeadDialog";
import { TerritoryGridChip } from "./TerritoryGridChip";

interface CustomerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  logo_url: string | null;
  status: string;
  lead_category: string | null;
  ai_opportunity_score: number | null;
  assignment_note: string | null;
}

interface Props {
  customerId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

const TIER_BADGE: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  hot:  { icon: <LocalFireDepartmentIcon sx={{ fontSize: 16 }} />, color: "#f87171", label: "HOT" },
  warm: { icon: <WhatshotIcon sx={{ fontSize: 16 }} />,             color: "#ffb86b", label: "WARM" },
  cool: { icon: <WhatshotIcon sx={{ fontSize: 16 }} />,             color: "#60a5fa", label: "COOL" },
  cold: { icon: <WhatshotIcon sx={{ fontSize: 16 }} />,             color: "#9ca3af", label: "COLD" },
};

export function CrmCustomerDetailDrawer({ customerId, onClose, onUpdated }: Props) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"overview" | "history" | "assignment">("overview");
  const [reassignLevel, setReassignLevel] = useState<"team_leader" | "rep" | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!customerId) { setCustomer(null); return; }
    setLoading(true);
    fetch(`/api/leadgrid/customers/${customerId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then(setCustomer)
      .finally(() => setLoading(false));
  }, [customerId, refreshKey]);

  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
    onUpdated?.();
  };

  if (!customerId) return null;
  const tier = customer?.lead_category && TIER_BADGE[customer.lead_category];

  return (
    <Drawer anchor="right" open={!!customerId} onClose={onClose}
            slotProps={{ paper: { sx: { width: { xs: "100%", md: 560 },
                                          bgcolor: "#0a0512", color: "#fff" } } }}>
      <Box sx={{ p: 3, position: "sticky", top: 0, bgcolor: "#0a0512", zIndex: 2,
                  borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Stack direction="row" alignItems="flex-start" spacing={2}>
          <Avatar src={customer?.logo_url ?? undefined}
                  sx={{ width: 56, height: 56, bgcolor: "rgba(167,139,250,0.20)" }}>
            {customer?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {loading || !customer ? (
              <CircularProgress size={20} />
            ) : (
              <>
                <Typography variant="h6" sx={{ fontWeight: 700,
                                                 whiteSpace: "nowrap",
                                                 overflow: "hidden",
                                                 textOverflow: "ellipsis" }}>
                  {customer.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={0.5}
                       flexWrap="wrap" rowGap={0.5}>
                  {tier && (
                    <Chip size="small" icon={tier.icon as any} label={tier.label}
                          sx={{ bgcolor: tier.color, color: "#0a0512",
                                fontWeight: 700, fontSize: 10 }} />
                  )}
                  {customer.ai_opportunity_score && (
                    <Chip size="small" label={`Score: ${customer.ai_opportunity_score}`}
                          sx={{ fontSize: 10 }} />
                  )}
                  <LeadStatusChanger customerId={customer.id}
                                      currentStatus={customer.status}
                                      customerName={customer.name}
                                      onChange={triggerRefresh} />
                </Stack>
              </>
            )}
          </Box>
          <IconButton onClick={onClose} sx={{ color: "rgba(255,255,255,0.7)" }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        {/* Kontaktinfo */}
        {customer && (
          <Stack direction="row" spacing={2} sx={{ mt: 2 }} flexWrap="wrap" rowGap={1}>
            {customer.email && (
              <Box component="a" href={`mailto:${customer.email}`}
                   sx={{ display: "inline-flex", alignItems: "center", gap: 0.5,
                         color: "#a78bfa", textDecoration: "none", fontSize: 13 }}>
                <EmailIcon sx={{ fontSize: 14 }} />
                {customer.email}
              </Box>
            )}
            {customer.phone && (
              <Box component="a" href={`tel:${customer.phone}`}
                   sx={{ display: "inline-flex", alignItems: "center", gap: 0.5,
                         color: "#a78bfa", textDecoration: "none", fontSize: 13 }}>
                <PhoneIcon sx={{ fontSize: 14 }} />
                {customer.phone}
              </Box>
            )}
            {customer.website_url && (
              <Box component="a" href={customer.website_url} target="_blank"
                   rel="noopener noreferrer"
                   sx={{ display: "inline-flex", alignItems: "center", gap: 0.5,
                         color: "#a78bfa", textDecoration: "none", fontSize: 13 }}>
                <LanguageIcon sx={{ fontSize: 14 }} />
                {customer.website_url.replace(/^https?:\/\//, "")}
                <OpenInNewIcon sx={{ fontSize: 12 }} />
              </Box>
            )}
          </Stack>
        )}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{ px: 2, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Tab label="Oversikt" value="overview" />
        <Tab label="Tildeling" value="assignment" />
        <Tab label="Historikk" value="history" />
      </Tabs>

      <Box sx={{ p: 3, overflow: "auto" }}>
        {tab === "overview" && customer && (
          <Stack spacing={3}>
            {customer.assignment_note && (
              <Box sx={{ p: 2, bgcolor: "rgba(167,139,250,0.10)",
                          borderRadius: 1, border: "1px solid rgba(167,139,250,0.30)" }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)",
                                                      letterSpacing: 1, textTransform: "uppercase",
                                                      fontSize: 10 }}>
                  Notat fra markedssjef
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic" }}>
                  "{customer.assignment_note}"
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1,
                                                      color: "rgba(255,255,255,0.7)",
                                                      textTransform: "uppercase",
                                                      letterSpacing: 1, fontSize: 11 }}>
                Tildelt
              </Typography>
              <AssignmentStatusChip
                customerId={customer.id}
                canReassign
                onReassignClick={(level) => setReassignLevel(level)}
              />
              <Box sx={{ mt: 1 }}>
                <TerritoryGridChip leadId={customer.id} />
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1,
                                                      color: "rgba(255,255,255,0.7)",
                                                      textTransform: "uppercase",
                                                      letterSpacing: 1, fontSize: 11 }}>
                Status-historikk (siste 5)
              </Typography>
              <LeadStatusHistory customerId={customer.id} />
            </Box>
          </Stack>
        )}

        {tab === "assignment" && customer && (
          <Stack spacing={2}>
            <AssignmentStatusChip customerId={customer.id} canReassign
              onReassignClick={(level) => setReassignLevel(level)} />
            <Button variant="outlined" startIcon={<EditIcon />}
                    onClick={() => setReassignLevel("team_leader")}>
              Re-tildel teamleder
            </Button>
            <Button variant="outlined" startIcon={<EditIcon />}
                    onClick={() => setReassignLevel("rep")}>
              Re-tildel rep
            </Button>
          </Stack>
        )}

        {tab === "history" && customer && (
          <LeadStatusHistory customerId={customer.id} />
        )}
      </Box>

      {reassignLevel && customer && (
        <AssignLeadDialog open
          onClose={() => setReassignLevel(null)}
          customerId={customer.id}
          lead={{ agency_name: customer.name, claude_temperature: customer.lead_category ?? undefined }}
          mode="reassign" level={reassignLevel} />
      )}
    </Drawer>
  );
}

/**
 * EditingVendorDiscoveryPanel.tsx
 *
 * Fotografens discovery-flate (showcase.png-mockup): «Har du mye å gjøre?»-hero
 * + liste over godkjente, compliance-klare redigeringsbedrifter (Foto og video)
 * + «Slik fungerer det»-sidebar + «Showcase klar for godkjenning».
 *
 * Henter /api/editing/vendors og /api/editing/jobs. Norsk (fotograf-siden).
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  Rating,
  Stack,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  useTheme,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import EditIcon from "@mui/icons-material/Edit";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SendIcon from "@mui/icons-material/Send";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import LockIcon from "@mui/icons-material/Lock";
import StorageIcon from "@mui/icons-material/Storage";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import GroupsIcon from "@mui/icons-material/Groups";
import { apiRequest } from "@/lib/queryClient";
import { t, badgeLabel, type Locale } from "./editingMarketplaceStrings";
import EditingRequestDialog from "./EditingRequestDialog";

interface EditingVendorService {
  category: string;
  name: string | null;
  price: number | null;
  currency: string;
}
interface EditingVendor {
  vendorUserId: string;
  vendorName: string;
  tagline: string | null;
  logoUrl: string | null;
  rating: number | null;
  reviewCount: number;
  turnaroundDays: number | null;
  availabilityStatus: string;
  isInternational: boolean;
  requiresExtraGdpr: boolean;
  badges: string[];
  services: EditingVendorService[];
}

interface Props {
  /** Antall kommende oppdrag e.l. — driver «du har mye å gjøre»-signalet. */
  busyCount?: number;
  onSeeProfile?: (vendorUserId: string) => void;
  onSendRequest?: (vendorUserId: string) => void;
  onCreateRequest?: () => void;
  onApproveJob?: (jobId: string) => void;
  locale?: Locale;
}

const HOW_IT_WORKS = [
  { icon: GroupsIcon, key: 1 },
  { icon: CloudUploadIcon, key: 2 },
  { icon: EditIcon, key: 3 },
  { icon: DesktopWindowsIcon, key: 4 },
  { icon: CheckCircleIcon, key: 5 },
  { icon: SendIcon, key: 6 },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 3)
    .join("")
    .toUpperCase();
}

export default function EditingVendorDiscoveryPanel({
  busyCount = 0,
  onSeeProfile,
  onSendRequest,
  onCreateRequest,
  onApproveJob,
  locale = "no",
}: Props) {
  const theme = useTheme();
  const accent = "#ff8c00";
  const [showAll, setShowAll] = useState(false);

  const vendorsQuery = useQuery<{ vendors: EditingVendor[]; count: number }>({
    queryKey: ["/api/editing/vendors"],
    queryFn: () => apiRequest("/api/editing/vendors"),
  });

  const readyQuery = useQuery<{ jobs: Array<{ id: string; project_title: string | null; vendor_name: string | null; status: string }> }>({
    queryKey: ["/api/editing/jobs", "delivered"],
    queryFn: () => apiRequest("/api/editing/jobs?status=delivered"),
  });

  const vendors = vendorsQuery.data?.vendors ?? [];
  const shown = showAll ? vendors : vendors.slice(0, 4);
  const readyJobs = readyQuery.data?.jobs ?? [];

  const qc = useQueryClient();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [requestVendorId, setRequestVendorId] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  const profileQuery = useQuery<EditingVendor & { country?: string }>({
    queryKey: ["/api/editing/vendors", profileId],
    queryFn: () => apiRequest(`/api/editing/vendors/${profileId}`),
    enabled: !!profileId,
  });

  const approveMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiRequest(`/api/editing/jobs/${jobId}/approve`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/editing/jobs", "delivered"] });
      setSnack({ msg: t("approve_and_deliver", locale), sev: "success" });
    },
    onError: () => setSnack({ msg: "Feil", sev: "error" }),
  });

  const handleSeeProfile = onSeeProfile ?? ((id: string) => setProfileId(id));
  const handleSendRequest =
    onSendRequest ??
    ((id: string) => {
      setProfileId(null);
      setRequestVendorId(id);
    });
  const handleApprove = onApproveJob ?? ((id: string) => approveMutation.mutate(id));
  const profile = profileQuery.data;

  const cardSx = {
    bgcolor: theme.palette.mode === "dark" ? "#15181d" : "#fff",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
  } as const;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 320px" }, gap: 3 }}>
      {/* Venstre kolonne: hero + bedriftsliste */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Hero */}
        <Card sx={cardSx}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              <Avatar variant="rounded" sx={{ bgcolor: `${accent}22`, color: accent, width: 56, height: 56 }}>
                <CalendarMonthIcon />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {t("hero_title", locale)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t("hero_body", locale)}
                </Typography>
              </Box>
              <Stack spacing={1}>
                <Button
                  variant="contained"
                  onClick={onCreateRequest}
                  sx={{ bgcolor: accent, "&:hover": { bgcolor: "#e67e00" }, whiteSpace: "nowrap" }}
                >
                  {t("see_available", locale)}
                </Button>
                <Button variant="outlined" onClick={onCreateRequest} sx={{ whiteSpace: "nowrap" }}>
                  {t("create_request", locale)}
                </Button>
              </Stack>
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 2 }}>
              <VerifiedUserIcon sx={{ fontSize: 18, color: accent }} />
              <Typography variant="caption" color="text.secondary">
                {t("hero_secure_note", locale)}
              </Typography>
            </Box>
            {busyCount > 0 && (
              <Chip
                size="small"
                label={`${busyCount} ${locale === "no" ? "kommende oppdrag" : "upcoming jobs"}`}
                sx={{ mt: 1.5, bgcolor: `${accent}22`, color: accent }}
              />
            )}
          </CardContent>
        </Card>

        {/* Bedriftsliste */}
        <Card sx={cardSx}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              {t("available_companies", locale)}
            </Typography>

            {vendorsQuery.isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : vendors.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                {t("no_vendors", locale)}
              </Typography>
            ) : (
              <Stack divider={<Divider />} spacing={0}>
                {shown.map((v) => (
                  <Box key={v.vendorUserId} sx={{ display: "flex", gap: 2, py: 2, alignItems: "center", flexWrap: "wrap" }}>
                    <Avatar
                      variant="rounded"
                      src={v.logoUrl || undefined}
                      sx={{ width: 56, height: 56, bgcolor: "#222", color: "#fff", fontWeight: 700 }}
                    >
                      {initials(v.vendorName)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography sx={{ fontWeight: 700 }}>{v.vendorName}</Typography>
                      {v.tagline && (
                        <Typography variant="body2" color="text.secondary">
                          {v.tagline}
                        </Typography>
                      )}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                        {v.rating != null && (
                          <>
                            <Rating value={v.rating} precision={0.1} size="small" readOnly />
                            <Typography variant="caption" color="text.secondary">
                              {v.rating.toFixed(1)} ({v.reviewCount})
                            </Typography>
                          </>
                        )}
                      </Box>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                        {v.services.slice(0, 3).map((s, i) => (
                          <Chip key={i} size="small" variant="outlined" label={s.name || s.category} />
                        ))}
                        {v.availabilityStatus === "available" && (
                          <Chip size="small" color="success" label={t("available_now", locale)} />
                        )}
                      </Box>
                    </Box>
                    {/* Compliance-badges */}
                    <Stack spacing={0.5} sx={{ minWidth: 200 }}>
                      {v.badges.slice(0, 3).map((b) => (
                        <Box key={b} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
                          <Typography variant="caption">{badgeLabel(b, locale)}</Typography>
                        </Box>
                      ))}
                    </Stack>
                    <Stack spacing={1} sx={{ minWidth: 140 }}>
                      <Button size="small" variant="outlined" onClick={() => handleSeeProfile(v.vendorUserId)}>
                        {t("see_profile", locale)}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SendIcon />}
                        onClick={() => handleSendRequest(v.vendorUserId)}
                        sx={{ bgcolor: accent, "&:hover": { bgcolor: "#e67e00" } }}
                      >
                        {t("send_request", locale)}
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            {vendors.length > 4 && (
              <Box sx={{ textAlign: "center", mt: 1 }}>
                <Button onClick={() => setShowAll((s) => !s)} endIcon={<ArrowForwardIcon />}>
                  {t("show_more", locale)}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Sikkerhet & integrasjon */}
        <Card sx={cardSx}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 2 }}>
              {[
                { icon: LockIcon, title: "sec_handling", sub: "sec_handling_sub" },
                { icon: StorageIcon, title: "sec_b2", sub: "sec_b2_sub" },
                { icon: FactCheckIcon, title: "sec_agreements", sub: "sec_agreements_sub" },
                { icon: VerifiedUserIcon, title: "sec_delivery", sub: "sec_delivery_sub" },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <Box key={i} sx={{ textAlign: "center" }}>
                    <Icon sx={{ color: accent, mb: 0.5 }} />
                    <Typography variant="caption" sx={{ display: "block", fontWeight: 600 }}>
                      {t(s.title, locale)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(s.sub, locale)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Høyre kolonne: Slik fungerer det + Showcase klar */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Card sx={cardSx}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              {t("how_it_works", locale)}
            </Typography>
            <Stack spacing={2}>
              {HOW_IT_WORKS.map(({ icon: Icon, key }) => (
                <Box key={key} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                  <Avatar sx={{ bgcolor: `${accent}22`, color: accent, width: 36, height: 36 }}>
                    <Icon sx={{ fontSize: 20 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {key}. {t(`step${key}_title`, locale)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(`step${key}_body`, locale)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={cardSx}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t("showcase_ready", locale)}
              </Typography>
            </Box>
            {readyJobs.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                —
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {readyJobs.map((j) => (
                  <Box
                    key={j.id}
                    sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                        {j.project_title || "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {j.vendor_name}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleApprove(j.id)}
                      sx={{ bgcolor: accent, "&:hover": { bgcolor: "#e67e00" }, whiteSpace: "nowrap" }}
                    >
                      {t("approve_and_deliver", locale)}
                    </Button>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Vendor-profil-dialog (Se profil) */}
      <Dialog open={!!profileId} onClose={() => setProfileId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{profile?.vendorName || t("see_profile", locale)}</DialogTitle>
        <DialogContent dividers>
          {profileQuery.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : profile ? (
            <Stack spacing={1.5}>
              {profile.tagline && (
                <Typography variant="body2" color="text.secondary">
                  {profile.tagline}
                </Typography>
              )}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {profile.badges?.map((b) => (
                  <Chip key={b} size="small" icon={<CheckCircleIcon />} label={badgeLabel(b, locale)} />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t("compliance_profile_note", locale)}
              </Typography>
              <Divider />
              <Typography variant="subtitle2">{t("available_companies", locale)}</Typography>
              <Stack spacing={0.5}>
                {profile.services?.map((s, i) => (
                  <Box key={i} sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2">{s.name || s.category}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {s.price != null ? `${s.price} ${s.currency}` : "—"}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileId(null)}>{locale === "no" ? "Lukk" : "Close"}</Button>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => profileId && handleSendRequest(profileId)}
            sx={{ bgcolor: accent, "&:hover": { bgcolor: "#e67e00" } }}
          >
            {t("send_request", locale)}
          </Button>
        </DialogActions>
      </Dialog>

      <EditingRequestDialog
        vendorUserId={requestVendorId}
        open={!!requestVendorId}
        onClose={() => setRequestVendorId(null)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["/api/editing/jobs"] });
          setSnack({ msg: t("send_request", locale), sev: "success" });
        }}
        locale={locale}
      />

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}>
        {snack ? (
          <Alert severity={snack.sev} onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

/**
 * leadgrid-marketplace.tsx — offentlig marketplace på /leadgrid/marketplace.
 *
 * Viser approved partnere sortert på tier (strategic→listed) m/
 * partner_type-filter + søk.
 */

import React, { useEffect, useState, useMemo } from "react";
import {
  Box, Container, Stack, Typography, Card, CardContent, Chip, Avatar,
  TextField, ToggleButton, ToggleButtonGroup, InputAdornment, Grid,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VerifiedIcon from "@mui/icons-material/Verified";
import StarIcon from "@mui/icons-material/Star";
import HandshakeIcon from "@mui/icons-material/Handshake";

const PALETTE = {
  bg: "#0a0512", accent: "#a78bfa", text: "#f4f0ff",
  textMuted: "rgba(244,240,255,0.72)", textFaint: "rgba(244,240,255,0.45)",
};

const PARTNER_TYPE_COLORS: Record<string, { color: string; label: string }> = {
  integration:          { color: "#9be15d", label: "Integration" },
  verified_integration: { color: "#9be15d", label: "Verified Integration" },
  strategic:            { color: "#a78bfa", label: "Strategic" },
  agency:               { color: "#7ab8ff", label: "Agency" },
  data:                 { color: "#ffb86b", label: "Data" },
  implementation:       { color: "#f472b6", label: "Implementation" },
  certified:            { color: "#a78bfa", label: "Certified" },
  listed:               { color: "rgba(255,255,255,0.5)", label: "Listed" },
  customer:             { color: "#ffb86b", label: "Customer" },
  reseller:             { color: "#7ab8ff", label: "Reseller" },
};

const TIER_BADGES: Record<string, { color: string; icon: React.ReactElement }> = {
  strategic:            { color: "#a78bfa", icon: <StarIcon fontSize="small" /> },
  verified_integration: { color: "#9be15d", icon: <VerifiedIcon fontSize="small" /> },
  integration:          { color: "#9be15d", icon: <VerifiedIcon fontSize="small" /> },
  certified:            { color: "#7ab8ff", icon: <VerifiedIcon fontSize="small" /> },
  listed:               { color: "rgba(255,255,255,0.5)", icon: <HandshakeIcon fontSize="small" /> },
};

interface Partner {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  tagline: string | null;
  partner_type: string;
  tier: string;
}

export default function LeadgridMarketplacePage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Leadgrid Marketplace — Sertifiserte partnere";
    fetch("/api/leadgrid/marketplace")
      .then((r) => r.ok ? r.json() : { partners: [] })
      .then((d) => { setPartners(d.partners ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      if (filter !== "all" && p.partner_type !== filter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())
          && !p.tagline?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [partners, filter, search]);

  const types = useMemo(() => {
    const set = new Set(partners.map((p) => p.partner_type));
    return Array.from(set);
  }, [partners]);

  return (
    <Box sx={{ bgcolor: PALETTE.bg, color: PALETTE.text, minHeight: "100vh", py: 8,
                fontFamily: '-apple-system, sans-serif' }}>
      <Container maxWidth="lg">
        <Stack alignItems="center" spacing={2} mb={6}>
          <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(167,139,250,0.10)" }}>
            <HandshakeIcon sx={{ fontSize: 48, color: PALETTE.accent }} />
          </Box>
          <Typography variant="overline" sx={{ color: PALETTE.accent, letterSpacing: 2 }}>
            Leadgrid Marketplace
          </Typography>
          <Typography variant="h2" fontWeight={800} textAlign="center">
            Sertifiserte partnere
          </Typography>
          <Typography variant="body1" textAlign="center"
                      sx={{ color: PALETTE.textMuted, maxWidth: 600 }}>
            Vetted partnere som har gått gjennom Leadgrid's verifiserings-program.
            Velg en partner som passer ditt behov.
          </Typography>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={4} alignItems="center">
          <TextField placeholder="Søk partnere…" value={search}
                     onChange={(e) => setSearch(e.target.value)}
                     sx={{ flex: 1, "& .MuiOutlinedInput-root": { color: "#fff" } }}
                     InputProps={{
                       startAdornment: <InputAdornment position="start">
                         <SearchIcon sx={{ color: "rgba(255,255,255,0.4)" }} />
                       </InputAdornment>,
                     }} />
          <ToggleButtonGroup value={filter} exclusive onChange={(_, v) => v && setFilter(v)}
                             sx={{ flexWrap: "wrap" }}>
            <ToggleButton value="all" sx={{ color: "rgba(255,255,255,0.7)" }}>Alle</ToggleButton>
            {types.map((t) => (
              <ToggleButton key={t} value={t} sx={{ color: "rgba(255,255,255,0.7)" }}>
                {PARTNER_TYPE_COLORS[t]?.label ?? t}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography sx={{ color: PALETTE.textMuted }}>Laster…</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
            <CardContent sx={{ p: 6, textAlign: "center" }}>
              <Typography variant="h6" sx={{ color: PALETTE.textMuted }}>
                Ingen partnere matcher
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {filtered.map((p) => {
              const typeMeta = PARTNER_TYPE_COLORS[p.partner_type] ?? { color: "#888", label: p.partner_type };
              const tierMeta = TIER_BADGES[p.tier];
              return (
                <Grid item xs={12} sm={6} md={4} key={p.id}>
                  <Card sx={{
                    bgcolor: "rgba(255,255,255,0.04)", color: "#fff", height: "100%",
                    transition: "all 0.2s",
                    "&:hover": { transform: "translateY(-4px)", boxShadow: `0 12px 30px ${typeMeta.color}30` },
                  }}>
                    <CardContent sx={{ p: 3 }}>
                      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                        {p.logo_url ? (
                          <Box component="img" src={p.logo_url} alt={p.name}
                               sx={{ width: 56, height: 56, borderRadius: 1,
                                     objectFit: "contain", bgcolor: "#fff", p: 0.5 }} />
                        ) : (
                          <Avatar sx={{ bgcolor: typeMeta.color, color: "#0a0512",
                                         fontWeight: 700, width: 56, height: 56 }}>
                            {p.name.substring(0, 2).toUpperCase()}
                          </Avatar>
                        )}
                        <Box flex={1}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{p.name}</Typography>
                          {tierMeta && (
                            <Chip size="small" icon={tierMeta.icon}
                                  label={p.tier.replace(/_/g, " ")}
                                  sx={{ bgcolor: tierMeta.color, color: "#0a0512",
                                        fontWeight: 600, textTransform: "capitalize",
                                        height: 22 }} />
                          )}
                        </Box>
                      </Stack>
                      <Chip size="small" label={typeMeta.label}
                            sx={{ bgcolor: `${typeMeta.color}20`, color: typeMeta.color, mb: 1.5 }} />
                      {p.tagline && (
                        <Typography variant="body2" sx={{ color: PALETTE.textMuted, mb: 2,
                                    minHeight: 40 }}>
                          {p.tagline}
                        </Typography>
                      )}
                      {p.website && (
                        <Typography component="a" href={p.website} target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ display: "block", fontSize: 13, color: PALETTE.accent,
                                          textDecoration: "none",
                                          "&:hover": { textDecoration: "underline" } }}>
                          Besøk nettside →
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>
    </Box>
  );
}

/**
 * ProspectsPanel.tsx — prospekteringslister fra Enhetsregisteret
 *
 * Vertikal-segmentene («alle fotografer i Norge») med kommunefilter,
 * sortert på ansatte. truncated-flagget vises ærlig når sidetaket
 * kuttet listen.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Box, Button, Card, CardContent, Chip, MenuItem, Select, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import { TravelExplore as ProspectIcon } from "@mui/icons-material";
import PanelStateContainer, { toLoadingState } from "./PanelStateContainer";

interface Segment {
  segment_key: string;
  display_name: string;
  total_found: number;
  truncated: boolean;
  refreshed_at: string | null;
}

interface ProspectCompany {
  org_nr: string;
  name: string;
  municipality: string | null;
  employees: number | null;
  registered_at: string | null;
  website: string | null;
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ProspectsPanel() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [municipality, setMunicipality] = useState("");
  const [companies, setCompanies] = useState<ProspectCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (segment: string, kommune: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (segment) params.set("segment", segment);
      if (kommune.trim()) params.set("municipality", `%${kommune.trim()}%`);
      params.set("limit", "50");
      const r = await fetch(`/api/integrations/prospects?${params}`, {
        credentials: "include",
        headers: authHeaders(),
      });
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      const body = await r.json();
      setSegments(body.segments ?? []);
      setCompanies(body.companies ?? []);
      if (!segment && (body.segments ?? []).length > 0) {
        setSelected(body.segments[0].segment_key);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load("", ""); }, [load]);
  useEffect(() => {
    if (selected) void load(selected, municipality);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const current = segments.find((s) => s.segment_key === selected);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
          <ProspectIcon sx={{ color: "#2dd4bf" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Prospektlister — Enhetsregisteret
          </Typography>
          {current && (
            <Chip size="small" label={`${current.total_found.toLocaleString("nb-NO")} selskaper`}
              sx={{ bgcolor: "#2dd4bf22", color: "#2dd4bf", fontWeight: 700 }} />
          )}
          {current?.truncated && (
            <Chip size="small" label="kuttet ved API-tak" color="warning" variant="outlined" />
          )}
          {current && current.total_found === 0 && (
            <Chip size="small" label="bygging pågår" variant="outlined" />
          )}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
          <Select size="small" value={selected} onChange={(e) => setSelected(e.target.value)}
            displayEmpty sx={{ minWidth: 260 }}>
            {segments.map((s) => (
              <MenuItem key={s.segment_key} value={s.segment_key}>{s.display_name}</MenuItem>
            ))}
          </Select>
          <TextField size="small" placeholder="Kommune (f.eks. Bergen)" value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void load(selected, municipality); }} />
          <Button size="small" variant="outlined" onClick={() => void load(selected, municipality)}>
            Filtrer
          </Button>
        </Stack>

        <PanelStateContainer
          state={toLoadingState({ loading, error })}
          error={error}
          onRetry={() => load(selected, municipality)}
          isEmpty={companies.length === 0}
          empty="Ingen selskaper i utvalget — segmentene bygges av nattlig synk (ukentlig refresh)."
        >
          <TableContainer component={Box} sx={{ overflowX: "auto", maxHeight: 360 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Selskap</TableCell>
                  <TableCell>Kommune</TableCell>
                  <TableCell align="right">Ansatte</TableCell>
                  <TableCell>Org.nr</TableCell>
                  <TableCell>Nettside</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.org_nr} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                    <TableCell>{c.municipality ?? "—"}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {c.employees ?? "—"}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{c.org_nr}</TableCell>
                    <TableCell>
                      {c.website ? (
                        <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank" rel="noreferrer" style={{ color: "#2dd4bf" }}>
                          {c.website.replace(/^https?:\/\//, "").slice(0, 30)}
                        </a>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </PanelStateContainer>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Aktive selskaper per verifisert NACE-kode; konkurs/avviklede
          filtreres ved bygging. Viser topp 50 etter antall ansatte.
        </Typography>
      </CardContent>
    </Card>
  );
}

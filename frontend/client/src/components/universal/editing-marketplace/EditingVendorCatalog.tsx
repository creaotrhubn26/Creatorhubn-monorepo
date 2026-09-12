/**
 * EditingVendorCatalog.tsx
 *
 * Redigeringsvendorens EGEN priskatalog — leser/skriver vendor_showcase_products
 * via /api/editing/vendor/products, som er SAMME kilde discovery + forespørsel
 * bruker. Det vendoren legger inn her er nøyaktig det fotografen ser og hyrer fra.
 *
 * Tospråklig (no/en). Valuta defaulter til vendorens land (utenlandsk → egen valuta).
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Card, CardContent, Typography, Button, Chip, Stack, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, CircularProgress,
  Alert, Snackbar, Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { apiRequest } from "@/lib/queryClient";

type Locale = "no" | "en";

interface CatalogProduct {
  id: number | string;
  category: string;
  name: string;
  price: number | null;
  currency: string;
  description?: string | null;
  status: string;
}

interface Props {
  locale?: Locale;
  country?: string | null;
}

const CURRENCIES = ["NOK", "USD", "GBP", "EUR", "SEK", "DKK"];

function currencyForCountry(c?: string | null): string {
  const cc = (c || "").toUpperCase();
  if (cc === "NO") return "NOK";
  if (cc === "GB" || cc === "UK") return "GBP";
  if (cc === "US") return "USD";
  if (cc === "SE") return "SEK";
  if (cc === "DK") return "DKK";
  const eea = ["AT","BE","BG","HR","CY","CZ","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","IS","LI"];
  if (eea.includes(cc)) return "EUR";
  return "USD"; // ikke-EØS default (f.eks. Bangladesh)
}

const STR = {
  no: {
    title: "Min priskatalog", subtitle: "Tjenestene du tilbyr — dette er det fotografen ser og hyrer fra.",
    add: "Legg til tjeneste", empty: "Ingen tjenester ennå. Legg til det du tilbyr, så blir du synlig for fotografer.",
    name: "Tjenestenavn", category: "Kategori", price: "Pris", currency: "Valuta", description: "Beskrivelse",
    active: "Aktiv", inactive: "Skjult", cancel: "Avbryt", save: "Lagre", saving: "Lagrer...",
    edit: "Rediger tjeneste", newSvc: "Ny tjeneste", show: "Vis", hide: "Skjul",
    deleted: "Tjeneste slettet", saved: "Lagret", err: "Noe gikk galt", nameReq: "Navn er påkrevd",
  },
  en: {
    title: "My price catalog", subtitle: "The services you offer — this is exactly what photographers see and hire from.",
    add: "Add service", empty: "No services yet. Add what you offer to become visible to photographers.",
    name: "Service name", category: "Category", price: "Price", currency: "Currency", description: "Description",
    active: "Active", inactive: "Hidden", cancel: "Cancel", save: "Save", saving: "Saving...",
    edit: "Edit service", newSvc: "New service", show: "Show", hide: "Hide",
    deleted: "Service deleted", saved: "Saved", err: "Something went wrong", nameReq: "Name is required",
  },
};

export default function EditingVendorCatalog({ locale = "no", country }: Props) {
  const qc = useQueryClient();
  const s = STR[locale === "en" ? "en" : "no"];
  const defaultCurrency = currencyForCountry(country);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [form, setForm] = useState<{ name: string; category: string; price: string; currency: string; description: string }>({
    name: "", category: "", price: "", currency: defaultCurrency, description: "",
  });
  const [snack, setSnack] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  const listQuery = useQuery<{ products: CatalogProduct[] }>({
    queryKey: ["/api/editing/vendor/products"],
    queryFn: () => apiRequest("/api/editing/vendor/products"),
  });
  const products = listQuery.data?.products ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/editing/vendor/products"] });
    qc.invalidateQueries({ queryKey: ["/api/editing/vendors"] }); // hold discovery i synk
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        category: form.category || "all",
        price: form.price === "" ? null : Number(form.price),
        currency: form.currency,
        description: form.description || null,
      };
      if (editing) {
        return apiRequest(`/api/editing/vendor/products/${editing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      return apiRequest("/api/editing/vendor/products", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    },
    onSuccess: () => { invalidate(); setDialogOpen(false); setSnack({ msg: s.saved, sev: "success" }); },
    onError: () => setSnack({ msg: s.err, sev: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number | string) => apiRequest(`/api/editing/vendor/products/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setSnack({ msg: s.deleted, sev: "success" }); },
    onError: () => setSnack({ msg: s.err, sev: "error" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number | string; status: string }) =>
      apiRequest(`/api/editing/vendor/products/${id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      }),
    onSuccess: () => invalidate(),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", category: "", price: "", currency: defaultCurrency, description: "" });
    setDialogOpen(true);
  };
  const openEdit = (p: CatalogProduct) => {
    setEditing(p);
    setForm({ name: p.name, category: p.category === "all" ? "" : p.category, price: p.price != null ? String(p.price) : "", currency: p.currency || defaultCurrency, description: p.description || "" });
    setDialogOpen(true);
  };
  const submit = () => {
    if (!form.name.trim()) { setSnack({ msg: s.nameReq, sev: "error" }); return; }
    saveMutation.mutate();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{s.title}</Typography>
          <Typography variant="body2" color="text.secondary">{s.subtitle}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>{s.add}</Button>
      </Box>

      {listQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={24} /></Box>
      ) : products.length === 0 ? (
        <Alert severity="info">{s.empty}</Alert>
      ) : (
        <Stack spacing={1.5}>
          {products.map((p) => (
            <Card key={p.id} variant="outlined" sx={{ opacity: p.status === "inactive" ? 0.6 : 1 }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                    {p.category && p.category !== "all" && <Chip size="small" label={p.category} />}
                    <Chip size="small" color={p.status === "inactive" ? "default" : "success"} label={p.status === "inactive" ? s.inactive : s.active} />
                  </Stack>
                  {p.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{p.description}</Typography>}
                </Box>
                <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  {p.price != null ? `${p.price} ${p.currency}` : "—"}
                </Typography>
                <IconButton size="small" title={p.status === "inactive" ? s.show : s.hide}
                  onClick={() => statusMutation.mutate({ id: p.id, status: p.status === "inactive" ? "active" : "inactive" })}>
                  {p.status === "inactive" ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
                <IconButton size="small" onClick={() => openEdit(p)} title={s.edit}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(p.id)}><DeleteIcon fontSize="small" /></IconButton>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? s.edit : s.newSvc}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={s.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth autoFocus />
            <TextField label={s.category} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} fullWidth />
            <Stack direction="row" spacing={2}>
              <TextField label={s.price} type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} sx={{ flex: 1 }} />
              <TextField select label={s.currency} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} sx={{ width: 120 }}>
                {CURRENCIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField label={s.description} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} multiline minRows={2} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{s.cancel}</Button>
          <Button variant="contained" onClick={submit} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? s.saving : s.save}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}>
        {snack ? <Alert severity={snack.sev} onClose={() => setSnack(null)}>{snack.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

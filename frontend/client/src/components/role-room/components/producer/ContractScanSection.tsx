/**
 * ContractScanSection.tsx — kontrakt-skann i The Role Room Agent.
 *
 * Lim inn teksten fra en SIGNERT avtale → agenten ekstraherer de
 * økonomiske vilkårene (parter, totalsum, betalingsplan, fakturamåte,
 * leveranser, bruksrett, frister) og viser hva som MANGLER for et
 * komplett økonomisk oppsett. Redelighet i UI: beløp som ikke kunne
 * verifiseres mot kontraktteksten vises som forkastet, aldri som fakta.
 * Siste skann per prosjekt huskes (30 dager) — gjenåpning koster ikke
 * nytt LLM-kall.
 */

import React, { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip,
  Stack, TextField, Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ReceiptLong as ContractIcon,
} from '@mui/icons-material';
import { roleRoomAgentDefaultHeaders } from '../../services/roleRoomAgentService';

interface PaymentTerm {
  label: string;
  amount: string | null;
  trigger: string | null;
}

interface ContractScan {
  economics: {
    supplier: string | null;
    client: string | null;
    totalAmount: string | null;
    currency: string | null;
    vatHandling: string | null;
    paymentTerms: PaymentTerm[];
    invoicing: string | null;
    deliverables: string[];
    usageRights: string | null;
    deadlines: string[];
    terminationTerms: string | null;
  };
  missingPoints: string[];
  rejectedValues: string[];
  scannedAt: string;
}

export function ContractScanSection({ projectId }: { projectId: string | null }) {
  const [contractText, setContractText] = useState('');
  const [scan, setScan] = useState<ContractScan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hent siste lagrede skann når seksjonen mountes.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void fetch(`/api/role-room/agent/contract-scan/${encodeURIComponent(projectId)}`, {
      credentials: 'include',
      headers: roleRoomAgentDefaultHeaders(),
    })
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.scan) setScan(body.scan as ContractScan);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // v2: PDF-opplasting → vision-transkripsjon fyller tekstfeltet.
  // Produsenten leser/retter teksten før selve skannet kjøres —
  // verbatim-vakten beholder dermed en kilde å verifisere mot.
  const [pdfBusy, setPdfBusy] = useState(false);
  const uploadPdf = async (file: File) => {
    if (!projectId) return;
    setPdfBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('projectId', projectId);
      const r = await fetch('/api/role-room/agent/contract-scan/extract-pdf', {
        method: 'POST',
        credentials: 'include',
        headers: roleRoomAgentDefaultHeaders(),
        body: form,
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        setError(body?.error === 'pdf_er_for_stor_maks_15mb'
          ? 'PDF-en er for stor (maks 15 MB).'
          : `PDF-lesing feilet (${body?.error ?? r.status}).`);
        return;
      }
      setContractText(String(body.text ?? ''));
    } catch (e) {
      setError(String(e));
    } finally {
      setPdfBusy(false);
    }
  };

  const runScan = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/role-room/agent/contract-scan', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ projectId, contractText }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) {
        setError(body?.error === 'kontraktteksten_er_for_kort_til_et_aerlig_skann'
          ? 'Kontraktteksten er for kort til et ærlig skann — lim inn hele avtalen.'
          : `Skannet feilet (${body?.error ?? r.status}).`);
        return;
      }
      setScan(body.scan as ContractScan);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const eco = scan?.economics;

  return (
    <Accordion disableGutters
      sx={{ bgcolor: 'rgba(15,23,42,0.46)', border: '1px solid rgba(251,191,36,0.22)', '&:before': { display: 'none' }, borderRadius: '12px !important' }}>
      <AccordionSummary expandIcon={<ExpandIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ContractIcon sx={{ color: '#fbbf24' }} />
          <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>
            Kontrakt-skann — økonomisk oppsett fra signert avtale
          </Typography>
          {scan && (
            <Chip size="small"
              label={scan.missingPoints.length === 0 ? 'Komplett' : `${scan.missingPoints.length} mangler`}
              sx={{
                bgcolor: scan.missingPoints.length === 0 ? 'rgba(16,185,129,0.16)' : 'rgba(251,191,36,0.16)',
                color: scan.missingPoints.length === 0 ? '#bbf7d0' : '#fde68a',
                fontWeight: 700, fontSize: '0.7rem',
              }} />
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.84rem', mb: 1 }}>
          Lim inn teksten fra den signerte avtalen. Beløp og datoer verifiseres
          maskinelt mot teksten — hull i det økonomiske oppsettet listes som
          avklaringspunkter, aldri gjetting.
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Button component="label" size="small" variant="outlined" disabled={pdfBusy}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {pdfBusy ? 'Leser PDF…' : 'Last opp signert PDF'}
            <input hidden type="file" accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void uploadPdf(f);
              }} />
          </Button>
          <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.76rem' }}>
            Bilde-baserte PDF-er (Adobe Sign o.l.) leses visuelt — les over
            transkripsjonen før skann.
          </Typography>
        </Stack>
        <TextField multiline minRows={4} maxRows={10} fullWidth size="small"
          placeholder="Lim inn kontraktteksten her — eller last opp PDF over …"
          value={contractText} onChange={(e) => setContractText(e.target.value)} sx={{ mb: 1 }} />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: scan ? 1.5 : 0 }}>
          <Button variant="contained" size="small" onClick={() => void runScan()}
            disabled={busy || contractText.trim().length < 200}>
            {busy ? 'Skanner…' : 'Skann kontrakten'}
          </Button>
          {scan && (
            <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.76rem' }}>
              Sist skannet {new Date(scan.scannedAt).toLocaleString('nb-NO')}
            </Typography>
          )}
        </Stack>

        {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

        {eco && (
          <Stack spacing={1}>
            <Box sx={{ border: '1px solid rgba(148,163,184,0.2)', borderRadius: 2, p: 1.2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.84rem', color: '#f8fafc', mb: 0.5 }}>
                Økonomiske vilkår funnet i kontrakten
              </Typography>
              {[
                ['Parter', [eco.supplier, eco.client].filter(Boolean).join(' ↔ ') || null],
                ['Totalsum', eco.totalAmount ? `${eco.totalAmount} ${eco.currency ?? ''} (${eco.vatHandling ?? 'MVA ikke angitt'})` : null],
                ['Fakturering', eco.invoicing],
                ['Bruksrettigheter', eco.usageRights],
                ['Terminering', eco.terminationTerms],
                ['Frister', eco.deadlines.length ? eco.deadlines.join(' · ') : null],
                ['Leveranser', eco.deliverables.length ? eco.deliverables.join(' · ') : null],
              ].map(([label, value]) => value ? (
                <Typography key={label as string} sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.8)' }}>
                  <strong>{label}:</strong> {value}
                </Typography>
              ) : null)}
              {eco.paymentTerms.length > 0 && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(226,232,240,0.85)' }}>Betalingsplan:</Typography>
                  {eco.paymentTerms.map((t, i) => (
                    <Typography key={i} sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.75)' }}>
                      • {t.label}{t.amount ? ` — ${t.amount}` : ''}{t.trigger ? ` (${t.trigger})` : ''}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>

            {scan!.missingPoints.length > 0 && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.25 }}>
                  Mangler for komplett økonomisk oppsett — avklar med klienten:
                </Typography>
                {scan!.missingPoints.map((m, i) => (
                  <Typography key={i} sx={{ fontSize: '0.78rem' }}>• {m}</Typography>
                ))}
              </Alert>
            )}
            {scan!.rejectedValues.length > 0 && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.25 }}>
                  Forkastet av verbatim-vakten (fantes ikke i kontraktteksten):
                </Typography>
                {scan!.rejectedValues.map((v, i) => (
                  <Typography key={i} sx={{ fontSize: '0.78rem' }}>• {v}</Typography>
                ))}
              </Alert>
            )}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

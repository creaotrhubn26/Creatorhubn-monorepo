// @ts-nocheck
/**
 * MileagePanel — Slice 9X.33
 *
 * Stine ser sin lagrede bil (skilt + drivstoff fra Vegvesen), eller får
 * registrere den her. Med ett klikk beregnes kjøregodtgjørelse fra hele
 * timeline'en (alle events med location) inkludert bom-estimat per drivstoff-
 * type. "Kopier til regnskap" gir formattert tekst hun limer rett inn i
 * Tripletex/Fiken/Conta.
 */

import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Snackbar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  DirectionsCar as CarIcon,
  ElectricCar as ElectricCarIcon,
  LocalGasStation as FuelIcon,
  Calculate as CalculateIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

interface Vehicle {
  id: string;
  licensePlate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  fuelType: string;
  isElectric: boolean;
  homeAddress: string | null;
  effectiveHomeAddress: string | null;
  homeAddressSource: 'vehicle' | 'profile' | 'none';
  vegvesenSource?: 'vegvesen' | 'fallback';
}

interface Leg {
  from: string;
  to: string;
  fromSeq: number;
  toSeq: number;
  distanceKm: number;
  distanceSource: string;
  tollStations: number;
  tollKr: number;
}

interface Destination {
  seq: number;
  address: string;
  eventId: string | null;
  eventTitle: string | null;
  scheduledAt: string | null;
}

interface MileageReport {
  id: string;
  vehiclePlate: string | null;
  destinations: Destination[];
  legs: Leg[];
  totalKm: number;
  totalTollKr: number;
  kmRate: number;
  totalMileageKr: number;
  totalPayoutKr: number;
  fuelType: string;
  generatedAt: string;
  exportedAt: string | null;
}

interface MileagePanelProps {
  weddingId: string;
  /** Valgfri — apiRequest henter automatisk fra localStorage. */
  userId?: string;
}

const fuelIcon = (fuel: string) =>
  fuel === 'electric' ? <ElectricCarIcon fontSize="small" /> : <FuelIcon fontSize="small" />;

const fuelLabel = (fuel: string): string => {
  const map: Record<string, string> = {
    electric: 'El-bil',
    petrol: 'Bensin',
    diesel: 'Diesel',
    hybrid: 'Hybrid',
    plugin_hybrid: 'Ladbar hybrid',
    hydrogen: 'Hydrogen',
    unknown: 'Ukjent drivstoff',
  };
  return map[fuel] || fuel;
};

const MileagePanel: React.FC<MileagePanelProps> = ({ weddingId }) => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const [report, setReport] = useState<MileageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [plateInput, setPlateInput] = useState('');
  const [editingPlate, setEditingPlate] = useState(false);
  const [startAddress, setStartAddress] = useState('');
  const [includeReturnTrip, setIncludeReturnTrip] = useState(true);
  const [legOverrides, setLegOverrides] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const loadVehicle = async () => {
    try {
      const j: any = await apiRequest('/api/photographer/vehicle');
      setVehicle(j.vehicle || null);
      setProfileAddress(j.profileBusinessAddress || j.effectiveHomeAddress || null);
      const eff = j.vehicle?.effectiveHomeAddress || j.effectiveHomeAddress;
      if (eff && !startAddress) setStartAddress(eff);
      if (!j.vehicle) setEditingPlate(true);
    } catch (e) {
      console.warn('Kunne ikke hente bil', e);
    }
  };

  const loadReport = async () => {
    try {
      const j: any = await apiRequest(`/api/wedding/${weddingId}/mileage/report`);
      setReport(j.report);
    } catch (e) {
      // 404 first time er normalt — rapport finnes ikke ennå
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadVehicle(), loadReport()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingId]);

  const handleSavePlate = async () => {
    const plate = plateInput.toUpperCase().replace(/\s+/g, '');
    if (!plate) return;
    setError(null);
    try {
      const j: any = await apiRequest('/api/photographer/vehicle', {
        method: 'PUT',
        body: { licensePlate: plate },
      });
      setVehicle(j.vehicle);
      setEditingPlate(false);
      setPlateInput('');
      setSnack(`Lagret ${j.vehicle.licensePlate} (${fuelLabel(j.vehicle.fuelType)})`);
    } catch (e: any) {
      setError(e.message || 'Lagring feilet');
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    setError(null);
    try {
      const overridesArr = Object.entries(legOverrides)
        .map(([key, km]) => {
          const [fromSeq, toSeq] = key.split('-').map(Number);
          return { fromSeq, toSeq, distanceKm: km };
        })
        .filter((o) => Number.isFinite(o.distanceKm) && o.distanceKm > 0);

      const j: any = await apiRequest(`/api/wedding/${weddingId}/mileage/calculate`, {
        method: 'POST',
        body: {
          startAddress: startAddress.trim() || undefined,
          includeReturnTrip,
          legOverrides: overridesArr,
        },
      });
      setReport(j.report);
      setSnack(`Beregnet ${j.report.totalKm} km, total ${j.report.totalPayoutKr.toFixed(2)} kr`);
    } catch (e: any) {
      setError(e.message || 'Beregning feilet');
    } finally {
      setCalculating(false);
    }
  };

  const handleOverrideLegKm = (fromSeq: number, toSeq: number, kmStr: string) => {
    const km = parseFloat(kmStr.replace(',', '.'));
    setLegOverrides((prev) => {
      const next = { ...prev };
      if (Number.isFinite(km) && km > 0) {
        next[`${fromSeq}-${toSeq}`] = km;
      } else {
        delete next[`${fromSeq}-${toSeq}`];
      }
      return next;
    });
  };

  const handleCopyToAccounting = async () => {
    try {
      const j: any = await apiRequest(`/api/wedding/${weddingId}/mileage/report-text`);
      await navigator.clipboard.writeText(j.text);
      await apiRequest(`/api/wedding/${weddingId}/mileage/mark-exported`, { method: 'POST' }).catch(() => undefined);
      setReport((prev) => (prev ? { ...prev, exportedAt: new Date().toISOString() } : prev));
      setSnack('Rapport kopiert. Lim inn i regnskap.');
    } catch (e: any) {
      setError(e.message || 'Kopiering feilet');
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <CarIcon color="primary" />
          <Typography variant="h6">Kjøregodtgjørelse</Typography>
        </Stack>

        {/* Bil */}
        <Box sx={{ mb: 2 }}>
          {vehicle && !editingPlate ? (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                icon={fuelIcon(vehicle.fuelType)}
                label={`${vehicle.licensePlate} — ${[vehicle.make, vehicle.model].filter(Boolean).join(' ') || fuelLabel(vehicle.fuelType)}`}
                color={vehicle.isElectric ? 'success' : 'default'}
                variant="filled"
              />
              <Chip size="small" label={fuelLabel(vehicle.fuelType)} />
              {vehicle.vegvesenSource === 'fallback' && (
                <Tooltip title="Vegvesen-oppslag ikke konfigurert — verifiser drivstoff manuelt">
                  <Chip size="small" label="Fallback-data" color="warning" />
                </Tooltip>
              )}
              <IconButton size="small" onClick={() => { setPlateInput(vehicle.licensePlate); setEditingPlate(true); }}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Stack>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                label="Skiltnummer"
                placeholder="AB12345"
                value={plateInput}
                onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                inputProps={{ maxLength: 8 }}
              />
              <Button variant="contained" onClick={handleSavePlate} disabled={!plateInput.trim()}>
                Hent fra Vegvesen
              </Button>
              {vehicle && (
                <Button onClick={() => { setEditingPlate(false); setPlateInput(''); }}>Avbryt</Button>
              )}
            </Stack>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Beregningsknapp */}
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Startadresse (hjem/studio)"
            placeholder="F.eks. Storgata 12, Oslo"
            value={startAddress}
            onChange={(e) => setStartAddress(e.target.value)}
            fullWidth
            helperText={
              profileAddress && startAddress === profileAddress
                ? 'Hentet fra BRREG basert på registrert organisasjonsnummer'
                : 'Brukes som startpunkt + returetappe'
            }
          />
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={calculating ? <CircularProgress size={18} color="inherit" /> : <CalculateIcon />}
              onClick={handleCalculate}
              disabled={calculating || !vehicle}
            >
              {calculating ? 'Beregner…' : 'Beregn fra timeline'}
            </Button>
            <Button
              size="small"
              variant={includeReturnTrip ? 'contained' : 'outlined'}
              color={includeReturnTrip ? 'success' : 'inherit'}
              onClick={() => setIncludeReturnTrip(!includeReturnTrip)}
            >
              {includeReturnTrip ? 'Retur inkludert' : 'Inkluder retur'}
            </Button>
          </Stack>
          {!vehicle && (
            <Alert severity="info">Registrer skiltet ditt først så vi finner riktig drivstoff og bom-sats.</Alert>
          )}
        </Stack>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        {/* Rapport */}
        {report && (
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Rapport</Typography>
              <Button
                size="small"
                startIcon={report.exportedAt ? <CheckIcon /> : <CopyIcon />}
                onClick={handleCopyToAccounting}
                color={report.exportedAt ? 'success' : 'primary'}
                variant={report.exportedAt ? 'outlined' : 'contained'}
              >
                {report.exportedAt ? 'Kopiert til regnskap' : 'Kopier til regnskap'}
              </Button>
            </Stack>

            <Stack spacing={0.5}>
              {report.destinations.map((d) => (
                <Typography key={`${d.seq}-${d.address}`} variant="body2" sx={{ pl: 1 }}>
                  <b>{d.seq}.</b> {d.address}
                  {d.eventTitle && <Box component="span" sx={{ color: 'text.secondary' }}> — {d.eventTitle}</Box>}
                </Typography>
              ))}
            </Stack>

            {/* Per-etappe-overstyring — Stine kan korrigere km hvis hun ser
                at det estimerte er feil (f.eks. ved omkjøring eller toll-vei) */}
            {report.legs.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Etapper (kan justeres)</Typography>
                <Stack spacing={1}>
                  {report.legs.map((leg) => {
                    const key = `${leg.fromSeq}-${leg.toSeq}`;
                    return (
                      <Stack key={key} direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }}>
                          {leg.from} → {leg.to}
                          {leg.distanceSource === 'manual' && (
                            <Chip size="small" label="Manuell" sx={{ ml: 1, height: 16 }} />
                          )}
                          {leg.distanceSource === 'estimate' && (
                            <Chip size="small" label="Estimat" sx={{ ml: 1, height: 16 }} />
                          )}
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          defaultValue={leg.distanceKm}
                          onBlur={(e) => handleOverrideLegKm(leg.fromSeq, leg.toSeq, e.target.value)}
                          inputProps={{ step: 0.5, min: 0, style: { width: 70 } }}
                          InputProps={{
                            endAdornment: <Box component="span" sx={{ fontSize: 12, ml: 0.5 }}>km</Box>,
                          }}
                        />
                      </Stack>
                    );
                  })}
                </Stack>
                {Object.keys(legOverrides).length > 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Endringer trer i kraft når du klikker "Beregn fra timeline" igjen.
                  </Alert>
                )}
              </Box>
            )}

            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Total km</Typography>
                <Typography variant="body2"><b>{report.totalKm.toFixed(1)} km</b></Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Sats × km ({report.kmRate.toFixed(2).replace('.', ',')} kr/km)</Typography>
                <Typography variant="body2">{report.totalMileageKr.toFixed(2).replace('.', ',')} kr</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2">Bompenger ({fuelLabel(report.fuelType)})</Typography>
                <Typography variant="body2">{report.totalTollKr.toFixed(2).replace('.', ',')} kr</Typography>
              </Stack>
              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2">Totalt utlegg</Typography>
                <Typography variant="subtitle2" color="primary">
                  {report.totalPayoutKr.toFixed(2).replace('.', ',')} kr
                </Typography>
              </Stack>
            </Box>
          </Box>
        )}

        <Snackbar
          open={Boolean(snack)}
          autoHideDuration={4000}
          onClose={() => setSnack(null)}
          message={snack}
        />
      </CardContent>
    </Card>
  );
};

export default MileagePanel;

/**
 * SimpleBudgetEstimator — bestemor-enkelt budsjett-overslag.
 *
 * Filosofi: systemet finner ALDRI på beløp. Produsenten setter prisene; antallene
 * (opptaksdager, lokasjoner) hentes automatisk fra manuset → produksjonsplanen.
 * Hver linje vises som «antall × din pris = sum» i klartekst, med en levende
 * totalsum. Ingen regnskaps-sjargong.
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, InputAdornment, Divider, Chip, Tooltip, Button,
} from '@mui/material';
import {
  CalendarMonth as DayIcon,
  Place as LocationIcon,
  AddCircleOutline as OtherIcon,
  AutoAwesome as AutoIcon,
} from '@mui/icons-material';

export interface BudgetRates {
  perShootDay?: number;
  perLocation?: number;
  otherFixed?: number;
}

interface SimpleBudgetEstimatorProps {
  /** Auto-hentet fra produksjonsplanen (manus → lokasjoner → dager). */
  shootDays: number;
  locations: number;
  rates: BudgetRates;
  readOnly?: boolean;
  /** Persister satsene på prosjektet (debounced av parent ved behov). */
  onRatesChange: (rates: BudgetRates) => void;
}

const kr = (value: number): string =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );

const accent = '#34d399';

// Standard bransje-satser (NOK) brukt som forslag der produsenten ikke har satt
// egen pris. Delt mellom kortet og budsjettpakke-beregningen (én kilde).
export const BUDGET_DEFAULTS = { perShootDay: 25000, perLocation: 5000 };

export interface BudgetEstimateLine {
  key: 'day' | 'location' | 'other';
  label: string;
  count: number;
  rate: number;
  subtotal: number;
  isDefault: boolean;
}
export interface BudgetEstimateResult { total: number; lines: BudgetEstimateLine[] }

/**
 * Ren beregning av det enkle budsjett-overslaget fra PERSISTERTE satser +
 * drivere (opptaksdager, lokasjoner). Bruker standard-satser der pris mangler.
 * Brukes både til å sende budsjettpakken til klient og (via kortet) live.
 */
export function computeSimpleBudgetEstimate(
  rates: BudgetRates | undefined,
  shootDays: number,
  locations: number,
): BudgetEstimateResult {
  const r = rates ?? {};
  const dayDefault = !(r.perShootDay && r.perShootDay > 0);
  const locDefault = !(r.perLocation && r.perLocation > 0);
  const dayRate = dayDefault ? BUDGET_DEFAULTS.perShootDay : (r.perShootDay as number);
  const locRate = locDefault ? BUDGET_DEFAULTS.perLocation : (r.perLocation as number);
  const other = r.otherFixed && r.otherFixed > 0 ? r.otherFixed : 0;
  const lines: BudgetEstimateLine[] = [
    { key: 'day', label: 'Opptaksdager', count: shootDays, rate: dayRate, subtotal: shootDays * dayRate, isDefault: dayDefault },
    { key: 'location', label: 'Lokasjoner', count: locations, rate: locRate, subtotal: locations * locRate, isDefault: locDefault },
    { key: 'other', label: 'Andre faste kostnader', count: 1, rate: other, subtotal: other, isDefault: false },
  ];
  return { total: lines.reduce((sum, l) => sum + l.subtotal, 0), lines };
}

export function SimpleBudgetEstimator({
  shootDays,
  locations,
  rates,
  readOnly = false,
  onRatesChange,
}: SimpleBudgetEstimatorProps) {
  // Lokal tekst-state så feltene føles responsive; persisteres på blur/endring.
  const [perDay, setPerDay] = useState<string>(rates.perShootDay ? String(rates.perShootDay) : '');
  const [perLocation, setPerLocation] = useState<string>(rates.perLocation ? String(rates.perLocation) : '');
  const [otherFixed, setOtherFixed] = useState<string>(rates.otherFixed ? String(rates.otherFixed) : '');

  // Synk fra props hvis prosjektet byttes/oppdateres utenfra.
  const lastRatesRef = useRef(rates);
  useEffect(() => {
    if (lastRatesRef.current === rates) return;
    lastRatesRef.current = rates;
    setPerDay(rates.perShootDay ? String(rates.perShootDay) : '');
    setPerLocation(rates.perLocation ? String(rates.perLocation) : '');
    setOtherFixed(rates.otherFixed ? String(rates.otherFixed) : '');
  }, [rates]);

  const num = (v: string): number => {
    const n = Math.round(Number(v.replace(/\s/g, '').replace(',', '.')));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  // Standard bransje-satser (delt kilde) brukt som forslag der produsenten ikke
  // har satt egen pris. Tydelig merket «standard» i UI — ikke en påstand om sannhet.
  const DEFAULTS = BUDGET_DEFAULTS;

  const dayEntered = num(perDay);
  const locationEntered = num(perLocation);
  const other = num(otherFixed);

  // Effektiv sats: produsentens egen pris hvis satt, ellers standard-sats.
  const dayRate = dayEntered || DEFAULTS.perShootDay;
  const locationRate = locationEntered || DEFAULTS.perLocation;
  const usingDefaultDay = dayEntered === 0;
  const usingDefaultLocation = locationEntered === 0;

  const dayTotal = shootDays * dayRate;
  const locationTotal = locations * locationRate;
  const total = dayTotal + locationTotal + other;

  const usingAnyDefault = (usingDefaultDay && shootDays > 0) || (usingDefaultLocation && locations > 0);

  const applyDefaults = () => {
    if (readOnly) return;
    const next: BudgetRates = {
      perShootDay: dayEntered || DEFAULTS.perShootDay,
      perLocation: locationEntered || DEFAULTS.perLocation,
      otherFixed: other || undefined,
    };
    setPerDay(String(next.perShootDay));
    setPerLocation(String(next.perLocation));
    onRatesChange(next);
  };

  const commit = (next: BudgetRates) => {
    if (readOnly) return;
    onRatesChange(next);
  };

  const rows = useMemo(
    () => [
      {
        key: 'day',
        icon: <DayIcon sx={{ color: accent }} />,
        label: 'Opptaksdager',
        countLabel: `${shootDays} ${shootDays === 1 ? 'dag' : 'dager'}`,
        helper: 'Hva koster én opptaksdag i snitt? (crew, utstyr, mat, leie …)',
        value: perDay,
        onChange: (v: string) => { setPerDay(v); },
        onCommit: () => commit({ perShootDay: num(perDay) || undefined, perLocation: locationEntered || undefined, otherFixed: other || undefined }),
        count: shootDays,
        rate: dayRate,
        subtotal: dayTotal,
        isDefault: usingDefaultDay,
      },
      {
        key: 'location',
        icon: <LocationIcon sx={{ color: accent }} />,
        label: 'Lokasjoner',
        countLabel: `${locations} ${locations === 1 ? 'sted' : 'steder'}`,
        helper: 'Engangskostnad per lokasjon (leie, tillatelser, rigging …)',
        value: perLocation,
        onChange: (v: string) => { setPerLocation(v); },
        onCommit: () => commit({ perShootDay: dayEntered || undefined, perLocation: num(perLocation) || undefined, otherFixed: other || undefined }),
        count: locations,
        rate: locationRate,
        subtotal: locationTotal,
        isDefault: usingDefaultLocation,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shootDays, locations, perDay, perLocation, otherFixed, dayRate, locationRate, other],
  );

  return (
    <Card sx={{ bgcolor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Enkelt budsjett-overslag</Typography>
          <Tooltip title="Antallene hentes automatisk fra manuset og produksjonsplanen din. Du setter bare prisene — så regner vi ut resten.">
            <Chip size="small" icon={<AutoIcon sx={{ fontSize: 15 }} />} label="Auto fra planen" sx={{ bgcolor: 'rgba(52,211,153,0.15)', color: '#a7f3d0' }} />
          </Tooltip>
        </Box>
        <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.75)', mb: 2 }}>
          Du setter prisene. Antall opptaksdager og lokasjoner kommer rett fra planen din — vi gjør regnestykket.
        </Typography>

        {rows.map((row) => (
          <Box
            key={row.key}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr auto' },
              gap: 1.5,
              alignItems: 'center',
              py: 1.25,
              borderTop: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              {row.icon}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: '#fff', fontWeight: 600 }}>{row.label}</Typography>
                <Chip size="small" label={row.countLabel} sx={{ height: 20, fontSize: 12, bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(226,232,240,0.85)' }} />
              </Box>
            </Box>
            <TextField
              size="small"
              fullWidth
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={row.value}
              disabled={readOnly}
              onChange={(e) => row.onChange(e.target.value.replace(/[^\d\s.,]/g, ''))}
              onBlur={row.onCommit}
              helperText={row.helper}
              InputProps={{ endAdornment: <InputAdornment position="end">kr</InputAdornment> }}
              sx={{ '& .MuiFormHelperText-root': { fontSize: 11, color: 'rgba(226,232,240,0.6)' } }}
            />
            <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, minWidth: 110 }}>
              <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.55)', display: 'block' }}>
                {row.count} × {kr(row.rate)}{row.isDefault && row.count > 0 ? ' · standard-sats' : ''}
              </Typography>
              <Typography sx={{ fontWeight: 700, color: row.subtotal > 0 ? (row.isDefault ? 'rgba(167,243,208,0.7)' : accent) : 'rgba(226,232,240,0.4)' }}>
                {kr(row.subtotal)}
              </Typography>
            </Box>
          </Box>
        ))}

        {/* Andre faste kostnader (engangs) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr auto' },
            gap: 1.5,
            alignItems: 'center',
            py: 1.25,
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <OtherIcon sx={{ color: accent }} />
            <Typography sx={{ color: '#fff', fontWeight: 600 }}>Andre faste kostnader</Typography>
          </Box>
          <TextField
            size="small"
            fullWidth
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={otherFixed}
            disabled={readOnly}
            onChange={(e) => setOtherFixed(e.target.value.replace(/[^\d\s.,]/g, ''))}
            onBlur={() => commit({ perShootDay: dayEntered || undefined, perLocation: locationEntered || undefined, otherFixed: num(otherFixed) || undefined })}
            helperText="Engangskostnader: etterarbeid, rekvisita, forsikring …"
            InputProps={{ endAdornment: <InputAdornment position="end">kr</InputAdornment> }}
            sx={{ '& .MuiFormHelperText-root': { fontSize: 11, color: 'rgba(226,232,240,0.6)' } }}
          />
          <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, minWidth: 110 }}>
            <Typography sx={{ fontWeight: 700, color: other > 0 ? accent : 'rgba(226,232,240,0.4)' }}>{kr(other)}</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 1.5, borderColor: 'rgba(52,211,153,0.3)' }} />

        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>Estimert totalt</Typography>
          <Typography variant="h4" sx={{ color: accent, fontWeight: 800, lineHeight: 1 }}>{kr(total)}</Typography>
        </Box>

        {usingAnyDefault && !readOnly && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'rgba(167,243,208,0.85)', fontStyle: 'italic' }}>
              Bruker standard-satser der du ikke har satt egen pris. Bytt dem ut med dine egne tall når du vil.
            </Typography>
            <Button size="small" variant="outlined" onClick={applyDefaults} sx={{ color: '#a7f3d0', borderColor: 'rgba(52,211,153,0.4)' }}>
              Bruk standard-satser
            </Button>
          </Box>
        )}
        {shootDays === 0 && (
          <Typography variant="caption" sx={{ color: 'rgba(251,191,36,0.9)', mt: 1.5, display: 'block' }}>
            Tips: Generer produksjonsdager fra lokasjonene dine (under Kalender → Produksjonsdager), så regner overslaget seg ut fra planen.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default SimpleBudgetEstimator;

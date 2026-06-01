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
  Box, Card, CardContent, Typography, TextField, InputAdornment, Divider, Chip, Tooltip,
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

  const dayRate = num(perDay);
  const locationRate = num(perLocation);
  const other = num(otherFixed);

  const dayTotal = shootDays * dayRate;
  const locationTotal = locations * locationRate;
  const total = dayTotal + locationTotal + other;

  const hasAnyPrice = dayRate > 0 || locationRate > 0 || other > 0;

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
        onCommit: () => commit({ perShootDay: num(perDay) || undefined, perLocation: locationRate || undefined, otherFixed: other || undefined }),
        count: shootDays,
        rate: dayRate,
        subtotal: dayTotal,
      },
      {
        key: 'location',
        icon: <LocationIcon sx={{ color: accent }} />,
        label: 'Lokasjoner',
        countLabel: `${locations} ${locations === 1 ? 'sted' : 'steder'}`,
        helper: 'Engangskostnad per lokasjon (leie, tillatelser, rigging …)',
        value: perLocation,
        onChange: (v: string) => { setPerLocation(v); },
        onCommit: () => commit({ perShootDay: dayRate || undefined, perLocation: num(perLocation) || undefined, otherFixed: other || undefined }),
        count: locations,
        rate: locationRate,
        subtotal: locationTotal,
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
                {row.count} × {kr(row.rate)}
              </Typography>
              <Typography sx={{ fontWeight: 700, color: row.subtotal > 0 ? accent : 'rgba(226,232,240,0.4)' }}>
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
            onBlur={() => commit({ perShootDay: dayRate || undefined, perLocation: locationRate || undefined, otherFixed: num(otherFixed) || undefined })}
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

        {!hasAnyPrice && (
          <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.6)', mt: 1.5, fontStyle: 'italic' }}>
            👆 Skriv inn prisene dine over, så fyller vi ut overslaget med én gang.
          </Typography>
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

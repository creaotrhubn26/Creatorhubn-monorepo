/**
 * ComboField.tsx — dropdown med forhåndsvalg + fri tekst (freeSolo).
 * Brukes for Rolle + Instrument i profil-skjemaene: velg fra lista, eller skriv
 * inn din egen hvis den ikke står der.
 */
import React from 'react';
import { Autocomplete, TextField, Chip } from '@mui/material';

const ACCENT = '#FF6B35', BORDER = 'rgba(255,255,255,0.08)', TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', PANEL = '#131316';

export const ROLE_OPTIONS = [
  'Vokalist', 'Produsent', 'Gitarist', 'Bassist', 'Trommeslager', 'Tangenter/Keys',
  'Låtskriver', 'Tekstforfatter', 'Komponist', 'Arrangør', 'Mixe-ingeniør',
  'Mastering-ingeniør', 'Korister', 'Manager', 'Bidragsyter',
];

export const INSTRUMENT_OPTIONS = [
  'Vokal', 'Gitar', 'El-gitar', 'Akustisk gitar', 'Bass', 'Trommer', 'Perkusjon',
  'Piano', 'Keys/Synth', 'Fiolin', 'Cello', 'Saksofon', 'Trompet', 'Fløyte',
];

// «Hvem gjør hva» — flere bidrag per person.
export const CONTRIBUTION_OPTIONS = [
  'Idé/konsept', 'Låtskriving', 'Tekst', 'Produksjon', 'Mixing', 'Mastering',
  'Vokal', 'Kor', 'Gitar', 'Bass', 'Trommer', 'Tangenter/Keys', 'Synth',
  'Arrangement', 'Beat/programmering', 'Innspilling',
];

const fieldSx = {
  '& .MuiInputBase-input': { color: TEXT }, '& .MuiInputLabel-root': { color: MUTED },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
};

interface Props {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

export function MultiComboField({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Autocomplete
      multiple freeSolo fullWidth size="small" options={options}
      value={Array.isArray(value) ? value : []}
      onChange={(_, v) => onChange(v as string[])}
      slotProps={{ paper: { sx: { bgcolor: PANEL, color: TEXT, border: `1px solid ${BORDER}`, '& .MuiAutocomplete-option:hover, & .MuiAutocomplete-option.Mui-focused': { bgcolor: 'rgba(255,107,53,0.14)' } } } }}
      renderTags={(val, getTagProps) => val.map((opt, i) => { const { key, ...rest } = getTagProps({ index: i }) as any; return <Chip key={key} {...rest} label={opt} size="small" sx={{ bgcolor: 'rgba(255,107,53,0.16)', color: ACCENT, fontWeight: 600 }} />; })}
      sx={{ '& .MuiSvgIcon-root': { color: MUTED } }}
      renderInput={(params) => <TextField {...params} label={label} sx={fieldSx} />}
    />
  );
}

export default function ComboField({ label, options, value, onChange }: Props) {
  return (
    <Autocomplete
      freeSolo fullWidth size="small" options={options}
      inputValue={value || ''}
      onInputChange={(_, v) => onChange(v)}
      clearOnBlur={false} selectOnFocus handleHomeEndKeys
      slotProps={{ paper: { sx: { bgcolor: PANEL, color: TEXT, border: `1px solid ${BORDER}`, '& .MuiAutocomplete-option:hover, & .MuiAutocomplete-option.Mui-focused': { bgcolor: 'rgba(255,107,53,0.14)' } } } }}
      sx={{ '& .MuiSvgIcon-root': { color: MUTED } }}
      renderInput={(params) => <TextField {...params} label={label} sx={fieldSx} />}
    />
  );
}

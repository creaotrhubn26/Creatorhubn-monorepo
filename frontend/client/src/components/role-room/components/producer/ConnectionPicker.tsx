// Shared connected-account picker for the producer lead-gen panels (Leads,
// Omtaler, Oppdag, Arrangement). Replaces the raw <select> each panel used —
// one accessible MUI control so the look + a11y is identical everywhere.
// Renders nothing when there's 0–1 connection (no choice to make).
import React from 'react';
import { FormControl, Select, MenuItem } from '@mui/material';

export interface PickerConnection {
  id: string;
  igUsername: string | null;
  facebookPageName: string | null;
}

export default function ConnectionPicker({
  connections,
  value,
  onChange,
  label = 'Velg konto',
}: {
  connections: PickerConnection[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  if (connections.length <= 1) return null;
  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ 'aria-label': label }}
        sx={{
          color: '#e2e8f0',
          bgcolor: '#0f1729',
          fontSize: '0.85rem',
          '.MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
          '.MuiSvgIcon-root': { color: 'rgba(226,232,240,0.7)' },
        }}
      >
        {connections.map((c) => (
          <MenuItem key={c.id} value={c.id}>{c.facebookPageName || `@${c.igUsername}`}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

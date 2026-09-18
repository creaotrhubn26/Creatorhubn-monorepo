/**
 * MemberPicker — «Ansvarlig»-velger med avatar + navn fra members-lite.
 *
 * Aldri blokkerende: feiler oppslaget vises «Deg selv» som eneste valg med
 * et stille hint. Cache per prosjekt (60 s) så seks felt på et scenekort
 * ikke gir seks kall.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Avatar, Box, TextField, Typography } from '@mui/material';
import { listMembersLite } from '../narrativeService';
import type { NarrativeMemberLite } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';
import { authSessionService } from '../../services/authSessionService';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; members: NarrativeMemberLite[] | null; promise: Promise<NarrativeMemberLite[]> | null }>();

export async function loadMembersLite(projectId: string, force = false): Promise<NarrativeMemberLite[]> {
  const hit = cache.get(projectId);
  if (!force && hit?.members && Date.now() - hit.at < CACHE_TTL_MS) return hit.members;
  if (!force && hit?.promise) return hit.promise;
  const promise = listMembersLite(projectId)
    .then((members) => { cache.set(projectId, { at: Date.now(), members, promise: null }); return members; })
    .catch((err) => { cache.delete(projectId); throw err; });
  cache.set(projectId, { at: Date.now(), members: hit?.members ?? null, promise });
  return promise;
}

export function useMembersLite(projectId: string | null): { members: NarrativeMemberLite[]; loading: boolean; failed: boolean } {
  const [state, setState] = useState<{ members: NarrativeMemberLite[]; loading: boolean; failed: boolean }>({ members: [], loading: !!projectId, failed: false });
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void loadMembersLite(projectId)
      .then((members) => { if (!cancelled) setState({ members, loading: false, failed: false }); })
      .catch(() => {
        if (cancelled) return;
        const s = authSessionService.getSessionSync();
        const selfId = s.currentUserId ?? (s.adminUser?.id != null ? String(s.adminUser.id) : null);
        const selfName = s.adminUser?.name ?? s.adminUser?.email ?? 'Deg selv';
        setState({ members: selfId ? [{ userId: selfId, displayName: selfName, profileImageUrl: null, isOwner: false }] : [], loading: false, failed: true });
      });
    return () => { cancelled = true; };
  }, [projectId]);
  return state;
}

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MemberAvatar({ member, size = 22 }: { member: Pick<NarrativeMemberLite, 'displayName' | 'profileImageUrl'> | null; size?: number }) {
  if (!member) return <Avatar sx={{ width: size, height: size, fontSize: size * 0.42, bgcolor: 'rgba(255,255,255,0.08)', color: narrativeColors.textDim }}>–</Avatar>;
  return (
    <Avatar src={member.profileImageUrl ?? undefined} alt={member.displayName} sx={{ width: size, height: size, fontSize: size * 0.42, bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent, fontWeight: 700 }}>
      {memberInitials(member.displayName)}
    </Avatar>
  );
}

export interface MemberPickerProps {
  projectId: string;
  value: string | null;
  onChange: (userId: string | null) => void;
  label?: string;
  size?: 'small' | 'medium';
  testId?: string;
  disabled?: boolean;
}

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)' },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
  '& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator': { color: narrativeColors.textDim },
};

export function MemberPicker({ projectId, value, onChange, label = 'Ansvarlig', size = 'small', testId, disabled }: MemberPickerProps) {
  const { members, loading, failed } = useMembersLite(projectId);
  const options = useMemo(() => {
    // Verdien kan peke på et medlem som ikke lenger er aktivt — vis den likevel så feltet ikke «mister» valget.
    if (value && !members.some((m) => m.userId === value)) return [...members, { userId: value, displayName: value, profileImageUrl: null, isOwner: false }];
    return members;
  }, [members, value]);
  const selected = options.find((m) => m.userId === value) ?? null;
  return (
    <Autocomplete
      size={size}
      options={options}
      value={selected}
      loading={loading}
      disabled={disabled}
      onChange={(_e, next) => onChange(next?.userId ?? null)}
      getOptionLabel={(m) => m.displayName}
      isOptionEqualToValue={(a, b) => a.userId === b.userId}
      noOptionsText="Ingen medlemmer"
      loadingText="Henter medlemmer…"
      renderOption={(props, m) => (
        <Box component="li" {...props} key={m.userId} sx={{ display: 'flex', gap: 1, alignItems: 'center' }} data-testid={testId ? `${testId}-option-${m.userId}` : undefined}>
          <MemberAvatar member={m} />
          <Typography sx={{ fontSize: 13 }}>{m.displayName}</Typography>
          {m.isOwner ? <Typography sx={{ fontSize: 10, color: narrativeColors.textDim }}>eier</Typography> : null}
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="Ingen"
          helperText={failed ? 'Kunne ikke hente medlemslista — viser deg selv.' : undefined}
          sx={fieldSx}
          inputProps={{ ...params.inputProps, 'data-testid': testId }}
          InputProps={{
            ...params.InputProps,
            startAdornment: selected ? <Box sx={{ mr: 0.5, display: 'flex' }}><MemberAvatar member={selected} size={20} /></Box> : params.InputProps.startAdornment,
          }}
        />
      )}
    />
  );
}

/**
 * SpotifyArtistField — Spotify-artist-søk med autoutfylling av profil-lenke.
 * Skriv et artistnavn → velg fra treff (bilde/følgere/sjanger) → feltet fylles
 * med artistens Spotify-URL, og onPick gir kallstedet bilde/sjanger/følgere.
 * Lim man inn en ferdig open.spotify.com-lenke, søkes det ikke.
 */
import React from 'react';
import {
  Box, TextField, Stack, Typography, Avatar, Popper, Paper, ClickAwayListener,
  CircularProgress, InputAdornment, MenuList, MenuItem,
} from '@mui/material';
import { Search, MusicNote, CheckCircle } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

const ACCENT = '#FF6B35';
const SPOT = '#1DB954';

export type SpotifyArtist = { id: string; name: string; url: string | null; image: string | null; genres: string[]; followers: number | null };
const isSpotifyUrl = (v: string) => /open\.spotify\.com|spotify:/i.test(v || '');
const fmtFollowers = (n?: number | null) => (n == null ? '' : n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

const SpotifyArtistField: React.FC<{
  value: string;
  onChange: (url: string) => void;
  onPick?: (a: SpotifyArtist) => void;
  label?: string;
  fieldSx?: any;
}> = ({ value, onChange, onPick, label = 'Spotify', fieldSx }) => {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SpotifyArtist[]>([]);
  const [unconfigured, setUnconfigured] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = React.useCallback((term: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!term.trim() || isSpotifyUrl(term)) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await apiRequest(`/api/spotify/search-artist?q=${encodeURIComponent(term.trim())}`);
        setResults(d?.artists || []); setUnconfigured(false); setOpen(true);
      } catch (e: any) {
        if (typeof e?.message === 'string' && e.message.includes('503')) setUnconfigured(true);
        setResults([]); setOpen(true);
      } finally { setLoading(false); }
    }, 350);
  }, []);

  const handle = (text: string) => { onChange(text); runSearch(text); };
  const pick = (a: SpotifyArtist) => { onChange(a.url || ''); onPick?.(a); setOpen(false); setResults([]); };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box ref={anchorRef} sx={{ width: '100%' }}>
        <TextField
          label={label} value={value} onChange={(e) => handle(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          size="small" fullWidth sx={fieldSx} placeholder="skriv artistnavn eller lim inn lenke"
          InputProps={{
            startAdornment: <InputAdornment position="start">{loading ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <Search sx={{ fontSize: 16, color: 'rgba(245,242,234,0.4)' }} />}</InputAdornment>,
            endAdornment: isSpotifyUrl(value) ? <CheckCircle sx={{ fontSize: 16, color: SPOT }} /> : undefined,
          }}
        />
        <Popper open={open} anchorEl={anchorRef.current} placement="bottom-start" style={{ zIndex: 2000, width: anchorRef.current?.offsetWidth }}>
          <Paper sx={{ mt: 0.5, bgcolor: '#1a1a1e', color: '#F5F2EA', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', overflow: 'hidden' }}>
            {unconfigured ? (
              <Typography sx={{ p: 1.5, fontSize: '0.76rem', color: 'rgba(245,242,234,0.55)' }}>Spotify er ikke konfigurert ennå.</Typography>
            ) : results.length === 0 ? (
              <Typography sx={{ p: 1.5, fontSize: '0.76rem', color: 'rgba(245,242,234,0.55)' }}>{loading ? 'Søker…' : 'Ingen treff.'}</Typography>
            ) : (
              <MenuList dense sx={{ py: 0.5, maxHeight: 280, overflowY: 'auto' }}>
                {results.map((a) => (
                  <MenuItem key={a.id} onMouseDown={(e) => { e.preventDefault(); pick(a); }} sx={{ py: 0.75, '&:hover': { bgcolor: 'rgba(29,185,84,0.12)' } }}>
                    <Avatar src={a.image || undefined} sx={{ width: 32, height: 32, mr: 1.25, bgcolor: 'rgba(255,255,255,0.08)' }}>{a.image ? null : <MusicNote sx={{ fontSize: 16 }} />}</Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }} noWrap>{a.name}</Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: 'rgba(245,242,234,0.5)' }} noWrap>
                        {fmtFollowers(a.followers)} følgere{a.genres?.length ? ` · ${a.genres.slice(0, 2).join(', ')}` : ''}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </MenuList>
            )}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default SpotifyArtistField;

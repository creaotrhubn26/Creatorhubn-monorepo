/**
 * RoleRoomMemberDirectoryDialog — søkbar katalog over Role Room-medlemmer.
 *
 * Brukere kan finne hverandre via navn, bedrift, sted, bio eller filtrere
 * på profesjon. Klikk på et medlem åpner full profil-visning i samme dialog.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogContent,
  IconButton, InputAdornment, Link, Stack, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import {
  ArrowBack, Close, Email, Language, LinkedIn, Instagram,
  LocationOn, OpenInNew, Person, Search,
} from '@mui/icons-material';
import { roleRoomMemberProfileService } from '../services/roleRoomMemberProfileService';
import type {
  MemberListItem, RoleRoomMemberProfile,
} from '../services/roleRoomMemberProfileService';

export interface RoleRoomMemberDirectoryDialogProps {
  open: boolean;
  onClose: () => void;
  /** Default-filter på profesjon (f.eks. om man kommer fra "Finn Editor"). */
  initialProfession?: string;
  /** Default-søk. */
  initialQuery?: string;
}

export function RoleRoomMemberDirectoryDialog({
  open, onClose, initialProfession, initialQuery,
}: RoleRoomMemberDirectoryDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [q, setQ] = useState(initialQuery ?? '');
  const [profession, setProfession] = useState(initialProfession ?? '');
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Søk med debounce
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true); setError(null);
        try {
          const res = await roleRoomMemberProfileService.listMembers({
            q: q.trim() || undefined,
            profession: profession || undefined,
            limit: 50,
          });
          setMembers(res.members);
        } catch (err) {
          setError(String(err));
        } finally {
          setLoading(false);
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [q, profession, open]);

  // Unike profesjoner fra current resultatsett — for chips-filter
  const professionsSeen = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => m.professions.forEach((p) => set.add(p)));
    return Array.from(set).slice(0, 10);
  }, [members]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3, maxHeight: '85vh', overflow: 'hidden' } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: fullScreen ? '100vh' : '85vh' }}>
        {/* Header */}
        <Box sx={{
          p: 2, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1,
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}>
          {selectedUserId && (
            <IconButton onClick={() => setSelectedUserId(null)} size="small">
              <ArrowBack />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
            {selectedUserId ? 'Profil' : 'Finn medlemmer'}
          </Typography>
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Box>

        {selectedUserId ? (
          <PublicProfileView userId={selectedUserId} />
        ) : (
          <>
            {/* Søkefelt */}
            <Box sx={{ p: 2, pt: 1.5 }}>
              <TextField
                fullWidth size="small" autoFocus
                placeholder="Søk navn, bedrift, sted, bio …"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              {(professionsSeen.length > 0 || profession) && (
                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1.5 }}>
                  {profession && (
                    <Chip
                      label={profession}
                      onDelete={() => setProfession('')}
                      color="primary"
                      size="small"
                    />
                  )}
                  {!profession && professionsSeen.map((p) => (
                    <Chip
                      key={p} label={p} size="small" clickable variant="outlined"
                      onClick={() => setProfession(p)}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* Liste */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {!loading && members.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                  <Person sx={{ fontSize: 48, opacity: 0.3 }} />
                  <Typography sx={{ mt: 1 }}>
                    {q || profession ? 'Ingen treff' : 'Ingen team-medlemmer ennå'}
                  </Typography>
                  {!q && !profession && (
                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                      Du ser kun medlemmer som er lagt til prosjekter du er med i.
                    </Typography>
                  )}
                </Box>
              )}
              {!loading && members.length > 0 && (
                <Stack spacing={1}>
                  {members.map((m) => (
                    <MemberCard
                      key={m.userId}
                      member={m}
                      onClick={() => setSelectedUserId(m.userId)}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </>
        )}
      </Box>
    </Dialog>
  );
}

function MemberCard({ member, onClick }: { member: MemberListItem; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 1.5,
        border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2, cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': { borderColor: 'rgba(139,92,246,0.4)', bgcolor: 'rgba(139,92,246,0.04)' },
      }}
    >
      <Avatar
        src={member.profileImageUrl ?? undefined}
        sx={{ width: 48, height: 48, bgcolor: '#6366f1', flexShrink: 0 }}
      >
        {member.displayName?.[0] ?? <Person />}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
          {member.displayName ?? '(uten navn)'}
          {member.companyName && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
              · {member.companyName}
            </Typography>
          )}
        </Typography>
        {member.professions.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {member.professions.slice(0, 3).join(' · ')}
          </Typography>
        )}
        {(member.locationCity || member.locationCountry) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, mt: 0.25 }}>
            <LocationOn sx={{ fontSize: 12 }} />
            {[member.locationCity, member.locationCountry].filter(Boolean).join(', ')}
          </Typography>
        )}
        {member.bio && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {member.bio}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function PublicProfileView({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<RoleRoomMemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true); setError(null);
      try {
        const p = await roleRoomMemberProfileService.getPublicProfile(userId);
        if (!cancelled) setProfile(p);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !profile) {
    return <Alert severity="error" sx={{ m: 3 }}>{error ?? 'Profil ikke funnet'}</Alert>;
  }

  const socials = profile.socialLinks ?? {};
  const hasAnyLink = profile.website || profile.showreelUrl
    || socials.instagram || socials.linkedin;

  return (
    <DialogContent sx={{ p: 0, overflow: 'auto', flex: 1 }}>
      {/* Banner + avatar */}
      <Box sx={{
        height: 100,
        background: profile.bannerImageUrl
          ? `url(${profile.bannerImageUrl}) center/cover`
          : 'linear-gradient(135deg, #1e1a2e 0%, #2d1b4e 50%, #4c1d95 100%)',
      }} />
      <Box sx={{ px: 3, pt: 0, pb: 3 }}>
        <Avatar
          src={profile.profileImageUrl ?? undefined}
          sx={{
            width: 100, height: 100, mt: -6, mb: 1.5,
            bgcolor: '#6366f1', fontSize: 32,
            border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {profile.displayName?.[0] ?? <Person sx={{ fontSize: 48 }} />}
        </Avatar>

        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {profile.displayName ?? '(uten navn)'}
        </Typography>
        {profile.companyName && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {profile.companyName}
          </Typography>
        )}
        {(profile.locationCity || profile.locationCountry) && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary', mb: 1.5 }}>
            <LocationOn sx={{ fontSize: 16 }} />
            <Typography variant="body2">
              {[profile.locationCity, profile.locationCountry].filter(Boolean).join(', ')}
            </Typography>
          </Stack>
        )}

        {profile.professions.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 2 }}>
            {profile.professions.map((p) => (
              <Chip key={p} label={p} color="primary" size="small"
                    sx={{ fontWeight: 600 }} />
            ))}
          </Stack>
        )}

        {profile.bio && (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb: 3 }}>
            {profile.bio}
          </Typography>
        )}

        {profile.skills.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary">Ferdigheter</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
              {profile.skills.map((s) => (
                <Chip key={s} label={s} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>
        )}

        {profile.languages.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary">Språk</Typography>
            <Typography variant="body2">{profile.languages.join(' · ')}</Typography>
          </Box>
        )}

        {hasAnyLink && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="overline" color="text.secondary">Lenker</Typography>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {profile.website && (
                <LinkRow icon={<Language fontSize="small" />} href={profile.website} label={profile.website} />
              )}
              {profile.showreelUrl && (
                <LinkRow icon={<OpenInNew fontSize="small" />} href={profile.showreelUrl} label="Showreel" />
              )}
              {socials.instagram && (
                <LinkRow icon={<Instagram fontSize="small" />} href={`https://instagram.com/${socials.instagram.replace(/^@/, '')}`} label={socials.instagram} />
              )}
              {socials.linkedin && (
                <LinkRow icon={<LinkedIn fontSize="small" />} href={socials.linkedin} label="LinkedIn" />
              )}
            </Stack>
          </Box>
        )}

        <Button
          fullWidth variant="outlined" startIcon={<Email />}
          href={profile.userId ? `mailto:` : undefined}
          disabled
          sx={{ mt: 1, opacity: 0.5 }}
        >
          Send melding (kommer)
        </Button>
      </Box>
    </DialogContent>
  );
}

function LinkRow({ icon, href, label }: { icon: React.ReactNode; href: string; label: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {icon}
      <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover" variant="body2">
        {label}
      </Link>
    </Stack>
  );
}

export default RoleRoomMemberDirectoryDialog;

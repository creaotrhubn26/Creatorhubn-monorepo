/**
 * LeadMapOrgPanel.tsx
 *
 * Organisasjons- og team-administrasjon for Lead Map:
 *   - Org-velger (Creatorhub AS som default developer-org)
 *   - Org-profil (navn/beskrivelse/website/kontakt/branding)
 *   - Salgs-team (Teamleder + Salgskonsulenter + Promotører)
 *   - Medlemmer + bruker-profiler (tittel/territorium/kvote/kommisjon)
 *   - Invitasjoner via Resend (org-nivå med rolle + team-tildeling)
 *
 * WCAG: alle interaktive elementer har aria-label, modaler bruker
 * autoFocus, status-badges får aria-live, prefers-reduced-motion
 * respektert via Stack/Box (ingen egne animasjoner).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid,
  IconButton, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import {
  Accordion, AccordionDetails, AccordionSummary, Badge, FormControlLabel,
  Switch as MuiSwitch,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import LeadMapMyProfileCard from './LeadMapMyProfileCard';
import LeadMapPromoteDialog from './LeadMapPromoteDialog';

const ROLE_META: Record<string, {
  label: string;
  color: string;
  Icon: typeof BusinessOutlinedIcon;
  description: string;
}> = {
  admin: {
    label: 'Administrator',
    color: '#c084fc',
    Icon: BusinessOutlinedIcon,
    description: 'Full kontroll over organisasjon og prosjekter.',
  },
  salgssjef: {
    label: 'Salgssjef',
    color: '#f97316',
    Icon: EmojiEventsOutlinedIcon,
    description: 'Leder hele salgsorganisasjonen. Oppretter team.',
  },
  teamleder: {
    label: 'Teamleder',
    color: '#fbbf24',
    Icon: SupervisorAccountOutlinedIcon,
    description: 'Leder et salgs-team og tildeler salgskonsulenter.',
  },
  salgskonsulent: {
    label: 'Salgskonsulent',
    color: '#34d399',
    Icon: BadgeOutlinedIcon,
    description: 'Selger leads. Tilhører ett team.',
  },
  promotor: {
    label: 'Promotør',
    color: '#60a5fa',
    Icon: CampaignOutlinedIcon,
    description: 'Promoterer på event eller feltarbeid.',
  },
  member: {
    label: 'Medlem',
    color: '#a78bfa',
    Icon: BadgeOutlinedIcon,
    description: 'Standard skrive-tilgang.',
  },
  viewer: {
    label: 'Leser',
    color: '#9ca3af',
    Icon: VisibilityOutlinedIcon,
    description: 'Kun lese-tilgang.',
  },
};

interface OrganizationSummary {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  orgType: string;
  logoUrl: string | null;
  role: string;
  memberCount: number;
  projectCount: number;
}

interface OrgProfile {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  org_type: string;
  description: string | null;
  website: string | null;
  industry: string | null;
  org_number: string | null;
  phone: string | null;
  contact_email: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  brand_color: string | null;
}

interface SalesTeam {
  id: string;
  name: string;
  description: string | null;
  territory: string | null;
  team_lead_user_id: string | null;
  team_lead_name: string | null;
  team_lead_email: string | null;
  member_count: number;
}

interface PermissionDef {
  key: string;
  category: string;
  description: string;
}

interface MemberPermissionState {
  role: string;
  effective: string[];
  overrides: Array<{ permission_key: string; effect: string; reason: string | null }>;
}

interface MemberProfileRow {
  user_id: string;
  role: string;
  sales_team_id: string | null;
  user_email: string | null;
  user_name: string | null;
  display_name: string | null;
  title: string | null;
  avatar_url: string | null;
  phone: string | null;
  profile_contact_email: string | null;
  linkedin_url: string | null;
  territory: string | null;
  quota_monthly_nok: string | null;
  commission_pct: string | null;
  is_active: boolean | null;
  team_name: string | null;
  last_active_at: string | null;
  is_online: boolean | null;
}

/**
 * Hver profil må ha: profilbilde, e-post, telefon, stillingstittel.
 * LinkedIn er valgfritt.
 */
const REQUIRED_PROFILE_FIELDS: Array<keyof MemberProfileRow> = [
  'avatar_url', 'profile_contact_email', 'phone', 'title',
];

function profileCompleteness(m: MemberProfileRow): number {
  const filled = REQUIRED_PROFILE_FIELDS.filter(
    (k) => (m[k] ?? '').toString().trim().length > 0,
  ).length;
  return Math.round((filled / REQUIRED_PROFILE_FIELDS.length) * 100);
}

/** Krymp bilde-fil til 256×256 data-URL — holder payload < 100KB */
async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Filen er ikke et bilde');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Bildet er for stort (maks 5 MB)');
  }
  const bitmap = await createImageBitmap(file);
  const target = 256;
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kunne ikke initialisere bildet');
  // Senter-crop til kvadrat
  const minSide = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - minSide) / 2;
  const sy = (bitmap.height - minSide) / 2;
  ctx.drawImage(bitmap, sx, sy, minSide, minSide, 0, 0, target, target);
  return canvas.toDataURL('image/jpeg', 0.85);
}

interface Props {
  /** Bearer-token for autentisering (samme som LeadMapPanel) */
  authToken: string;
  /** Når org velges propageres org-id til parent slik at prosjekt-listen kan scopes */
  onOrgChange?: (orgId: string) => void;
}

export default function LeadMapOrgPanel({ authToken, onOrgChange }: Props) {
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }),
    [authToken],
  );

  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(
    typeof window !== 'undefined'
      ? localStorage.getItem('rr_lead_map_active_org') ?? null
      : null,
  );
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [profileEditable, setProfileEditable] = useState(false);
  const [isOrgOwner, setIsOrgOwner] = useState(false);
  const [teams, setTeams] = useState<SalesTeam[]>([]);
  const [members, setMembers] = useState<MemberProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Dialogs
  const [editingProfile, setEditingProfile] = useState<OrgProfile | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '', role: 'salgskonsulent', sales_team_id: '',
  });
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Partial<SalesTeam> & { id?: string } | null>(null);
  const [editingMember, setEditingMember] = useState<MemberProfileRow | null>(null);
  const [promotingMember, setPromotingMember] = useState<MemberProfileRow | null>(null);

  // Location-deling
  const [locationConsent, setLocationConsent] = useState<boolean | null>(null);
  const [lastKnownPosition, setLastKnownPosition] = useState<
    { lat: number; lng: number; accuracy: number } | null
  >(null);

  // Permissions
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionDef[]>([]);
  const [permDialog, setPermDialog] = useState<{
    userId: string;
    userLabel: string;
    state: MemberPermissionState | null;
  } | null>(null);
  const [savingPerm, setSavingPerm] = useState<string | null>(null);

  // ─── Last org-liste ──────────────────────────────────────────────
  const loadOrgs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/admin-room/lead-map/organizations', { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setOrgs(data.organizations ?? []);
      if (!activeOrgId && data.organizations?.length) {
        setActiveOrgId(data.organizations[0].id);
      }
    } catch (err) {
      setError(`Klarte ikke laste organisasjoner: ${String(err)}`);
    } finally { setLoading(false); }
  }, [headers, activeOrgId]);

  useEffect(() => { void loadOrgs(); }, [loadOrgs]);

  useEffect(() => {
    if (activeOrgId) {
      try { localStorage.setItem('rr_lead_map_active_org', activeOrgId); } catch { /* noop */ }
      onOrgChange?.(activeOrgId);
    }
  }, [activeOrgId, onOrgChange]);

  // ─── Last detaljer for aktiv org ─────────────────────────────────
  const loadOrgDetails = useCallback(async (orgId: string) => {
    try {
      const [pRes, tRes, mRes] = await Promise.all([
        fetch(`/api/admin-room/lead-map/organizations/${orgId}/profile`, { headers }),
        fetch(`/api/admin-room/lead-map/organizations/${orgId}/teams`, { headers }),
        fetch(`/api/admin-room/lead-map/organizations/${orgId}/profiles`, { headers }),
      ]);
      if (pRes.ok) {
        const j = await pRes.json();
        setProfile(j.profile);
        setProfileEditable(Boolean(j.canEdit));
        setIsOrgOwner(Boolean(j.isOwner));
      }
      if (tRes.ok) {
        const j = await tRes.json();
        setTeams(j.teams ?? []);
      }
      if (mRes.ok) {
        const j = await mRes.json();
        setMembers(j.profiles ?? []);
      }
    } catch (err) {
      setError(`Klarte ikke laste org-detaljer: ${String(err)}`);
    }
  }, [headers]);

  useEffect(() => {
    if (activeOrgId) void loadOrgDetails(activeOrgId);
  }, [activeOrgId, loadOrgDetails]);

  // ─── Hent consent-status ────────────────────────────────────────
  useEffect(() => {
    if (!activeOrgId) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/admin-room/lead-map/organizations/${activeOrgId}/location/consent`,
          { headers },
        );
        if (r.ok) {
          const j = await r.json();
          setLocationConsent(Boolean(j.consented));
        }
      } catch { /* noop */ }
    })();
  }, [activeOrgId, headers]);

  // ─── Heartbeat (marker meg som online hvert 60s) + valgfri posisjon
  useEffect(() => {
    if (!activeOrgId) return;
    const sendBeat = async () => {
      try {
        const body: Record<string, unknown> = { organization_id: activeOrgId };
        if (locationConsent && lastKnownPosition) {
          body.lat = lastKnownPosition.lat;
          body.lng = lastKnownPosition.lng;
          body.accuracy_m = lastKnownPosition.accuracy;
          body.activity = 'idle';
        }
        await fetch('/api/admin-room/lead-map/heartbeat', {
          method: 'POST', headers,
          body: JSON.stringify(body),
        });
      } catch { /* offline ignored */ }
    };
    void sendBeat();
    const beatTimer = setInterval(sendBeat, 60 * 1000);
    const refreshTimer = setInterval(() => {
      void loadOrgDetails(activeOrgId);
    }, 30 * 1000);
    return () => {
      clearInterval(beatTimer);
      clearInterval(refreshTimer);
    };
  }, [activeOrgId, headers, loadOrgDetails, locationConsent, lastKnownPosition]);

  // ─── Watch geolocation når consent er aktivt ────────────────────
  useEffect(() => {
    if (!locationConsent || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLastKnownPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => { /* fail silently — bruker har skrudd av i nettleseren */ },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationConsent]);

  const toggleLocationConsent = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      if (locationConsent) {
        await fetch(
          `/api/admin-room/lead-map/organizations/${activeOrgId}/location/consent`,
          { method: 'DELETE', headers },
        );
        setLocationConsent(false);
        setLastKnownPosition(null);
        setStatus('Posisjonsdeling skrudd AV');
      } else {
        // Be om browser-permission først
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              (err) => reject(new Error(err.message)),
              { enableHighAccuracy: false, timeout: 10000 },
            );
          });
        }
        await fetch(
          `/api/admin-room/lead-map/organizations/${activeOrgId}/location/consent`,
          { method: 'POST', headers },
        );
        setLocationConsent(true);
        setStatus('Posisjonsdeling skrudd PÅ — du vises som pin på kartet');
      }
    } catch (err) {
      setError(`Posisjonsdeling feilet: ${String(err)}`);
    }
  }, [activeOrgId, headers, locationConsent]);

  function formatLastSeen(iso: string | null): string {
    if (!iso) return 'Aldri pålogget';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'akkurat nå';
    if (mins < 60) return `${mins} min siden`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} t siden`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} d siden`;
    return new Date(iso).toLocaleDateString('nb-NO');
  }

  // ─── Org-profil-redigering ───────────────────────────────────────
  const saveProfile = useCallback(async () => {
    if (!activeOrgId || !editingProfile) return;
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/profile`,
        { method: 'PATCH', headers, body: JSON.stringify(editingProfile) },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus('Profilen er oppdatert');
      setEditingProfile(null);
      await loadOrgDetails(activeOrgId);
    } catch (err) {
      setError(`Lagring feilet: ${String(err)}`);
    }
  }, [activeOrgId, editingProfile, headers, loadOrgDetails]);

  // ─── Invitasjon ─────────────────────────────────────────────────
  const sendInvite = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/invitations`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: inviteForm.email,
            role: inviteForm.role,
            sales_team_id: inviteForm.sales_team_id || undefined,
          }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setStatus(
        j.emailSent
          ? `Invitasjon sendt til ${inviteForm.email}`
          : `Invitasjon opprettet (e-post: ${j.emailReason ?? 'ikke sendt'})`,
      );
      setInviteOpen(false);
      setInviteForm({ email: '', role: 'salgskonsulent', sales_team_id: '' });
    } catch (err) {
      setError(`Invitasjon feilet: ${String(err)}`);
    }
  }, [activeOrgId, inviteForm, headers]);

  // ─── Team-CRUD ──────────────────────────────────────────────────
  const saveTeam = useCallback(async () => {
    if (!activeOrgId || !editingTeam) return;
    try {
      const method = editingTeam.id ? 'PATCH' : 'POST';
      const url = editingTeam.id
        ? `/api/admin-room/lead-map/organizations/${activeOrgId}/teams/${editingTeam.id}`
        : `/api/admin-room/lead-map/organizations/${activeOrgId}/teams`;
      const r = await fetch(url, {
        method, headers,
        body: JSON.stringify({
          name: editingTeam.name,
          description: editingTeam.description,
          territory: editingTeam.territory,
          team_lead_user_id: editingTeam.team_lead_user_id,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(editingTeam.id ? 'Team oppdatert' : 'Team opprettet');
      setTeamDialogOpen(false);
      setEditingTeam(null);
      await loadOrgDetails(activeOrgId);
    } catch (err) {
      setError(`Team-lagring feilet: ${String(err)}`);
    }
  }, [activeOrgId, editingTeam, headers, loadOrgDetails]);

  const deleteTeam = useCallback(async (teamId: string) => {
    if (!activeOrgId) return;
    if (!confirm('Slette dette teamet? Medlemmer beholdes men mister team-tilhørighet.')) return;
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/teams/${teamId}`,
        { method: 'DELETE', headers },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus('Team slettet');
      await loadOrgDetails(activeOrgId);
    } catch (err) {
      setError(`Sletting feilet: ${String(err)}`);
    }
  }, [activeOrgId, headers, loadOrgDetails]);

  // ─── Medlem-profil ──────────────────────────────────────────────
  const saveMemberProfile = useCallback(async () => {
    if (!activeOrgId || !editingMember) return;
    const missing = REQUIRED_PROFILE_FIELDS.filter(
      (k) => !(editingMember[k] ?? '').toString().trim(),
    );
    if (missing.length > 0) {
      setError(`Profil mangler påkrevde felt: ${missing.join(', ')}`);
      return;
    }
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/members/${editingMember.user_id}/profile`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            display_name: editingMember.display_name,
            title: editingMember.title,
            avatar_url: editingMember.avatar_url,
            phone: editingMember.phone,
            contact_email: editingMember.profile_contact_email,
            linkedin_url: editingMember.linkedin_url,
            territory: editingMember.territory,
            quota_monthly_nok: editingMember.quota_monthly_nok
              ? Number(editingMember.quota_monthly_nok) : null,
            commission_pct: editingMember.commission_pct
              ? Number(editingMember.commission_pct) : null,
          }),
        },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus('Bruker-profil oppdatert');
      setEditingMember(null);
      await loadOrgDetails(activeOrgId);
    } catch (err) {
      setError(`Profil-lagring feilet: ${String(err)}`);
    }
  }, [activeOrgId, editingMember, headers, loadOrgDetails]);

  const onAvatarFile = useCallback(async (file: File) => {
    if (!editingMember) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setEditingMember({ ...editingMember, avatar_url: dataUrl });
    } catch (err) {
      setError(String(err));
    }
  }, [editingMember]);

  /** Last opp org-logo (same krymp-til-256-flow som avatar) */
  const onOrgLogoFile = useCallback(async (file: File) => {
    if (!editingProfile) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setEditingProfile({ ...editingProfile, logo_url: dataUrl });
    } catch (err) {
      setError(String(err));
    }
  }, [editingProfile]);

  const updateMemberRole = useCallback(async (userId: string, role: string) => {
    if (!activeOrgId) return;
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/members/${userId}`,
        { method: 'PATCH', headers, body: JSON.stringify({ role }) },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(`Rolle endret til ${ROLE_META[role]?.label ?? role}`);
      await loadOrgDetails(activeOrgId);
    } catch (err) {
      setError(`Rolle-endring feilet: ${String(err)}`);
    }
  }, [activeOrgId, headers, loadOrgDetails]);

  const assignTeam = useCallback(async (userId: string, teamId: string) => {
    if (!activeOrgId) return;
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/teams/${teamId}/members`,
        { method: 'POST', headers, body: JSON.stringify({ userId }) },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus('Tildelt team');
      await loadOrgDetails(activeOrgId);
    } catch (err) {
      setError(`Team-tildeling feilet: ${String(err)}`);
    }
  }, [activeOrgId, headers, loadOrgDetails]);

  // ─── Permissions ────────────────────────────────────────────────
  const loadPermissionsCatalog = useCallback(async () => {
    try {
      const r = await fetch('/api/admin-room/lead-map/permissions/catalog', { headers });
      if (r.ok) {
        const j = await r.json();
        setPermissionsCatalog(j.permissions ?? []);
      }
    } catch { /* noop */ }
  }, [headers]);

  useEffect(() => { void loadPermissionsCatalog(); }, [loadPermissionsCatalog]);

  const openPermissions = useCallback(async (m: MemberProfileRow) => {
    if (!activeOrgId) return;
    const label = m.display_name ?? m.user_name ?? m.user_email ?? m.user_id;
    setPermDialog({ userId: m.user_id, userLabel: label, state: null });
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/permissions/${m.user_id}`,
        { headers },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setPermDialog({ userId: m.user_id, userLabel: label, state: j });
    } catch (err) {
      setError(`Klarte ikke laste tillatelser: ${String(err)}`);
    }
  }, [activeOrgId, headers]);

  const togglePermission = useCallback(async (key: string, currentlyOn: boolean) => {
    if (!activeOrgId || !permDialog) return;
    setSavingPerm(key);
    try {
      const effect = currentlyOn ? 'revoke' : 'grant';
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/permissions/${permDialog.userId}/${effect}`,
        {
          method: 'POST', headers,
          body: JSON.stringify({ permission_key: key }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      // Reload state
      const re = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/permissions/${permDialog.userId}`,
        { headers },
      );
      if (re.ok) {
        const js = await re.json();
        setPermDialog({ ...permDialog, state: js });
      }
    } catch (err) {
      setError(`Endring feilet: ${String(err)}`);
    } finally { setSavingPerm(null); }
  }, [activeOrgId, headers, permDialog]);

  const resetPermissions = useCallback(async () => {
    if (!activeOrgId || !permDialog) return;
    if (!confirm('Tilbakestille alle tillatelses-overstyringer for denne brukeren?')) return;
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/permissions/${permDialog.userId}/reset`,
        { method: 'POST', headers },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus('Tilbakestilt til rolle-default');
      const re = await fetch(
        `/api/admin-room/lead-map/organizations/${activeOrgId}/permissions/${permDialog.userId}`,
        { headers },
      );
      if (re.ok) {
        const js = await re.json();
        setPermDialog({ ...permDialog, state: js });
      }
    } catch (err) {
      setError(`Tilbakestilling feilet: ${String(err)}`);
    }
  }, [activeOrgId, headers, permDialog]);

  // Gruppér permissions etter kategori
  const permissionsByCategory = useMemo(() => {
    const groups: Record<string, PermissionDef[]> = {};
    for (const p of permissionsCatalog) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return groups;
  }, [permissionsCatalog]);

  const activeOrgSummary = orgs.find((o) => o.id === activeOrgId);
  const isAdmin = activeOrgSummary?.role === 'admin';
  const canManageSales = activeOrgSummary?.role === 'admin' || activeOrgSummary?.role === 'salgssjef';

  return (
    <Box sx={{ p: 3 }}>
      {/* ─── Status-region (aria-live) ──────────────────────────── */}
      <Box role="status" aria-live="polite" sx={{ position: 'absolute', left: -10000 }}>
        {status}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {status && (
        <Alert severity="success" onClose={() => setStatus(null)} sx={{ mb: 2 }}>
          {status}
        </Alert>
      )}

      {/* ─── Min profil + Mine tilganger (for ALLE roller) ─────── */}
      <LeadMapMyProfileCard />

      {/* ─── Org-velger + posisjonsdeling ───────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={2}>
            <Stack direction="row" alignItems="center" spacing={2} flexGrow={1}>
              <BusinessOutlinedIcon sx={{ color: 'primary.main', fontSize: 32 }} />
              <Box flexGrow={1}>
                <Typography variant="h6" component="h2">
                  Organisasjon
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Velg organisasjon for å se medlemmer, team og prosjekter.
                </Typography>
              </Box>
            </Stack>
            <Select
              size="small"
              value={activeOrgId ?? ''}
              onChange={(e) => setActiveOrgId(e.target.value || null)}
              sx={{ minWidth: 280 }}
              inputProps={{ 'aria-label': 'Velg organisasjon' }}
            >
              {orgs.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography>{o.name}</Typography>
                    {o.orgType === 'developer' && (
                      <Chip label="Utvikler" size="small" color="primary" />
                    )}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </Stack>

          {/* Posisjons-deling-toggle */}
          {activeOrgId && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(192,132,252,0.05)', borderRadius: 1 }}>
              <FormControlLabel
                control={
                  <MuiSwitch
                    checked={Boolean(locationConsent)}
                    onChange={toggleLocationConsent}
                    inputProps={{ 'aria-label': 'Del min posisjon på kartet' }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      Del min posisjon på Lead Map-kartet
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {locationConsent
                        ? lastKnownPosition
                          ? `Pin: ${lastKnownPosition.lat.toFixed(4)}, ${lastKnownPosition.lng.toFixed(4)} (±${Math.round(lastKnownPosition.accuracy)} m)`
                          : 'Venter på GPS-fix...'
                        : 'Andre i org-en ser hvor du er — kun valgfritt'}
                    </Typography>
                  </Box>
                }
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {loading && <CircularProgress />}

      {profile && (
        <Grid container spacing={3}>
          {/* ─── Org-profil-kort ──────────────────────────────── */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" component="h3">Org-profil</Typography>
                  {profileEditable && !editingProfile && (
                    <Button
                      startIcon={<EditOutlinedIcon />}
                      size="small"
                      onClick={() => setEditingProfile({ ...profile })}
                    >
                      Rediger
                    </Button>
                  )}
                </Stack>

                {editingProfile ? (
                  <Stack spacing={2}>
                    {/* ─── Org-logo (kun org-eier kan endre) ─── */}
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Org-logo
                        {!isOrgOwner && (
                          <Chip label="Låst — kun eier" size="small" sx={{ ml: 1 }} />
                        )}
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                        <Avatar src={editingProfile.logo_url ?? undefined}
                          variant="rounded"
                          sx={{ width: 72, height: 72, bgcolor: '#1f1f2a' }}>
                          <BusinessOutlinedIcon />
                        </Avatar>
                        {isOrgOwner ? (
                          <Stack spacing={1}>
                            <Button component="label" variant="outlined" size="small">
                              Last opp logo
                              <input type="file" accept="image/*" hidden
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void onOrgLogoFile(f);
                                }}
                              />
                            </Button>
                            {editingProfile.logo_url && (
                              <Button size="small" color="error"
                                onClick={() => setEditingProfile({ ...editingProfile, logo_url: null })}>
                                Fjern
                              </Button>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Logoen kan kun endres av org-eier.
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                    <TextField label="Navn" value={editingProfile.name ?? ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })} fullWidth />
                    <TextField label="Beskrivelse" value={editingProfile.description ?? ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, description: e.target.value })}
                      multiline rows={3} fullWidth />
                    <TextField label="Nettside" value={editingProfile.website ?? ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, website: e.target.value })} fullWidth />
                    <TextField label="Bransje" value={editingProfile.industry ?? ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, industry: e.target.value })} fullWidth />
                    <TextField label="Org.nr (BRREG)"
                      value={editingProfile.org_number ?? ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, org_number: e.target.value })}
                      disabled={!isOrgOwner}
                      helperText={!isOrgOwner ? 'Kun org-eier kan endre dette' : ' '}
                      InputProps={{
                        endAdornment: !isOrgOwner ? (
                          <Chip label="Låst" size="small" />
                        ) : undefined,
                      }}
                      fullWidth />
                    <TextField label="Kontakt-epost" value={editingProfile.contact_email ?? ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, contact_email: e.target.value })} fullWidth />
                    <TextField label="Telefon" value={editingProfile.phone ?? ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, phone: e.target.value })} fullWidth />
                    <TextField label="Adresse" value={editingProfile.address_line ?? ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, address_line: e.target.value })} fullWidth />
                    <Stack direction="row" spacing={1}>
                      <TextField label="Postnr" value={editingProfile.postal_code ?? ''}
                        onChange={(e) => setEditingProfile({ ...editingProfile, postal_code: e.target.value })} />
                      <TextField label="By" value={editingProfile.city ?? ''}
                        onChange={(e) => setEditingProfile({ ...editingProfile, city: e.target.value })} fullWidth />
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button startIcon={<SaveOutlinedIcon />} variant="contained" onClick={saveProfile}>Lagre</Button>
                      <Button onClick={() => setEditingProfile(null)}>Avbryt</Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar src={profile.logo_url ?? undefined} variant="rounded"
                        sx={{ width: 64, height: 64, bgcolor: '#1f1f2a' }}>
                        <BusinessOutlinedIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6">{profile.name}</Typography>
                        {profile.org_number && (
                          <Typography variant="caption" color="text.secondary">
                            Org.nr <strong>{profile.org_number}</strong>
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                    {profile.description && (
                      <Box>
                        <Typography variant="overline" color="text.secondary">Beskrivelse</Typography>
                        <Typography variant="body2">{profile.description}</Typography>
                      </Box>
                    )}
                    {profile.website && (
                      <Box>
                        <Typography variant="overline" color="text.secondary">Nettside</Typography>
                        <Typography variant="body2">{profile.website}</Typography>
                      </Box>
                    )}
                    {profile.contact_email && (
                      <Box>
                        <Typography variant="overline" color="text.secondary">Kontakt</Typography>
                        <Typography variant="body2">{profile.contact_email}</Typography>
                      </Box>
                    )}
                    {profile.city && (
                      <Box>
                        <Typography variant="overline" color="text.secondary">Sted</Typography>
                        <Typography variant="body2">
                          {[profile.address_line, profile.postal_code, profile.city, profile.country]
                            .filter(Boolean).join(', ')}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* ─── Salgs-team-kort ──────────────────────────────── */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" component="h3">
                    <GroupsOutlinedIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    Salgs-team
                  </Typography>
                  {canManageSales && (
                    <Button
                      startIcon={<AddCircleOutlineIcon />}
                      size="small"
                      onClick={() => { setEditingTeam({}); setTeamDialogOpen(true); }}
                    >
                      Nytt team
                    </Button>
                  )}
                </Stack>

                {teams.length === 0 ? (
                  <Typography color="text.secondary">Ingen team enda.</Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {teams.map((t) => (
                      <Card key={t.id} variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="subtitle1">{t.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t.territory ?? '—'} · Teamleder: {t.team_lead_name ?? '(ingen)'} · {t.member_count} medlemmer
                            </Typography>
                          </Box>
                          {canManageSales && (
                            <Stack direction="row" spacing={0.5}>
                              <IconButton size="small" aria-label="Rediger team"
                                onClick={() => { setEditingTeam(t); setTeamDialogOpen(true); }}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" aria-label="Slett team" onClick={() => deleteTeam(t.id)}>
                                <DeleteOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          )}
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* ─── Medlemmer-tabell ─────────────────────────────── */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6" component="h3">Medlemmer ({members.length})</Typography>
                  {isAdmin && (
                    <Button
                      startIcon={<PersonAddAlt1OutlinedIcon />}
                      variant="contained"
                      onClick={() => setInviteOpen(true)}
                    >
                      Invitér bruker
                    </Button>
                  )}
                </Stack>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Person</TableCell>
                      <TableCell>Tittel</TableCell>
                      <TableCell>Rolle</TableCell>
                      <TableCell>Team</TableCell>
                      <TableCell>Territorium</TableCell>
                      <TableCell>Profil</TableCell>
                      <TableCell align="right">Handling</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {members.map((m) => {
                      const meta = ROLE_META[m.role] ?? ROLE_META.member;
                      const RoleIcon = meta.Icon;
                      return (
                        <TableRow key={m.user_id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Tooltip title={m.is_online ? 'Pålogget nå' : `Sist sett: ${formatLastSeen(m.last_active_at)}`}>
                                <Badge
                                  overlap="circular"
                                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                  variant="dot"
                                  sx={{
                                    '& .MuiBadge-badge': {
                                      bgcolor: m.is_online ? '#34d399' : '#6b7280',
                                      boxShadow: '0 0 0 2px #1a1a1f',
                                      width: 10, height: 10, borderRadius: '50%',
                                    },
                                  }}
                                >
                                  <Avatar src={m.avatar_url ?? undefined} sx={{ width: 32, height: 32 }}>
                                    {(m.display_name ?? m.user_name ?? m.user_email ?? '?')[0]}
                                  </Avatar>
                                </Badge>
                              </Tooltip>
                              <Box>
                                <Stack direction="row" alignItems="center" spacing={0.75}>
                                  <Typography variant="body2">
                                    {m.display_name ?? m.user_name ?? m.user_email}
                                  </Typography>
                                  {m.is_online && (
                                    <Chip label="Online" size="small"
                                      aria-label="Pålogget"
                                      sx={{ height: 16, fontSize: '0.65rem', bgcolor: '#34d39922', color: '#34d399' }} />
                                  )}
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  {m.user_email}
                                  {!m.is_online && m.last_active_at && (
                                    <> · sist sett {formatLastSeen(m.last_active_at)}</>
                                  )}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>{m.title ?? '—'}</TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <Select
                                size="small" value={m.role}
                                onChange={(e) => updateMemberRole(m.user_id, e.target.value)}
                                inputProps={{ 'aria-label': `Rolle for ${m.user_email}` }}
                                sx={{ minWidth: 160 }}
                              >
                                {Object.entries(ROLE_META).map(([k, v]) => (
                                  <MenuItem key={k} value={k}>
                                    <Tooltip title={v.description} placement="right">
                                      <Stack direction="row" alignItems="center" spacing={1}>
                                        <v.Icon fontSize="small" sx={{ color: v.color }} />
                                        <Typography variant="body2">{v.label}</Typography>
                                      </Stack>
                                    </Tooltip>
                                  </MenuItem>
                                ))}
                              </Select>
                            ) : (
                              <Chip icon={<RoleIcon />} label={meta.label}
                                size="small" sx={{ bgcolor: `${meta.color}22`, color: meta.color }} />
                            )}
                          </TableCell>
                          <TableCell>
                            {(m.role === 'salgskonsulent' || m.role === 'promotor' || m.role === 'teamleder') && canManageSales ? (
                              <Select
                                size="small" value={m.sales_team_id ?? ''}
                                onChange={(e) => assignTeam(m.user_id, e.target.value)}
                                displayEmpty
                                inputProps={{ 'aria-label': `Team for ${m.user_email}` }}
                                sx={{ minWidth: 140 }}
                              >
                                <MenuItem value="">(uten team)</MenuItem>
                                {teams.map((t) => (
                                  <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                                ))}
                              </Select>
                            ) : (
                              m.team_name ?? '—'
                            )}
                          </TableCell>
                          <TableCell>{m.territory ?? '—'}</TableCell>
                          <TableCell>
                            {(() => {
                              const pct = profileCompleteness(m);
                              const color = pct === 100 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
                              return (
                                <Tooltip title={pct === 100 ? 'Komplett' : 'Mangler påkrevde felt'}>
                                  <Chip size="small" label={`${pct}%`}
                                    sx={{ bgcolor: `${color}22`, color }} />
                                </Tooltip>
                              );
                            })()}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              {isAdmin && (
                                <Tooltip title="Forfremmelse / endre rolle">
                                  <IconButton size="small" aria-label="Forfremmelse"
                                    onClick={() => setPromotingMember(m)}>
                                    <ArrowUpwardOutlinedIcon fontSize="small"
                                      sx={{ color: '#34d399' }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {isAdmin && (
                                <Tooltip title="Tillatelser">
                                  <IconButton size="small" aria-label="Endre tillatelser"
                                    onClick={() => openPermissions(m)}>
                                    <SecurityOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Rediger profil">
                                <IconButton size="small" aria-label="Rediger profil"
                                  onClick={() => setEditingMember(m)}>
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ─── Invite-dialog ──────────────────────────────────────── */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Invitér bruker til {activeOrgSummary?.name ?? 'organisasjonen'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="E-postadresse" type="email" required autoFocus
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              fullWidth />
            <TextField select label="Rolle" value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} fullWidth>
              {Object.entries(ROLE_META).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  <Stack>
                    <Typography variant="body2">{v.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{v.description}</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </TextField>
            {['salgskonsulent', 'promotor', 'teamleder'].includes(inviteForm.role) && teams.length > 0 && (
              <TextField select label="Tildel team (valgfritt)"
                value={inviteForm.sales_team_id}
                onChange={(e) => setInviteForm({ ...inviteForm, sales_team_id: e.target.value })} fullWidth>
                <MenuItem value="">(uten team)</MenuItem>
                {teams.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={sendInvite} disabled={!inviteForm.email}>
            Send invitasjon
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Team-dialog ────────────────────────────────────────── */}
      <Dialog open={teamDialogOpen} onClose={() => setTeamDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingTeam?.id ? 'Rediger team' : 'Nytt team'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Team-navn" required autoFocus
              value={editingTeam?.name ?? ''}
              onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })} fullWidth />
            <TextField label="Beskrivelse" multiline rows={2}
              value={editingTeam?.description ?? ''}
              onChange={(e) => setEditingTeam({ ...editingTeam, description: e.target.value })} fullWidth />
            <TextField label="Territorium" placeholder="f.eks. Oslo + Akershus"
              value={editingTeam?.territory ?? ''}
              onChange={(e) => setEditingTeam({ ...editingTeam, territory: e.target.value })} fullWidth />
            <TextField select label="Teamleder"
              value={editingTeam?.team_lead_user_id ?? ''}
              onChange={(e) => setEditingTeam({ ...editingTeam, team_lead_user_id: e.target.value })} fullWidth>
              <MenuItem value="">(ingen)</MenuItem>
              {members.map((m) => (
                <MenuItem key={m.user_id} value={m.user_id}>
                  {m.display_name ?? m.user_name ?? m.user_email}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeamDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={saveTeam} disabled={!editingTeam?.name}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Tillatelses-dialog ───────────────────────────────── */}
      <Dialog open={Boolean(permDialog)} onClose={() => setPermDialog(null)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <SecurityOutlinedIcon />
            <Box>
              <Typography variant="h6">Tillatelser for {permDialog?.userLabel}</Typography>
              {permDialog?.state && (
                <Typography variant="caption" color="text.secondary">
                  Rolle: {ROLE_META[permDialog.state.role]?.label ?? permDialog.state.role}
                  {' · '}
                  {permDialog.state.overrides.length} overstyringer aktive
                </Typography>
              )}
            </Box>
          </Stack>
          <IconButton aria-label="Lukk" sx={{ position: 'absolute', right: 8, top: 8 }}
            onClick={() => setPermDialog(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {permDialog?.state ? (
            <Stack spacing={1}>
              <Alert severity="info" sx={{ mb: 1 }}>
                Bryterne viser <strong>effektiv tillatelse</strong> = rolle-default
                +/- overstyringer. Endring lagres umiddelbart.
              </Alert>
              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <Accordion key={category} defaultExpanded={category === 'Leads'}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Typography variant="subtitle1">{category}</Typography>
                      <Chip size="small"
                        label={`${perms.filter((p) => permDialog.state?.effective.includes(p.key)).length} / ${perms.length}`}
                      />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack>
                      {perms.map((p) => {
                        const on = permDialog.state!.effective.includes(p.key);
                        const ovr = permDialog.state!.overrides.find((o) => o.permission_key === p.key);
                        return (
                          <FormControlLabel
                            key={p.key}
                            control={
                              <MuiSwitch
                                checked={on}
                                disabled={savingPerm === p.key}
                                onChange={() => togglePermission(p.key, on)}
                                inputProps={{ 'aria-label': `Tillatelse ${p.key}` }}
                              />
                            }
                            label={
                              <Box>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Typography variant="body2">{p.description}</Typography>
                                  {ovr && (
                                    <Chip size="small"
                                      label={ovr.effect === 'grant' ? 'Eksplisitt gitt' : 'Eksplisitt nektet'}
                                      sx={{
                                        bgcolor: ovr.effect === 'grant' ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
                                        color: ovr.effect === 'grant' ? '#34d399' : '#f87171',
                                      }}
                                    />
                                  )}
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  {p.key}
                                </Typography>
                              </Box>
                            }
                            sx={{ alignItems: 'flex-start', mb: 1, ml: 0 }}
                          />
                        );
                      })}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          ) : (
            <Stack alignItems="center" sx={{ p: 4 }}><CircularProgress /></Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button startIcon={<RestoreOutlinedIcon />} onClick={resetPermissions}
            disabled={!permDialog?.state || permDialog.state.overrides.length === 0}>
            Tilbakestill til rolle-default
          </Button>
          <Button variant="contained" onClick={() => setPermDialog(null)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* ─── Forfremmelses-wizard ─────────────────────────────── */}
      <LeadMapPromoteDialog
        open={Boolean(promotingMember)}
        organizationId={activeOrgId}
        member={promotingMember ? {
          user_id: promotingMember.user_id,
          role: promotingMember.role,
          user_email: promotingMember.user_email,
          display_name: promotingMember.display_name,
          avatar_url: promotingMember.avatar_url,
          title: promotingMember.title,
          sales_team_id: promotingMember.sales_team_id,
        } : null}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        onClose={() => setPromotingMember(null)}
        onPromoted={() => { void loadOrgDetails(activeOrgId!); }}
      />

      {/* ─── Medlem-profil-dialog ──────────────────────────────── */}
      <Dialog open={Boolean(editingMember)} onClose={() => setEditingMember(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Org-logo i header — gjør tilhørighet visuell */}
            <Avatar src={profile?.logo_url ?? undefined} variant="rounded"
              sx={{ width: 56, height: 56, bgcolor: '#1f1f2a' }}>
              <BusinessOutlinedIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">
                Rediger profil for {editingMember?.user_email}
              </Typography>
              {activeOrgSummary && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap">
                  <Typography variant="body2" color="text.secondary">
                    {activeOrgSummary.name}
                  </Typography>
                  {profile?.org_number && (
                    <Chip label={`Org.nr ${profile.org_number}`} size="small" variant="outlined" />
                  )}
                  {activeOrgSummary.orgType === 'developer' && (
                    <Chip label="Utvikler" size="small" color="primary" />
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
          <IconButton aria-label="Lukk" sx={{ position: 'absolute', right: 8, top: 8 }}
            onClick={() => setEditingMember(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {editingMember && (() => {
            const completeness = profileCompleteness(editingMember);
            const isComplete = completeness === 100;
            return (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Alert severity={isComplete ? 'success' : 'warning'}>
                  Profil-fullstendighet: <strong>{completeness}%</strong>
                  {!isComplete && ' — alle profiler må ha profilbilde, e-post, telefon og stillingstittel'}
                </Alert>

                {/* ─── Profilbilde (påkrevd) ───────────────── */}
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Profilbilde <span style={{ color: '#f87171' }}>*</span>
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                    <Avatar src={editingMember.avatar_url ?? undefined}
                      sx={{ width: 80, height: 80,
                        border: editingMember.avatar_url ? '2px solid #34d399' : '2px dashed #f87171' }}>
                      {(editingMember.display_name ?? editingMember.user_email ?? '?')[0]}
                    </Avatar>
                    <Stack spacing={1}>
                      <Button component="label" variant="outlined" size="small">
                        Last opp bilde
                        <input type="file" accept="image/*" hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onAvatarFile(f);
                          }}
                        />
                      </Button>
                      {editingMember.avatar_url && (
                        <Button size="small" color="error"
                          onClick={() => setEditingMember({ ...editingMember, avatar_url: null })}>
                          Fjern
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    JPG/PNG/WebP/GIF. Krymper automatisk til 256×256.
                  </Typography>
                </Box>

                <TextField label="Visningsnavn" value={editingMember.display_name ?? ''}
                  onChange={(e) => setEditingMember({ ...editingMember, display_name: e.target.value })} fullWidth />

                <TextField required label="Stillingstittel"
                  placeholder="f.eks. Salgssjef Nord-Norge"
                  value={editingMember.title ?? ''}
                  error={!editingMember.title?.trim()}
                  helperText={!editingMember.title?.trim() ? 'Påkrevd' : ' '}
                  onChange={(e) => setEditingMember({ ...editingMember, title: e.target.value })} fullWidth />

                <TextField required label="E-post" type="email"
                  value={editingMember.profile_contact_email ?? ''}
                  error={!editingMember.profile_contact_email?.trim()}
                  helperText={!editingMember.profile_contact_email?.trim() ? 'Påkrevd' : ' '}
                  onChange={(e) => setEditingMember({ ...editingMember, profile_contact_email: e.target.value })} fullWidth />

                <TextField required label="Telefon" type="tel"
                  placeholder="+47 ..."
                  value={editingMember.phone ?? ''}
                  error={!editingMember.phone?.trim()}
                  helperText={!editingMember.phone?.trim() ? 'Påkrevd' : ' '}
                  onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })} fullWidth />

                <TextField label="LinkedIn-profil (valgfritt)"
                  placeholder="https://linkedin.com/in/..."
                  value={editingMember.linkedin_url ?? ''}
                  onChange={(e) => setEditingMember({ ...editingMember, linkedin_url: e.target.value })} fullWidth />

                <Divider>Salgs-felter</Divider>

                <TextField label="Territorium" value={editingMember.territory ?? ''}
                  onChange={(e) => setEditingMember({ ...editingMember, territory: e.target.value })} fullWidth />
                <Stack direction="row" spacing={1}>
                  <TextField label="Månedlig kvote (NOK)" type="number"
                    value={editingMember.quota_monthly_nok ?? ''}
                    onChange={(e) => setEditingMember({ ...editingMember, quota_monthly_nok: e.target.value })} fullWidth />
                  <TextField label="Kommisjon (%)" type="number" inputProps={{ step: 0.5 }}
                    value={editingMember.commission_pct ?? ''}
                    onChange={(e) => setEditingMember({ ...editingMember, commission_pct: e.target.value })} fullWidth />
                </Stack>
              </Stack>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingMember(null)}>Avbryt</Button>
          <Button variant="contained" onClick={saveMemberProfile}
            disabled={Boolean(editingMember) && profileCompleteness(editingMember!) < 100}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

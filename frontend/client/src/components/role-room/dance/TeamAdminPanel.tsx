/**
 * TeamAdminPanel — Studio-eierens kontrollsenter for dans-team:
 *   • Medlemmer (status, rolle, fjern)
 *   • Roller (custom labels + capability-toggles, opprett/rediger/slett)
 *   • Invitasjoner (pending + accepted, opprett/revoke)
 *
 * Tre seksjoner i én fil — alle krever team.manage_roles eller eier-status.
 * Mountes via DanceWorkspace case 'team'.
 *
 * UI-skjema: glassmorphism + lilla branding-tokens som matcher dans-vertikalens
 * dashboard. Ingen produksjon/innholds-vokabular bløder inn.
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Chip,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Tooltip,
  CircularProgress,
  Alert,
  Divider,
  Menu,
} from '@mui/material';
import {
  PersonAddAlt1Outlined as AddMemberIcon,
  AddOutlined as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutlineOutlined as DeleteIcon,
  MoreVertOutlined as MoreIcon,
  ContentCopyOutlined as CopyIcon,
  CheckCircleOutlined as ActiveIcon,
  ScheduleOutlined as PendingIcon,
  BlockOutlined as DeactivatedIcon,
} from '@mui/icons-material';
import * as svc from './danceTeamService';
import type { DanceTeamRole, DanceTeamMember, DanceTeamInvite, DanceTeamSummary, MyMembership } from './danceTeamService';

// ─── Branding tokens ────────────────────────────────────────────────────

const PURPLE_DEEP   = '#4c1d95';
const PURPLE_BRIGHT = '#8b5cf6';
const PURPLE_LIGHT  = '#a78bfa';
const PURPLE_GLASS  = 'rgba(139,92,246,0.10)';
const TEXT_DIM      = 'rgba(229,231,235,0.65)';
const TEXT_MUTED    = 'rgba(229,231,235,0.45)';
const PANEL_BG      = 'rgba(15,12,28,0.62)';
const PANEL_BORDER  = 'rgba(167,139,250,0.18)';

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.5,
  color: PURPLE_LIGHT,
  fontWeight: 700,
  textTransform: 'uppercase',
};

// ═══════════════════════════════════════════════════════════════════════
//  Hovedpanel
// ═══════════════════════════════════════════════════════════════════════

export const TeamAdminPanel: React.FC = () => {
  const [membership, setMembership] = React.useState<MyMembership | null>(null);
  const [roles, setRoles] = React.useState<DanceTeamRole[]>([]);
  const [members, setMembers] = React.useState<DanceTeamMember[]>([]);
  const [invites, setInvites] = React.useState<DanceTeamInvite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // UI state
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<DanceTeamRole | null>(null);
  const [creatingRole, setCreatingRole] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let m = await svc.getMyMembership();
      // Hvis user ikke har et team, prøv å opprette ett — dette er
      // idempotent og dekker både Studio-eier første-login OG eksisterende
      // brukere som migrerer inn.
      if (!m || !m.team) {
        try {
          await svc.ensureMyTeam();
          m = await svc.getMyMembership();
        } catch (err) {
          // ignore — kan være Frilansdanser uten team-tilgang
        }
      }
      setMembership(m);
      if (m && m.team) {
        const orgId = m.team.teamOrganizationId;
        const [r, mem, inv] = await Promise.all([
          svc.listRoles(orgId),
          svc.listMembers(orgId),
          svc.listInvites(orgId).catch(() => []),
        ]);
        setRoles(r);
        setMembers(mem);
        setInvites(inv);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste team-data');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: PURPLE_LIGHT }} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;
  }

  if (!membership || !membership.team) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: TEXT_DIM }}>
          Du har ikke tilgang til et team-administrasjon her. Som frilans-danser jobber
          du med din egen konto — og kan invitere samarbeidspartnere prosjektvis.
        </Typography>
      </Box>
    );
  }

  const { team } = membership;
  const ownerRole = roles.find((r) => r.isOwnerRole);
  const isOwner = membership.role?.isOwnerRole === true;

  return (
    <Stack spacing={3} sx={{ p: { xs: 1.5, md: 2.5 } }} data-testid="team-admin">
      {/* ── Header med team-summary ── */}
      <TeamHeader summary={team} canManage={isOwner} onInvite={() => setInviteOpen(true)} />

      {/* ── Members ── */}
      <SectionCard title="Medlemmer" count={members.length}>
        <MembersTable
          members={members}
          roles={roles}
          ownerRowId={ownerRole?.id ?? null}
          canManage={isOwner}
          onChange={refresh}
        />
      </SectionCard>

      {/* ── Pending invites ── */}
      {isOwner ? (
        <SectionCard
          title="Invitasjoner"
          count={invites.filter((i) => !i.acceptedAt && !i.revokedAt).length}
        >
          <InvitesList
            invites={invites}
            teamOrgId={team.teamOrganizationId}
            onChange={refresh}
          />
        </SectionCard>
      ) : null}

      {/* ── Roles ── */}
      <SectionCard
        title="Roller"
        count={roles.length}
        action={isOwner ? (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreatingRole(true)}
            data-testid="team-new-role"
            sx={{ color: PURPLE_LIGHT, textTransform: 'none' }}
          >
            Ny rolle
          </Button>
        ) : null}
      >
        <RolesList
          roles={roles}
          canManage={isOwner}
          onEdit={(r) => setEditingRole(r)}
          onDelete={async (r) => {
            if (!window.confirm(`Slette rollen "${r.label}"?`)) return;
            try {
              await svc.deleteRole(team.teamOrganizationId, r.id);
              await refresh();
            } catch (e) {
              alert(`Kunne ikke slette: ${e instanceof Error ? e.message : e}`);
            }
          }}
        />
      </SectionCard>

      {/* ── Modals ── */}
      {inviteOpen ? (
        <InviteDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          teamOrgId={team.teamOrganizationId}
          roles={roles}
          defaultRoleId={team.defaultInviteRoleId}
          onCreated={async (token) => {
            await refresh();
            setInviteOpen(false);
            // GA4 dataLayer event — eksponert til analytics
            if (typeof window !== 'undefined') {
              const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
              if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
              w.dataLayer.push({ event: 'dance_invite_created', invite_token: token });
            }
            // Kopier invite-link til clipboard som UX-bonus
            const link = `${window.location.origin}/dance/invite/${token}`;
            try {
              await navigator.clipboard.writeText(link);
              alert(`Invitasjon opprettet. Lenken er kopiert til utklippstavlen.\n\n${link}`);
            } catch {
              alert(`Invitasjon opprettet:\n\n${link}`);
            }
          }}
        />
      ) : null}

      {editingRole ? (
        <RoleEditorDialog
          open
          onClose={() => setEditingRole(null)}
          teamOrgId={team.teamOrganizationId}
          role={editingRole}
          onSaved={async () => { await refresh(); setEditingRole(null); }}
        />
      ) : null}

      {creatingRole ? (
        <RoleEditorDialog
          open
          onClose={() => setCreatingRole(false)}
          teamOrgId={team.teamOrganizationId}
          role={null}
          onSaved={async () => { await refresh(); setCreatingRole(false); }}
        />
      ) : null}
    </Stack>
  );
};

// ─── Header ─────────────────────────────────────────────────────────────

const TeamHeader: React.FC<{
  summary: DanceTeamSummary;
  canManage: boolean;
  onInvite: () => void;
}> = ({ summary, canManage, onInvite }) => (
  <Box
    sx={{
      p: { xs: 2, md: 3 },
      borderRadius: 2,
      background: `linear-gradient(135deg, ${PURPLE_GLASS}, rgba(76,29,149,0.06))`,
      border: `1px solid ${PANEL_BORDER}`,
    }}
  >
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
      <Stack spacing={0.5}>
        <Typography sx={sectionLabel}>Dansestudio · Team</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'rgba(237,233,254,0.95)' }}>
          {summary.activeMemberCount} aktiv{summary.activeMemberCount === 1 ? '' : 'e'} medlem{summary.activeMemberCount === 1 ? '' : 'mer'}
        </Typography>
        <Typography sx={{ fontSize: 13, color: TEXT_DIM }}>
          {summary.seatLimit == null
            ? 'Ubegrenset antall seats (Enterprise)'
            : `${summary.memberCount} / ${summary.seatLimit} seats brukt — ${summary.seatRemaining ?? 0} igjen`}
        </Typography>
      </Stack>
      {canManage ? (
        <Button
          variant="contained"
          startIcon={<AddMemberIcon />}
          onClick={onInvite}
          disabled={summary.seatLimit != null && (summary.seatRemaining ?? 0) <= 0}
          data-testid="team-invite-trigger"
          sx={{
            bgcolor: PURPLE_BRIGHT,
            '&:hover': { bgcolor: PURPLE_DEEP },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Inviter medlem
        </Button>
      ) : null}
    </Stack>
  </Box>
);

// ─── Section card ───────────────────────────────────────────────────────

const SectionCard: React.FC<{
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, count, action, children }) => (
  <Box
    sx={{
      p: { xs: 1.5, md: 2.5 },
      borderRadius: 2,
      background: PANEL_BG,
      border: `1px solid ${PANEL_BORDER}`,
    }}
  >
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography sx={sectionLabel}>{title}</Typography>
        {typeof count === 'number' ? (
          <Chip label={count} size="small" sx={{ bgcolor: PURPLE_GLASS, color: PURPLE_LIGHT, fontWeight: 700, height: 18 }} />
        ) : null}
      </Stack>
      {action}
    </Stack>
    {children}
  </Box>
);

// ═══════════════════════════════════════════════════════════════════════
//  Members table
// ═══════════════════════════════════════════════════════════════════════

const MembersTable: React.FC<{
  members: DanceTeamMember[];
  roles: DanceTeamRole[];
  ownerRowId: string | null;
  canManage: boolean;
  onChange: () => Promise<void>;
}> = ({ members, roles, canManage, onChange }) => {
  if (members.length === 0) {
    return <Typography sx={{ fontSize: 12, color: TEXT_MUTED }}>Ingen medlemmer ennå.</Typography>;
  }
  return (
    <Stack divider={<Divider sx={{ borderColor: PANEL_BORDER }} />} spacing={0}>
      {members.map((m) => (
        <MemberRow key={m.memberRowId} member={m} roles={roles} canManage={canManage} onChange={onChange} />
      ))}
    </Stack>
  );
};

const MemberRow: React.FC<{
  member: DanceTeamMember;
  roles: DanceTeamRole[];
  canManage: boolean;
  onChange: () => Promise<void>;
}> = ({ member, roles, canManage, onChange }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const role = roles.find((r) => r.id === member.danceRoleId);
  const isOwner = role?.isOwnerRole === true;
  const StatusIcon =
    member.status === 'active' ? ActiveIcon
      : member.status === 'pending' ? PendingIcon
      : DeactivatedIcon;

  return (
    <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1.25 }} data-testid={`team-member-row-${member.memberRowId}`}>
      <StatusIcon sx={{ fontSize: 18, color: member.status === 'active' ? '#22c55e' : TEXT_MUTED }} />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, color: 'rgba(237,233,254,0.92)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.email}
        </Typography>
        <Typography sx={{ fontSize: 11, color: TEXT_MUTED }}>
          {role?.label ?? '— ingen rolle —'}
          {isOwner ? ' · eier' : ''}
        </Typography>
      </Box>

      {canManage && !isOwner ? (
        <>
          <TextField
            select
            value={member.danceRoleId ?? ''}
            size="small"
            variant="outlined"
            onChange={async (e) => {
              const newRoleId = e.target.value;
              if (!newRoleId || newRoleId === member.danceRoleId) return;
              try {
                await svc.updateMemberRole(member.teamOrganizationId, member.memberRowId, newRoleId);
                await onChange();
              } catch (err) {
                alert(`Kunne ikke endre rolle: ${err instanceof Error ? err.message : err}`);
              }
            }}
            data-testid={`team-member-role-select-${member.memberRowId}`}
            SelectProps={{ 'data-testid': `team-member-role-trigger-${member.memberRowId}` } as never}
            sx={{
              minWidth: 140,
              '& .MuiOutlinedInput-root': {
                fontSize: 12,
                color: 'rgba(237,233,254,0.9)',
                '& fieldset': { borderColor: PANEL_BORDER },
              },
            }}
          >
            {roles.filter((r) => !r.isOwnerRole).map((r) => (
              <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
            ))}
          </TextField>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} data-testid={`team-member-menu-${member.memberRowId}`}>
            <MoreIcon sx={{ color: TEXT_DIM }} />
          </IconButton>
          <Menu open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
            <MenuItem
              onClick={async () => {
                setAnchorEl(null);
                if (!window.confirm(`Fjerne ${member.email} fra teamet?`)) return;
                try {
                  await svc.removeMember(member.teamOrganizationId, member.memberRowId);
                  await onChange();
                } catch (err) {
                  alert(`Kunne ikke fjerne: ${err instanceof Error ? err.message : err}`);
                }
              }}
              data-testid={`team-member-remove-${member.memberRowId}`}
              sx={{ color: '#f87171', fontSize: 13 }}
            >
              Fjern fra team
            </MenuItem>
          </Menu>
        </>
      ) : (
        <Chip
          label={role?.label ?? '—'}
          size="small"
          sx={{ bgcolor: PURPLE_GLASS, color: PURPLE_LIGHT, fontWeight: 600, height: 22 }}
        />
      )}
    </Stack>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Invites list
// ═══════════════════════════════════════════════════════════════════════

const InvitesList: React.FC<{
  invites: DanceTeamInvite[];
  teamOrgId: string;
  onChange: () => Promise<void>;
}> = ({ invites, teamOrgId, onChange }) => {
  const pending = invites.filter((i) => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) > new Date());
  if (pending.length === 0) {
    return <Typography sx={{ fontSize: 12, color: TEXT_MUTED }}>Ingen åpne invitasjoner.</Typography>;
  }
  return (
    <Stack divider={<Divider sx={{ borderColor: PANEL_BORDER }} />} spacing={0}>
      {pending.map((i) => (
        <Stack key={i.token} direction="row" alignItems="center" spacing={2} sx={{ py: 1.25 }} data-testid={`team-invite-row-${i.token}`}>
          <PendingIcon sx={{ fontSize: 18, color: TEXT_MUTED }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, color: 'rgba(237,233,254,0.92)', fontWeight: 500 }}>
              {i.invitedEmail}
            </Typography>
            <Typography sx={{ fontSize: 11, color: TEXT_MUTED }}>
              {i.invitedRoleLabel ?? '—'} · utløper {new Date(i.expiresAt).toLocaleDateString('nb-NO')}
            </Typography>
          </Box>
          <Tooltip title="Kopier invite-lenke">
            <IconButton
              size="small"
              data-testid={`team-invite-copy-${i.token}`}
              onClick={async () => {
                const link = `${window.location.origin}/dance/invite/${i.token}`;
                try { await navigator.clipboard.writeText(link); } catch {}
              }}
            >
              <CopyIcon sx={{ color: TEXT_DIM, fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Trekk tilbake">
            <IconButton
              size="small"
              data-testid={`team-invite-revoke-${i.token}`}
              onClick={async () => {
                if (!window.confirm(`Trekke tilbake invitasjon til ${i.invitedEmail}?`)) return;
                try {
                  await svc.revokeInvite(teamOrgId, i.token);
                  await onChange();
                } catch (err) {
                  alert(`Kunne ikke trekke tilbake: ${err instanceof Error ? err.message : err}`);
                }
              }}
            >
              <DeleteIcon sx={{ color: '#f87171', fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      ))}
    </Stack>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Roles list
// ═══════════════════════════════════════════════════════════════════════

const RolesList: React.FC<{
  roles: DanceTeamRole[];
  canManage: boolean;
  onEdit: (r: DanceTeamRole) => void;
  onDelete: (r: DanceTeamRole) => void;
}> = ({ roles, canManage, onEdit, onDelete }) => (
  <Stack divider={<Divider sx={{ borderColor: PANEL_BORDER }} />} spacing={0}>
    {roles.map((r) => {
      const enabledCount = Object.values(r.capabilities).filter(Boolean).length;
      return (
        <Stack key={r.id} direction="row" alignItems="center" spacing={2} sx={{ py: 1.25 }} data-testid={`team-role-row-${r.id}`}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 14, color: 'rgba(237,233,254,0.95)', fontWeight: 600 }}>
                {r.label}
              </Typography>
              {r.isOwnerRole ? (
                <Chip label="Eier · låst" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontWeight: 700, height: 18, fontSize: 10 }} />
              ) : null}
              {r.isDefaultForInvite ? (
                <Chip label="Default" size="small" sx={{ bgcolor: PURPLE_GLASS, color: PURPLE_LIGHT, fontWeight: 700, height: 18, fontSize: 10 }} />
              ) : null}
            </Stack>
            <Typography sx={{ fontSize: 11, color: TEXT_MUTED }}>
              {r.isOwnerRole
                ? `${svc.ALL_CAPABILITY_KEYS.length} capabilities (alt)`
                : `${enabledCount} capabilities aktive`}
            </Typography>
          </Box>
          {canManage ? (
            <>
              <IconButton size="small" onClick={() => onEdit(r)} data-testid={`team-role-edit-${r.id}`}>
                <EditIcon sx={{ color: TEXT_DIM, fontSize: 18 }} />
              </IconButton>
              {!r.isOwnerRole ? (
                <IconButton size="small" onClick={() => onDelete(r)} data-testid={`team-role-delete-${r.id}`}>
                  <DeleteIcon sx={{ color: '#f87171', fontSize: 18 }} />
                </IconButton>
              ) : null}
            </>
          ) : null}
        </Stack>
      );
    })}
  </Stack>
);

// ═══════════════════════════════════════════════════════════════════════
//  Invite Dialog
// ═══════════════════════════════════════════════════════════════════════

const InviteDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  teamOrgId: string;
  roles: DanceTeamRole[];
  defaultRoleId: string | null;
  onCreated: (token: string) => void | Promise<void>;
}> = ({ open, onClose, teamOrgId, roles, defaultRoleId, onCreated }) => {
  const inviteableRoles = roles.filter((r) => !r.isOwnerRole);
  const [email, setEmail] = React.useState('');
  const [roleId, setRoleId] = React.useState<string>(defaultRoleId ?? inviteableRoles[0]?.id ?? '');
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!email.trim() || !roleId) return;
    setSubmitting(true);
    try {
      const r = await svc.createInvite(teamOrgId, { invitedEmail: email.trim(), invitedRoleId: roleId });
      if (typeof window !== 'undefined') {
        const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
        if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
        w.dataLayer.push({
          event: 'dance_invite_created',
          team_id: teamOrgId,
          invited_role_id: roleId,
        });
      }
      await onCreated(r.invite.token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg === 'seat_limit_reached'
        ? 'Du har brukt opp alle seats på din plan. Oppgrader eller fjern et inaktivt medlem.'
        : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#0f0a1c', border: `1px solid ${PANEL_BORDER}` }, 'data-testid': 'team-invite-dialog' } as never}>
      <DialogTitle sx={{ color: 'rgba(237,233,254,0.95)' }}>Inviter medlem</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <TextField
            label="E-post"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            fullWidth
            variant="outlined"
            placeholder="navn@dansestudio.no"
            inputProps={{ 'data-testid': 'team-invite-email' }}
            sx={{ '& .MuiInputLabel-root, & .MuiOutlinedInput-root': { color: 'rgba(237,233,254,0.9)' } }}
          />
          <TextField
            select
            label="Rolle"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            fullWidth
            variant="outlined"
            inputProps={{ 'data-testid': 'team-invite-role' }}
            sx={{ '& .MuiInputLabel-root, & .MuiOutlinedInput-root': { color: 'rgba(237,233,254,0.9)' } }}
          >
            {inviteableRoles.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.label}
                {r.isDefaultForInvite ? ' · default' : ''}
              </MenuItem>
            ))}
          </TextField>
          <Typography sx={{ fontSize: 11, color: TEXT_MUTED }}>
            Mottakeren får en lenke som er gyldig i 14 dager. Når de godtar, blir
            de lagt til som aktivt medlem med valgt rolle.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: TEXT_DIM }}>Avbryt</Button>
        <Button
          onClick={submit}
          disabled={submitting || !email.trim() || !roleId}
          variant="contained"
          data-testid="team-invite-send"
          sx={{ bgcolor: PURPLE_BRIGHT, '&:hover': { bgcolor: PURPLE_DEEP }, textTransform: 'none', fontWeight: 600 }}
        >
          {submitting ? 'Sender…' : 'Send invitasjon'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  Role Editor Dialog
// ═══════════════════════════════════════════════════════════════════════

const RoleEditorDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  teamOrgId: string;
  role: DanceTeamRole | null;
  onSaved: () => void | Promise<void>;
}> = ({ open, onClose, teamOrgId, role, onSaved }) => {
  const [label, setLabel] = React.useState(role?.label ?? '');
  const [caps, setCaps] = React.useState<Record<string, boolean>>(role?.capabilities ?? {});
  const [isDefault, setIsDefault] = React.useState(role?.isDefaultForInvite ?? false);
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const isOwner = role?.isOwnerRole === true;

  const submit = async () => {
    setErr(null);
    if (!label.trim()) return;
    setSubmitting(true);
    try {
      if (role) {
        await svc.updateRole(teamOrgId, role.id, {
          label: label.trim(),
          capabilities: caps,
          isDefaultForInvite: isDefault,
        });
      } else {
        await svc.createRole(teamOrgId, {
          label: label.trim(),
          capabilities: caps,
          isDefaultForInvite: isDefault,
        });
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: '#0f0a1c', border: `1px solid ${PANEL_BORDER}` }, 'data-testid': 'team-role-dialog' } as never}>
      <DialogTitle sx={{ color: 'rgba(237,233,254,0.95)' }}>
        {role ? `Rediger rolle: ${role.label}` : 'Ny rolle'}
        {isOwner ? <Chip label="Eier — capabilities er låst til alt" size="small" sx={{ ml: 2, bgcolor: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontWeight: 700 }} /> : null}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}
          <TextField
            label="Rolle-navn"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            fullWidth
            variant="outlined"
            disabled={isOwner}
            inputProps={{ 'data-testid': 'team-role-label' }}
            sx={{ '& .MuiInputLabel-root, & .MuiOutlinedInput-root': { color: 'rgba(237,233,254,0.9)' } }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={isDefault}
                disabled={isOwner}
                onChange={(e) => setIsDefault(e.target.checked)}
                sx={{ '& .Mui-checked': { color: PURPLE_BRIGHT } }}
              />
            }
            label={
              <Typography sx={{ fontSize: 13, color: TEXT_DIM }}>
                Forhåndsvalgt rolle i invite-dialog
              </Typography>
            }
          />
          <Divider sx={{ borderColor: PANEL_BORDER }} />
          <Typography sx={{ ...sectionLabel, mb: 0.5 }}>Capabilities</Typography>
          <Box>
            {(Object.entries(svc.CAPABILITY_GROUPS) as [keyof typeof svc.CAPABILITY_GROUPS, readonly string[]][]).map(([groupKey, capKeys]) => (
              <Box key={groupKey} sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 12, color: PURPLE_LIGHT, fontWeight: 600, mb: 0.5 }}>
                  {svc.CAPABILITY_GROUP_LABELS[groupKey]}
                </Typography>
                <Stack spacing={0.5}>
                  {capKeys.map((key) => (
                    <FormControlLabel
                      key={key}
                      control={
                        <Switch
                          size="small"
                          checked={isOwner ? true : caps[key] === true}
                          disabled={isOwner}
                          onChange={(e) => setCaps((prev) => ({ ...prev, [key]: e.target.checked }))}
                          inputProps={{ 'data-testid': `team-role-cap-${key}` } as React.InputHTMLAttributes<HTMLInputElement>}
                          sx={{ '& .Mui-checked': { color: PURPLE_BRIGHT } }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: 13, color: 'rgba(237,233,254,0.85)' }}>
                          {svc.CAPABILITY_LABELS[key] ?? key}
                        </Typography>
                      }
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: TEXT_DIM }}>Avbryt</Button>
        {!isOwner ? (
          <Button
            onClick={submit}
            disabled={submitting || !label.trim()}
            variant="contained"
            data-testid="team-role-save"
            sx={{ bgcolor: PURPLE_BRIGHT, '&:hover': { bgcolor: PURPLE_DEEP }, textTransform: 'none', fontWeight: 600 }}
          >
            {submitting ? 'Lagrer…' : 'Lagre'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};

export default TeamAdminPanel;

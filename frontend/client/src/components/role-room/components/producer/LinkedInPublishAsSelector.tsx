import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { Person as PersonIcon, Business as BusinessIcon } from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomLinkedInCompany,
} from '../../services/roleRoomAgentService';

interface LinkedInPublishAsSelectorProps {
  /** Prosjektet styrer hvilken LinkedIn-tilkobling backend velger. */
  projectId: string;
  /** Nåværende valg — null = personlig profil (default). Ellers
   *  organization-URN ('urn:li:organization:12345'). */
  value: string | null;
  /** Kalt når brukeren bytter. Null betyr "personlig profil". */
  onChange: (urn: string | null) => void;
}

/**
 * Dropdown for å velge om en LinkedIn-post publiseres som personlig
 * profil eller som en av bedriftene brukeren administrerer.
 *
 * Henter listen via /api/role-room/linkedin/companies. Hvis tokenet
 * mangler `w_organization_social`-scope, viser vi en re-connect-CTA
 * i stedet for dropdown.
 *
 * Auto-skjul hvis brukeren ikke admin-er noen orgs (default-publisering
 * blir alltid personlig — ingen grunn til UI-støy).
 */
export default function LinkedInPublishAsSelector({
  projectId,
  value,
  onChange,
}: LinkedInPublishAsSelectorProps): React.ReactElement | null {
  const [companies, setCompanies] = useState<RoleRoomLinkedInCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeMissing, setScopeMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const pollInFlightRef = useRef(false);

  const stopOauthWatch = useCallback(() => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
    pollInFlightRef.current = false;
  }, []);

  const loadCompanies = useCallback(async (showLoading = true) => {
    if (showLoading && mountedRef.current) setLoading(true);
    const result = await roleRoomAgentService.listLinkedInCompanies(projectId);
    if (!mountedRef.current) return result;
    setCompanies(result.companies);
    setScopeMissing(result.scopeMissing);
    setError(result.error ?? null);
    if (showLoading) setLoading(false);
    return result;
  }, [projectId]);

  const completeReconnect = useCallback(async (popupClosed = false) => {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const result = await loadCompanies(false);
      if (!result.error && !result.scopeMissing) {
        stopOauthWatch();
        setReconnecting(false);
        if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
        popupRef.current = null;
        return;
      }
      if (popupClosed) {
        stopOauthWatch();
        setReconnecting(false);
        popupRef.current = null;
        setError(result.error ?? 'LinkedIn-vinduet ble lukket før bedriftstilgangen var aktivert.');
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, [loadCompanies, stopOauthWatch]);

  useEffect(() => {
    mountedRef.current = true;
    void loadCompanies();
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data || typeof event.data !== 'object') return;
      const type = (event.data as { type?: string }).type;
      if (type === 'linkedin-connected' || type === 'role-room:linkedin-connected') {
        void completeReconnect(false);
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('message', onMessage);
      stopOauthWatch();
    };
  }, [completeReconnect, loadCompanies, stopOauthWatch]);

  const startReconnect = async () => {
    stopOauthWatch();
    setReconnecting(true);
    setError(null);
    const popup = window.open('', 'li-oauth', 'width=720,height=820,resizable=yes');
    if (!popup) {
      setReconnecting(false);
      setError('Popupen ble blokkert. Tillat popup for denne siden og prøv igjen.');
      return;
    }
    popupRef.current = popup;
    try {
      const result = await roleRoomAgentService.startLinkedInOauth({
        projectId,
        returnPath: `${window.location.pathname}${window.location.search}`,
        browserOrigin: window.location.origin,
      });
      popup.location.assign(result.authorizationUrl);
      pollRef.current = window.setInterval(() => {
        const currentPopup = popupRef.current;
        if (!currentPopup) return;
        void completeReconnect(currentPopup.closed);
      }, 1_500);
      timeoutRef.current = window.setTimeout(() => {
        stopOauthWatch();
        setReconnecting(false);
        setError('LinkedIn-tilkoblingen tok for lang tid. Lukk vinduet og prøv igjen.');
      }, 2 * 60_000);
    } catch (caught) {
      popup.close();
      popupRef.current = null;
      setReconnecting(false);
      setError(caught instanceof Error ? caught.message : 'Kunne ikke starte LinkedIn OAuth.');
    }
  };

  if (loading) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.6 }}>
        <CircularProgress size={14} />
        <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.74rem' }}>
          Sjekker LinkedIn-bedrifter…
        </Typography>
      </Stack>
    );
  }

  if (error && !scopeMissing && companies.length === 0) {
    return (
      <Box
        role="alert"
        data-testid="linkedin-publish-as-error"
        sx={{
          p: 1.2,
          borderRadius: 1.4,
          bgcolor: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.3)',
        }}
      >
        <Typography sx={{ color: '#fca5a5', fontSize: '0.76rem', mb: 0.8 }}>
          {error}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() => void loadCompanies()}
          sx={{ textTransform: 'none', color: '#fecaca', borderColor: 'rgba(248,113,113,0.5)' }}
        >
          Prøv igjen
        </Button>
      </Box>
    );
  }

  if (scopeMissing) {
    return (
      <Box
        data-testid="linkedin-publish-as-scope-missing"
        sx={{
          p: 1.2,
          borderRadius: 1.4,
          bgcolor: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.3)',
        }}
      >
        <Typography sx={{ color: '#fde68a', fontSize: '0.78rem', fontWeight: 600, mb: 0.4 }}>
          Publisering som bedrift krever ekstra tilgang
        </Typography>
        <Typography sx={{ color: 'rgba(253,230,138,0.85)', fontSize: '0.72rem', mb: 0.8 }}>
          LinkedIn-tilkoblingen din mangler scopen som lar oss publisere på vegne av bedrifter.
          Re-connect for å aktivere det.
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() => void startReconnect()}
          disabled={reconnecting}
          startIcon={reconnecting ? <CircularProgress size={13} color="inherit" /> : undefined}
          sx={{
            textTransform: 'none',
            fontSize: '0.74rem',
            color: '#fbbf24',
            borderColor: 'rgba(251,191,36,0.5)',
          }}
        >
          {reconnecting ? 'Venter på LinkedIn…' : 'Aktiver bedriftspublisering'}
        </Button>
        {error ? (
          <Typography role="alert" sx={{ color: '#fca5a5', fontSize: '0.72rem', mt: 0.8 }}>
            {error}
          </Typography>
        ) : null}
      </Box>
    );
  }

  // Ingen bedrifter — auto-skjul, default-publisering blir alltid personlig
  if (companies.length === 0) return null;

  return (
    <Stack
      spacing={0.4}
      data-testid="linkedin-publish-as-selector"
      sx={{
        p: 1.2,
        borderRadius: 1.4,
        bgcolor: 'rgba(10,102,194,0.08)',
        border: '1px solid rgba(10,102,194,0.25)',
      }}
    >
      <Typography
        sx={{
          color: 'var(--role-cyan, #7dd3fc)',
          fontSize: '0.66rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Publiser som
      </Typography>
      <Select
        size="small"
        fullWidth
        value={value ?? '__self__'}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '__self__' ? null : v);
        }}
        data-testid="linkedin-publish-as-select"
        sx={{
          fontSize: '0.84rem',
          color: '#e2e8f0',
          bgcolor: 'rgba(15,23,42,0.55)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(148,163,184,0.25)',
          },
          '& .MuiSelect-icon': { color: 'rgba(226,232,240,0.6)' },
        }}
        renderValue={(selected) => {
          if (selected === '__self__') {
            return (
              <Stack direction="row" spacing={1} alignItems="center">
                <PersonIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
                <Typography sx={{ fontSize: '0.84rem', color: '#e2e8f0' }}>
                  Min profil
                </Typography>
              </Stack>
            );
          }
          const company = companies.find((c) => c.urn === selected);
          if (!company) {
            return (
              <Typography sx={{ fontSize: '0.84rem', color: '#cbd5e1' }}>
                {String(selected).slice(0, 32)}
              </Typography>
            );
          }
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar
                src={company.logoUrl ?? undefined}
                alt={company.name ?? 'company'}
                sx={{ width: 20, height: 20, fontSize: '0.7rem' }}
              >
                <BusinessIcon sx={{ fontSize: '0.9rem' }} />
              </Avatar>
              <Typography
                sx={{
                  fontSize: '0.84rem',
                  color: '#e2e8f0',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {company.name ?? 'LinkedIn-bedrift'}
              </Typography>
            </Stack>
          );
        }}
      >
        <MenuItem value="__self__" data-testid="linkedin-publish-as-option-self">
          <ListItemAvatar sx={{ minWidth: 32 }}>
            <Avatar sx={{ width: 24, height: 24, bgcolor: 'rgba(148,163,184,0.2)' }}>
              <PersonIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
            </Avatar>
          </ListItemAvatar>
          <ListItemText primary="Min profil" secondary="Publiser som personlig konto" />
        </MenuItem>
        {companies.map((company) => (
          <MenuItem
            key={company.urn}
            value={company.urn}
            data-testid="linkedin-publish-as-option-company"
          >
            <ListItemAvatar sx={{ minWidth: 32 }}>
              <Avatar
                src={company.logoUrl ?? undefined}
                alt={company.name ?? 'company'}
                sx={{ width: 24, height: 24 }}
              >
                <BusinessIcon sx={{ fontSize: '1rem' }} />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={company.name ?? company.vanityName ?? 'Bedrift'}
              secondary={company.role === 'ADMINISTRATOR' ? 'Administrator' : company.role}
            />
          </MenuItem>
        ))}
      </Select>
      {error ? (
        <Typography role="alert" sx={{ color: '#fca5a5', fontSize: '0.7rem' }}>
          {error}
        </Typography>
      ) : null}
    </Stack>
  );
}

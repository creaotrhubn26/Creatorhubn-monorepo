import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Divider,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline,
  MailOutline,
  NotificationsNone,
  PersonOutline,
  PhotoCamera,
  Save,
  Security,
  Tune,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyLeftSidebar from './AcademyLeftSidebar';
import { useAcademy } from '@/contexts/AcademyContext';
import { ACADEMY_WORKFLOW_INTENTS, type AcademyWorkflowIntentId } from './academyToolCore';

type UserSettingsState = {
  displayName: string;
  email: string;
  avatarUrl: string;
  locale: 'nb-NO' | 'en-US';
  timezone: string;
  academyPreferredMode: 'simple' | 'pro';
  academyDefaultIntent: AcademyWorkflowIntentId;
  academyShowQuickStart: boolean;
  academyShowNextAction: boolean;
  academyMicroHintsEnabled: boolean;
  marketingEmails: boolean;
  productUpdates: boolean;
  desktopNotifications: boolean;
  twoFactorAuth: boolean;
};

const panelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const STORAGE_KEY = 'academy_user_settings_v1';
const USER_SETTINGS_KV_KEY = 'academy_user_settings_v1';

const defaultState: UserSettingsState = {
  displayName: 'Creator Studio User',
  email: 'academy-guest@creatorhubn.com',
  avatarUrl: '',
  locale: 'nb-NO',
  timezone: 'Europe/Oslo',
  academyPreferredMode: 'simple',
  academyDefaultIntent: 'interactive-lesson',
  academyShowQuickStart: true,
  academyShowNextAction: true,
  academyMicroHintsEnabled: true,
  marketingEmails: false,
  productUpdates: true,
  desktopNotifications: true,
  twoFactorAuth: false,
};

const localeOptions: Array<{
  value: UserSettingsState['locale'];
  labelNo: string;
  labelEn: string;
  flag: string;
}> = [
  { value: 'nb-NO', labelNo: 'Norsk (Bokmål)', labelEn: 'Norwegian (Bokmål)', flag: '🇳🇴' },
  { value: 'en-US', labelNo: 'Engelsk (US)', labelEn: 'English (US)', flag: '🇺🇸' },
];

const readUserSettingsFromDb = async (): Promise<Partial<UserSettingsState> | null> => {
  try {
    const response = await fetch(`/api/user/kv/${encodeURIComponent(USER_SETTINGS_KV_KEY)}`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const value =
      payload && typeof payload === 'object'
        ? (payload.value ?? payload.data ?? null)
        : null;
    if (!value) return null;
    const parsed =
      typeof value === 'string'
        ? (JSON.parse(value) as Partial<UserSettingsState>)
        : (value as Partial<UserSettingsState>);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeUserSettingsToDb = async (settings: UserSettingsState): Promise<void> => {
  try {
    await fetch('/api/user/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: USER_SETTINGS_KV_KEY, value: settings }),
    });
  } catch {
    // Keep local persistence when DB write fails.
  }
};

function AcademyUserSettingsStudio() {
  const [location, setLocation] = useLocation();
  const { state, getInstructor, updateInstructor } = useAcademy();
  const { tt, navLabel } = useAcademyLocale();
  const { analytics } = useEnhancedMasterIntegration();

  const [leftNav, setLeftNav] = useState('profile-settings');
  const [settings, setSettings] = useState<UserSettingsState>(defaultState);
  const [saveMessage, setSaveMessage] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');
  const avatarUploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const localSettings = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as Partial<UserSettingsState>;
      } catch {
        return null;
      }
    })();

    if (localSettings && typeof localSettings === 'object') {
      setSettings((prev) => ({ ...prev, ...localSettings }));
    }

    void (async () => {
      const dbSettings = await readUserSettingsFromDb();
      if (cancelled) return;

      if (dbSettings && typeof dbSettings === 'object') {
        setSettings((prev) => ({ ...prev, ...dbSettings }));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbSettings));
        } catch {
          // Ignore local cache write errors.
        }
      } else if (localSettings && typeof localSettings === 'object') {
        void writeUserSettingsToDb({ ...defaultState, ...localSettings });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeTab = useMemo(() => {
    const query = location.includes('?') ? location.slice(location.indexOf('?') + 1) : '';
    const tab = new URLSearchParams(query).get('tab');
    return tab ?? 'profile';
  }, [location]);

  const profileInitial = useMemo(() => {
    const candidate = settings.displayName.trim().charAt(0).toUpperCase();
    return candidate || 'U';
  }, [settings.displayName]);

  const activeInstructorId = useMemo(
    () =>
      String(
        state.currentCourse?.competencyLeadInstructorId ||
          state.currentCourse?.instructor?.id ||
          '',
      ).trim(),
    [
      state.currentCourse?.competencyLeadInstructorId,
      state.currentCourse?.instructor?.id,
    ],
  );

  const handleAvatarUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null;
      if (!file) return;

      if (!String(file.type || '').startsWith('image/')) {
        setAvatarMessage(tt('Velg en bildefil.', 'Please choose an image file.'));
        event.target.value = '';
        return;
      }

      const maxBytes = 4 * 1024 * 1024;
      if (file.size > maxBytes) {
        setAvatarMessage(tt('Bildet må være under 4 MB.', 'Image must be under 4 MB.'));
        event.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) {
          setAvatarMessage(tt('Kunne ikke lese bildefilen.', 'Could not read image file.'));
          return;
        }
        setSettings((prev) => ({ ...prev, avatarUrl: result }));
        setAvatarMessage(
          tt(
            'Profilbildet er lastet opp. Lagre for å synkronisere instruktørkortet.',
            'Profile image uploaded. Save to sync the instructor card.',
          ),
        );
      };
      reader.onerror = () => {
        setAvatarMessage(tt('Kunne ikke lese bildefilen.', 'Could not read image file.'));
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    [tt],
  );

  const handleSave = async () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      await writeUserSettingsToDb(settings);
      if (activeInstructorId) {
        const activeInstructor = getInstructor(activeInstructorId);
        if (activeInstructor) {
          await updateInstructor({
            ...activeInstructor,
            avatar: String(settings.avatarUrl || '').trim(),
          });
        }
      }
      setSaveMessage(tt('Brukerinnstillinger lagret.', 'User settings saved.'));
      analytics.trackEvent('academy_user_settings_saved', {
        locale: settings.locale,
        timezone: settings.timezone,
        notifications: settings.desktopNotifications,
        twoFactorAuth: settings.twoFactorAuth,
        academyPreferredMode: settings.academyPreferredMode,
        academyDefaultIntent: settings.academyDefaultIntent,
        academyShowQuickStart: settings.academyShowQuickStart,
        academyShowNextAction: settings.academyShowNextAction,
        academyMicroHintsEnabled: settings.academyMicroHintsEnabled,
        timestamp: Date.now(),
      });
    } catch {
      setSaveMessage(tt('Kunne ikke lagre innstillinger.', 'Failed to save settings.'));
    }
  };

  const sideCards = (
    <>
      <Box sx={{ ...panelSx, p: 2 }}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Avatar src={settings.avatarUrl || undefined} sx={{ width: 44, height: 44, bgcolor: '#f8b321', color: '#111' }}>
            {profileInitial}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {settings.displayName || tt('Bruker', 'User')}
            </Typography>
            <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 13 }} noWrap>
              {settings.email}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ ...panelSx, p: 2 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <NotificationsNone />
            <Typography sx={{ fontWeight: 700 }}>{tt('Varslingsstatus', 'Notification Status')}</Typography>
          </Stack>
          <Typography sx={{ color: 'rgba(237,240,247,0.78)', fontSize: 13 }}>
            {settings.desktopNotifications
              ? tt('Skrivebordsvarsler er aktivert.', 'Desktop notifications are enabled.')
              : tt('Skrivebordsvarsler er deaktivert.', 'Desktop notifications are disabled.')}
          </Typography>
          <Typography sx={{ color: 'rgba(237,240,247,0.78)', fontSize: 13 }}>
            {settings.twoFactorAuth
              ? tt('Tofaktor-autentisering er aktiv.', 'Two-factor authentication is active.')
              : tt('Tofaktor-autentisering er ikke aktivert.', 'Two-factor authentication is not enabled.')}
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ ...panelSx, p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <MailOutline />
          <Typography sx={{ fontWeight: 700 }}>{tt('Kontoinfo', 'Account Info')}</Typography>
        </Stack>
        <Typography sx={{ mt: 1, color: 'rgba(237,240,247,0.78)', fontSize: 13 }}>
          {tt('Bruk denne siden for personlige innstillinger.', 'Use this page for personal preferences.')}
        </Typography>
        <Typography sx={{ mt: 1, color: 'rgba(237,240,247,0.66)', fontSize: 12 }}>
          {activeTab === 'notifications'
            ? tt('Åpnet fra varselikonet i header.', 'Opened from the notifications icon in the header.')
            : activeTab === 'messages'
              ? tt('Åpnet fra meldingsikonet i header.', 'Opened from the messages icon in the header.')
              : tt('Åpnet fra profilinnstillinger i Academy.', 'Opened from profile settings in Academy.')}
        </Typography>
      </Box>
    </>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        bgcolor: '#06080d',
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
        }}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: '252px minmax(0, 1fr)',
            xl: '252px minmax(0, 1fr) minmax(320px, var(--academy-right-panel-width, 360px))',
          },
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          width: 'min(100%, var(--academy-shell-max-width, 1920px))',
          mx: 'auto',
          overflowX: 'hidden',
        }}
      >
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(route);
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocation('/academy/curriculum?createCompetency=1');
          }}
          tt={tt}
          navLabel={navLabel}
        />

        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              height: 74,
              px: 3,
              borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))',
            }}
          >
            <Stack direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography sx={{ letterSpacing: '0.22em', fontSize: 15, color: 'rgba(237,240,247,0.82)' }}>
                CREATOR STUDIO
              </Typography>
              <Typography sx={{ fontSize: 21, fontWeight: 600 }} noWrap>
                {tt('Brukerinnstillinger', 'User Settings')}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.2} alignItems="center">
              <AcademyLocaleSwitcher />
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                sx={{
                  textTransform: 'none',
                  color: '#0f0f0f',
                  fontWeight: 700,
                  background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                  boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                }}
              >
                {tt('Lagre', 'Save')}
              </Button>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 2, md: 2.6 }, display: 'grid', gap: 1.6 }}>
            <Box
              sx={{
                display: 'grid',
                gap: 1.6,
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              }}
            >
              <Box sx={{ ...panelSx, p: 2 }}>
                <Stack spacing={1.4}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PersonOutline />
                    <Typography sx={{ fontWeight: 700 }}>{tt('Profil', 'Profile')}</Typography>
                  </Stack>

                  <TextField
                    label={tt('Visningsnavn', 'Display Name')}
                    value={settings.displayName}
                    onChange={(event) => setSettings((prev) => ({ ...prev, displayName: event.target.value }))}
                    size="small"
                  />
                  <TextField
                    label="E-post"
                    value={settings.email}
                    onChange={(event) => setSettings((prev) => ({ ...prev, email: event.target.value }))}
                    size="small"
                  />
                  <TextField
                    label={tt('Profilbilde URL', 'Profile Image URL')}
                    value={settings.avatarUrl}
                    onChange={(event) => {
                      setSettings((prev) => ({ ...prev, avatarUrl: event.target.value }));
                      if (avatarMessage) setAvatarMessage('');
                    }}
                    size="small"
                  />
                  <input
                    ref={avatarUploadInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    style={{ display: 'none' }}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <Avatar
                      src={settings.avatarUrl || undefined}
                      sx={{ width: 52, height: 52, bgcolor: '#f8b321', color: '#111' }}
                    >
                      {profileInitial}
                    </Avatar>
                    <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                      <Button
                        startIcon={<PhotoCamera />}
                        onClick={() => avatarUploadInputRef.current?.click()}
                        sx={{
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                        }}
                      >
                        {tt('Last opp bilde', 'Upload image')}
                      </Button>
                      <Button
                        onClick={() => {
                          setSettings((prev) => ({ ...prev, avatarUrl: '' }));
                          setAvatarMessage(tt('Profilbildet er fjernet.', 'Profile image removed.'));
                        }}
                        sx={{
                          textTransform: 'none',
                          color: 'rgba(237,240,247,0.86)',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.16)',
                        }}
                      >
                        {tt('Fjern bilde', 'Remove image')}
                      </Button>
                    </Stack>
                  </Stack>
                  {avatarMessage ? (
                    <Typography sx={{ fontSize: 12.5, color: 'rgba(237,240,247,0.72)' }}>
                      {avatarMessage}
                    </Typography>
                  ) : null}
                  <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.62)' }}>
                    {tt(
                      'Bildet synkes til aktiv instruktørprofil og brukes i instruktørkort i avspilleren.',
                      'The image syncs to the active instructor profile and is used in the player instructor card.',
                    )}
                  </Typography>
                  <TextField
                    label={tt('Tidssone', 'Timezone')}
                    value={settings.timezone}
                    onChange={(event) => setSettings((prev) => ({ ...prev, timezone: event.target.value }))}
                    size="small"
                  />
                </Stack>
              </Box>

              <Box sx={{ ...panelSx, p: 2 }}>
                <Stack spacing={1.4}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Tune />
                    <Typography sx={{ fontWeight: 700 }}>{tt('Preferanser', 'Preferences')}</Typography>
                  </Stack>

                  <Box>
                    <Typography sx={{ mb: 0.8, color: 'rgba(237,240,247,0.78)', fontSize: 13 }}>
                      {tt('Språk', 'Language')}
                    </Typography>
                    <Select
                      fullWidth
                      size="small"
                      value={settings.locale}
                      renderValue={(value) => {
                        const option = localeOptions.find((entry) => entry.value === value);
                        return (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography component="span" sx={{ fontSize: 18, lineHeight: 1 }}>
                              {option?.flag || '🌐'}
                            </Typography>
                            <Typography component="span" sx={{ color: '#edf0f7' }}>
                              {tt(option?.labelNo || String(value), option?.labelEn || String(value))}
                            </Typography>
                          </Stack>
                        );
                      }}
                      onChange={(event) =>
                        setSettings((prev) => ({ ...prev, locale: event.target.value as UserSettingsState['locale'] }))
                      }
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(11,14,22,0.82)',
                        '& .MuiSelect-select': {
                          color: '#edf0f7 !important',
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.16)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(248,179,33,0.4)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(248,179,33,0.7)',
                        },
                        '& .MuiSvgIcon-root': {
                          color: 'rgba(237,240,247,0.72)',
                        },
                      }}
                    >
                      {localeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography component="span" sx={{ fontSize: 18, lineHeight: 1 }}>
                              {option.flag}
                            </Typography>
                            <Typography component="span">
                              {tt(option.labelNo, option.labelEn)}
                            </Typography>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                  <Stack spacing={1}>
                    <Typography sx={{ color: 'rgba(237,240,247,0.9)', fontWeight: 700 }}>
                      {tt('Academy workflow', 'Academy workflow')}
                    </Typography>
                    <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 12.5 }}>
                      {tt(
                        'Velg standard arbeidsflyt på tvers av annotering, CTA, lower thirds, quiz og presentasjon.',
                        'Choose your default workflow across annotation, CTA, lower thirds, quiz, and presentation.',
                      )}
                    </Typography>
                  </Stack>
                  <Box>
                    <Typography sx={{ mb: 0.8, color: 'rgba(237,240,247,0.78)', fontSize: 13 }}>
                      {tt('Standard modus', 'Default mode')}
                    </Typography>
                    <Select
                      fullWidth
                      size="small"
                      value={settings.academyPreferredMode}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          academyPreferredMode: event.target.value as UserSettingsState['academyPreferredMode'],
                        }))
                      }
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(11,14,22,0.82)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.16)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(248,179,33,0.4)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(248,179,33,0.7)',
                        },
                        '& .MuiSvgIcon-root': {
                          color: 'rgba(237,240,247,0.72)',
                        },
                      }}
                    >
                      <MenuItem value="simple">{tt('Enkel (anbefalt)', 'Simple (recommended)')}</MenuItem>
                      <MenuItem value="pro">{tt('Pro (avansert)', 'Pro (advanced)')}</MenuItem>
                    </Select>
                  </Box>
                  <Box>
                    <Typography sx={{ mb: 0.8, color: 'rgba(237,240,247,0.78)', fontSize: 13 }}>
                      {tt('Standard “Jeg vil lage …”', 'Default "I want to create ..."')}
                    </Typography>
                    <Select
                      fullWidth
                      size="small"
                      value={settings.academyDefaultIntent}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          academyDefaultIntent: event.target.value as AcademyWorkflowIntentId,
                        }))
                      }
                      sx={{
                        color: '#edf0f7',
                        bgcolor: 'rgba(11,14,22,0.82)',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.16)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(248,179,33,0.4)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(248,179,33,0.7)',
                        },
                        '& .MuiSvgIcon-root': {
                          color: 'rgba(237,240,247,0.72)',
                        },
                      }}
                    >
                      {ACADEMY_WORKFLOW_INTENTS.map((intent) => (
                        <MenuItem key={intent.id} value={intent.id}>
                          {tt(intent.labelNo, intent.labelEn)}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.academyShowQuickStart}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, academyShowQuickStart: event.target.checked }))
                        }
                      />
                    }
                    label={tt('Vis hurtigstart-kort i verktøyene', 'Show quick-start cards in tools')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.academyShowNextAction}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, academyShowNextAction: event.target.checked }))
                        }
                      />
                    }
                    label={tt('Vis “Neste handling”-knapp', 'Show "Next action" button')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.academyMicroHintsEnabled}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, academyMicroHintsEnabled: event.target.checked }))
                        }
                      />
                    }
                    label={tt('Vis kontekstuelle mikro-hints', 'Show contextual micro-hints')}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.desktopNotifications}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, desktopNotifications: event.target.checked }))
                        }
                      />
                    }
                    label={tt('Skrivebordsvarsler', 'Desktop notifications')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.productUpdates}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, productUpdates: event.target.checked }))
                        }
                      />
                    }
                    label={tt('Produktoppdateringer', 'Product updates')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.marketingEmails}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, marketingEmails: event.target.checked }))
                        }
                      />
                    }
                    label={tt('Markedsførings-e-post', 'Marketing emails')}
                  />
                </Stack>
              </Box>

              <Box sx={{ ...panelSx, p: 2, gridColumn: '1 / -1' }}>
                <Stack spacing={1.4}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Security />
                    <Typography sx={{ fontWeight: 700 }}>{tt('Sikkerhet', 'Security')}</Typography>
                  </Stack>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.twoFactorAuth}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, twoFactorAuth: event.target.checked }))
                        }
                      />
                    }
                    label={tt('Aktiver tofaktor-autentisering', 'Enable two-factor authentication')}
                  />
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                  <Typography sx={{ color: 'rgba(237,240,247,0.72)', fontSize: 13 }}>
                    {tt(
                      'Endringer lagres lokalt i nettleseren i utviklingsmodus.',
                      'Changes are saved locally in the browser in development mode.',
                    )}
                  </Typography>
                </Stack>
              </Box>

              {saveMessage ? (
                <Box sx={{ ...panelSx, p: 1.4, gridColumn: '1 / -1' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CheckCircleOutline sx={{ color: '#8fcb6d' }} />
                    <Typography sx={{ color: 'rgba(237,240,247,0.92)' }}>{saveMessage}</Typography>
                  </Stack>
                </Box>
              ) : null}

              <Box
                sx={{
                  gridColumn: '1 / -1',
                  display: { xs: 'flex', xl: 'none' },
                  flexDirection: 'column',
                  gap: 1.4,
                }}
              >
                {sideCards}
              </Box>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            display: { xs: 'none', xl: 'flex' },
            flexDirection: 'column',
            gap: 1.4,
            p: 1.6,
            borderLeft: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(10,12,20,0.9), rgba(8,11,18,0.94))',
          }}
        >
          {sideCards}
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyUserSettingsStudio, {
  componentId: 'academy-user-settings-studio',
  componentName: 'Academy User Settings Studio',
  componentType: 'settings',
  componentCategory: 'academy',
  featureIds: ['academy-user-settings', 'academy-profile-preferences', 'academy-account-security'],
});

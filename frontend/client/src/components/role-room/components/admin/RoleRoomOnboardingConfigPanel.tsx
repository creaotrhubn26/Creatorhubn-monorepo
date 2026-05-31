/**
 * RoleRoomOnboardingConfigPanel — admin-UI for å konfigurere onboarding-wizarden
 * som nye Role Room-medlemmer ser ved første innlogging.
 *
 * Admin kan:
 *   - Endre velkomstmelding
 *   - Skru av enkeltsteg
 *   - Markere felt som påkrevd eller valgfri
 *   - Redigere lister: profesjoner, ferdigheter, språk
 *   - Tilbakestille til defaults
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, FormControlLabel,
  IconButton, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { Add, Close, RestartAlt, Save } from '@mui/icons-material';
import {
  roleRoomMemberProfileService,
} from '../../services/roleRoomMemberProfileService';
import type {
  OnboardingConfig,
} from '../../services/roleRoomMemberProfileService';

const STEP_LABELS: Record<string, string> = {
  welcome: 'Velkommen + visningsnavn',
  image: 'Profilbilde',
  profession: 'Profesjon + ferdigheter',
  about: 'Om meg + lokasjon + språk',
  links: 'Lenker',
  privacy: 'Personvern + fullfør',
};

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  displayName: 'Visningsnavn påkrevd',
  professions: 'Minst én profesjon påkrevd',
  bio: 'Om meg påkrevd',
  profileImage: 'Profilbilde påkrevd',
};

const STEP_KEYS = ['welcome', 'image', 'profession', 'about', 'links', 'privacy'] as const;
const REQUIRED_KEYS = ['displayName', 'professions', 'bio', 'profileImage'] as const;

export function RoleRoomOnboardingConfigPanel() {
  const [config, setConfig] = useState<OnboardingConfig | null>(null);
  const [defaults, setDefaults] = useState<OnboardingConfig | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [newProfession, setNewProfession] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangName, setNewLangName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await roleRoomMemberProfileService.adminGetOnboardingConfig();
        if (cancelled) return;
        setConfig(res.config);
        setDefaults(res.defaults);
        setUpdatedAt(res.updatedAt);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const patch = <K extends keyof OnboardingConfig>(key: K, value: OnboardingConfig[K]) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!config) return;
    setSaving(true); setError(null); setOkMsg(null);
    try {
      const res = await roleRoomMemberProfileService.adminUpdateOnboardingConfig(config);
      setConfig(res.config);
      setOkMsg('Lagret');
      setTimeout(() => setOkMsg(null), 2500);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm('Tilbakestille all onboarding-konfig til defaults?')) return;
    setSaving(true); setError(null);
    try {
      const res = await roleRoomMemberProfileService.adminResetOnboardingConfig();
      setConfig(res.config);
      setOkMsg('Tilbakestilt');
      setTimeout(() => setOkMsg(null), 2500);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!config) {
    return <Alert severity="error" sx={{ m: 3 }}>{error ?? 'Kunne ikke laste konfig'}</Alert>;
  }

  return (
    <Box sx={{ p: 3, overflow: 'auto', flex: 1, color: 'rgba(255,255,255,0.87)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Onboarding-konfig</Typography>
          <Typography variant="caption" color="rgba(255,255,255,0.6)">
            Styrer hva nye Role Room-medlemmer ser i første-gangs-veiviseren.
            {updatedAt && ` · Sist endret ${new Date(updatedAt).toLocaleString('nb-NO')}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RestartAlt />} onClick={reset} disabled={saving}
                  sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Tilbakestill
          </Button>
          <Button startIcon={saving ? <CircularProgress size={14} /> : <Save />}
                  onClick={save} disabled={saving}
                  variant="contained" sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}>
            Lagre
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {okMsg && <Alert severity="success" sx={{ mb: 2 }}>{okMsg}</Alert>}

      <Stack spacing={4}>
        <Section title="Velkomstmelding">
          <TextField
            multiline rows={3} fullWidth
            value={config.welcomeMessage}
            onChange={(e) => patch('welcomeMessage', e.target.value)}
            sx={textFieldDarkSx}
          />
        </Section>

        <Section title="Aktive steg" subtitle="Skru av steg som ikke trengs.">
          <Stack>
            {STEP_KEYS.map((key) => {
              const enabled = config.stepsEnabled?.[key] !== false;
              return (
                <FormControlLabel
                  key={key}
                  control={
                    <Switch
                      checked={enabled}
                      onChange={(_, v) => patch('stepsEnabled', { ...config.stepsEnabled, [key]: v })}
                    />
                  }
                  label={<Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>{STEP_LABELS[key]}</Typography>}
                />
              );
            })}
          </Stack>
        </Section>

        <Section title="Påkrevde felt" subtitle="Brukeren kan ikke gå videre uten å fylle ut disse.">
          <Stack>
            {REQUIRED_KEYS.map((key) => (
              <FormControlLabel
                key={key}
                control={
                  <Switch
                    checked={config.requiredFields?.[key] === true}
                    onChange={(_, v) => patch('requiredFields', { ...config.requiredFields, [key]: v })}
                  />
                }
                label={<Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>{REQUIRED_FIELD_LABELS[key]}</Typography>}
              />
            ))}
          </Stack>
        </Section>

        <Section title="Profesjoner" subtitle="Vises som klikkbare chips i steg 3.">
          <ChipEditor
            items={config.professionsOptions}
            onChange={(next) => patch('professionsOptions', next)}
            newValue={newProfession}
            setNewValue={setNewProfession}
            placeholder="Legg til profesjon …"
          />
        </Section>

        <Section title="Ferdigheter" subtitle="Forslag — brukere kan også skrive egne (i fremtidig versjon).">
          <ChipEditor
            items={config.skillsOptions}
            onChange={(next) => patch('skillsOptions', next)}
            newValue={newSkill}
            setNewValue={setNewSkill}
            placeholder="Legg til ferdighet …"
          />
        </Section>

        <Section title="Språk" subtitle="ISO-kode + visningsnavn. Default-forvalg i wizarden er 'no'.">
          <Stack spacing={1}>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {config.languageOptions.map((lang) => (
                <Chip
                  key={lang.code}
                  label={`${lang.name} (${lang.code})`}
                  onDelete={() => patch('languageOptions', config.languageOptions.filter((l) => l.code !== lang.code))}
                  sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: 'rgba(255,255,255,0.87)' }}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <TextField size="small" placeholder="kode (no)" value={newLangCode}
                         onChange={(e) => setNewLangCode(e.target.value.toLowerCase().slice(0, 5))}
                         sx={{ ...textFieldDarkSx, width: 110 }} />
              <TextField size="small" placeholder="Navn (Norsk)" value={newLangName}
                         onChange={(e) => setNewLangName(e.target.value)}
                         sx={{ ...textFieldDarkSx, flex: 1 }} />
              <IconButton
                disabled={!newLangCode.trim() || !newLangName.trim()
                  || config.languageOptions.some((l) => l.code === newLangCode.trim())}
                onClick={() => {
                  patch('languageOptions', [
                    ...config.languageOptions,
                    { code: newLangCode.trim(), name: newLangName.trim() },
                  ]);
                  setNewLangCode(''); setNewLangName('');
                }}
                sx={{ color: '#8b5cf6' }}
              >
                <Add />
              </IconButton>
            </Stack>
          </Stack>
        </Section>

        {defaults && (
          <Box sx={{ pt: 2, opacity: 0.6 }}>
            <Typography variant="caption">
              Tips: "Tilbakestill" gjenoppretter alle felter til original-defaults
              ({defaults.professionsOptions.length} profesjoner, {defaults.skillsOptions.length} ferdigheter,
              {' '}{defaults.languageOptions.length} språk).
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>{title}</Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', display: 'block', mb: 1.5 }}>
          {subtitle}
        </Typography>
      )}
      {children}
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mt: 3 }} />
    </Box>
  );
}

function ChipEditor({ items, onChange, newValue, setNewValue, placeholder }: {
  items: string[];
  onChange: (next: string[]) => void;
  newValue: string;
  setNewValue: (v: string) => void;
  placeholder: string;
}) {
  const add = () => {
    const v = newValue.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setNewValue('');
  };
  return (
    <Stack spacing={1}>
      <Stack direction="row" flexWrap="wrap" gap={0.75}>
        {items.map((item) => (
          <Chip
            key={item}
            label={item}
            onDelete={() => onChange(items.filter((i) => i !== item))}
            deleteIcon={<Close />}
            sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: 'rgba(255,255,255,0.87)' }}
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
        <TextField
          size="small" placeholder={placeholder} value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          sx={{ ...textFieldDarkSx, flex: 1 }}
        />
        <IconButton onClick={add} disabled={!newValue.trim()} sx={{ color: '#8b5cf6' }}>
          <Add />
        </IconButton>
      </Stack>
    </Stack>
  );
}

const textFieldDarkSx = {
  '& .MuiOutlinedInput-root': {
    color: 'rgba(255,255,255,0.87)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
} as const;

export default RoleRoomOnboardingConfigPanel;

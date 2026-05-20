/**
 * IndustryTemplatePicker — bransje-spesifikke achievement-eksempler.
 *
 * Brukerflyt:
 *   1. Bruker velger bransje fra liste (10 bransjer)
 *   2. Velger rolle innen bransjen
 *   3. Ser 5-6 pre-fylte achievements
 *   4. Klikker enkelte for å sette inn — eller "Sett inn alle"
 *   5. Komponenten kaller `onInsertAchievements(strings)`
 *
 * Designprinsipper:
 *   • Eksemplene er starter — bruker oppfordres til å tilpasse med
 *     egne tall og kontekst
 *   • Velger man hele settet får man hele lerretet å tilpasse,
 *     ikke et tomt ark
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, Paper, Chip, IconButton,
  TextField, MenuItem, Alert, Checkbox,
} from '@mui/material';
import {
  Close as CloseIcon,
  AddCircle as AddCircleIcon,
  Lightbulb as LightbulbIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { INDUSTRY_TEMPLATES, type Industry, type IndustryRole } from './industryTemplates';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Setter inn valgte achievements i CV-en */
  onInsertAchievements?: (achievements: string[]) => void;
  /** Foreslår ferdigheter for hele bransjen */
  onInsertSkills?: (skills: string[]) => void;
  /** Foreslår stillingstittel */
  onInsertJobTitle?: (title: string) => void;
}

export const IndustryTemplatePicker: React.FC<Props> = ({
  open, onClose, onInsertAchievements, onInsertSkills, onInsertJobTitle,
}) => {
  const [selectedIndustryKey, setSelectedIndustryKey] = useState<string>(INDUSTRY_TEMPLATES[0].key);
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>(INDUSTRY_TEMPLATES[0].roles[0].key);
  const [checkedAchievements, setCheckedAchievements] = useState<Set<number>>(new Set());

  const industry: Industry | undefined = useMemo(
    () => INDUSTRY_TEMPLATES.find((i) => i.key === selectedIndustryKey),
    [selectedIndustryKey],
  );
  const role: IndustryRole | undefined = useMemo(
    () => industry?.roles.find((r) => r.key === selectedRoleKey),
    [industry, selectedRoleKey],
  );

  const handleIndustryChange = (key: string) => {
    setSelectedIndustryKey(key);
    const ind = INDUSTRY_TEMPLATES.find((i) => i.key === key);
    if (ind && ind.roles[0]) setSelectedRoleKey(ind.roles[0].key);
    setCheckedAchievements(new Set());
    trackGA4('nextrole_industry_template_browsed', { industry: key });
  };

  const handleRoleChange = (key: string) => {
    setSelectedRoleKey(key);
    setCheckedAchievements(new Set());
  };

  const toggleAchievement = (idx: number) => {
    setCheckedAchievements((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleInsertSelected = () => {
    if (!role || checkedAchievements.size === 0) return;
    const picks = [...checkedAchievements]
      .sort((a, b) => a - b)
      .map((i) => role.achievements[i])
      .filter(Boolean);
    onInsertAchievements?.(picks);
    trackGA4('nextrole_industry_template_inserted', {
      industry: selectedIndustryKey,
      role: selectedRoleKey,
      count: picks.length,
    });
    onClose();
  };

  const handleInsertAll = () => {
    if (!role) return;
    onInsertAchievements?.([...role.achievements]);
    trackGA4('nextrole_industry_template_inserted_all', {
      industry: selectedIndustryKey,
      role: selectedRoleKey,
      count: role.achievements.length,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LightbulbIcon sx={{ color: '#F5B82E' }} />
          <Typography variant="h6">Bransje-eksempler</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info" icon={<TuneIcon />}>
            Velg bransje og rolle for å se eksempler på sterke achievement-bullets.
            Tilpass dem med dine egne tall og kontekst etter du har satt dem inn.
          </Alert>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="Bransje"
              value={selectedIndustryKey}
              onChange={(e) => handleIndustryChange(e.target.value)}
              fullWidth
              size="small"
            >
              {INDUSTRY_TEMPLATES.map((i) => (
                <MenuItem key={i.key} value={i.key}>{i.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Rolle"
              value={selectedRoleKey}
              onChange={(e) => handleRoleChange(e.target.value)}
              fullWidth
              size="small"
              disabled={!industry || industry.roles.length === 0}
            >
              {(industry?.roles ?? []).map((r) => (
                <MenuItem key={r.key} value={r.key}>{r.label}</MenuItem>
              ))}
            </TextField>
          </Stack>

          {industry && (
            <Typography variant="caption" color="text.secondary">
              {industry.description}
            </Typography>
          )}

          {role && (
            <>
              {/* Eksempel-stillingstittel */}
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#FAF7F0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#7A5A0B' }}>
                      EKSEMPEL-STILLING
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {role.exampleTitle}
                    </Typography>
                  </Box>
                  {onInsertJobTitle && (
                    <Button
                      size="small"
                      onClick={() => {
                        onInsertJobTitle(role.exampleTitle);
                        trackGA4('nextrole_industry_template_title_used');
                      }}
                    >
                      Bruk denne
                    </Button>
                  )}
                </Stack>
              </Paper>

              {/* Achievement-liste */}
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
                  ACHIEVEMENT-EKSEMPLER (huk av de du vil sette inn)
                </Typography>
                <Stack spacing={1}>
                  {role.achievements.map((a, i) => {
                    const checked = checkedAchievements.has(i);
                    return (
                      <Paper
                        key={i}
                        variant="outlined"
                        onClick={() => toggleAchievement(i)}
                        sx={{
                          p: 1.5,
                          display: 'flex',
                          gap: 1,
                          cursor: 'pointer',
                          bgcolor: checked ? '#FFF8E1' : '#fff',
                          borderColor: checked ? '#F5B82E' : 'divider',
                          '&:hover': { borderColor: '#F5B82E' },
                        }}
                      >
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleAchievement(i)}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                          sx={{ p: 0.4 }}
                        />
                        <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                          {a}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>

              {/* Ferdighets-forslag */}
              {industry && industry.suggestedSkills.length > 0 && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      FORESLÅTTE FERDIGHETER FOR {industry.label.toUpperCase()}
                    </Typography>
                    {onInsertSkills && (
                      <Button
                        size="small"
                        startIcon={<AddCircleIcon />}
                        onClick={() => {
                          onInsertSkills(industry.suggestedSkills);
                          trackGA4('nextrole_industry_template_skills_used', {
                            industry: selectedIndustryKey,
                            count: industry.suggestedSkills.length,
                          });
                        }}
                      >
                        Legg alle til
                      </Button>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {industry.suggestedSkills.map((s) => (
                      <Chip
                        key={s}
                        label={s}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22, fontSize: 11 }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
        <Button onClick={handleInsertAll} disabled={!role}>
          Sett inn alle ({role?.achievements.length ?? 0})
        </Button>
        <Button
          variant="contained"
          startIcon={<AddCircleIcon />}
          onClick={handleInsertSelected}
          disabled={checkedAchievements.size === 0}
          sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
        >
          Sett inn valgte ({checkedAchievements.size})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IndustryTemplatePicker;

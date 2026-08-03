import React from 'react';
import { ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import { useT } from './index';

/** Kompakt NO/EN-språkvelger. Lagres i localStorage; flipper hele UI-et live. */
export const LanguageSwitcher: React.FC<{ size?: 'small' | 'medium' }> = ({ size = 'small' }) => {
  const { lang, setLang, t } = useT();
  return (
    <Tooltip title={t('lang.switch')}>
      <ToggleButtonGroup
        exclusive
        size={size}
        value={lang}
        onChange={(_, value) => { if (value === 'no' || value === 'en') setLang(value); }}
        aria-label={t('lang.switch')}
      >
        <ToggleButton value="no" sx={{ px: 1, py: 0.25, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>NO</ToggleButton>
        <ToggleButton value="en" sx={{ px: 1, py: 0.25, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>EN</ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
};

export default LanguageSwitcher;

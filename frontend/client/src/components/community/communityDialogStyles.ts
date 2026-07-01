import type { SxProps, Theme } from '@mui/material/styles';

export const COMMUNITY_DIALOG_ACCENT = '#ff8c00';
export const COMMUNITY_DIALOG_ACCENT_BRIGHT = '#ffd27a';
export const COMMUNITY_DIALOG_TEXT = 'rgba(255, 255, 255, 0.94)';
export const COMMUNITY_DIALOG_MUTED = 'rgba(255, 255, 255, 0.66)';
export const COMMUNITY_DIALOG_BORDER = '1px solid rgba(255,255,255,0.08)';
export const COMMUNITY_DIALOG_BG = `
  radial-gradient(circle at top right, rgba(255, 140, 0, 0.18), transparent 28%),
  radial-gradient(circle at bottom left, rgba(88, 122, 168, 0.16), transparent 30%),
  linear-gradient(180deg, #0a0f1a 0%, #091019 52%, #06080c 100%)
`;

export const COMMUNITY_DIALOG_SX: SxProps<Theme> = {
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(4, 6, 10, 0.76)',
    backdropFilter: 'blur(12px)',
  },
};

export const COMMUNITY_DIALOG_PAPER_SX: SxProps<Theme> = {
  borderRadius: { xs: 3, md: 4 },
  background: COMMUNITY_DIALOG_BG,
  color: COMMUNITY_DIALOG_TEXT,
  border: COMMUNITY_DIALOG_BORDER,
  boxShadow: '0 36px 90px rgba(0, 0, 0, 0.56)',
  overflow: 'hidden',
};

export const COMMUNITY_DIALOG_TITLE_SX: SxProps<Theme> = {
  position: 'relative',
  px: { xs: 2.5, md: 3 },
  py: 2.5,
  background: 'linear-gradient(180deg, rgba(13, 18, 27, 0.96), rgba(9, 13, 20, 0.92))',
  borderBottom: COMMUNITY_DIALOG_BORDER,
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    background:
      'radial-gradient(circle, rgba(255, 140, 0, 0.24) 0%, rgba(255, 140, 0, 0) 70%)',
    pointerEvents: 'none',
  },
};

export const COMMUNITY_DIALOG_CONTENT_SX: SxProps<Theme> = {
  px: { xs: 2.5, md: 3 },
  py: { xs: 2.5, md: 3 },
  background: 'linear-gradient(180deg, rgba(8, 12, 18, 0.28), rgba(5, 7, 11, 0.72))',
  color: COMMUNITY_DIALOG_TEXT,
  '&.MuiDialogContent-dividers': {
    borderTop: COMMUNITY_DIALOG_BORDER,
    borderBottom: COMMUNITY_DIALOG_BORDER,
  },
  '& .MuiTypography-root': {
    color: COMMUNITY_DIALOG_TEXT,
  },
  '& .MuiTypography-body2, & .MuiTypography-caption': {
    color: COMMUNITY_DIALOG_MUTED,
  },
  '& .MuiDivider-root': {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  '& .MuiAlert-root': {
    borderRadius: 3,
    border: COMMUNITY_DIALOG_BORDER,
    boxShadow: '0 18px 36px rgba(0, 0, 0, 0.18)',
  },
  '& .MuiAlert-standardInfo': {
    bgcolor: 'rgba(88, 122, 168, 0.16)',
    borderColor: 'rgba(88, 122, 168, 0.28)',
  },
  '& .MuiAlert-standardSuccess': {
    bgcolor: 'rgba(120, 214, 163, 0.12)',
    borderColor: 'rgba(120, 214, 163, 0.24)',
  },
  '& .MuiAlert-standardWarning': {
    bgcolor: 'rgba(244, 179, 94, 0.12)',
    borderColor: 'rgba(244, 179, 94, 0.24)',
  },
  '& .MuiAlert-standardError': {
    bgcolor: 'rgba(255, 142, 131, 0.12)',
    borderColor: 'rgba(255, 142, 131, 0.24)',
  },
  '& .MuiChip-root': {
    borderRadius: 999,
    color: COMMUNITY_DIALOG_TEXT,
    border: '1px solid rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  '& .MuiPaper-root:not(.MuiDialog-paper)': {
    color: COMMUNITY_DIALOG_TEXT,
  },
};

export const COMMUNITY_DIALOG_ACTIONS_SX: SxProps<Theme> = {
  px: { xs: 2.5, md: 3 },
  py: 2.25,
  background: 'linear-gradient(180deg, rgba(8, 12, 18, 0.88), rgba(5, 7, 11, 0.96))',
  borderTop: COMMUNITY_DIALOG_BORDER,
  gap: 1.25,
};

export const COMMUNITY_DIALOG_CLOSE_BUTTON_SX: SxProps<Theme> = {
  color: COMMUNITY_DIALOG_TEXT,
  border: '1px solid rgba(255,255,255,0.08)',
  bgcolor: 'rgba(255,255,255,0.04)',
  '&:hover': {
    bgcolor: 'rgba(255, 140, 0, 0.1)',
    borderColor: 'rgba(255, 140, 0, 0.24)',
  },
};

export const COMMUNITY_DIALOG_PRIMARY_BUTTON_SX: SxProps<Theme> = {
  borderRadius: 999,
  px: 2,
  fontWeight: 700,
  color: '#0a0f1a',
  background: `linear-gradient(135deg, ${COMMUNITY_DIALOG_ACCENT} 0%, ${COMMUNITY_DIALOG_ACCENT_BRIGHT} 100%)`,
  boxShadow: '0 18px 30px rgba(0, 0, 0, 0.24)',
  '&:hover': {
    background: 'linear-gradient(135deg, #ffd27a 0%, #ffe1a7 100%)',
  },
};

export const COMMUNITY_DIALOG_SECONDARY_BUTTON_SX: SxProps<Theme> = {
  borderRadius: 999,
  px: 2,
  color: COMMUNITY_DIALOG_MUTED,
  border: '1px solid rgba(255,255,255,0.1)',
  '&:hover': {
    bgcolor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
};

export const COMMUNITY_DIALOG_SURFACE_SX: SxProps<Theme> = {
  borderRadius: 3,
  background: 'linear-gradient(180deg, rgba(18, 24, 34, 0.92), rgba(10, 14, 21, 0.96))',
  border: COMMUNITY_DIALOG_BORDER,
  boxShadow: '0 18px 36px rgba(0, 0, 0, 0.24)',
};

export const COMMUNITY_DIALOG_SURFACE_SUBTLE_SX: SxProps<Theme> = {
  borderRadius: 3,
  background: 'rgba(255,255,255,0.03)',
  border: COMMUNITY_DIALOG_BORDER,
  boxShadow: '0 18px 36px rgba(0, 0, 0, 0.18)',
};

export const COMMUNITY_DIALOG_FIELD_SX: SxProps<Theme> = {
  '& .MuiInputLabel-root': {
    color: COMMUNITY_DIALOG_MUTED,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: COMMUNITY_DIALOG_ACCENT_BRIGHT,
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: 2.5,
    color: COMMUNITY_DIALOG_TEXT,
    backgroundColor: 'rgba(255,255,255,0.03)',
    '& fieldset': {
      borderColor: 'rgba(255,255,255,0.12)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255,255,255,0.18)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'rgba(255, 140, 0, 0.34)',
    },
  },
  '& .MuiInputAdornment-root, & .MuiSvgIcon-root': {
    color: COMMUNITY_DIALOG_MUTED,
  },
  '& .MuiFormHelperText-root': {
    color: COMMUNITY_DIALOG_MUTED,
  },
  '& .MuiSelect-icon': {
    color: COMMUNITY_DIALOG_MUTED,
  },
};

export const COMMUNITY_DIALOG_SWITCH_SX: SxProps<Theme> = {
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: COMMUNITY_DIALOG_ACCENT,
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: COMMUNITY_DIALOG_ACCENT,
  },
};

export const COMMUNITY_DIALOG_TABS_SX: SxProps<Theme> = {
  minHeight: 46,
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: 999,
    backgroundColor: COMMUNITY_DIALOG_ACCENT,
  },
};

export const COMMUNITY_DIALOG_TAB_SX: SxProps<Theme> = {
  minHeight: 46,
  color: COMMUNITY_DIALOG_MUTED,
  '&.Mui-selected': {
    color: COMMUNITY_DIALOG_TEXT,
  },
};

export const COMMUNITY_DIALOG_TOGGLE_GROUP_SX: SxProps<Theme> = {
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 999,
  backgroundColor: 'rgba(255,255,255,0.03)',
  '& .MuiToggleButton-root': {
    border: 0,
    color: COMMUNITY_DIALOG_MUTED,
    px: 1.8,
    '&.Mui-selected': {
      color: '#0a0f1a',
      background: `linear-gradient(135deg, ${COMMUNITY_DIALOG_ACCENT} 0%, ${COMMUNITY_DIALOG_ACCENT_BRIGHT} 100%)`,
    },
  },
};

export const COMMUNITY_DIALOG_EMPTY_STATE_SX: SxProps<Theme> = {
  py: 5,
  textAlign: 'center',
  borderRadius: 3,
  background: 'rgba(255,255,255,0.03)',
  border: COMMUNITY_DIALOG_BORDER,
};

import { createTheme } from "@mui/material/styles";

// Same semantic palette as WorkspaceShell/workspaceTheme.ts.
export const deskColors = {
  bg: "#0a0f1a",
  bgSidebar: "#0b1120",
  panel: "rgba(15,23,42,0.78)",
  panelSolid: "#0f1729",
  panelAlt: "#111c30",
  input: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.07)",
  text: "rgba(255,255,255,0.95)",
  textDim: "rgba(255,255,255,0.62)",
  accent: "#ff8c00",
  accentHover: "#e67e00",
  accentContrast: "#150d05",
} as const;

export const deskTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: deskColors.accent,
      dark: deskColors.accentHover,
      contrastText: deskColors.accentContrast,
    },
    background: {
      default: deskColors.bg,
      paper: deskColors.panelSolid,
    },
    text: {
      primary: deskColors.text,
      secondary: deskColors.textDim,
    },
    divider: deskColors.border,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 700,
          textTransform: "none",
          "&.MuiButton-containedPrimary": {
            boxShadow: "0 10px 28px rgba(255,140,0,0.18)",
            "&:hover": { backgroundColor: deskColors.accentHover },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderColor: deskColors.border,
        },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: deskColors.input,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: deskColors.border,
          },
        },
      },
    },
  },
});

export default deskTheme;

// thumb-entry.tsx — MINIMAL, BACKEND-FRI bootstrap for thumbnail-generering.
//
// Ingen session/auth/query-providere (som gjør /api-kall) — bare MUI-tema + selve
// mal-komponenten. Slik rendrer /_thumb/resume/:id STANDALONE i en headless browser
// uten at backend kjører. Headless-generatoren (backend/scripts/gen-resume-thumbnails)
// trenger da bare frontend oppe.

import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { creatorHubTheme } from './theme/creatorHubTheme';
import ResumeThumbPage from '@/pages/ResumeThumbPage';

export default function ThumbBootstrapApp() {
  const match = window.location.pathname.match(/^\/_thumb\/resume\/([^/?#]+)/);
  const id = match ? decodeURIComponent(match[1]) : '';
  const scheme = new URLSearchParams(window.location.search).get('scheme');

  return (
    <ThemeProvider theme={creatorHubTheme}>
      <CssBaseline />
      <ResumeThumbPage id={id} scheme={scheme} />
    </ThemeProvider>
  );
}

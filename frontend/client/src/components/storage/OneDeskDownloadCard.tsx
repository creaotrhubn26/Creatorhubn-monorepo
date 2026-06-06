/**
 * OneDeskDownloadCard — laste-ned-knapp for Creatorhub One Desk
 * (Mac-companion-app for backup/copy-flyten).
 *
 * Henter siste release fra GitHub som matcher `creatorhub-one-desk-v*`-
 * tag-mønsteret (samme som release-workflow-en oppretter). Detekterer
 * arkitektur fra `navigator.userAgent` så Apple Silicon-brukere får
 * aarch64-bygget by default, Intel-brukere får x86_64.
 *
 * Backend-fri — query går direkte til api.github.com (60 calls/timen
 * unauthenticated, godt nok for sporadiske onboarding-besøk).
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import LaunchIcon from '@mui/icons-material/Launch';
import AppleIcon from '@mui/icons-material/Apple';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface ReleaseData {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  assets: ReleaseAsset[];
}

const REPO = 'creaotrhubn26/Creatorhubn-monorepo';
const TAG_PREFIX = 'creatorhub-one-desk-v';

type Arch = 'aarch64' | 'x86_64' | null;

function detectArch(): Arch {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();
  // Apple Silicon-Mac sender ofte "Intel" i UA (Apple skjuler arkitektur).
  // Bruk userAgentData hvis tilgjengelig (Chromium-baserte browsere):
  const data = (navigator as any).userAgentData;
  if (data?.platform === 'macOS' && data?.architecture === 'arm') return 'aarch64';
  if (data?.platform === 'macOS' && data?.architecture === 'x86') return 'x86_64';
  // Heuristisk fallback: Mac er stort sett Apple Silicon i 2024+
  if (ua.includes('mac')) return 'aarch64';
  return null;
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function OneDeskDownloadCard() {
  const [release, setRelease] = useState<ReleaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Hent siste 20 releases og finn den nyeste som matcher One Desk-tag
        const resp = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`);
        if (!resp.ok) {
          throw new Error(`GitHub API ${resp.status}`);
        }
        const data = (await resp.json()) as ReleaseData[];
        const oneDesk = data.find((r) => r.tag_name?.startsWith(TAG_PREFIX));
        if (cancelled) return;
        setRelease(oneDesk ?? null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const arch = detectArch();
  const aarch64Dmg = release?.assets.find(
    (a) => a.name.includes('darwin-aarch64') && a.name.endsWith('.dmg'),
  );
  const x86Dmg = release?.assets.find(
    (a) => a.name.includes('darwin-x86_64') && a.name.endsWith('.dmg'),
  );
  const primaryDmg = arch === 'x86_64' ? x86Dmg ?? aarch64Dmg : aarch64Dmg ?? x86Dmg;
  const secondaryDmg =
    primaryDmg && primaryDmg === aarch64Dmg ? x86Dmg : aarch64Dmg;

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1 }}>
          <AppleIcon sx={{ fontSize: 36, color: 'text.primary' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Last ned Creatorhub One Desk
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mac-app som håndterer SD-kort-backup, hash-verifisering og
              upload til offsite-bucketen din.
            </Typography>
          </Box>
        </Stack>

        {loading && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Henter siste versjon…
            </Typography>
          </Stack>
        )}

        {error && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Kunne ikke hente siste versjon fra GitHub ({error}). Du kan
            besøke{' '}
            <Link
              href={`https://github.com/${REPO}/releases`}
              target="_blank"
              rel="noopener noreferrer"
            >
              releases-siden
            </Link>{' '}
            manuelt.
          </Alert>
        )}

        {!loading && !error && !release && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Ingen utgivelser ennå. Vi jobber med å publisere første versjon
            — du blir varslet på e-post når den er klar.
          </Alert>
        )}

        {release && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={release.tag_name.replace(TAG_PREFIX, 'v')}
                color="primary"
              />
              <Typography variant="caption" color="text.secondary">
                Publisert{' '}
                {new Date(release.published_at).toLocaleDateString('nb-NO')}
              </Typography>
              <Link
                href={release.html_url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12 }}
              >
                Release-notater <LaunchIcon sx={{ fontSize: 12 }} />
              </Link>
            </Stack>

            {primaryDmg ? (
              <Button
                variant="contained"
                size="large"
                startIcon={<DownloadIcon />}
                href={primaryDmg.browser_download_url}
                sx={{ alignSelf: 'flex-start' }}
              >
                Last ned for Mac
                {primaryDmg.name.includes('aarch64') && ' (Apple Silicon)'}
                {primaryDmg.name.includes('x86_64') && ' (Intel)'}
                {' · '}
                {humanSize(primaryDmg.size)}
              </Button>
            ) : (
              <Alert severity="info">
                Ingen .dmg-fil i denne utgivelsen — sjekk{' '}
                <Link
                  href={release.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  release-siden
                </Link>{' '}
                for alternative formater.
              </Alert>
            )}

            {secondaryDmg && (
              <Link
                href={secondaryDmg.browser_download_url}
                sx={{ fontSize: 13 }}
              >
                Eller last ned{' '}
                {secondaryDmg.name.includes('aarch64')
                  ? 'Apple Silicon-versjonen'
                  : 'Intel-versjonen'}{' '}
                ({humanSize(secondaryDmg.size)})
              </Link>
            )}

            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'divider',
                color: 'text.secondary',
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                Etter installasjon:
              </Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>
                1. Åpne Creatorhub One Desk
                <br />
                2. Logg inn med samme Google-konto
                <br />
                3. Velg prosjekt → sett inn SD-kort → start backup
              </Typography>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

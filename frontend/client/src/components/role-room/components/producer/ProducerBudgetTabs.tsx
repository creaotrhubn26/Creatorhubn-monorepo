/**
 * ProducerBudgetTabs — skiller produksjonsbudsjett fra markedsføringsbudsjett
 * i to tydelige topp-faner i stedet for én lang stablet side.
 *
 * Bakgrunn (Daniels krav 19.07): produksjonsbudsjett (fase-linjer, bemanning,
 * reise, avtaler — kostnaden ved å LAGE innholdet) og markedsføringsbudsjett
 * (annonseforbruk + påslag, budsjett-tak, kampanjer — kostnaden ved å
 * DISTRIBUERE det) er to helt ulike pengestrømmer og skal ikke blandes.
 *
 * Begge holdes montert (display-toggle, ikke unmount) så data ikke re-hentes
 * ved hvert fanebytte og sub-fane-/scroll-posisjon bevares. Når markedsføring
 * ikke er tilgjengelig (produksjonsteam-modus) rendres kun produksjon uten
 * fane-rad.
 */

import { useState, type ReactNode } from 'react';
import { Box, Stack, Tab, Tabs } from '@mui/material';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';

type BudgetKind = 'produksjon' | 'markedsforing';

interface ProducerBudgetTabsProps {
  production: ReactNode;
  /** Markedsføringsdelen — null i produksjonsteam-modus (ingen ads-økonomi). */
  marketing?: ReactNode | null;
}

export default function ProducerBudgetTabs({ production, marketing }: ProducerBudgetTabsProps) {
  const [kind, setKind] = useState<BudgetKind>('produksjon');

  // Ingen markedsføringsøkonomi (produksjonsteam) → ren produksjonsvisning.
  if (!marketing) {
    return <>{production}</>;
  }

  return (
    <Stack spacing={2}>
      <Tabs
        value={kind}
        onChange={(_event, next: BudgetKind) => setKind(next)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          borderBottom: '1px solid rgba(148,163,184,0.18)',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 800,
            fontSize: '0.92rem',
            color: 'rgba(226,232,240,0.78)',
            minHeight: 48,
          },
          '& .Mui-selected': { color: '#f8fafc' },
          '& .MuiTabs-indicator': { backgroundColor: '#34d399', height: 3 },
        }}
      >
        <Tab
          value="produksjon"
          icon={<CurrencyExchangeIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Produksjonsbudsjett"
        />
        <Tab
          value="markedsforing"
          icon={<CampaignOutlinedIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Markedsføringsbudsjett"
        />
      </Tabs>

      {/* Begge montert; skjul den inaktive med display for å bevare state. */}
      <Box sx={{ display: kind === 'produksjon' ? 'block' : 'none' }}>{production}</Box>
      <Box sx={{ display: kind === 'markedsforing' ? 'block' : 'none' }}>{marketing}</Box>
    </Stack>
  );
}

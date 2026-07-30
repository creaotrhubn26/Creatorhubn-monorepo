/**
 * BudgetTemplateStarter — starthjelp for et tomt budsjett (Del A punkt 105/106).
 *
 * QA-observasjonen bak punktet var «0/0/0 på et aktivt prosjekt». Det er ikke
 * en manglende funksjon — budsjettmodulen finnes — men et tomt regneark er en
 * høy terskel. Den som ikke vet hvilke linjer et reklamebudsjett SKAL ha,
 * begynner ikke.
 *
 * Konsekvensen henger sammen med tilskudd: eksporten til finansiør leser de
 * samme linjene. Er budsjettet tomt, blir søknaden en liste med nuller.
 *
 * Designvalg:
 *   - Vises kun når serveren sier at nudgen er relevant (needsOnboarding).
 *     Et helt nytt prosjekt uten aktivitet skal ikke mases på.
 *   - Malen setter beløpene til 0 med vilje. Den sier HVA som skal
 *     budsjetteres, ikke hvor mye — et gjettet kronebeløp ville sett ut som
 *     et estimat noen hadde regnet på.
 *   - Malen som passer prosjekttypen merkes «Anbefalt», men alle vises. Å
 *     skjule de andre ville gjort produktet mer gjettende enn hjelpsomt.
 */

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';

import { apiRequest } from '../../../lib/queryClient';

interface BudgetTemplateSummary {
  id: string;
  templateKey: string;
  name: string;
  description: string | null;
  lineCount: number;
  recommended: boolean;
}

interface BudgetOnboardingState {
  projectId: string;
  projectType: string | null;
  itemCount: number;
  totalEstimate: number;
  needsOnboarding: boolean;
  reason: string;
  templates: BudgetTemplateSummary[];
}

export interface BudgetTemplateStarterProps {
  projectId: string;
  readOnly?: boolean;
  /** Kalles etter at en mal er lagt inn, så linjelista kan hentes på nytt. */
  onApplied?: () => void;
}

export const BudgetTemplateStarter: React.FC<BudgetTemplateStarterProps> = ({
  projectId,
  readOnly = false,
  onApplied,
}) => {
  const queryClient = useQueryClient();

  const stateQuery = useQuery<BudgetOnboardingState>({
    queryKey: ['budget-onboarding', projectId],
    queryFn: async () => {
      const res = await apiRequest(
        `/api/role-room/projects/${projectId}/producer/economy/onboarding`,
      );
      return res.json();
    },
    enabled: Boolean(projectId),
  });

  const applyTemplate = useMutation({
    mutationFn: async (templateKey: string) => {
      const res = await apiRequest(
        `/api/role-room/projects/${projectId}/producer/economy/apply-template`,
        { method: 'POST', body: JSON.stringify({ templateKey }) },
      );
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error ?? 'Kunne ikke bruke malen');
      }
      return res.json() as Promise<{ created: number; skipped: number }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['budget-onboarding', projectId] });
      onApplied?.();
    },
  });

  const state = stateQuery.data;

  // Ingen nudge når budsjettet er i bruk, når prosjektet ennå ikke har
  // aktivitet, eller når brukeren ikke kan skrive uansett.
  if (!state?.needsOnboarding || readOnly || state.templates.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        mb: 2,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: '1px solid rgba(251,191,36,0.34)',
        background: 'linear-gradient(160deg, rgba(251,191,36,0.12) 0%, rgba(15,23,42,0.86) 100%)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
        <AutoAwesomeIcon sx={{ color: '#fcd34d', fontSize: 20 }} />
        <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>
          Start budsjettet fra en mal
        </Typography>
      </Stack>

      <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.9rem', mb: 1.5 }}>
        {state.reason} Malen legger inn linjene med beløp 0 — den sier hva som skal
        budsjetteres, ikke hvor mye. Linjer du allerede har blir stående.
      </Typography>

      {applyTemplate.isError ? (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {applyTemplate.error instanceof Error ? applyTemplate.error.message : 'Kunne ikke bruke malen'}
        </Alert>
      ) : null}

      {applyTemplate.isSuccess ? (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          {`${applyTemplate.data.created} linjer lagt inn`}
          {applyTemplate.data.skipped > 0 ? `, ${applyTemplate.data.skipped} fantes fra før.` : '.'}
        </Alert>
      ) : null}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} flexWrap="wrap" useFlexGap>
        {state.templates.map((template) => (
          <Box
            key={template.templateKey}
            sx={{
              flex: '1 1 240px',
              minWidth: 0,
              p: 1.25,
              borderRadius: 1.5,
              border: template.recommended
                ? '1px solid rgba(252,211,77,0.55)'
                : '1px solid rgba(148,163,184,0.22)',
              background: 'rgba(2,6,23,0.44)',
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem' }}>
                {template.name}
              </Typography>
              {template.recommended ? (
                <Chip
                  size="small"
                  label="Anbefalt"
                  sx={{
                    height: 20,
                    bgcolor: 'rgba(251,191,36,0.2)',
                    color: '#fde68a',
                    fontWeight: 700,
                  }}
                />
              ) : null}
            </Stack>
            {template.description ? (
              <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.8rem', mb: 1 }}>
                {template.description}
              </Typography>
            ) : null}
            <Button
              size="small"
              variant="outlined"
              disabled={applyTemplate.isPending}
              onClick={() => applyTemplate.mutate(template.templateKey)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: '#fde68a',
                borderColor: 'rgba(252,211,77,0.45)',
                '&:hover': { borderColor: 'rgba(252,211,77,0.8)', background: 'rgba(251,191,36,0.08)' },
              }}
            >
              {`Legg inn ${template.lineCount} linjer`}
            </Button>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default BudgetTemplateStarter;

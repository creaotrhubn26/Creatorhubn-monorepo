/**
 * Test-harness for MarketingPlanPanel — brukes av Playwright-spec
 * marketing-plan-ui.spec.ts. Mounter panelet med seedet bootstrap-data
 * og en placeholder-projectId; alle backend-kall mockes via Playwright
 * route()-interception, så harness'en kjører uten DB, uten admin-session,
 * uten ekte API-keys.
 *
 * Konvensjon: bruk `[data-testid="*"]`-attributter for stabile selectors.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import MarketingPlanPanel from './components/role-room/components/producer/MarketingPlanPanel';
import type { RoleRoomAgentProducerBootstrapResult } from './components/role-room/services/roleRoomAgentService';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#0b1226', paper: '#0f172a' },
  },
});

// Seedet bootstrap som tilfredsstiller readiness-gate. companyProfile +
// storyLogicDraft har nok felter til at MarketingPlanPanel mener planen
// kan genereres. Tone-signaler ≥3 og målgruppe ≥1 er kravene.
const SEEDED_BOOTSTRAP: RoleRoomAgentProducerBootstrapResult = {
  researchId: 'test-research-001',
  generatedAt: '2026-05-16T10:00:00Z',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  agreementSuggestions: [],
  socialProfileCandidates: [],
  competitorAnalysis: {
    competitors: [],
    rawCompetitorCandidates: [],
    verifiedCompetitorCount: 0,
    marketingOpportunities: [],
    positioningRecommendations: [],
  } as unknown as RoleRoomAgentProducerBootstrapResult['competitorAnalysis'],
  localPresencePlan: {
    nearbyOpportunities: [],
    recommendedEventConcepts: [],
    hasDataCoverage: false,
    radiusStrategy: [],
  } as unknown as RoleRoomAgentProducerBootstrapResult['localPresencePlan'],
  companyProfile: {
    companyName: 'Holy Crust AS',
    industry: 'Restaurant og servering',
    subIndustry: 'Pizza, takeaway og levering',
    businessModel: 'B2C',
    contentCategory: 'Meny og kampanje',
    productionApproach: 'Produktdrevet restaurantkampanje',
    summary: 'Lokal pizzarestaurant med surdeig-baserte produkter.',
    offerings: ['Surdeigspizza', 'Levering', 'Takeaway'],
    targetAudience: ['Unge urbane par', 'Familier i Oslo sentrum'],
    toneAndBrandSignals: ['Energisk', 'Lokal', 'Autentisk'],
    websiteUrl: 'https://holycrust.no',
    organizationNumber: '933469395',
    probableLocationAddress: 'Storgata 1, 0150 Oslo',
    logoUrl: null,
  },
  intakeDraft: {
    projectGoal: 'Vekst lokalt',
    deliverables: '30-dagers SoMe-plan',
    targetAudience: 'Unge urbane par',
    keyMessage: 'Surdeigspizza som forandrer sammenligningsgrunnlaget',
    timingConstraints: '',
    brandNotes: '',
    materialOverview: '',
    referenceLinks: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    additionalNotes: '',
  },
  planningDraft: {
    activationPlan: {},
    contentLogic: {},
    brandGuide: {
      logoUrl: null,
      toneOfVoice: 'Energisk og appetittvekkende',
      visualStyle: 'Nærgående matfoto med varme detaljer',
      fonts: [],
      dos: [],
      donts: [],
      colors: [
        { label: 'Primær', hex: '#e63946' },
        { label: 'Aksent', hex: '#f1faee' },
      ],
    },
  },
  storyLogicDraft: {
    contentStoryLogic: {
      businessObjective: 'Øke takeaway-bestillinger med 25% neste kvartal',
      audienceProblem: 'Vanskelig å finne god lokal pizza på kort varsel',
      keyPromise: 'Surdeigspizza på 20 minutter via levering',
    },
  } as unknown as RoleRoomAgentProducerBootstrapResult['storyLogicDraft'],
  projectCreationDraft: {
    projectName: 'Holy Crust kampanje',
    description: '',
    projectType: 'campaign',
    clientCompanyName: 'Holy Crust AS',
    clientOrganizationNumber: '933469395',
    clientCompanyAddress: 'Storgata 1, 0150 Oslo',
    location: 'Oslo',
    websiteUrl: 'https://holycrust.no',
    suggestedAgreementNotes: '',
  },
  nextRecommendedSteps: [],
};

function TestHarness(): React.ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        data-testid="marketing-plan-test-root"
        sx={{ p: 2, minHeight: '100vh', bgcolor: '#0b1226' }}
      >
        <MarketingPlanPanel
          projectId="test-project-001"
          bootstrap={SEEDED_BOOTSTRAP}
        />
      </Box>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestHarness />
  </React.StrictMode>,
);

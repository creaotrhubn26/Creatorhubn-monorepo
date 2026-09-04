import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoleRoomAgentProducerBootstrapResult } from '../../services/roleRoomAgentService';
import ResearchCompleteOverlay from './RoleRoomResearchCompleteOverlay';

vi.mock('./SocialProfileCandidatesPreview', () => ({ default: () => null }));
vi.mock('./ResearchDiffSection', () => ({ default: () => null }));
vi.mock('./ResearchFieldProvenancePanel', () => ({ default: () => null }));
vi.mock('./ResearchNextStepsCards', () => ({ default: () => null }));
vi.mock('./ResearchFirstWeekIdeas', () => ({ default: () => null }));
vi.mock('./ResearchValidationFlagsSection', () => ({ default: () => null }));
vi.mock('../../utils/researchExport', () => ({
  exportResearchAsCsv: vi.fn(),
  exportResearchAsJson: vi.fn(),
  exportResearchAsPdf: vi.fn(),
  fetchServerResearchVersion: vi.fn(async () => null),
  recordResearchVersion: vi.fn(() => 1),
}));
vi.mock('../../utils/researchDiff', () => ({
  computeResearchDiff: vi.fn(() => null),
  saveResearchSnapshot: vi.fn(),
}));

const result = {
  researchId: 'research-overlay-test',
  companyProfile: {
    companyName: 'MEDINNOVA AS',
    industry: 'Helseteknologi og programvare',
    targetAudience: ['Leger'],
    toneAndBrandSignals: ['Tydelig', 'Trygg', 'Profesjonell'],
    logoUrl: 'https://medside.no/logo.svg',
  },
  planningDraft: { brandGuide: { colors: [{ hex: '#102A43' }] } },
  competitorAnalysis: { competitors: [] },
  localPresencePlan: { nearbyOpportunities: [] },
  socialProfileCandidates: [],
  merchSuppliers: { suppliers: [] },
  serviceLatencies: { totalMs: 10 },
  fallbacksUsed: [],
  researchSkills: [],
} as unknown as RoleRoomAgentProducerBootstrapResult;

describe('RoleRoomResearchCompleteOverlay', () => {
  it('stays inside the parent focus scope without mounting a nested MUI modal', async () => {
    render(
      <div data-testid="parent-dialog">
        <ResearchCompleteOverlay result={result} projectId="project-1" />
      </div>,
    );

    const overlay = await screen.findByTestId('research-complete-overlay');
    const dialog = screen.getByRole('dialog', { name: 'Research er ferdig' });
    await waitFor(() => expect(document.activeElement).toBe(dialog));

    expect(overlay.contains(dialog)).toBe(true);
    expect(document.querySelector('.MuiModal-root')).toBeNull();
    expect(screen.getByTestId('parent-dialog').hasAttribute('aria-hidden')).toBe(false);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('research-complete-overlay')).toBeNull());
    expect(screen.getByTestId('parent-dialog')).not.toBeNull();
  });
});

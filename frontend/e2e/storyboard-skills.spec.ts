import { expect, test, type Page, type Route } from '@playwright/test';

const skills = [
  ['plan_scene_coverage', 'Coverage'],
  ['audit_visual_continuity', 'Kontinuitet'],
  ['design_shot_variants', 'Varianter'],
  ['translate_artist_marks', 'Artistmerker'],
  ['audit_board_readability', 'Lesbarhet'],
  ['build_animatic_pass', 'Animatic'],
  ['audit_production_feasibility', 'Gjennomføring'],
] as const;

const catalog = skills.map(([id, shortTitle]) => ({
  id,
  version: '1.0.0',
  title: `${shortTitle}-skill`,
  shortTitle,
  description: `Test av ${shortTitle}`,
  scope: ['design_shot_variants', 'translate_artist_marks'].includes(id) ? 'frame' : 'scene',
  icon: id,
  dependsOn: ['frames'],
  outputCapabilities: ['analysis', 'frame-patch'],
  evaluationCriteria: ['evidence'],
  provider: 'local',
  estimatedCostUsd: 0,
}));

function suggestion(skillId: string, status = 'pending') {
  const alternative = skillId === 'design_shot_variants';
  return {
    id: `suggestion-${skillId}`,
    projectId: 'project-e2e',
    suggestionType: 'storyboard.skill-result',
    sourceType: 'scene',
    sourceId: 'scene-e2e',
    agentName: `storyboard.${skillId.replaceAll('_', '-')}`,
    modelVersion: 'local-rules-1.0.0',
    confidence: 0.91,
    status,
    createdAt: '2026-09-12T12:00:00Z',
    updatedAt: '2026-09-12T12:00:00Z',
    payload: {
      contractVersion: 'storyboard-skill-result-v1',
      skillId,
      skillVersion: '1.0.0',
      title: `Resultat: ${skillId}`,
      summary: 'Et strukturert, reversibelt fagforslag.',
      rationale: 'Bygger på eksplisitt scene- og shotdata.',
      confidence: 0.91,
      severity: skillId === 'audit_production_feasibility' ? 'blocking' : 'warning',
      contextFingerprint: 'a'.repeat(64),
      evidence: [{
        id: `evidence-${skillId}`,
        label: 'Konkret evidens',
        detail: 'Shot 1A er kilden til dette forslaget.',
        frameIds: ['frame-e2e'],
      }],
      recommendedChanges: alternative ? [] : [{
        id: `change-${skillId}`,
        operation: 'update-frame',
        frameId: 'frame-e2e',
        label: 'Bruk forslag',
        reason: 'Testbar endring',
        patch: { productionNotes: `Godkjent ${skillId}` },
      }],
      alternatives: alternative ? [{
        id: 'geography',
        title: 'Geografi og blocking',
        tradeoff: 'Tydeligere geografi, mindre intimitet.',
        changes: [{
          id: 'change-variant-geography',
          operation: 'update-frame',
          frameId: 'frame-e2e',
          label: 'Bruk geografivarianten',
          reason: 'Viser blocking',
          patch: { shotType: 'WS', lensMm: 24 },
        }],
      }] : [],
      warnings: [],
      cost: { provider: 'local', estimatedUsd: 0 },
    },
  };
}

async function installApi(page: Page) {
  await page.route('**/api/role-room/projects/project-e2e/storyboard-skills/**', async (route: Route) => {
    const url = route.request().url();
    if (url.endsWith('/catalog')) {
      await route.fulfill({ json: { success: true, data: catalog } });
      return;
    }
    if (url.includes('/suggestions?')) {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    const runMatch = url.match(/storyboard-skills\/([^/]+)\/run$/);
    if (runMatch) {
      await route.fulfill({ status: 201, json: { success: true, data: [suggestion(runMatch[1])] } });
      return;
    }
    const reviewMatch = url.match(/suggestions\/suggestion-([^/]+)\/(accept|reject)$/);
    if (reviewMatch) {
      await route.fulfill({
        json: {
          success: true,
          data: suggestion(reviewMatch[1], reviewMatch[2] === 'accept' ? 'accepted' : 'rejected'),
        },
      });
      return;
    }
    await route.fulfill({ status: 404, json: { error: 'not_found' } });
  });
}

test('all seven storyboard skills run, explain evidence and require review before apply', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await installApi(page);
  await page.goto('/e2e-storyboard-skills.html');

  await expect(page.getByTestId('storyboard-skills-harness-ready')).toHaveText('ready');
  await expect(page.getByTestId('storyboard-skills-panel')).toBeVisible();

  for (const [skillId] of skills) {
    await page.getByTestId(`storyboard-skill-select-${skillId}`).click();
    await page.getByTestId('run-storyboard-skill').click();
    await expect(page.getByTestId('storyboard-skill-result')).toContainText(`Resultat: ${skillId}`);
    await expect(page.getByTestId('storyboard-skill-evidence')).toContainText('Shot 1A');
    await expect(page.getByTestId('storyboard-skills-applied')).toHaveText('[]');
  }

  await page.getByTestId('apply-storyboard-skill').click();
  await expect(page.getByTestId('storyboard-skills-applied')).toContainText(
    'change-audit_production_feasibility',
  );
  await expect(page.getByTestId('storyboard-skills-frames')).toContainText(
    'Godkjent audit_production_feasibility',
  );
  await expect(page.getByText('Forslaget er godkjent og brukt.')).toBeVisible();

  await page.getByTestId('storyboard-skill-select-design_shot_variants').click();
  await page.getByTestId('run-storyboard-skill').click();
  await page.getByTestId('apply-storyboard-skill-alternative-geography').click();
  await expect(page.getByTestId('storyboard-skills-frames')).toContainText('"lensMm":24');
  expect(pageErrors).toEqual([]);
});

test('a failed skill run is visible and cannot mutate the storyboard', async ({ page }) => {
  await page.route('**/api/role-room/projects/project-e2e/storyboard-skills/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/catalog')) {
      await route.fulfill({ json: { success: true, data: catalog } });
    } else if (url.includes('/suggestions?')) {
      await route.fulfill({ json: { success: true, data: [] } });
    } else {
      await route.fulfill({ status: 503, json: { error: 'skill_temporarily_unavailable' } });
    }
  });
  await page.goto('/e2e-storyboard-skills.html');
  await page.getByTestId('run-storyboard-skill').click();
  await expect(page.getByRole('alert')).toContainText('skill_temporarily_unavailable');
  await expect(page.getByTestId('storyboard-skills-applied')).toHaveText('[]');
});

test('an accepted proposal can be retried safely after a client sync failure', async ({ page }) => {
  await installApi(page);
  await page.goto('/e2e-storyboard-skills.html?failApply=1');

  await page.getByTestId('run-storyboard-skill').click();
  await page.getByTestId('apply-storyboard-skill').click();
  await expect(page.getByRole('alert')).toContainText(
    'Forslaget er godkjent, men ble ikke brukt: simulert synkfeil',
  );
  await expect(page.getByTestId('storyboard-skills-applied')).toHaveText('[]');

  await page.getByTestId('retry-storyboard-skill-apply').click();
  await expect(page.getByTestId('storyboard-skills-applied')).toContainText(
    'change-plan_scene_coverage',
  );
  await expect(page.getByText('Det godkjente forslaget er nå brukt.')).toBeVisible();
});

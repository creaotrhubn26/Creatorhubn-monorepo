import { test, expect, type Page } from '@playwright/test';
import { installDemoMock } from './fixtures/demo-mock';

/**
 * E2e-røyktest for Marketing mode (Product Demo Studio). Låser hele kjeden:
 * one-pager-utkast → kvalitets-kritiker → Product Brain (disposisjon + node-kart)
 * → brief → Marketing Director → variant-motor. Tauri mockes via demo-mock;
 * hvert AI-steg mockes innholdsbasert via page.route.
 */

function anthropic(textOrObj: unknown) {
  const text = typeof textOrObj === 'string' ? textOrObj : JSON.stringify(textOrObj);
  return { id: 'x', model: 'claude-sonnet-4-6', content: [{ type: 'text', text }], stop_reason: 'end_turn' };
}

async function setupRoutes(page: Page) {
  await page.route('**/api/post-agent/me', (route) =>
    route.fulfill({ json: { id: 'u1', email: 't@test.no', name: 'Test Bruker', role: 'producer', companyName: 'Testfirma' } }));

  await page.route('**/api/post-agent/anthropic/messages', (route) => {
    const body = route.request().postDataJSON() as { system?: string; messages?: Array<{ content: unknown }> };
    const last = body.messages?.[body.messages.length - 1];
    const c = last?.content;
    const text = typeof c === 'string' ? c : Array.isArray(c) ? (c.find((b: { type?: string }) => b.type === 'text') as { text?: string })?.text ?? '' : '';
    let payload: unknown;

    if (text.includes('Les ut ALL synlig')) {
      payload = anthropic('Hero: Lag demoer raskere. Bevis: sparer 8 t/uke.');
    } else if (text.includes('BEVIS-INVENTAR')) {
      payload = anthropic({
        summary: 'AI-drevet demo-bygger.',
        features: [{ name: 'Auto-scan', solves: 'manuell oppsett', elementLabel: 'Start free trial' }, { name: 'Voiceover', solves: 'innspilling' }],
        proof: [{ claim: 'sparer 8 t/uke', type: 'metric' }],
        sections: [{ label: 'Priser', purpose: 'pakker' }],
      });
    } else if (text.includes('INGEN one-pager')) {
      payload = anthropic('TestMerke\n\nHva det er: AI-demo-bygger.\nFor hvem: markedsførere.\nFunksjoner: Auto-scan, Voiceover.\nBevis: sparer 8 t/uke.\nCTA: Start free trial.');
    } else if (text.includes('Vurder dette one-pager-utkastet')) {
      payload = anthropic({ score: 68, strengths: ['Tydelig hva det er'], weaknesses: ['Svakt bevis', 'Uklar differensiering'], questions: ['Hva koster det?', 'Hvor mange kunder?'] });
    } else if (text.includes('Forbedre dette one-pager-utkastet')) {
      payload = anthropic('TestMerke (forbedret)\n\nHva det er: AI-demo-bygger som sparer 8 t/uke.');
    } else if (text.includes('product brain')) {
      payload = anthropic({
        summary: 'AI-demo-bygger for markedsførere.',
        nodes: [
          { kind: 'feature', text: 'Auto-scan av side', status: 'verified', matchedOn: 'Start free trial' },
          { kind: 'feature', text: 'A/B-testing', status: 'unverified', matchedOn: '' },
          { kind: 'proof', text: 'sparer 8 t/uke', status: 'verified', matchedOn: 'metric' },
          { kind: 'cta', text: 'Start free trial', status: 'verified', matchedOn: '#start' },
          { kind: 'feature', text: 'Mal-bibliotek', status: 'extra', matchedOn: 'live' },
        ],
        coveragePath: [
          { label: 'Lim inn URL', elementLabel: '' },
          { label: 'Generér flow', elementLabel: 'Start free trial' },
          { label: 'CTA', elementLabel: 'Request a demo' },
        ],
        gaps: ['A/B-testing nevnt, ikke funnet på siden'],
        recommendedObjective: 'conversion',
        recommendedFramework: 'pastor',
        reasoning: 'Sterke tall → proof-tung metode.',
      });
    } else if (text.includes('markedsførings-brief')) {
      payload = anthropic({ persona: 'Markedssjef i SMB', jobToBeDone: 'lage demoer raskere', painPoints: ['treg oppsett'], valueProps: ['spar tid'], proof: ['8 t/uke'], objection: 'for dyrt', objective: 'conversion', funnelStage: 'bofu', desiredAction: 'book demo' });
    } else if (text.includes('målrettet markedsførings-demo')) {
      payload = anthropic({ scenes: [
        { title: 'Hook', device: 'macbook', narration: 'Treg demo-bygging stjeler tiden din.', visualInstruction: 'vis Auto-scan', requiredAction: 'Klikk Start', targetIndex: 0, actionType: 'click', hotspot: { x: 0.4, y: 0.3, w: 0.2, h: 0.08 }, overlayText: 'PAS', duration: 6 },
        { title: 'CTA', device: 'macbook', narration: 'Book en demo i dag.', visualInstruction: 'vis CTA', requiredAction: 'Klikk demo', targetIndex: 1, actionType: 'click', overlayText: 'Book demo', duration: 6 },
      ] });
    } else if (text.includes('MÅLRETTET variant')) {
      payload = anthropic({ scenes: [{ index: 0, narration: 'Reels-hook: spar 8 t/uke.', overlayText: '', duration: 5 }, { index: 1, narration: 'Sveip opp.', overlayText: '', duration: 5 }] });
    } else {
      payload = anthropic('{}');
    }
    return route.fulfill({ json: payload });
  });
}

async function gotoMarketing(page: Page) {
  await page.getByPlaceholder('https://example.com').first().fill('theroleroom.com');
  await page.getByText('Generér demo-flow →').click();
  await expect(page.getByText('Demo-flow')).toBeVisible();
  await page.getByText('Marketing').first().click();
  await expect(page.getByRole('heading', { name: 'Marketing mode' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installDemoMock);
  await setupRoutes(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/?test=demo');
});

test('Marketing-fane renderer med brief + mål + metode', async ({ page }) => {
  await gotoMarketing(page);
  await expect(page.getByText('0 · Product Brain')).toBeVisible();
  await expect(page.getByText('1 · Brief')).toBeVisible();
  await expect(page.getByText('2 · Mål & kanal')).toBeVisible();
  // Mål-velger auto-anbefaler metode (objective-dropdown finnes).
  await expect(page.getByText('Hva vil du oppnå? (velger metode automatisk)')).toBeVisible();
});

test('one-pager-utkast fra siden + kvalitets-kritiker', async ({ page }) => {
  await gotoMarketing(page);
  await page.getByText('Ingen one-pager? Lag utkast fra siden').click();
  const ta = page.getByPlaceholder(/Lim inn one-pager/);
  await expect(ta).toHaveValue(/AI-demo-bygger/, { timeout: 15000 });
  // Kvalitets-kritiker scorer utkastet.
  await page.getByRole('button', { name: /Vurder kvalitet/ }).click();
  await expect(page.getByText('Svakt bevis')).toBeVisible({ timeout: 15000 });
  // Forbedre med svar skriver om utkastet.
  await page.getByPlaceholder(/Skriv svarene her/).fill('Pris 990/mnd, 200 kunder.');
  await page.getByRole('button', { name: /Forbedre med svar/ }).click();
  await expect(ta).toHaveValue(/forbedret/, { timeout: 15000 });
});

test('Product Brain: disposisjon + node-kart', async ({ page }) => {
  await gotoMarketing(page);
  await page.getByPlaceholder(/Lim inn one-pager/).fill('AI-demo-bygger. Auto-scan. Sparer 8 t/uke. A/B-testing.');
  await page.getByRole('button', { name: /Bygg tankekart/ }).click();
  // Anbefalt metode + dekningssti + gap.
  await expect(page.getByRole('button', { name: 'Bruk anbefaling' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Hva vi må gjennom (dekningssti)')).toBeVisible();
  await expect(page.getByText(/A\/B-testing nevnt/)).toBeVisible();
  // Bruk anbefaling.
  await page.getByRole('button', { name: 'Bruk anbefaling' }).click();
  // Veksle til node-kart.
  await page.getByRole('button', { name: 'Tankekart', exact: true }).click();
  await expect(page.getByText('dra nodene for å organisere')).toBeVisible();
});

test('Marketing Director genererer målrettet flow + variant', async ({ page }) => {
  await gotoMarketing(page);
  await page.getByPlaceholder('f.eks. markedssjef i SMB-byrå').fill('Markedssjef i SMB');
  await page.getByRole('button', { name: /Generér markedsføringsdemo/ }).click();
  await expect(page.getByText(/scener \(/)).toBeVisible({ timeout: 15000 });
  // Lær-min-stemme-seksjonen dukker opp når scener har manus.
  await expect(page.getByText('4 · Lær min stemme')).toBeVisible();
  // Variant-motor lager et målrettet kutt.
  await page.getByRole('button', { name: 'Generér valgte varianter' }).click();
  await expect(page.getByRole('button', { name: 'Sett som aktiv' }).first()).toBeVisible({ timeout: 15000 });
});

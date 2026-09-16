/**
 * Story Graph — sanntid via falsk /ws-server (page.routeWebSocket):
 * avatarer fra presence-snapshot, markør fra en annen bruker på brettet,
 * valg-ring på node, og reload av grafen ved narrative:graph_changed fra andre.
 */
import { test, expect } from '@playwright/test';
import { installNarrativeMocks, installNarrativeWsMock, getMockGraph } from './helpers/narrativeMocks';

test.describe('Story Graph — sanntid', () => {
  test('presence-avatar, markør, valg-ring og remote reload', async ({ page }) => {
    await page.addInitScript(() => {
      // Harnessen har ingen innlogget bruker; gi sanntidsklienten en identitet.
      window.localStorage.setItem('role_room_auth_token', 'e2e-token');
      window.localStorage.setItem('role_room_auth_session', JSON.stringify({ currentUserId: 'u-e2e', adminUser: { id: 'u-e2e', name: 'Meg Selv', email: 'meg@example.com', role: 'user' } }));
    });
    const ws = await installNarrativeWsMock(page, { peers: [{ clientId: 'c-kari', userId: 'u-kari', name: 'Kari Nordmann', color: '#fbbf24', boardId: 'nbd_1' }] });
    await installNarrativeMocks(page);
    await page.goto('/e2e-test.html?harness=game_studio&harness-project=proj-game-2026&tab=boards');
    await expect(page.getByTestId('narrative-canvas')).toBeVisible({ timeout: 15_000 });

    // Avatar fra snapshot
    await expect(page.getByTestId('narrative-presence-u-kari')).toHaveText('KN');
    await expect(page.getByTestId('narrative-presence')).toHaveAttribute('data-connected', '1');

    // Klienten meldte seg med presence (navn + brett)
    await expect.poll(() => ws.received.some((m) => m.type === 'narrative:presence')).toBe(true);

    // Markør fra Kari på dette brettet
    ws.serverSend({ type: 'narrative:cursor', clientId: 'c-kari', userId: 'u-kari', payload: { boardId: 'nbd_1', x: 300, y: 200 } });
    await expect(page.getByTestId('narrative-cursor-u-kari')).toBeVisible();
    await expect(page.getByTestId('narrative-cursor-u-kari')).toContainText('Kari Nordmann');

    // Kari velger startelementet → ring i hennes farge
    ws.serverSend({ type: 'narrative:selection', clientId: 'c-kari', userId: 'u-kari', payload: { elementIds: ['nel_start'] } });
    await expect.poll(async () => page.getByTestId('narrative-node-nel_start').evaluate((el) => getComputedStyle(el).borderColor)).toBe('rgb(251, 191, 36)');

    // Kari endrer grafen (server-push) → klienten laster på nytt og ser det nye elementet.
    // Posisjonen ligger innenfor synlig viewport: v12 rendrer ikke noder utenfor skjermen
    // (onlyRenderVisibleElements), så en node ved y=400 ville vært hentet, men ikke i DOM.
    const g = getMockGraph(page)!;
    g.elements.push({ id: 'nel_remote', projectId: 'proj-game-2026', boardId: 'nbd_1', kind: 'element', titleHtml: '<p>Fra Kari</p>', contentHtml: '', x: 40, y: 250, width: 260, height: 120, theme: 'blue', coverAssetId: null, customId: null, jumperTargetId: null, branchConditions: [], version: 1, sortOrder: 9, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), i18n: {} });
    ws.serverSend({ type: 'narrative:graph_changed', payload: { kind: 'element', ids: ['nel_remote'], actorUserId: 'u-kari', at: new Date().toISOString() } });
    await expect(page.getByTestId('narrative-node-nel_remote')).toBeVisible();

    // Egen endring (actor = meg) trigger ikke reload: legg til et element i mocken uten å pushe det
    g.elements.push({ ...g.elements[g.elements.length - 1], id: 'nel_silent', titleHtml: '<p>Stille</p>', x: 400, y: 250 });
    ws.serverSend({ type: 'narrative:graph_changed', payload: { kind: 'element', ids: ['nel_silent'], actorUserId: 'u-e2e', at: new Date().toISOString() } });
    await page.waitForTimeout(700);
    await expect(page.getByTestId('narrative-node-nel_silent')).toHaveCount(0);

    // Kari forlater rommet → avataren forsvinner
    ws.serverSend({ type: 'narrative:presence', clientId: 'c-kari', userId: 'u-kari', payload: { left: true } });
    await expect(page.getByTestId('narrative-presence-u-kari')).toHaveCount(0);
  });
});

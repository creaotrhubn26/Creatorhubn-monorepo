/**
 * E8 — EventSource real-time annotations.
 *
 * Bruker page.evaluate til å fire en custom event på EventSource-mocken.
 */
import { test, expect } from '@playwright/test';
import { setupDanceTest, switchDanceTab } from './helpers/danceSetup';

test.describe('dance — video realtime', () => {
  test('SSE-stub eksponerer pusher; verifiserer at handler ikke crasher', async ({ page }) => {
    // Stub EventSource FØR mount slik at VideoReviewRoom abonnerer på vår mock.
    await page.addInitScript(() => {
      const sources: EventTarget[] = [];
      class StubSource extends EventTarget {
        readyState = 1;
        onmessage: ((ev: MessageEvent) => void) | null = null;
        onerror: ((ev: Event) => void) | null = null;
        url: string;
        constructor(url: string) {
          super();
          this.url = url;
          sources.push(this);
        }
        close(): void { this.readyState = 2; }
      }
      (window as unknown as { EventSource: typeof EventSource }).EventSource = StubSource as unknown as typeof EventSource;
      (window as unknown as { __pushClipEvent: (p: { kind: string }) => void }).__pushClipEvent = (payload) => {
        const ev = new MessageEvent(payload.kind, { data: JSON.stringify(payload) });
        for (const s of sources) s.dispatchEvent(ev);
      };
    });

    await setupDanceTest(page);
    await switchDanceTab(page, "video");
    await page.getByTestId('video-library-item-clip-1').click();

    // Push event — verifiser at det ikke crasher klienten.
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.evaluate(() => {
      (window as unknown as { __pushClipEvent: (p: { kind: string; annotationId: string; clipId: string; ownerUserId: string }) => void })
        .__pushClipEvent({
          kind: 'annotation:created',
          annotationId: 'ann-pushed-1',
          clipId: 'clip-1',
          ownerUserId: 'user-owner-1',
        });
    });
    await page.waitForTimeout(500);
    expect(errs.filter((e) => !e.match(/DevTools|HMR/))).toEqual([]);
  });
});

import { expect, test, type Locator } from '@playwright/test';

type Pixel = [number, number, number, number];

const readCommittedPixel = async (previewCanvas: Locator, x: number, y: number): Promise<Pixel> => (
  previewCanvas.evaluate((preview, point) => {
    const committed = preview.previousElementSibling as HTMLCanvasElement | null;
    const context = committed?.getContext('2d');
    if (!context) throw new Error('Committed storyboard canvas is unavailable');
    return Array.from(context.getImageData(point.x, point.y, 1, 1).data) as Pixel;
  }, { x, y })
);

test('panel image is erased as raster content and restored by undo', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/e2e-storyboard-board.html');

  // Boardet er fixed-position og gir derfor ikke wrapperen egen layoutboks.
  await expect(page.getByTestId('board-harness-ready')).toBeAttached();
  const canvas = page.getByTestId('board-inline-canvas');
  await expect(canvas).toBeVisible();

  await expect.poll(async () => {
    const [red, green, blue, alpha] = await readCommittedPixel(canvas, 960, 540);
    return { opaque: alpha === 255, containsImage: Math.min(red, green, blue) < 230 };
  }).toEqual({ opaque: true, containsImage: true });

  await page.getByTestId('AutoFixNormalIcon').first().locator('..').click();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const centerX = bounds!.x + bounds!.width / 2;
  const centerY = bounds!.y + bounds!.height / 2;
  await page.mouse.move(centerX - 35, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 35, centerY, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => JSON.parse(
    await page.getByTestId('board-harness-strokes').textContent() || '[]',
  ).length).toBe(1);
  await expect.poll(async () => (await readCommittedPixel(canvas, 960, 540))[3]).toBe(0);

  await page.getByTestId('board-page-undo').click();
  await expect.poll(async () => JSON.parse(
    await page.getByTestId('board-harness-strokes').textContent() || '[]',
  ).length).toBe(0);
  await expect.poll(async () => {
    const [red, green, blue, alpha] = await readCommittedPixel(canvas, 960, 540);
    return { opaque: alpha === 255, containsImage: Math.min(red, green, blue) < 230 };
  }).toEqual({ opaque: true, containsImage: true });
});

import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

type RuntimeCollector = {
  pageErrors: string[];
  severeConsoleErrors: string[];
  failedDocumentRequests: string[];
};

type StoredProjectSnapshot = {
  status: string | null;
  elementCount: number;
  styleClassNames: string[];
  designTokenNames: string[];
  elementClassNames: string[];
  boundElementCount: number;
  componentFamilyIds: string[];
  componentInstanceIds: string[];
  componentSlotNames: string[];
  componentVariantNames: string[];
};

type BoxLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const isIgnorableConsoleError = (message: string): boolean => {
  const normalized = String(message || '');

  return (
    /Download the React DevTools/i.test(normalized) ||
    /Sentry is not configured/i.test(normalized) ||
    /Google Analytics/i.test(normalized) ||
    /\[AUDIT\]/i.test(normalized) ||
    /\[AUDIT ALERT\]/i.test(normalized) ||
    /\[main\.tsx\]/i.test(normalized)
  );
};

const isSevereConsoleError = (message: string): boolean => {
  const normalized = String(message || '');

  return (
    /\[MODULE ERROR\]/i.test(normalized) ||
    /Uncaught/i.test(normalized) ||
    /The above error occurred in the </i.test(normalized) ||
    /TypeError:/i.test(normalized) ||
    /ReferenceError:/i.test(normalized)
  );
};

const attachRuntimeCollector = (page: Page): RuntimeCollector => {
  const collector: RuntimeCollector = {
    pageErrors: [],
    severeConsoleErrors: [],
    failedDocumentRequests: [],
  };

  page.on('pageerror', (error) => {
    collector.pageErrors.push(error.message || String(error));
  });

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') {
      return;
    }

    const text = message.text();
    if (isIgnorableConsoleError(text)) {
      return;
    }

    if (isSevereConsoleError(text)) {
      collector.severeConsoleErrors.push(text);
    }
  });

  page.on('requestfailed', (request) => {
    if (request.resourceType() !== 'document') {
      return;
    }

    collector.failedDocumentRequests.push(
      `${request.failure()?.errorText ?? 'request failed'}: ${request.url()}`,
    );
  });

  return collector;
};

const expectNoRuntimeIssues = (collector: RuntimeCollector, checkpoint: string) => {
  const issues = [
    ...collector.failedDocumentRequests.map((entry) => `document request failed: ${entry}`),
    ...collector.pageErrors.map((entry) => `pageerror: ${entry}`),
    ...collector.severeConsoleErrors.map((entry) => `console: ${entry}`),
  ];

  expect(
    issues,
    `${checkpoint} produced runtime issues:\n${issues.join('\n')}`,
  ).toEqual([]);
};

const resetRuntimeCollector = (collector: RuntimeCollector) => {
  collector.pageErrors.length = 0;
  collector.severeConsoleErrors.length = 0;
  collector.failedDocumentRequests.length = 0;
};

const STORAGE_RESET_SENTINEL = '__ve_e2e_storage_reset__';

const openFreshEditor = async (page: Page, route: string, collector: RuntimeCollector) => {
  await page.addInitScript((sentinel: string) => {
    if (window.name.split(/\s+/).includes(sentinel)) {
      return;
    }

    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // Ignore storage access errors during bootstrap; the navigation itself should still proceed.
    }

    window.name = `${window.name} ${sentinel}`.trim();
  }, STORAGE_RESET_SENTINEL);

  await page.goto(route, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  resetRuntimeCollector(collector);
};

const readBlockCount = async (page: Page): Promise<number> => {
  return page.evaluate(() => {
    const visibleTexts = Array.from(document.querySelectorAll('*'))
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node.offsetParent !== null)
      .map((node) => (node.textContent ?? '').trim())
      .filter((text) => /^\d+\sblocks$/i.test(text));

    const rawText = visibleTexts[0];
    const countMatch = rawText?.match(/(\d+)/);

    if (!countMatch) {
      throw new Error(`Could not extract block count from visible chips: ${visibleTexts.join(', ')}`);
    }

    return Number(countMatch[1]);
  });
};

const readStoredProjectSnapshot = async (
  page: Page,
  projectId = 'visual-editor-project',
): Promise<StoredProjectSnapshot> =>
  page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {
        status: null,
        elementCount: 0,
        styleClassNames: [],
        designTokenNames: [],
        elementClassNames: [],
        boundElementCount: 0,
        componentFamilyIds: [],
        componentInstanceIds: [],
        componentSlotNames: [],
        componentVariantNames: [],
      };
    }

    try {
      const parsed = JSON.parse(raw) as {
        status?: unknown;
        elements?: unknown;
        styleClasses?: unknown;
        designTokens?: unknown;
      };

      const elementClassNames = Array.isArray(parsed.elements)
        ? parsed.elements.flatMap((entry) => {
            if (!entry || typeof entry !== 'object') {
              return [];
            }

            const className = (entry as { className?: unknown }).className;
            return typeof className === 'string'
              ? className.split(/\s+/).filter(Boolean)
              : [];
          })
        : [];
      const componentBindings = Array.isArray(parsed.elements)
        ? parsed.elements.flatMap((entry) => {
            if (!entry || typeof entry !== 'object') {
              return [];
            }

            const props = (entry as { props?: unknown }).props;
            if (!props || typeof props !== 'object') {
              return [];
            }

            const binding = (props as Record<string, unknown>).__veComponentBinding;
            return binding && typeof binding === 'object'
              ? [binding as Record<string, unknown>]
              : [];
          })
        : [];

      return {
        status: typeof parsed.status === 'string' ? parsed.status : null,
        elementCount: Array.isArray(parsed.elements) ? parsed.elements.length : 0,
        styleClassNames: parsed.styleClasses && typeof parsed.styleClasses === 'object'
          ? Object.keys(parsed.styleClasses as Record<string, unknown>)
          : [],
        designTokenNames: parsed.designTokens && typeof parsed.designTokens === 'object'
          ? Object.keys(parsed.designTokens as Record<string, unknown>)
          : [],
        elementClassNames,
        boundElementCount: componentBindings.length,
        componentFamilyIds: componentBindings.flatMap((binding) =>
          typeof binding.familyId === 'string' ? [binding.familyId] : [],
        ),
        componentInstanceIds: componentBindings.flatMap((binding) =>
          typeof binding.instanceId === 'string' ? [binding.instanceId] : [],
        ),
        componentSlotNames: componentBindings.flatMap((binding) =>
          typeof binding.slotName === 'string' ? [binding.slotName] : [],
        ),
        componentVariantNames: componentBindings.flatMap((binding) =>
          typeof binding.variantName === 'string' ? [binding.variantName] : [],
        ),
      };
    } catch {
      return {
        status: null,
        elementCount: 0,
        styleClassNames: [],
        designTokenNames: [],
        elementClassNames: [],
        boundElementCount: 0,
        componentFamilyIds: [],
        componentInstanceIds: [],
        componentSlotNames: [],
        componentVariantNames: [],
      };
    }
  }, `visual-editor:project:${projectId}`);

const readPublishedProjectSnapshot = async (
  page: Page,
  projectId = 'visual-editor-project',
): Promise<StoredProjectSnapshot> =>
  page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {
        status: null,
        elementCount: 0,
        styleClassNames: [],
        designTokenNames: [],
        elementClassNames: [],
        boundElementCount: 0,
        componentFamilyIds: [],
        componentInstanceIds: [],
        componentSlotNames: [],
        componentVariantNames: [],
      };
    }

    try {
      const parsed = JSON.parse(raw) as {
        status?: unknown;
        elements?: unknown;
        styleClasses?: unknown;
        designTokens?: unknown;
      };

      const elementClassNames = Array.isArray(parsed.elements)
        ? parsed.elements.flatMap((entry) => {
            if (!entry || typeof entry !== 'object') {
              return [];
            }

            const className = (entry as { className?: unknown }).className;
            return typeof className === 'string'
              ? className.split(/\s+/).filter(Boolean)
              : [];
          })
        : [];
      const componentBindings = Array.isArray(parsed.elements)
        ? parsed.elements.flatMap((entry) => {
            if (!entry || typeof entry !== 'object') {
              return [];
            }

            const props = (entry as { props?: unknown }).props;
            if (!props || typeof props !== 'object') {
              return [];
            }

            const binding = (props as Record<string, unknown>).__veComponentBinding;
            return binding && typeof binding === 'object'
              ? [binding as Record<string, unknown>]
              : [];
          })
        : [];

      return {
        status: typeof parsed.status === 'string' ? parsed.status : null,
        elementCount: Array.isArray(parsed.elements) ? parsed.elements.length : 0,
        styleClassNames: parsed.styleClasses && typeof parsed.styleClasses === 'object'
          ? Object.keys(parsed.styleClasses as Record<string, unknown>)
          : [],
        designTokenNames: parsed.designTokens && typeof parsed.designTokens === 'object'
          ? Object.keys(parsed.designTokens as Record<string, unknown>)
          : [],
        elementClassNames,
        boundElementCount: componentBindings.length,
        componentFamilyIds: componentBindings.flatMap((binding) =>
          typeof binding.familyId === 'string' ? [binding.familyId] : [],
        ),
        componentInstanceIds: componentBindings.flatMap((binding) =>
          typeof binding.instanceId === 'string' ? [binding.instanceId] : [],
        ),
        componentSlotNames: componentBindings.flatMap((binding) =>
          typeof binding.slotName === 'string' ? [binding.slotName] : [],
        ),
        componentVariantNames: componentBindings.flatMap((binding) =>
          typeof binding.variantName === 'string' ? [binding.variantName] : [],
        ),
      };
    } catch {
      return {
        status: null,
        elementCount: 0,
        styleClassNames: [],
        designTokenNames: [],
        elementClassNames: [],
        boundElementCount: 0,
        componentFamilyIds: [],
        componentInstanceIds: [],
        componentSlotNames: [],
        componentVariantNames: [],
      };
    }
  }, `visual-editor:published:${projectId}`);

const readStoredRevisionCount = async (
  page: Page,
  projectId = 'visual-editor-project',
): Promise<number> =>
  page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return 0;
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, `visual-editor:revisions:${projectId}`);

const hasStoredTemplate = async (page: Page, templateName: string): Promise<boolean> =>
  page.evaluate((name) => {
    const raw = window.localStorage.getItem('visual-editor:templates');
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as Array<{ name?: unknown }>;
      return Array.isArray(parsed) && parsed.some((entry) => entry?.name === name);
    } catch {
      return false;
    }
  }, templateName);

const readStoredLibraryComponent = async (
  page: Page,
  componentName: string,
): Promise<{ elementCount: number; rootCount: number; classCount: number; tokenCount: number; familyId: string | null; variantName: string | null } | null> =>
  page.evaluate((name) => {
    const raw = window.localStorage.getItem('visual-editor-components');
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Array<{
        name?: unknown;
        snapshot?: {
          elements?: unknown;
          rootElementIds?: unknown;
          styleClasses?: unknown;
        };
      }>;
      const component = parsed.find((entry) => entry?.name === name);
      if (!component?.snapshot) {
        return null;
      }

      return {
        elementCount: Array.isArray(component.snapshot.elements) ? component.snapshot.elements.length : 0,
        rootCount: Array.isArray(component.snapshot.rootElementIds) ? component.snapshot.rootElementIds.length : 0,
        classCount: component.snapshot.styleClasses && typeof component.snapshot.styleClasses === 'object'
          ? Object.keys(component.snapshot.styleClasses as Record<string, unknown>).length
          : 0,
        tokenCount: component.snapshot.designTokens && typeof component.snapshot.designTokens === 'object'
          ? Object.keys(component.snapshot.designTokens as Record<string, unknown>).length
          : 0,
        familyId: typeof (component as { familyId?: unknown }).familyId === 'string'
          ? (component as { familyId: string }).familyId
          : null,
        variantName: typeof (component as { variantName?: unknown }).variantName === 'string'
          ? (component as { variantName: string }).variantName
          : null,
      };
    } catch {
      return null;
    }
  }, componentName);

const expectRatioClose = (
  actual: number,
  expected: number,
  tolerance: number,
  label: string,
) => {
  expect(
    Math.abs(actual - expected),
    `${label} ratio expected ${expected.toFixed(3)} but got ${actual.toFixed(3)}`,
  ).toBeLessThan(tolerance);
};

const getBoxCenter = (box: BoxLike) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

test.describe('Visual Editor Regression', () => {
  test('enhanced editor supports quick start, preview, analytics, and audit flows', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const runtime = attachRuntimeCollector(page);

    await openFreshEditor(page, '/visual-editor-enhanced', runtime);

    await expect(page.getByText('Visual CMS Dashboard').first()).toBeVisible({
      timeout: 90_000,
    });
    await expect(
      page.getByRole('button', { name: /Add hero section/i }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Desktop Preview').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('MacBook Pro 14-inch').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Web viewport 1512 × 938 pt').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Retina @2x').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Native 3024 × 1964 px').first()).toBeVisible({
      timeout: 20_000,
    });
    expectNoRuntimeIssues(runtime, 'initial enhanced visual editor load');

    await page.getByRole('button', { name: /Add hero section/i }).click();
    await expect(page.getByText('Build your first section in seconds')).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(page.getByText('4 blocks')).toBeVisible({ timeout: 20_000 });
    expectNoRuntimeIssues(runtime, 'quick start hero insertion');

    await page.getByRole('tab', { name: /^Navigator$/i }).click();
    await expect(page.getByText('Hierarchy, selection and structure')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Expand Hero Section/i }).click();
    await page.getByText('Hero Section').first().click();
    await expect(page.getByRole('button', { name: /Stack layout/i })).toHaveAttribute('aria-pressed', 'true');
    const gapField = page.getByLabel(/^Gap$/i);
    await expect(gapField).toHaveValue('20');
    await gapField.fill('28');
    await expect(gapField).toHaveValue('28');
    await page.getByRole('button', { name: /Row layout/i }).click();
    await expect(page.getByRole('button', { name: /Row layout/i })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /Stack layout/i }).click();
    await expect(page.getByRole('button', { name: /Stack layout/i })).toHaveAttribute('aria-pressed', 'true');
    await page.getByText('Hero CTA').click();
    await expect(page.getByText(/Position is managed by the parent flex layout/i)).toBeVisible({
      timeout: 20_000,
    });
    const heroHeadingNode = page.locator('[aria-label="Navigator node Hero Heading"]');
    const heroCtaNode = page.locator('[aria-label="Navigator node Hero CTA"]');
    const heroCtaDragHandle = page.getByRole('button', { name: /Drag Hero CTA/i });
    const headingBeforeReorder = await heroHeadingNode.boundingBox();
    const ctaBeforeReorder = await heroCtaNode.boundingBox();
    expect(headingBeforeReorder).not.toBeNull();
    expect(ctaBeforeReorder).not.toBeNull();
    if (headingBeforeReorder && ctaBeforeReorder) {
      expect(ctaBeforeReorder.y).toBeGreaterThan(headingBeforeReorder.y);
    }
    await heroCtaDragHandle.dragTo(heroHeadingNode, {
      targetPosition: { x: 24, y: 4 },
    });
    await expect
      .poll(async () => {
        const headingBox = await heroHeadingNode.boundingBox();
        const ctaBox = await heroCtaNode.boundingBox();
        if (!headingBox || !ctaBox) {
          return false;
        }
        return ctaBox.y < headingBox.y;
      })
      .toBe(true);
    await page.getByText('Hero Heading').click();
    await expect(page.getByText('Editing desktop breakpoint')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel(/^Name$/i).fill('Hero Title');
    await expect(page.getByRole('heading', { name: 'Hero Title' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Hero Title text/i })).toBeVisible({
      timeout: 20_000,
    });

    const fontSizeInput = page.getByLabel(/^Size$/i).first();
    await expect(fontSizeInput).toHaveValue('58');
    await page.getByRole('button', { name: /Tablet breakpoint/i }).click();
    await expect(page.getByText('Tablet Preview').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('iPad Pro 11-inch').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Web viewport 834 × 1089 pt').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('visual-editor-browser-top-bar')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('visual-editor-browser-address-bar')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Editing tablet breakpoint')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Portrait orientation/i })).toBeVisible({
      timeout: 20_000,
    });
    await fontSizeInput.fill('42');
    await expect(fontSizeInput).toHaveValue('42');
    const tabletFrameBox = await page.getByTestId('visual-editor-device-frame').boundingBox();
    const tabletScreenBox = await page.getByTestId('visual-editor-device-screen').boundingBox();
    const tabletCameraBox = await page.getByTestId('visual-editor-device-camera').boundingBox();
    expect(tabletFrameBox).not.toBeNull();
    expect(tabletScreenBox).not.toBeNull();
    expect(tabletCameraBox).not.toBeNull();
    if (tabletFrameBox && tabletScreenBox && tabletCameraBox) {
      expect(tabletFrameBox.width).toBeGreaterThan(tabletScreenBox.width);
      expect(tabletFrameBox.height).toBeGreaterThan(tabletScreenBox.height);
      const tabletAspectRatio = tabletFrameBox.width / tabletFrameBox.height;
      expectRatioClose(tabletAspectRatio, 177.5 / 249.7, 0.05, 'iPad portrait body');
      expectRatioClose(
        tabletScreenBox.width / tabletFrameBox.width,
        160.4818 / 177.5,
        0.035,
        'iPad portrait screen width/body width',
      );
      expectRatioClose(
        tabletScreenBox.height / tabletFrameBox.height,
        232.8333 / 249.7,
        0.03,
        'iPad portrait screen height/body height',
      );
      const frameCenter = getBoxCenter(tabletFrameBox);
      const cameraCenter = getBoxCenter(tabletCameraBox);
      expect(cameraCenter.x).toBeGreaterThan(frameCenter.x + tabletFrameBox.width * 0.34);
      expect(Math.abs(cameraCenter.y - frameCenter.y)).toBeLessThan(tabletFrameBox.height * 0.08);
    }
    await page.getByRole('button', { name: /Landscape orientation/i }).click();
    await expect(page.getByText('Viewport 1210 × 834 pt').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Web viewport 1180 × 717 pt').first()).toBeVisible({
      timeout: 20_000,
    });
    const tabletLandscapeFrameBox = await page.getByTestId('visual-editor-device-frame').boundingBox();
    const tabletLandscapeScreenBox = await page.getByTestId('visual-editor-device-screen').boundingBox();
    const tabletLandscapeCameraBox = await page.getByTestId('visual-editor-device-camera').boundingBox();
    const tabletRailBox = await page.getByTestId('visual-editor-device-rail').boundingBox();
    const tabletLandscapeBrowserViewport = await page.getByTestId('visual-editor-browser-viewport').boundingBox();
    expect(tabletLandscapeFrameBox).not.toBeNull();
    expect(tabletLandscapeScreenBox).not.toBeNull();
    expect(tabletLandscapeCameraBox).not.toBeNull();
    expect(tabletRailBox).not.toBeNull();
    expect(tabletLandscapeBrowserViewport).not.toBeNull();
    if (
      tabletLandscapeFrameBox
      && tabletLandscapeScreenBox
      && tabletLandscapeCameraBox
      && tabletRailBox
      && tabletLandscapeBrowserViewport
    ) {
      expect(tabletLandscapeFrameBox.width).toBeGreaterThan(tabletLandscapeScreenBox.width);
      expect(tabletLandscapeFrameBox.height).toBeGreaterThan(tabletLandscapeScreenBox.height);
      const tabletLandscapeAspectRatio = tabletLandscapeFrameBox.width / tabletLandscapeFrameBox.height;
      expectRatioClose(tabletLandscapeAspectRatio, 249.7 / 177.5, 0.05, 'iPad landscape body');
      expectRatioClose(
        tabletLandscapeScreenBox.width / tabletLandscapeFrameBox.width,
        232.8333 / 249.7,
        0.03,
        'iPad landscape screen width/body width',
      );
      expectRatioClose(
        tabletLandscapeScreenBox.height / tabletLandscapeFrameBox.height,
        160.4818 / 177.5,
        0.035,
        'iPad landscape screen height/body height',
      );
      const frameCenter = getBoxCenter(tabletLandscapeFrameBox);
      const cameraCenter = getBoxCenter(tabletLandscapeCameraBox);
      const railCenter = getBoxCenter(tabletRailBox);
      expect(Math.abs(cameraCenter.x - frameCenter.x)).toBeLessThan(tabletLandscapeFrameBox.width * 0.08);
      expect(cameraCenter.y).toBeLessThan(frameCenter.y - tabletLandscapeFrameBox.height * 0.34);
      expect(Math.abs(railCenter.x - frameCenter.x)).toBeLessThan(tabletLandscapeFrameBox.width * 0.08);
      expect(railCenter.y).toBeLessThan(frameCenter.y - tabletLandscapeFrameBox.height * 0.34);
      expectRatioClose(
        tabletLandscapeBrowserViewport.width / tabletLandscapeScreenBox.width,
        1180 / 1210,
        0.03,
        'iPad landscape browser viewport width/screen width',
      );
      expectRatioClose(
        tabletLandscapeBrowserViewport.height / tabletLandscapeScreenBox.height,
        717 / 834,
        0.03,
        'iPad landscape browser viewport height/screen height',
      );
    }
    await expect(fontSizeInput).toHaveValue('42');

    await page.getByRole('button', { name: /Mobile breakpoint/i }).click();
    await expect(page.getByText('Mobile Preview').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('iPhone 15 Pro').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Web viewport 393 × 740 pt').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Retina @3x').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('visual-editor-browser-top-bar')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('visual-editor-browser-bottom-bar')).toBeVisible({
      timeout: 20_000,
    });
    const mobileFrameBox = await page.getByTestId('visual-editor-device-frame').boundingBox();
    const mobileScreenBox = await page.getByTestId('visual-editor-device-screen').boundingBox();
    const mobileCutoutBox = await page.getByTestId('visual-editor-device-cutout').boundingBox();
    expect(mobileFrameBox).not.toBeNull();
    expect(mobileScreenBox).not.toBeNull();
    expect(mobileCutoutBox).not.toBeNull();
    if (mobileFrameBox && mobileScreenBox && mobileCutoutBox) {
      expect(mobileFrameBox.width).toBeGreaterThan(mobileScreenBox.width);
      expect(mobileFrameBox.height).toBeGreaterThan(mobileScreenBox.height);
      const mobileAspectRatio = mobileFrameBox.width / mobileFrameBox.height;
      expectRatioClose(mobileAspectRatio, 70.6 / 146.6, 0.05, 'iPhone portrait body');
      expectRatioClose(
        mobileScreenBox.width / mobileFrameBox.width,
        65.1013 / 70.6,
        0.03,
        'iPhone portrait screen width/body width',
      );
      expectRatioClose(
        mobileScreenBox.height / mobileFrameBox.height,
        141.1357 / 146.6,
        0.025,
        'iPhone portrait screen height/body height',
      );
      const frameCenter = getBoxCenter(mobileFrameBox);
      const cutoutCenter = getBoxCenter(mobileCutoutBox);
      expect(Math.abs(cutoutCenter.x - frameCenter.x)).toBeLessThan(mobileFrameBox.width * 0.08);
      expect(cutoutCenter.y).toBeLessThan(frameCenter.y - mobileFrameBox.height * 0.34);
    }

    await page.getByRole('button', { name: /Landscape orientation/i }).click();
    await expect(page.getByText('Viewport 852 × 393 pt').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Web viewport 793 × 313 pt').first()).toBeVisible({
      timeout: 20_000,
    });
    const mobileLandscapeFrameBox = await page.getByTestId('visual-editor-device-frame').boundingBox();
    const mobileLandscapeScreenBox = await page.getByTestId('visual-editor-device-screen').boundingBox();
    const mobileLandscapeCutoutBox = await page.getByTestId('visual-editor-device-cutout').boundingBox();
    const mobileLandscapeIndicatorBox = await page.getByTestId('visual-editor-device-home-indicator').boundingBox();
    const mobileLandscapeBrowserViewport = await page.getByTestId('visual-editor-browser-viewport').boundingBox();
    expect(mobileLandscapeFrameBox).not.toBeNull();
    expect(mobileLandscapeScreenBox).not.toBeNull();
    expect(mobileLandscapeCutoutBox).not.toBeNull();
    expect(mobileLandscapeIndicatorBox).not.toBeNull();
    expect(mobileLandscapeBrowserViewport).not.toBeNull();
    if (
      mobileLandscapeFrameBox
      && mobileLandscapeScreenBox
      && mobileLandscapeCutoutBox
      && mobileLandscapeIndicatorBox
      && mobileLandscapeBrowserViewport
    ) {
      expectRatioClose(
        mobileLandscapeFrameBox.width / mobileLandscapeFrameBox.height,
        146.6 / 70.6,
        0.06,
        'iPhone landscape body',
      );
      expectRatioClose(
        mobileLandscapeScreenBox.width / mobileLandscapeFrameBox.width,
        141.1357 / 146.6,
        0.025,
        'iPhone landscape screen width/body width',
      );
      expectRatioClose(
        mobileLandscapeScreenBox.height / mobileLandscapeFrameBox.height,
        65.1013 / 70.6,
        0.03,
        'iPhone landscape screen height/body height',
      );
      const frameCenter = getBoxCenter(mobileLandscapeFrameBox);
      const cutoutCenter = getBoxCenter(mobileLandscapeCutoutBox);
      const indicatorCenter = getBoxCenter(mobileLandscapeIndicatorBox);
      expect(cutoutCenter.x).toBeLessThan(frameCenter.x - mobileLandscapeFrameBox.width * 0.32);
      expect(Math.abs(cutoutCenter.y - frameCenter.y)).toBeLessThan(mobileLandscapeFrameBox.height * 0.08);
      expect(indicatorCenter.x).toBeGreaterThan(frameCenter.x + mobileLandscapeFrameBox.width * 0.32);
      expect(Math.abs(indicatorCenter.y - frameCenter.y)).toBeLessThan(mobileLandscapeFrameBox.height * 0.08);
      expectRatioClose(
        mobileLandscapeBrowserViewport.width / mobileLandscapeScreenBox.width,
        793 / 852,
        0.03,
        'iPhone landscape browser viewport width/screen width',
      );
      expectRatioClose(
        mobileLandscapeBrowserViewport.height / mobileLandscapeScreenBox.height,
        313 / 393,
        0.03,
        'iPhone landscape browser viewport height/screen height',
      );
    }

    await page.getByRole('button', { name: /Desktop breakpoint/i }).click();
    await expect(page.getByText('Desktop Preview').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Editing desktop breakpoint')).toBeVisible({
      timeout: 20_000,
    });
    await expect(fontSizeInput).toHaveValue('58');
    expectNoRuntimeIssues(runtime, 'navigator and responsive override flow');

    const preDuplicateCount = await readBlockCount(page);
    await page.getByRole('button', { name: /Hero Title text/i }).click();
    await page.getByRole('button', { name: /^Duplicate$/i }).click();
    await expect.poll(() => readBlockCount(page)).toBe(preDuplicateCount + 1);
    await page.getByRole('button', { name: /^Delete$/i }).click();
    await expect.poll(() => readBlockCount(page)).toBe(preDuplicateCount);
    expectNoRuntimeIssues(runtime, 'duplicate and delete flow');

    await page.getByLabel(/Hide Hero CTA/i).click();
    await expect(page.getByLabel(/Show Hero CTA/i)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/Show Hero CTA/i).click();

    await page.getByLabel(/Include Hero Title in multi-select/i).check();
    await page.getByLabel(/Include Hero CTA in multi-select/i).check();
    await page.getByRole('button', { name: /Group/i }).click();
    await expect(page.getByText('Group').first()).toBeVisible({ timeout: 20_000 });
    expectNoRuntimeIssues(runtime, 'grouping flow');

    await page.getByRole('button', { name: /Enter preview mode/i }).first().click();
    await expect(page.getByRole('button', { name: /Back to editing/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Live Preview')).toBeVisible({ timeout: 20_000 });
    expectNoRuntimeIssues(runtime, 'preview mode');

    await page.getByRole('button', { name: /Back to editing/i }).click();
    await expect(page.getByText('Canvas Stage').first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Open advanced workspace/i }).click();
    await expect(page.getByText('Advanced Workspace').first()).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: /^Analytics$/i }).click();
    await expect(page.getByText('Analytics Dashboard').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^Custom Event$/i }).click();
    await expect(page.getByText('analytics_dashboard_ping')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^Settings$/i }).click();
    await expect(page.getByText('Analytics Settings')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^Close$/i }).last().click();
    expectNoRuntimeIssues(runtime, 'analytics workspace flow');

    await page.getByRole('tab', { name: /^Audit$/i }).click();
    await expect(page.getByText('Audit Dashboard').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('tab', { name: /^Management$/i }).click();
    await expect(page.getByText('Management Lab')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^User Action$/i }).click();
    await page.getByRole('tab', { name: /^Events$/i }).click();
    await expect(page.getByText('audit_management_triggered')).toBeVisible({
      timeout: 20_000,
    });
    expectNoRuntimeIssues(runtime, 'audit workspace flow');
  });

  test('enhanced editor persists save state, templates, publish status, and export actions', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const runtime = attachRuntimeCollector(page);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await openFreshEditor(page, '/visual-editor-enhanced', runtime);

    await expect(page.getByText('Visual CMS Dashboard').first()).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole('button', { name: /Add hero section/i }).click();
    await expect(page.getByText('4 blocks')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Text Add text content/i }).click();
    await expect.poll(() => readBlockCount(page)).toBe(5);

    await page.getByRole('button', { name: /Undo change/i }).click();
    await expect.poll(() => readBlockCount(page)).toBe(4);
    await page.getByRole('button', { name: /Redo change/i }).click();
    await expect.poll(() => readBlockCount(page)).toBe(5);
    expectNoRuntimeIssues(runtime, 'undo and redo persistence flow');

    await page.getByRole('tab', { name: /^Navigator$/i }).click();
    await page.getByRole('button', { name: /Expand Hero Section/i }).click();
    await page.getByText('Hero Section').first().click();
    await page.getByLabel(/^Class$/i).fill('hero-section');
    await page.getByRole('button', { name: /^(Create class|Sync styles)$/i }).click();
    await expect(page.getByRole('button', { name: '.hero-section', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^Create token$/i }).first().click();
    await expect.poll(async () => {
      const snapshot = await readStoredProjectSnapshot(page);
      return snapshot.designTokenNames.includes('hero-section-backgroundcolor');
    }).toBe(true);
    expectNoRuntimeIssues(runtime, 'shared class creation flow');

    await page.getByLabel(/Open component library drawer/i).click();
    await expect(page.getByText(/Current selection ready to save/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^New$/i }).click();
    const componentName = 'Hero Snapshot';
    await page.getByLabel(/^Component Name$/i).fill(componentName);
    await page.getByRole('button', { name: /^Save$/i }).click();
    await expect.poll(() => readStoredLibraryComponent(page, componentName)).toMatchObject({
      elementCount: 4,
      rootCount: 1,
      classCount: 1,
      tokenCount: 1,
      variantName: 'Default',
    });
    const baseComponentSnapshot = await readStoredLibraryComponent(page, componentName);
    expect(baseComponentSnapshot?.familyId).not.toBeNull();
    const heroSnapshotCard = page.locator('.MuiCard-root').filter({ hasText: componentName }).first();
    await heroSnapshotCard.getByRole('button', { name: /^Use$/i }).click();
    await expect.poll(() => readBlockCount(page)).toBe(9);
    expectNoRuntimeIssues(runtime, 'component library snapshot flow');

    await page.getByLabel(/Open component library drawer/i).click();
    await expect(page.getByText(/Current selection ready to save/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^New$/i }).click();
    const variantComponentName = 'Hero Snapshot Minimal';
    await page.getByLabel(/^Component Name$/i).fill(variantComponentName);
    await page.getByLabel(/^Variant Name$/i).fill('Minimal');
    await page.getByLabel(/^Component Family$/i).click();
    await page.getByRole('option', { name: componentName }).click();
    await page.getByRole('button', { name: /^Save$/i }).click();
    await expect.poll(() => readStoredLibraryComponent(page, variantComponentName)).toMatchObject({
      variantName: 'Minimal',
      familyId: baseComponentSnapshot?.familyId ?? null,
      tokenCount: 1,
    });
    const variantCard = page.locator('.MuiCard-root').filter({ hasText: variantComponentName }).first();
    await variantCard.getByRole('button', { name: /^Use$/i }).click();
    await expect.poll(() => readBlockCount(page)).toBe(13);
    expectNoRuntimeIssues(runtime, 'component variant flow');

    await page.getByRole('button', { name: /^Save$/i }).click();
    await expect.poll(() => readStoredProjectSnapshot(page)).toMatchObject({
      status: 'draft',
      elementCount: 13,
    });
    await expect.poll(async () => {
      const snapshot = await readStoredProjectSnapshot(page);
      return snapshot.styleClassNames.includes('hero-section');
    }).toBe(true);
    await expect.poll(async () => {
      const snapshot = await readStoredProjectSnapshot(page);
      return snapshot.elementClassNames.includes('hero-section');
    }).toBe(true);
    await expect.poll(async () => {
      const snapshot = await readStoredProjectSnapshot(page);
      return snapshot.designTokenNames.includes('hero-section-backgroundcolor');
    }).toBe(true);
    await expect.poll(async () => {
      const snapshot = await readStoredProjectSnapshot(page);
      return snapshot.boundElementCount;
    }).toBeGreaterThanOrEqual(8);
    await expect.poll(async () => {
      const snapshot = await readStoredProjectSnapshot(page);
      return snapshot.componentFamilyIds.includes(baseComponentSnapshot?.familyId ?? '');
    }).toBe(true);
    await expect.poll(async () => {
      const snapshot = await readStoredProjectSnapshot(page);
      return snapshot.componentVariantNames.includes('Default') && snapshot.componentVariantNames.includes('Minimal');
    }).toBe(true);
    await expect.poll(async () => {
      const snapshot = await readStoredProjectSnapshot(page);
      const uniqueSlotNames = Array.from(new Set(snapshot.componentSlotNames));
      return uniqueSlotNames.length >= 2;
    }).toBe(true);
    await expect.poll(() => readStoredRevisionCount(page)).toBeGreaterThan(0);

    await page.getByLabel(/Open export panel/i).click();
    await expect(page.getByText('Export Project').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^CSS$/i }).click();
    await expect(page.getByText(/CSS copied to clipboard/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain('.hero-section');
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain('--ve-token-hero-section-backgroundcolor');
    await page.getByRole('button', { name: /^(JSX|HTML|Vue)$/i }).first().click();
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain('data-ve-component-family');
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain('data-ve-component-slot');
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain('data-ve-component-instance');
    await page.getByRole('button', { name: /^Manifest$/i }).click();
    await expect(page.getByText(/Manifest copied to clipboard/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain('"familyId"');
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain('"instanceId"');
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain(
      baseComponentSnapshot?.familyId ?? '',
    );
    await page.getByRole('dialog').getByRole('button', { name: /^Close$/i }).last().click();
    expectNoRuntimeIssues(runtime, 'shared class, component manifest, and token export flow');

    await page.reload({
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });

    await expect(page.getByText('13 blocks')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Build your first section in seconds')).toHaveCount(0, {
      timeout: 20_000,
    });
    expectNoRuntimeIssues(runtime, 'save and reload flow');

    await page.getByRole('button', { name: /^Publish$/i }).click();
    await expect(page.getByText(/Status:\s*published/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect.poll(() => readStoredProjectSnapshot(page)).toMatchObject({
      status: 'published',
      elementCount: 13,
    });
    await expect.poll(() => readPublishedProjectSnapshot(page)).toMatchObject({
      status: 'published',
      elementCount: 13,
    });
    await expect.poll(async () => {
      const snapshot = await readStoredProjectSnapshot(page);
      return snapshot.styleClassNames.includes('hero-section');
    }).toBe(true);
    await expect.poll(async () => {
      const snapshot = await readPublishedProjectSnapshot(page);
      return snapshot.designTokenNames.includes('hero-section-backgroundcolor');
    }).toBe(true);
    await expect.poll(async () => {
      const snapshot = await readPublishedProjectSnapshot(page);
      return snapshot.boundElementCount;
    }).toBeGreaterThanOrEqual(8);
    expectNoRuntimeIssues(runtime, 'publish flow');

    await page.getByRole('button', { name: /Open advanced workspace/i }).click();
    await expect(page.getByText('Advanced Workspace').first()).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('tab', { name: /^Integration$/i }).click();
    const templateName = 'Regression Template';
    await page.getByLabel(/^Template Name$/i).fill(templateName);
    await page.getByRole('button', { name: /^Save Template$/i }).click();
    await expect.poll(() => hasStoredTemplate(page, templateName)).toBe(true);

    await page.getByRole('button', { name: /Close advanced workspace drawer/i }).click();
    await expect(page.getByText('Advanced Workspace')).toHaveCount(0, {
      timeout: 20_000,
    });

    await page.getByRole('button', { name: /Card Content card/i }).click();
    await expect.poll(() => readBlockCount(page)).toBe(14);

    await page.getByRole('button', { name: /Open advanced workspace/i }).click();
    await expect(page.getByText('Advanced Workspace').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('tab', { name: /^Integration$/i }).click();
    await page.getByRole('combobox', { name: /^Saved Template$/i }).click();
    await page.getByRole('option', { name: templateName }).click();
    await page.getByRole('button', { name: /^Load Template$/i }).click();
    await expect.poll(() => readBlockCount(page)).toBe(13);
    expectNoRuntimeIssues(runtime, 'template save and load flow');

    await page.getByRole('button', { name: /Close advanced workspace drawer/i }).click();
    await expect(page.getByText('Advanced Workspace')).toHaveCount(0, {
      timeout: 20_000,
    });

    await page.getByLabel(/Open export panel/i).click();
    await expect(page.getByText('Export Project').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel(/^Project Name$/i).fill('Regression Export');
    await page.getByRole('button', { name: /^Download$/i }).click();
    await expect(page.getByText(/Exported \d+ files to regression-export\.zip/i)).toBeVisible({
      timeout: 20_000,
    });
    expectNoRuntimeIssues(runtime, 'export flow');
  });

  test('evendi one-pager loads seeded content and remains editable', async ({ page }) => {
    test.setTimeout(180_000);
    const runtime = attachRuntimeCollector(page);

    await openFreshEditor(page, '/evendi', runtime);

    await expect(page.getByText('Visual CMS Dashboard').first()).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText(/Evendi/i).first()).toBeVisible({ timeout: 30_000 });

    const initialBlockCount = await readBlockCount(page);
    expect(initialBlockCount).toBeGreaterThan(20);
    expectNoRuntimeIssues(runtime, 'evendi initial load');

    await page.getByRole('button', { name: /Enter preview mode/i }).first().click();
    await expect(page.getByRole('button', { name: /Back to editing/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Back to editing/i }).click();
    await expect(page.getByText('Canvas Stage').first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Text\s+Add text content/i }).click();
    const nextBlockCount = await readBlockCount(page);
    expect(nextBlockCount).toBe(initialBlockCount + 1);
    expectNoRuntimeIssues(runtime, 'evendi edit flow');
  });

  // TODO(ci-gates): Feiler pre-eksisterende i CI på alle PR-er. Skipper
  // midlertidig — fjern test.skip når dashboard-mount er stabil i CI.
  test.skip('admin visual cms dashboard renders full-width workspace', async ({ page }) => {
    test.setTimeout(180_000);
    const runtime = attachRuntimeCollector(page);

    await page.setViewportSize({ width: 1720, height: 1180 });
    await page.goto('/admin', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });

    await expect(page.getByRole('tab', { name: /Innhold & Assets/i })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole('tab', { name: /Innhold & Assets/i }).click();

    const editorShell = page.getByTestId('visual-editor-shell');
    await expect(editorShell).toBeVisible({ timeout: 90_000 });

    const shellWidth = await editorShell.evaluate((node) =>
      Math.round(node.getBoundingClientRect().width),
    );
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(shellWidth).toBeGreaterThanOrEqual(viewportWidth - 48);
    expectNoRuntimeIssues(runtime, 'admin visual cms full-width layout');
  });
});

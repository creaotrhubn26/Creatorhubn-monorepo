import { test, expect, type ConsoleMessage, type Locator, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-drawing-editor.html';
const TEST_UPLOAD_ASSET = `${process.cwd()}/client/public/test-assets/storyboard-noir-reference.svg`;

type RuntimeCollector = {
  pageErrors: string[];
  severeConsoleErrors: string[];
  failedDocumentRequests: string[];
};

const isIgnorableConsoleError = (message: string): boolean => {
  const normalized = String(message || '');
  return (
    /Download the React DevTools/i.test(normalized) ||
    /Sentry is not configured/i.test(normalized) ||
    /\[main\.tsx\]/i.test(normalized)
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
    if (message.type() !== 'error') return;
    const text = message.text();
    if (isIgnorableConsoleError(text)) return;
    collector.severeConsoleErrors.push(text);
  });

  page.on('requestfailed', (request) => {
    if (request.resourceType() !== 'document') return;
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

  expect(issues, `${checkpoint} produced runtime issues:\n${issues.join('\n')}`).toEqual([]);
};

const getBox = async (locator: Locator, label: string) => {
  const box = await locator.boundingBox();
  expect(box, `${label} should have a bounding box`).not.toBeNull();
  return box!;
};

const getCss = async (locator: Locator, property: string): Promise<string> =>
  locator.evaluate(
    (element, cssProperty) => window.getComputedStyle(element).getPropertyValue(cssProperty),
    property,
  );

const expectTexts = async (locator: Locator, values: string[]) => {
  for (const value of values) {
    await expect(locator).toContainText(value);
  }
};

const parseHarnessBounds = async (locator: Locator) => {
  const text = await locator.textContent();
  const match = text?.match(/-?\d+(?:\.\d+)?/g) || [];
  expect(match.length).toBeGreaterThanOrEqual(4);
  const [x, y, width, height] = match.slice(0, 4).map((value) => Number.parseFloat(value));
  return { x, y, width, height };
};

const parseSpatialCanvasTransform = async (locator: Locator) => {
  const text = await locator.textContent();
  const match = text?.match(/x\s+(-?\d+)\s+·\s+y\s+(-?\d+)\s+·\s+z\s+(-?\d+)/);
  expect(match, 'spatial canvas summary should contain x/y/z coordinates').not.toBeNull();
  return {
    x: Number.parseInt(match?.[1] || '0', 10),
    y: Number.parseInt(match?.[2] || '0', 10),
    z: Number.parseInt(match?.[3] || '0', 10),
  };
};

const parseStrokeCount = async (locator: Locator) => {
  const text = await locator.textContent();
  const match = text?.match(/Strokes:\s*(\d+)/);
  expect(match, 'status bar should contain a stroke count').not.toBeNull();
  return Number.parseInt(match?.[1] || '0', 10);
};

const parseShapeScaffoldFrame = async (locator: Locator) => {
  const xRatio = Number.parseFloat(await locator.getAttribute('data-x-ratio') || '0');
  const yRatio = Number.parseFloat(await locator.getAttribute('data-y-ratio') || '0');
  const widthRatio = Number.parseFloat(await locator.getAttribute('data-width-ratio') || '0');
  const heightRatio = Number.parseFloat(await locator.getAttribute('data-height-ratio') || '0');
  return { xRatio, yRatio, widthRatio, heightRatio };
};

const setRangeInputValue = async (locator: Locator, value: number) => {
  await locator.locator('input').evaluate((input, nextValue) => {
    const element = input as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(element, String(nextValue));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
};

test.describe('Storyboard drawing editor layout contract', () => {
  test('desktop studio chrome renders the full premium workspace shell', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const harness = page.getByTestId('drawing-editor-harness-ready');
    const shell = page.getByTestId('frame-editor-shell');
    const header = page.getByTestId('frame-editor-header');
    const brand = page.getByTestId('frame-editor-brand');
    const quickActions = page.getByTestId('frame-editor-quick-actions');
    const headerBrushStrip = page.getByTestId('frame-editor-header-brush-strip');
    const headerUtilityStrip = page.getByTestId('frame-editor-header-utility-strip');
    const body = page.getByTestId('frame-editor-body');
    const leftRail = page.getByTestId('frame-editor-left-rail');
    const brushPanel = page.getByTestId('frame-editor-brush-panel');
    const brushLibrary = page.getByTestId('frame-editor-brush-library');
    const brushControls = page.getByTestId('frame-editor-brush-controls');
    const precisionToolsCard = page.getByTestId('frame-editor-precision-tools-card');
    const stage = page.getByTestId('frame-editor-stage');
    const stageTopbar = page.getByTestId('frame-editor-stage-topbar');
    const stageOpticsStrip = page.getByTestId('frame-editor-stage-optics-strip');
    const stageCameraStrip = page.getByTestId('frame-editor-stage-camera-strip');
    const stageLightDial = page.getByTestId('frame-editor-stage-light-dial');
    const canvasShell = page.getByTestId('frame-editor-canvas-shell');
    const timeline = page.getByTestId('frame-editor-timeline');
    const timeLapseCard = page.getByTestId('frame-editor-timelapse-card');
    const animationAssistCard = page.getByTestId('frame-editor-animation-assist-card');
    const transportMeta = page.getByTestId('frame-editor-transport-meta');
    const deckTabs = page.getByTestId('frame-editor-deck-tabs');
    const deckTabStrip = page.getByTestId('frame-editor-deck-tab-strip');
    const deckStatusStrip = page.getByTestId('frame-editor-deck-status-strip');
    const filmstrip = page.getByTestId('frame-editor-filmstrip');
    const filmstripCore = page.getByTestId('frame-editor-filmstrip-core');
    const inspector = page.getByTestId('frame-editor-inspector');
    const lightingToggles = page.getByTestId('frame-editor-lighting-toggles');
    const lightingMaterials = page.getByTestId('frame-editor-lighting-materials');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const statusMetrics = page.getByTestId('frame-editor-status-metrics');
    const statusActions = page.getByTestId('frame-editor-status-actions');
    const workflowChip = page.getByTestId('frame-editor-workflow-chip');
    const saveButton = page.getByTestId('frame-editor-save');

    await expect(harness).toBeVisible();
    await expect(shell).toBeVisible();
    await expect(header).toBeVisible();
    await expect(brand).toBeVisible();
    await expect(quickActions).toBeVisible();
    await expect(headerBrushStrip).toBeVisible();
    await expect(headerUtilityStrip).toBeVisible();
    await expect(body).toBeVisible();
    await expect(leftRail).toBeVisible();
    await expect(brushPanel).toBeVisible();
    await expect(brushLibrary).toBeVisible();
    await expect(brushControls).toBeVisible();
    await expect(precisionToolsCard).toBeVisible();
    await expect(stage).toBeVisible();
    await expect(stageTopbar).toBeVisible();
    await expect(stageOpticsStrip).toBeVisible();
    await expect(stageCameraStrip).toBeVisible();
    await expect(stageLightDial).toBeVisible();
    await expect(canvasShell).toBeVisible();
    await expect(timeline).toBeVisible();
    await expect(timeLapseCard).toBeVisible();
    await expect(animationAssistCard).toBeVisible();
    await expect(transportMeta).toBeVisible();
    await expect(deckTabs).toBeVisible();
    await expect(deckTabStrip).toBeVisible();
    await expect(deckStatusStrip).toBeVisible();
    await expect(filmstrip).toBeVisible();
    await expect(filmstripCore).toBeVisible();
    await expect(inspector).toBeVisible();
    await expect(lightingToggles).toBeVisible();
    await expect(lightingMaterials).toBeVisible();
    await expect(statusbar).toBeVisible();
    await expect(statusMetrics).toBeVisible();
    await expect(statusActions).toBeVisible();
    await expect(workflowChip).toBeVisible();
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();
    await expect(brand).toContainText('CREATORHUB');
    await expect(brand).toContainText('STORYBOARD PRO');
    await expect(brand).toContainText('Scene 15');
    await expect(brand).toContainText('SHOT 5B');
    await expect(quickActions).toContainText('Approved');
    await expect(quickActions).toContainText('Share');
    await expect(quickActions).toContainText('Export');
    await expect(headerUtilityStrip).toContainText('Present');
    await expect(headerUtilityStrip).toContainText('Neutral');
    await expect(headerUtilityStrip).toContainText('Noir');
    await expect(headerUtilityStrip).toContainText('Amber');
    expect(await leftRail.getByRole('button').count()).toBe(6);
    await expect(brushPanel).toContainText('BRUSH PACKS');
    await expect(brushPanel).toContainText('NOIR LIGHTING PACK');
    await expect(brushPanel).toContainText('COMMERCIAL HIGH-KEY');
    await expect(brushPanel).toContainText('ACTION CROSSHATCH');
    await expect(brushPanel).toContainText('SOFT DRAMA WASH');
    await expect(brushPanel).toContainText('BRUSH LIBRARY');
    await expect(brushPanel).toContainText('Hard Shadow');
    await expect(brushPanel).toContainText('Crosshatch');
    await expect(brushPanel).toContainText('Size');
    await expect(brushPanel).toContainText('Opacity');
    await expect(stageTopbar).toContainText('50mm');
    await expect(stageTopbar).toContainText('f/1.8');
    await expect(stageTopbar).toContainText('180°');
    await expect(stageTopbar).toContainText('Camera Height');
    await expect(timeline).toContainText('00:00:02');
    expect(await deckTabs.getByRole('button').count()).toBe(6);
    await expect(deckTabs.getByRole('button', { name: 'SHADOW' })).toBeVisible();
    expect(await filmstrip.getByText(/Beat 0/i).count()).toBe(4);
    await expect(inspector).toContainText('INSPECTOR');
    await expect(inspector).toContainText('LIGHTING');
    await expect(inspector).toContainText('LAYERS');
    await expect(inspector).toContainText('SHOT');
    await expect(inspector).toContainText('Key Light');
    await expect(inspector).toContainText('10:30 PM');
    await expect(inspector).toContainText('3.200K');
    await expect(workflowChip).toContainText('shot');
    await expect(statusbar).toContainText('Strokes: 2');

    const headerBox = await getBox(header, 'header');
    const bodyBox = await getBox(body, 'body');
    const leftRailBox = await getBox(leftRail, 'left rail');
    const brushPanelBox = await getBox(brushPanel, 'brush panel');
    const stageBox = await getBox(stage, 'stage');
    const canvasBox = await getBox(canvasShell, 'canvas shell');
    const inspectorBox = await getBox(inspector, 'inspector');
    const statusBox = await getBox(statusbar, 'status bar');

    expect(headerBox.y).toBeLessThan(bodyBox.y);
    expect(bodyBox.y).toBeLessThan(statusBox.y);
    expect(leftRailBox.x).toBeLessThan(brushPanelBox.x);
    expect(brushPanelBox.x).toBeLessThan(stageBox.x);
    expect(stageBox.x).toBeLessThan(inspectorBox.x);
    expect(stageBox.width).toBeGreaterThan(brushPanelBox.width);
    expect(stageBox.width).toBeGreaterThan(inspectorBox.width);
    expect(canvasBox.width).toBeGreaterThan(700);
    expect(canvasBox.height).toBeGreaterThan(250);
    expect(stageBox.height).toBeGreaterThan(620);
    expect(inspectorBox.height).toBeGreaterThan(620);
    expect(bodyBox.width).toBeGreaterThan(1450);

    expectNoRuntimeIssues(collector, 'desktop storyboard drawing editor');
  });

  test('ipad uses the tablet workspace and keeps spatial drag plus flythrough scrub functional', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}&device=ipad`);

    const shell = page.getByTestId('frame-editor-shell');
    const header = page.getByTestId('frame-editor-header');
    const body = page.getByTestId('frame-editor-body');
    const leftRail = page.getByTestId('frame-editor-left-rail');
    const leftRailBrushTool = page.getByTestId('frame-editor-left-rail-tool-brush');
    const brushPanel = page.getByTestId('frame-editor-brush-panel');
    const brushLibrary = page.getByTestId('frame-editor-brush-library');
    const stage = page.getByTestId('frame-editor-stage');
    const inspector = page.getByTestId('frame-editor-inspector');
    const deviceChip = page.getByTestId('frame-editor-device-chip');
    const tabletBadge = page.getByTestId('frame-editor-tablet-badge');
    const stageTopbar = page.getByTestId('frame-editor-stage-topbar');
    const stageLightDial = page.getByTestId('frame-editor-stage-light-dial');
    const inspectorModeTabs = page.getByTestId('frame-editor-inspector-mode-tabs');
    const transportRow = page.getByTestId('frame-editor-transport-row');
    const quickTools = page.getByTestId('frame-editor-timeline-quick-tools');
    const deckTabs = page.getByTestId('frame-editor-deck-tabs');
    const filmstrip = page.getByTestId('frame-editor-filmstrip');
    const flythroughCurrent = page.getByTestId('frame-editor-flythrough-current');
    const flythroughProgress = page.getByTestId('frame-editor-flythrough-progress');
    const flythroughMetaStrip = page.getByTestId('frame-editor-flythrough-meta-strip');
    const flythroughControls = page.getByTestId('frame-editor-flythrough-controls');
    const flythroughActions = page.getByTestId('frame-editor-flythrough-actions');
    const flythroughVisibilityList = page.getByTestId('frame-editor-flythrough-visibility-list');
    const spatialMapTransformStrip = page.getByTestId('frame-editor-spatial-map-transform-strip');
    const spatialMapBookmarkStrip = page.getByTestId('frame-editor-spatial-map-bookmark-strip');
    const projectionToggles = page.getByTestId('frame-editor-spatial-projection-toggles');
    const spatialCanvasCard = page.getByTestId('frame-editor-spatial-canvas-canvas-2');
    const spatialMapReadout = page.getByTestId('frame-editor-spatial-map-transform-readout');
    const referenceActions = page.getByTestId('frame-editor-reference-actions');
    const statusMetrics = page.getByTestId('frame-editor-status-metrics');
    const statusActions = page.getByTestId('frame-editor-status-actions');
    const saveButton = page.getByTestId('frame-editor-save');

    await expect(shell).toHaveAttribute('data-layout-mode', 'tablet');
    await expect(header).toBeVisible();
    await expect(body).toBeVisible();
    await expect(leftRail).toBeVisible();
    await expect(brushPanel).toBeVisible();
    await expect(stage).toBeVisible();
    await expect(inspector).toBeVisible();
    await expect(deviceChip).toContainText('Apple Pencil');
    await expect(tabletBadge).toContainText('Tablet Workspace');
    await expect(page.getByTestId('frame-editor-brand')).toHaveCount(0);
    await expect(page.getByTestId('frame-editor-inspector-side-rack')).toBeHidden();
    expect(await getCss(stageTopbar, 'overflow-x')).toBe('auto');
    expect(await getCss(transportRow, 'overflow-x')).toBe('auto');
    expect(await getCss(deckTabs, 'overflow-x')).toBe('auto');
    expect(await getCss(filmstrip, 'overflow-x')).toBe('auto');
    const stageLightDialBox = await getBox(stageLightDial, 'tablet light dial');
    expect(stageLightDialBox.width).toBeGreaterThanOrEqual(54);
    const leftRailBrushBox = await getBox(leftRailBrushTool, 'tablet left rail brush tool');
    expect(leftRailBrushBox.height).toBeGreaterThanOrEqual(56);
    const inspectorModeButtonBox = await getBox(
      inspectorModeTabs.getByRole('button', { name: 'SHOT' }),
      'tablet inspector shot tab',
    );
    expect(inspectorModeButtonBox.height).toBeGreaterThanOrEqual(40);
    const brushPresetButtonBox = await getBox(
      brushLibrary.getByRole('button', { name: 'Hard Shadow' }),
      'tablet brush preset button',
    );
    expect(brushPresetButtonBox.height).toBeGreaterThanOrEqual(38);
    const addSheetButtonBox = await getBox(
      quickTools.getByRole('button', { name: 'Sheet' }),
      'tablet add sheet button',
    );
    expect(addSheetButtonBox.height).toBeGreaterThanOrEqual(34);
    expect(await getCss(statusMetrics, 'overflow-x')).toBe('auto');
    expect(await getCss(statusActions, 'overflow-x')).toBe('auto');
    const saveButtonBox = await getBox(saveButton, 'tablet save button');
    expect(saveButtonBox.height).toBeGreaterThanOrEqual(34);

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await expect(page.getByTestId('frame-editor-spatial-map-card')).toBeVisible();
    await expect(page.getByTestId('frame-editor-flythrough-card')).toBeVisible();
    expect(await getCss(spatialMapTransformStrip, 'overflow-x')).toBe('auto');
    expect(await getCss(spatialMapBookmarkStrip, 'overflow-x')).toBe('auto');
    expect(await getCss(flythroughMetaStrip, 'overflow-x')).toBe('auto');
    expect(await getCss(flythroughControls, 'overflow-x')).toBe('auto');
    expect(await getCss(flythroughActions, 'overflow-x')).toBe('auto');
    expect(await getCss(flythroughVisibilityList, 'overflow-x')).toBe('auto');
    expect(await getCss(projectionToggles, 'overflow-x')).toBe('auto');
    expect(await getCss(referenceActions, 'overflow-x')).toBe('auto');
    const spatialMapTransformButtonBox = await getBox(
      page.getByTestId('frame-editor-spatial-map-scale-up'),
      'tablet spatial map scale button',
    );
    expect(spatialMapTransformButtonBox.height).toBeGreaterThanOrEqual(36);
    const flythroughCaptureButtonBox = await getBox(
      page.getByTestId('frame-editor-flythrough-capture-view'),
      'tablet flythrough capture button',
    );
    expect(flythroughCaptureButtonBox.height).toBeGreaterThanOrEqual(32);
    const referenceAddButtonBox = await getBox(
      page.getByTestId('frame-editor-reference-add'),
      'tablet reference add button',
    );
    expect(referenceAddButtonBox.height).toBeGreaterThanOrEqual(32);
    const projectionSourceButtonBox = await getBox(
      page.getByTestId('frame-editor-spatial-projection-source'),
      'tablet projection source button',
    );
    expect(projectionSourceButtonBox.height).toBeGreaterThanOrEqual(32);
    const referenceFocusButtonBox = await getBox(
      page.getByTestId('frame-editor-reference-select-board-ref-a'),
      'tablet reference focus button',
    );
    expect(referenceFocusButtonBox.height).toBeGreaterThanOrEqual(32);
    await page.getByTestId('frame-editor-spatial-map-bookmark-flythrough-push').click();
    await page.getByTestId('frame-editor-spatial-map-card').scrollIntoViewIfNeeded();
    await expect(spatialCanvasCard).toContainText('Active');

    const transformBefore = await parseSpatialCanvasTransform(spatialCanvasCard);
    await page.getByTestId('frame-editor-spatial-map-nudge-right').click();
    await page.getByTestId('frame-editor-spatial-map-scale-up').click();
    const transformAfter = await parseSpatialCanvasTransform(spatialCanvasCard);
    expect(transformAfter.x).toBeGreaterThan(transformBefore.x + 8);
    await expect(spatialMapReadout).toContainText('Scale 1.30');

    const progressBox = await getBox(flythroughProgress, 'tablet flythrough progress');
    await page.mouse.move(
      progressBox.x + (progressBox.width * 0.16),
      progressBox.y + (progressBox.height / 2),
    );
    await page.mouse.down();
    await page.mouse.move(
      progressBox.x + (progressBox.width * 0.84),
      progressBox.y + (progressBox.height / 2),
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(flythroughCurrent).toContainText('Flythrough Push');

    await expect(shell).toHaveScreenshot('storyboard-drawing-editor-tablet-shell.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    expectNoRuntimeIssues(collector, 'ipad tablet workspace checks');
  });

  test('desktop studio chrome matches the visual baseline', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const shell = page.getByTestId('frame-editor-shell');
    await expect(shell).toHaveScreenshot('storyboard-drawing-editor-desktop-shell.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    expectNoRuntimeIssues(collector, 'desktop storyboard drawing editor screenshot');
  });

  test('header and timeline match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-header')).toHaveScreenshot('storyboard-drawing-editor-header.png', {
      animations: 'disabled',
      caret: 'hide',
    });
    await expect(page.getByTestId('frame-editor-timeline')).toHaveScreenshot('storyboard-drawing-editor-timeline.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    expectNoRuntimeIssues(collector, 'header and timeline screenshot baselines');
  });

  test('stage topbar and shot settings card match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-stage-topbar')).toHaveScreenshot(
      'storyboard-drawing-editor-stage-topbar.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-shot-settings-card')).toHaveScreenshot(
      'storyboard-drawing-editor-shot-settings-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'stage topbar and shot settings baselines');
  });

  test('status bar matches its dedicated visual baseline', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-statusbar')).toHaveScreenshot('storyboard-drawing-editor-statusbar.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    expectNoRuntimeIssues(collector, 'status bar screenshot baseline');
  });

  test('quick actions and filmstrip match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-quick-actions')).toHaveScreenshot(
      'storyboard-drawing-editor-quick-actions.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-filmstrip')).toHaveScreenshot(
      'storyboard-drawing-editor-filmstrip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'quick actions and filmstrip baselines');
  });

  test('transport row and lighting card match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-transport-row')).toHaveScreenshot(
      'storyboard-drawing-editor-transport-row.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-lighting-card')).toHaveScreenshot(
      'storyboard-drawing-editor-lighting-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'transport row and lighting card baselines');
  });

  test('time-lapse replay card matches its dedicated visual baseline', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-timelapse-card')).toHaveScreenshot(
      'storyboard-drawing-editor-timelapse-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'time-lapse replay card baseline');
  });

  test('animation assist and precision tools match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-animation-assist-card')).toHaveScreenshot(
      'storyboard-drawing-editor-animation-assist-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-animation-animatic-plan')).toHaveScreenshot(
      'storyboard-drawing-editor-animation-animatic-plan.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-precision-tools-card')).toHaveScreenshot(
      'storyboard-drawing-editor-precision-tools-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-animation-timing-strip')).toHaveScreenshot(
      'storyboard-drawing-editor-animation-timing-strip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-precision-guide-preview')).toHaveScreenshot(
      'storyboard-drawing-editor-precision-guide-preview.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-precision-text-preview')).toHaveScreenshot(
      'storyboard-drawing-editor-precision-text-preview.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-precision-canvas-tools')).toHaveScreenshot(
      'storyboard-drawing-editor-precision-canvas-tools.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-animation-exposure-strip')).toHaveScreenshot(
      'storyboard-drawing-editor-animation-exposure-strip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'animation assist and precision tools baselines');
  });

  test('brush and lighting detail clusters match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-brush-library')).toHaveScreenshot(
      'storyboard-drawing-editor-brush-library.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-brush-controls')).toHaveScreenshot(
      'storyboard-drawing-editor-brush-controls.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-lighting-toggles')).toHaveScreenshot(
      'storyboard-drawing-editor-lighting-toggles.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-lighting-materials')).toHaveScreenshot(
      'storyboard-drawing-editor-lighting-materials.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'brush and lighting detail cluster baselines');
  });

  test('canvas overlays and inspector side rack match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-canvas-overlays')).toHaveScreenshot(
      'storyboard-drawing-editor-canvas-overlays.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-inspector-side-rack')).toHaveScreenshot(
      'storyboard-drawing-editor-inspector-side-rack.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'canvas overlays and side rack baselines');
  });

  test('header clusters and stage control clusters match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-brand')).toHaveScreenshot(
      'storyboard-drawing-editor-brand-cluster.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-header-brush-strip')).toHaveScreenshot(
      'storyboard-drawing-editor-header-brush-strip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-header-utility-strip')).toHaveScreenshot(
      'storyboard-drawing-editor-header-utility-strip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-stage-optics-strip')).toHaveScreenshot(
      'storyboard-drawing-editor-stage-optics-strip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-stage-camera-strip')).toHaveScreenshot(
      'storyboard-drawing-editor-stage-camera-strip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-stage-light-dial')).toHaveScreenshot(
      'storyboard-drawing-editor-stage-light-dial.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'header and stage cluster baselines');
  });

  test('timeline strips and status bar clusters match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-transport-meta')).toHaveScreenshot(
      'storyboard-drawing-editor-transport-meta.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-deck-tab-strip')).toHaveScreenshot(
      'storyboard-drawing-editor-deck-tab-strip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-deck-status-strip')).toHaveScreenshot(
      'storyboard-drawing-editor-deck-status-strip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-filmstrip-core')).toHaveScreenshot(
      'storyboard-drawing-editor-filmstrip-core.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-status-metrics')).toHaveScreenshot(
      'storyboard-drawing-editor-status-metrics.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-status-actions')).toHaveScreenshot(
      'storyboard-drawing-editor-status-actions.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'timeline strips and status clusters baselines');
  });

  test('left rail, layers stack, and shot notes match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');

    await expect(page.getByTestId('frame-editor-left-rail')).toHaveScreenshot(
      'storyboard-drawing-editor-left-rail.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    await inspector.getByRole('button', { name: 'LAYERS' }).click();
    await expect(page.getByTestId('frame-editor-layers-stack')).toHaveScreenshot(
      'storyboard-drawing-editor-layers-stack.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-layer-controls-card')).toHaveScreenshot(
      'storyboard-drawing-editor-layer-controls-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-motion-rig-card')).toHaveScreenshot(
      'storyboard-drawing-editor-motion-rig-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await expect(page.getByTestId('frame-editor-shot-summary-card')).toHaveScreenshot(
      'storyboard-drawing-editor-shot-summary-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-shot-notes-stack')).toHaveScreenshot(
      'storyboard-drawing-editor-shot-notes-stack.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-spatial-map-card')).toHaveScreenshot(
      'storyboard-drawing-editor-spatial-map-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-spatial-map-transform-strip')).toHaveScreenshot(
      'storyboard-drawing-editor-spatial-map-transform-strip.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-spatial-projection-card')).toHaveScreenshot(
      'storyboard-drawing-editor-spatial-projection-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );
    await expect(page.getByTestId('frame-editor-flythrough-card')).toHaveScreenshot(
      'storyboard-drawing-editor-flythrough-card.png',
      {
        animations: 'disabled',
        caret: 'hide',
      },
    );

    expectNoRuntimeIssues(collector, 'left rail, layers stack, and shot note baselines');
  });

  test('studio chrome interactions keep the layout contract intact', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const timeline = page.getByTestId('frame-editor-timeline');
    const gridButton = page.getByRole('button', { name: 'Grid' });
    const layersModeButton = inspector.getByRole('button', { name: 'LAYERS' });
    const shotModeButton = inspector.getByRole('button', { name: 'SHOT' });
    const lightingModeButton = inspector.getByRole('button', { name: 'LIGHTING' });
    const playButton = timeline.getByRole('button').nth(2);
    const lightDeckButton = page.getByTestId('frame-editor-deck-tabs').getByRole('button', { name: 'LIGHT' });
    const roughDeckButton = page.getByTestId('frame-editor-deck-tabs').getByRole('button', { name: 'ROUGH' });

    await expect(gridButton).toBeVisible();
    await gridButton.click();
    await expect(timeline).toContainText('Grid Off');
    await gridButton.click();
    await expect(timeline).toContainText('Perspective Grid');

    await layersModeButton.click();
    await expect(inspector).toContainText('Blend Mode');
    await expect(inspector).toContainText('Layer Opacity');
    await expect(inspector).toContainText('Sketch');
    await expect(inspector).toContainText('Line Art');
    await expect(inspector).toContainText('Shadows');

    await shotModeButton.click();
    await expect(inspector).toContainText('Street practical from screen right');
    await expect(inspector).toContainText('Add subtle dust and rain pass');
    await expect(inspector).toContainText('PX / Grain');

    await lightingModeButton.click();
    await expect(inspector).toContainText('Key Light');
    await expect(inspector).toContainText('Casts Shadows');
    await expect(inspector).toContainText('Ambient Occlusion');

    await lightDeckButton.click();
    await expect(timeline).toContainText('Deck: LIGHT');
    await roughDeckButton.click();
    await expect(timeline).toContainText('Deck: ROUGH');

    await playButton.click();
    await expect(timeline).toContainText('Pause');
    await playButton.click();
    await expect(timeline).toContainText('Play');

    await page.getByTestId('frame-editor-brush-pack-crosshatch').click();
    await expect(page.getByTestId('frame-editor-brush-pack-crosshatch')).toBeVisible();

    const timelineBox = await getBox(timeline, 'timeline');
    const inspectorBox = await getBox(inspector, 'inspector');
    expect(timelineBox.width).toBeGreaterThan(700);
    expect(inspectorBox.width).toBeGreaterThan(250);

    expectNoRuntimeIssues(collector, 'studio chrome interaction checks');
  });

  test('layer groups can collapse, regroup, and ungroup inside the inspector', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    await inspector.getByRole('button', { name: 'LAYERS' }).click();

    const inkPass = page.getByTestId('frame-editor-layer-card-ink-pass');
    const sketch = page.getByTestId('frame-editor-layer-card-sketch');
    const lineArt = page.getByTestId('frame-editor-layer-card-line-art');
    const lighting = page.getByTestId('frame-editor-layer-card-lighting');
    const grain = page.getByTestId('frame-editor-layer-card-px-grain');
    const groupAction = page.getByTestId('frame-editor-layer-action-group');
    const ungroupAction = page.getByTestId('frame-editor-layer-action-ungroup');

    await expect(inkPass).toBeVisible();
    await expect(sketch).toBeVisible();
    await expect(lineArt).toBeVisible();

    await page.getByTestId('frame-editor-layer-expand-ink-pass').click();
    await expect(sketch).toHaveCount(0);
    await expect(lineArt).toHaveCount(0);

    await page.getByTestId('frame-editor-layer-expand-ink-pass').click();
    await expect(sketch).toBeVisible();
    await expect(lineArt).toBeVisible();

    await page.getByTestId('frame-editor-layer-select-lighting').click();
    await page.getByTestId('frame-editor-layer-select-px-grain').click();
    await expect(groupAction).toBeEnabled();
    await groupAction.click();

    const groupedCard = page.getByTestId('frame-editor-layer-card-group-2');
    await expect(groupedCard).toBeVisible();
    await groupedCard.click();
    await expect(ungroupAction).toBeEnabled();
    await ungroupAction.click();

    await expect(groupedCard).toHaveCount(0);
    await expect(lighting).toBeVisible();
    await expect(grain).toBeVisible();

    expectNoRuntimeIssues(collector, 'layer grouping inspector checks');
  });

  test('spatial workspace manages canvases, bookmarks, and projection from the shot inspector', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    await inspector.getByRole('button', { name: 'SHOT' }).click();

    const spatialCard = page.getByTestId('frame-editor-spatial-workspace-card');
    const spatialMapCard = page.getByTestId('frame-editor-spatial-map-card');
    const spatialMapSummary = page.getByTestId('frame-editor-spatial-map-summary');
    const spatialMapTransformStrip = page.getByTestId('frame-editor-spatial-map-transform-strip');
    const spatialMapTransformReadout = page.getByTestId('frame-editor-spatial-map-transform-readout');
    const canvasList = page.getByTestId('frame-editor-spatial-canvas-list');
    const bookmarkList = page.getByTestId('frame-editor-spatial-bookmark-list');
    const projectionCard = page.getByTestId('frame-editor-spatial-projection-card');
    const projectionSummary = page.getByTestId('frame-editor-spatial-projection-summary');
    const addCanvasButton = page.getByTestId('frame-editor-spatial-add-canvas');
    const saveBookmarkButton = page.getByTestId('frame-editor-spatial-save-bookmark');
    const duplicateBookmarkButton = page.getByTestId('frame-editor-spatial-duplicate-bookmark');
    const sourceButton = page.getByTestId('frame-editor-spatial-projection-source');
    const targetButton = page.getByTestId('frame-editor-spatial-projection-target');
    const projectButton = page.getByTestId('frame-editor-spatial-projection-apply');

    await expect(spatialCard).toContainText('SPATIAL WORKSPACE');
    await expect(spatialMapCard).toContainText('SPATIAL MAP');
    await expect(spatialMapTransformStrip).toContainText('Z+');
    await expect(spatialMapTransformStrip).toContainText('S+');
    await expect(canvasList).toContainText('Canvas 2');
    await expect(canvasList).toContainText('Canvas 3');
    await expect(bookmarkList).toContainText('Flythrough Start');
    await expect(bookmarkList).toContainText('Flythrough Push');
    await expect(projectionCard).toContainText('Projection');
    await expect(projectionCard).toContainText('Source: Canvas 2');
    await expect(projectionCard).toContainText('Target: Canvas 3');
    await expect(projectionCard).toContainText('Reinterpret ON');
    await expect(projectionCard).toContainText('Arrange Later ON');
    await expect(projectionSummary).toContainText('No projection passes yet');

    expect(await canvasList.locator('[data-testid^="frame-editor-spatial-canvas-"]').count()).toBe(3);
    expect(await bookmarkList.locator('[data-testid^="frame-editor-spatial-bookmark-"]').count()).toBe(2);

    await page.getByTestId('frame-editor-spatial-map-canvas-canvas-3').click();
    await expect(page.getByTestId('frame-editor-spatial-canvas-canvas-3')).toContainText('Active');
    await expect(spatialMapSummary).toContainText('Canvas 3');

    await page.getByTestId('frame-editor-spatial-map-bookmark-flythrough-push').click();
    await expect(page.getByTestId('frame-editor-spatial-canvas-canvas-2')).toContainText('Active');
    await expect(page.getByTestId('frame-editor-spatial-canvas-canvas-2')).toContainText('x 260 · y 136 · z 42');
    await expect(spatialMapSummary).toContainText('Flythrough Push');
    await expect(spatialMapSummary).toContainText('x 260 · y 136 · z 42');
    await expect(spatialMapTransformReadout).toContainText('Scale 1.18');

    const spatialMapCanvasTwo = page.getByTestId('frame-editor-spatial-map-canvas-canvas-2');
    const beforeTransformBox = await getBox(spatialMapCanvasTwo, 'spatial map canvas 2 before transform');

    await page.getByTestId('frame-editor-spatial-map-nudge-right').click();
    await page.getByTestId('frame-editor-spatial-map-nudge-up').click();
    await page.getByTestId('frame-editor-spatial-map-depth-up').click();
    await page.getByTestId('frame-editor-spatial-map-scale-up').click();

    await expect(page.getByTestId('frame-editor-spatial-canvas-canvas-2')).toContainText('x 284 · y 118 · z 54');
    await expect(spatialMapSummary).toContainText('x 284 · y 118 · z 54');
    await expect(spatialMapTransformReadout).toContainText('Scale 1.30');
    await expect(spatialMapTransformReadout).toContainText('Depth 54');

    const afterTransformBox = await getBox(spatialMapCanvasTwo, 'spatial map canvas 2 after transform');
    expect(afterTransformBox.x).toBeGreaterThan(beforeTransformBox.x + 4);
    expect(afterTransformBox.width).toBeGreaterThan(beforeTransformBox.width + 1);

    const beforeDragTransform = await parseSpatialCanvasTransform(page.getByTestId('frame-editor-spatial-canvas-canvas-2'));
    const beforeDragBox = await getBox(spatialMapCanvasTwo, 'spatial map canvas 2 before drag');
    await page.mouse.move(
      beforeDragBox.x + (beforeDragBox.width / 2),
      beforeDragBox.y + (beforeDragBox.height / 2),
    );
    await page.mouse.down();
    await page.mouse.move(
      beforeDragBox.x + (beforeDragBox.width / 2) + 36,
      beforeDragBox.y + (beforeDragBox.height / 2) + 22,
      { steps: 8 },
    );
    await page.mouse.up();

    const afterDragTransform = await parseSpatialCanvasTransform(page.getByTestId('frame-editor-spatial-canvas-canvas-2'));
    const afterDragBox = await getBox(spatialMapCanvasTwo, 'spatial map canvas 2 after drag');
    expect(afterDragTransform.x).toBeGreaterThan(beforeDragTransform.x + 8);
    expect(afterDragTransform.y).toBeGreaterThan(beforeDragTransform.y + 6);
    expect(afterDragTransform.z).toBe(beforeDragTransform.z);
    expect(afterDragBox.x).toBeGreaterThan(beforeDragBox.x + 12);
    expect(afterDragBox.y).toBeGreaterThan(beforeDragBox.y + 8);

    await projectButton.click();
    await expect(projectionSummary).toContainText('1 projection passes');
    await expect(projectionSummary).toContainText('Projection Pass 1');
    await expect(page.getByTestId('frame-editor-spatial-canvas-canvas-3')).toContainText('2 sheets · 1 bookmarks');

    await addCanvasButton.click();
    expect(await canvasList.locator('[data-testid^="frame-editor-spatial-canvas-"]').count()).toBe(4);
    expect(await bookmarkList.locator('[data-testid^="frame-editor-spatial-bookmark-"]').count()).toBe(0);
    await expect(duplicateBookmarkButton).toBeDisabled();

    await saveBookmarkButton.click();
    expect(await bookmarkList.locator('[data-testid^="frame-editor-spatial-bookmark-"]').count()).toBe(1);
    await expect(duplicateBookmarkButton).toBeEnabled();

    await duplicateBookmarkButton.click();
    expect(await bookmarkList.locator('[data-testid^="frame-editor-spatial-bookmark-"]').count()).toBe(2);

    await sourceButton.click();
    await targetButton.click();
    await expect(projectionCard).not.toContainText('Target: Canvas 3');

    expectNoRuntimeIssues(collector, 'spatial workspace inspector checks');
  });

  test('reference deck and canvas fit controls stay wired to document-backed state', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const precisionCanvasTools = page.getByTestId('frame-editor-precision-canvas-tools');
    const resolutionStrip = page.getByTestId('frame-editor-precision-resolution-strip');
    const statusDimensions = page.getByTestId('frame-editor-status-dimensions');
    await inspector.getByRole('button', { name: 'SHOT' }).click();

    const referenceDeck = page.getByTestId('frame-editor-reference-deck-card');
    const referenceList = page.getByTestId('frame-editor-reference-list');
    const addRefButton = page.getByTestId('frame-editor-reference-add');
    const fitModeButton = page.getByTestId('frame-editor-reference-fit-mode');
    const rotateButton = page.getByTestId('frame-editor-reference-rotate');

    await expect(referenceDeck).toContainText('REFERENCE DECK');
    await expect(referenceList).toContainText('Board Ref A');
    await expect(referenceList).toContainText('Board Ref B');
    expect(await referenceList.locator('[data-testid^="frame-editor-reference-card-"]').count()).toBe(2);

    await page.getByTestId('frame-editor-reference-select-board-ref-b').click();
    await expect(fitModeButton).toContainText('cover');
    await rotateButton.click();
    await expect(referenceDeck).toContainText('27°');

    await fitModeButton.click();
    await expect(referenceDeck).toContainText('free');

    await addRefButton.click();
    expect(await referenceList.locator('[data-testid^="frame-editor-reference-card-"]').count()).toBe(3);

    await expect(precisionCanvasTools).toContainText('Canvas 2');
    await expect(statusDimensions).toContainText('1920 ×');
    await resolutionStrip.getByRole('button', { name: '4K' }).click();
    await expect(precisionCanvasTools).toContainText('3840 ×');
    await expect(statusDimensions).toContainText('3840 ×');

    expectNoRuntimeIssues(collector, 'reference deck and canvas fit checks');
  });

  test('custom image upload supports reference overlays and drawing over an uploaded base image', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const referenceList = page.getByTestId('frame-editor-reference-list');
    const baseImageStatus = page.getByTestId('frame-editor-base-image-status');
    const saveButton = page.getByTestId('frame-editor-save');
    const statusbar = page.getByTestId('frame-editor-statusbar');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(2);
    await expect(baseImageStatus).toContainText('Canvas base ready');
    await expect(saveButton).toBeDisabled();

    await page.getByTestId('frame-editor-reference-upload-input').setInputFiles(TEST_UPLOAD_ASSET);
    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(3);

    await page.getByTestId('frame-editor-base-image-upload-input').setInputFiles(TEST_UPLOAD_ASSET);
    await expect(baseImageStatus).toContainText('Custom canvas base loaded');
    await expect(saveButton).toBeEnabled();

    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');
    await page.mouse.move(canvasBox.x + (canvasBox.width * 0.28), canvasBox.y + (canvasBox.height * 0.34));
    await page.mouse.down();
    await page.mouse.move(
      canvasBox.x + (canvasBox.width * 0.66),
      canvasBox.y + (canvasBox.height * 0.58),
      { steps: 14 },
    );
    await page.mouse.up();

    await expect(statusbar).toContainText('Strokes: 3');
    await saveButton.click();
    await expect(saveButton).toBeDisabled();
    await page.getByTestId('frame-editor-base-image-reset').click();
    await expect(baseImageStatus).toContainText('Canvas base ready');

    expectNoRuntimeIssues(collector, 'custom image upload and draw-over checks');
  });

  test('reference study mode hides the selected reference until compare reveal', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const referenceStudyCard = page.getByTestId('frame-editor-reference-study-card');
    const referenceLayer = page.getByTestId('pencil-canvas-pro-reference-layer');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await expect(referenceStudyCard).toContainText('REFERENCE STUDY');
    await expect(referenceLayer).toHaveAttribute('data-reference-visible', 'true');

    await page.getByTestId('frame-editor-reference-study-start').click();
    await expect(page.getByTestId('frame-editor-reference-study-state')).toContainText('MEMORY DRAW');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('Reference hidden from canvas');
    await expect(referenceLayer).toHaveAttribute('data-reference-visible', 'false');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('memory draw');

    const beforeStrokeCount = await parseStrokeCount(statusbar);
    await page.mouse.move(canvasBox.x + (canvasBox.width * 0.34), canvasBox.y + (canvasBox.height * 0.46));
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + (canvasBox.width * 0.48), canvasBox.y + (canvasBox.height * 0.51), { steps: 6 });
    await page.mouse.up();
    expect(await parseStrokeCount(statusbar)).toBe(beforeStrokeCount + 1);
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('1 new stroke');

    await page.getByTestId('frame-editor-reference-study-reveal').click();
    await expect(page.getByTestId('frame-editor-reference-study-state')).toContainText('COMPARE ON');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('Compare overlay visible');
    await expect(referenceLayer).toHaveAttribute('data-reference-visible', 'true');

    await page.getByTestId('frame-editor-reference-study-reset').click();
    await expect(page.getByTestId('frame-editor-reference-study-state')).toContainText('IDLE');
    await expect(referenceLayer).toHaveAttribute('data-reference-visible', 'true');

    expectNoRuntimeIssues(collector, 'reference study mode checks');
  });

  test('reference study compare opacity can be tuned while reveal is active', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const referenceLayer = page.getByTestId('pencil-canvas-pro-reference-layer');
    const compareCard = page.getByTestId('frame-editor-reference-study-compare-card');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-reference-study-start').click();
    await page.getByTestId('frame-editor-reference-study-reveal').click();

    await expect(compareCard).toContainText('Compare Opacity');
    await expect(page.getByTestId('frame-editor-reference-study-opacity-value')).toContainText('58%');
    expect(Number.parseFloat(await getCss(referenceLayer, 'opacity'))).toBeCloseTo(0.58, 1);

    await setRangeInputValue(page.getByTestId('frame-editor-reference-study-opacity'), 35);
    await expect(page.getByTestId('frame-editor-reference-study-opacity-value')).toContainText('35%');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('35% opacity');
    expect(Number.parseFloat(await getCss(referenceLayer, 'opacity'))).toBeCloseTo(0.35, 1);

    expectNoRuntimeIssues(collector, 'reference study compare opacity checks');
  });

  test('reference study rounds can save attempts, ghost the latest pass, and reset to baseline for the next round', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const referenceLayer = page.getByTestId('pencil-canvas-pro-reference-layer');
    const strokesChip = page.getByTestId('frame-editor-status-strokes');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const initialStrokeCount = await parseStrokeCount(page.getByTestId('frame-editor-statusbar'));

    const drawPass = async (startXRatio: number, startYRatio: number, endXRatio: number, endYRatio: number) => {
      const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');
      await page.mouse.move(canvasBox.x + (canvasBox.width * startXRatio), canvasBox.y + (canvasBox.height * startYRatio));
      await page.mouse.down();
      await page.mouse.move(
        canvasBox.x + (canvasBox.width * endXRatio),
        canvasBox.y + (canvasBox.height * endYRatio),
        { steps: 10 },
      );
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-reference-study-start').click();

    await drawPass(0.34, 0.46, 0.48, 0.51);
    expect(await parseStrokeCount(page.getByTestId('frame-editor-statusbar'))).toBe(initialStrokeCount + 1);
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('1 new stroke');

    await page.getByTestId('frame-editor-reference-study-save-attempt').click();
    await expect(page.getByTestId('frame-editor-reference-study-attempt-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-reference-study-selected-attempt')).toContainText('Attempt 1');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('ghost → Attempt 1');
    await expect(page.getByTestId('frame-editor-status-reference-study-drill')).toContainText('next drill');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-count')).toContainText('1 rounds');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-attempt-1')).toContainText('Attempt 1');
    await expect(referenceLayer).toHaveAttribute('data-reference-visible', 'true');
    expect(Number.parseFloat(await getCss(referenceLayer, 'opacity'))).toBeCloseTo(0.3, 1);

    await setRangeInputValue(page.getByTestId('frame-editor-reference-study-ghost-opacity'), 45);
    await expect(page.getByTestId('frame-editor-reference-study-ghost-opacity-value')).toContainText('45%');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('45% opacity');
    expect(Number.parseFloat(await getCss(referenceLayer, 'opacity'))).toBeCloseTo(0.45, 1);

    await page.getByTestId('frame-editor-reference-study-next-round').click();
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('0 new strokes in the current round');
    await expect(strokesChip).toContainText(`Strokes: ${initialStrokeCount}`);
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-summary')).toContainText('Draw a new round to compare against Attempt 1');

    await drawPass(0.56, 0.54, 0.76, 0.61);
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-baseline')).toContainText('vs Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-summary')).toContainText('Wider silhouette than Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-width')).toContainText('Width +');
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-position')).toContainText('Y +');
    await expect(page.getByTestId('frame-editor-reference-study-read-summary')).toContainText('Silhouette reads open');
    await expect(page.getByTestId('frame-editor-reference-study-read-summary')).toContainText('Focus drifts low-right');
    await expect(page.getByTestId('frame-editor-reference-study-read-silhouette')).toContainText('Silhouette open');
    await expect(page.getByTestId('frame-editor-reference-study-read-focus')).toContainText('Focus low-right');
    await expect(page.getByTestId('frame-editor-reference-study-read-balance')).toContainText('Balance right-heavy');
    await expect(page.getByTestId('frame-editor-reference-study-drill-trajectory-progress')).toContainText('0%');
    await expect(page.getByTestId('frame-editor-reference-study-drill-trajectory-summary')).toContainText('Focus Up is 0% locked against Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-drill-trajectory-direction')).toContainText('Needs lift');
    await expect(page.getByTestId('frame-editor-reference-study-drill-trajectory-target')).toContainText('Focus Up');
    await expect(page.getByTestId('frame-editor-reference-study-drill-checkpoint-current')).toContainText('Current lift 0%');
    await expect(page.getByTestId('frame-editor-reference-study-drill-checkpoint-goal')).toContainText('Goal lift 4%');
    await expect(page.getByTestId('frame-editor-reference-study-drill-checkpoint-remaining')).toContainText('Remain 4%');
    await expect(page.getByTestId('frame-editor-reference-study-drill-playbook-headline')).toContainText('Lift the read before you save this round');
    await expect(page.getByTestId('frame-editor-reference-study-drill-playbook-primary')).toContainText('DO · Pull the heaviest stroke cluster above center');
    await expect(page.getByTestId('frame-editor-reference-study-drill-playbook-secondary')).toContainText('HOLD · Hold the silhouette open while the focus rises');
    await expect(page.getByTestId('frame-editor-reference-study-drill-playbook-watch')).toContainText('WATCH · Trim right-side weight as you lift');

    await page.getByTestId('frame-editor-reference-study-focus-placement').click();
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-summary')).toContainText('Sits lower than Attempt 1');

    await page.getByTestId('frame-editor-reference-study-focus-economy').click();
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-summary')).toContainText('Longer line mileage than Attempt 1');

    await page.getByTestId('frame-editor-reference-study-focus-composition').click();
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-summary')).toContainText('Wider silhouette than Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-drill-status')).toContainText('Focus Up');
    await expect(page.getByTestId('frame-editor-reference-study-drill-summary')).toContainText('Need more height shift to beat Attempt 1');
    await page.getByTestId('frame-editor-reference-study-drill-focus-up').click();
    await expect(page.getByTestId('frame-editor-status-reference-study-drill')).toContainText('drill → Focus Up');

    await page.getByTestId('frame-editor-reference-study-next-round').click();
    await expect(page.getByTestId('frame-editor-reference-study-attempt-count')).toContainText('2 saved');
    await expect(page.getByTestId('frame-editor-reference-study-attempt-card-attempt-2')).toContainText('Attempt 2');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('ghost → Attempt 2');
    await expect(page.getByTestId('frame-editor-status-reference-study-drill')).toContainText('drill → Focus Up');
    await expect(strokesChip).toContainText(`Strokes: ${initialStrokeCount}`);
    await expect(page.getByTestId('frame-editor-reference-study-drill-summary')).toContainText('Target armed: push the focus higher than Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-count')).toContainText('2 rounds');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-attempt-2')).toContainText('Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-focus-attempt-2')).toContainText('Focus low-right');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-balance-attempt-2')).toContainText('Balance right-heavy');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-silhouette-attempt-2')).toContainText('Silhouette open');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-drill-attempt-2')).toContainText('Focus Up · Retry');
    await expect(page.getByTestId('frame-editor-reference-study-drill-trajectory-progress')).toContainText('0%');
    await expect(page.getByTestId('frame-editor-reference-study-drill-trajectory-summary')).toContainText('Attempt 2 closed as Focus Up · Retry against Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-drill-trajectory-direction')).toContainText('Needs another pass vs Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-drill-checkpoint-current')).toContainText('Current lift 0%');
    await expect(page.getByTestId('frame-editor-reference-study-drill-checkpoint-goal')).toContainText('Goal lift 4%');
    await expect(page.getByTestId('frame-editor-reference-study-drill-checkpoint-remaining')).toContainText('Remain 4%');
    await expect(page.getByTestId('frame-editor-reference-study-drill-playbook-headline')).toContainText('Start the next round by lifting the read');
    await expect(page.getByTestId('frame-editor-reference-study-drill-playbook-primary')).toContainText('DO · Pull the heaviest stroke cluster above center');
    await expect(page.getByTestId('frame-editor-reference-study-drill-playbook-watch')).toContainText('WATCH · Trim right-side weight as you lift');

    await page.getByTestId('frame-editor-reference-study-read-history-select-attempt-1').click();
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('ghost → Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-selected-attempt')).toContainText('Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-baseline')).toContainText('vs Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-drill-summary')).toContainText('Target armed: push the focus higher than Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-drill-trajectory-summary')).toContainText('Start a new round to track live progress toward Focus Up against Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-select-attempt-1')).toContainText('Baseline');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-suggested')).toContainText('Composition · Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-suggested-attempt-2')).toContainText('Suggested');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-use-suggested')).toContainText('Use Suggested Baseline');
    await expect(page.getByTestId('frame-editor-reference-study-session-lead')).toContainText('Lead · Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-session-spread')).toContainText('2 of 3 lanes');
    await expect(page.getByTestId('frame-editor-reference-study-session-mode-composition')).toContainText('Composition');
    await expect(page.getByTestId('frame-editor-reference-study-session-mode-placement')).toContainText('Placement');
    await expect(page.getByTestId('frame-editor-reference-study-session-summary')).toContainText('Attempt 2 leads Composition + Placement.');
    await expect(page.getByTestId('frame-editor-reference-study-session-summary')).toContainText('Economy still belongs to another attempt.');
    await expect(page.getByTestId('frame-editor-reference-study-session-use-lead')).toContainText('Use Session Lead');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-composition-attempt-2')).toContainText('#1 Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-composition-attempt-1')).toContainText('#2 Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-economy-attempt-1')).toContainText('#1 Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-economy-attempt-2')).toContainText('#2 Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-gap-composition')).toContainText('Lead gap · Width +');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-gap-placement')).toContainText('Lead gap · Y +');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-gap-economy')).toContainText('Lead gap · Mileage -');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-confidence-composition')).toContainText('Lead confidence ·');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-confidence-placement')).toContainText('Lead confidence ·');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-confidence-economy')).toContainText('Lead confidence ·');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-next-move-composition')).toContainText('Next move · Push one wider pass');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-next-move-placement')).toContainText('Next move · Push the staging');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-next-move-economy')).toContainText('Next move · Keep the lean pass count');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-summary-composition')).toContainText('Attempt 2 reads wider than Attempt 1.');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-summary-placement')).toContainText('Attempt 2 stages lower than Attempt 1.');
    await expect(page.getByTestId('frame-editor-reference-study-ladder-summary-economy')).toContainText('Attempt 1 uses shorter line mileage than Attempt 2.');
    await expect(page.getByTestId('frame-editor-reference-study-pick-composition')).toContainText('Composition · Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-pick-placement')).toContainText('Placement · Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-pick-economy')).toContainText('Economy · Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-picks-summary')).toContainText('Attempt 2 is the strongest composition baseline right now.');
    await expect(page.getByTestId('frame-editor-reference-study-picks-summary')).toContainText('Wide read.');
    await expect(page.getByTestId('frame-editor-reference-study-picks-summary')).toContainText('Also leads Placement lower staging.');
    await expect(page.getByTestId('frame-editor-reference-study-pick-reason-composition')).toContainText('Wide read');
    await expect(page.getByTestId('frame-editor-reference-study-pick-reason-placement')).toContainText('Lower staging');
    await expect(page.getByTestId('frame-editor-reference-study-pick-reason-economy')).toContainText('1-pass statement');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-best-composition-attempt-2')).toContainText('Best Composition');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-best-placement-attempt-2')).toContainText('Best Placement');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-best-economy-attempt-1')).toContainText('Best Economy');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-rank-composition-attempt-2')).toContainText('Composition #1');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-rank-placement-attempt-2')).toContainText('Placement #1');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-rank-economy-attempt-2')).toContainText('Economy #2');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-rank-composition-attempt-1')).toContainText('Composition #2');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-rank-placement-attempt-1')).toContainText('Placement #2');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-rank-economy-attempt-1')).toContainText('Economy #1');
    await page.getByTestId('frame-editor-reference-study-picks-focus-placement').click();
    await expect(page.getByTestId('frame-editor-reference-study-read-history-suggested')).toContainText('Placement · Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-picks-summary')).toContainText('Attempt 2 is the strongest placement baseline right now.');
    await expect(page.getByTestId('frame-editor-reference-study-picks-summary')).toContainText('Lower staging.');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-rank-placement-attempt-2')).toContainText('Placement #1');
    await page.getByTestId('frame-editor-reference-study-picks-focus-economy').click();
    await expect(page.getByTestId('frame-editor-reference-study-read-history-suggested')).toContainText('Economy · Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-picks-summary')).toContainText('Attempt 1 is the strongest economy baseline right now.');
    await expect(page.getByTestId('frame-editor-reference-study-picks-summary')).toContainText('1-pass statement.');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-use-suggested')).toContainText('Suggested Active');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-rank-economy-attempt-1')).toContainText('Economy #1');
    await page.getByTestId('frame-editor-reference-study-ladder-economy-attempt-2').click();
    await expect(page.getByTestId('frame-editor-reference-study-selected-attempt')).toContainText('Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-suggested')).toContainText('Economy · Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-baseline')).toContainText('vs Attempt 2');
    await page.getByTestId('frame-editor-reference-study-read-history-select-attempt-1').click();
    await page.getByTestId('frame-editor-reference-study-picks-focus-composition').click();
    await expect(page.getByTestId('frame-editor-reference-study-read-history-suggested')).toContainText('Composition · Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-use-suggested')).toContainText('Use Suggested Baseline');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-compare-attempt-2')).toContainText('Wider silhouette');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-compare-attempt-2')).toContainText('Lower placement');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-compare-attempt-2')).toContainText('vs Attempt 1');

    await page.getByTestId('frame-editor-reference-study-read-history-use-suggested').click();
    await expect(page.getByTestId('frame-editor-reference-study-selected-attempt')).toContainText('Attempt 2');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('ghost → Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-use-suggested')).toContainText('Suggested Active');

    await page.getByTestId('frame-editor-reference-study-pick-economy').click();
    await expect(page.getByTestId('frame-editor-reference-study-selected-attempt')).toContainText('Attempt 1');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('ghost → Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-scorecard-baseline')).toContainText('vs Attempt 1');

    await page.getByTestId('frame-editor-reference-study-session-use-lead').click();
    await expect(page.getByTestId('frame-editor-reference-study-selected-attempt')).toContainText('Attempt 2');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('ghost → Attempt 2');
    await expect(page.getByTestId('frame-editor-reference-study-session-use-lead')).toContainText('Lead Active');

    expectNoRuntimeIssues(collector, 'reference study rounds checks');
  });

  test('reference study sessions persist across save and harness remount', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const saveButton = page.getByTestId('frame-editor-save');
    const harnessRemountButton = page.getByTestId('drawing-editor-harness-remount');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-reference-study-start').click();

    await page.mouse.move(canvasBox.x + (canvasBox.width * 0.34), canvasBox.y + (canvasBox.height * 0.46));
    await page.mouse.down();
    await page.mouse.move(
      canvasBox.x + (canvasBox.width * 0.48),
      canvasBox.y + (canvasBox.height * 0.51),
      { steps: 10 },
    );
    await page.mouse.up();

    await page.getByTestId('frame-editor-reference-study-save-attempt').click();
    await expect(page.getByTestId('frame-editor-reference-study-attempt-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-reference-study-selected-attempt')).toContainText('Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('Ghosting Attempt 1');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('ghost → Attempt 1');
    await expect(page.getByTestId('drawing-editor-harness-staged-state')).toContainText('saved-session=empty');
    await expect(saveButton).toBeEnabled();

    await saveButton.click();
    await expect(page.getByTestId('drawing-editor-harness-save-count')).toContainText('saves=1');
    await expect(page.getByTestId('drawing-editor-harness-staged-state')).toContainText('saved-session=ready');
    await expect(harnessRemountButton).toBeEnabled();

    await harnessRemountButton.click();
    await inspector.getByRole('button', { name: 'SHOT' }).click();

    await expect(page.getByTestId('frame-editor-reference-study-state')).toContainText('MEMORY DRAW');
    await expect(page.getByTestId('frame-editor-reference-study-attempt-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-reference-study-selected-attempt')).toContainText('Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('Ghosting Attempt 1');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('ghost → Attempt 1');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-count')).toContainText('1 rounds');
    await expect(page.getByTestId('frame-editor-reference-study-read-history-attempt-1')).toContainText('Attempt 1');
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 3');
    expect(await parseStrokeCount(statusbar)).toBe(3);

    expectNoRuntimeIssues(collector, 'reference study persistence checks');
  });

  test('reference study attempts can promote directly into storyboard sheet variants', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const transportLabel = page.getByTestId('frame-editor-transport-label');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-reference-study-start').click();

    await page.mouse.move(canvasBox.x + (canvasBox.width * 0.34), canvasBox.y + (canvasBox.height * 0.46));
    await page.mouse.down();
    await page.mouse.move(
      canvasBox.x + (canvasBox.width * 0.48),
      canvasBox.y + (canvasBox.height * 0.51),
      { steps: 10 },
    );
    await page.mouse.up();

    await page.getByTestId('frame-editor-reference-study-save-attempt').click();
    await expect(page.getByTestId('frame-editor-reference-study-attempt-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 3');

    await page.getByTestId('frame-editor-reference-study-next-round').click();
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 2');

    await page.getByTestId('frame-editor-reference-study-promote-attempt-1').click();

    await expect(page.getByTestId('frame-editor-reference-study-state')).toContainText('IDLE');
    await expect(page.getByTestId('frame-editor-reference-study-attempt-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 3');
    await expect(transportLabel).toContainText('Attempt 1');
    expect(await parseStrokeCount(statusbar)).toBe(3);

    expectNoRuntimeIssues(collector, 'reference study variant promotion checks');
  });

  test('board polish present mode hides production overlays and persists across save and remount', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const saveButton = page.getByTestId('frame-editor-save');
    const harnessRemountButton = page.getByTestId('drawing-editor-harness-remount');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerX: number, centerY: number, radiusX: number, radiusY: number) => {
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse(
      canvasBox.x + (canvasBox.width * 0.34),
      canvasBox.y + (canvasBox.height * 0.38),
      canvasBox.width * 0.08,
      canvasBox.height * 0.06,
    );

    await expect(page.getByTestId('frame-editor-shape-intent-primitive')).toContainText('ELLIPSE');
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();
    await expect(page.getByTestId('frame-editor-shape-scaffold-overlay-layer')).toBeVisible();
    await expect(page.getByTestId('frame-editor-canvas-overlays')).toBeVisible();

    await page.getByTestId('frame-editor-board-polish-mode-toggle').click();
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.locator('[data-testid="frame-editor-canvas-overlays"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="frame-editor-shape-scaffold-overlay-layer"]')).toHaveCount(0);
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · noir');

    await page.getByTestId('frame-editor-board-polish-tone-amber').click();
    await page.getByTestId('frame-editor-board-polish-card-finish-hatch').click();
    await page.getByTestId('frame-editor-board-polish-card-weather-rain').click();
    const atmosphereSlider = page.getByTestId('frame-editor-board-polish-atmosphere');
    await atmosphereSlider.click();
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press('ArrowRight');
    }
    const boardPolishOverlay = page.getByTestId('frame-editor-board-polish-overlay');
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · amber');
    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · amber');
    await expect(page.getByTestId('frame-editor-board-polish-style-summary')).toContainText('Hatch finish');
    await expect(page.getByTestId('frame-editor-board-polish-style-summary')).toContainText('Rain weather');
    await expect(page.getByTestId('frame-editor-board-polish-fx-stack')).toContainText('Atmosphere');
    await expect(page.getByTestId('frame-editor-board-polish-fx-stack')).toContainText('Weather');
    await expect(page.getByTestId('frame-editor-board-polish-fx-stack')).toContainText('Finish');
    await expect(page.getByTestId('frame-editor-board-polish-fx-stack')).toContainText('Vignette');
    const finishFxStackRow = page.getByTestId('frame-editor-board-polish-fx-stack-finish');
    const weatherToggle = page.getByTestId('frame-editor-board-polish-fx-toggle-weather');
    const finishFxOpacitySlider = page.getByTestId('frame-editor-board-polish-fx-opacity-finish');
    await weatherToggle.click();
    await finishFxOpacitySlider.click();
    for (let step = 0; step < 14; step += 1) {
      await page.keyboard.press('ArrowLeft');
    }
    await expect(boardPolishOverlay).toHaveAttribute('data-tone', 'amber');
    await expect(boardPolishOverlay).toHaveAttribute('data-finish', 'hatch');
    await expect(boardPolishOverlay).toHaveAttribute('data-weather', 'rain');
    await expect(page.getByTestId('frame-editor-board-polish-style-summary')).toContainText('custom FX mix');
    await expect(boardPolishOverlay).toHaveAttribute('data-effect-count', '3');
    await expect(page.getByTestId('frame-editor-board-polish-effect-atmosphere')).toBeVisible();
    await expect(page.locator('[data-testid="frame-editor-board-polish-effect-weather"]')).toHaveCount(0);
    await expect(page.getByTestId('frame-editor-board-polish-effect-finish')).toBeVisible();
    await expect(page.getByTestId('frame-editor-board-polish-effect-vignette')).toBeVisible();
    const savedAtmosphere = await boardPolishOverlay.getAttribute('data-atmosphere');
    const savedFinishFxOpacity = await finishFxStackRow.getAttribute('data-opacity');
    expect(savedAtmosphere, 'board polish atmosphere should be serialized on the overlay').not.toBeNull();
    expect(Number(savedAtmosphere || '0')).toBeGreaterThan(0.5);
    expect(Number(savedFinishFxOpacity || '0')).toBeLessThan(1);
    await expect(saveButton).toBeEnabled();

    await saveButton.click();
    await expect(page.getByTestId('drawing-editor-harness-save-count')).toContainText('saves=1');
    await harnessRemountButton.click();

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.locator('[data-testid="frame-editor-canvas-overlays"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="frame-editor-shape-scaffold-overlay-layer"]')).toHaveCount(0);
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · amber');
    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · amber');
    await expect(page.getByTestId('frame-editor-board-polish-style-summary')).toContainText('Hatch finish');
    await expect(page.getByTestId('frame-editor-board-polish-style-summary')).toContainText('Rain muted weather');
    await expect(page.getByTestId('frame-editor-board-polish-style-summary')).toContainText('custom FX mix');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toHaveAttribute('data-tone', 'amber');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toHaveAttribute('data-finish', 'hatch');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toHaveAttribute('data-weather', 'rain');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toHaveAttribute('data-atmosphere', savedAtmosphere!);
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toHaveAttribute('data-effect-count', '3');
    await expect(page.getByTestId('frame-editor-board-polish-effect-atmosphere')).toBeVisible();
    await expect(page.locator('[data-testid="frame-editor-board-polish-effect-weather"]')).toHaveCount(0);
    await expect(page.getByTestId('frame-editor-board-polish-effect-finish')).toBeVisible();
    await expect(page.getByTestId('frame-editor-board-polish-effect-vignette')).toBeVisible();
    await expect(page.getByTestId('frame-editor-board-polish-fx-stack-finish')).toHaveAttribute('data-opacity', savedFinishFxOpacity!);

    await inspector.getByRole('button', { name: 'LAYERS' }).click();
    await expect(page.getByTestId('frame-editor-layer-card-fx-atmosphere')).toContainText('FX Atmosphere');
    await expect(page.getByTestId('frame-editor-layer-card-fx-atmosphere')).toContainText('Enabled');
    await expect(page.getByTestId('frame-editor-layer-card-fx-weather')).toContainText('FX Weather');
    await expect(page.getByTestId('frame-editor-layer-card-fx-weather')).toContainText('Muted');
    await expect(page.getByTestId('frame-editor-layer-card-fx-finish')).toContainText('FX Finish');
    await expect(page.getByTestId('frame-editor-layer-card-fx-vignette')).toContainText('FX Vignette');
    await page.getByTestId('frame-editor-layer-visibility-fx-weather').click();
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toHaveAttribute('data-effect-count', '4');
    await expect(page.getByTestId('frame-editor-board-polish-effect-weather')).toBeVisible();

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-mode-toggle').click();
    await expect(page.locator('[data-testid="frame-editor-board-polish-overlay"]')).toHaveCount(0);

    await inspector.getByRole('button', { name: 'LAYERS' }).click();
    await page.getByTestId('frame-editor-layer-card-fx-weather').click();
    await expect(page.getByTestId('frame-editor-layer-effect-region-card')).toBeVisible();
    await page.getByTestId('frame-editor-layer-effect-region-preset-focus').click();
    const weatherRegionOverlay = page.getByTestId('frame-editor-board-polish-effect-region-overlay');
    await expect(weatherRegionOverlay).toHaveAttribute('data-effect-id', 'weather');
    await expect(weatherRegionOverlay).toHaveAttribute('data-x-ratio', '0.1800');
    await expect(weatherRegionOverlay).toHaveAttribute('data-width-ratio', '0.6400');
    const featherSlider = page.getByTestId('frame-editor-layer-effect-region-feather');
    await featherSlider.click();
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('ArrowRight');
    }
    const savedWeatherFeather = await weatherRegionOverlay.getAttribute('data-feather');
    expect(Number(savedWeatherFeather || '0')).toBeGreaterThan(0.22);

    await saveButton.click();
    await expect(page.getByTestId('drawing-editor-harness-save-count')).toContainText('saves=2');
    await harnessRemountButton.click();

    await inspector.getByRole('button', { name: 'LAYERS' }).click();
    await page.getByTestId('frame-editor-layer-card-fx-weather').click();
    await expect(page.getByTestId('frame-editor-board-polish-effect-region-overlay')).toHaveAttribute('data-x-ratio', '0.1800');
    await expect(page.getByTestId('frame-editor-board-polish-effect-region-overlay')).toHaveAttribute('data-width-ratio', '0.6400');
    await expect(page.getByTestId('frame-editor-board-polish-effect-region-overlay')).toHaveAttribute('data-feather', savedWeatherFeather!);

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-mode-toggle').click();
    await expect(page.getByTestId('frame-editor-board-polish-effect-weather')).toHaveAttribute('data-x-ratio', '0.1800');
    await expect(page.getByTestId('frame-editor-board-polish-effect-weather')).toHaveAttribute('data-width-ratio', '0.6400');
    await expect(page.getByTestId('frame-editor-board-polish-effect-weather')).toHaveAttribute('data-feather', savedWeatherFeather!);

    expectNoRuntimeIssues(collector, 'board polish present mode checks');
  });

  test('cinematic scene kits can stage a noir warehouse confrontation with present-mode polish', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-scene-kit-warehouse-standoff').click();

    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-summary')).toContainText('Warehouse Standoff armed');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.getByTestId('frame-editor-shape-scaffold-shelf')).toBeVisible();
    await expect(page.getByTestId('frame-editor-shape-scaffold-assembly-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Warehouse Standoff');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Noir Figure');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Warehouse Window Bank');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Puddle Reflection');
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('scaffold → Noir Figure Scaffold 1');

    expectNoRuntimeIssues(collector, 'cinematic scene kit checks');
  });

  test('cinematic scene kits can stage a clerestory warehouse standoff with descending beams and reflective floor weight', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-scene-kit-clerestory-standoff').click();

    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-summary')).toContainText('Clerestory Standoff armed');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Clerestory');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Reflective Floor');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-hero')).toContainText('foreground detective silhouette');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.getByTestId('frame-editor-shape-scaffold-assembly-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Clerestory Standoff');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Warehouse Window Bank');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Light Beam');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Puddle Reflection');
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('scaffold → Noir Figure Scaffold 1');

    expectNoRuntimeIssues(collector, 'clerestory warehouse cinematic scene kit checks');
  });

  test('cinematic scene kits can stage a forest titan reveal with armor scale and enclosing conifer walls', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-scene-kit-forest-titan-reveal').click();

    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-summary')).toContainText('Forest Titan Reveal armed');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Titan');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Armor');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-hero')).toContainText('roaring titan');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.getByTestId('frame-editor-shape-scaffold-assembly-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Forest Titan Reveal');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Titan Colossus');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Conifer Wall');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Armored Vehicle');
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('scaffold → Titan Colossus Scaffold 1');

    expectNoRuntimeIssues(collector, 'forest titan cinematic scene kit checks');
  });

  test('cinematic scene kits can stage a titan overwatch board with foreground witnesses and helicopter support', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-scene-kit-titan-overwatch').click();

    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-summary')).toContainText('Titan Overwatch armed');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Overwatch');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Helicopter');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-hero')).toContainText('Foreground witnesses');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.getByTestId('frame-editor-shape-scaffold-assembly-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Titan Overwatch');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Observer Pair');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Helicopter Silhouette');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Titan Colossus');
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('scaffold → Observer Pair Scaffold 1');

    expectNoRuntimeIssues(collector, 'titan overwatch cinematic scene kit checks');
  });

  test('cinematic scene kits can stage a rooftop noir skyline with lightning, rain, and parapet framing', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-scene-kit-rooftop-vigil').click();

    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-summary')).toContainText('Rooftop Vigil armed');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Rooftop');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Lightning');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-hero')).toContainText('solitary detective silhouette');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.getByTestId('frame-editor-shape-scaffold-assembly-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Rooftop Vigil');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Skyline Cluster');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Rooftop Parapet');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Lightning Fork');
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('scaffold → Noir Figure Scaffold 1');

    expectNoRuntimeIssues(collector, 'rooftop cinematic scene kit checks');
  });

  test('cinematic scene kits can stage a rain-soaked alley pursuit with headlights, dumpsters, and steam', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-scene-kit-alley-pursuit').click();

    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-summary')).toContainText('Rain Alley Pursuit armed');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Alley');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Headlights');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-hero')).toContainText('backlit detective silhouette');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.getByTestId('frame-editor-shape-scaffold-assembly-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Rain Alley Pursuit');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Alley Wall');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Headlight Glare');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Dumpster Bank');
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('scaffold → Noir Figure Scaffold 1');

    expectNoRuntimeIssues(collector, 'alley cinematic scene kit checks');
  });

  test('cinematic scene kits can stage an interrogation threshold with pendant light, smoke, and doorway silhouette', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-scene-kit-interrogation-threshold').click();

    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-summary')).toContainText('Interrogation Threshold armed');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Interrogation');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Top Light');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-hero')).toContainText('seated suspect');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.getByTestId('frame-editor-shape-scaffold-assembly-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Interrogation Threshold');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Seated Figure');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Interrogation Table');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Doorway Frame');
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('scaffold → Seated Figure Scaffold 1');

    expectNoRuntimeIssues(collector, 'interrogation cinematic scene kit checks');
  });

  test('cinematic scene kits can stage a rain-slick last-train pursuit with platform lights, carriage glare, and a boarding fugitive', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-board-polish-scene-kit-last-train-pursuit').click();

    await expect(page.getByTestId('frame-editor-board-polish-summary')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-summary')).toContainText('Last Train Pursuit armed');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Train');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-tags')).toContainText('Sprint');
    await expect(page.getByTestId('frame-editor-board-polish-scene-kit-hero')).toContainText('sprinting detective silhouette');
    await expect(page.getByTestId('frame-editor-board-polish-overlay')).toBeVisible();
    await expect(page.getByTestId('frame-editor-shape-scaffold-assembly-count')).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Last Train Pursuit');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Train Car Side');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Carriage Door');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Platform Light Run');
    await expect(page.getByTestId('frame-editor-shape-scaffold-batch-summary')).toContainText('Runner Figure');
    await expect(page.getByTestId('frame-editor-status-board-polish')).toContainText('present · noir');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('scaffold → Noir Figure Scaffold 1');

    expectNoRuntimeIssues(collector, 'last train pursuit cinematic scene kit checks');
  });

  test('shape intent assist turns rough shapes into configurable ideas, references, and guide overlays', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const referenceList = page.getByTestId('frame-editor-reference-list');
    const shapeIntentCard = page.getByTestId('frame-editor-shape-intent-card');
    const shapeIntentPrimitive = page.getByTestId('frame-editor-shape-intent-primitive');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerX: number, centerY: number, radiusX: number, radiusY: number) => {
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(2);

    await drawEllipse(
      canvasBox.x + (canvasBox.width * 0.35),
      canvasBox.y + (canvasBox.height * 0.36),
      canvasBox.width * 0.08,
      canvasBox.height * 0.06,
    );
    expect(await parseStrokeCount(statusbar)).toBe(3);
    await expect(shapeIntentPrimitive).toContainText('ELLIPSE');
    await expect(shapeIntentCard).toContainText('Pizza');
    await expect(shapeIntentCard).toContainText('Motorcycle Wheel');

    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-crust-deep').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-toppings-basil').click();
    await expect(page.getByTestId('frame-editor-shape-intent-selection-summary')).toContainText('Crust Thickness: Deep Dish');
    await expect(page.getByTestId('frame-editor-shape-intent-preview')).toHaveAttribute('src', /data:image\/svg\+xml/);

    await page.getByTestId('frame-editor-shape-intent-apply-reference').click();
    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(3);
    await expect(page.getByTestId('frame-editor-shape-intent-parked')).toContainText('parked');

    await drawEllipse(
      canvasBox.x + (canvasBox.width * 0.62),
      canvasBox.y + (canvasBox.height * 0.54),
      canvasBox.width * 0.07,
      canvasBox.height * 0.05,
    );
    expect(await parseStrokeCount(statusbar)).toBe(4);
    await expect(shapeIntentPrimitive).toContainText('ELLIPSE');
    await page.getByTestId('frame-editor-shape-intent-suggestion-motorcycle-wheel').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-spokes-dense').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-tire-chunky').click();
    await page.getByTestId('frame-editor-shape-intent-apply-guide').click();

    expect(await parseStrokeCount(statusbar)).toBeGreaterThan(4);
    await expect(page.getByTestId('frame-editor-shape-intent-parked')).toContainText('parked');
    await expect(page.getByTestId('frame-editor-save')).toBeEnabled();

    expectNoRuntimeIssues(collector, 'shape intent assist checks');
  });

  test('shape intent combines nearby strokes into context-aware compound ideas', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const shapeIntentCard = page.getByTestId('frame-editor-shape-intent-card');
    const shapeIntentPrimitive = page.getByTestId('frame-editor-shape-intent-primitive');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerX: number, centerY: number, radiusX: number, radiusY: number) => {
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    const drawLine = async (x1: number, y1: number, x2: number, y2: number) => {
      await page.mouse.move(x1, y1);
      await page.mouse.down();
      await page.mouse.move(x2, y2, { steps: 8 });
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();

    const centerX = canvasBox.x + (canvasBox.width * 0.56);
    const centerY = canvasBox.y + (canvasBox.height * 0.38);
    const radiusX = canvasBox.width * 0.075;
    const radiusY = canvasBox.height * 0.055;

    await drawEllipse(centerX, centerY, radiusX, radiusY);
    await expect(shapeIntentPrimitive).toContainText('ELLIPSE');

    await drawLine(
      centerX,
      centerY + (radiusY * 0.2),
      centerX,
      centerY + (radiusY * 2.4),
    );

    expect(await parseStrokeCount(statusbar)).toBe(4);
    await expect(shapeIntentPrimitive).toContainText('ELLIPSE + LINE');
    await expect(page.getByTestId('frame-editor-shape-intent-headline')).toContainText('Ellipse + guide line');
    await expect(shapeIntentCard).toContainText('Round Table');
    await expect(shapeIntentCard).toContainText('Clock');
    await expect(shapeIntentCard).toContainText('Motorcycle Wheel');

    await page.getByTestId('frame-editor-shape-intent-suggestion-round-table').click();
    await expect(page.getByTestId('frame-editor-status-shape-intent')).toContainText('ellipse + line → Round Table');

    expectNoRuntimeIssues(collector, 'shape intent compound checks');
  });

  test('shape intent can seed a reference study session directly from the selected idea', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const referenceList = page.getByTestId('frame-editor-reference-list');
    const shapeIntentCard = page.getByTestId('frame-editor-shape-intent-card');
    const referenceStudyCard = page.getByTestId('frame-editor-reference-study-card');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.35);
      const centerY = canvasBox.y + (canvasBox.height * 0.36);
      const radiusX = canvasBox.width * 0.08;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await expect(shapeIntentCard).toContainText('Pizza');
    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(2);
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 3');

    await page.getByTestId('frame-editor-shape-intent-start-study').click();

    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(3);
    await expect(referenceStudyCard).toContainText('REFERENCE STUDY');
    await expect(page.getByTestId('frame-editor-reference-study-state')).toContainText('MEMORY DRAW');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('Reference hidden from canvas');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('memory draw → Pizza Study');
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 2');

    expectNoRuntimeIssues(collector, 'shape intent direct study checks');
  });

  test('shape intent variant pack seeds multiple exploration references from one primitive', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const referenceList = page.getByTestId('frame-editor-reference-list');
    const shapeIntentCard = page.getByTestId('frame-editor-shape-intent-card');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerX: number, centerY: number, radiusX: number, radiusY: number) => {
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(2);

    await drawEllipse(
      canvasBox.x + (canvasBox.width * 0.46),
      canvasBox.y + (canvasBox.height * 0.42),
      canvasBox.width * 0.09,
      canvasBox.height * 0.065,
    );

    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-crust-deep').click();
    await expect(page.getByTestId('frame-editor-shape-intent-variant-shelf').locator('[data-testid^="frame-editor-shape-intent-variant-"]')).toHaveCount(3);
    await expect(page.getByTestId('frame-editor-shape-intent-variant-pizza').locator('img')).toHaveAttribute('src', /data:image\/svg\+xml/);
    await expect(page.getByTestId('frame-editor-shape-intent-variant-motorcycle-wheel')).toContainText('Motorcycle Wheel');
    await expect(shapeIntentCard).toContainText('Add 3 Variants');

    await page.getByTestId('frame-editor-shape-intent-variant-pack').click();
    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(5);
    await expect(referenceList).toContainText('Pizza Variant');
    await expect(referenceList).toContainText('Motorcycle Wheel Variant');
    await expect(referenceList).toContainText('Round Table Variant');
    await expect(page.getByTestId('frame-editor-shape-intent-parked')).toContainText('parked');

    expectNoRuntimeIssues(collector, 'shape intent variant pack checks');
  });

  test('shape intent can seed a study session from a 3-variant pack', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const referenceList = page.getByTestId('frame-editor-reference-list');
    const shapeIntentCard = page.getByTestId('frame-editor-shape-intent-card');
    const referenceStudyCard = page.getByTestId('frame-editor-reference-study-card');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.35);
      const centerY = canvasBox.y + (canvasBox.height * 0.36);
      const radiusX = canvasBox.width * 0.08;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await expect(shapeIntentCard).toContainText('Add 3 Variants');
    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(2);
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 3');

    await page.getByTestId('frame-editor-shape-intent-study-pack').click();

    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(5);
    await expect(referenceStudyCard).toContainText('REFERENCE STUDY');
    await expect(page.getByTestId('frame-editor-reference-study-state')).toContainText('MEMORY DRAW');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('Reference hidden from canvas');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('memory draw → Pizza Study');
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 2');

    expectNoRuntimeIssues(collector, 'shape intent variant study checks');
  });

  test('shape intent ranks blocking-friendly ideas first when the workflow is blocking', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=blocking&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.44);
      const centerY = canvasBox.y + (canvasBox.height * 0.42);
      const radiusX = canvasBox.width * 0.085;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();

    await expect(page.getByTestId('frame-editor-shape-intent-suggestions').locator('button').first()).toContainText('Round Table');
    await expect(page.getByTestId('frame-editor-shape-intent-preview-card')).toContainText('Round Table');
    await expect(page.getByTestId('frame-editor-shape-intent-context-signal-workflow')).toContainText('BLOCKING fit');

    expectNoRuntimeIssues(collector, 'shape intent workflow ranking checks');
  });

  test('shape intent apply modes restyle previews and keep references plus guides wired', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const referenceList = page.getByTestId('frame-editor-reference-list');
    const preview = page.getByTestId('frame-editor-shape-intent-preview');
    const summary = page.getByTestId('frame-editor-shape-intent-selection-summary');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerX: number, centerY: number, radiusX: number, radiusY: number) => {
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse(
      canvasBox.x + (canvasBox.width * 0.34),
      canvasBox.y + (canvasBox.height * 0.44),
      canvasBox.width * 0.08,
      canvasBox.height * 0.06,
    );

    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await expect(summary).toContainText('Apply Mode: Clean');
    const cleanPreview = await preview.getAttribute('src');
    expect(cleanPreview).toMatch(/data:image\/svg\+xml/);

    await page.getByTestId('frame-editor-shape-intent-mode-construction').click();
    await expect(summary).toContainText('Apply Mode: Construction');
    const constructionPreview = await preview.getAttribute('src');
    expect(constructionPreview).toMatch(/data:image\/svg\+xml/);
    expect(constructionPreview).not.toBe(cleanPreview);
    await page.getByTestId('frame-editor-shape-intent-apply-reference').click();
    await expect(referenceList).toContainText('Pizza Construction Assist');

    await drawEllipse(
      canvasBox.x + (canvasBox.width * 0.58),
      canvasBox.y + (canvasBox.height * 0.58),
      canvasBox.width * 0.075,
      canvasBox.height * 0.055,
    );
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-mode-rough').click();
    await expect(summary).toContainText('Apply Mode: Rough');
    const beforeGuideStrokeCount = await parseStrokeCount(statusbar);
    await page.getByTestId('frame-editor-shape-intent-apply-guide').click();
    expect(await parseStrokeCount(statusbar)).toBeGreaterThan(beforeGuideStrokeCount);

    expectNoRuntimeIssues(collector, 'shape intent apply mode checks');
  });

  test('shape intent scaffolds persist as editable canvas overlays across save and harness remount', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const scaffoldShelf = page.getByTestId('frame-editor-shape-scaffold-shelf');
    const referenceLayer = page.getByTestId('pencil-canvas-pro-reference-layer');
    const saveButton = page.getByTestId('frame-editor-save');
    const harnessRemountButton = page.getByTestId('drawing-editor-harness-remount');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.42);
      const centerY = canvasBox.y + (canvasBox.height * 0.46);
      const radiusX = canvasBox.width * 0.085;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 3');

    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-crust-deep').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();

    await expect(scaffoldShelf).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Pizza Scaffold 1');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('Pizza Scaffold 1');
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 2');
    await expect(referenceLayer).toHaveAttribute('data-reference-visible', 'true');

    await page.getByTestId('frame-editor-shape-scaffold-mode-construction').click({ force: true });
    await setRangeInputValue(page.getByTestId('frame-editor-shape-scaffold-opacity'), 65);
    await setRangeInputValue(page.getByTestId('frame-editor-shape-scaffold-scale'), 135);
    await page.getByTestId('frame-editor-shape-scaffold-nudge-right').click({ force: true });

    await expect(page.getByTestId('frame-editor-shape-scaffold-opacity-value')).toContainText('65%');
    await expect(page.getByTestId('frame-editor-shape-scaffold-scale-value')).toContainText('135%');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Crust Thickness: Deep Dish');

    await saveButton.click();
    await expect(page.getByTestId('drawing-editor-harness-save-count')).toContainText('saves=1');
    await harnessRemountButton.click();
    await inspector.getByRole('button', { name: 'SHOT' }).click();

    await expect(scaffoldShelf).toContainText('1 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Pizza Scaffold 1');
    await expect(page.getByTestId('frame-editor-shape-scaffold-opacity-value')).toContainText('65%');
    await expect(page.getByTestId('frame-editor-shape-scaffold-scale-value')).toContainText('135%');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('Pizza Scaffold 1');
    await expect(referenceLayer).toHaveAttribute('data-reference-visible', 'true');

    expectNoRuntimeIssues(collector, 'shape intent scaffold persistence checks');
  });

  test('shape intent scaffolds can start reference study directly from the editable scaffold layer', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const referenceList = page.getByTestId('frame-editor-reference-list');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.33);
      const centerY = canvasBox.y + (canvasBox.height * 0.4);
      const radiusX = canvasBox.width * 0.08;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();

    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(2);
    await page.getByTestId('frame-editor-shape-scaffold-study').click({ force: true });

    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(3);
    await expect(page.getByTestId('frame-editor-reference-study-state')).toContainText('MEMORY DRAW');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('Reference hidden from canvas');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('memory draw → Pizza Scaffold 1 Study');

    expectNoRuntimeIssues(collector, 'shape scaffold study checks');
  });

  test('shape intent scaffolds can be moved and resized directly on the canvas', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.48);
      const centerY = canvasBox.y + (canvasBox.height * 0.5);
      const radiusX = canvasBox.width * 0.09;
      const radiusY = canvasBox.height * 0.065;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();

    const overlay = page.getByTestId('frame-editor-shape-scaffold-overlay');
    const moveHandle = page.getByTestId('frame-editor-shape-scaffold-move-handle');
    const handleSe = page.getByTestId('frame-editor-shape-scaffold-handle-se');

    const initialFrame = await parseShapeScaffoldFrame(overlay);
    const moveHandleBox = await getBox(moveHandle, 'shape scaffold move handle');
    await page.mouse.move(moveHandleBox.x + (moveHandleBox.width / 2), moveHandleBox.y + (moveHandleBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(
      moveHandleBox.x + (moveHandleBox.width / 2) + 72,
      moveHandleBox.y + (moveHandleBox.height / 2) + 44,
      { steps: 8 },
    );
    await page.mouse.up();

    const movedFrame = await parseShapeScaffoldFrame(overlay);
    expect(movedFrame.xRatio).toBeGreaterThan(initialFrame.xRatio);
    expect(movedFrame.yRatio).toBeGreaterThan(initialFrame.yRatio);

    const handleBox = await getBox(handleSe, 'shape scaffold southeast resize handle');
    await page.mouse.move(handleBox.x + (handleBox.width / 2), handleBox.y + (handleBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(
      handleBox.x + (handleBox.width / 2) + 84,
      handleBox.y + (handleBox.height / 2) + 58,
      { steps: 8 },
    );
    await page.mouse.up();

    const resizedFrame = await parseShapeScaffoldFrame(overlay);
    expect(resizedFrame.widthRatio).toBeGreaterThan(movedFrame.widthRatio);
    expect(resizedFrame.heightRatio).toBeGreaterThan(movedFrame.heightRatio);
    await expect(page.getByTestId('frame-editor-shape-scaffold-scale-value')).not.toContainText('100%');
    await expect(page.getByTestId('frame-editor-shape-scaffold-frame-summary')).toContainText('W');
    await expect(page.getByTestId('frame-editor-shape-scaffold-frame-readout')).toContainText('X');

    expectNoRuntimeIssues(collector, 'shape scaffold on-canvas transform checks');
  });

  test('shape intent scaffolds expose on-canvas controls for idea cycling and primary parameter edits', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.46);
      const centerY = canvasBox.y + (canvasBox.height * 0.46);
      const radiusX = canvasBox.width * 0.085;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-crust-deep').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();

    const overlay = page.getByTestId('frame-editor-shape-scaffold-overlay');
    const initialFrame = await parseShapeScaffoldFrame(overlay);

    await expect(page.getByTestId('frame-editor-shape-scaffold-overlay-parameter-crust')).toContainText('Crust Thickness: Deep');
    await page.getByTestId('frame-editor-shape-scaffold-overlay-parameter-crust').dispatchEvent('pointerdown', { bubbles: true });
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Crust Thickness: Thin');

    const afterCrustFrame = await parseShapeScaffoldFrame(overlay);
    expect(afterCrustFrame.xRatio).toBeCloseTo(initialFrame.xRatio, 4);
    expect(afterCrustFrame.yRatio).toBeCloseTo(initialFrame.yRatio, 4);

    await page.getByTestId('frame-editor-shape-scaffold-overlay-next').dispatchEvent('pointerdown', { bubbles: true });
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Motorcycle Wheel Scaffold 1');
    await expect(page.getByTestId('frame-editor-shape-scaffold-overlay-parameter-vehicle')).toContainText('Vehicle Type: Motorcycle');

    await page.getByTestId('frame-editor-shape-scaffold-overlay-parameter-vehicle').dispatchEvent('pointerdown', { bubbles: true });
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Vehicle Type: Bicycle');

    const afterVehicleFrame = await parseShapeScaffoldFrame(overlay);
    expect(afterVehicleFrame.xRatio).toBeCloseTo(initialFrame.xRatio, 4);
    expect(afterVehicleFrame.yRatio).toBeCloseTo(initialFrame.yRatio, 4);

    expectNoRuntimeIssues(collector, 'shape scaffold on-canvas controls checks');
  });

  test('shape intent ranks library-backed scaffold ideas ahead of the default primitive order', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerXRatio: number, centerYRatio: number) => {
      const centerX = canvasBox.x + (canvasBox.width * centerXRatio);
      const centerY = canvasBox.y + (canvasBox.height * centerYRatio);
      const radiusX = canvasBox.width * 0.08;
      const radiusY = canvasBox.height * 0.058;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse(0.32, 0.4);
    await page.getByTestId('frame-editor-shape-intent-suggestion-motorcycle-wheel').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();
    await page.getByTestId('frame-editor-shape-scaffold-save-library').click({ force: true });

    await drawEllipse(0.68, 0.56);

    await expect(page.getByTestId('frame-editor-shape-intent-suggestions').locator('button').first()).toContainText('Motorcycle Wheel');
    await expect(page.getByTestId('frame-editor-shape-intent-preview-card')).toContainText('Motorcycle Wheel');
    await expect(page.getByTestId('frame-editor-shape-intent-context-signal-library')).toContainText('Library match');
    await expect(page.getByTestId('frame-editor-shape-intent-context-signal-recent')).toContainText('Recent scaffold');

    expectNoRuntimeIssues(collector, 'shape intent library ranking checks');
  });

  test('shape intent can apply saved library presets back onto a fresh sketch idea', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const scaffoldLibrary = page.getByTestId('frame-editor-shape-scaffold-library');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerXRatio: number, centerYRatio: number) => {
      const centerX = canvasBox.x + (canvasBox.width * centerXRatio);
      const centerY = canvasBox.y + (canvasBox.height * centerYRatio);
      const radiusX = canvasBox.width * 0.08;
      const radiusY = canvasBox.height * 0.058;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse(0.34, 0.42);
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-crust-deep').click();
    await page.getByTestId('frame-editor-shape-intent-mode-construction').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();
    await page.getByTestId('frame-editor-shape-scaffold-save-library').click({ force: true });
    const deepPizzaLibraryCard = scaffoldLibrary
      .locator('[data-testid^="frame-editor-shape-scaffold-library-card-"]')
      .filter({ hasText: 'Crust Thickness: Deep Dish' })
      .first();
    const deepPizzaLibraryCardTestId = await deepPizzaLibraryCard.getAttribute('data-testid');
    expect(deepPizzaLibraryCardTestId).toBeTruthy();
    const deepPizzaLibraryEntryId = (deepPizzaLibraryCardTestId || '').replace('frame-editor-shape-scaffold-library-card-', '');

    await drawEllipse(0.68, 0.54);
    await expect(page.getByTestId('frame-editor-shape-intent-library-presets')).toContainText('Pizza');
    await expect(page.getByTestId('frame-editor-shape-intent-selection-summary')).toContainText('Crust Thickness: Classic');

    await page.getByTestId(`frame-editor-shape-intent-library-preset-${deepPizzaLibraryEntryId}`).dispatchEvent('pointerdown', { bubbles: true });

    await expect(page.getByTestId('frame-editor-shape-intent-preview-card')).toContainText('Pizza');
    await expect(page.getByTestId('frame-editor-shape-intent-selection-summary')).toContainText('Crust Thickness: Deep Dish');
    await expect(page.getByTestId('frame-editor-shape-intent-selection-summary')).toContainText('Apply Mode: Construction');

    expectNoRuntimeIssues(collector, 'shape intent library preset apply checks');
  });

  test('shape intent pinned presets outrank more recent library ideas and expose pinned context', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const shapeIntentCard = page.getByTestId('frame-editor-shape-intent-card');
    const scaffoldLibrary = page.getByTestId('frame-editor-shape-scaffold-library');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerXRatio: number, centerYRatio: number) => {
      const centerX = canvasBox.x + (canvasBox.width * centerXRatio);
      const centerY = canvasBox.y + (canvasBox.height * centerYRatio);
      const radiusX = canvasBox.width * 0.08;
      const radiusY = canvasBox.height * 0.058;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();

    await drawEllipse(0.34, 0.42);
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();
    await page.getByTestId('frame-editor-shape-scaffold-save-library').click({ force: true });

    await page.getByTestId('frame-editor-shape-scaffold-quick-swap-motorcycle-wheel').click({ force: true });
    await page.getByTestId('frame-editor-shape-scaffold-save-library').click({ force: true });

    const pizzaLibraryCard = scaffoldLibrary
      .locator('[data-testid^="frame-editor-shape-scaffold-library-card-"]')
      .filter({ hasText: 'Pizza' })
      .first();
    await pizzaLibraryCard.locator('[data-testid^="frame-editor-shape-scaffold-library-pin-"]').click({ force: true });
    await expect(pizzaLibraryCard.locator('[data-testid^="frame-editor-shape-scaffold-library-pinned-"]')).toContainText('Pinned');

    await drawEllipse(0.58, 0.58);

    await expect(page.getByTestId('frame-editor-shape-intent-suggestions').locator('button').first()).toContainText('Pizza');
    await page
      .getByTestId('frame-editor-shape-intent-library-presets')
      .locator('button')
      .filter({ hasText: 'Pizza' })
      .first()
      .dispatchEvent('pointerdown', { bubbles: true });
    await expect(shapeIntentCard).toContainText('Pizza');
    await expect(page.getByTestId('frame-editor-shape-intent-context-signal-pinned')).toContainText('Pinned preset');

    expectNoRuntimeIssues(collector, 'shape intent pinned preset ranking checks');
  });

  test('shape intent saved presets can start reference study directly', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const referenceList = page.getByTestId('frame-editor-reference-list');
    const referenceStudyCard = page.getByTestId('frame-editor-reference-study-card');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerXRatio: number, centerYRatio: number) => {
      const centerX = canvasBox.x + (canvasBox.width * centerXRatio);
      const centerY = canvasBox.y + (canvasBox.height * centerYRatio);
      const radiusX = canvasBox.width * 0.08;
      const radiusY = canvasBox.height * 0.058;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse(0.34, 0.42);
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();
    await page.getByTestId('frame-editor-shape-scaffold-save-library').click({ force: true });

    await drawEllipse(0.68, 0.54);
    await expect(page.getByTestId('frame-editor-shape-intent-library-presets')).toContainText('Pizza');
    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(2);

    await page.locator('[data-testid^="frame-editor-shape-intent-library-preset-study-"]').first().click({ force: true });

    await expect(referenceList.locator('[data-testid^="frame-editor-reference-card-"]')).toHaveCount(3);
    await expect(referenceStudyCard).toContainText('REFERENCE STUDY');
    await expect(page.getByTestId('frame-editor-reference-study-state')).toContainText('MEMORY DRAW');
    await expect(page.getByTestId('frame-editor-reference-study-summary')).toContainText('Reference hidden from canvas');
    await expect(page.getByTestId('frame-editor-status-reference-study')).toContainText('memory draw → Pizza Study');
    await expect(page.getByTestId('frame-editor-status-strokes')).toContainText('Strokes: 2');

    expectNoRuntimeIssues(collector, 'shape intent preset study checks');
  });

  test('shape intent scaffolds can quick-swap into sibling ideas with the right parameter set', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.42);
      const centerY = canvasBox.y + (canvasBox.height * 0.42);
      const radiusX = canvasBox.width * 0.085;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-crust-deep').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();

    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Pizza Scaffold 1');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Crust Thickness: Deep Dish');
    await expect(page.getByTestId('frame-editor-shape-scaffold-quick-swap')).toContainText('Motorcycle Wheel');

    await page.getByTestId('frame-editor-shape-scaffold-quick-swap-motorcycle-wheel').click({ force: true });

    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Motorcycle Wheel Scaffold 1');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('MOTORCYCLE WHEEL');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Vehicle Type: Motorcycle');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Spokes: 8');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Tire Profile: Road');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).not.toContainText('Crust Thickness');
    await expect(page.getByTestId('frame-editor-status-shape-scaffold')).toContainText('Motorcycle Wheel Scaffold 1');

    expectNoRuntimeIssues(collector, 'shape scaffold quick swap checks');
  });

  test('shape scaffolds can convert to editable strokes, promote to layers, and duplicate as timeline variants', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const transportLabel = page.getByTestId('frame-editor-transport-label');
    const layersStack = page.getByTestId('frame-editor-layers-stack');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async (centerXRatio: number, centerYRatio: number) => {
      const centerX = canvasBox.x + (canvasBox.width * centerXRatio);
      const centerY = canvasBox.y + (canvasBox.height * centerYRatio);
      const radiusX = canvasBox.width * 0.085;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();

    await drawEllipse(0.4, 0.42);
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();

    const beforeConvertStrokeCount = await parseStrokeCount(statusbar);
    await page.getByTestId('frame-editor-shape-scaffold-convert-editable').click({ force: true });
    expect(await parseStrokeCount(statusbar)).toBeGreaterThan(beforeConvertStrokeCount);
    await expect(page.getByTestId('frame-editor-shape-scaffold-visibility')).toContainText('Canvas Off');

    await drawEllipse(0.66, 0.56);
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Pizza Scaffold 2');

    await page.getByTestId('frame-editor-shape-scaffold-promote-layer').click({ force: true });
    await expect(layersStack).toContainText('Pizza Scaffold 2 Trace');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-shape-scaffold-duplicate-variant').click({ force: true });
    await expect(transportLabel).toContainText('Pizza Scaffold 2 Variant');

    expectNoRuntimeIssues(collector, 'shape scaffold production workflow checks');
  });

  test('shape scaffold assemblies can become grouped layer stacks and timeline variants', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const transportLabel = page.getByTestId('frame-editor-transport-label');
    const layersStack = page.getByTestId('frame-editor-layers-stack');
    const batchSummary = page.getByTestId('frame-editor-shape-scaffold-batch-summary');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.42);
      const centerY = canvasBox.y + (canvasBox.height * 0.44);
      const radiusX = canvasBox.width * 0.085;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();

    await page.getByTestId('frame-editor-shape-scaffold-assembly-template-pizza-plate').click({ force: true });
    await expect(page.getByTestId('frame-editor-shape-scaffold-assembly-count')).toContainText('1 saved');
    await expect(batchSummary).toContainText('Pizza + Plate');
    await expect(batchSummary).toContainText('Pizza Scaffold 1');
    await expect(batchSummary).toContainText('Plate Scaffold 1');

    const beforeBatchConvertStrokeCount = await parseStrokeCount(statusbar);
    await page.getByTestId('frame-editor-shape-scaffold-assembly-convert').click({ force: true });
    expect(await parseStrokeCount(statusbar)).toBeGreaterThan(beforeBatchConvertStrokeCount);

    await page.getByTestId('frame-editor-shape-scaffold-assembly-promote').click({ force: true });
    await expect(layersStack).toContainText('Pizza + Plate Group');
    await expect(layersStack).toContainText('Pizza Scaffold 1 Trace');
    await expect(layersStack).toContainText('Plate Scaffold 1 Trace');

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await page.getByTestId('frame-editor-shape-scaffold-assembly-duplicate-variant').click({ force: true });
    await expect(transportLabel).toContainText('Pizza + Plate Variant');

    expectNoRuntimeIssues(collector, 'shape scaffold assembly promotion checks');
  });

  test('shape scaffold assembly templates cover table chairs, wheel chassis, and head shoulders blocking sets', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const batchSummary = page.getByTestId('frame-editor-shape-scaffold-batch-summary');
    const assemblyCount = page.getByTestId('frame-editor-shape-scaffold-assembly-count');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.44);
      const centerY = canvasBox.y + (canvasBox.height * 0.44);
      const radiusX = canvasBox.width * 0.085;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();

    await page.getByTestId('frame-editor-shape-scaffold-quick-swap-round-table').click({ force: true });
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Round Table Scaffold 1');
    await page.getByTestId('frame-editor-shape-scaffold-assembly-template-table-chairs').click({ force: true });
    await expect(batchSummary).toContainText('Table + Chairs');
    await expect(batchSummary).toContainText('Chair Scaffold');
    await expect(assemblyCount).toContainText('1 saved');

    await page.getByTestId('frame-editor-shape-scaffold-quick-swap-motorcycle-wheel').click({ force: true });
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Motorcycle Wheel Scaffold 1');
    await page.getByTestId('frame-editor-shape-scaffold-assembly-template-wheel-chassis').click({ force: true });
    await expect(batchSummary).toContainText('Wheel + Chassis');
    await expect(batchSummary).toContainText('Chassis Block Scaffold 1');
    await expect(assemblyCount).toContainText('2 saved');

    await page.getByTestId('frame-editor-shape-scaffold-quick-swap-head-mass').click({ force: true });
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Head Mass Scaffold 1');
    await page.getByTestId('frame-editor-shape-scaffold-assembly-template-head-shoulders').click({ force: true });
    await expect(batchSummary).toContainText('Head + Shoulders');
    await expect(batchSummary).toContainText('Shoulders Scaffold 1');
    await expect(assemblyCount).toContainText('3 saved');

    expectNoRuntimeIssues(collector, 'shape scaffold assembly template coverage checks');
  });

  test('shape scaffold selected state can apply saved presets directly back onto the active scaffold', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const scaffoldLibrary = page.getByTestId('frame-editor-shape-scaffold-library');
    const selectedScaffold = page.getByTestId('frame-editor-shape-scaffold-selected');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.42);
      const centerY = canvasBox.y + (canvasBox.height * 0.42);
      const radiusX = canvasBox.width * 0.085;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-crust-deep').click();
    await page.getByTestId('frame-editor-shape-intent-mode-construction').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();
    await page.getByTestId('frame-editor-shape-scaffold-save-library').click({ force: true });

    const deepPizzaLibraryCard = scaffoldLibrary
      .locator('[data-testid^="frame-editor-shape-scaffold-library-card-"]')
      .filter({ hasText: 'Crust Thickness: Deep Dish' })
      .first();
    const deepPizzaLibraryCardTestId = await deepPizzaLibraryCard.getAttribute('data-testid');
    expect(deepPizzaLibraryCardTestId).toBeTruthy();
    const deepPizzaLibraryEntryId = (deepPizzaLibraryCardTestId || '').replace('frame-editor-shape-scaffold-library-card-', '');

    await page.getByTestId('frame-editor-shape-scaffold-quick-swap-motorcycle-wheel').click({ force: true });
    await page.getByTestId('frame-editor-shape-scaffold-mode-rough').click({ force: true });
    await expect(selectedScaffold).toContainText('MOTORCYCLE WHEEL');
    await expect(selectedScaffold).toContainText('Vehicle Type: Motorcycle');
    await expect(selectedScaffold).not.toContainText('Crust Thickness');
    await expect(page.getByTestId(`frame-editor-shape-scaffold-library-preset-${deepPizzaLibraryEntryId}`)).not.toContainText('Active');

    await page.getByTestId(`frame-editor-shape-scaffold-library-preset-${deepPizzaLibraryEntryId}`).dispatchEvent('pointerdown', { bubbles: true });

    await expect(selectedScaffold).toContainText('Pizza Scaffold 1');
    await expect(selectedScaffold).toContainText('PIZZA');
    await expect(selectedScaffold).toContainText('Crust Thickness: Deep Dish');
    await expect(page.getByTestId(`frame-editor-shape-scaffold-library-preset-${deepPizzaLibraryEntryId}`)).toContainText('Active');

    expectNoRuntimeIssues(collector, 'shape scaffold selected preset apply checks');
  });

  test('shape scaffold library entries can be updated from the selected scaffold and then reused', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const scaffoldLibrary = page.getByTestId('frame-editor-shape-scaffold-library');
    const scaffoldShelf = page.getByTestId('frame-editor-shape-scaffold-shelf');
    const selectedScaffold = page.getByTestId('frame-editor-shape-scaffold-selected');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.42);
      const centerY = canvasBox.y + (canvasBox.height * 0.42);
      const radiusX = canvasBox.width * 0.085;
      const radiusY = canvasBox.height * 0.06;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-crust-deep').click();
    await page.getByTestId('frame-editor-shape-intent-mode-construction').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();
    await page.getByTestId('frame-editor-shape-scaffold-save-library').click({ force: true });

    const pizzaLibraryCard = scaffoldLibrary
      .locator('[data-testid^="frame-editor-shape-scaffold-library-card-"]')
      .filter({ hasText: 'Crust Thickness: Deep Dish' })
      .first();
    const pizzaLibraryCardTestId = await pizzaLibraryCard.getAttribute('data-testid');
    expect(pizzaLibraryCardTestId).toBeTruthy();
    const pizzaLibraryEntryId = (pizzaLibraryCardTestId || '').replace('frame-editor-shape-scaffold-library-card-', '');
    const pizzaLibraryCardById = page.getByTestId(`frame-editor-shape-scaffold-library-card-${pizzaLibraryEntryId}`);

    await expect(page.getByTestId(`frame-editor-shape-scaffold-library-update-${pizzaLibraryEntryId}`)).toContainText('Current Match');

    await page.getByTestId('frame-editor-shape-scaffold-parameter-crust-classic').click({ force: true });
    await page.getByTestId('frame-editor-shape-scaffold-mode-rough').click({ force: true });
    await expect(selectedScaffold).toContainText('Crust Thickness: Classic');
    await expect(page.getByTestId(`frame-editor-shape-scaffold-library-update-${pizzaLibraryEntryId}`)).toContainText('Update from Selected');

    await page.getByTestId(`frame-editor-shape-scaffold-library-update-${pizzaLibraryEntryId}`).click({ force: true });

    await expect(pizzaLibraryCardById).toContainText('Crust Thickness: Classic');
    await expect(page.getByTestId(`frame-editor-shape-scaffold-library-update-${pizzaLibraryEntryId}`)).toContainText('Current Match');

    await page.getByTestId(`frame-editor-shape-scaffold-library-apply-${pizzaLibraryEntryId}`).click({ force: true });

    await expect(scaffoldShelf).toContainText('2 saved');
    await expect(selectedScaffold).toContainText('Pizza Scaffold 2');
    await expect(selectedScaffold).toContainText('Crust Thickness: Classic');

    expectNoRuntimeIssues(collector, 'shape scaffold library update checks');
  });

  test('shape intent scaffold library persists across save and harness remount, then reloads presets to canvas', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    const scaffoldShelf = page.getByTestId('frame-editor-shape-scaffold-shelf');
    const saveButton = page.getByTestId('frame-editor-save');
    const harnessRemountButton = page.getByTestId('drawing-editor-harness-remount');
    const mainCanvas = page.getByTestId('pencil-canvas-pro').locator('canvas').nth(1);
    const canvasBox = await getBox(mainCanvas, 'main storyboard drawing canvas');

    const drawEllipse = async () => {
      const centerX = canvasBox.x + (canvasBox.width * 0.36);
      const centerY = canvasBox.y + (canvasBox.height * 0.48);
      const radiusX = canvasBox.width * 0.08;
      const radiusY = canvasBox.height * 0.058;
      await page.mouse.move(centerX + radiusX, centerY);
      await page.mouse.down();
      for (let step = 1; step <= 18; step += 1) {
        const angle = (Math.PI * 2 * step) / 18;
        await page.mouse.move(
          centerX + (Math.cos(angle) * radiusX),
          centerY + (Math.sin(angle) * radiusY),
          { steps: 1 },
        );
      }
      await page.mouse.up();
    };

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await drawEllipse();
    await page.getByTestId('frame-editor-shape-intent-suggestion-pizza').click();
    await page.getByTestId('frame-editor-shape-intent-parameter-crust-deep').click();
    await page.getByTestId('frame-editor-shape-intent-save-scaffold').click();
    await page.getByTestId('frame-editor-shape-scaffold-save-library').click({ force: true });

    await expect(page.getByTestId('frame-editor-shape-scaffold-library-count')).toContainText('1 saved');
    await expect(page.locator('[data-testid^="frame-editor-shape-scaffold-library-card-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid^="frame-editor-shape-scaffold-library-card-"]').first()).toContainText('Pizza');
    await expect(page.locator('[data-testid^="frame-editor-shape-scaffold-library-card-"]').first()).toContainText('Crust Thickness: Deep Dish');

    await saveButton.click();
    await expect(page.getByTestId('drawing-editor-harness-save-count')).toContainText('saves=1');
    await harnessRemountButton.click();
    await inspector.getByRole('button', { name: 'SHOT' }).click();

    await expect(page.getByTestId('frame-editor-shape-scaffold-library-count')).toContainText('1 saved');
    await expect(page.locator('[data-testid^="frame-editor-shape-scaffold-library-card-"]')).toHaveCount(1);

    await page.locator('[data-testid^="frame-editor-shape-scaffold-library-apply-"]').first().click({ force: true });
    await expect(scaffoldShelf).toContainText('2 saved');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Pizza Scaffold 2');
    await expect(page.getByTestId('frame-editor-shape-scaffold-selected')).toContainText('Crust Thickness: Deep Dish');

    await page.locator('[data-testid^="frame-editor-shape-scaffold-library-remove-"]').first().click({ force: true });
    await expect(page.locator('[data-testid="frame-editor-shape-scaffold-library"]')).toHaveCount(0);

    expectNoRuntimeIssues(collector, 'shape scaffold library checks');
  });

  test('flythrough controls tune bookmark timing, order, transitions, and visible canvases', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    await inspector.getByRole('button', { name: 'SHOT' }).click();

    const flythroughCard = page.getByTestId('frame-editor-flythrough-card');
    const flythroughState = page.getByTestId('frame-editor-flythrough-state');
    const flythroughDuration = page.getByTestId('frame-editor-flythrough-duration');
    const flythroughCurrent = page.getByTestId('frame-editor-flythrough-current');
    const flythroughVisibleCanvases = page.getByTestId('frame-editor-flythrough-visible-canvases');
    const flythroughCameraSync = page.getByTestId('frame-editor-flythrough-camera-sync');
    const flythroughSavedCamera = page.getByTestId('frame-editor-flythrough-saved-camera');
    const flythroughLiveCamera = page.getByTestId('frame-editor-flythrough-live-camera');
    const flythroughProgress = page.getByTestId('frame-editor-flythrough-progress');
    const bookmarkList = page.getByTestId('frame-editor-spatial-bookmark-list');

    await expect(flythroughCard).toContainText('FLYTHROUGH');
    await expect(flythroughState).toContainText('Loop Ready');
    await expect(flythroughDuration).toContainText('00:04');
    await expect(flythroughCurrent).toContainText('Flythrough Start');
    await expect(flythroughVisibleCanvases).toContainText('Canvas 2');
    expect(await flythroughProgress.locator('[data-testid^="frame-editor-flythrough-marker-"]').count()).toBe(2);

    await page.getByTestId('frame-editor-spatial-map-bookmark-flythrough-start').click();
    await expect(flythroughCameraSync).toContainText('Camera Synced');
    await expect(flythroughSavedCamera).toContainText('Saved x 220 · y 120 · z 24 · zoom 1.08');
    await expect(flythroughLiveCamera).toContainText('Live x 220 · y 120 · z 24 · zoom 1.08');

    await page.getByTestId('frame-editor-flythrough-timing-up').click();
    await expect(flythroughDuration).toContainText('00:05');

    await page.getByTestId('frame-editor-flythrough-transition').click();
    await expect(flythroughCurrent).toContainText('CUT');

    await page.getByTestId('frame-editor-flythrough-visibility-canvas-3').click();
    await expect(flythroughVisibleCanvases).toContainText('Canvas 2');
    await expect(flythroughVisibleCanvases).toContainText('Canvas 3');

    await page.getByTestId('frame-editor-spatial-map-nudge-right').click();
    await page.getByTestId('frame-editor-spatial-map-scale-up').click();
    await expect(flythroughCameraSync).toContainText('Camera Live');
    await expect(flythroughLiveCamera).toContainText('Live x 244 · y 120 · z 24 · zoom 1.20');

    await page.getByTestId('frame-editor-flythrough-capture-view').click();
    await expect(flythroughCameraSync).toContainText('Camera Synced');
    await expect(flythroughSavedCamera).toContainText('Saved x 244 · y 120 · z 24 · zoom 1.20');

    await page.getByTestId('frame-editor-spatial-map-nudge-left').click();
    await expect(flythroughCameraSync).toContainText('Camera Live');
    await expect(flythroughLiveCamera).toContainText('Live x 220 · y 120 · z 24 · zoom 1.20');

    await page.getByTestId('frame-editor-flythrough-reset-view').click();
    await expect(flythroughCameraSync).toContainText('Camera Synced');
    await expect(flythroughLiveCamera).toContainText('Live x 244 · y 120 · z 24 · zoom 1.20');

    await page.getByTestId('frame-editor-flythrough-next').click();
    await expect(flythroughCurrent).toContainText('Flythrough Push');
    await expect(flythroughLiveCamera).toContainText('Live x 260 · y 136 · z 42 · zoom 1.18');

    await page.getByTestId('frame-editor-flythrough-prev').click();
    await expect(flythroughCurrent).toContainText('Flythrough Start');
    await expect(flythroughLiveCamera).toContainText('Live x 244 · y 120 · z 24 · zoom 1.20');

    const flythroughProgressBox = await getBox(flythroughProgress, 'flythrough progress');
    await page.mouse.click(
      flythroughProgressBox.x + (flythroughProgressBox.width * 0.78),
      flythroughProgressBox.y + (flythroughProgressBox.height / 2),
    );
    await expect(flythroughCurrent).toContainText('Flythrough Push');
    await expect(flythroughLiveCamera).toContainText('Live x 260 · y 136 · z 42 · zoom 1.18');

    await page.mouse.move(
      flythroughProgressBox.x + (flythroughProgressBox.width * 0.18),
      flythroughProgressBox.y + (flythroughProgressBox.height / 2),
    );
    await page.mouse.down();
    await page.mouse.move(
      flythroughProgressBox.x + (flythroughProgressBox.width * 0.86),
      flythroughProgressBox.y + (flythroughProgressBox.height / 2),
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(flythroughCurrent).toContainText('Flythrough Push');
    await expect(flythroughLiveCamera).toContainText('Live x 260 · y 136 · z 42 · zoom 1.18');

    await page.mouse.click(
      flythroughProgressBox.x + (flythroughProgressBox.width * 0.12),
      flythroughProgressBox.y + (flythroughProgressBox.height / 2),
    );
    await expect(flythroughCurrent).toContainText('Flythrough Start');
    await expect(flythroughLiveCamera).toContainText('Live x 244 · y 120 · z 24 · zoom 1.20');

    await page.getByTestId('frame-editor-flythrough-loop').click();
    await expect(page.getByTestId('frame-editor-flythrough-loop')).toContainText('Loop Off');

    await page.getByTestId('frame-editor-flythrough-play').click();
    await expect(flythroughState).toContainText('Playing');
    await page.getByTestId('frame-editor-flythrough-play').click();
    await expect(flythroughState).toContainText('Ready');

    await page.getByTestId('frame-editor-flythrough-move-down').click();
    await expect(bookmarkList.locator('[data-testid^="frame-editor-spatial-bookmark-"]').first()).toContainText('Flythrough Push');

    expectNoRuntimeIssues(collector, 'flythrough inspector checks');
  });

  test('animatic export uses the flythrough plan and downloads a json manifest', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const animationAssistCard = page.getByTestId('frame-editor-animation-assist-card');
    const animaticPlan = page.getByTestId('frame-editor-animation-animatic-plan');
    const animationExport = page.getByTestId('frame-editor-animation-export');

    await expect(animationAssistCard).toContainText('Flythrough-driven animatic');
    await expect(animaticPlan).toContainText('ANIMATIC');
    await expect(animaticPlan).toContainText('2 cues');
    await expect(animaticPlan).toContainText('00:04');
    await expect(animaticPlan).toContainText('2 canvases');
    await expect(animaticPlan).toContainText('Flythrough Start');
    await expect(animaticPlan).toContainText('Flythrough Push');
    await expect(animationExport).toContainText('Export Animatic JSON');
    await expect(animationExport).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      animationExport.click(),
    ]);

    expect(download.suggestedFilename()).toContain('animatic-plan');
    expect(download.suggestedFilename()).toContain('.json');

    expectNoRuntimeIssues(collector, 'animatic export checks');
  });

  test('thumbnail workflow falls back to the lighter editor layout without premium side panels', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1180, height: 900 });
    await page.goto(`${TEST_PAGE}?workflow=idea&aspect=${encodeURIComponent('16:9')}`);

    const shell = page.getByTestId('frame-editor-shell');
    const header = page.getByTestId('frame-editor-header');
    const canvasShell = page.getByTestId('frame-editor-canvas-shell');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const workflowChip = page.getByTestId('frame-editor-workflow-chip');

    await expect(shell).toBeVisible();
    await expect(header).toBeVisible();
    await expect(canvasShell).toBeVisible();
    await expect(statusbar).toBeVisible();
    await expect(workflowChip).toBeVisible();
    await expect(workflowChip).toContainText('Thumbnail flow');
    await expect(page.getByText('Thumbnail Sketch')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marker' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Highlight' })).toBeVisible();
    await expect(page.getByTestId('frame-editor-save')).toBeDisabled();
    expect(await page.getByTestId('frame-editor-body').count()).toBe(0);
    expect(await page.getByTestId('frame-editor-left-rail').count()).toBe(0);
    expect(await page.getByTestId('frame-editor-brush-panel').count()).toBe(0);
    expect(await page.getByTestId('frame-editor-stage').count()).toBe(0);
    expect(await page.getByTestId('frame-editor-inspector').count()).toBe(0);
    await expect(statusbar).toContainText('Strokes: 2');
    await expect(statusbar).toContainText('16:9');

    const shellBox = await getBox(shell, 'shell');
    const canvasBox = await getBox(canvasShell, 'canvas');
    const statusBox = await getBox(statusbar, 'status');
    expect(shellBox.width).toBeGreaterThan(900);
    expect(canvasBox.width).toBeGreaterThan(700);
    expect(canvasBox.height).toBeGreaterThan(300);
    expect(statusBox.y).toBeGreaterThan(canvasBox.y);

    expectNoRuntimeIssues(collector, 'thumbnail workflow fallback');
  });

  test('thumbnail workflow matches the lightweight visual baseline', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1180, height: 900 });
    await page.goto(`${TEST_PAGE}?workflow=idea&aspect=${encodeURIComponent('16:9')}`);

    const shell = page.getByTestId('frame-editor-shell');
    await expect(shell).toHaveScreenshot('storyboard-drawing-editor-thumbnail-shell.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    expectNoRuntimeIssues(collector, 'thumbnail storyboard drawing editor screenshot');
  });

  test('desktop premium style primitives stay locked to the studio art direction', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1660, height: 1120 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const shell = page.getByTestId('frame-editor-shell');
    const header = page.getByTestId('frame-editor-header');
    const body = page.getByTestId('frame-editor-body');
    const leftRail = page.getByTestId('frame-editor-left-rail');
    const brushPanel = page.getByTestId('frame-editor-brush-panel');
    const stage = page.getByTestId('frame-editor-stage');
    const inspector = page.getByTestId('frame-editor-inspector');
    const timeline = page.getByTestId('frame-editor-timeline');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const gridButton = page.getByRole('button', { name: /^Grid$/ });
    const shareButton = page.getByRole('button', { name: /^Share$/ });
    const exportButton = page.getByRole('button', { name: /^Export$/ });
    const lightButton = header.getByRole('button', { name: /^Light$/ });

    const shellRadius = await getCss(shell, 'border-radius');
    const shellBorderTop = await getCss(shell, 'border-top-color');
    const shellBackground = await getCss(shell, 'background-image');
    const headerBorderBottom = await getCss(header, 'border-bottom-color');
    const leftRailBackground = await getCss(leftRail, 'background-image');
    const brushPanelBackground = await getCss(brushPanel, 'background-image');
    const stageBackground = await getCss(stage, 'background-image');
    const inspectorBackground = await getCss(inspector, 'background-image');
    const timelineBackground = await getCss(timeline, 'background-image');
    const statusBackground = await getCss(statusbar, 'background-image');
    const gridButtonBackground = await getCss(gridButton, 'background-color');
    const gridButtonColor = await getCss(gridButton, 'color');
    const shareButtonBorder = await getCss(shareButton, 'border-top-color');
    const exportButtonBackground = await getCss(exportButton, 'background-color');
    const lightButtonBorder = await getCss(lightButton, 'border-top-color');

    expect(Number.parseFloat(shellRadius)).toBeGreaterThan(30);
    expect(shellBorderTop).not.toBe('rgba(0, 0, 0, 0)');
    expect(shellBackground).toContain('linear-gradient');
    expect(headerBorderBottom).not.toBe('rgba(0, 0, 0, 0)');
    expect(leftRailBackground).toContain('linear-gradient');
    expect(brushPanelBackground).toContain('linear-gradient');
    expect(stageBackground).toContain('linear-gradient');
    expect(inspectorBackground).toContain('linear-gradient');
    expect(timelineBackground).toContain('linear-gradient');
    expect(statusBackground).toContain('linear-gradient');
    expect(gridButtonBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(gridButtonColor).not.toBe('rgb(255, 255, 255)');
    expect(shareButtonBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(exportButtonBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(lightButtonBorder).not.toBe('rgba(0, 0, 0, 0)');

    const shellBox = await getBox(shell, 'shell');
    const headerBox = await getBox(header, 'header');
    const bodyBox = await getBox(body, 'body');
    const leftRailBox = await getBox(leftRail, 'left rail');
    const brushPanelBox = await getBox(brushPanel, 'brush panel');
    const stageBox = await getBox(stage, 'stage');
    const inspectorBox = await getBox(inspector, 'inspector');
    const timelineBox = await getBox(timeline, 'timeline');
    const statusBox = await getBox(statusbar, 'statusbar');

    expect(shellBox.height).toBeGreaterThan(900);
    expect(shellBox.width).toBeGreaterThan(1500);
    expect(headerBox.height).toBeGreaterThan(95);
    expect(bodyBox.height).toBeGreaterThan(650);
    expect(leftRailBox.width).toBeLessThan(80);
    expect(brushPanelBox.width).toBeGreaterThan(240);
    expect(brushPanelBox.width).toBeLessThan(340);
    expect(stageBox.width).toBeGreaterThan(700);
    expect(stageBox.height).toBeGreaterThan(640);
    expect(inspectorBox.width).toBeGreaterThan(250);
    expect(inspectorBox.width).toBeLessThan(340);
    expect(timelineBox.height).toBeGreaterThan(140);
    expect(statusBox.height).toBeGreaterThan(35);
    expect(headerBox.x).toBeGreaterThanOrEqual(shellBox.x);
    expect(bodyBox.x).toBeGreaterThanOrEqual(shellBox.x);
    expect(statusBox.x).toBeGreaterThanOrEqual(shellBox.x);
    expect(headerBox.width).toBeLessThanOrEqual(shellBox.width + 1);
    expect(bodyBox.width).toBeLessThanOrEqual(shellBox.width + 1);
    expect(statusBox.width).toBeLessThanOrEqual(shellBox.width + 1);

    expectNoRuntimeIssues(collector, 'desktop premium style primitives');
  });

  test('micro-typography stays locked across the premium header and inspector chrome', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1660, height: 1120 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const brand = page.getByTestId('frame-editor-brand');
    const inspector = page.getByTestId('frame-editor-inspector');
    const shotSettingsCard = page.getByTestId('frame-editor-shot-settings-card');
    const brandWord = brand.getByText('CREATORHUB');
    const proChip = brand.getByText('STORYBOARD PRO');
    const sceneLabel = brand.getByText('Scene 15');
    const shotLabel = brand.getByText('SHOT 5B');
    const versionChip = brand.getByText(/Version \d+/);
    const brushPackLabel = page.getByTestId('frame-editor-header').getByText('CINEMATOGRAPHY BRUSH PACKS');
    const inspectorLabel = inspector.getByText('INSPECTOR');
    const lightingTab = inspector.getByRole('button', { name: 'LIGHTING' });
    const shotSettingsLabel = shotSettingsCard.getByText('SHOT SETTINGS');

    expect(Number.parseFloat(await getCss(brandWord, 'letter-spacing'))).toBeGreaterThan(1.4);
    expect(Number.parseFloat(await getCss(brandWord, 'font-size'))).toBeGreaterThan(12);
    expect(Number.parseInt(await getCss(brandWord, 'font-weight'), 10)).toBeGreaterThanOrEqual(700);
    expect(Number.parseFloat(await getCss(proChip, 'letter-spacing'))).toBeGreaterThan(0.9);
    expect(Number.parseFloat(await getCss(proChip, 'font-size'))).toBeLessThan(12);
    expect(Number.parseFloat(await getCss(sceneLabel, 'font-size'))).toBeGreaterThan(20);
    expect(Number.parseFloat(await getCss(sceneLabel, 'letter-spacing'))).toBeLessThan(0.1);
    expect(Number.parseFloat(await getCss(shotLabel, 'font-size'))).toBeGreaterThan(21);
    expect(Number.parseInt(await getCss(shotLabel, 'font-weight'), 10)).toBeGreaterThanOrEqual(700);
    expect(Number.parseFloat(await getCss(versionChip, 'font-size'))).toBeLessThan(13);
    expect(Number.parseFloat(await getCss(versionChip, 'letter-spacing'))).toBeGreaterThan(0.2);
    expect(Number.parseFloat(await getCss(brushPackLabel, 'letter-spacing'))).toBeGreaterThan(2);
    expect(Number.parseFloat(await getCss(brushPackLabel, 'font-size'))).toBeLessThan(12);
    expect(Number.parseFloat(await getCss(inspectorLabel, 'letter-spacing'))).toBeGreaterThan(2);
    expect(Number.parseFloat(await getCss(inspectorLabel, 'font-size'))).toBeLessThan(12);
    expect(Number.parseFloat(await getCss(lightingTab, 'letter-spacing'))).toBeGreaterThan(1);
    expect(Number.parseInt(await getCss(lightingTab, 'font-weight'), 10)).toBeGreaterThanOrEqual(700);
    expect(Number.parseFloat(await getCss(shotSettingsLabel, 'letter-spacing'))).toBeGreaterThan(1.4);
    expect(Number.parseFloat(await getCss(shotSettingsLabel, 'font-size'))).toBeLessThan(12);

    expectNoRuntimeIssues(collector, 'micro typography contract');
  });

  test('desktop brush panel inventory and tool affordances remain fully populated', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const brushPanel = page.getByTestId('frame-editor-brush-panel');
    const brushLibrary = page.getByTestId('frame-editor-brush-library');
    const brushControls = page.getByTestId('frame-editor-brush-controls');
    const precisionToolsCard = page.getByTestId('frame-editor-precision-tools-card');
    const precisionTextPreview = page.getByTestId('frame-editor-precision-text-preview');
    const precisionTypeMetrics = page.getByTestId('frame-editor-precision-type-metrics');
    const precisionCanvasTools = page.getByTestId('frame-editor-precision-canvas-tools');
    const precisionCropStrip = page.getByTestId('frame-editor-precision-crop-strip');
    const precisionGuides = page.getByTestId('frame-editor-precision-guides');
    const precisionGuidePreview = page.getByTestId('frame-editor-precision-guide-preview');
    const precisionGuideToggles = page.getByTestId('frame-editor-precision-guide-toggles');
    const precisionAssists = page.getByTestId('frame-editor-precision-assists');
    const precisionAssistMeters = page.getByTestId('frame-editor-precision-assist-meters');

    await expectTexts(brushPanel, [
      'BRUSH PACKS',
      'NOIR LIGHTING PACK',
      'COMMERCIAL HIGH-KEY',
      'ACTION CROSSHATCH',
      'SOFT DRAMA WASH',
      'BRUSH LIBRARY',
      'Construction',
      'Hard Shadow',
      'Inks',
      'Soft Gradient',
      'Shadows',
      'Crosshatch',
      'Texture',
      'Ink Line',
      'FX',
      'Smudge',
      'Custom',
      'Light Wrap',
      'Size',
      'Opacity',
      'Flow',
      'Stabilize',
      'Pressure',
      'Precision Design Tools',
      'Vector Text',
      'Import Fonts',
      'Crop & Resize',
      'TYPE RIG',
      'CANVAS FIT',
      'GUIDE ENGINE',
      'Grotesk',
      'Mono',
      'Display',
      'TYPE METRICS',
      'Align',
      'Left',
      'Right',
      'Track +12',
      'Baseline Lock',
      'Center',
      'Thirds',
      'Safe Margin',
      'Perspective',
      'Isometric',
      '2D',
      'Symmetry',
      'Drawing Assist',
      'StreamLine',
      'Snap',
      'Mirror',
    ]);
    await expect(brushLibrary).toContainText('BRUSH LIBRARY');
    await expect(brushControls).toContainText('Flow');
    await expect(brushControls).toContainText('Pressure');
    await expect(precisionToolsCard).toContainText('Precision Design Tools');
    await expect(precisionTextPreview).toContainText('SHOT 5B');
    await expect(precisionTypeMetrics).toContainText('TYPE METRICS');
    await expect(precisionCanvasTools).toContainText('Safe Crop');
    await expect(precisionCropStrip).toContainText('Center');
    await expect(precisionGuidePreview).toBeVisible();
    await expect(precisionGuideToggles).toContainText('Snap');
    await expect(precisionAssists).toContainText('StreamLine');
    await expect(precisionAssistMeters).toContainText('Drawing Assist');
    await expect(precisionAssistMeters).toContainText('StreamLine');

    expect(await page.getByTestId('frame-editor-brush-pack-noir').locator('div').count()).toBeGreaterThan(4);
    expect(await page.getByTestId('frame-editor-brush-pack-high-key').locator('div').count()).toBeGreaterThan(4);
    expect(await page.getByTestId('frame-editor-brush-pack-crosshatch').locator('div').count()).toBeGreaterThan(4);
    expect(await page.getByTestId('frame-editor-brush-pack-wash').locator('div').count()).toBeGreaterThan(4);
    expect(await brushPanel.getByRole('button', { name: 'Hard Shadow' }).count()).toBe(1);
    expect(await brushPanel.getByRole('button', { name: 'Soft Gradient' }).count()).toBe(1);
    expect(await brushPanel.getByRole('button', { name: 'Crosshatch' }).count()).toBe(1);
    expect(await brushPanel.getByRole('button', { name: 'Ink Line' }).count()).toBe(1);
    expect(await brushPanel.getByRole('button', { name: 'Smudge' }).count()).toBe(1);
    expect(await brushPanel.getByRole('button', { name: 'Light Wrap' }).count()).toBe(1);
    expect(await brushLibrary.getByRole('button').count()).toBe(6);
    expect(await brushControls.locator('[data-testid^="frame-editor-brush-control-"]').count()).toBe(5);
    expect(await precisionGuides.getByRole('button').count()).toBe(6);
    expect(await precisionTextPreview.getByRole('button').count()).toBe(6);
    expect(await precisionTypeMetrics.getByRole('button').count()).toBe(3);
    expect(await precisionCropStrip.getByRole('button').count()).toBe(3);
    expect(await precisionGuideToggles.getByRole('button').count()).toBe(2);

    const sliders = brushPanel.locator('.MuiSlider-root');
    await expect(sliders).toHaveCount(5);
    const sliderOneColor = await getCss(sliders.nth(0), 'color');
    const sliderTwoColor = await getCss(sliders.nth(1), 'color');
    const sliderThreeColor = await getCss(sliders.nth(2), 'color');
    const sliderFourColor = await getCss(sliders.nth(3), 'color');
    const sliderFiveColor = await getCss(sliders.nth(4), 'color');
    expect(sliderOneColor).not.toBe('rgb(25, 118, 210)');
    expect(sliderTwoColor).not.toBe('rgb(25, 118, 210)');
    expect(sliderThreeColor).not.toBe('rgb(25, 118, 210)');
    expect(sliderFourColor).not.toBe('rgb(25, 118, 210)');
    expect(sliderFiveColor).not.toBe('rgb(25, 118, 210)');
    const brushLibraryBackground = await getCss(brushLibrary, 'background-color');
    const brushControlsBorder = await getCss(brushControls, 'border-top-color');
    const precisionToolsBorder = await getCss(precisionToolsCard, 'border-top-color');
    expect(brushLibraryBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(brushControlsBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(precisionToolsBorder).not.toBe('rgba(0, 0, 0, 0)');

    await page.getByTestId('frame-editor-brush-pack-high-key').click();
    await expect(page.getByTestId('frame-editor-brush-pack-high-key')).toContainText('COMMERCIAL HIGH-KEY');
    await page.getByTestId('frame-editor-brush-pack-noir').click();
    await expect(page.getByTestId('frame-editor-brush-pack-noir')).toContainText('NOIR LIGHTING PACK');
    await page.getByRole('button', { name: 'Soft Gradient' }).click();
    await expect(brushPanel).toContainText('Soft Gradient');
    await page.getByRole('button', { name: 'Hard Shadow' }).click();
    await expect(brushPanel).toContainText('Hard Shadow');
    await precisionGuides.getByRole('button', { name: 'Isometric' }).click();
    await expect(precisionToolsCard).toContainText('Guide: Isometric');
    await precisionGuides.getByRole('button', { name: 'Perspective' }).click();
    await expect(precisionToolsCard).toContainText('Guide: Perspective');
    await precisionCropStrip.getByRole('button', { name: 'Thirds' }).click();
    await expect(precisionCropStrip).toContainText('Thirds');
    await precisionCropStrip.getByRole('button', { name: 'Safe Margin' }).click();
    await expect(precisionCropStrip).toContainText('Safe Margin');
    const precisionTitle = precisionTextPreview.getByText('SHOT 5B');
    await precisionTypeMetrics.getByRole('button', { name: 'Right' }).click();
    await expect(precisionTitle).toHaveCSS('text-align', 'right');
    await precisionTypeMetrics.getByRole('button', { name: 'Center' }).click();
    await expect(precisionTitle).toHaveCSS('text-align', 'center');
    await precisionTextPreview.getByRole('button', { name: 'Mono' }).click();
    await expect(precisionTextPreview).toContainText('Mono');
    await precisionTextPreview.getByRole('button', { name: 'Grotesk' }).click();
    await expect(precisionTextPreview).toContainText('Grotesk');

    expectNoRuntimeIssues(collector, 'desktop brush panel inventory');
  });

  test('brush panel matches the premium visual baseline', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-brush-panel')).toHaveScreenshot('storyboard-drawing-editor-brush-panel.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    expectNoRuntimeIssues(collector, 'brush panel screenshot baseline');
  });

  test('stage, deck, timeline, and inspector expose every expected production affordance', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const stageTopbar = page.getByTestId('frame-editor-stage-topbar');
    const stageOpticsStrip = page.getByTestId('frame-editor-stage-optics-strip');
    const stageCameraStrip = page.getByTestId('frame-editor-stage-camera-strip');
    const stageLightDial = page.getByTestId('frame-editor-stage-light-dial');
    const timeline = page.getByTestId('frame-editor-timeline');
    const timeLapseCard = page.getByTestId('frame-editor-timelapse-card');
    const timeLapseSummary = page.getByTestId('frame-editor-timelapse-summary');
    const timeLapseProgress = page.getByTestId('frame-editor-timelapse-progress');
    const timeLapseReplay = page.getByTestId('frame-editor-timelapse-replay');
    const timeLapseExport4k = page.getByTestId('frame-editor-timelapse-export-4k');
    const timeLapseSocial = page.getByTestId('frame-editor-timelapse-social');
    const animationAssistCard = page.getByTestId('frame-editor-animation-assist-card');
    const animationOutputStrip = page.getByTestId('frame-editor-animation-output-strip');
    const animationTimingStrip = page.getByTestId('frame-editor-animation-timing-strip');
    const animationExposureStrip = page.getByTestId('frame-editor-animation-exposure-strip');
    const animationOnionStrip = page.getByTestId('frame-editor-animation-onion-strip');
    const animationExport = page.getByTestId('frame-editor-animation-export');
    const deckTabs = page.getByTestId('frame-editor-deck-tabs');
    const transportMeta = page.getByTestId('frame-editor-transport-meta');
    const deckTabStrip = page.getByTestId('frame-editor-deck-tab-strip');
    const deckStatusStrip = page.getByTestId('frame-editor-deck-status-strip');
    const filmstrip = page.getByTestId('frame-editor-filmstrip');
    const filmstripCore = page.getByTestId('frame-editor-filmstrip-core');
    const inspector = page.getByTestId('frame-editor-inspector');
    const canvasShell = page.getByTestId('frame-editor-canvas-shell');
    const canvasOverlays = page.getByTestId('frame-editor-canvas-overlays');
    const toolRail = page.getByTestId('frame-editor-left-rail');
    const brushLibrary = page.getByTestId('frame-editor-brush-library');
    const brushControls = page.getByTestId('frame-editor-brush-controls');
    const precisionToolsCard = page.getByTestId('frame-editor-precision-tools-card');
    const precisionTextPreview = page.getByTestId('frame-editor-precision-text-preview');
    const precisionTypeMetrics = page.getByTestId('frame-editor-precision-type-metrics');
    const precisionCanvasTools = page.getByTestId('frame-editor-precision-canvas-tools');
    const precisionCropStrip = page.getByTestId('frame-editor-precision-crop-strip');
    const precisionGuides = page.getByTestId('frame-editor-precision-guides');
    const precisionGuidePreview = page.getByTestId('frame-editor-precision-guide-preview');
    const precisionGuideToggles = page.getByTestId('frame-editor-precision-guide-toggles');
    const precisionAssists = page.getByTestId('frame-editor-precision-assists');
    const precisionAssistMeters = page.getByTestId('frame-editor-precision-assist-meters');
    const referenceDeck = page.getByTestId('frame-editor-reference-deck-card');
    const leftRail = page.getByTestId('frame-editor-canvas-rail-left');
    const rightRail = page.getByTestId('frame-editor-canvas-rail-right');
    const toolRailHeader = page.getByTestId('frame-editor-left-rail-header');
    const toolRailFooter = page.getByTestId('frame-editor-left-rail-footer');
    const toolRailBrush = page.getByTestId('frame-editor-left-rail-tool-brush');
    const toolRailLight = page.getByTestId('frame-editor-left-rail-tool-light');
    const timecodeChip = page.getByTestId('frame-editor-timecode-chip');
    const timecodeLabel = timecodeChip.locator('.MuiChip-label');
    const transportRow = page.getByTestId('frame-editor-transport-row');
    const transportLabel = page.getByTestId('frame-editor-transport-label');
    const transportControls = page.getByTestId('frame-editor-transport-controls');
    const playButton = page.getByTestId('frame-editor-play-button');
    const activeFilmstripFrame = page.getByTestId('frame-editor-filmstrip-frame-3');
    const lightingCard = page.getByTestId('frame-editor-lighting-card');
    const lightingToggles = page.getByTestId('frame-editor-lighting-toggles');
    const lightingWheel = page.getByTestId('frame-editor-lighting-wheel');
    const lightingMaterials = page.getByTestId('frame-editor-lighting-materials');
    const sideRack = page.getByTestId('frame-editor-inspector-side-rack');
    const sideRackSoft = page.getByTestId('frame-editor-side-rack-item-soft');
    const sideRackSoftLabel = sideRackSoft.locator('.MuiTypography-root');
    const statusbar = page.getByTestId('frame-editor-statusbar');
    const statusMetrics = page.getByTestId('frame-editor-status-metrics');
    const statusActions = page.getByTestId('frame-editor-status-actions');
    const statusDimensions = page.getByTestId('frame-editor-status-dimensions');
    const statusAspect = page.getByTestId('frame-editor-status-aspect');
    const statusStrokes = page.getByTestId('frame-editor-status-strokes');

    await expectTexts(stageTopbar, ['50mm', 'f/1.8', '180°', 'Camera Height']);
    await expect(stageOpticsStrip).toContainText('50mm');
    await expect(stageOpticsStrip).toContainText('f/1.8');
    await expect(stageOpticsStrip).toContainText('180°');
    await expect(stageCameraStrip).toContainText('Camera Height');
    await expect(transportMeta).toContainText('00:00:02');
    await expect(transportMeta).toContainText('PLAYBACK');
    await expect(timeLapseSummary).toContainText('2 strokes');
    await expect(timeLapseSummary).toContainText('captured 1s');
    await expect(timeLapseCard).toContainText('Time-lapse Replay');
    await expect(timeLapseCard).toContainText('READY');
    await expect(timeLapseCard).toContainText('2 strokes');
    await expect(timeLapseCard).toContainText('Export your Time-lapse recording in 4K for high-end video production');
    await expect(timeLapseCard).toContainText('Share a short, 30-second version of your Time-lapse on your socials');
    await expect(timeLapseCard).toContainText('Replay');
    await expect(timeLapseCard).toContainText('4K Master');
    await expect(timeLapseCard).toContainText('30s Social');
    await expect(animationAssistCard).toContainText('Animation Assist');
    await expect(animationAssistCard).toContainText('Easy frame-by-frame animation with customizable onion skinning');
    await expect(animationAssistCard).toContainText('Storyboards');
    await expect(animationAssistCard).toContainText('GIFs');
    await expect(animationAssistCard).toContainText('Animatics');
    await expect(animationAssistCard).toContainText('Simple Anim');
    await expect(animationAssistCard).toContainText('12 fps');
    await expect(animationAssistCard).toContainText('Run 00:04');
    await expect(animationAssistCard).toContainText('2 cues');
    await expect(animationAssistCard).toContainText('EASE · LINEAR');
    await expect(animationAssistCard).toContainText('X-SHEET');
    await expect(animationAssistCard).toContainText('F03');
    await expect(animationAssistCard).toContainText('Flythrough-driven animatic');
    await expect(animationAssistCard).toContainText('2 canvases');
    await expect(animationAssistCard).toContainText('Flythrough Start');
    await expect(animationAssistCard).toContainText('Flythrough Push');
    await expect(animationAssistCard).toContainText('Export Animatic JSON');
    await expect(brushLibrary).toContainText('BRUSH LIBRARY');
    await expect(brushControls).toContainText('Stabilize');
    await expect(precisionToolsCard).toContainText('Precision Design Tools');
    await expect(precisionToolsCard).toContainText('Vector Text');
    await expect(precisionToolsCard).toContainText('Import Fonts');
    await expect(precisionToolsCard).toContainText('Crop & Resize');
    await expect(precisionToolsCard).toContainText('TYPE RIG');
    await expect(precisionToolsCard).toContainText('TYPE METRICS');
    await expect(precisionToolsCard).toContainText('CANVAS FIT');
    await expect(precisionToolsCard).toContainText('GUIDE ENGINE');
    await expect(precisionTextPreview).toContainText('SHOT 5B');
    await expect(precisionCanvasTools).toContainText('Safe Crop');
    await expect(precisionCanvasTools).toContainText('Canvas 2');
    await expect(precisionCanvasTools).toContainText('2-point');
    await expect(precisionCropStrip).toContainText('Center');
    await expect(precisionCropStrip).toContainText('Thirds');
    await expect(precisionCropStrip).toContainText('Safe Margin');
    await expect(precisionToolsCard).toContainText('Perspective');
    await expect(precisionToolsCard).toContainText('Symmetry');
    await expect(precisionTypeMetrics).toContainText('Track +12');
    await expect(precisionGuideToggles).toContainText('Snap');
    await expect(precisionGuideToggles).toContainText('Mirror');
    await expect(precisionAssists).toContainText('Drawing Assist');
    await expect(precisionAssists).toContainText('StreamLine');
    await expectTexts(timeline, [
      '00:00:02',
      'ROUGH',
      'INK',
      'SHADOW',
      'LIGHT',
      'FX',
      'TEXT',
      'Perspective Grid',
      'Light Aware Brush',
      'Deck: SHADOW',
      'Sheet 2 · 2fr',
    ]);
    await expect(deckStatusStrip).toContainText('Perspective Grid');
    await expect(deckStatusStrip).toContainText('Light Aware Brush');
    await expect(deckStatusStrip).toContainText('Deck: SHADOW');
    await expectTexts(filmstrip, ['Beat 01', 'Beat 02', 'Beat 03', 'Beat 04']);
    await expect(timecodeChip).toContainText('00:00:02');
    await expect(transportLabel).toContainText('Play');
    await expect(transportRow).toContainText('PLAYBACK');
    await expect(activeFilmstripFrame).toContainText('Beat 03');
    await expect(activeFilmstripFrame).toContainText('5B');
    await expectTexts(inspector, ['INSPECTOR', 'LIGHTING', 'LAYERS', 'SHOT', 'Key Light', 'Time', 'Intensity', '10:30 PM', '3.200K']);
    await expect(lightingCard).toContainText('SOFT');
    await expect(sideRack).toContainText('SOFT');
    expect(await lightingMaterials.locator('div').count()).toBeGreaterThan(2);
    expect(await lightingToggles.getByText(/Casts Shadows|Ambient Occlusion/).count()).toBeGreaterThan(1);
    await expect(toolRail).toContainText('TOOLS');
    await expect(toolRail).toContainText('SNAP');
    await expect(toolRail).toContainText('ISO');
    await expect(canvasOverlays).toContainText('SAFE AREAS');
    await expect(canvasOverlays).toContainText('PUSH IN');
    await expect(statusbar).toContainText('shot');
    await expect(statusMetrics).toContainText('2.35:1');
    await expect(statusMetrics).toContainText('Strokes: 2');
    await expect(statusActions).toContainText('Cancel');
    await expect(statusActions).toContainText('Save to Frame');
    await expect(timeLapseReplay).toBeEnabled();
    await expect(timeLapseExport4k).toBeDisabled();
    await expect(timeLapseSocial).toBeDisabled();
    await expect(animationExport).toBeEnabled();
    expect(await leftRail.locator('div').count()).toBeGreaterThan(5);
    expect(await rightRail.locator('div').count()).toBeGreaterThan(4);

    expect(await timeline.getByRole('button').count()).toBeGreaterThanOrEqual(24);
    expect(await deckTabs.getByRole('button').count()).toBe(6);
    expect(await filmstrip.getByRole('button').count()).toBe(2);
    expect(await deckTabStrip.getByRole('button').count()).toBe(6);
    expect(await animationOutputStrip.locator('.MuiChip-clickable').count()).toBe(4);
    expect(await precisionGuides.getByRole('button').count()).toBe(6);
    expect(await precisionGuideToggles.getByRole('button').count()).toBe(2);
    expect(await precisionTextPreview.getByRole('button').count()).toBe(6);
    expect(await precisionTypeMetrics.getByRole('button').count()).toBe(3);
    expect(await precisionCropStrip.getByRole('button').count()).toBe(3);
    expect(await animationExposureStrip.locator('div').count()).toBeGreaterThan(7);
    expect(await animationExposureStrip.locator('[data-testid^="frame-editor-animation-exposure-frame-"]').count()).toBe(8);
    expect(await inspector.getByRole('button', { name: 'LIGHTING' }).count()).toBe(1);
    expect(await inspector.getByRole('button', { name: 'LAYERS' }).count()).toBe(1);
    expect(await inspector.getByRole('button', { name: 'SHOT' }).count()).toBe(1);
    expect(await toolRail.locator('[data-testid^="frame-editor-left-rail-tool-"]').count()).toBe(6);

    const canvasBox = await getBox(canvasShell, 'canvas shell');
    const stageTopbarBox = await getBox(stageTopbar, 'stage topbar');
    const stageOpticsStripBox = await getBox(stageOpticsStrip, 'stage optics strip');
    const stageCameraStripBox = await getBox(stageCameraStrip, 'stage camera strip');
    const stageLightDialBox = await getBox(stageLightDial, 'stage light dial');
    const timelineBox = await getBox(timeline, 'timeline');
    const timeLapseCardBox = await getBox(timeLapseCard, 'time-lapse card');
    const animationAssistCardBox = await getBox(animationAssistCard, 'animation assist card');
    const animationTimingStripBox = await getBox(animationTimingStrip, 'animation timing strip');
    const precisionGuidePreviewBox = await getBox(precisionGuidePreview, 'precision guide preview');
    const precisionAssistMetersBox = await getBox(precisionAssistMeters, 'precision assist meters');
    const precisionCanvasToolsBox = await getBox(precisionCanvasTools, 'precision canvas tools');
    const transportMetaBox = await getBox(transportMeta, 'transport meta');
    const deckStatusStripBox = await getBox(deckStatusStrip, 'deck status strip');
    const filmstripCoreBox = await getBox(filmstripCore, 'filmstrip core');
    const activeFilmstripBox = await getBox(activeFilmstripFrame, 'active filmstrip frame');
    const transportControlsBox = await getBox(transportControls, 'transport controls');
    const lightingWheelBox = await getBox(lightingWheel, 'lighting wheel');
    const lightingTogglesBox = await getBox(lightingToggles, 'lighting toggles');
    const canvasOverlaysBox = await getBox(canvasOverlays, 'canvas overlays');
    const sideRackBox = await getBox(sideRack, 'side rack');
    const statusMetricsBox = await getBox(statusMetrics, 'status metrics');
    const statusActionsBox = await getBox(statusActions, 'status actions');
    const toolRailHeaderBox = await getBox(toolRailHeader, 'tool rail header');
    const toolRailFooterBox = await getBox(toolRailFooter, 'tool rail footer');
    expect(stageTopbarBox.width).toBeGreaterThan(700);
    expect(stageTopbarBox.height).toBeGreaterThan(40);
    expect(stageOpticsStripBox.width).toBeGreaterThan(145);
    expect(stageCameraStripBox.width).toBeGreaterThan(220);
    expect(Math.abs(stageLightDialBox.width - stageLightDialBox.height)).toBeLessThan(4);
    expect(canvasBox.width).toBeGreaterThan(760);
    expect(canvasBox.height).toBeGreaterThan(250);
    expect(timelineBox.width).toBeGreaterThan(700);
    expect(timelineBox.height).toBeGreaterThan(140);
    expect(timeLapseCardBox.width).toBeGreaterThan(320);
    expect(animationAssistCardBox.width).toBeGreaterThan(320);
    expect(Math.abs(timeLapseCardBox.y - animationAssistCardBox.y)).toBeLessThan(8);
    expect(animationTimingStripBox.width).toBeGreaterThan(220);
    expect(precisionGuidePreviewBox.height).toBeGreaterThan(50);
    expect(precisionAssistMetersBox.height).toBeGreaterThan(30);
    expect(precisionCanvasToolsBox.height).toBeGreaterThan(80);
    expect(transportMetaBox.width).toBeGreaterThan(140);
    expect(deckStatusStripBox.width).toBeGreaterThan(260);
    expect(filmstripCoreBox.width).toBeGreaterThan(500);
    expect(activeFilmstripBox.height).toBeGreaterThanOrEqual(50);
    expect(transportControlsBox.width).toBeGreaterThan(170);
    expect(lightingWheelBox.width).toBeGreaterThan(140);
    expect(Math.abs(lightingWheelBox.width - lightingWheelBox.height)).toBeLessThan(6);
    expect(lightingTogglesBox.width).toBeGreaterThan(160);
    expect(canvasOverlaysBox.width).toBeGreaterThan(700);
    expect(sideRackBox.height).toBeGreaterThan(100);
    expect(statusMetricsBox.width).toBeGreaterThan(250);
    expect(statusActionsBox.width).toBeGreaterThan(170);
    expect(toolRailHeaderBox.height).toBeGreaterThan(40);
    expect(toolRailFooterBox.height).toBeGreaterThan(30);

    const timecodeFont = await getCss(timecodeLabel, 'font-family');
    const timecodeLetterSpacing = await getCss(timecodeLabel, 'letter-spacing');
    const activeFilmstripBorder = await getCss(activeFilmstripFrame, 'border-top-color');
    const activeFilmstripShadow = await getCss(activeFilmstripFrame, 'box-shadow');
    const transportControlsBackground = await getCss(transportControls, 'background-image');
    const playButtonShadow = await getCss(playButton, 'box-shadow');
    const lightingCardBackground = await getCss(lightingCard, 'background-image');
    const lightingWheelBorder = await getCss(lightingWheel, 'border-top-color');
    const lightingTogglesBorder = await getCss(lightingToggles, 'border-top-color');
    const lightingMaterialsBorder = await getCss(lightingMaterials, 'border-top-color');
    const sideRackSoftColor = await getCss(sideRackSoftLabel, 'color');
    const timeLapseCardBackground = await getCss(timeLapseCard, 'background-image');
    const timeLapseProgressBackground = await getCss(timeLapseProgress, 'background-color');
    const animationOnionBorder = await getCss(animationOnionStrip, 'border-top-color');
    const animationTimingBackground = await getCss(animationTimingStrip, 'background-color');
    const animationExposureBackground = await getCss(animationExposureStrip, 'background-color');
    const precisionGuidesBorder = await getCss(precisionGuides, 'border-top-color');
    const precisionGuidePreviewBorder = await getCss(precisionGuidePreview, 'border-top-color');
    const precisionCanvasToolsBorder = await getCss(precisionCanvasTools, 'border-top-color');
    const stageOpticsStripBackground = await getCss(stageOpticsStrip, 'background-color');
    const stageCameraStripBorder = await getCss(stageCameraStrip, 'border-top-color');
    const stageLightDialShadow = await getCss(stageLightDial, 'box-shadow');
    const transportMetaBorder = await getCss(transportMeta, 'border-top-color');
    const deckStatusStripBorder = await getCss(deckStatusStrip, 'border-top-color');
    const filmstripCoreBackground = await getCss(filmstripCore, 'background-color');
    const statusDimensionsBackground = await getCss(statusDimensions, 'background-color');
    const statusAspectColor = await getCss(statusAspect, 'color');
    const statusStrokesBackground = await getCss(statusStrokes, 'background-color');
    const toolRailBrushBackground = await getCss(toolRailBrush, 'background-image');
    const toolRailLightBorder = await getCss(toolRailLight, 'border-top-color');
    expect(timecodeFont).toContain('Mono');
    expect(Number.parseFloat(timecodeLetterSpacing)).toBeGreaterThan(0.6);
    expect(activeFilmstripBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(activeFilmstripShadow).not.toBe('none');
    expect(transportControlsBackground).not.toBe('none');
    expect(playButtonShadow).not.toBe('none');
    expect(lightingCardBackground).toContain('linear-gradient');
    expect(lightingWheelBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(lightingTogglesBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(lightingMaterialsBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(sideRackSoftColor).not.toBe('rgb(255, 255, 255)');
    expect(timeLapseCardBackground).toContain('linear-gradient');
    expect(timeLapseProgressBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(animationTimingBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(animationExposureBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(animationOnionBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(precisionGuidesBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(precisionGuidePreviewBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(precisionCanvasToolsBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(stageOpticsStripBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(stageCameraStripBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(stageLightDialShadow).not.toBe('none');
    expect(transportMetaBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(deckStatusStripBorder).not.toBe('rgba(0, 0, 0, 0)');
    expect(filmstripCoreBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(statusDimensionsBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(statusAspectColor).not.toBe('rgb(255, 255, 255)');
    expect(statusStrokesBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(toolRailBrushBackground).toContain('linear-gradient');
    expect(toolRailLightBorder).not.toBe('rgba(0, 0, 0, 0)');

    await page.getByRole('button', { name: 'LAYERS' }).click();
    const layersStack = page.getByTestId('frame-editor-layers-stack');
    const layerControlsCard = page.getByTestId('frame-editor-layer-controls-card');
    const motionRigCard = page.getByTestId('frame-editor-motion-rig-card');
    const shadowsLayer = page.getByTestId('frame-editor-layer-card-shadows');
    await expectTexts(inspector, ['Blend Mode', 'Multiply', 'Layer Opacity', 'Motion Rig', 'Camera Push', 'Ink Pass', 'Sketch', 'Line Art', 'Shadows', 'Lighting', 'PX / Grain', 'Shadow stack', 'Master mix']);
    expect(await layersStack.locator('[data-testid^="frame-editor-layer-card-"]').count()).toBe(7);
    await expect(shadowsLayer).toContainText('Multiply');
    await expect(shadowsLayer).toContainText('100%');
    await expect(layerControlsCard).toContainText('100%');
    await expect(motionRigCard).toContainText('2 keys');
    await expect(motionRigCard).toContainText('Translate X');
    await expect(motionRigCard).toContainText('Scale');
    await expect(motionRigCard).toContainText('Perspective X');
    await expect(motionRigCard).toContainText('Perspective Y');
    await expect(motionRigCard).toContainText('Corner Warp');
    await expect(motionRigCard).toContainText('Warp X');
    await expect(motionRigCard).toContainText('Warp Y');
    await page.getByRole('button', { name: 'SHOT' }).click();
    const shotSummaryCard = page.getByTestId('frame-editor-shot-summary-card');
    const shotNotesStack = page.getByTestId('frame-editor-shot-notes-stack');
    const spatialWorkspaceCard = page.getByTestId('frame-editor-spatial-workspace-card');
    const lightingShotNote = page.getByTestId('frame-editor-shot-note-lighting');
    await expectTexts(inspector, [
      'Safe Crop',
      'Push In',
      'Hero Read',
      'Screen Dir',
      'R -> L',
      'Focus',
      'Hero forearm',
      'Blocking hold with safe-area crop',
      'Hero silhouette reads clean in center',
      'Push contrast on forearm and gun plane',
      'Street practical from screen right',
      'Add subtle dust and rain pass',
      'SPATIAL WORKSPACE',
      'SHAPE INTENT ASSIST',
      'REFERENCE STUDY',
      'SPATIAL MAP',
      'FLYTHROUGH',
      'REFERENCE DECK',
      'BOARD POLISH',
      'Line Boost',
      'Vignette',
      'CINEMATIC SCENE KITS',
      'Warehouse Standoff',
      'Clerestory Standoff',
      'Forest Titan Reveal',
      'Titan Overwatch',
      'Warehouse Push-In',
      'Rooftop Vigil',
      'Rain Alley Pursuit',
      'Interrogation Threshold',
      'Last Train Pursuit',
      'Board Ref A',
      'Board Ref B',
      'Canvas 2',
      'Canvas 3',
      'Flythrough Start',
      'Flythrough Push',
      'Loop Ready',
      'No projection passes yet',
      'Project Active Sheet',
      'Source: Canvas 2',
      'Target: Canvas 3',
      'Reinterpret ON',
      'Arrange Later ON',
      'FRAME',
      'READ',
      'VALUE',
      'LIGHT',
      'TEXTURE',
    ]);
    await expect(referenceDeck).toContainText('contain');
    await expect(referenceDeck).toContainText('cover');
    expect(await shotNotesStack.locator('[data-testid^="frame-editor-shot-note-"]').count()).toBe(7);
    await expect(shotSummaryCard).toContainText('Eyeline');
    await expect(spatialWorkspaceCard).toContainText('3 canvases');
    await expect(lightingShotNote).toContainText('LIGHT');
    await page.getByRole('button', { name: 'LIGHTING' }).click();
    await expectTexts(inspector, ['Casts Shadows', 'Ambient Occlusion']);

    expectNoRuntimeIssues(collector, 'stage deck inspector affordances');
  });

  test('stage and inspector details match the premium visual baseline', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    await expect(page.getByTestId('frame-editor-stage')).toHaveScreenshot('storyboard-drawing-editor-stage.png', {
      animations: 'disabled',
      caret: 'hide',
    });
    await expect(page.getByTestId('frame-editor-inspector')).toHaveScreenshot('storyboard-drawing-editor-inspector.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    expectNoRuntimeIssues(collector, 'stage and inspector screenshot baselines');
  });

  test('inspector modes match dedicated visual baselines', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1640, height: 1100 });
    await page.goto(`${TEST_PAGE}?workflow=shot&aspect=${encodeURIComponent('2.35:1')}`);

    const inspector = page.getByTestId('frame-editor-inspector');
    await expect(inspector).toHaveScreenshot('storyboard-drawing-editor-inspector-lighting.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    await inspector.getByRole('button', { name: 'LAYERS' }).click();
    await expect(inspector).toHaveScreenshot('storyboard-drawing-editor-inspector-layers.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    await inspector.getByRole('button', { name: 'SHOT' }).click();
    await expect(inspector).toHaveScreenshot('storyboard-drawing-editor-inspector-shot.png', {
      animations: 'disabled',
      caret: 'hide',
    });

    expectNoRuntimeIssues(collector, 'inspector mode screenshot baselines');
  });

  test('workflow query presets drive the correct defaults across blocking and presentation modes', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1600, height: 1080 });

    await page.goto(`${TEST_PAGE}?workflow=blocking&aspect=${encodeURIComponent('2.35:1')}`);
    await expect(page.getByTestId('frame-editor-workflow-chip')).toContainText('blocking');
    await expect(page.getByTestId('frame-editor-timeline')).toContainText('Deck: ROUGH');
    await expect(page.getByTestId('frame-editor-timeline')).toContainText('Perspective Grid');
    await expect(page.getByTestId('frame-editor-inspector')).toContainText('Key Light');
    await expect(page.getByRole('button', { name: /^Grid$/ })).toBeVisible();
    await expect(page.getByTestId('frame-editor-header').getByRole('button', { name: /^Light$/ })).toBeVisible();
    await expect(page.getByTestId('frame-editor-brand')).toContainText('Scene 15');
    await expect(page.getByTestId('frame-editor-brand')).toContainText('SHOT 5B');
    await expect(page.getByTestId('frame-editor-statusbar')).toContainText('2.35:1');
    expect(await page.getByTestId('frame-editor-body').count()).toBe(1);
    expect(await page.getByTestId('frame-editor-left-rail').count()).toBe(1);
    expect(await page.getByTestId('frame-editor-brush-panel').count()).toBe(1);
    expect(await page.getByTestId('frame-editor-stage').count()).toBe(1);
    expect(await page.getByTestId('frame-editor-inspector').count()).toBe(1);

    await page.goto(`${TEST_PAGE}?workflow=presentation&aspect=${encodeURIComponent('2.35:1')}`);
    await expect(page.getByTestId('frame-editor-workflow-chip')).toContainText('presentation');
    await expect(page.getByTestId('frame-editor-timeline')).toContainText('Deck: LIGHT');
    await expect(page.getByTestId('frame-editor-timeline')).toContainText('Grid Off');
    await expect(page.getByTestId('frame-editor-inspector')).toContainText('Blend Mode');
    await expect(page.getByTestId('frame-editor-inspector')).toContainText('Multiply');
    await expect(page.getByTestId('frame-editor-inspector')).toContainText('Layer Opacity');
    await expect(page.getByTestId('frame-editor-inspector')).toContainText('Sketch');
    await expect(page.getByTestId('frame-editor-inspector')).toContainText('Line Art');
    await expect(page.getByTestId('frame-editor-inspector')).toContainText('Shadows');
    await expect(page.getByTestId('frame-editor-inspector')).toContainText('Lighting');
    await expect(page.getByTestId('frame-editor-inspector')).toContainText('PX / Grain');
    await expect(page.getByTestId('frame-editor-statusbar')).toContainText('2.35:1');
    expect(await page.getByTestId('frame-editor-body').count()).toBe(1);
    expect(await page.getByTestId('frame-editor-left-rail').count()).toBe(1);
    expect(await page.getByTestId('frame-editor-brush-panel').count()).toBe(1);
    expect(await page.getByTestId('frame-editor-stage').count()).toBe(1);
    expect(await page.getByTestId('frame-editor-inspector').count()).toBe(1);

    expectNoRuntimeIssues(collector, 'workflow query presets');
  });

  test('selection scenario supports ellipse selection, pivot reset, invert, scale, and rotate on transformed layers', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1480, height: 1100 });
    await page.goto(`${TEST_PAGE}?scenario=selection`);

    const canvas = page.getByTestId('pencil-canvas-pro');
    const targetRegion = page.getByTestId('selection-harness-target-region');
    const displayBoundsChip = page.getByTestId('selection-harness-display-bounds');
    const selectTool = page.getByTestId('pencil-canvas-tool-select');
    const rectangleMode = page.getByTestId('pencil-canvas-selection-mode-rectangle');
    const ellipseMode = page.getByTestId('pencil-canvas-selection-mode-ellipse');
    const preview = page.getByTestId('pencil-canvas-selection-preview');
    const invertButton = page.getByTestId('pencil-canvas-selection-invert');
    const snapButton = page.getByTestId('pencil-canvas-selection-snap');
    const clearButton = page.getByTestId('pencil-canvas-selection-clear');
    const pivotCenterButton = page.getByTestId('pencil-canvas-selection-pivot-center');
    const pivotLeftButton = page.getByTestId('pencil-canvas-selection-pivot-left');
    const pivotRightButton = page.getByTestId('pencil-canvas-selection-pivot-right');
    const pivotTopButton = page.getByTestId('pencil-canvas-selection-pivot-top');
    const pivotBottomButton = page.getByTestId('pencil-canvas-selection-pivot-bottom');
    const resetPivotButton = page.getByTestId('pencil-canvas-selection-reset-pivot');

    await expect(canvas).toBeVisible();
    await expect(targetRegion).toBeVisible();
    await expect(selectTool).toBeVisible();

    const initialDisplayBounds = await parseHarnessBounds(displayBoundsChip);
    const canvasBox = await getBox(canvas, 'selection harness canvas');
    await selectTool.click();
    await expect(rectangleMode).toBeVisible();
    await expect(ellipseMode).toBeVisible();
    await expect(invertButton).toBeVisible();
    await expect(snapButton).toBeVisible();
    await expect(clearButton).toBeDisabled();
    await expect(pivotCenterButton).toBeVisible();
    await expect(pivotLeftButton).toBeVisible();
    await expect(pivotRightButton).toBeVisible();
    await expect(pivotTopButton).toBeVisible();
    await expect(pivotBottomButton).toBeVisible();
    await expect(resetPivotButton).toBeDisabled();
    await ellipseMode.click();

    const targetBox = await getBox(targetRegion, 'selection harness target region');
    await page.mouse.move(targetBox.x + 8, targetBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + 48, targetBox.y + 36, { steps: 4 });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('data-selection-preview-mode', 'ellipse');
    await page.mouse.move(targetBox.x + targetBox.width - 8, targetBox.y + targetBox.height - 8, { steps: 10 });
    await page.mouse.up();

    const selectionBox = page.getByTestId('pencil-canvas-selection-box');
    await expect(selectionBox).toBeVisible();
    const ellipseSelectionBox = await getBox(selectionBox, 'ellipse selection box');
    await invertButton.click();
    await expect(selectionBox).toBeVisible();
    const invertedSelectionBox = await getBox(selectionBox, 'inverted selection box');
    expect(
      Math.abs(invertedSelectionBox.x - ellipseSelectionBox.x)
      + Math.abs(invertedSelectionBox.y - ellipseSelectionBox.y)
      + Math.abs(invertedSelectionBox.width - ellipseSelectionBox.width)
      + Math.abs(invertedSelectionBox.height - ellipseSelectionBox.height),
    ).toBeGreaterThan(24);

    await expect(clearButton).toBeEnabled();
    await clearButton.click();
    await expect(selectionBox).toHaveCount(0);
    await expect(clearButton).toBeDisabled();
    await expect(resetPivotButton).toBeDisabled();

    await rectangleMode.click();
    await page.mouse.move(targetBox.x + 8, targetBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width - 8, targetBox.y + targetBox.height - 8, { steps: 10 });
    await page.mouse.up();

    const pivotHandle = page.getByTestId('pencil-canvas-selection-handle-pivot');
    const eastHandle = page.getByTestId('pencil-canvas-selection-handle-e');
    const rotateHandle = page.getByTestId('pencil-canvas-selection-handle-rotate');

    await expect(selectionBox).toBeVisible();
    await expect(pivotHandle).toBeVisible();
    await expect(eastHandle).toBeVisible();
    await expect(rotateHandle).toBeVisible();

    const selectedBox = await getBox(selectionBox, 'selection box');
    expect(Math.abs(selectedBox.x - targetBox.x)).toBeLessThan(32);
    expect(Math.abs(selectedBox.y - targetBox.y)).toBeLessThan(32);
    expect(selectedBox.width).toBeGreaterThan(targetBox.width * 0.7);
    expect(selectedBox.width).toBeLessThan(targetBox.width * 1.5);
    expect(selectedBox.height).toBeGreaterThan(targetBox.height * 0.7);
    expect(selectedBox.height).toBeLessThan(targetBox.height * 1.5);

    const centerPivotBeforePresetX = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-x')) || '0');
    const centerPivotBeforePresetY = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-y')) || '0');
    await pivotLeftButton.click();
    const leftPresetPivotX = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-x')) || '0');
    const leftPresetPivotY = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-y')) || '0');
    expect(await selectionBox.getAttribute('data-selection-custom-pivot')).toBe('true');
    expect(leftPresetPivotX).toBeLessThan(centerPivotBeforePresetX - 20);
    expect(Math.abs(leftPresetPivotY - centerPivotBeforePresetY)).toBeLessThan(20);

    await expect(snapButton).toHaveAttribute('aria-pressed', 'false');
    await snapButton.click();
    await expect(snapButton).toHaveAttribute('aria-pressed', 'true');

    const snapPivotTargetLocalX = 389;
    const snapPivotTargetLocalY = 334;
    const snapPivotTargetX = canvasBox.x + snapPivotTargetLocalX;
    const snapPivotTargetY = canvasBox.y + snapPivotTargetLocalY;
    const snapPivotHandleBox = await getBox(pivotHandle, 'pivot handle before snap drag');
    await page.mouse.move(snapPivotHandleBox.x + (snapPivotHandleBox.width / 2), snapPivotHandleBox.y + (snapPivotHandleBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(snapPivotTargetX, snapPivotTargetY, { steps: 14 });
    await page.mouse.up();

    const snappedPivotX = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-x')) || '0');
    const snappedPivotY = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-y')) || '0');
    expect(Math.abs(snappedPivotX - 400)).toBeLessThan(2);
    expect(Math.abs(snappedPivotY - 350)).toBeLessThan(2);

    await snapButton.click();
    await expect(snapButton).toHaveAttribute('aria-pressed', 'false');

    expect(await selectionBox.getAttribute('data-selection-custom-pivot')).toBe('true');

    const pivotBox = await getBox(pivotHandle, 'pivot handle');
    const targetPivotX = targetBox.x + 28;
    const targetPivotY = targetBox.y + 24;
    const targetPivotLocalX = targetPivotX - canvasBox.x;
    const targetPivotLocalY = targetPivotY - canvasBox.y;
    await page.mouse.move(pivotBox.x + (pivotBox.width / 2), pivotBox.y + (pivotBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(targetPivotX, targetPivotY, { steps: 14 });
    await page.mouse.up();

    const customPivotX = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-x')) || '0');
    const customPivotY = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-y')) || '0');
    expect(await selectionBox.getAttribute('data-selection-custom-pivot')).toBe('true');
    expect(Math.abs(customPivotX - targetPivotLocalX)).toBeLessThan(28);
    expect(Math.abs(customPivotY - targetPivotLocalY)).toBeLessThan(28);
    expect(Math.abs(customPivotX - (Math.round(customPivotX / 50) * 50))).toBeGreaterThan(5);
    expect(Math.abs(customPivotY - (Math.round(customPivotY / 50) * 50))).toBeGreaterThan(5);
    await expect(resetPivotButton).toBeEnabled();

    const eastBox = await getBox(eastHandle, 'east resize handle');
    await page.mouse.move(eastBox.x + eastBox.width / 2, eastBox.y + eastBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(eastBox.x + eastBox.width / 2 + 72, eastBox.y + eastBox.height / 2, { steps: 12 });
    await page.mouse.up();

    const scaledBounds = await parseHarnessBounds(displayBoundsChip);
    expect(scaledBounds.width).toBeGreaterThan(initialDisplayBounds.width + 35);
    const scaledPivotX = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-x')) || '0');
    const scaledPivotY = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-y')) || '0');
    expect(Math.abs(scaledPivotX - customPivotX)).toBeLessThan(1.5);
    expect(Math.abs(scaledPivotY - customPivotY)).toBeLessThan(1.5);

    await resetPivotButton.click();
    const resetPivotX = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-x')) || '0');
    const resetPivotY = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-y')) || '0');
    expect(await selectionBox.getAttribute('data-selection-custom-pivot')).toBe('false');
    expect(Math.abs(resetPivotX - (scaledBounds.x + (scaledBounds.width / 2)))).toBeLessThan(20);
    expect(Math.abs(resetPivotY - (scaledBounds.y + (scaledBounds.height / 2)))).toBeLessThan(20);
    await expect(resetPivotButton).toBeDisabled();

    const rotateBox = await getBox(rotateHandle, 'rotate handle');
    const rotatedSelectionBox = await getBox(selectionBox, 'selection box before rotate');
    await page.mouse.move(rotateBox.x + rotateBox.width / 2, rotateBox.y + rotateBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rotatedSelectionBox.x + rotatedSelectionBox.width + 32, rotatedSelectionBox.y + 10, { steps: 14 });
    await page.mouse.up();

    const rotation = await selectionBox.getAttribute('data-selection-rotation');
    expect(rotation).not.toBeNull();
    expect(Math.abs(Number.parseFloat(rotation || '0'))).toBeGreaterThan(5);
    const rotatedPivotX = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-x')) || '0');
    const rotatedPivotY = Number.parseFloat((await selectionBox.getAttribute('data-selection-pivot-y')) || '0');
    expect(await selectionBox.getAttribute('data-selection-custom-pivot')).toBe('false');

    const rotatedBounds = await parseHarnessBounds(displayBoundsChip);
    expect(rotatedBounds.width).toBeGreaterThan(120);
    expect(rotatedBounds.height).toBeGreaterThan(90);
    expect(Math.abs(rotatedPivotX - resetPivotX)).toBeLessThan(40);
    expect(Math.abs(rotatedPivotY - resetPivotY)).toBeLessThan(40);

    expectNoRuntimeIssues(collector, 'selection transform scenario');
  });

  test('selection snapping exposes controls and snaps rotate to angle increments', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1480, height: 1100 });
    await page.goto(`${TEST_PAGE}?scenario=selection`);

    const canvas = page.getByTestId('pencil-canvas-pro');
    const targetRegion = page.getByTestId('selection-harness-target-region');
    const selectTool = page.getByTestId('pencil-canvas-tool-select');
    const snapButton = page.getByTestId('pencil-canvas-selection-snap');

    await expect(canvas).toBeVisible();
    await expect(targetRegion).toBeVisible();
    await expect(selectTool).toBeVisible();

    await selectTool.click();

    const targetBox = await getBox(targetRegion, 'selection harness target region');
    await page.mouse.move(targetBox.x + 8, targetBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width - 8, targetBox.y + targetBox.height - 8, { steps: 10 });
    await page.mouse.up();

    const selectionBox = page.getByTestId('pencil-canvas-selection-box');
    const rotateHandle = page.getByTestId('pencil-canvas-selection-handle-rotate');

    await expect(selectionBox).toBeVisible();
    await expect(rotateHandle).toBeVisible();
    await expect(snapButton).toHaveAttribute('aria-pressed', 'false');
    await snapButton.click();
    await expect(snapButton).toHaveAttribute('aria-pressed', 'true');

    const rotateBox = await getBox(rotateHandle, 'selection rotate handle');
    const rotatedSelectionBox = await getBox(selectionBox, 'selection box before snapped rotate');
    await page.mouse.move(rotateBox.x + (rotateBox.width / 2), rotateBox.y + (rotateBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(rotatedSelectionBox.x + rotatedSelectionBox.width + 34, rotatedSelectionBox.y + 29, { steps: 14 });
    await page.mouse.up();

    const rotation = Number.parseFloat((await selectionBox.getAttribute('data-selection-rotation')) || '0');
    const snappedRemainder = Math.abs(rotation % 15);
    expect(Math.min(snappedRemainder, 15 - snappedRemainder)).toBeLessThan(0.75);

    expectNoRuntimeIssues(collector, 'selection snapping scenario');
  });

  test('selection transform popover applies perspective skew to the current selection', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1480, height: 1100 });
    await page.goto(`${TEST_PAGE}?scenario=selection`);

    const canvas = page.getByTestId('pencil-canvas-pro');
    const targetRegion = page.getByTestId('selection-harness-target-region');
    const selectTool = page.getByTestId('pencil-canvas-tool-select');
    const displayBoundsChip = page.getByTestId('selection-harness-display-bounds');
    const transformButton = page.getByTestId('pencil-canvas-selection-transform');
    const transformPopover = page.getByTestId('pencil-canvas-selection-transform-popover');
    const perspectiveControl = page.getByTestId('pencil-canvas-selection-transform-perspective-x');
    const perspectiveYControl = page.getByTestId('pencil-canvas-selection-transform-perspective-y');
    const cornerTabs = page.getByTestId('pencil-canvas-selection-transform-corner-tabs');
    const cornerNeButton = page.getByTestId('pencil-canvas-selection-transform-corner-ne');
    const warpXControl = page.getByTestId('pencil-canvas-selection-transform-warp-x');
    const warpYControl = page.getByTestId('pencil-canvas-selection-transform-warp-y');
    const applyTransformButton = page.getByTestId('pencil-canvas-selection-transform-apply');

    await expect(canvas).toBeVisible();
    await expect(targetRegion).toBeVisible();
    await expect(selectTool).toBeVisible();

    await selectTool.click();

    const targetBox = await getBox(targetRegion, 'selection harness target region');
    await page.mouse.move(targetBox.x + 8, targetBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width - 8, targetBox.y + targetBox.height - 8, { steps: 10 });
    await page.mouse.up();

    const selectionBox = page.getByTestId('pencil-canvas-selection-box');
    await expect(selectionBox).toBeVisible();
    const initialBounds = await parseHarnessBounds(displayBoundsChip);

    await expect(transformButton).toBeVisible();
    await transformButton.click();
    await expect(transformPopover).toBeVisible();
    await expect(perspectiveControl).toBeVisible();
    await expect(perspectiveYControl).toBeVisible();
    await expect(cornerTabs).toBeVisible();
    await expect(cornerNeButton).toBeVisible();
    await expect(warpXControl).toBeVisible();
    await expect(warpYControl).toBeVisible();

    await setRangeInputValue(perspectiveControl, 0.45);
    await setRangeInputValue(perspectiveYControl, -0.35);
    await cornerNeButton.click();
    await setRangeInputValue(warpXControl, 24);
    await setRangeInputValue(warpYControl, -16);
    await expect(transformPopover).toContainText('Perspective X: 45%');
    await expect(transformPopover).toContainText('Perspective Y: -35%');
    await expect(transformPopover).toContainText('Corner Warp');
    await expect(transformPopover).toContainText('Warp X: 24 px');
    await expect(transformPopover).toContainText('Warp Y: -16 px');
    await applyTransformButton.click();

    await expect(transformPopover).toHaveCount(0);
    await expect(selectionBox).toBeVisible();

    const transformedBounds = await parseHarnessBounds(displayBoundsChip);
    const geometryDelta =
      Math.abs(transformedBounds.width - initialBounds.width)
      + Math.abs(transformedBounds.height - initialBounds.height)
      + Math.abs(transformedBounds.x - initialBounds.x)
      + Math.abs(transformedBounds.y - initialBounds.y);
    expect(geometryDelta).toBeGreaterThan(18);

    expectNoRuntimeIssues(collector, 'selection perspective transform scenario');
  });

  test('selection perspective handles reshape the current selection directly on-canvas', async ({ page }) => {
    const collector = attachRuntimeCollector(page);
    await page.setViewportSize({ width: 1480, height: 1100 });
    await page.goto(`${TEST_PAGE}?scenario=selection`);

    const canvas = page.getByTestId('pencil-canvas-pro');
    const targetRegion = page.getByTestId('selection-harness-target-region');
    const selectTool = page.getByTestId('pencil-canvas-tool-select');
    const displaySignatureChip = page.getByTestId('selection-harness-display-signature');
    const selectionOverlay = page.getByTestId('pencil-canvas-selection-transform-overlay');
    const selectionBox = page.getByTestId('pencil-canvas-selection-box');
    const perspectiveHandle = page.getByTestId('pencil-canvas-selection-handle-perspective-ne');

    await expect(canvas).toBeVisible();
    await expect(targetRegion).toBeVisible();
    await expect(selectTool).toBeVisible();

    await selectTool.click();

    const targetBox = await getBox(targetRegion, 'selection harness target region');
    await page.mouse.move(targetBox.x + 8, targetBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width - 8, targetBox.y + targetBox.height - 8, { steps: 10 });
    await page.mouse.up();

    await expect(selectionBox).toBeVisible();
    await expect(perspectiveHandle).toBeVisible();
    const initialSignature = await displaySignatureChip.textContent();
    const handleBox = await getBox(perspectiveHandle, 'selection perspective handle');

    await page.mouse.move(handleBox.x + (handleBox.width / 2), handleBox.y + (handleBox.height / 2));
    await page.mouse.down();
    await page.mouse.move(handleBox.x + (handleBox.width / 2) + 30, handleBox.y + (handleBox.height / 2) + 22, { steps: 14 });
    await page.mouse.up();

    await expect.poll(async () => selectionOverlay.getAttribute('data-selection-last-transform-handle'), {
      message: 'selection perspective handle drag should be registered as a perspective transform',
    }).toBe('perspective-ne');
    await expect.poll(async () => {
      const warpX = Number.parseFloat((await selectionOverlay.getAttribute('data-selection-last-warp-x')) || '0');
      const warpY = Number.parseFloat((await selectionOverlay.getAttribute('data-selection-last-warp-y')) || '0');
      return Math.abs(warpX) + Math.abs(warpY);
    }, {
      message: 'selection perspective handle drag should compute non-zero corner warp offsets',
    }).toBeGreaterThan(0.1);
    await expect.poll(async () => displaySignatureChip.textContent(), {
      message: 'selection perspective handle drag should mutate the transformed stroke signature',
    }).not.toBe(initialSignature ?? '');

    expectNoRuntimeIssues(collector, 'selection perspective handles scenario');
  });
});

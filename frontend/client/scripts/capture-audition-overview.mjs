import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const outDir = '/Users/usmanqazi/github/creatorhub/frontend/client/public/guide/audition';
const shots = {
  main: path.join(outDir, 'overview-main.png'),
  header: path.join(outDir, 'overview-header.png'),
  full: path.join(outDir, 'overview-full.png'),
  creatingForm: path.join(outDir, 'creating-form.png'),
  editingForm: path.join(outDir, 'editing-form.png'),
  viewModes: path.join(outDir, 'view-modes-switcher.png'),
  standardVsPro: path.join(outDir, 'standard-vs-pro.png'),
};

const BASE_URL = 'http://localhost:5001';
const GUIDE_SEED_ROLE_ID = 'guide-seed-role';
const GUIDE_SEED_CANDIDATE_ID = 'guide-seed-candidate';

const ensureGuideSeedData = async () => {
  try {
    const response = await fetch(`${BASE_URL}/api/casting/projects`);
    if (!response.ok) return;
    const payload = await response.json();
    const projects = Array.isArray(payload?.projects) ? payload.projects : [];
    if (!projects.length) return;

    const project =
      projects.find((entry) => typeof entry?.name === 'string' && entry.name.toLowerCase().includes('troll')) ||
      projects[0];
    if (!project?.id) return;

    const nowIso = new Date().toISOString();

    const roles = Array.isArray(project.roles) ? [...project.roles] : [];
    const candidates = Array.isArray(project.candidates) ? [...project.candidates] : [];
    let changed = false;

    let role = roles.find((entry) => entry?.id === GUIDE_SEED_ROLE_ID) || roles[0];
    if (!role) {
      role = {
        id: GUIDE_SEED_ROLE_ID,
        name: 'Guide Rolle',
        description: 'Automatisk seedet rolle for guide screenshots',
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      roles.push(role);
      changed = true;
    }

    let candidate = candidates.find((entry) => entry?.id === GUIDE_SEED_CANDIDATE_ID) || candidates[0];
    if (!candidate) {
      candidate = {
        id: GUIDE_SEED_CANDIDATE_ID,
        name: 'Guide Kandidat',
        status: 'pending',
        roleId: role.id,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      candidates.push(candidate);
      changed = true;
    }

    if (!changed) return;

    await fetch(`${BASE_URL}/api/casting/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...project,
        roles,
        candidates,
      }),
    });
    console.log(`seeded guide data for project: ${project.id}`);
  } catch (error) {
    console.warn('seed step skipped:', error);
  }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1920, height: 1200 },
  deviceScaleFactor: 2,
});

const clickIfVisible = async (locator, label) => {
  try {
    if (await locator.count()) {
      await locator.first().click({ timeout: 2000 });
      console.log(`clicked: ${label}`);
      return true;
    }
  } catch {}
  return false;
};

const screenshotClip = async (pathTarget, clip, pageRef) => {
  await pageRef.screenshot({
    path: pathTarget,
    clip,
    animations: 'disabled',
  });
  console.log(`saved: ${pathTarget}`);
};

const clickOneOf = async (candidates, label) => {
  for (const candidate of candidates) {
    if (await clickIfVisible(candidate, label)) return true;
  }
  return false;
};

try {
  await ensureGuideSeedData();
  await page.goto(`${BASE_URL}/casting.html`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3500);

  // Project selector is open by default; select project instead of closing it.
  const projectDialog = page.locator('[role="dialog"]').filter({ hasText: 'Alle prosjekter' }).first();
  if (await projectDialog.count()) {
    const trollProject = projectDialog.locator('text=TROLL').first();
    if (await trollProject.count()) {
      await trollProject.click({ timeout: 3000 }).catch(() => {});
      console.log('selected project: TROLL');
      await page.waitForTimeout(900);
    } else {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
  } else {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }

  const tabClicked = await clickOneOf([
    page.locator('[role="tab"]:has-text("Auditions")'),
    page.locator('button:has-text("Auditions")'),
    page.locator('a:has-text("Auditions")'),
    page.locator('text=Auditions').first(),
  ], 'auditions tab');

  if (!tabClicked) {
    await page.mouse.click(235, 86);
    console.log('clicked fallback coordinates for auditions tab');
  }

  await page.waitForTimeout(2200);
  await page.keyboard.press('Home').catch(() => {});
  await page.waitForTimeout(200);

  // Capture a high-detail primary overview shot (used in guide step 1)
  await screenshotClip(shots.main, { x: 20, y: 175, width: 1880, height: 760 }, page);

  // Capture top area with header actions
  await screenshotClip(shots.header, { x: 20, y: 175, width: 1880, height: 320 }, page);

  // Keep a full-frame reference image for debugging/context
  await page.screenshot({ path: shots.full, fullPage: true, animations: 'disabled' });
  console.log(`saved: ${shots.full}`);

  // Step 2 — open create form and capture
  const openedCreate = await clickOneOf([
    page.locator('button:has-text("NY AVTALE")'),
    page.locator('button:has-text("+ NY AVTALE")'),
    page.locator('button:has-text("New Schedule")'),
  ], 'new schedule button');

  if (openedCreate) {
    await page.waitForTimeout(700);
    const dialog = page.locator('[role="dialog"]').last();
    if (await dialog.count()) {
      await dialog.screenshot({ path: shots.creatingForm, animations: 'disabled' });
      console.log(`saved: ${shots.creatingForm}`);
    } else {
      await screenshotClip(shots.creatingForm, { x: 300, y: 160, width: 1320, height: 860 }, page);
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(450);
  } else {
    // Fallback captures if modal couldn't open
    await screenshotClip(shots.creatingForm, { x: 20, y: 175, width: 1880, height: 760 }, page);
    await fs.copyFile(shots.creatingForm, shots.editingForm);
    console.log(`copied fallback: ${shots.editingForm}`);
  }

  // Step 2 — attempt actual edit-form capture from schedule row/card
  const editLabel = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const candidate = buttons.find((button) => {
      const aria = (button.getAttribute('aria-label') || '').toLowerCase();
      const title = (button.getAttribute('title') || '').toLowerCase();
      const text = (button.textContent || '').toLowerCase();
      const rect = button.getBoundingClientRect();
      const label = `${aria} ${title} ${text}`;
      const looksLikeEdit = /edit|rediger|pencil/.test(label);
      const inMainPanel = rect.top > 220 && rect.left > 20 && rect.width <= 120;
      return looksLikeEdit && inMainPanel;
    });
    if (!candidate) return null;
    (candidate).click();
    return (
      candidate.getAttribute('aria-label') ||
      candidate.getAttribute('title') ||
      candidate.textContent ||
      'edit-button'
    );
  });

  if (editLabel) {
    console.log(`clicked edit candidate: ${editLabel}`);
    await page.waitForTimeout(700);
    const editDialog = page.locator('[role="dialog"]').last();
    if (await editDialog.count()) {
      await editDialog.screenshot({ path: shots.editingForm, animations: 'disabled' });
      console.log(`saved: ${shots.editingForm}`);
    } else {
      await screenshotClip(shots.editingForm, { x: 300, y: 160, width: 1320, height: 860 }, page);
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(450);
  } else {
    // fallback to create form if edit is not discoverable
    await fs.copyFile(shots.creatingForm, shots.editingForm);
    console.log(`copied create form to edit form: ${shots.editingForm}`);
  }

  // Step 3 — capture view modes in standard mode
  await clickOneOf([
    page.locator('button:has-text("STANDARD")'),
    page.locator('text=STANDARD').first(),
  ], 'standard mode');
  await page.waitForTimeout(500);
  await screenshotClip(shots.viewModes, { x: 20, y: 320, width: 1880, height: 360 }, page);

  // Step 3 — capture Standard vs Pro with pro toggled
  await clickOneOf([
    page.locator('button:has-text("PRO-VISNING")'),
    page.locator('text=PRO-VISNING').first(),
    page.locator('button:has-text("Pro")').first(),
  ], 'pro mode');
  await page.waitForTimeout(900);
  await screenshotClip(shots.standardVsPro, { x: 20, y: 250, width: 1880, height: 900 }, page);

  const contentHints = await page.locator('body').innerText();
  console.log('hints:', contentHints.slice(0, 260).replace(/\n+/g, ' | '));
} finally {
  await browser.close();
}

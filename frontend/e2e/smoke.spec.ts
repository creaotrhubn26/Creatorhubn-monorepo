import { test, expect } from '@playwright/test';

test('smoke: homepage loads', async ({ page }) => {
  test.setTimeout(120_000);

  let crashed = false;
  page.on('crash', () => { crashed = true; });
  
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('ERR_CONNECTION_REFUSED') && !text.includes('net::ERR_')) {
      logs.push(`[${msg.type()}] ${text}`);
    }
  });

  const pageErrors: string[] = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  const failedRequests: string[] = [];
  page.on('requestfailed', req => {
    const url = req.url();
    if (!url.includes('/api/') && !url.includes(':5000')) {
      failedRequests.push(`${req.failure()?.errorText}: ${url}`);
    }
  });

  const errorResponses: string[] = [];
  page.on('response', res => {
    if (res.status() >= 400) {
      const url = res.url();
      if (url.includes('localhost:5001') && !url.includes('/api/')) {
        errorResponses.push(`${res.status()} ${url}`);
      }
    }
  });

  console.log('Navigating to /');
  const response = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  console.log('Response status:', response?.status());
  
  await page.waitForTimeout(15_000);
  
  if (crashed) throw new Error('Browser page crashed - likely OOM');

  const rootInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      exists: !!root,
      childCount: root?.children.length ?? 0,
      textLength: root?.textContent?.length ?? 0,
      innerHTML: root?.innerHTML?.substring(0, 1000) ?? '',
    };
  });
  
  console.log('Root info:', JSON.stringify(rootInfo));
  
  if (pageErrors.length > 0) {
    console.log('PAGE ERRORS:');
    pageErrors.forEach(e => console.log('  ', e));
  }
  
  if (failedRequests.length > 0) {
    console.log('FAILED REQUESTS (non-API):');
    failedRequests.forEach(r => console.log('  ', r));
  }

  if (errorResponses.length > 0) {
    console.log('ERROR RESPONSES (5001):');
    errorResponses.forEach(r => console.log('  ', r));
  }
  
  console.log('Console logs:', logs.length);
  logs.slice(0, 30).forEach(l => console.log('  ', l));

  expect(rootInfo.childCount).toBeGreaterThan(0);
});

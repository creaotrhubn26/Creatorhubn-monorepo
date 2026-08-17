import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE_ERR:', m.text().slice(0, 200)); });
p.on('pageerror', (e) => console.log('PAGE_ERR:', String(e).slice(0, 300)));
await p.goto('http://localhost:5001/', { waitUntil: 'domcontentloaded' });
console.log('URL:', p.url());
console.log('TITLE:', await p.title());
await b.close();

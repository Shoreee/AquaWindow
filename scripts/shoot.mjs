// Screenshot harness: node scripts/shoot.mjs [url-query] [out] [actions...]
// Uses the locally installed Chrome through playwright-core.
import { chromium } from 'playwright-core';

const base = process.env.AW_URL ?? 'http://127.0.0.1:5174/';
const [query = '', out = 'screenshots/shot.png', ...actions] = process.argv.slice(2);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base + query, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
for (const a of actions) {
  const [cmd, ...args] = a.split(':');
  if (cmd === 'wait') await page.waitForTimeout(Number(args[0]));
  else if (cmd === 'click') await page.mouse.click(Number(args[0]), Number(args[1]));
  else if (cmd === 'sel') await page.click(args.join(':'));
  else if (cmd === 'drag') {
    const [x1, y1, x2, y2] = args.map(Number);
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 6 });
    await page.mouse.move(x2, y2, { steps: 6 });
    if (args[4] !== 'hold') await page.mouse.up();
  } else if (cmd === 'key') await page.keyboard.press(args.join(':'));
  else if (cmd === 'down') await page.keyboard.down(args[0]);
  else if (cmd === 'type') await page.keyboard.type(args.join(':'));
  else if (cmd === 'eval') await page.evaluate(args.join(':'));
}
await page.screenshot({ path: out });
console.log('saved', out, errors.length ? '\nERRORS:\n' + errors.join('\n') : '');
await browser.close();

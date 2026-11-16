const path = require('node:path');
const { chromium } = require('/Users/markusburkert/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(`file://${path.join(root, 'brand-assets/dca-social-share.svg')}`);
    await page.screenshot({ path: path.join(root, 'brand-assets/dca-social-share.png') });
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

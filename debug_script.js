const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER_PAGE_ERROR:', err.toString()));
  page.on('requestfailed', request => console.log('BROWSER_REQUEST_FAILED:', request.url(), request.failure().errorText));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  console.log('Page loaded');
  
  // Wait for the app to settle
  await new Promise(r => setTimeout(r, 2000));

  // Find the single/grid toggle
  console.log('Switching to Grid mode...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const gridBtn = buttons.find(b => b.textContent && b.textContent.includes('Grid') && !b.textContent.includes('+'));
    if (gridBtn) gridBtn.click();
  });

  await new Promise(r => setTimeout(r, 2000));
  
  // Try adding a coin to grid from single mode
  console.log('Switching back to single...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const singleBtn = buttons.find(b => b.textContent && b.textContent.includes('Single'));
    if (singleBtn) singleBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Selecting a coin...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    // Find a coin list item
    const coinBtn = buttons.find(b => b.textContent && b.textContent.includes('BTC') && b.textContent.includes('Vol'));
    if (coinBtn) coinBtn.click();
  });

  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Clicking + Grid...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const addGridBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Grid' && b.querySelector('svg'));
    if (addGridBtn) addGridBtn.click();
  });

  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();

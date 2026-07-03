const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER_PAGE_ERROR:', err.toString()));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Wait for the app to settle
  await new Promise(r => setTimeout(r, 2000));
  
  // Dump the HTML of the main container
  const html = await page.evaluate(() => {
    return document.body.innerHTML;
  });
  console.log("HTML:", html.substring(0, 1000));

  await browser.close();
})();

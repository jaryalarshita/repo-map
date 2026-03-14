import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  
  await page.goto('http://localhost:5173');
  
  // Try triggering a graph by mocking the store manually
  await page.evaluate(() => {
    // Assuming useStore is exposed or we can fake a graph node
    window.__zustand = true;
  });

  // Since we can't easily fake the zustand trigger without access, 
  // let's type into the search bar if it's there
  try {
     await page.type('input[placeholder="Enter GitHub URL to analyze..."]', 'facebook/react', {delay: 50});
     await page.keyboard.press('Enter');
  } catch (e) {
     console.log('No search bar found', e.message);
  }

  // wait 5 seconds for graph
  await new Promise(r => setTimeout(r, 5000));
  
  // Dump fixed elements
  const fixedElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.fixed')).map(el => {
      const rect = el.getBoundingClientRect();
      return {
        className: el.className,
        width: rect.width,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        zIndex: window.getComputedStyle(el).zIndex,
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        html: el.outerHTML.substring(0, 100)
      };
    });
  });
  
  console.log('Fixed Elements:', JSON.stringify(fixedElements, null, 2));
  await browser.close();
})();

const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    console.log('Browser launched successfully!');
    const page = await browser.newPage();
    await page.goto('https://example.com');
    console.log('Page loaded successfully!');
    
    await browser.close();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
})();

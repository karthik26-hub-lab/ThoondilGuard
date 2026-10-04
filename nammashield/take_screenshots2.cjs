const puppeteer = require('puppeteer');
const fs = require('fs');

const artifactDir = "C:\\\\Users\\\\KARTHIK\\\\.gemini\\\\antigravity\\\\brain\\\\4bb6ec6d-ce09-4d19-b6b5-c4c3a41c5473\\\\screenshots";
if (!fs.existsSync(artifactDir)){
  fs.mkdirSync(artifactDir, { recursive: true });
}

(async () => {
  const browser = await puppeteer.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  
  // Set mobile viewport
  await page.setViewport({ width: 390, height: 844 });
  
  // Navigate to local dev server
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Screenshot of home
  await page.screenshot({ path: artifactDir + '\\\\mobile_check.png' });

  // Click the suspicious example button to populate textarea
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const suspiciousBtn = Array.from(buttons).find(b => b.textContent === 'Suspicious message');
    if (suspiciousBtn) suspiciousBtn.click();
  });
  
  // Wait a tiny bit and click Check
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    const checkBtn = Array.from(buttons).find(b => b.textContent === 'Check this message');
    if (checkBtn) checkBtn.click();
  });

  // Wait for result to appear
  await page.waitForSelector('#result-section');
  await new Promise(resolve => setTimeout(resolve, 2000)); // wait for transitions

  await page.screenshot({ path: artifactDir + '\\\\mobile_result.png' });

  await browser.close();
  console.log("Screenshots saved to artifact directory.");
})();

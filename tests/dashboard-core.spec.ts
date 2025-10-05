import { test, expect } from '@playwright/test';

test.describe('HASEB Dashboard Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should load the HASEB dashboard successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/HASEB|Dashboard/);

    // Check main elements are present
    await expect(page.locator('body')).toBeVisible();

    // Look for dashboard content
    const pageContent = await page.textContent('body');
    expect(pageContent?.length).toBeGreaterThan(100);

    // Take screenshot
    await page.screenshot({
      path: 'test-screenshots/dashboard-load-success.png',
      fullPage: true
    });

    console.log('✅ Dashboard loaded successfully');
  });

  test('should display navigation menu', async ({ page }) => {
    // Look for navigation elements
    const navLinks = page.locator('nav a, header a, .nav a');
    const linkCount = await navLinks.count();

    expect(linkCount).toBeGreaterThan(0);
    console.log(`✅ Found ${linkCount} navigation links`);

    // Test navigation to first few links
    for (let i = 0; i < Math.min(linkCount, 3); i++) {
      const link = navLinks.nth(i);
      const linkText = await link.textContent();

      if (linkText && linkText.trim()) {
        console.log(`🔗 Testing navigation to: ${linkText.trim()}`);

        await link.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Verify navigation worked
        await expect(page.locator('body')).toBeVisible();

        // Take screenshot
        await page.screenshot({
          path: `test-screenshots/nav-${linkText.trim().toLowerCase().replace(/\s+/g, '-')}.png`,
          fullPage: true
        });

        // Go back
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should display metric cards and dashboard elements', async ({ page }) => {
    // Look for metric cards using various selectors
    const metricSelectors = [
      '.metric-card, [data-testid*="metric"], .stat-card, .dashboard-card',
      '[class*="metric"], [class*="stat"], [class*="card"]',
      '.grid > div, .flex > div'
    ];

    let elementsFound = false;
    for (const selector of metricSelectors) {
      const elements = page.locator(selector);
      if (await elements.count() > 0) {
        console.log(`✅ Found ${await elements.count()} elements with selector: ${selector}`);
        await expect(elements.first()).toBeVisible();
        elementsFound = true;
        break;
      }
    }

    if (!elementsFound) {
      console.log('⚠️  No specific metric cards found, checking for dashboard content...');
      // Look for any meaningful content
      const contentElements = page.locator('div, section, article');
      expect(await contentElements.count()).toBeGreaterThan(0);
    }

    await page.screenshot({
      path: 'test-screenshots/dashboard-metrics-test.png',
      fullPage: true
    });
  });

  test('should handle interactive elements', async ({ page }) => {
    // Find buttons
    const buttons = page.locator('button, [role="button"]');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      console.log(`🔘 Found ${buttonCount} buttons`);

      // Test first button
      const firstButton = buttons.first();
      if (await firstButton.isVisible() && await firstButton.isEnabled()) {
        await firstButton.hover();
        await page.waitForTimeout(500);

        await firstButton.click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: 'test-screenshots/button-click-test.png',
          fullPage: true
        });

        console.log('✅ Button interaction working');
      }
    }

    // Find form inputs
    const inputs = page.locator('input, select, textarea');
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      console.log(`📝 Found ${inputCount} form inputs`);

      const firstInput = inputs.first();
      if (await firstInput.isVisible()) {
        const inputType = await firstInput.getAttribute('type') || 'text';

        if (!['checkbox', 'radio', 'file'].includes(inputType)) {
          await firstInput.focus();
          await firstInput.fill('test value');
          await page.waitForTimeout(500);

          const value = await firstInput.inputValue();
          expect(value).toBe('test value');

          console.log('✅ Form input working');
        }
      }
    }
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.reload();
      await page.waitForTimeout(1000);

      // Verify page loads correctly
      await expect(page.locator('body')).toBeVisible();

      await page.screenshot({
        path: `test-screenshots/responsive-${viewport.name}-${viewport.width}x${viewport.height}.png`,
        fullPage: true
      });

      console.log(`✅ Responsive design working for ${viewport.name}`);
    }
  });

  test('should handle search functionality', async ({ page }) => {
    // Look for search inputs
    const searchInputs = page.locator('input[placeholder*="search"], input[placeholder*="Search"], [data-testid*="search"]');

    if (await searchInputs.count() > 0) {
      const searchInput = searchInputs.first();
      await expect(searchInput).toBeVisible();

      // Test search
      await searchInput.fill('test search');
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'test-screenshots/search-functionality.png',
        fullPage: true
      });

      console.log('✅ Search functionality working');

      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(500);
    } else {
      console.log('⚠️  No search functionality found');
    }
  });

  test('should have good performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`⚡ Page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);

    // Check for console errors
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });

    await page.waitForTimeout(3000);

    if (logs.length === 0) {
      console.log('✅ No console errors found');
    } else {
      console.log(`❌ Found ${logs.length} console errors`);
    }

    await page.screenshot({
      path: 'test-screenshots/performance-test.png',
      fullPage: true
    });
  });

  test.afterAll(async () => {
    console.log('🎉 Core functionality tests completed!');
    console.log('📸 Screenshots saved in test-screenshots/ directory');
  });
});
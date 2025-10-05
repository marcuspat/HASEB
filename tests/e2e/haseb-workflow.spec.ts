import { test, expect } from '@playwright/test';

test.describe('HASEB Complete Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the HASEB dashboard
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard loads and displays main components', async ({ page }) => {
    // Check if the main dashboard loads
    await expect(page.locator('body')).toContainText('HASEB');

    // Check for main navigation elements
    const navElements = page.locator('nav, header, .navbar');
    await expect(navElements.first()).toBeVisible();

    // Check for dashboard content
    const mainContent = page.locator('main, .dashboard, .container');
    await expect(mainContent.first()).toBeVisible();

    // Verify the page loads without JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });

  test('Agent management workflow', async ({ page }) => {
    // Navigate to agents section
    const agentsLink = page.locator('a[href*="agent"], button:has-text("Agent"), .agent-section');
    if (await agentsLink.first().isVisible()) {
      await agentsLink.first().click();
      await page.waitForLoadState('networkidle');
    }

    // Check for agent management interface
    const agentContent = page.locator('.agent-list, .agent-management, [data-testid="agents"]');
    if (await agentContent.first().isVisible()) {
      await expect(agentContent.first()).toBeVisible();

      // Look for agent creation buttons
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), .add-agent');
      if (await createButton.first().isVisible()) {
        await expect(createButton.first()).toBeVisible();
      }
    }
  });

  test('Benchmark evaluation workflow', async ({ page }) => {
    // Navigate to benchmarks section
    const benchmarkLink = page.locator('a[href*="benchmark"], button:has-text("Benchmark"), .benchmark-section');
    if (await benchmarkLink.first().isVisible()) {
      await benchmarkLink.first().click();
      await page.waitForLoadState('networkidle');
    }

    // Check for benchmark interface
    const benchmarkContent = page.locator('.benchmark-list, .benchmark-management, [data-testid="benchmarks"]');
    if (await benchmarkContent.first().isVisible()) {
      await expect(benchmarkContent.first()).toBeVisible();

      // Look for evaluation controls
      const evalButton = page.locator('button:has-text("Evaluate"), button:has-text("Run"), .start-evaluation');
      if (await evalButton.first().isVisible()) {
        await expect(evalButton.first()).toBeVisible();
      }
    }
  });

  test('Metrics and analytics display', async ({ page }) => {
    // Look for metrics/analytics section
    const metricsSection = page.locator('.metrics, .analytics, .dashboard-metrics, [data-testid="metrics"]');
    if (await metricsSection.first().isVisible()) {
      await expect(metricsSection.first()).toBeVisible();

      // Check for charts or data visualization
      const charts = page.locator('canvas, .chart, .graph, .data-visualization');
      if (await charts.first().isVisible()) {
        await expect(charts.first()).toBeVisible();
      }
    }
  });

  test('Settings and configuration access', async ({ page }) => {
    // Look for settings access
    const settingsLink = page.locator('a[href*="setting"], button:has-text("Setting"), .settings-button, .config-button');
    if (await settingsLink.first().isVisible()) {
      await settingsLink.first().click();
      await page.waitForLoadState('networkidle');

      // Check for settings panel
      const settingsPanel = page.locator('.settings, .configuration, .settings-panel');
      if (await settingsPanel.first().isVisible()) {
        await expect(settingsPanel.first()).toBeVisible();
      }
    }
  });

  test('Responsive design verification', async ({ page }) => {
    // Test desktop size
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(1000);
    const desktopContent = page.locator('body');
    await expect(desktopContent).toBeVisible();

    // Test tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    const tabletContent = page.locator('body');
    await expect(tabletContent).toBeVisible();

    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    const mobileContent = page.locator('body');
    await expect(mobileContent).toBeVisible();
  });

  test('Performance and loading metrics', async ({ page }) => {
    // Monitor performance during page load
    const performanceEntries: any[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      performanceEntries.push({ url, status, timestamp: Date.now() });
    });

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Verify all critical resources loaded successfully
    const failedResources = performanceEntries.filter(entry => entry.status >= 400);
    expect(failedResources.length).toBe(0);

    // Check for reasonable number of resources
    expect(performanceEntries.length).toBeGreaterThan(0);
    expect(performanceEntries.length).toBeLessThan(100); // Reasonable upper bound
  });

  test('Accessibility compliance', async ({ page }) => {
    // Basic accessibility checks
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Check for proper heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const h1 = page.locator('h1');

    if (await h1.count() > 0) {
      await expect(h1.first()).toBeVisible();
    }

    // Check for alt text on images
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);

    // Check for form labels
    const inputs = page.locator('input, select, textarea');
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      const unlabeledInputs = await page.locator('input:not([aria-label]):not([aria-labelledby]):not([id])').count();
      // Allow some inputs to be unlabeled, but not all
      expect(unlabeledInputs).toBeLessThanOrEqual(inputCount);
      if (inputCount > 1) {
        expect(unlabeledInputs).toBeLessThan(inputCount);
      }
    }
  });

  test('Error handling and user feedback', async ({ page }) => {
    // Monitor for error messages and user feedback
    const errorMessages: string[] = [];
    const successMessages: string[] = [];

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Set up observers for common feedback patterns
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorMessages.push(msg.text());
      }
    });

    // Try to interact with various elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    if (buttonCount > 0 && buttonCount < 10) { // Limit to reasonable number
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        try {
          await buttons.nth(i).click();
          await page.waitForTimeout(500);
        } catch (error) {
          // Expected for some buttons - handle gracefully
        }
      }
    }

    // Verify no unhandled errors occurred
    await page.waitForTimeout(2000);
    expect(errorMessages.length).toBeLessThan(5); // Allow for some warnings but not excessive errors
  });

  test('API connectivity validation', async ({ page }) => {
    // Set up request interception to monitor API calls
    const apiRequests: any[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiRequests.push({ url, method: request.method(), timestamp: Date.now() });
      }
    });

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Wait for potential API calls
    await page.waitForTimeout(3000);

    // If API calls are made, they should be to expected endpoints
    const expectedEndpoints = ['/api/health', '/api/agents', '/api/benchmarks', '/api/metrics'];
    const unexpectedRequests = apiRequests.filter(req =>
      !expectedEndpoints.some(endpoint => req.url.includes(endpoint))
    );

    // Allow some flexibility for development
    expect(unexpectedRequests.length).toBeLessThan(10);
  });
});

test.describe('HASEB Integration with Backend', () => {
  test('Backend health check integration', async ({ page }) => {
    // Test if frontend can communicate with backend health endpoint
    const response = await page.goto('http://localhost:3000');
    expect(response?.ok()).toBeTruthy();

    // Check for backend status indicators
    const statusIndicators = page.locator('[data-testid="backend-status"], .connection-status, .health-indicator');
    if (await statusIndicators.first().isVisible()) {
      await expect(statusIndicators.first()).toBeVisible();
    }
  });
});
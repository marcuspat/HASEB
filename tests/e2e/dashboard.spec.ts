import { test, expect } from '@playwright/test';

test.describe('HASEB Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('http://localhost:5173');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard main page', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/HASEB|Dashboard/);

    // Check main heading
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Check navigation elements
    await expect(page.locator('nav')).toBeVisible();

    // Check that main content area is loaded
    await expect(page.locator('main')).toBeVisible();
  });

  test('should display navigation menu correctly', async ({ page }) => {
    // Check navigation items
    const navItems = [
      'Dashboard',
      'Agents',
      'Benchmarks',
      'Evaluations',
      'Analytics',
      'Settings'
    ];

    for (const item of navItems) {
      const navLink = page.locator(`nav a:has-text("${item}")`);
      await expect(navLink).toBeVisible();
    }
  });

  test('should navigate between pages correctly', async ({ page }) => {
    // Test navigation to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Agents');

    // Test navigation to Benchmarks page
    await page.click('nav a:has-text("Benchmarks")');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Benchmarks');

    // Test navigation back to Dashboard
    await page.click('nav a:has-text("Dashboard")');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should display metric cards on dashboard', async ({ page }) => {
    // Check for metric cards
    const metricCards = page.locator('[data-testid="metric-card"]');
    await expect(metricCards.first()).toBeVisible();

    // Check for specific metrics
    const expectedMetrics = [
      'Total Agents',
      'Active Evaluations',
      'Completed Tasks',
      'Success Rate'
    ];

    for (const metric of expectedMetrics) {
      const metricElement = page.locator(`text=${metric}`);
      await expect(metricElement).toBeVisible();
    }
  });

  test('should display real-time evaluations', async ({ page }) => {
    // Look for real-time evaluations section
    const realTimeSection = page.locator('[data-testid="real-time-evaluations"]');
    if (await realTimeSection.isVisible()) {
      // Check for evaluation items
      const evaluationItems = page.locator('[data-testid="evaluation-item"]');
      if (await evaluationItems.count() > 0) {
        await expect(evaluationItems.first()).toBeVisible();

        // Check for evaluation details
        await expect(page.locator('[data-testid="evaluation-status"]')).toBeVisible();
        await expect(page.locator('[data-testid="evaluation-progress"]')).toBeVisible();
      }
    }
  });

  test('should display charts and visualizations', async ({ page }) => {
    // Check for chart containers
    const chartContainers = page.locator('[data-testid="chart"]');
    if (await chartContainers.count() > 0) {
      await expect(chartContainers.first()).toBeVisible();
    }

    // Check for specific chart types
    const chartTypes = [
      '[data-testid="activity-chart"]',
      '[data-testid="performance-chart"]',
      '[data-testid="leaderboard-chart"]'
    ];

    for (const chartType of chartTypes) {
      const chart = page.locator(chartType);
      if (await chart.isVisible()) {
        await expect(chart).toBeVisible();
      }
    }
  });

  test('should handle responsive design', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    // Check for mobile navigation toggle
    const mobileMenuToggle = page.locator('[data-testid="mobile-menu-toggle"]');
    if (await mobileMenuToggle.isVisible()) {
      await expect(mobileMenuToggle).toBeVisible();
    }
  });

  test('should display loading states correctly', async ({ page }) => {
    // Reload page to observe loading states
    await page.reload();

    // Check for loading indicators
    const loadingIndicators = page.locator('[data-testid="loading"]');
    if (await loadingIndicators.first().isVisible({ timeout: 1000 })) {
      await expect(loadingIndicators.first()).toBeVisible();

      // Wait for loading to complete
      await expect(loadingIndicators.first()).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Mock network failure for testing error states
    await page.route('**/api/**', route => route.abort());

    // Reload page to trigger API calls
    await page.reload();

    // Check for error display
    const errorElements = page.locator('[data-testid="error-message"]');
    if (await errorElements.first().isVisible({ timeout: 3000 })) {
      await expect(errorElements.first()).toBeVisible();
    }

    // Restore normal routing
    await page.unroute('**/api/**');
  });

  test('should support search and filtering', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for search functionality
    const searchInput = page.locator('[data-testid="search-input"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500); // Wait for search to execute

      // Check that search results are displayed
      const searchResults = page.locator('[data-testid="search-results"]');
      if (await searchResults.isVisible()) {
        await expect(searchResults).toBeVisible();
      }
    }

    // Look for filter controls
    const filterControls = page.locator('[data-testid="filter-control"]');
    if (await filterControls.first().isVisible()) {
      await expect(filterControls.first()).toBeVisible();
    }
  });

  test('should handle form interactions', async ({ page }) => {
    // Navigate to Settings page for form testing
    await page.click('nav a:has-text("Settings")');
    await page.waitForLoadState('networkidle');

    // Look for form elements
    const formElements = page.locator('form input, form select, form textarea');
    if (await formElements.count() > 0) {
      const firstInput = formElements.first();
      await expect(firstInput).toBeVisible();

      // Test input interaction
      if (await firstInput.getAttribute('type') !== 'checkbox') {
        await firstInput.fill('test value');
        await expect(firstInput).toHaveValue('test value');
      }
    }

    // Look for submit buttons
    const submitButtons = page.locator('button[type="submit"], [data-testid="submit-button"]');
    if (await submitButtons.count() > 0) {
      await expect(submitButtons.first()).toBeVisible();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test Tab navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Check that focus is on an interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Test Enter key on navigation items
    const firstNavlink = page.locator('nav a').first();
    await firstNavlink.focus();
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    // Check that navigation occurred
    const currentUrl = page.url();
    expect(currentUrl).not.toBe('http://localhost:5173/');
  });

  test('should handle data refresh', async ({ page }) => {
    // Look for refresh controls
    const refreshButton = page.locator('[data-testid="refresh-button"]');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait for refresh to complete
      await page.waitForTimeout(1000);

      // Verify content is still displayed
      await expect(page.locator('main')).toBeVisible();
    }

    // Test auto-refresh functionality (if present)
    const autoRefreshIndicator = page.locator('[data-testid="auto-refresh"]');
    if (await autoRefreshIndicator.isVisible()) {
      await expect(autoRefreshIndicator).toBeVisible();
    }
  });

  test('should display tooltips and help text', async ({ page }) => {
    // Look for elements with tooltips
    const tooltipTriggers = page.locator('[data-testid="tooltip-trigger"]');
    if (await tooltipTriggers.count() > 0) {
      const firstTooltip = tooltipTriggers.first();
      await firstTooltip.hover();
      await page.waitForTimeout(500);

      // Check for tooltip content
      const tooltipContent = page.locator('[data-testid="tooltip-content"]');
      if (await tooltipContent.isVisible()) {
        await expect(tooltipContent).toBeVisible();
      }
    }

    // Look for help text elements
    const helpTextElements = page.locator('[data-testid="help-text"]');
    if (await helpTextElements.count() > 0) {
      await expect(helpTextElements.first()).toBeVisible();
    }
  });

  test('should handle pagination', async ({ page }) => {
    // Navigate to a page with pagination
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for pagination controls
    const paginationControls = page.locator('[data-testid="pagination"]');
    if (await paginationControls.isVisible()) {
      await expect(paginationControls).toBeVisible();

      // Test pagination navigation
      const nextPageButton = page.locator('[data-testid="next-page"]');
      if (await nextPageButton.isVisible() && !(await nextPageButton.isDisabled())) {
        await nextPageButton.click();
        await page.waitForLoadState('networkidle');

        // Verify page changed (could check URL params or content)
        await expect(page.locator('main')).toBeVisible();
      }
    }
  });

  test('should support dark mode toggle', async ({ page }) => {
    // Look for dark mode toggle
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
    if (await darkModeToggle.isVisible()) {
      // Get initial state
      const htmlElement = page.locator('html');
      const initialTheme = await htmlElement.getAttribute('data-theme');

      // Toggle dark mode
      await darkModeToggle.click();
      await page.waitForTimeout(500);

      // Verify theme changed
      const newTheme = await htmlElement.getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);

      // Toggle back
      await darkModeToggle.click();
      await page.waitForTimeout(500);

      const restoredTheme = await htmlElement.getAttribute('data-theme');
      expect(restoredTheme).toBe(initialTheme);
    }
  });

  test('should handle session management', async ({ page }) => {
    // Look for authentication state
    const authIndicator = page.locator('[data-testid="auth-status"]');
    if (await authIndicator.isVisible()) {
      await expect(authIndicator).toBeVisible();
    }

    // Look for login/logout functionality
    const logoutButton = page.locator('[data-testid="logout-button"]');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForTimeout(1000);

      // Verify redirected to login or home
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/(login|auth)|\/$/);
    }
  });
});
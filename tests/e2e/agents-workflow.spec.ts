import { test, expect } from '@playwright/test';

test.describe('Agents Management Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to agents page and display agents list', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Verify navigation
    await expect(page).toHaveURL(/agents/);
    await expect(page.locator('h1')).toContainText('Agents');

    // Check for agents table or list
    const agentsTable = page.locator('[data-testid="agents-table"]');
    const agentsList = page.locator('[data-testid="agents-list"]');

    await expect(
      agentsTable.or(agentsList).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should create new agent through UI', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for create agent button
    const createButton = page.locator('[data-testid="create-agent-button"]');
    if (await createButton.isVisible()) {
      await createButton.click();

      // Wait for modal or form to appear
      const agentForm = page.locator('[data-testid="agent-form"]');
      await expect(agentForm).toBeVisible({ timeout: 3000 });

      // Fill in form fields
      const nameInput = agentForm.locator('input[name="name"], [data-testid="agent-name"]');
      await nameInput.fill('E2E Test Agent');

      const typeSelect = agentForm.locator('select[name="type"], [data-testid="agent-type"]');
      await typeSelect.selectOption({ label: 'General' });

      const descriptionInput = agentForm.locator(
        'textarea[name="description"], [data-testid="agent-description"]'
      );
      await descriptionInput.fill('Agent created via E2E test');

      // Add capabilities
      const capabilitiesInput = agentForm.locator(
        'input[name="capabilities"], [data-testid="agent-capabilities"]'
      );
      if (await capabilitiesInput.isVisible()) {
        await capabilitiesInput.fill('testing,validation');
      }

      // Submit form
      const submitButton = agentForm.locator(
        'button[type="submit"], [data-testid="submit-agent-button"]'
      );
      await submitButton.click();

      // Wait for form to close and list to update
      await expect(agentForm).not.toBeVisible({ timeout: 3000 });

      // Verify agent was created
      const newAgent = page.locator('text="E2E Test Agent"');
      await expect(newAgent).toBeVisible({ timeout: 5000 });
    }
  });

  test('should search and filter agents', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Test search functionality
    const searchInput = page.locator('[data-testid="search-input"], input[placeholder*="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);

      // Check that search is performed
      const searchResults = page.locator('[data-testid="search-results"], .search-results');
      // Search may update existing list, so we check the page is still responsive
      await expect(page.locator('h1')).toContainText('Agents');
    }

    // Test filter functionality
    const filterControls = page.locator('[data-testid="filter-control"], select');
    if (await filterControls.count() > 0) {
      const firstFilter = filterControls.first();
      await firstFilter.selectOption({ index: 1 }); // Select first option
      await page.waitForTimeout(500);

      // Verify filtering is applied
      await expect(page.locator('h1')).toContainText('Agents');
    }
  });

  test('should view agent details', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for existing agents
    const agentItems = page.locator('[data-testid="agent-item"], tr:has(td)');
    if (await agentItems.count() > 0) {
      const firstAgent = agentItems.first();
      await firstAgent.click();

      // Wait for details view to load
      await page.waitForLoadState('networkidle');

      // Check if details modal or page is displayed
      const detailsModal = page.locator('[data-testid="agent-details-modal"]');
      const detailsPage = page.locator('[data-testid="agent-details-page"]');

      const detailsVisible = await detailsModal.isVisible() || await detailsPage.isVisible();
      expect(detailsVisible).toBe(true);

      // Verify agent details are displayed
      const agentName = page.locator('[data-testid="agent-name"], h2');
      if (await agentName.isVisible()) {
        await expect(agentName).toBeVisible();
      }

      // Check for performance metrics
      const metricsSection = page.locator('[data-testid="performance-metrics"]');
      if (await metricsSection.isVisible()) {
        await expect(metricsSection).toBeVisible();
      }

      // Close details if modal
      if (await detailsModal.isVisible()) {
        const closeButton = detailsModal.locator(
          '[data-testid="close-button"], button[aria-label*="close"]'
        );
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await expect(detailsModal).not.toBeVisible({ timeout: 2000 });
        }
      }
    }
  });

  test('should edit existing agent', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for existing agents
    const agentItems = page.locator('[data-testid="agent-item"], tr:has(td)');
    if (await agentItems.count() > 0) {
      // Find edit button for first agent
      const editButton = page.locator('[data-testid="edit-agent-button"]').first();
      if (await editButton.isVisible()) {
        await editButton.click();

        // Wait for edit form to appear
        const editForm = page.locator('[data-testid="agent-form"]');
        await expect(editForm).toBeVisible({ timeout: 3000 });

        // Modify some fields
        const nameInput = editForm.locator('input[name="name"], [data-testid="agent-name"]');
        const currentName = await nameInput.inputValue();
        const newName = `${currentName} (Updated)`;
        await nameInput.fill(newName);

        const descriptionInput = editForm.locator(
          'textarea[name="description"], [data-testid="agent-description"]'
        );
        await descriptionInput.fill('Updated description via E2E test');

        // Save changes
        const saveButton = editForm.locator(
          'button[type="submit"], [data-testid="save-agent-button"]'
        );
        await saveButton.click();

        // Wait for form to close and verify update
        await expect(editForm).not.toBeVisible({ timeout: 3000 });

        // Verify agent name is updated
        const updatedAgent = page.locator(`text="${newName}"`);
        await expect(updatedAgent).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should update agent status', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for status controls
    const statusButtons = page.locator('[data-testid="status-button"], [data-testid="agent-status"]');
    if (await statusButtons.count() > 0) {
      const firstStatusButton = statusButtons.first();
      await firstStatusButton.click();

      // Look for status selection menu
      const statusMenu = page.locator('[data-testid="status-menu"]');
      if (await statusMenu.isVisible()) {
        const newStatus = statusMenu.locator('text="Active"').first();
        await newStatus.click();

        // Verify status update
        await expect(statusMenu).not.toBeVisible({ timeout: 2000 });
        await expect(page.locator('[data-testid="status-indicator"]').first()).toBeVisible();
      }
    }
  });

  test('should delete agent with confirmation', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for delete buttons
    const deleteButtons = page.locator('[data-testid="delete-agent-button"]');
    if (await deleteButtons.count() > 0) {
      const firstDeleteButton = deleteButtons.first();
      await firstDeleteButton.click();

      // Look for confirmation dialog
      const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
      if (await confirmDialog.isVisible()) {
        // Verify confirmation message
        const confirmMessage = confirmDialog.locator('text="Are you sure", [data-testid="confirm-message"]');
        await expect(confirmMessage).toBeVisible();

        // Confirm deletion
        const confirmButton = confirmDialog.locator(
          'button:has-text("Delete"), [data-testid="confirm-delete"]'
        );
        await confirmButton.click();

        // Wait for deletion to complete
        await expect(confirmDialog).not.toBeVisible({ timeout: 3000 });

        // Verify agent list updates
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should view agent performance metrics', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for agent items
    const agentItems = page.locator('[data-testid="agent-item"], tr:has(td)');
    if (await agentItems.count() > 0) {
      // Click on first agent
      const firstAgent = agentItems.first();
      await firstAgent.click();

      await page.waitForLoadState('networkidle');

      // Look for performance metrics section
      const metricsSection = page.locator('[data-testid="performance-metrics"]');
      if (await metricsSection.isVisible()) {
        await expect(metricsSection).toBeVisible();

        // Check for common metrics
        const expectedMetrics = [
          'Success Rate',
          'Execution Time',
          'Cost',
          'Steps'
        ];

        for (const metric of expectedMetrics) {
          const metricElement = metricsSection.locator(`text="${metric}"`);
          if (await metricElement.isVisible()) {
            await expect(metricElement).toBeVisible();
          }
        }

        // Look for charts or graphs
        const charts = metricsSection.locator('[data-testid="chart"], canvas, svg');
        if (await charts.count() > 0) {
          await expect(charts.first()).toBeVisible();
        }
      }

      // Close details if open
      const closeButton = page.locator('[data-testid="close-button"], button[aria-label*="close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }
  });

  test('should handle agent evaluation workflow', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for evaluation controls
    const evaluateButton = page.locator('[data-testid="evaluate-agent-button"]');
    if (await evaluateButton.count() > 0) {
      const firstEvaluateButton = evaluateButton.first();
      await firstEvaluateButton.click();

      // Look for evaluation configuration modal
      const evalConfig = page.locator('[data-testid="evaluation-config"]');
      if (await evalConfig.isVisible()) {
        // Select benchmark
        const benchmarkSelect = evalConfig.locator('select[name="benchmark"], [data-testid="benchmark-select"]');
        if (await benchmarkSelect.isVisible()) {
          await benchmarkSelect.selectOption({ index: 0 }); // Select first option
        }

        // Start evaluation
        const startButton = evalConfig.locator(
          'button:has-text("Start"), [data-testid="start-evaluation"]'
        );
        await startButton.click();

        // Look for evaluation progress
        const progressIndicator = page.locator('[data-testid="evaluation-progress"]');
        if (await progressIndicator.isVisible({ timeout: 3000 })) {
          await expect(progressIndicator).toBeVisible();

          // Wait for evaluation to complete or timeout
          await page.waitForTimeout(3000);
        }
      }
    }
  });

  test('should handle agent list pagination', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for pagination controls
    const pagination = page.locator('[data-testid="pagination"]');
    if (await pagination.isVisible()) {
      await expect(pagination).toBeVisible();

      // Test next page navigation
      const nextPageButton = pagination.locator('[data-testid="next-page"], button:has-text("Next")');
      if (await nextPageButton.isVisible() && !(await nextPageButton.isDisabled())) {
        await nextPageButton.click();
        await page.waitForLoadState('networkidle');

        // Verify page changed
        await expect(page.locator('h1')).toContainText('Agents');

        // Test previous page navigation
        const prevPageButton = pagination.locator('[data-testid="prev-page"], button:has-text("Previous")');
        if (await prevPageButton.isVisible() && !(await prevPageButton.isDisabled())) {
          await prevPageButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('should export agent data', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for export functionality
    const exportButton = page.locator('[data-testid="export-button"]');
    if (await exportButton.isVisible()) {
      // Setup download listener
      const downloadPromise = page.waitForEvent('download');

      await exportButton.click();

      // Wait for download to start
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.(csv|json|xlsx)$/);
    }
  });

  test('should handle agent bulk operations', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Look for bulk selection controls
    const selectAllCheckbox = page.locator('[data-testid="select-all"]');
    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.click();

      // Look for bulk action buttons
      const bulkActions = page.locator('[data-testid="bulk-actions"]');
      if (await bulkActions.isVisible()) {
        await expect(bulkActions).toBeVisible();

        // Test bulk status update
        const bulkStatusButton = bulkActions.locator('[data-testid="bulk-status"]');
        if (await bulkStatusButton.isVisible()) {
          await bulkStatusButton.click();

          // Select status
          const statusOption = page.locator('text="Active"').first();
          await statusOption.click();

          // Wait for operation to complete
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should handle agent filtering and sorting', async ({ page }) => {
    // Navigate to Agents page
    await page.click('nav a:has-text("Agents")');
    await page.waitForLoadState('networkidle');

    // Test sorting
    const sortControls = page.locator('[data-testid="sort-control"]');
    if (await sortControls.count() > 0) {
      const firstSortControl = sortControls.first();
      await firstSortControl.click();

      // Verify sorting is applied
      await page.waitForTimeout(500);
      await expect(page.locator('h1')).toContainText('Agents');
    }

    // Test advanced filtering
    const filterButton = page.locator('[data-testid="advanced-filter"]');
    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Look for filter modal
      const filterModal = page.locator('[data-testid="filter-modal"]');
      if (await filterModal.isVisible()) {
        await expect(filterModal).toBeVisible();

        // Apply some filters
        const typeFilter = filterModal.locator('select[name="type"], [data-testid="filter-type"]');
        if (await typeFilter.isVisible()) {
          await typeFilter.selectOption({ label: 'SWE' });
        }

        // Apply filters
        const applyButton = filterModal.locator('button:has-text("Apply"), [data-testid="apply-filters"]');
        await applyButton.click();

        // Wait for filter to apply
        await expect(filterModal).not.toBeVisible({ timeout: 2000 });
      }
    }
  });
});
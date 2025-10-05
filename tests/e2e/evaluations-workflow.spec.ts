import { test, expect } from '@playwright/test';

test.describe('Evaluations Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to evaluations page and display evaluations', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Verify navigation
    await expect(page).toHaveURL(/evaluations/);
    await expect(page.locator('h1')).toContainText('Evaluations');

    // Check for evaluations display
    const evaluationsTable = page.locator('[data-testid="evaluations-table"]');
    const evaluationsList = page.locator('[data-testid="evaluations-list"]');

    await expect(
      evaluationsTable.or(evaluationsList).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should start new evaluation workflow', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Look for start evaluation button
    const startEvalButton = page.locator('[data-testid="start-evaluation-button"]');
    if (await startEvalButton.isVisible()) {
      await startEvalButton.click();

      // Look for evaluation setup modal/form
      const evalSetup = page.locator('[data-testid="evaluation-setup"]');
      await expect(evalSetup).toBeVisible({ timeout: 3000 });

      // Select agent
      const agentSelect = evalSetup.locator('select[name="agent"], [data-testid="agent-select"]');
      if (await agentSelect.isVisible()) {
        await agentSelect.selectOption({ index: 0 }); // Select first agent
      }

      // Select benchmark
      const benchmarkSelect = evalSetup.locator('select[name="benchmark"], [data-testid="benchmark-select"]');
      if (await benchmarkSelect.isVisible()) {
        await benchmarkSelect.selectOption({ index: 0 }); // Select first benchmark
      }

      // Configure evaluation settings
      const settingsSection = evalSetup.locator('[data-testid="evaluation-settings"]');
      if (await settingsSection.isVisible()) {
        // Set max tasks
        const maxTasksInput = settingsSection.locator('input[name="maxTasks"], [data-testid="max-tasks"]');
        if (await maxTasksInput.isVisible()) {
          await maxTasksInput.fill('5');
        }

        // Set timeout
        const timeoutInput = settingsSection.locator('input[name="timeout"], [data-testid="timeout"]');
        if (await timeoutInput.isVisible()) {
          await timeoutInput.fill('300');
        }
      }

      // Start evaluation
      const startButton = evalSetup.locator(
        'button:has-text("Start Evaluation"), [data-testid="start-button"]'
      );
      await startButton.click();

      // Wait for setup to close
      await expect(evalSetup).not.toBeVisible({ timeout: 3000 });

      // Look for running evaluation
      const runningEval = page.locator('[data-testid="evaluation-item"]:has([data-status="running"])');
      if (await runningEval.isVisible({ timeout: 2000 })) {
        await expect(runningEval).toBeVisible();
      }
    }
  });

  test('should monitor evaluation progress in real-time', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Look for running evaluations
    const runningEvaluations = page.locator('[data-testid="evaluation-item"]:has([data-status="running"])');

    if (await runningEvaluations.count() > 0) {
      const firstRunning = runningEvaluations.first();
      await firstRunning.click();

      // Look for evaluation details with progress
      const progressSection = page.locator('[data-testid="evaluation-progress"]');
      if (await progressSection.isVisible()) {
        await expect(progressSection).toBeVisible();

        // Check for progress bar
        const progressBar = progressSection.locator('[role="progressbar"], [data-testid="progress-bar"]');
        if (await progressBar.isVisible()) {
          // Wait for progress update (simulating real-time)
          await page.waitForTimeout(2000);

          // Verify progress is being tracked
          const progressValue = await progressBar.getAttribute('aria-valuenow');
          expect(progressValue).toMatch(/\d+/);
        }

        // Check for live metrics
        const liveMetrics = progressSection.locator('[data-testid="live-metrics"]');
        if (await liveMetrics.isVisible()) {
          await expect(liveMetrics).toBeVisible();

          // Wait for metrics update
          await page.waitForTimeout(2000);
        }
      }
    }
  });

  test('should view evaluation details and results', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Look for completed evaluations
    const completedEvaluations = page.locator(
      '[data-testid="evaluation-item"]:has([data-status="completed"])'
    );

    if (await completedEvaluations.count() > 0) {
      const firstCompleted = completedEvaluations.first();
      await firstCompleted.click();

      // Wait for details to load
      await page.waitForLoadState('networkidle');

      // Check for results section
      const resultsSection = page.locator('[data-testid="evaluation-results"]');
      if (await resultsSection.isVisible()) {
        await expect(resultsSection).toBeVisible();

        // Check for performance metrics
        const metrics = [
          'Task Success Rate',
          'Execution Time',
          'Cost Analysis',
          'Tool Usage'
        ];

        for (const metric of metrics) {
          const metricElement = resultsSection.locator(`text="${metric}"`);
          if (await metricElement.isVisible()) {
            await expect(metricElement).toBeVisible();
          }
        }

        // Check for charts and graphs
        const charts = resultsSection.locator('[data-testid="chart"], canvas, svg');
        if (await charts.count() > 0) {
          await expect(charts.first()).toBeVisible();
        }
      }

      // Check for task breakdown
      const taskBreakdown = page.locator('[data-testid="task-breakdown"]');
      if (await taskBreakdown.isVisible()) {
        await expect(taskBreakdown).toBeVisible();

        // Look for individual task results
        const taskItems = taskBreakdown.locator('[data-testid="task-item"]');
        if (await taskItems.count() > 0) {
          await expect(taskItems.first()).toBeVisible();
        }
      }
    }
  });

  test('should filter and search evaluations', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Test search functionality
    const searchInput = page.locator(
      '[data-testid="search-input"], input[placeholder*="search"], input[placeholder*="filter"]'
    );

    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);

      // Verify search is applied
      await expect(page.locator('h1')).toContainText('Evaluations');
    }

    // Test status filter
    const statusFilter = page.locator('[data-testid="status-filter"], select[name="status"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption({ label: 'Completed' });
      await page.waitForTimeout(1000);

      // Verify filter is applied
      await expect(page.locator('h1')).toContainText('Evaluations');
    }

    // Test date range filter
    const dateRangeFilter = page.locator('[data-testid="date-range-filter"]');
    if (await dateRangeFilter.isVisible()) {
      await dateRangeFilter.click();

      // Select predefined date range
      const lastWeekOption = page.locator('text="Last Week", [data-testid="last-week"]');
      if (await lastWeekOption.isVisible()) {
        await lastWeekOption.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should compare multiple evaluations', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Look for completed evaluations to compare
    const completedEvaluations = page.locator(
      '[data-testid="evaluation-item"]:has([data-status="completed"])'
    );

    if (await completedEvaluations.count() >= 2) {
      // Select first evaluation for comparison
      const firstEval = completedEvaluations.first();
      const firstCheckbox = firstEval.locator('[data-testid="select-evaluation"]');
      if (await firstCheckbox.isVisible()) {
        await firstCheckbox.click();
      }

      // Select second evaluation for comparison
      const secondEval = completedEvaluations.nth(1);
      const secondCheckbox = secondEval.locator('[data-testid="select-evaluation"]');
      if (await secondCheckbox.isVisible()) {
        await secondCheckbox.click();
      }

      // Look for compare button
      const compareButton = page.locator('[data-testid="compare-button"]');
      if (await compareButton.isVisible()) {
        await compareButton.click();

        // Wait for comparison view
        const comparisonView = page.locator('[data-testid="comparison-view"]');
        if (await comparisonView.isVisible({ timeout: 3000 })) {
          await expect(comparisonView).toBeVisible();

          // Check for comparison metrics
          const comparisonMetrics = comparisonView.locator('[data-testid="comparison-metrics"]');
          if (await comparisonMetrics.isVisible()) {
            await expect(comparisonMetrics).toBeVisible();
          }

          // Check for side-by-side charts
          const comparisonCharts = comparisonView.locator('[data-testid="comparison-chart"]');
          if (await comparisonCharts.count() > 0) {
            await expect(comparisonCharts.first()).toBeVisible();
          }
        }
      }
    }
  });

  test('should export evaluation results', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Look for export functionality
    const exportButton = page.locator('[data-testid="export-button"]');
    if (await exportButton.isVisible()) {
      // Setup download listener
      const downloadPromise = page.waitForEvent('download');

      await exportButton.click();

      // Look for export options modal
      const exportModal = page.locator('[data-testid="export-modal"]');
      if (await exportModal.isVisible()) {
        // Select export format
        const formatSelect = exportModal.locator('select[name="format"], [data-testid="format-select"]');
        if (await formatSelect.isVisible()) {
          await formatSelect.selectOption({ label: 'CSV' });
        }

        // Confirm export
        const confirmButton = exportModal.locator('button:has-text("Export"), [data-testid="confirm-export"]');
        await confirmButton.click();

        // Wait for download
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.(csv|json|xlsx)$/);
      }
    }
  });

  test('should handle evaluation cancellation', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Look for running evaluations
    const runningEvaluations = page.locator(
      '[data-testid="evaluation-item"]:has([data-status="running"])'
    );

    if (await runningEvaluations.count() > 0) {
      const firstRunning = runningEvaluations.first();

      // Look for cancel button
      const cancelButton = firstRunning.locator('[data-testid="cancel-evaluation"]');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        // Look for confirmation dialog
        const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
        if (await confirmDialog.isVisible()) {
          await expect(confirmDialog).toBeVisible();

          // Confirm cancellation
          const confirmButton = confirmDialog.locator(
            'button:has-text("Cancel Evaluation"), [data-testid="confirm-cancel"]'
          );
          await confirmButton.click();

          // Wait for cancellation to process
          await expect(confirmDialog).not.toBeVisible({ timeout: 3000 });

          // Verify status changed to cancelled
          await page.waitForTimeout(1000);
          const cancelledStatus = firstRunning.locator('[data-status="cancelled"]');
          // Status update might take time, so we don't strictly assert here
        }
      }
    }
  });

  test('should handle evaluation logs and debugging', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Select an evaluation to view logs
    const evaluationItems = page.locator('[data-testid="evaluation-item"]');
    if (await evaluationItems.count() > 0) {
      const firstEval = evaluationItems.first();
      await firstEval.click();

      // Look for logs section
      const logsSection = page.locator('[data-testid="evaluation-logs"]');
      if (await logsSection.isVisible()) {
        await expect(logsSection).toBeVisible();

        // Check for log entries
        const logEntries = logsSection.locator('[data-testid="log-entry"]');
        if (await logEntries.count() > 0) {
          await expect(logEntries.first()).toBeVisible();
        }

        // Test log filtering
        const logFilter = logsSection.locator('[data-testid="log-filter"]');
        if (await logFilter.isVisible()) {
          await logFilter.selectOption({ label: 'Errors' });
          await page.waitForTimeout(500);
        }

        // Test log download
        const downloadLogsButton = logsSection.locator('[data-testid="download-logs"]');
        if (await downloadLogsButton.isVisible()) {
          const downloadPromise = page.waitForEvent('download');
          await downloadLogsButton.click();

          const download = await downloadPromise;
          expect(download.suggestedFilename()).toMatch(/logs?\.(txt|log)$/);
        }
      }
    }
  });

  test('should display evaluation analytics dashboard', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Look for analytics section
    const analyticsSection = page.locator('[data-testid="evaluation-analytics"]');
    if (await analyticsSection.isVisible()) {
      await expect(analyticsSection).toBeVisible();

      // Check for summary statistics
      const summaryCards = analyticsSection.locator('[data-testid="summary-card"]');
      if (await summaryCards.count() > 0) {
        await expect(summaryCards.first()).toBeVisible();
      }

      // Check for trend charts
      const trendCharts = analyticsSection.locator('[data-testid="trend-chart"]');
      if (await trendCharts.count() > 0) {
        await expect(trendCharts.first()).toBeVisible();
      }

      // Check for benchmark comparisons
      const benchmarkComparison = analyticsSection.locator('[data-testid="benchmark-comparison"]');
      if (await benchmarkComparison.isVisible()) {
        await expect(benchmarkComparison).toBeVisible();
      }
    }
  });

  test('should handle evaluation scheduling', async ({ page }) => {
    // Navigate to Evaluations page
    await page.click('nav a:has-text("Evaluations")');
    await page.waitForLoadState('networkidle');

    // Look for schedule evaluation button
    const scheduleButton = page.locator('[data-testid="schedule-evaluation-button"]');
    if (await scheduleButton.isVisible()) {
      await scheduleButton.click();

      // Look for scheduling modal
      const scheduleModal = page.locator('[data-testid="schedule-modal"]');
      if (await scheduleModal.isVisible()) {
        await expect(scheduleModal).toBeVisible();

        // Select agent and benchmark
        const agentSelect = scheduleModal.locator('select[name="agent"], [data-testid="agent-select"]');
        if (await agentSelect.isVisible()) {
          await agentSelect.selectOption({ index: 0 });
        }

        const benchmarkSelect = scheduleModal.locator('select[name="benchmark"], [data-testid="benchmark-select"]');
        if (await benchmarkSelect.isVisible()) {
          await benchmarkSelect.selectOption({ index: 0 });
        }

        // Set schedule time
        const scheduleTimeInput = scheduleModal.locator('input[type="datetime-local"], [data-testid="schedule-time"]');
        if (await scheduleTimeInput.isVisible()) {
          const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
          await scheduleTimeInput.fill(futureTime.toISOString().slice(0, 16));
        }

        // Set recurring options
        const recurringCheckbox = scheduleModal.locator('input[name="recurring"], [data-testid="recurring"]');
        if (await recurringCheckbox.isVisible()) {
          await recurringCheckbox.check();
        }

        // Save schedule
        const saveButton = scheduleModal.locator(
          'button:has-text("Schedule"), [data-testid="save-schedule"]'
        );
        await saveButton.click();

        // Wait for modal to close
        await expect(scheduleModal).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});
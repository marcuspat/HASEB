import { defineConfig } from '@playwright/test';

export default defineConfig({
 testDir: './tests/e2e',
 baseURL: 'http://localhost:3000',
 use: {
   screenshot: 'only-on-failure',
   trace: 'on-first-retry',
   video: 'retain-on-failure',
 },
 projects: [
   {
     name: 'chromium',
     use: { browserName: 'chromium' },
   },
   {
     name: 'firefox',
     use: { browserName: 'firefox' },
   },
   {
     name: 'webkit',
     use: { browserName: 'webkit' },
   },
 ],
 reporter: [
   ['html', { outputFolder: 'playwright-report', open: 'never' }],
   ['json', { outputFile: 'test-results/results.json' }],
   ['junit', { outputFile: 'test-results/results.xml' }],
   ['line'],
 ],
});

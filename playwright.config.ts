import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 35_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4198',
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4198 --strictPort',
    url: 'http://127.0.0.1:4198',
  },
});

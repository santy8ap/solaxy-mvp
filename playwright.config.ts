import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Heredado por los workers y el servidor; cada ejecución usa una base temporal distinta.
process.env.E2E_DATABASE_URL ??= `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-e2e-")), "test.db")}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node e2e/start-server.mjs",
    url: "http://127.0.0.1:4173/api/config",
    reuseExistingServer: false,
    timeout: 120000,
  },
});

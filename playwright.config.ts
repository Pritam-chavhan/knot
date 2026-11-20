import { defineConfig, devices } from "@playwright/test";

// Browser tests for public pages: accessibility, security headers and basic
// interactions. Signed-in screens are covered by database and unit tests.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3300",
    ...devices["Pixel 7"],
    launchOptions: process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  },
  webServer: {
    command: "npx next start -p 3300",
    url: "http://localhost:3300",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

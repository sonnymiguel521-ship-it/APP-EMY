import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Playwright tampoco arranca el framework al leer esta configuración: carga el
// .env por su cuenta para conocer la URL base y las credenciales del dueño.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const rutaDeSesion = "tests/e2e/.auth/estado.json";

export default defineConfig({
  // `testDir` confina el descubrimiento a tests/e2e: el bundle de diseño que
  // vive en blueprints/ nunca se recorre.
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: rutaDeSesion,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm build && pnpm exec next start -p 3000",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});

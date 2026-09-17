import { existsSync } from "node:fs";
import { test as setup } from "@playwright/test";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const rutaDeSesion = "tests/e2e/.auth/estado.json";

setup("autenticarse como el dueño", async ({ page }) => {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error("OWNER_EMAIL/OWNER_PASSWORD no están definidas para el setup de e2e.");
  }

  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  await page.context().storageState({ path: rutaDeSesion });
});

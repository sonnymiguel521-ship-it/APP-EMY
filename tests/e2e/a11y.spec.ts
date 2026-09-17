import { expect, test } from "@playwright/test";

const RUTAS_A_PROBAR = ["/articulos", "/ventas/nueva"];

for (const ruta of RUTAS_A_PROBAR) {
  test(`${ruta} tiene un solo h1 y todo input alcanzable por getByLabel`, async ({ page }) => {
    await page.goto(ruta);

    await expect(page.locator("h1")).toHaveCount(1);

    const inputs = page.locator("input, select");
    const total = await inputs.count();

    for (let i = 0; i < total; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute("id");
      if (!id) continue;
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test(`${ruta} se puede recorrer con Tab hasta el botón principal`, async ({ page }) => {
    await page.goto(ruta);

    let alcanzado = false;
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const foco = page.locator(":focus");
      const rol = await foco.getAttribute("type").catch(() => null);
      if (rol === "submit" || rol === "button") {
        alcanzado = true;
        break;
      }
    }

    expect(alcanzado).toBe(true);
  });
}

test("un formulario inválido muestra su error como texto con role=alert", async ({ page }) => {
  await page.goto("/articulos");

  await page.getByLabel("Nombre").fill("");
  await page.getByLabel("Categoría").fill("Test");
  await page.getByLabel("Precio base (centavos)").fill("100");
  await page.getByRole("button", { name: "Crear artículo" }).click();

  await expect(page.getByRole("alert").first()).toBeVisible();
});

test("/clientes/[id] tiene un solo h1", async ({ page }) => {
  await page.goto("/clientes");
  const primerEnlace = page.locator("table tbody tr a").first();

  if ((await primerEnlace.count()) === 0) {
    test.skip();
  }

  await primerEnlace.click();
  await expect(page).toHaveURL(/\/clientes\/[a-f0-9-]{36}/);
  await expect(page.locator("h1")).toHaveCount(1);
});

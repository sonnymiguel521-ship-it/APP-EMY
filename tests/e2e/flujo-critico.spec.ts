import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const SUFIJO = Date.now().toString(36);
const NOMBRE_ARTICULO = `E2E Camisa ${SUFIJO}`;
const NOMBRE_CLIENTE = `E2E Cliente ${SUFIJO}`;
const TELEFONO_CLIENTE = `809-${SUFIJO.slice(0, 3)}-0000`;

let ventaId = "";

test("crea un artículo con su variante y dos unidades con SKU distinto", async ({ page }) => {
  await page.goto("/articulos");
  await page.getByLabel("Nombre").fill(NOMBRE_ARTICULO);
  await page.getByLabel("Categoría").fill("Camisas");
  await page.getByLabel("Precio base (centavos)").fill("150000");
  await page.getByRole("button", { name: "Crear artículo" }).click();

  await expect(page.getByText(NOMBRE_ARTICULO)).toBeVisible();
  await page.getByRole("link", { name: NOMBRE_ARTICULO }).click();

  await expect(page).toHaveURL(/\/articulos\/[a-f0-9-]{36}/);

  await page.getByLabel("Color").fill("blanco");
  await page.getByLabel("Talla").fill("M");
  await page.getByRole("button", { name: "Crear variante" }).click();
  await expect(page.getByText("blanco")).toBeVisible();

  await page.goto("/unidades");
  const opcionVariante = `${NOMBRE_ARTICULO} — blanco/M`;
  const celdasSku = page.locator("table tbody tr td").filter({ hasText: /^SKU-/ });

  for (let i = 0; i < 2; i++) {
    const antes = await celdasSku.count();

    await page.getByLabel("Variante").selectOption({ label: opcionVariante });
    await page.getByRole("button", { name: "Crear unidad" }).click();
    // El botón deshabilitado ("Creando...") mientras la acción está en vuelo
    // es la señal real de que terminó; navegar antes abortaría la petición.
    await expect(page.getByRole("button", { name: "Crear unidad" })).toBeEnabled();

    // El formulario es un componente cliente: la tabla (Server Component)
    // no se refresca sola tras el submit, hay que recargar para verla.
    await page.goto("/unidades");
    await expect(celdasSku).toHaveCount(antes + 1);
  }

  const skus = await celdasSku.allTextContents();
  expect(new Set(skus).size).toBe(2);
});

test("crea un cliente y una venta con ambas unidades", async ({ page }) => {
  await page.goto("/clientes");
  await page.getByLabel("Nombre").fill(NOMBRE_CLIENTE);
  await page.getByLabel("Teléfono").fill(TELEFONO_CLIENTE);
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page.getByText(NOMBRE_CLIENTE)).toBeVisible();

  await page.goto("/ventas/nueva");
  await page.getByLabel(/Cliente/).selectOption({ label: NOMBRE_CLIENTE });

  const filas = page.locator("table tbody tr", { hasText: NOMBRE_ARTICULO });
  const total = await filas.count();
  expect(total).toBe(2);
  for (let i = 0; i < total; i++) {
    await filas.nth(i).getByRole("checkbox").check();
  }

  await page.getByRole("button", { name: "Crear venta" }).click();
  await page.waitForURL(/\/ventas\/[a-f0-9-]{36}/);
  ventaId = page.url().split("/ventas/")[1];

  await expect(page.getByText("Pendiente")).toBeVisible();
});

test("registra un pago parcial y verifica el saldo en la venta y en el perfil del cliente", async ({
  page,
}) => {
  await page.goto(`/ventas/${ventaId}`);
  await page.getByLabel("Monto (centavos)").fill("100000");
  await page.getByLabel("Método").selectOption("efectivo");
  await page.getByRole("button", { name: "Registrar pago" }).click();

  await expect(page.getByText("Parcial")).toBeVisible();
  await expect(page.getByText("2000.00")).toBeVisible();

  await page.goto("/clientes");
  await page.getByRole("link", { name: NOMBRE_CLIENTE }).click();
  await expect(page).toHaveURL(/\/clientes\/[a-f0-9-]{36}/);
  await expect(page.getByText("2000.00")).toBeVisible();
});

test("rechaza un pago mayor que el saldo y deja el saldo sin cambios", async ({ page }) => {
  await page.goto(`/ventas/${ventaId}`);
  await page.getByLabel("Monto (centavos)").fill("999999");
  await page.getByLabel("Método").selectOption("efectivo");
  await page.getByRole("button", { name: "Registrar pago" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "supera el saldo" })).toBeVisible();
  await expect(page.getByText("2000.00")).toBeVisible();
});

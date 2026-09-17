import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { articulo, cliente, pago, unidad, variante, venta, ventaUnidad } from "@/lib/db/schema";

describe("esquema de dominio", () => {
  it("permite select sobre cada tabla que §4 define", async () => {
    await expect(db.select().from(articulo).limit(1)).resolves.toBeDefined();
    await expect(db.select().from(variante).limit(1)).resolves.toBeDefined();
    await expect(db.select().from(unidad).limit(1)).resolves.toBeDefined();
    await expect(db.select().from(cliente).limit(1)).resolves.toBeDefined();
    await expect(db.select().from(venta).limit(1)).resolves.toBeDefined();
    await expect(db.select().from(ventaUnidad).limit(1)).resolves.toBeDefined();
    await expect(db.select().from(pago).limit(1)).resolves.toBeDefined();
  });

  describe("unicidad de sku en unidad", () => {
    const skuDuplicado = "TEST-SCHEMA-SKU-DUP";
    let articuloId: string;
    let varianteId: string;

    afterAll(async () => {
      await db.delete(unidad).where(eq(unidad.sku, skuDuplicado));
      if (varianteId) await db.delete(variante).where(eq(variante.id, varianteId));
      if (articuloId) await db.delete(articulo).where(eq(articulo.id, articuloId));
    });

    it("rechaza una segunda fila con el mismo sku y deja exactamente una", async () => {
      const [creadoArticulo] = await db
        .insert(articulo)
        .values({
          nombre: "Test Schema Articulo",
          categoria: "Test",
          precioBaseCentavos: 1000,
        })
        .returning({ id: articulo.id });
      articuloId = creadoArticulo.id;

      const [creadaVariante] = await db
        .insert(variante)
        .values({ articuloId, color: "test", talla: "unica" })
        .returning({ id: variante.id });
      varianteId = creadaVariante.id;

      await db.insert(unidad).values({ varianteId, sku: skuDuplicado });

      await expect(db.insert(unidad).values({ varianteId, sku: skuDuplicado })).rejects.toThrow();

      const filas = await db.select().from(unidad).where(eq(unidad.sku, skuDuplicado));

      expect(filas).toHaveLength(1);
    });
  });
});

import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSesion: vi.fn() }));

import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { articulo, unidad, variante, venta, ventaUnidad } from "@/lib/db/schema";
import { cambiarEstadoUnidad, crearUnidad } from "@/server/unidades";

const PREFIJO = "Test E1T5";

const sesionFalsa = {
  session: { id: "sesion-test", token: "t", expiresAt: new Date(), userId: "usuario-test" },
  user: { id: "usuario-test", email: "dueno-test@example.com" },
} as unknown as Awaited<ReturnType<typeof getSesion>>;

async function crearArticuloYVarianteDePrueba(sufijo: string): Promise<string> {
  const [creadoArticulo] = await db
    .insert(articulo)
    .values({ nombre: `${PREFIJO} ${sufijo}`, categoria: "Test", precioBaseCentavos: 1000 })
    .returning({ id: articulo.id });

  const [creadaVariante] = await db
    .insert(variante)
    .values({ articuloId: creadoArticulo.id, color: "test", talla: "unica" })
    .returning({ id: variante.id });

  return creadaVariante.id;
}

describe("src/server/unidades.ts", () => {
  beforeEach(() => {
    vi.mocked(getSesion).mockReset();
    vi.mocked(getSesion).mockResolvedValue(sesionFalsa);
  });

  afterAll(async () => {
    const filas = await db
      .select()
      .from(articulo)
      .where(like(articulo.nombre, `${PREFIJO}%`));
    for (const fila of filas) {
      const variantes = await db
        .select({ id: variante.id })
        .from(variante)
        .where(eq(variante.articuloId, fila.id));
      for (const v of variantes) {
        await db.delete(ventaUnidad).where(eq(ventaUnidad.unidadId, v.id));
        await db.delete(unidad).where(eq(unidad.varianteId, v.id));
      }
      await db.delete(variante).where(eq(variante.articuloId, fila.id));
      await db.delete(articulo).where(eq(articulo.id, fila.id));
    }
  });

  it("crea dos unidades sin sku con valores distintos y sku_auto_generado en true", async () => {
    const varianteId = await crearArticuloYVarianteDePrueba("Auto");

    const primera = await crearUnidad({ varianteId });
    const segunda = await crearUnidad({ varianteId });

    expect(primera.ok).toBe(true);
    expect(segunda.ok).toBe(true);
    if (primera.ok && segunda.ok) {
      expect(primera.data.sku).not.toBe(segunda.data.sku);
    }

    const filas = await db.select().from(unidad).where(eq(unidad.varianteId, varianteId));
    expect(filas).toHaveLength(2);
    for (const fila of filas) {
      expect(fila.skuAutoGenerado).toBe(true);
    }
  });

  it("un sku manual ya existente devuelve SKU_DUPLICADO y deja exactamente una fila", async () => {
    const varianteId = await crearArticuloYVarianteDePrueba("Manual Duplicado");
    const sku = "TEST-E1T5-MANUAL-DUP";

    const primera = await crearUnidad({ varianteId, sku });
    expect(primera.ok).toBe(true);

    const segunda = await crearUnidad({ varianteId, sku });

    expect(segunda.ok).toBe(false);
    if (!segunda.ok) {
      expect(segunda.error.code).toBe("SKU_DUPLICADO");
    }

    const filas = await db.select().from(unidad).where(eq(unidad.sku, sku));
    expect(filas).toHaveLength(1);
  });

  it("un sku manual nuevo inserta la fila con sku_auto_generado en false", async () => {
    const varianteId = await crearArticuloYVarianteDePrueba("Manual Nuevo");
    const sku = "TEST-E1T5-MANUAL-NUEVO";

    const resultado = await crearUnidad({ varianteId, sku });

    expect(resultado.ok).toBe(true);

    const [fila] = await db.select().from(unidad).where(eq(unidad.sku, sku));
    expect(fila.skuAutoGenerado).toBe(false);
  });

  it("crea 50 unidades seguidas sin sku y produce 50 valores distintos entre sí", async () => {
    const varianteId = await crearArticuloYVarianteDePrueba("Cincuenta");

    const skus: string[] = [];
    for (let i = 0; i < 50; i++) {
      const resultado = await crearUnidad({ varianteId });
      expect(resultado.ok).toBe(true);
      if (resultado.ok) skus.push(resultado.data.sku);
    }

    expect(new Set(skus).size).toBe(50);
  });

  it("cambiarEstadoUnidad a disponible sobre una unidad ya vendida devuelve UNIDAD_NO_DISPONIBLE", async () => {
    const varianteId = await crearArticuloYVarianteDePrueba("Vendida");

    const creada = await crearUnidad({ varianteId });
    if (!creada.ok) throw new Error("fixture: no se pudo crear la unidad");

    // Simula que la unidad ya pertenece a una venta insertando directamente la fila de
    // unión: crearVenta llega en E2-T1 y esta prueba no puede depender de ella.
    const [ventaCreada] = await db
      .insert(venta)
      .values({ montoTotalCentavos: 1000 })
      .returning({ id: venta.id });

    await db.insert(ventaUnidad).values({
      ventaId: ventaCreada.id,
      unidadId: creada.data.id,
      precioVentaCentavos: 1000,
    });

    await db.update(unidad).set({ estado: "vendida" }).where(eq(unidad.id, creada.data.id));

    const resultado = await cambiarEstadoUnidad({ id: creada.data.id, estado: "disponible" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("UNIDAD_NO_DISPONIBLE");
    }

    const [filaFinal] = await db.select().from(unidad).where(eq(unidad.id, creada.data.id));
    expect(filaFinal.estado).toBe("vendida");

    await db.delete(ventaUnidad).where(eq(ventaUnidad.ventaId, ventaCreada.id));
    await db.delete(venta).where(eq(venta.id, ventaCreada.id));
  });
});

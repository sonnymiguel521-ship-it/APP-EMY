import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSesion: vi.fn() }));

import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { articulo, unidad, variante, venta, ventaUnidad } from "@/lib/db/schema";
import { crearVenta } from "@/server/ventas";

const PREFIJO = "Test E2T1";

const sesionFalsa = {
  session: { id: "sesion-test", token: "t", expiresAt: new Date(), userId: "usuario-test" },
  user: { id: "usuario-test", email: "dueno-test@example.com" },
} as unknown as Awaited<ReturnType<typeof getSesion>>;

async function crearUnidadDePrueba(sufijo: string, sku: string) {
  const [creadoArticulo] = await db
    .insert(articulo)
    .values({ nombre: `${PREFIJO} ${sufijo}`, categoria: "Test", precioBaseCentavos: 1000 })
    .returning({ id: articulo.id });

  const [creadaVariante] = await db
    .insert(variante)
    .values({ articuloId: creadoArticulo.id, color: "test", talla: "unica" })
    .returning({ id: variante.id });

  const [creadaUnidad] = await db
    .insert(unidad)
    .values({ varianteId: creadaVariante.id, sku, skuAutoGenerado: false })
    .returning();

  return { articuloId: creadoArticulo.id, varianteId: creadaVariante.id, unidad: creadaUnidad };
}

describe("src/server/ventas.ts", () => {
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
        const unidades = await db
          .select({ id: unidad.id })
          .from(unidad)
          .where(eq(unidad.varianteId, v.id));
        for (const u of unidades) {
          await db.delete(ventaUnidad).where(eq(ventaUnidad.unidadId, u.id));
        }
        await db.delete(unidad).where(eq(unidad.varianteId, v.id));
      }
      await db.delete(variante).where(eq(variante.articuloId, fila.id));
      await db.delete(articulo).where(eq(articulo.id, fila.id));
    }
  });

  it("crea una venta con dos unidades disponibles: total correcto y ambas quedan vendidas", async () => {
    const u1 = await crearUnidadDePrueba("Dos Disponibles A", "TEST-E2T1-DISP-A");
    const u2 = await crearUnidadDePrueba("Dos Disponibles B", "TEST-E2T1-DISP-B");

    const resultado = await crearVenta({
      lineas: [
        { unidadId: u1.unidad.id, precioVentaCentavos: 1500 },
        { unidadId: u2.unidad.id, precioVentaCentavos: 2000 },
      ],
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.montoTotalCentavos).toBe(3500);
    }

    const [fila1] = await db.select().from(unidad).where(eq(unidad.id, u1.unidad.id));
    const [fila2] = await db.select().from(unidad).where(eq(unidad.id, u2.unidad.id));
    expect(fila1.estado).toBe("vendida");
    expect(fila2.estado).toBe("vendida");
  });

  it("una unidad disponible y otra ya vendida: UNIDAD_NO_DISPONIBLE, sin venta y la disponible sigue disponible", async () => {
    const disponible = await crearUnidadDePrueba("Mixta Disponible", "TEST-E2T1-MIX-DISP");
    const vendida = await crearUnidadDePrueba("Mixta Vendida", "TEST-E2T1-MIX-VEND");

    await db.update(unidad).set({ estado: "vendida" }).where(eq(unidad.id, vendida.unidad.id));

    const antesVentas = await db.select().from(venta);

    const resultado = await crearVenta({
      lineas: [
        { unidadId: disponible.unidad.id, precioVentaCentavos: 1000 },
        { unidadId: vendida.unidad.id, precioVentaCentavos: 1000 },
      ],
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("UNIDAD_NO_DISPONIBLE");
    }

    const despuesVentas = await db.select().from(venta);
    expect(despuesVentas).toHaveLength(antesVentas.length);

    const [filaDisponible] = await db
      .select()
      .from(unidad)
      .where(eq(unidad.id, disponible.unidad.id));
    expect(filaDisponible.estado).toBe("disponible");
  });

  it("sin clienteId crea la venta con cliente_id nulo y estado pendiente", async () => {
    const u = await crearUnidadDePrueba("Sin Cliente", "TEST-E2T1-SIN-CLIENTE");

    const resultado = await crearVenta({
      lineas: [{ unidadId: u.unidad.id, precioVentaCentavos: 1000 }],
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      const [filaVenta] = await db.select().from(venta).where(eq(venta.id, resultado.data.ventaId));
      expect(filaVenta.clienteId).toBeNull();
      expect(filaVenta.estado).toBe("pendiente");
    }
  });

  it("incluir la misma unidad en una segunda venta se rechaza y deja una sola fila de venta_unidad", async () => {
    const u = await crearUnidadDePrueba("Doble Venta", "TEST-E2T1-DOBLE");

    const primera = await crearVenta({
      lineas: [{ unidadId: u.unidad.id, precioVentaCentavos: 1000 }],
    });
    expect(primera.ok).toBe(true);

    const segunda = await crearVenta({
      lineas: [{ unidadId: u.unidad.id, precioVentaCentavos: 1000 }],
    });
    expect(segunda.ok).toBe(false);

    const filas = await db.select().from(ventaUnidad).where(eq(ventaUnidad.unidadId, u.unidad.id));
    expect(filas).toHaveLength(1);
  });

  it("una lista de líneas vacía devuelve VALIDATION_ERROR y no escribe nada", async () => {
    const antesVentas = await db.select().from(venta);

    const resultado = await crearVenta({ lineas: [] });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("VALIDATION_ERROR");
    }

    const despuesVentas = await db.select().from(venta);
    expect(despuesVentas).toHaveLength(antesVentas.length);
  });
});

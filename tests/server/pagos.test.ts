import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSesion: vi.fn() }));

import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { articulo, pago, unidad, variante, venta, ventaUnidad } from "@/lib/db/schema";
import { registrarPago } from "@/server/pagos";

const PREFIJO = "Test E2T2";

const sesionFalsa = {
  session: { id: "sesion-test", token: "t", expiresAt: new Date(), userId: "usuario-test" },
  user: { id: "usuario-test", email: "dueno-test@example.com" },
} as unknown as Awaited<ReturnType<typeof getSesion>>;

async function crearVentaDePrueba(sufijo: string, montoTotalCentavos: number): Promise<string> {
  const [creadoArticulo] = await db
    .insert(articulo)
    .values({
      nombre: `${PREFIJO} ${sufijo}`,
      categoria: "Test",
      precioBaseCentavos: montoTotalCentavos,
    })
    .returning({ id: articulo.id });

  const [creadaVariante] = await db
    .insert(variante)
    .values({ articuloId: creadoArticulo.id, color: "test", talla: "unica" })
    .returning({ id: variante.id });

  const [creadaUnidad] = await db
    .insert(unidad)
    .values({
      varianteId: creadaVariante.id,
      sku: `TEST-E2T2-${sufijo.replace(/\s+/g, "-").toUpperCase()}`,
      skuAutoGenerado: false,
      estado: "vendida",
    })
    .returning({ id: unidad.id });

  const [creadaVenta] = await db
    .insert(venta)
    .values({ montoTotalCentavos, estado: "pendiente" })
    .returning({ id: venta.id });

  await db.insert(ventaUnidad).values({
    ventaId: creadaVenta.id,
    unidadId: creadaUnidad.id,
    precioVentaCentavos: montoTotalCentavos,
  });

  return creadaVenta.id;
}

describe("src/server/pagos.ts", () => {
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
          const filasVentaUnidad = await db
            .select({ ventaId: ventaUnidad.ventaId })
            .from(ventaUnidad)
            .where(eq(ventaUnidad.unidadId, u.id));
          for (const vu of filasVentaUnidad) {
            await db.delete(pago).where(eq(pago.ventaId, vu.ventaId));
            await db.delete(ventaUnidad).where(eq(ventaUnidad.ventaId, vu.ventaId));
            await db.delete(venta).where(eq(venta.id, vu.ventaId));
          }
        }
        await db.delete(unidad).where(eq(unidad.varianteId, v.id));
      }
      await db.delete(variante).where(eq(variante.articuloId, fila.id));
      await db.delete(articulo).where(eq(articulo.id, fila.id));
    }
  });

  it("un pago menor que el total deja la venta en parcial y devuelve el saldo restante", async () => {
    const ventaId = await crearVentaDePrueba("Parcial", 1000);

    const resultado = await registrarPago({ ventaId, montoCentavos: 400, metodo: "efectivo" });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.estadoVenta).toBe("parcial");
      expect(resultado.data.saldoCentavos).toBe(600);
    }
  });

  it("cuando la suma de pagos alcanza el total la venta queda pagada con saldo 0", async () => {
    const ventaId = await crearVentaDePrueba("Pagada", 1000);

    await registrarPago({ ventaId, montoCentavos: 600, metodo: "efectivo" });
    const resultado = await registrarPago({ ventaId, montoCentavos: 400, metodo: "tarjeta" });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.estadoVenta).toBe("pagada");
      expect(resultado.data.saldoCentavos).toBe(0);
    }
  });

  it("un pago mayor que el saldo pendiente devuelve PAGO_EXCEDE_SALDO y no inserta ni cambia el estado", async () => {
    const ventaId = await crearVentaDePrueba("Excede", 1000);

    const resultado = await registrarPago({ ventaId, montoCentavos: 1500, metodo: "efectivo" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("PAGO_EXCEDE_SALDO");
    }

    const pagos = await db.select().from(pago).where(eq(pago.ventaId, ventaId));
    expect(pagos).toHaveLength(0);

    const [filaVenta] = await db.select().from(venta).where(eq(venta.id, ventaId));
    expect(filaVenta.estado).toBe("pendiente");
  });

  it("un montoCentavos menor o igual a 0 devuelve VALIDATION_ERROR y no escribe nada", async () => {
    const ventaId = await crearVentaDePrueba("Monto Invalido", 1000);

    const resultado = await registrarPago({ ventaId, montoCentavos: 0, metodo: "efectivo" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("VALIDATION_ERROR");
    }

    const pagos = await db.select().from(pago).where(eq(pago.ventaId, ventaId));
    expect(pagos).toHaveLength(0);
  });

  it("un pago sobre una venta inexistente devuelve NOT_FOUND", async () => {
    const resultado = await registrarPago({
      ventaId: "00000000-0000-0000-0000-000000000000",
      montoCentavos: 100,
      metodo: "efectivo",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("NOT_FOUND");
    }
  });
});

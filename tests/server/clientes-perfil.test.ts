import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSesion: vi.fn() }));

import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { articulo, cliente, pago, unidad, variante, venta, ventaUnidad } from "@/lib/db/schema";
import { perfilDeCliente } from "@/server/clientes-perfil";

const PREFIJO = "Test E2T3";

const sesionFalsa = {
  session: { id: "sesion-test", token: "t", expiresAt: new Date(), userId: "usuario-test" },
  user: { id: "usuario-test", email: "dueno-test@example.com" },
} as unknown as Awaited<ReturnType<typeof getSesion>>;

async function crearVentaParaCliente(
  clienteId: string,
  sufijo: string,
  montoTotalCentavos: number,
): Promise<string> {
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
      sku: `TEST-E2T3-${sufijo.replace(/\s+/g, "-").toUpperCase()}`,
      skuAutoGenerado: false,
      estado: "vendida",
    })
    .returning({ id: unidad.id });

  const [creadaVenta] = await db
    .insert(venta)
    .values({ clienteId, montoTotalCentavos, estado: "pendiente" })
    .returning({ id: venta.id });

  await db.insert(ventaUnidad).values({
    ventaId: creadaVenta.id,
    unidadId: creadaUnidad.id,
    precioVentaCentavos: montoTotalCentavos,
  });

  return creadaVenta.id;
}

describe("src/server/clientes-perfil.ts", () => {
  beforeEach(() => {
    vi.mocked(getSesion).mockReset();
    vi.mocked(getSesion).mockResolvedValue(sesionFalsa);
  });

  afterAll(async () => {
    const clientes = await db
      .select()
      .from(cliente)
      .where(like(cliente.nombre, `${PREFIJO}%`));
    const articulos = await db
      .select()
      .from(articulo)
      .where(like(articulo.nombre, `${PREFIJO}%`));

    for (const c of clientes) {
      const ventas = await db.select({ id: venta.id }).from(venta).where(eq(venta.clienteId, c.id));
      for (const v of ventas) {
        await db.delete(pago).where(eq(pago.ventaId, v.id));
        await db.delete(ventaUnidad).where(eq(ventaUnidad.ventaId, v.id));
        await db.delete(venta).where(eq(venta.id, v.id));
      }
    }

    for (const a of articulos) {
      const variantes = await db
        .select({ id: variante.id })
        .from(variante)
        .where(eq(variante.articuloId, a.id));
      for (const v of variantes) {
        await db.delete(unidad).where(eq(unidad.varianteId, v.id));
      }
      await db.delete(variante).where(eq(variante.articuloId, a.id));
      await db.delete(articulo).where(eq(articulo.id, a.id));
    }

    for (const c of clientes) {
      await db.delete(cliente).where(eq(cliente.id, c.id));
    }
  });

  it("un cliente con dos ventas y un pago parcial tiene saldo = suma de totales - suma de pagos", async () => {
    const [creadoCliente] = await db
      .insert(cliente)
      .values({ nombre: `${PREFIJO} Dos Ventas`, telefono: "809-555-0001" })
      .returning({ id: cliente.id });

    await crearVentaParaCliente(creadoCliente.id, "Venta Uno", 1000);
    const ventaDosId = await crearVentaParaCliente(creadoCliente.id, "Venta Dos", 2000);

    await db.insert(pago).values({ ventaId: ventaDosId, montoCentavos: 500, metodo: "efectivo" });

    const resultado = await perfilDeCliente(creadoCliente.id);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.saldoCentavos).toBe(1000 + 2000 - 500);
    }
  });

  it("un cliente sin ventas devuelve historiales vacíos y saldo 0", async () => {
    const [creadoCliente] = await db
      .insert(cliente)
      .values({ nombre: `${PREFIJO} Sin Ventas`, telefono: "809-555-0002" })
      .returning({ id: cliente.id });

    const resultado = await perfilDeCliente(creadoCliente.id);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.ventas).toHaveLength(0);
      expect(resultado.data.pagos).toHaveLength(0);
      expect(resultado.data.saldoCentavos).toBe(0);
    }
  });

  it("el perfil de un id inexistente devuelve NOT_FOUND", async () => {
    const resultado = await perfilDeCliente("00000000-0000-0000-0000-000000000000");

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("NOT_FOUND");
    }
  });

  it("una venta totalmente pagada se muestra con estado pagada y no suma al saldo", async () => {
    const [creadoCliente] = await db
      .insert(cliente)
      .values({ nombre: `${PREFIJO} Pagada`, telefono: "809-555-0003" })
      .returning({ id: cliente.id });

    const ventaId = await crearVentaParaCliente(creadoCliente.id, "Pagada Completa", 1000);
    await db.insert(pago).values({ ventaId, montoCentavos: 1000, metodo: "tarjeta" });
    await db.update(venta).set({ estado: "pagada" }).where(eq(venta.id, ventaId));

    const resultado = await perfilDeCliente(creadoCliente.id);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      const ventaEnPerfil = resultado.data.ventas.find((v) => v.id === ventaId);
      expect(ventaEnPerfil?.estado).toBe("pagada");
      expect(resultado.data.saldoCentavos).toBe(0);
    }
  });

  it("el perfil lista el sku de cada unidad vendida en cada venta", async () => {
    const [creadoCliente] = await db
      .insert(cliente)
      .values({ nombre: `${PREFIJO} Con Skus`, telefono: "809-555-0004" })
      .returning({ id: cliente.id });

    const ventaId = await crearVentaParaCliente(creadoCliente.id, "Con Sku", 1000);

    const resultado = await perfilDeCliente(creadoCliente.id);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      const ventaEnPerfil = resultado.data.ventas.find((v) => v.id === ventaId);
      expect(ventaEnPerfil?.skus).toEqual(["TEST-E2T3-CON-SKU"]);
    }
  });
});

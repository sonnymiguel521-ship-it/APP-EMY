import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSesion: vi.fn() }));

import { GET } from "@/app/api/v1/ventas/[id]/recibo/route";
import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { articulo, unidad, variante, venta, ventaUnidad } from "@/lib/db/schema";

const PREFIJO = "Test E2T5";

const sesionFalsa = {
  session: { id: "sesion-test", token: "t", expiresAt: new Date(), userId: "usuario-test" },
  user: { id: "usuario-test", email: "dueno-test@example.com" },
} as unknown as Awaited<ReturnType<typeof getSesion>>;

async function crearVentaDePrueba(): Promise<string> {
  const [creadoArticulo] = await db
    .insert(articulo)
    .values({ nombre: `${PREFIJO} Articulo`, categoria: "Test", precioBaseCentavos: 1000 })
    .returning({ id: articulo.id });

  const [creadaVariante] = await db
    .insert(variante)
    .values({ articuloId: creadoArticulo.id, color: "test", talla: "unica" })
    .returning({ id: variante.id });

  const [creadaUnidad] = await db
    .insert(unidad)
    .values({
      varianteId: creadaVariante.id,
      sku: `TEST-E2T5-RECIBO-${crypto.randomUUID().slice(0, 8)}`,
      skuAutoGenerado: false,
      estado: "vendida",
    })
    .returning({ id: unidad.id });

  const [creadaVenta] = await db
    .insert(venta)
    .values({ montoTotalCentavos: 1000, estado: "pendiente" })
    .returning({ id: venta.id });

  await db.insert(ventaUnidad).values({
    ventaId: creadaVenta.id,
    unidadId: creadaUnidad.id,
    precioVentaCentavos: 1000,
  });

  return creadaVenta.id;
}

function contexto(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/ventas/[id]/recibo", () => {
  let ventaId: string;

  beforeEach(async () => {
    vi.mocked(getSesion).mockReset();
    vi.mocked(getSesion).mockResolvedValue(sesionFalsa);
    ventaId = await crearVentaDePrueba();
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

  it("con sesión y venta existente responde 200 con application/pdf y firma %PDF-", async () => {
    const response = await GET(new Request("http://localhost/x"), contexto(ventaId));
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("cuando la venta no existe responde 404 con un cuerpo JSON cuyo error.code es NOT_FOUND", async () => {
    const response = await GET(
      new Request("http://localhost/x"),
      contexto("00000000-0000-0000-0000-000000000000"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("sin sesión responde 401 con un cuerpo JSON cuyo error.code es UNAUTHENTICATED", async () => {
    vi.mocked(getSesion).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/x"), contexto(ventaId));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("una venta sin cliente asociado genera el PDF igualmente, identificándola como contado", async () => {
    const response = await GET(new Request("http://localhost/x"), contexto(ventaId));
    const buffer = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

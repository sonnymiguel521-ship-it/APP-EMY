import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { cliente, pago, unidad, venta, ventaUnidad } from "@/lib/db/schema";
import { ERROR_NO_AUTENTICADO, errorResultado, type Resultado } from "@/lib/resultado";

interface VentaDelPerfil {
  id: string;
  fecha: Date;
  montoTotalCentavos: number;
  estado: string;
  skus: string[];
}

interface PagoDelPerfil {
  id: string;
  fecha: Date;
  montoCentavos: number;
  metodo: string;
}

interface PerfilCliente {
  cliente: typeof cliente.$inferSelect;
  ventas: VentaDelPerfil[];
  pagos: PagoDelPerfil[];
  saldoCentavos: number;
}

export async function perfilDeCliente(id: string): Promise<Resultado<PerfilCliente>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const [filaCliente] = await db.select().from(cliente).where(eq(cliente.id, id)).limit(1);
  if (!filaCliente) return errorResultado("NOT_FOUND", "El cliente no existe.");

  const ventas = await db.select().from(venta).where(eq(venta.clienteId, id)).orderBy(venta.fecha);

  const ventasConSkus: VentaDelPerfil[] = await Promise.all(
    ventas.map(async (v) => {
      const lineas = await db
        .select({ sku: unidad.sku })
        .from(ventaUnidad)
        .innerJoin(unidad, eq(ventaUnidad.unidadId, unidad.id))
        .where(eq(ventaUnidad.ventaId, v.id));

      return {
        id: v.id,
        fecha: v.fecha,
        montoTotalCentavos: v.montoTotalCentavos,
        estado: v.estado,
        skus: lineas.map((l) => l.sku),
      };
    }),
  );

  const pagos = await db
    .select({
      id: pago.id,
      fecha: pago.fecha,
      montoCentavos: pago.montoCentavos,
      metodo: pago.metodo,
    })
    .from(pago)
    .innerJoin(venta, eq(pago.ventaId, venta.id))
    .where(eq(venta.clienteId, id))
    .orderBy(pago.fecha);

  const [{ totalVentas }] = await db
    .select({ totalVentas: sql<number>`coalesce(sum(${venta.montoTotalCentavos}), 0)::int` })
    .from(venta)
    .where(eq(venta.clienteId, id));

  const [{ totalPagos }] = await db
    .select({ totalPagos: sql<number>`coalesce(sum(${pago.montoCentavos}), 0)::int` })
    .from(pago)
    .innerJoin(venta, eq(pago.ventaId, venta.id))
    .where(eq(venta.clienteId, id));

  return {
    ok: true,
    data: {
      cliente: filaCliente,
      ventas: ventasConSkus,
      pagos,
      saldoCentavos: totalVentas - totalPagos,
    },
  };
}

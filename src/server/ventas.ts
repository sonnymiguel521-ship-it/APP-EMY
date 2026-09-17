import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { unidad, venta, ventaUnidad } from "@/lib/db/schema";
import { ERROR_NO_AUTENTICADO, errorResultado, type Resultado } from "@/lib/resultado";

function validationErrorDeZod(error: z.ZodError): Resultado<never> {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path.join(".") || "_";
    if (!campos[campo]) {
      campos[campo] = issue.message;
    }
  }

  return errorResultado("VALIDATION_ERROR", "Los datos enviados no son válidos.", campos);
}

const crearVentaSchema = z.object({
  clienteId: z.string().uuid().optional(),
  lineas: z
    .array(
      z.object({
        unidadId: z.string().uuid(),
        precioVentaCentavos: z.number().int().positive(),
      }),
    )
    .min(1, "La venta debe tener al menos una línea."),
});

export type CrearVentaInput = z.infer<typeof crearVentaSchema>;

class ErrorDeDominio extends Error {
  constructor(public resultado: Resultado<never>) {
    super(resultado.ok ? "" : resultado.error.mensaje);
  }
}

export async function crearVenta(
  input: CrearVentaInput,
): Promise<Resultado<{ ventaId: string; montoTotalCentavos: number }>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = crearVentaSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const { clienteId, lineas } = parsed.data;
  const unidadIds = lineas.map((l) => l.unidadId);

  try {
    return await db.transaction(async (tx) => {
      const unidades = await tx
        .select({ id: unidad.id, estado: unidad.estado })
        .from(unidad)
        .where(inArray(unidad.id, unidadIds))
        .for("update");

      if (unidades.length !== new Set(unidadIds).size) {
        throw new ErrorDeDominio(errorResultado("NOT_FOUND", "Una o más unidades no existen."));
      }

      const noDisponible = unidades.some((u) => u.estado !== "disponible");
      if (noDisponible) {
        throw new ErrorDeDominio(
          errorResultado(
            "UNIDAD_NO_DISPONIBLE",
            "Una o más unidades ya no están disponibles para la venta.",
          ),
        );
      }

      const montoTotalCentavos = lineas.reduce((acc, l) => acc + l.precioVentaCentavos, 0);

      const [creada] = await tx
        .insert(venta)
        .values({ clienteId, montoTotalCentavos, estado: "pendiente" })
        .returning({ id: venta.id });

      await tx.insert(ventaUnidad).values(
        lineas.map((l) => ({
          ventaId: creada.id,
          unidadId: l.unidadId,
          precioVentaCentavos: l.precioVentaCentavos,
        })),
      );

      await tx
        .update(unidad)
        .set({ estado: "vendida", actualizadoEn: new Date() })
        .where(inArray(unidad.id, unidadIds));

      return { ok: true, data: { ventaId: creada.id, montoTotalCentavos } };
    });
  } catch (error: unknown) {
    if (error instanceof ErrorDeDominio) {
      return error.resultado;
    }

    throw error;
  }
}

const listarVentasSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(25),
});

export type ListarVentasInput = z.input<typeof listarVentasSchema>;

interface ListaVentas {
  items: (typeof venta.$inferSelect)[];
  total: number;
  page: number;
  perPage: number;
}

export async function listarVentas(input: ListarVentasInput): Promise<Resultado<ListaVentas>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = listarVentasSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const { page, perPage } = parsed.data;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(venta)
      .orderBy(sql`${venta.fecha} desc`)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: sql<number>`count(*)::int` }).from(venta),
  ]);

  return { ok: true, data: { items, total, page, perPage } };
}

interface LineaVenta {
  unidadId: string;
  sku: string;
  precioVentaCentavos: number;
}

interface VentaConDetalle {
  venta: typeof venta.$inferSelect;
  lineas: LineaVenta[];
}

export async function obtenerVenta(id: string): Promise<Resultado<VentaConDetalle>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const [filaVenta] = await db.select().from(venta).where(eq(venta.id, id)).limit(1);

  if (!filaVenta) return errorResultado("NOT_FOUND", "La venta no existe.");

  const lineas = await db
    .select({
      unidadId: ventaUnidad.unidadId,
      sku: unidad.sku,
      precioVentaCentavos: ventaUnidad.precioVentaCentavos,
    })
    .from(ventaUnidad)
    .innerJoin(unidad, eq(ventaUnidad.unidadId, unidad.id))
    .where(and(eq(ventaUnidad.ventaId, id)));

  return { ok: true, data: { venta: filaVenta, lineas } };
}

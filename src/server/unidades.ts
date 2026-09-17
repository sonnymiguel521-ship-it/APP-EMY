import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { articulo, estadoUnidad, unidad, variante, ventaUnidad } from "@/lib/db/schema";
import { ERROR_NO_AUTENTICADO, errorResultado, type Resultado } from "@/lib/resultado";

const UNIDAD_SKU_UNICA = "unidad_sku_unique";
const MAX_REINTENTOS_SKU_AUTOMATICO = 3;

function esViolacionUnicidadSku(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const conCodigo = error as { code?: unknown; message?: unknown; cause?: unknown };
  const causa = conCodigo.cause as { code?: unknown; message?: unknown } | undefined;
  const codigo = conCodigo.code ?? causa?.code;
  const mensaje = `${String(causa?.message ?? "")} ${String(conCodigo.message ?? "")}`;

  return (
    codigo === "23505" && (mensaje.includes(UNIDAD_SKU_UNICA) || mensaje.includes("duplicate key"))
  );
}

function generarSkuAutomatico(): string {
  return `SKU-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

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

const skuManualSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Z0-9-]+$/, "El SKU solo admite letras mayúsculas, números y guiones.");

const crearUnidadSchema = z.object({
  varianteId: z.string().uuid(),
  sku: skuManualSchema.optional(),
  estado: z.enum(["disponible", "reservada"]).optional(),
});

export type CrearUnidadInput = z.infer<typeof crearUnidadSchema>;

const listarUnidadesSchema = z.object({
  estado: z.enum(estadoUnidad.enumValues).optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(25),
});

export type ListarUnidadesInput = z.input<typeof listarUnidadesSchema>;

interface ListaUnidades {
  items: (typeof unidad.$inferSelect)[];
  total: number;
  page: number;
  perPage: number;
}

export async function crearUnidad(
  input: CrearUnidadInput,
): Promise<Resultado<{ id: string; sku: string }>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = crearUnidadSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const { varianteId, estado } = parsed.data;

  if (parsed.data.sku) {
    try {
      const [creada] = await db
        .insert(unidad)
        .values({ varianteId, sku: parsed.data.sku, skuAutoGenerado: false, estado })
        .returning({ id: unidad.id, sku: unidad.sku });

      return { ok: true, data: creada };
    } catch (error: unknown) {
      if (esViolacionUnicidadSku(error)) {
        return errorResultado("SKU_DUPLICADO", "Ya existe una unidad con ese SKU.");
      }

      throw error;
    }
  }

  for (let intento = 0; intento < MAX_REINTENTOS_SKU_AUTOMATICO; intento++) {
    const sku = generarSkuAutomatico();

    try {
      const [creada] = await db
        .insert(unidad)
        .values({ varianteId, sku, skuAutoGenerado: true, estado })
        .returning({ id: unidad.id, sku: unidad.sku });

      return { ok: true, data: creada };
    } catch (error: unknown) {
      if (esViolacionUnicidadSku(error)) {
        continue;
      }

      throw error;
    }
  }

  return errorResultado(
    "INTERNAL",
    "No se pudo generar un SKU único tras varios intentos. Intenta de nuevo.",
  );
}

export async function listarUnidades(
  input: ListarUnidadesInput,
): Promise<Resultado<ListaUnidades>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = listarUnidadesSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const { estado, page, perPage } = parsed.data;
  const condicion = estado ? eq(unidad.estado, estado) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(unidad)
      .where(condicion)
      .orderBy(unidad.sku)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: sql<number>`count(*)::int` }).from(unidad).where(condicion),
  ]);

  return { ok: true, data: { items, total, page, perPage } };
}

interface VarianteParaSelector {
  id: string;
  etiqueta: string;
}

export async function listarVariantesParaSelector(): Promise<Resultado<VarianteParaSelector[]>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const filas = await db
    .select({
      id: variante.id,
      nombreArticulo: articulo.nombre,
      color: variante.color,
      talla: variante.talla,
    })
    .from(variante)
    .innerJoin(articulo, eq(variante.articuloId, articulo.id))
    .orderBy(articulo.nombre, variante.color, variante.talla);

  return {
    ok: true,
    data: filas.map((fila) => ({
      id: fila.id,
      etiqueta: `${fila.nombreArticulo} — ${fila.color}/${fila.talla}`,
    })),
  };
}

interface UnidadDisponibleParaVenta {
  id: string;
  sku: string;
  etiqueta: string;
  precioBaseCentavos: number;
}

export async function listarUnidadesDisponiblesParaVenta(): Promise<
  Resultado<UnidadDisponibleParaVenta[]>
> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const filas = await db
    .select({
      id: unidad.id,
      sku: unidad.sku,
      nombreArticulo: articulo.nombre,
      color: variante.color,
      talla: variante.talla,
      precioBaseCentavos: articulo.precioBaseCentavos,
    })
    .from(unidad)
    .innerJoin(variante, eq(unidad.varianteId, variante.id))
    .innerJoin(articulo, eq(variante.articuloId, articulo.id))
    .where(eq(unidad.estado, "disponible"))
    .orderBy(unidad.sku);

  return {
    ok: true,
    data: filas.map((fila) => ({
      id: fila.id,
      sku: fila.sku,
      etiqueta: `${fila.nombreArticulo} — ${fila.color}/${fila.talla}`,
      precioBaseCentavos: fila.precioBaseCentavos,
    })),
  };
}

const cambiarEstadoUnidadSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(estadoUnidad.enumValues),
});

export async function cambiarEstadoUnidad(
  input: z.infer<typeof cambiarEstadoUnidadSchema>,
): Promise<Resultado<typeof unidad.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = cambiarEstadoUnidadSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const { id, estado } = parsed.data;

  const [filaVentaUnidad] = await db
    .select({ unidadId: ventaUnidad.unidadId })
    .from(ventaUnidad)
    .where(eq(ventaUnidad.unidadId, id))
    .limit(1);

  if (estado === "disponible" && filaVentaUnidad) {
    return errorResultado(
      "UNIDAD_NO_DISPONIBLE",
      "Esta pieza ya pertenece a una venta y no puede volver a disponible.",
    );
  }

  const [actualizada] = await db
    .update(unidad)
    .set({ estado, actualizadoEn: new Date() })
    .where(and(eq(unidad.id, id)))
    .returning();

  if (!actualizada) return errorResultado("NOT_FOUND", "La unidad no existe.");

  return { ok: true, data: actualizada };
}

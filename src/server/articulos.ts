import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { articulo, variante } from "@/lib/db/schema";
import { ERROR_NO_AUTENTICADO, errorResultado, type Resultado } from "@/lib/resultado";

const VARIANTE_DUPLICADA = "variante_articulo_color_talla_unique";

function esViolacionUnicidad(error: unknown, restriccion: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const conCodigo = error as { code?: unknown; message?: unknown; cause?: unknown };
  const causa = conCodigo.cause as { code?: unknown; message?: unknown } | undefined;
  const codigo = conCodigo.code ?? causa?.code;
  // El mensaje que realmente nombra la constraint es el de la causa (el error del
  // driver de Postgres); el mensaje externo de drizzle es solo "Failed query: …".
  const mensaje = `${String(causa?.message ?? "")} ${String(conCodigo.message ?? "")}`;

  return codigo === "23505" && (mensaje.includes(restriccion) || mensaje.includes("duplicate key"));
}

function esViolacionRestrict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const conCodigo = error as { code?: unknown; cause?: unknown };
  const causa = conCodigo.cause as { code?: unknown } | undefined;

  return (conCodigo.code ?? causa?.code) === "23503";
}

const crearArticuloSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  categoria: z.string().trim().min(1, "La categoría es obligatoria."),
  descripcion: z.string().trim().optional(),
  precioBaseCentavos: z.number().int().min(0, "El precio no puede ser negativo."),
});

export type CrearArticuloInput = z.infer<typeof crearArticuloSchema>;

const editarArticuloSchema = crearArticuloSchema.partial();

export type EditarArticuloInput = z.infer<typeof editarArticuloSchema>;

const crearVarianteSchema = z.object({
  articuloId: z.string().uuid(),
  color: z.string().trim().min(1, "El color es obligatorio."),
  talla: z.string().trim().min(1, "La talla es obligatoria."),
});

export type CrearVarianteInput = z.infer<typeof crearVarianteSchema>;

const listarArticulosSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(25),
});

export type ListarArticulosInput = z.input<typeof listarArticulosSchema>;

interface ListaArticulos {
  items: (typeof articulo.$inferSelect)[];
  total: number;
  page: number;
  perPage: number;
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

export async function listarArticulos(
  input: ListarArticulosInput,
): Promise<Resultado<ListaArticulos>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = listarArticulosSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const { page, perPage } = parsed.data;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(articulo)
      .orderBy(articulo.nombre)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: sql<number>`count(*)::int` }).from(articulo),
  ]);

  return { ok: true, data: { items, total, page, perPage } };
}

export async function obtenerArticulo(
  id: string,
): Promise<Resultado<typeof articulo.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const [fila] = await db.select().from(articulo).where(eq(articulo.id, id)).limit(1);

  if (!fila) return errorResultado("NOT_FOUND", "El artículo no existe.");

  return { ok: true, data: fila };
}

export async function crearArticulo(
  input: CrearArticuloInput,
): Promise<Resultado<typeof articulo.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = crearArticuloSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const [creado] = await db.insert(articulo).values(parsed.data).returning();

  return { ok: true, data: creado };
}

export async function editarArticulo(
  id: string,
  input: EditarArticuloInput,
): Promise<Resultado<typeof articulo.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const parsed = editarArticuloSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const [actualizado] = await db
    .update(articulo)
    .set({ ...parsed.data, actualizadoEn: new Date() })
    .where(eq(articulo.id, id))
    .returning();

  if (!actualizado) return errorResultado("NOT_FOUND", "El artículo no existe.");

  return { ok: true, data: actualizado };
}

export async function desactivarArticulo(
  id: string,
): Promise<Resultado<typeof articulo.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const [actualizado] = await db
    .update(articulo)
    .set({ activo: false, actualizadoEn: new Date() })
    .where(eq(articulo.id, id))
    .returning();

  if (!actualizado) return errorResultado("NOT_FOUND", "El artículo no existe.");

  return { ok: true, data: actualizado };
}

export async function listarVariantesDeArticulo(
  articuloId: string,
): Promise<Resultado<(typeof variante.$inferSelect)[]>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(articuloId);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const filas = await db.select().from(variante).where(eq(variante.articuloId, articuloId));

  return { ok: true, data: filas };
}

export async function crearVariante(
  input: CrearVarianteInput,
): Promise<Resultado<typeof variante.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = crearVarianteSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  try {
    const [creada] = await db.insert(variante).values(parsed.data).returning();

    return { ok: true, data: creada };
  } catch (error: unknown) {
    if (esViolacionUnicidad(error, VARIANTE_DUPLICADA)) {
      return errorResultado("VALIDATION_ERROR", "Ya existe una variante con ese color y talla.", {
        talla: "Ya existe una variante con este color y talla para el artículo.",
      });
    }

    throw error;
  }
}

export async function eliminarVariante(id: string): Promise<Resultado<{ id: string }>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  try {
    const [eliminada] = await db
      .delete(variante)
      .where(eq(variante.id, id))
      .returning({ id: variante.id });

    if (!eliminada) return errorResultado("NOT_FOUND", "La variante no existe.");

    return { ok: true, data: eliminada };
  } catch (error: unknown) {
    if (esViolacionRestrict(error)) {
      return errorResultado(
        "VALIDATION_ERROR",
        "No se puede eliminar una variante con unidades asociadas.",
      );
    }

    throw error;
  }
}

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { cliente, pago, venta } from "@/lib/db/schema";
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

function esViolacionRestrict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const conCodigo = error as { code?: unknown; cause?: unknown };
  const causa = conCodigo.cause as { code?: unknown } | undefined;

  return (conCodigo.code ?? causa?.code) === "23503";
}

const crearClienteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  telefono: z.string().trim().min(1, "El teléfono es obligatorio."),
  direccion: z.string().trim().optional(),
});

export type CrearClienteInput = z.infer<typeof crearClienteSchema>;

const editarClienteSchema = crearClienteSchema.partial();

export type EditarClienteInput = z.infer<typeof editarClienteSchema>;

const listarClientesSchema = z.object({
  soloActivos: z.boolean().default(true),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(25),
});

export type ListarClientesInput = z.input<typeof listarClientesSchema>;

interface ListaClientes {
  items: (typeof cliente.$inferSelect)[];
  total: number;
  page: number;
  perPage: number;
}

export async function listarClientes(
  input: ListarClientesInput,
): Promise<Resultado<ListaClientes>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = listarClientesSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const { soloActivos, page, perPage } = parsed.data;
  const condicion = soloActivos ? eq(cliente.activo, true) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(cliente)
      .where(condicion)
      .orderBy(cliente.nombre)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: sql<number>`count(*)::int` }).from(cliente).where(condicion),
  ]);

  return { ok: true, data: { items, total, page, perPage } };
}

export async function obtenerCliente(id: string): Promise<Resultado<typeof cliente.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const [fila] = await db.select().from(cliente).where(eq(cliente.id, id)).limit(1);

  if (!fila) return errorResultado("NOT_FOUND", "El cliente no existe.");

  return { ok: true, data: fila };
}

export async function crearCliente(
  input: CrearClienteInput,
): Promise<Resultado<typeof cliente.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = crearClienteSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const [creado] = await db.insert(cliente).values(parsed.data).returning();

  return { ok: true, data: creado };
}

export async function editarCliente(
  id: string,
  input: EditarClienteInput,
): Promise<Resultado<typeof cliente.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const parsed = editarClienteSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const [actualizado] = await db
    .update(cliente)
    .set({ ...parsed.data, actualizadoEn: new Date() })
    .where(eq(cliente.id, id))
    .returning();

  if (!actualizado) return errorResultado("NOT_FOUND", "El cliente no existe.");

  return { ok: true, data: actualizado };
}

export async function desactivarCliente(
  id: string,
): Promise<Resultado<typeof cliente.$inferSelect>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const [actualizado] = await db
    .update(cliente)
    .set({ activo: false, actualizadoEn: new Date() })
    .where(eq(cliente.id, id))
    .returning();

  if (!actualizado) return errorResultado("NOT_FOUND", "El cliente no existe.");

  return { ok: true, data: actualizado };
}

export async function eliminarCliente(id: string): Promise<Resultado<{ id: string }>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const [ventaExistente] = await db
    .select({ id: venta.id })
    .from(venta)
    .where(eq(venta.clienteId, id))
    .limit(1);

  if (ventaExistente) {
    return errorResultado(
      "CLIENTE_CON_VENTAS",
      "No se puede eliminar un cliente que tiene ventas asociadas.",
    );
  }

  try {
    const [eliminado] = await db.delete(cliente).where(eq(cliente.id, id)).returning({
      id: cliente.id,
    });

    if (!eliminado) return errorResultado("NOT_FOUND", "El cliente no existe.");

    return { ok: true, data: eliminado };
  } catch (error: unknown) {
    if (esViolacionRestrict(error)) {
      return errorResultado(
        "CLIENTE_CON_VENTAS",
        "No se puede eliminar un cliente que tiene ventas asociadas.",
      );
    }

    throw error;
  }
}

export async function saldoDeCliente(id: string): Promise<Resultado<number>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const [{ totalVentas }] = await db
    .select({ totalVentas: sql<number>`coalesce(sum(${venta.montoTotalCentavos}), 0)::int` })
    .from(venta)
    .where(and(eq(venta.clienteId, id)));

  const [{ totalPagos }] = await db
    .select({ totalPagos: sql<number>`coalesce(sum(${pago.montoCentavos}), 0)::int` })
    .from(pago)
    .innerJoin(venta, eq(pago.ventaId, venta.id))
    .where(eq(venta.clienteId, id));

  return { ok: true, data: totalVentas - totalPagos };
}

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { pago, venta } from "@/lib/db/schema";
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

class ErrorDeDominio extends Error {
  constructor(public resultado: Resultado<never>) {
    super(resultado.ok ? "" : resultado.error.mensaje);
  }
}

const registrarPagoSchema = z.object({
  ventaId: z.string().uuid(),
  montoCentavos: z.number().int().positive("El monto debe ser mayor que cero."),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta"]),
});

export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;

interface ResultadoRegistrarPago {
  pagoId: string;
  estadoVenta: "pendiente" | "parcial" | "pagada";
  saldoCentavos: number;
}

export async function registrarPago(
  input: RegistrarPagoInput,
): Promise<Resultado<ResultadoRegistrarPago>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsed = registrarPagoSchema.safeParse(input);
  if (!parsed.success) return validationErrorDeZod(parsed.error);

  const { ventaId, montoCentavos, metodo } = parsed.data;

  try {
    return await db.transaction(async (tx) => {
      const [filaVenta] = await tx.select().from(venta).where(eq(venta.id, ventaId)).for("update");

      if (!filaVenta) {
        throw new ErrorDeDominio(errorResultado("NOT_FOUND", "La venta no existe."));
      }

      const [{ pagado }] = await tx
        .select({ pagado: sql<number>`coalesce(sum(${pago.montoCentavos}), 0)::int` })
        .from(pago)
        .where(eq(pago.ventaId, ventaId));

      const saldo = filaVenta.montoTotalCentavos - pagado;

      if (montoCentavos > saldo) {
        throw new ErrorDeDominio(
          errorResultado(
            "PAGO_EXCEDE_SALDO",
            "El monto del pago supera el saldo pendiente de la venta.",
          ),
        );
      }

      const [pagoCreado] = await tx
        .insert(pago)
        .values({ ventaId, montoCentavos, metodo })
        .returning({ id: pago.id });

      const nuevoSaldo = saldo - montoCentavos;
      const nuevoEstado = nuevoSaldo <= 0 ? "pagada" : "parcial";

      await tx
        .update(venta)
        .set({ estado: nuevoEstado, actualizadoEn: new Date() })
        .where(eq(venta.id, ventaId));

      return {
        ok: true,
        data: { pagoId: pagoCreado.id, estadoVenta: nuevoEstado, saldoCentavos: nuevoSaldo },
      };
    });
  } catch (error: unknown) {
    if (error instanceof ErrorDeDominio) {
      return error.resultado;
    }

    throw error;
  }
}

export async function listarPagosDeVenta(
  ventaId: string,
): Promise<Resultado<(typeof pago.$inferSelect)[]>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(ventaId);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const filas = await db.select().from(pago).where(eq(pago.ventaId, ventaId)).orderBy(pago.fecha);

  return { ok: true, data: filas };
}

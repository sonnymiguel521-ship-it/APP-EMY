export type CodigoError =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "SKU_DUPLICADO"
  | "UNIDAD_NO_DISPONIBLE"
  | "PAGO_EXCEDE_SALDO"
  | "CLIENTE_CON_VENTAS"
  | "INTERNAL";

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: CodigoError; mensaje: string; campos?: Record<string, string> } };

export function errorResultado(
  code: CodigoError,
  mensaje: string,
  campos?: Record<string, string>,
): Resultado<never> {
  return { ok: false, error: { code, mensaje, campos } };
}

export const ERROR_NO_AUTENTICADO = errorResultado("UNAUTHENTICATED", "No hay una sesión válida.");

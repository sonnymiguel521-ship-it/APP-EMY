---
description: Contrato de los módulos de servidor y de las Server Actions
paths:
  - "src/server/**"
  - "src/app/**/actions.ts"
---

# Módulos de servidor y Server Actions

- **Toda función devuelve `Resultado<T>`**, nunca lanza para casos previstos:

  ```ts
  type Resultado<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: CodigoError; mensaje: string; campos?: Record<string, string> } };
  ```

- **Conjunto cerrado de códigos**, ninguno se inventa en tiempo de ejecución: `VALIDATION_ERROR`
  (422), `UNAUTHENTICATED` (401), `NOT_FOUND` (404), `SKU_DUPLICADO` (409), `UNIDAD_NO_DISPONIBLE`
  (409), `PAGO_EXCEDE_SALDO` (422), `CLIENTE_CON_VENTAS` (409), `INTERNAL` (500).
- **Cada función empieza comprobando la sesión con `getSesion()`** y devuelve `UNAUTHENTICATED` sin
  tocar la base si no hay. Un Server Action es un POST a su propia ruta: `proxy.ts` es navegación, no
  seguridad, y un `matcher` que excluya una ruta se salta su comprobación.
- **Valida en el borde con zod** antes de tocar la base. El esquema vive en el mismo módulo de
  `src/server/` que ejecuta la operación y los tipos se infieren con `z.infer`; nunca se declaran dos
  veces.
- **Las invariantes de dominio van dentro de una transacción**, con `select … for update` sobre las
  filas que se van a modificar:
  - `crearVenta` bloquea las unidades, verifica que **todas** están `disponible` y aborta entera con
    `UNIDAD_NO_DISPONIBLE` si una sola no lo está. Nunca se vende "lo que sí estaba".
  - `registrarPago` bloquea la venta, calcula el saldo y **rechaza** con `PAGO_EXCEDE_SALDO` el pago
    que lo supere. Truncar está prohibido: guardar un número distinto al tecleado destruye la
    confianza en el saldo.
- **Las violaciones de constraint se traducen, no se dejan escapar.** `23505` sobre
  `unidad_sku_unique` → reintento si el SKU era automático (máximo 3), `SKU_DUPLICADO` si era manual.
  La detección acepta `err.code === "23505"` o un mensaje con `unidad_sku_unique` o `duplicate key`:
  la forma exacta la decide el driver.
- **Los totales y los saldos se calculan en SQL**, en centavos enteros. Nunca sumando en JavaScript
  sobre valores ya formateados.
- **Paginación en SQL** con `limit`/`offset` (`per_page` por defecto 25, máximo 100). Nunca traer
  todas las filas y cortar el arreglo.
- Solo consultas parametrizadas de Drizzle. Está prohibido construir SQL concatenando cadenas.
- Un `actions.ts` solo exporta Server Actions (`"use server"`), delega en `src/server/` y llama
  `revalidatePath()` de las rutas afectadas. No contiene lógica de negocio.
- `src/server/**` nunca importa React ni nada de `src/components/`.
- Los errores se registran por código y mensaje propio; nunca se vuelca el objeto del driver, que
  puede contener la cadena de conexión.

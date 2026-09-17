---
description: Convenciones de esquema, migraciones, dinero y scripts de base de datos
paths:
  - "src/lib/db/**"
  - "drizzle/**"
  - "drizzle.config.ts"
  - "scripts/**"
---

# Base de datos y migraciones

- `src/lib/db/schema.ts` es la única fuente de verdad del esquema de dominio y
  `src/lib/db/auth-schema.ts` la de las tablas de better-auth. Cambia ahí y luego `pnpm db:generate`.
- **Nunca edites un archivo de `drizzle/` ni inventes su nombre.** Los nombra y los escribe
  drizzle-kit. Si el SQL generado no es el esperado, se corrige el TypeScript y se regenera.
- Toda tabla lleva `creado_en` y `actualizado_en` con `withTimezone: true` y `defaultNow()`.
- **El dinero se guarda como entero en centavos** en columnas `*_centavos`. Nunca `numeric`
  convertido a número, nunca float. El formateo vive solo en `src/lib/dinero.ts` y usa aritmética
  entera; `toLocaleString` está prohibido porque su salida depende del ICU del runtime.
- **La unicidad la impone la base de datos**: `unidad_sku_unique`,
  `variante_articulo_color_talla_unique` y `venta_unidad_unidad_unique`. Ningún `select` previo
  sustituye a una constraint: no protege de la escritura concurrente.
- Borrado en cascada solo donde el hijo carece de sentido sin el padre (`venta_unidad`, `pago` bajo
  `venta`; `session` y `account` bajo `user`). Todo lo demás es `restrict`: es la regla de negocio de
  "no se borra un cliente con ventas" impuesta por el motor.
- Las migraciones se aplican como paso explícito (`pnpm db:migrate`), jamás al arrancar la
  aplicación: dos instancias arrancando a la vez competirían por el mismo lock.
- Regla de producción: **expandir y después contraer**. Columna nueva nullable o con default primero;
  volverla `not null` o borrar la vieja va en un despliegue posterior.
- `drizzle.config.ts` usa rutas **relativas** (`./src/lib/db/schema.ts`), no el alias `@/`:
  drizzle-kit empaqueta su configuración con esbuild y no aplica los `paths` de tsconfig.
- Toda herramienta que se invoque fuera del framework carga el `.env` por su cuenta con
  `process.loadEnvFile()` protegido por `existsSync`. Nunca asumas que las variables ya están en el
  shell.
- Los scripts se ejecutan con `tsx` (`pnpm db:seed`, `pnpm db:reset`), nunca con `node archivo.ts`:
  Node resuelve el especificador literalmente y no encuentra el alias `@/`.
- `scripts/seed.ts` es idempotente: comprueba antes de insertar y correrlo dos veces deja las mismas
  filas. El usuario dueño se crea con `auth.api.signUpEmail`, nunca insertando un hash a mano.
- `scripts/reset-db.ts` trunca solo tablas de dominio, en orden de dependencia, y se niega a
  ejecutarse si la cadena de conexión contiene el fragmento de `PROD_DB_GUARD`.

---
name: agregar-migracion
description: Usa esto al añadir o cambiar una tabla, columna, enum, índice o constraint del esquema —
  "añadir columna", "nueva tabla", "cambiar el esquema", "agregar un índice", "poner un unique". Cubre
  editar el esquema Drizzle, generar la migración y aplicarla a desarrollo y a la rama de pruebas sin
  tocar el SQL a mano.
---

# Agregar una migración

## Cuándo usarlo

Cualquier cambio de forma en la base: tabla nueva, columna nueva, enum, índice, constraint única o
cambio de nulabilidad. También al corregir un esquema cuyo SQL generado no salió como se esperaba.

## Pasos

1. Edita `src/lib/db/schema.ts` (dominio) o `src/lib/db/auth-schema.ts` (auth). Nombres de columna en
   `snake_case` dentro de `pgTable`, propiedades en `camelCase`. Dinero siempre `integer` con sufijo
   `_centavos`. Timestamps con `withTimezone: true` y `defaultNow()`.
2. Si el cambio es una regla de negocio (no puede repetirse, no puede borrarse), exprésalo como
   **constraint**: `unique(...)` o `references(..., { onDelete: "restrict" })`. Una comprobación en
   la aplicación no sustituye a una constraint.
3. Genera el SQL: `pnpm db:generate`. **No abras el archivo resultante para editarlo** y no escribas
   su nombre en ningún sitio: lo elige drizzle-kit.
4. Léelo solo para confirmar que contiene lo que esperabas (la constraint, el índice, el default).
   Si no, corrige el TypeScript del paso 1 y vuelve a generar.
5. Aplica a desarrollo: `pnpm db:migrate`.
6. Aplica a la rama de pruebas: `pnpm db:migrate:test`. Si te lo saltas, la siguiente prueba de
   integración falla por una columna que existe en tu cabeza y no en la base de pruebas.
7. Si el cambio afecta a producción, recuerda la regla de expandir y contraer: columna nullable o con
   default ahora; `not null` o borrado de la vieja, en un despliegue posterior.

## Verify

```bash
pnpm db:migrate                     # expect: exit 0
pnpm db:migrate:test                # expect: exit 0
pnpm test tests/db/schema.test.ts   # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck                      # expect: exit 0
```

## No hagas

- No edites ni renombres nada dentro de `drizzle/`: la siguiente generación lo pisa.
- No apliques una migración destructiva en el mismo despliegue que el cambio de código.
- No ejecutes migraciones al arrancar la aplicación: dos instancias competirían por el lock.
- No uses `numeric` ni float para dinero: centavos enteros, siempre.

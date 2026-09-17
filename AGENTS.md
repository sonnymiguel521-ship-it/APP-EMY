# Inventario Tienda de Ropa — instrucciones para agentes

Sistema interno de inventario, ventas y clientes para una tienda física de ropa, operado por un solo
usuario. Cada pieza física tiene un SKU único impuesto por la base de datos.

## Commands

| Tarea | Comando |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Dev server | `pnpm dev` — http://localhost:3000 |
| Build | `pnpm build` · servir: `pnpm exec next start -p 3000` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Unit tests | `pnpm test` · un archivo: `pnpm test tests/server/ventas.test.ts` |
| E2E | `pnpm test:e2e` |
| Migrar desarrollo / pruebas | `pnpm db:migrate` · `pnpm db:migrate:test` |
| Semilla / reset | `pnpm db:seed` · `pnpm db:reset` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` debe pasar antes de marcar cualquier tarea como
hecha.

## Non-negotiable

1. **La unicidad del SKU la impone la base de datos.** Inserta y maneja la violación `23505`; nunca
   un `select` previo, que no protege de la escritura concurrente.
2. **Una venta es atómica.** Si una sola pieza no está `disponible`, se aborta entera con
   `UNIDAD_NO_DISPONIBLE`. Nunca se vende "lo que sí estaba".
3. **Un pago que excede el saldo se rechaza, jamás se trunca** (`PAGO_EXCEDE_SALDO`).
4. **El dinero son centavos enteros** y se formatea solo con `src/lib/dinero.ts`. `toLocaleString`
   está prohibido.
5. Nunca commitees secretos, `.env` ni salida de build.
6. Nunca edites a mano archivos generados (`drizzle/**`) ni marques una tarea como hecha con un
   comando de gate en rojo.

Arquitectura completa, fronteras de importación y tokens de diseño: ver `CLAUDE.md` en este mismo
directorio, que es la fuente de verdad.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Inventario Tienda de Ropa

Sistema interno de inventario, ventas y clientes para una tienda física de ropa, operado por un solo
usuario: el dueño. Cada pieza física tiene un SKU único.

## Commands

| Tarea | Comando |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Dev server | `pnpm dev` — http://localhost:3000 |
| Build | `pnpm build` · servir: `pnpm exec next start -p 3000` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Unit tests | `pnpm test` · un archivo: `pnpm test tests/server/ventas.test.ts` |
| E2E | `pnpm test:e2e` · un archivo: `pnpm test:e2e tests/e2e/a11y.spec.ts` |
| Generar migración | `pnpm db:generate` |
| Migrar desarrollo | `pnpm db:migrate` |
| Migrar rama de pruebas | `pnpm db:migrate:test` |
| Semilla | `pnpm db:seed` |
| Reset de dominio (antes del E2E) | `pnpm db:reset` |
| Inspeccionar la base | `pnpm db:studio` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` debe pasar antes de marcar cualquier tarea como
hecha.

La versión del runtime está fijada en `.nvmrc` y en `engines.node`. Las versiones de las dependencias
están en el lockfile — léelo, nunca adivines una.

Recuperar el acceso si se pierde la contraseña: cambiar `OWNER_PASSWORD` en `.env` y correr
`pnpm db:seed`, que actualiza la credencial del dueño. No hay recuperación por correo.

## Stack

Next.js App Router · TypeScript · Tailwind CSS v4 · primitivas shadcn copiadas al repo · Postgres en
Neon · Drizzle ORM · better-auth · Vercel.

## Architecture

**Recorrido de una petición.** Navegador → `src/app/(app)/ventas/nueva/page.tsx` (Server Component,
`force-dynamic`) → `src/server/ventas.ts` → `src/lib/db/index.ts` → Neon. Las mutaciones van por
Server Actions en `src/app/(app)/<recurso>/actions.ts`, nunca por un `fetch` desde el cliente. Los
únicos Route Handlers son `/api/health`, `/api/auth/[...all]`,
`/api/v1/exportaciones/inventario` y `/api/v1/ventas/[id]/recibo`.

**Fronteras.** Cruzar una en la dirección equivocada rompe el build:

| Capa | Puede importar de | Nunca debe |
|---|---|---|
| `src/app/**` | `components`, `server`, `lib` | Importar `lib/db/` directamente |
| `src/components/**` | `lib`, otros componentes | Importar `server/` o `db/` |
| `src/server/**` | `db`, `lib` | Importar React o algo de `components/` |
| `src/lib/db/**` | solo `lib/env.ts` | Importar `server/` |

**Dónde vive cada cosa.**

| Asunto | Fuente única de verdad |
|---|---|
| Esquema de la base | `src/lib/db/schema.ts` — cambia ahí y luego `pnpm db:generate` |
| Tablas de auth | `src/lib/db/auth-schema.ts` — `account` usa `provider_account_id` |
| Acceso a variables | `src/lib/env.ts` — validado con zod; nunca leas `process.env` en otro archivo |
| Sesión | `src/lib/auth.ts` — un solo `getSesion()`, usado en todas partes |
| Dinero | `src/lib/dinero.ts` — centavos enteros; `formatearDop(145000)` → `"1450.00"` |
| Tokens de diseño | `src/app/globals.css`, bloque `@theme` — sin hex ni px sueltos en componentes |
| Tipos compartidos | Inferidos del esquema y de los validadores zod (`z.infer`) |

## Code rules

1. **Un componente por archivo. Máximo 300 líneas.** Más largo significa que hay que dividirlo.
2. **Alias `@/` → `src/`, sin extensión.** Nada de `../../..`, nada de `./archivo.ts`. Los scripts se
   ejecutan con `tsx` (`pnpm db:seed`), nunca con `node archivo.ts`, que resolvería el especificador
   literalmente y fallaría. Única excepción: `drizzle.config.ts` usa rutas relativas
   (`./src/lib/db/schema.ts`) porque drizzle-kit empaqueta su config con esbuild y no aplica `paths`.
3. **Server-first.** Todo componente es Server Component salvo que necesite estado o eventos.
   `"use client"` va en la hoja, jamás en un `layout` ni en una `page`.
4. **Sin barrel files.** Importa del módulo fuente; los `index.ts` de reexportación crean ciclos.
5. **Valida en el borde.** Cada Server Action y cada route handler parsea su entrada con zod antes de
   tocar la base. Ningún dato sin validar llega a `src/server/`.
6. **Los errores se devuelven, no se lanzan:** `{ ok: true, data } | { ok: false, error: { code,
   mensaje, campos? } }`, con `code` del conjunto cerrado `VALIDATION_ERROR` · `UNAUTHENTICATED` ·
   `NOT_FOUND` · `SKU_DUPLICADO` · `UNIDAD_NO_DISPONIBLE` · `PAGO_EXCEDE_SALDO` ·
   `CLIENTE_CON_VENTAS` · `INTERNAL`.
7. **Cada Server Action vuelve a llamar `getSesion()`.** Es un POST a su propia ruta: `proxy.ts` es
   navegación, no seguridad.
8. **Ninguna dependencia nueva sin una razón en el mensaje del commit.** Busca primero en la
   biblioteca estándar y en lo ya instalado.

## Design system

Los tokens se definen una sola vez en el bloque `@theme` de `src/app/globals.css`. Los componentes
solo referencian nombres de token.

| Rol | Valor (claro) | Se usa para |
|---|---|---|
| Primary | `#1D4ED8` | Botón primario, enlaces, anillo de foco |
| Background | `#FFFFFF` | Fondo de página |
| Surface | `#F8FAFC` | Tarjetas, cabecera de tabla, diálogos |
| Border | `#E2E8F0` | Separadores decorativos |
| Border fuerte | `#64748B` | Contorno de inputs y controles (4.76:1) |
| Texto | `#0F172A` | Cuerpo |
| Texto atenuado | `#475569` | Secundario, cabecera de columna |
| Destructive | `#B91C1C` | Errores, eliminar, estado `vendida` |
| Success | `#15803D` | Confirmaciones, estado `disponible` |
| Warning | `#B45309` | Estados `pendiente` y `parcial` |

Oscuro: primary `#60A5FA` sobre fondo `#0B1220`, superficie `#111A2E`, texto `#E2E8F0`, atenuado
`#94A3B8`, destructive `#F87171`, success `#4ADE80`, warning `#FBBF24`, border `#1E293B`.

- **Tipografía:** Inter vía `next/font/google` (`display: "swap"`, variable `--font-sans`); cuerpo
  14px/20px; encabezados 600 en 20/24/32px; etiquetas 12px/16px; SKU y montos en la pila mono del
  sistema a 13px.
- **Escala:** 12 / 14 / 20 / 24 / 32 px.
- **Espaciado:** base 4px — 4, 8, 12, 16, 24, 32, 48, 64. Sin valores arbitrarios.
- **Radio:** 6px en inputs, botones e insignias; 10px en tarjetas y diálogos.
- **Elevación:** plano, solo bordes. Excepciones: `0 4px 12px rgb(15 23 42 / 0.12)` en popover y
  `0 12px 32px rgb(15 23 42 / 0.20)` en diálogo.
- **Movimiento:** 120ms hover/foco, 160ms diálogo, `cubic-bezier(0.2, 0, 0, 1)`. Solo `transform` y
  `opacity`. Respeta `prefers-reduced-motion`.
- **Layout:** ancho máximo 1280px; breakpoints 640 / 768 / 1024 / 1280; móvil primero — bajo 768px
  las tablas se apilan en tarjetas, nunca scroll horizontal. Objetivos táctiles de 24×24 px mínimo.
- Ninguna insignia de estado se distingue solo por color: todas llevan texto.

## Environment

| Variable | Requerida | Usada por | Origen |
|---|---|---|---|
| `DATABASE_URL` | sí | `src/lib/env.ts`, `drizzle.config.ts` | Neon → rama `main` → cadena del pooler |
| `TEST_DATABASE_URL` | sí | `tests/setup.ts`, `scripts/db-migrate-test.ts` | Neon → rama `test` → cadena del pooler |
| `BETTER_AUTH_SECRET` | sí | `src/lib/auth.ts` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | sí | `src/lib/auth.ts` | `http://localhost:3000` en local |
| `NEXT_PUBLIC_APP_URL` | sí | enlaces absolutos, `playwright.config.ts` | `http://localhost:3000` en local |
| `OWNER_EMAIL` | sí | `scripts/seed.ts` | Lo elige el dueño |
| `OWNER_PASSWORD` | sí | `scripts/seed.ts` | Lo elige el dueño, mínimo 12 caracteres |
| `DRIZZLE_DATABASE_URL` | no | `drizzle.config.ts` | La pone el comando, no el archivo `.env` |
| `PROD_DB_GUARD` | no | `scripts/reset-db.ts` | Nombre de la base de producción en Neon |
| `VERCEL_TOKEN` | solo despliegue | `vercel deploy` | Vercel → Account Settings → Tokens |

`.env.example` está commiteado y se mantiene sincronizado. Los `.env*` con valores reales, nunca.

## Rules

Convenciones diferidas — lee el archivo que corresponda antes de editar esa área:

| Archivo | Se aplica a |
|---|---|
| `.claude/rules/base-de-datos.md` | `src/lib/db/**`, `drizzle/**`, `drizzle.config.ts`, `scripts/**` |
| `.claude/rules/servidor.md` | `src/server/**`, `src/app/**/actions.ts` |
| `.claude/rules/interfaz.md` | `src/app/**`, `src/components/**` |

## Non-negotiable

1. **La unicidad del SKU la impone la base de datos.** Inserta y maneja la violación `23505`; nunca
   un `select` previo, que no protege de la escritura concurrente.
2. **Una venta es atómica.** Si una sola pieza no está `disponible`, se aborta entera con
   `UNIDAD_NO_DISPONIBLE`. Nunca se vende "lo que sí estaba".
3. **Un pago que excede el saldo se rechaza, jamás se trunca** (`PAGO_EXCEDE_SALDO`).
4. **El dinero son centavos enteros** y se formatea solo con `src/lib/dinero.ts`. `toLocaleString`
   está prohibido: su salida depende del ICU del runtime.
5. Nunca commitees secretos, `.env` ni salida de build.
6. Nunca edites a mano archivos generados (`drizzle/**`, `next-env.d.ts`) ni marques una tarea como
   hecha con un comando de gate en rojo.

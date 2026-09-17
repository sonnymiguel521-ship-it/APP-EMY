# Epic 01: Fundación

> Después de esta épica existe una base de datos Neon migrada con el esquema completo, una sesión de
> un solo usuario que protege todas las rutas, y el CRUD de artículos, variantes, unidades con SKU
> único y clientes.

| | |
|---|---|
| **Epic id** | `01-fundacion` |
| **Tasks** | `E1-T1` … `E1-T6` |
| **Depends on** | nada — empieza aquí |
| **Unlocks** | `02-ventas-y-entrega` |
| **Parallel with** | ninguna |

No necesitas ningún otro archivo para completar esta épica. Todo lo de abajo está repetido aquí a
propósito.

---

## Stack

Next.js App Router · TypeScript · Tailwind CSS v4 · Postgres en Neon · Drizzle ORM · better-auth ·
Vercel. Gestor de paquetes: `pnpm`. Runtime fijado en `.nvmrc` (24) y en `engines.node`. Las
versiones de las dependencias están en el lockfile — léelo, nunca adivines una.

| Tarea | Comando |
|---|---|
| Dev | `pnpm dev` — http://localhost:3000 |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` · autofix `pnpm format` |
| Test (un archivo) | `pnpm test tests/server/articulos.test.ts` |
| Test (todo) | `pnpm test` |
| Generar migración | `pnpm db:generate` |
| Aplicar migración (desarrollo) | `pnpm db:migrate` |
| Aplicar migración (rama de pruebas) | `pnpm db:migrate:test` |
| Semilla | `pnpm db:seed` |
| Build | `pnpm build` · servir: `pnpm exec next start -p 3000` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar cualquier tarea como hecha.

La base de datos es **Neon**, un servicio alojado: no hay contenedor que levantar. Antes de la primera
tarea, `.env` debe tener `DATABASE_URL` (rama `main`, cadena del *pooler*) y `TEST_DATABASE_URL`
(rama `test`). `tests/setup.ts` aborta si ambas coinciden: las pruebas nunca comparten base con
desarrollo. Ese archivo, `vitest.config.ts`, `playwright.config.ts` y `scripts/db-migrate-test.ts`
llegaron desde `workspace/` y ya están en la raíz — no los escribes tú.

## Subárbol de directorios

Solo lo que esta épica toca:

```
src/
  lib/
    env.ts                    # process.env con zod — NUEVO en E1-T1
    dinero.ts                 # centavos <-> texto DOP — NUEVO en E1-T1 (auxiliar de listados)
    auth.ts                   # betterAuth + getSesion() — NUEVO en E1-T2
    db/
      index.ts                # cliente Drizzle — NUEVO en E1-T1, editado en E1-T3
      auth-schema.ts          # tablas de better-auth — NUEVO en E1-T2
      schema.ts               # esquema de dominio — NUEVO en E1-T3
  app/
    api/health/route.ts       # NUEVO en E1-T1
    api/auth/[...all]/route.ts# NUEVO en E1-T2
    login/page.tsx            # NUEVO en E1-T2
    (app)/articulos/…         # NUEVO en E1-T4
    (app)/unidades/…          # NUEVO en E1-T5
    (app)/clientes/…          # NUEVO en E1-T6
  server/
    articulos.ts              # NUEVO en E1-T4
    unidades.ts               # NUEVO en E1-T5
    clientes.ts               # NUEVO en E1-T6
proxy.ts                      # protección de rutas — NUEVO en E1-T2 (NO middleware.ts)
drizzle.config.ts             # NUEVO en E1-T1
drizzle/                      # migraciones generadas — NUEVO en E1-T3
scripts/seed.ts               # NUEVO en E1-T3
tests/
  api/health.test.ts          # E1-T1
  db/schema.test.ts           # E1-T3
  server/articulos.test.ts    # E1-T4
  server/unidades.test.ts     # E1-T5
  server/clientes.test.ts     # E1-T6
```

Todo lo que esté fuera de este subárbol queda fuera de alcance. Si una tarea parece exigir editar un
archivo que no está listado, detente y repórtalo: la frontera de la épica está mal.

## Modelo de datos que se toca aquí

| Entidad | Campos que esta épica añade o lee | Notas |
|---|---|---|
| `articulo` | `id`, `nombre`, `categoria`, `descripcion`, `precio_base_centavos`, `activo`, timestamps | Índice por `nombre`. Se desactiva, no se borra |
| `variante` | `id`, `articulo_id`, `color`, `talla`, timestamps | **unique(`articulo_id`,`color`,`talla`)**; FK `restrict` |
| `unidad` | `id`, `variante_id`, `sku`, `sku_auto_generado`, `estado`, timestamps | **unique(`sku`)** — el requisito central. Índices por `estado` y `variante_id`. Enum `estado_unidad`: `disponible`/`vendida`/`reservada` |
| `cliente` | `id`, `nombre`, `telefono`, `direccion`, `fecha_registro`, `activo`, timestamps | FK desde `venta` con `restrict`: por eso no se puede borrar un cliente con ventas |
| `venta`, `venta_unidad`, `pago` | Se **crean** en E1-T3 pero los escribe la épica 02 | `venta_unidad` lleva PK compuesta y **unique(`unidad_id`)** |
| `user`, `session`, `account`, `verification` | Tablas de better-auth | `account` usa **`provider_account_id`** (renombrado en 1.7.0 desde `account_id`) |

Todo el dinero se guarda como **entero en centavos** (`*_centavos`). Nunca float, nunca `numeric`
convertido a número: la suma de pagos decide si una deuda está saldada.

## Contratos

**Consumidos** — ya existen, no los reconstruyas:

| De | Interfaz | Garantía |
|---|---|---|
| `workspace/` (ya copiado) | `vitest.config.ts`, `tests/setup.ts` | Alias `@/` → `src/`; las pruebas corren contra `TEST_DATABASE_URL` y abortan si coincide con `DATABASE_URL` |
| `workspace/` | `scripts/db-migrate-test.ts` | `pnpm db:migrate:test` aplica las migraciones a la rama de pruebas cargando `.env` por su cuenta |
| §10 Bootstrap | `package.json` scripts, `biome.json`, `tsconfig.json` | Los comandos de la tabla de arriba existen; `blueprints/` está excluido de lint, typecheck y pruebas |

**Producidos** — la épica 02 depende de estas firmas exactas. Cambiar una la rompe:

| Export | Firma | Usado por |
|---|---|---|
| `src/lib/db/index.ts` → `db` | cliente Drizzle con `schema` de dominio y auth, con transacciones interactivas | `02-ventas-y-entrega` |
| `src/lib/auth.ts` → `getSesion()` | `Promise<{ user: { id: string; email: string } } | null>` | toda acción de `02-ventas-y-entrega` |
| `src/lib/db/schema.ts` → `articulo`, `variante`, `unidad`, `cliente`, `venta`, `ventaUnidad`, `pago` | tablas Drizzle con las tres constraints únicas | `02-ventas-y-entrega` |
| `src/server/unidades.ts` → `crearUnidad`, `cambiarEstadoUnidad` | `Promise<Resultado<…>>` | `E2-T1` |
| `src/server/clientes.ts` → `saldoDeCliente(id)` | `Promise<number>` en centavos, 0 si no hay ventas | `E2-T3` |
| `src/lib/dinero.ts` → `formatearDop(centavos)` | `"1450.00"` por aritmética entera, sin `toLocaleString` | `E2-T4`, `E2-T5` |

Envolvente obligatoria de toda acción de servidor:

```ts
type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: CodigoError; mensaje: string; campos?: Record<string, string> } };
```

Códigos permitidos, conjunto cerrado: `VALIDATION_ERROR` (422), `UNAUTHENTICATED` (401),
`NOT_FOUND` (404), `SKU_DUPLICADO` (409), `UNIDAD_NO_DISPONIBLE` (409), `PAGO_EXCEDE_SALDO` (422),
`CLIENTE_CON_VENTAS` (409), `INTERNAL` (500).

## Convenciones que muerden en esta área

- **`proxy.ts`, no `middleware.ts`.** Next 16 renombró el archivo y la función exportada se llama
  `proxy`. Un `middleware.ts` no se ejecuta: no hay error, simplemente no protege nada.
- **El `proxy.ts` no es seguridad.** Un Server Action es un POST a la ruta que lo usa; cada acción
  vuelve a llamar `getSesion()` antes de tocar la base.
- **La unicidad del SKU la impone la base de datos.** Nunca un `select` previo: inserta y maneja la
  violación `23505`. Con SKU automático se reintenta (hasta 3 veces); con SKU manual se devuelve
  `SKU_DUPLICADO`.
- **Nunca edites un archivo de `drizzle/`.** Los nombra y los escribe `pnpm db:generate`. Si el SQL
  no es el esperado, se corrige `src/lib/db/schema.ts` y se regenera.
- **`src/lib/env.ts` importa `node:fs`**: jamás se importa desde un archivo `"use client"`.
- **Los scripts se ejecutan con `tsx`, nunca con `node archivo.ts`**: `tsx` resuelve el alias `@/`,
  Node desnudo resuelve el especificador literalmente y falla.
- **Paginación en SQL** (`limit`/`offset`), nunca cortando un arreglo en memoria.
- Cada archivo de prueba crea sus propios datos con sufijos `crypto.randomUUID()`: ninguna prueba
  depende del orden ni de los datos de otra.

Reglas completas del proyecto: `CLAUDE.md`. Reglas por área: `.claude/rules/base-de-datos.md`,
`.claude/rules/servidor.md`, `.claude/rules/interfaz.md`. Ambos están en la raíz del proyecto: el
builder los copió desde `workspace/` antes de la tarea uno.

---

## Tasks

En el mismo orden que `tasks.json`. Ese orden es el orden de construcción: trabaja de arriba abajo y
no reordenes por prioridad ni por lo que parezca rápido.

### `E1-T1` — Cliente de base de datos, env y /api/health

**Depends on:** nada · **Priority:** p0 — metadato para recortes de alcance, no un orden de ejecución

Conecta el proyecto con Neon y expone el primer endpoint servido. `src/lib/env.ts` carga `.env` con
`process.loadEnvFile()` si `DATABASE_URL` no está ya en el entorno y parsea con zod: `DATABASE_URL`
requerida, el resto opcional (cada variable la promueve el módulo que la consume, para no romper este
gate más adelante). `src/lib/db/index.ts` usa el `Pool` de `@neondatabase/serverless` con
`neonConfig.webSocketConstructor = ws` y `drizzle-orm/neon-serverless` — **no** el driver HTTP, que no
ofrece transacciones interactivas y las necesitan las ventas y los pagos. `drizzle.config.ts` usa
rutas relativas (`"./src/lib/db/schema.ts"`), no el alias `@/`, porque drizzle-kit empaqueta su
configuración con esbuild y no aplica los `paths` de tsconfig.

**Files**

- `src/lib/env.ts` — nuevo
- `src/lib/db/index.ts` — nuevo
- `drizzle.config.ts` — nuevo
- `src/app/api/health/route.ts` — nuevo
- `tests/api/health.test.ts` — nuevo

**Acceptance**

1. **WHEN** `pnpm install --frozen-lockfile` runs desde la raíz **THE SYSTEM SHALL** exit 0 sin modificar `pnpm-lock.yaml`.
2. **WHEN** `pnpm typecheck` y `pnpm lint` run **THE SYSTEM SHALL** exit 0 en ambos, sin errores ni advertencias.
3. **WHEN** se hace GET a `/api/health` contra el servidor construido **THE SYSTEM SHALL** responder 200 con un cuerpo que contiene `"ok":true`, tras ejecutar una consulta real contra Neon.
4. **WHEN** falta `DATABASE_URL` al importar `src/lib/env.ts` **THE SYSTEM SHALL** lanzar un error cuyo mensaje contiene `DATABASE_URL`, en lugar de fallar más tarde en la primera consulta.
5. **WHEN** `pnpm test tests/api/health.test.ts` runs **THE SYSTEM SHALL** exit 0 con 0 pruebas fallidas y 0 omitidas.

**Verify** — todos, en orden, desde la raíz del proyecto.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test tests/api/health.test.ts
pnpm build
pnpm exec next start -p 3000 & SRV=$!; sleep 12; code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health); body=$(curl -s http://localhost:3000/api/health); kill $SRV 2>/dev/null || true; test "$code" = 200 && printf '%s' "$body" | grep -q '"ok":true'
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T1: cliente de base de datos, env y health check"
git tag step-01-scaffold-db
```

### `E1-T2` — Auth de un solo usuario y proteccion de rutas

**Depends on:** `E1-T1` · **Priority:** p0

better-auth con correo y contraseña y **registro público deshabilitado**. Escribe
`src/lib/db/auth-schema.ts` con las cuatro tablas; antes, ejecuta `npx auth@latest generate` y
contrasta su salida: 1.7.5 renombró `Account.accountId` a `providerAccountId`. Si ese binario no
resuelve, el esquema de esta épica es la fuente de verdad y sigues sin él. `src/lib/auth.ts` lee
`BETTER_AUTH_SECRET` y `BETTER_AUTH_URL` y **lanza nombrando la variable si falta** — es este módulo,
no `env.ts`, quien las exige, para que el gate de `E1-T1` siga verde. Las tablas se migran en
`E1-T3`, así que ningún criterio de esta tarea ejecuta una consulta.

**Files**

- `src/lib/db/auth-schema.ts` — nuevo
- `src/lib/auth.ts` — nuevo
- `src/app/api/auth/[...all]/route.ts` — nuevo
- `src/app/login/page.tsx` — nuevo
- `proxy.ts` — nuevo (raíz del proyecto, **no** `middleware.ts`)

**Acceptance**

1. **WHEN** una petición sin sesión hace GET a `/ventas` **THE SYSTEM SHALL** responder 307 con una cabecera `Location` que contiene `/login`.
2. **WHEN** una petición sin sesión hace GET a `/login` **THE SYSTEM SHALL** responder 200.
3. **WHEN** una petición sin sesión hace GET a `/api/health` **THE SYSTEM SHALL** responder 200, porque el `matcher` de `proxy.ts` excluye esa ruta.
4. **WHEN** falta `BETTER_AUTH_SECRET` al importar `src/lib/auth.ts` **THE SYSTEM SHALL** lanzar un error cuyo mensaje contiene `BETTER_AUTH_SECRET`, en lugar de servir tráfico con sesiones sin firmar.
5. **WHEN** `src/lib/auth.ts` se inspecciona **THE SYSTEM SHALL** contener `disableSignUp: true`, de modo que no exista registro público.

**Verify**

```bash
pnpm typecheck
pnpm lint
pnpm build
grep -q "disableSignUp: true" src/lib/auth.ts
pnpm exec next start -p 3000 & SRV=$!; sleep 12; a=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ventas); loc=$(curl -s -o /dev/null -D - http://localhost:3000/ventas | grep -i '^location:'); b=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login); c=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health); kill $SRV 2>/dev/null || true; test "$a" = 307 && printf '%s' "$loc" | grep -q "/login" && test "$b" = 200 && test "$c" = 200
pnpm test tests/api/health.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T2: auth de un solo usuario y proteccion de rutas"
git tag step-02-auth
```

### `E1-T3` — Esquema de dominio, migraciones y semilla

**Depends on:** `E1-T2` · **Priority:** p0

Escribe el esquema de dominio completo con sus tres constraints únicas (`unidad_sku_unique`,
`variante_articulo_color_talla_unique`, `venta_unidad_unidad_unique`), amplía el cliente Drizzle con
`{ schema: { ...schema, ...authSchema } }`, genera y aplica las migraciones, y deja una semilla
idempotente. La semilla crea el usuario dueño con `auth.api.signUpEmail` (nunca insertando el hash a
mano) y **dos unidades de la misma variante con SKU distintos**, que es el caso que define el
producto. La prueba de esquema hace un `select` por cada tabla —aserción de propiedad, no de
conteo— y comprueba que un `sku` repetido lo rechaza la base.

**Files**

- `src/lib/db/schema.ts` — nuevo
- `src/lib/db/index.ts` — edición: pasar `schema` a `drizzle()`
- `drizzle/**` — generado por `pnpm db:generate`; **nunca se edita a mano ni se le inventa un nombre**
- `scripts/seed.ts` — nuevo
- `tests/db/schema.test.ts` — nuevo

**Acceptance**

1. **WHEN** `pnpm db:migrate` runs contra la base de desarrollo **THE SYSTEM SHALL** exit 0 y crear todas las tablas que §4 define.
2. **WHEN** se hace `select` sobre cada tabla que §4 define **THE SYSTEM SHALL** devolver un resultado sin error para todas ellas.
3. **WHEN** se insertan dos filas de `unidad` con el mismo valor de `sku` **THE SYSTEM SHALL** rechazar la segunda con una violación de unicidad de la base de datos y dejar exactamente una fila con ese `sku`.
4. **WHEN** `pnpm db:seed` runs dos veces seguidas **THE SYSTEM SHALL** exit 0 las dos veces y dejar el mismo número de filas en `articulo`, `variante`, `unidad` y `cliente`.
5. **WHEN** la semilla termina **THE SYSTEM SHALL** dejar dos filas de `unidad` con la misma `variante_id` y valores de `sku` distintos.

**Verify**

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:test
pnpm db:seed
pnpm db:seed
pnpm test tests/db/schema.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T3: esquema de dominio, migraciones y semilla"
git tag step-03-esquema
```

### `E1-T4` — CRUD de Articulo y Variante

**Depends on:** `E1-T3` · **Priority:** p0

Módulo de servidor con esquemas zod y las funciones de listado, alta, edición, desactivación y
gestión de variantes, todas devolviendo `Resultado<T>` y todas empezando con `getSesion()`. No existe
borrado de artículo: la FK de `variante` es `restrict` y la operación disponible es desactivar.
`crearVariante` captura la violación de `variante_articulo_color_talla_unique` y la traduce a
`VALIDATION_ERROR` marcando el campo `talla`, en vez de dejar escapar el error del driver.

**Files**

- `src/server/articulos.ts` — nuevo
- `src/app/(app)/articulos/actions.ts` — nuevo
- `src/app/(app)/articulos/page.tsx` — nuevo
- `src/app/(app)/articulos/[id]/page.tsx` — nuevo
- `tests/server/articulos.test.ts` — nuevo

**Acceptance**

1. **WHEN** `crearArticulo` recibe `nombre` vacío **THE SYSTEM SHALL** devolver `ok: false` con `error.code` igual a `VALIDATION_ERROR` y no insertar ninguna fila.
2. **WHEN** `crearVariante` recibe una combinación de `articulo_id`, `color` y `talla` que ya existe **THE SYSTEM SHALL** devolver `error.code` igual a `VALIDATION_ERROR` y dejar el número de variantes sin cambios.
3. **WHEN** `desactivarArticulo` se ejecuta sobre un artículo con variantes **THE SYSTEM SHALL** poner `activo` en `false` y mantener la fila y sus variantes consultables.
4. **WHEN** `listarArticulos` recibe `perPage` igual a 2 sobre un catálogo de al menos 3 artículos **THE SYSTEM SHALL** devolver exactamente 2 filas.
5. **WHEN** cualquier función de `src/server/articulos.ts` se invoca sin sesión **THE SYSTEM SHALL** devolver `error.code` igual a `UNAUTHENTICATED` sin tocar la base de datos.

**Verify**

```bash
pnpm db:migrate:test
pnpm test tests/server/articulos.test.ts
pnpm typecheck
pnpm lint
pnpm build
pnpm test tests/db/schema.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T4: CRUD de articulo y variante"
git tag step-04-articulos
```

### `E1-T5` — CRUD de Unidad y generacion de SKU

**Depends on:** `E1-T4` · **Priority:** p0

La tarea que justifica el sistema. El SKU automático es `SKU-` más 10 hexadecimales en mayúsculas
derivados de `crypto.randomUUID()`; el manual se usa tal cual con `sku_auto_generado = false`. El
`insert` va **sin comprobación previa de existencia**: ante una violación `23505` de
`unidad_sku_unique` se reintenta hasta 3 veces si el SKU era automático y se devuelve
`SKU_DUPLICADO` si era manual. Detecta el choque aceptando tanto `err.code === "23505"` como un
mensaje que contenga `unidad_sku_unique` o `duplicate key`: la forma exacta la decide el driver.

**Files**

- `src/server/unidades.ts` — nuevo
- `src/app/(app)/unidades/actions.ts` — nuevo
- `src/app/(app)/unidades/page.tsx` — nuevo
- `tests/server/unidades.test.ts` — nuevo

**Acceptance**

1. **WHEN** se crean dos unidades con la misma `variante_id` y sin enviar `sku` **THE SYSTEM SHALL** insertar dos filas con valores de `sku` distintos y `sku_auto_generado` en `true`.
2. **WHEN** `crearUnidad` recibe un `sku` manual que ya existe **THE SYSTEM SHALL** devolver `error.code` igual a `SKU_DUPLICADO` y dejar exactamente una fila con ese `sku`.
3. **WHEN** `crearUnidad` recibe un `sku` manual nuevo **THE SYSTEM SHALL** insertar la fila con `sku_auto_generado` en `false`.
4. **WHEN** se crean 50 unidades seguidas sin enviar `sku` **THE SYSTEM SHALL** producir 50 valores de `sku` distintos entre sí.
5. **WHEN** `cambiarEstadoUnidad` intenta poner en `disponible` una unidad que ya pertenece a una venta **THE SYSTEM SHALL** devolver `error.code` igual a `UNIDAD_NO_DISPONIBLE` y no modificar la fila.

**Verify**

```bash
pnpm db:migrate:test
pnpm test tests/server/unidades.test.ts
pnpm typecheck
pnpm lint
pnpm build
pnpm test tests/server/articulos.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T5: CRUD de unidad y generacion de SKU"
git tag step-05-unidades
```

### `E1-T6` — CRUD de Cliente con bloqueo de borrado

**Depends on:** `E1-T3` · **Priority:** p0

Alta, edición, desactivación y borrado condicionado, más `saldoDeCliente(id)`, que calcula
`sum(venta.monto_total_centavos) - sum(pago.monto_centavos)` **en SQL** y devuelve 0 —no `null`—
cuando no hay ventas. `eliminarCliente` devuelve `CLIENTE_CON_VENTAS` si hay al menos una venta o
saldo mayor que 0, e indica que la operación disponible es desactivar. Para probar ese caso inserta
la venta mínima directamente con el cliente de base de datos: `crearVenta` llega en la épica 02 y
esta tarea no puede depender de ella.

**Files**

- `src/server/clientes.ts` — nuevo
- `src/app/(app)/clientes/actions.ts` — nuevo
- `src/app/(app)/clientes/page.tsx` — nuevo
- `tests/server/clientes.test.ts` — nuevo

**Acceptance**

1. **WHEN** `crearCliente` recibe `telefono` vacío **THE SYSTEM SHALL** devolver `error.code` igual a `VALIDATION_ERROR` y no insertar ninguna fila.
2. **WHEN** `eliminarCliente` se ejecuta sobre un cliente que tiene al menos una venta asociada **THE SYSTEM SHALL** devolver `error.code` igual a `CLIENTE_CON_VENTAS` y dejar la fila del cliente intacta.
3. **WHEN** `eliminarCliente` se ejecuta sobre un cliente sin ventas y sin deuda **THE SYSTEM SHALL** borrar la fila y hacer que `obtenerCliente` devuelva `NOT_FOUND`.
4. **WHEN** `desactivarCliente` se ejecuta **THE SYSTEM SHALL** poner `activo` en `false`, excluir al cliente del listado de activos y mantenerlo accesible por id.
5. **WHEN** `saldoDeCliente` se consulta para un cliente sin ventas **THE SYSTEM SHALL** devolver 0 centavos y no `null`.

**Verify**

```bash
pnpm db:migrate:test
pnpm test tests/server/clientes.test.ts
pnpm typecheck
pnpm lint
pnpm build
pnpm test tests/server/unidades.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T6: CRUD de cliente con bloqueo de borrado"
git tag step-06-clientes
```

---

## Epic acceptance

La épica está hecha cuando todas sus tareas están `done` **y**:

1. **WHEN** se crean dos unidades de la misma variante sin enviar `sku` y después se intenta una tercera con el `sku` de una de ellas **THE SYSTEM SHALL** tener dos filas con SKU distintos y rechazar la tercera con `SKU_DUPLICADO`.
2. **WHEN** una petición sin sesión intenta alcanzar cualquier ruta del grupo `(app)` **THE SYSTEM SHALL** redirigir con 307 a `/login` sin exponer ningún dato.

```bash
pnpm typecheck && pnpm lint && pnpm db:migrate:test && pnpm test
pnpm exec next start -p 3000 & SRV=$!; sleep 12; a=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/articulos); kill $SRV 2>/dev/null || true; test "$a" = 307
```

## Pitfalls

- **`middleware.ts` en lugar de `proxy.ts`** — Next 16 renombró el archivo. El antiguo no se ejecuta
  y no avisa: parece que la protección funciona hasta que alguien mira sin sesión.
- **Comprobar el SKU antes de insertar** — una consulta previa no impide el choque concurrente y da
  falsa seguridad. Inserta y maneja `23505`.
- **Editar el SQL de `drizzle/`** — se pierde en la siguiente generación. Corrige el esquema
  TypeScript y regenera.
- **Ejecutar un script con `node scripts/seed.ts`** — Node resuelve el especificador literalmente y
  no encuentra el alias `@/`. Usa `pnpm db:seed`, que pasa por `tsx`.
- **Importar `src/lib/env.ts` desde un componente cliente** — arrastra `node:fs` al bundle del
  navegador y rompe el build con un error que no menciona `env.ts`.
- **Dejar `TEST_DATABASE_URL` igual a `DATABASE_URL`** — `tests/setup.ts` aborta a propósito: las
  pruebas truncan y crean datos, y compartir base con desarrollo borra el trabajo del día.

## Before moving on

- [ ] Todas las tareas de esta épica están `done` en `tasks.json` — ninguna quedó `in_progress`.
- [ ] Todos los comandos `verify` de cada tarea pasaron, no solo el primero.
- [ ] No se editó ningún comando `verify` ni se saltó ninguno por un archivo inexistente.
- [ ] Cada tarea tiene su etiqueta de checkpoint: `git tag -l 'step-*'` lista `step-01-scaffold-db`,
      `step-02-auth`, `step-03-esquema`, `step-04-articulos`, `step-05-unidades`, `step-06-clientes`.
- [ ] El comando de gate pasa limpio desde la raíz del proyecto.
- [ ] Cada contrato "Producido" existe con la firma indicada.
- [ ] No se modificó ningún archivo fuera del subárbol.
- [ ] `.env.example` sigue sincronizado: esta épica no añadió variables nuevas a las de §10.
- [ ] Un commit por tarea, cada uno con el prefijo de su id y seguido de su etiqueta.

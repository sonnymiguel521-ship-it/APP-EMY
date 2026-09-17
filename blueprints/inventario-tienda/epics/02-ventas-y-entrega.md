# Epic 02: Ventas y entrega

> Después de esta épica el sistema vende: crea ventas atómicas, registra pagos parciales con saldo
> recalculado, muestra el perfil de deuda del cliente, exporta el inventario a CSV, emite el recibo
> en PDF, está desplegado en Vercel + Neon y tiene el flujo crítico cubierto de extremo a extremo.

| | |
|---|---|
| **Epic id** | `02-ventas-y-entrega` |
| **Tasks** | `E2-T1` … `E2-T7` |
| **Depends on** | `01-fundacion` |
| **Unlocks** | nada — es la última |
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
| Test (un archivo) | `pnpm test tests/server/ventas.test.ts` |
| Test (todo) | `pnpm test` |
| E2E | `pnpm test:e2e` |
| Aplicar migración (rama de pruebas) | `pnpm db:migrate:test` |
| Reset + semilla (antes del E2E) | `pnpm db:reset && pnpm db:seed` |
| Build | `pnpm build` · servir: `pnpm exec next start -p 3000` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar cualquier tarea como hecha.

La base de datos es **Neon**, un servicio alojado: no hay contenedor que levantar. `.env` ya tiene
`DATABASE_URL` (rama `main`) y `TEST_DATABASE_URL` (rama `test`) desde la épica anterior;
`tests/setup.ts` aborta si coinciden. Ese archivo, `vitest.config.ts`, `playwright.config.ts` y
`scripts/db-migrate-test.ts` llegaron desde `workspace/` y ya están en la raíz — no los escribes tú,
y nunca sustituyes la base real por un doble en una prueba cuyos criterios nombran la base.

## Subárbol de directorios

Solo lo que esta épica toca:

```
src/
  server/
    ventas.ts                 # creación atómica — NUEVO en E2-T1
    pagos.ts                  # abono y recálculo — NUEVO en E2-T2
    clientes-perfil.ts        # compras, pagos, saldo — NUEVO en E2-T3
    exportacion-csv.ts        # serializador CSV — NUEVO en E2-T4
    recibo-pdf.tsx            # documento PDF — NUEVO en E2-T5
    unidades.ts               # existe, solo lectura para esta épica
    clientes.ts               # existe, solo lectura (saldoDeCliente)
  app/
    (app)/ventas/page.tsx             # NUEVO en E2-T1
    (app)/ventas/nueva/page.tsx       # NUEVO en E2-T1
    (app)/ventas/actions.ts           # NUEVO en E2-T1
    (app)/ventas/[id]/page.tsx        # NUEVO en E2-T2
    (app)/ventas/[id]/actions.ts      # NUEVO en E2-T2
    (app)/clientes/[id]/page.tsx      # NUEVO en E2-T3
    api/v1/exportaciones/inventario/route.ts   # NUEVO en E2-T4
    api/v1/ventas/[id]/recibo/route.ts         # NUEVO en E2-T5
  lib/
    env.ts                    # existe, editado en E2-T6 (exigencias solo en producción)
    dinero.ts                 # existe, solo lectura
.github/workflows/ci.yml      # NUEVO en E2-T6
.env.example                  # existe, editado en E2-T6
next.config.ts                # existe, editado en E2-T6 (cabeceras de seguridad)
scripts/reset-db.ts           # NUEVO en E2-T7
tests/
  server/ventas.test.ts       # E2-T1
  server/pagos.test.ts        # E2-T2
  server/clientes-perfil.test.ts   # E2-T3
  server/exportacion-csv.test.ts   # E2-T4
  api/recibo.test.ts          # E2-T5
  e2e/auth.setup.ts           # E2-T7
  e2e/flujo-critico.spec.ts   # E2-T7
  e2e/a11y.spec.ts            # E2-T7
```

Todo lo que esté fuera de este subárbol queda fuera de alcance. Si una tarea parece exigir editar un
archivo que no está listado, detente y repórtalo.

## Modelo de datos que se toca aquí

| Entidad | Campos que esta épica añade o lee | Notas |
|---|---|---|
| `venta` | `id`, `cliente_id` (nullable), `fecha`, `monto_total_centavos`, `estado`, timestamps | Enum `estado_venta`: `pendiente`/`parcial`/`pagada`. FK a `cliente` con `restrict`. Índice por `cliente_id` |
| `venta_unidad` | `venta_id`, `unidad_id`, `precio_venta_centavos` | PK compuesta y **unique(`unidad_id`)**: una pieza física no puede estar en dos ventas |
| `pago` | `id`, `venta_id`, `monto_centavos`, `fecha`, `metodo`, `creado_en` | Enum `metodo_pago`: `efectivo`/`transferencia`/`tarjeta`. Solo se inserta, nunca se edita. Índice por `venta_id` |
| `unidad` | lee y escribe `estado` | Pasa a `vendida` dentro de la misma transacción que crea la venta |
| `cliente`, `articulo`, `variante` | solo lectura | Para el selector de venta, el perfil y el CSV |

Todo el dinero se guarda como **entero en centavos** (`*_centavos`). Nunca float, nunca
`toLocaleString`: `src/lib/dinero.ts` formatea por aritmética entera y es el único lugar que lo hace.

## Contratos

**Consumidos** — ya existen, no los reconstruyas:

| De | Interfaz | Garantía |
|---|---|---|
| `01-fundacion` | `src/lib/db/index.ts` → `db` | Cliente Drizzle con transacciones interactivas (`select … for update` funciona) |
| `01-fundacion` | `src/lib/auth.ts` → `getSesion()` | Devuelve la sesión o `null`; se llama dentro de cada acción, no solo en el `proxy.ts` |
| `01-fundacion` | `src/lib/db/schema.ts` | `venta`, `ventaUnidad`, `pago` ya están creados y migrados, con sus constraints |
| `01-fundacion` | `src/server/clientes.ts` → `saldoDeCliente(id)` | `Promise<number>` en centavos, 0 si no hay ventas |
| `01-fundacion` | `src/lib/dinero.ts` → `formatearDop(centavos)` | `"1450.00"` para 145000, por aritmética entera |

**Producidos** — nada depende de esta épica dentro del build, pero estas firmas son el contrato con
la interfaz y con el despliegue:

| Export | Firma | Usado por |
|---|---|---|
| `src/server/ventas.ts` → `crearVenta(input)` | `Promise<Resultado<{ ventaId: string; montoTotalCentavos: number }>>` | `E2-T2`, `E2-T7` |
| `src/server/pagos.ts` → `registrarPago(input)` | `Promise<Resultado<{ pagoId: string; estadoVenta: string; saldoCentavos: number }>>` | `E2-T3`, `E2-T7` |
| `src/server/exportacion-csv.ts` → `serializarCsv(filas)` | `string` cuya primera línea es la cabecera literal | `E2-T4` |

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

- **La venta es atómica o no es.** Bloquea las unidades con `select … for update` dentro de la
  transacción, comprueba el estado de todas, y solo entonces escribe. Si una sola pieza no está
  `disponible`, se aborta entera: no se vende "lo que sí estaba".
- **Un pago que excede el saldo se rechaza, nunca se trunca.** Guardar un número distinto al que
  tecleó el dueño destruye la confianza en el saldo, que es el producto entero.
- **El saldo se calcula en SQL, en centavos enteros.** Nunca sumando en JavaScript sobre valores ya
  formateados.
- **`toLocaleString` está prohibido** en CSV y PDF: su salida depende del ICU del runtime y el CSV se
  compara byte a byte.
- **Cada acción vuelve a llamar `getSesion()`.** Un Server Action es un POST a su propia ruta.
- **La cabecera CSV es literal y byte-exacta:** `sku,articulo,categoria,color,talla,estado,precio_base_dop`.
- **Los scripts se ejecutan con `tsx`**, nunca con `node archivo.ts`.
- Cada archivo de prueba crea sus propios datos con sufijos `crypto.randomUUID()`.

Reglas completas del proyecto: `CLAUDE.md`. Reglas por área: `.claude/rules/base-de-datos.md`,
`.claude/rules/servidor.md`, `.claude/rules/interfaz.md`, en la raíz del proyecto.

---

## Tasks

En el mismo orden que `tasks.json`. Ese orden es el orden de construcción: trabaja de arriba abajo y
no reordenes por prioridad ni por lo que parezca rápido.

### `E2-T1` — Creacion atomica de Venta

**Depends on:** `E1-T5`, `E1-T6` · **Priority:** p0 — metadato para recortes de alcance, no un orden
de ejecución

Una transacción: bloquear las unidades con `select … for update`, verificar que todas están
`disponible`, calcular el total como suma de los precios enviados, insertar la venta con estado
`pendiente`, insertar una fila de `venta_unidad` por línea y pasar todas las piezas a `vendida`. Si
alguna no está disponible, `UNIDAD_NO_DISPONIBLE` y rollback completo. `clienteId` es opcional: sin
él es venta de contado y no entra en ningún perfil. La página de alta precarga el precio desde
`precio_base_centavos` y lo deja editable por línea.

**Files**

- `src/server/ventas.ts` — nuevo
- `src/app/(app)/ventas/actions.ts` — nuevo
- `src/app/(app)/ventas/nueva/page.tsx` — nuevo
- `src/app/(app)/ventas/page.tsx` — nuevo
- `tests/server/ventas.test.ts` — nuevo

**Acceptance**

1. **WHEN** `crearVenta` recibe dos unidades disponibles **THE SYSTEM SHALL** crear una venta cuyo `monto_total_centavos` es la suma de los precios enviados y dejar ambas unidades en estado `vendida`.
2. **WHEN** `crearVenta` recibe una unidad disponible y otra que ya está `vendida` **THE SYSTEM SHALL** devolver `error.code` igual a `UNIDAD_NO_DISPONIBLE`, no crear ninguna venta y dejar la unidad disponible todavía en estado `disponible`.
3. **WHEN** `crearVenta` se ejecuta sin `clienteId` **THE SYSTEM SHALL** crear la venta con `cliente_id` nulo y estado `pendiente`.
4. **WHEN** se intenta incluir la misma unidad en una segunda venta **THE SYSTEM SHALL** rechazar la operación y dejar una sola fila de `venta_unidad` para esa unidad.
5. **WHEN** `crearVenta` recibe una lista de líneas vacía **THE SYSTEM SHALL** devolver `error.code` igual a `VALIDATION_ERROR` y no escribir nada.

**Verify** — todos, en orden, desde la raíz del proyecto.

```bash
pnpm db:migrate:test
pnpm test tests/server/ventas.test.ts
pnpm typecheck
pnpm lint
pnpm build
pnpm test tests/server/clientes.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T1: creacion atomica de venta"
git tag step-07-ventas
```

### `E2-T2` — Registro de Pago y recalculo de estado

**Depends on:** `E2-T1` · **Priority:** p0

Transacción con `select … for update` sobre la venta, cálculo de `saldo = monto_total_centavos -
sum(pagos)`, rechazo con `PAGO_EXCEDE_SALDO` si el monto lo supera, inserción del pago y recálculo
del estado: `pagada` si lo pagado alcanza el total, `parcial` si es mayor que 0, `pendiente` si es 0.
La página de detalle muestra líneas, pagos, saldo y el formulario de pago, más el enlace al recibo
que llegará en `E2-T5`.

**Files**

- `src/server/pagos.ts` — nuevo
- `src/app/(app)/ventas/[id]/page.tsx` — nuevo
- `src/app/(app)/ventas/[id]/actions.ts` — nuevo
- `tests/server/pagos.test.ts` — nuevo

**Acceptance**

1. **WHEN** se registra un pago menor que el total de la venta **THE SYSTEM SHALL** dejar la venta en estado `parcial` y devolver el saldo restante en centavos.
2. **WHEN** la suma de pagos alcanza el total de la venta **THE SYSTEM SHALL** dejar la venta en estado `pagada` y devolver saldo 0.
3. **WHEN** se registra un pago mayor que el saldo pendiente **THE SYSTEM SHALL** devolver `error.code` igual a `PAGO_EXCEDE_SALDO`, no insertar ninguna fila en `pago` y dejar el estado de la venta sin cambios.
4. **WHEN** se registra un pago con `montoCentavos` menor o igual a 0 **THE SYSTEM SHALL** devolver `error.code` igual a `VALIDATION_ERROR` y no escribir nada.
5. **WHEN** se registra un pago sobre una venta inexistente **THE SYSTEM SHALL** devolver `error.code` igual a `NOT_FOUND`.

**Verify**

```bash
pnpm db:migrate:test
pnpm test tests/server/pagos.test.ts
pnpm typecheck
pnpm lint
pnpm build
pnpm test tests/server/ventas.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T2: registro de pago y recalculo de estado"
git tag step-08-pagos
```

### `E2-T3` — Perfil de Cliente con saldo

**Depends on:** `E2-T2` · **Priority:** p0

`perfilDeCliente(id)` devuelve en una sola llamada los datos del cliente, sus ventas con el detalle
de unidades (SKU, artículo, variante, precio), sus pagos ordenados por fecha y el saldo actual en
centavos calculado en SQL. La página muestra las tres secciones con sus estados vacíos y destaca el
saldo con el color de estado correspondiente: ámbar si es mayor que 0, verde si es 0.

**Files**

- `src/server/clientes-perfil.ts` — nuevo
- `src/app/(app)/clientes/[id]/page.tsx` — nuevo
- `tests/server/clientes-perfil.test.ts` — nuevo

**Acceptance**

1. **WHEN** un cliente tiene dos ventas y un pago parcial **THE SYSTEM SHALL** devolver un saldo igual a la suma de los totales menos la suma de los pagos, en centavos enteros.
2. **WHEN** un cliente no tiene ventas **THE SYSTEM SHALL** devolver historial de compras vacío, historial de pagos vacío y saldo 0.
3. **WHEN** se consulta el perfil de un id inexistente **THE SYSTEM SHALL** devolver `error.code` igual a `NOT_FOUND`.
4. **WHEN** una venta del cliente está totalmente pagada **THE SYSTEM SHALL** mostrarla con estado `pagada` y no sumar nada al saldo.
5. **WHEN** el perfil incluye una venta **THE SYSTEM SHALL** listar el `sku` de cada unidad vendida en esa venta.

**Verify**

```bash
pnpm db:migrate:test
pnpm test tests/server/clientes-perfil.test.ts
pnpm typecheck
pnpm lint
pnpm build
pnpm test tests/server/pagos.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T3: perfil de cliente con saldo"
git tag step-09-perfil-cliente
```

### `E2-T4` — Exportacion CSV del inventario

**Depends on:** `E1-T5` · **Priority:** p1

`filasDeInventario()` hace el join `unidad` → `variante` → `articulo` ordenado por `sku`, y
`serializarCsv(filas)` produce la cabecera literal y una línea por unidad, con `\n`, comillas solo
cuando el valor contiene coma, comilla o salto, y la comilla interior duplicada. `precio_base_dop`
sale de `formatearDop`, por aritmética entera: `toLocaleString` está prohibido porque su salida
depende del ICU del runtime y esta cabecera se compara byte a byte.

**Files**

- `src/server/exportacion-csv.ts` — nuevo
- `src/app/api/v1/exportaciones/inventario/route.ts` — nuevo
- `tests/server/exportacion-csv.test.ts` — nuevo

**Acceptance**

1. **WHEN** `serializarCsv` produce la salida **THE SYSTEM SHALL** emitir como primera línea exactamente `sku,articulo,categoria,color,talla,estado,precio_base_dop`.
2. **WHEN** el inventario tiene N unidades **THE SYSTEM SHALL** emitir N líneas de datos además de la cabecera, una por unidad, ordenadas por `sku` ascendente.
3. **WHEN** el nombre de un artículo contiene una coma o una comilla doble **THE SYSTEM SHALL** entrecomillar ese campo y duplicar la comilla interior.
4. **WHEN** un artículo tiene `precio_base_centavos` igual a 145000 **THE SYSTEM SHALL** escribir `1450.00` en la columna `precio_base_dop`.
5. **WHEN** se hace GET a `/api/v1/exportaciones/inventario` sin sesión **THE SYSTEM SHALL** responder 401 con un cuerpo JSON cuyo `error.code` es `UNAUTHENTICATED`.

**Verify**

```bash
pnpm db:migrate:test
pnpm test tests/server/exportacion-csv.test.ts
pnpm typecheck
pnpm lint
pnpm build
pnpm test tests/server/clientes-perfil.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T4: exportacion CSV del inventario"
git tag step-10-export-csv
```

### `E2-T5` — Recibo de venta en PDF

**Depends on:** `E2-T2` · **Priority:** p1

**Primero instala y comprueba:** `pnpm add @react-pdf/renderer` y una prueba de humo que renderice un
documento mínimo a buffer bajo la versión de React del lockfile. Esa librería no está fijada con
versión verificada y su compatibilidad es el riesgo conocido de esta tarea; si la prueba de humo
falla, **detente y repórtalo** en vez de cambiar de librería por tu cuenta. Después, el documento:
encabezado con nombre de la tienda y fecha, datos del cliente o "Contado" si `cliente_id` es nulo,
una fila por unidad con SKU, artículo, variante y precio, total, pagos y saldo, todo formateado con
`formatearDop`.

**Files**

- `src/server/recibo-pdf.tsx` — nuevo
- `src/app/api/v1/ventas/[id]/recibo/route.ts` — nuevo
- `tests/api/recibo.test.ts` — nuevo

**Acceptance**

1. **WHEN** se hace GET a `/api/v1/ventas/[id]/recibo` con sesión y una venta existente **THE SYSTEM SHALL** responder 200 con `Content-Type: application/pdf` y un cuerpo cuyos primeros cinco bytes son `%PDF-`.
2. **WHEN** la venta no existe **THE SYSTEM SHALL** responder 404 con un cuerpo JSON cuyo `error.code` es `NOT_FOUND`.
3. **WHEN** la petición no tiene sesión **THE SYSTEM SHALL** responder 401 con un cuerpo JSON cuyo `error.code` es `UNAUTHENTICATED`.
4. **WHEN** la venta no tiene cliente asociado **THE SYSTEM SHALL** generar el PDF igualmente, sin lanzar, identificando la operación como contado.

**Verify**

```bash
pnpm db:migrate:test
pnpm test tests/api/recibo.test.ts
pnpm typecheck
pnpm lint
pnpm build
pnpm test tests/server/exportacion-csv.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T5: recibo de venta en PDF"
git tag step-11-recibo-pdf
```

### `E2-T6` — Despliegue a Vercel + Neon y CI

**Depends on:** `E2-T3`, `E2-T4`, `E2-T5` · **Priority:** p0

Edita `src/lib/env.ts` para exigir `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y `NEXT_PUBLIC_APP_URL`
**solo cuando `NODE_ENV === "production"`**: así ningún gate local anterior se rompe. Añade las
cabeceras de seguridad en `next.config.ts` (`Strict-Transport-Security`, `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, `Content-Security-Policy`). Escribe el workflow de CI con los
mismos comandos de la puerta global. Después: `vercel link --yes`, carga de variables con
`vercel env add`, migración de producción con `DRIZZLE_DATABASE_URL="$PROD_DATABASE_URL" pnpm
db:migrate` **antes** de desplegar, y `vercel deploy --prod --yes --token "$VERCEL_TOKEN"`. Exporta
la URL resultante en `PROD_URL` antes de correr el `Verify`.

**Files**

- `src/lib/env.ts` — edición: exigencias solo en producción
- `.env.example` — edición: todas las claves presentes con valor vacío
- `.github/workflows/ci.yml` — nuevo
- `next.config.ts` — edición: cabeceras de seguridad

**Acceptance**

1. **WHEN** `vercel deploy --prod` termina **THE SYSTEM SHALL** devolver una URL de producción que responde 200 en `/api/health` con un cuerpo que contiene `"ok":true`.
2. **WHEN** se hace GET a una ruta protegida de producción sin sesión **THE SYSTEM SHALL** responder 307 con `Location` conteniendo `/login`.
3. **WHEN** `NODE_ENV` es `production` y falta `BETTER_AUTH_SECRET` **THE SYSTEM SHALL** fallar al validar el entorno nombrando esa variable, en lugar de arrancar.
4. **WHEN** el workflow de CI corre sobre este commit **THE SYSTEM SHALL** ejecutar los mismos comandos de la puerta global de §20.1, sin omitir ninguno.
5. **WHEN** `pnpm build` runs en local tras el cambio de `src/lib/env.ts` **THE SYSTEM SHALL** exit 0 sin exigir las variables de producción.

**Verify**

```bash
pnpm typecheck
pnpm lint
pnpm build
grep -q "db:migrate:test" .github/workflows/ci.yml
code=$(curl -s -o /dev/null -w '%{http_code}' "$PROD_URL/api/health"); test "$code" = 200
printf '%s' "$(curl -s "$PROD_URL/api/health")" | grep -q '"ok":true'
prot=$(curl -s -o /dev/null -w '%{http_code}' "$PROD_URL/ventas"); test "$prot" = 307
pnpm test tests/api/recibo.test.ts
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T6: despliegue a vercel + neon y CI"
git tag step-12-deploy
```

### `E2-T7` — Suite E2E del flujo critico y accesibilidad

**Depends on:** `E2-T6` · **Priority:** p0

`scripts/reset-db.ts` trunca las tablas de dominio en orden (`pago`, `venta_unidad`, `venta`,
`unidad`, `variante`, `articulo`, `cliente`) **sin tocar las de auth**, y se niega a ejecutarse si la
URL contiene el fragmento de `PROD_DB_GUARD`. `auth.setup.ts` inicia sesión una vez y guarda el
`storageState`. El spec crítico recorre por interfaz: artículo → variante → **dos unidades de la
misma variante con SKU distinto** → cliente → venta con ambas → pago parcial → saldo correcto en el
perfil, e incluye el intento de pago excesivo. El spec de accesibilidad comprueba un solo `h1`, todo
input alcanzable por `getByLabel`, recorrido con `Tab` hasta la acción principal y el error de
formulario expuesto como texto con `role="alert"`.

**Files**

- `tests/e2e/auth.setup.ts` — nuevo
- `tests/e2e/flujo-critico.spec.ts` — nuevo
- `tests/e2e/a11y.spec.ts` — nuevo
- `scripts/reset-db.ts` — nuevo

**Acceptance**

1. **WHEN** la suite E2E crea dos unidades de la misma variante **THE SYSTEM SHALL** mostrar dos filas con SKU distintos en `/unidades`.
2. **WHEN** la suite registra una venta con esas dos unidades **THE SYSTEM SHALL** dejar ambas con estado `vendida` y la venta en estado `pendiente`.
3. **WHEN** la suite registra un pago parcial sobre esa venta **THE SYSTEM SHALL** mostrar la venta en estado `parcial` y el perfil del cliente con un saldo igual al total menos el pago.
4. **WHEN** la suite intenta registrar un pago mayor que el saldo **THE SYSTEM SHALL** mostrar el mensaje de error de `PAGO_EXCEDE_SALDO` y dejar el saldo sin cambios.
5. **WHEN** `pnpm test:e2e tests/e2e/a11y.spec.ts` runs **THE SYSTEM SHALL** exit 0 con 0 pruebas fallidas.

**Verify**

```bash
pnpm db:reset
pnpm db:seed
pnpm test:e2e
pnpm test:e2e tests/e2e/a11y.spec.ts
pnpm typecheck
pnpm db:migrate:test && pnpm test
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T7: suite e2e del flujo critico y accesibilidad"
git tag step-13-e2e
```

---

## Epic acceptance

La épica está hecha cuando todas sus tareas están `done` **y**:

1. **WHEN** se recorre el flujo completo por interfaz —artículo, variante, dos unidades con SKU distinto, cliente, venta y pago parcial— **THE SYSTEM SHALL** dejar la venta en estado `parcial` y el perfil del cliente con un saldo igual al total menos el pago.
2. **WHEN** se intenta registrar un pago mayor que el saldo pendiente **THE SYSTEM SHALL** rechazarlo con el mensaje de `PAGO_EXCEDE_SALDO` y dejar el saldo y el estado de la venta sin cambios.

```bash
pnpm typecheck && pnpm lint && pnpm db:migrate:test && pnpm test
pnpm db:reset && pnpm db:seed && pnpm test:e2e
```

## Pitfalls

- **Vender "lo que sí estaba disponible"** — si una pieza de la lista no está `disponible`, la venta
  entera se aborta. Una venta parcial silenciosa deja el inventario y el total descuadrados.
- **Truncar el pago excedente** — está explícitamente prohibido: se rechaza con
  `PAGO_EXCEDE_SALDO`. Guardar otro número destruye la confianza en el saldo.
- **Calcular el saldo en JavaScript** — se calcula en SQL, en centavos enteros. Sumar valores ya
  formateados introduce errores de redondeo en dinero.
- **`toLocaleString` en el CSV o el PDF** — su salida depende del ICU del runtime y la cabecera del
  CSV se compara byte a byte. Usa `formatearDop`.
- **Cambiar de librería de PDF por tu cuenta** — si la prueba de humo de `E2-T5` falla, se reporta.
  Esa decisión no es del builder.
- **Correr el E2E contra la base de pruebas** — el E2E usa la base de desarrollo, puesta en estado
  conocido con `pnpm db:reset && pnpm db:seed`. `pnpm db:migrate:test` es solo para las pruebas de
  Vitest.
- **Exigir las variables de producción en `env.ts` sin condicionar a `NODE_ENV`** — rompe el gate de
  todas las tareas anteriores en local, que es exactamente lo que `E2-T6` evita.

## Before moving on

- [ ] Todas las tareas de esta épica están `done` en `tasks.json` — ninguna quedó `in_progress`.
- [ ] Todos los comandos `verify` de cada tarea pasaron, no solo el primero.
- [ ] No se editó ningún comando `verify` ni se saltó ninguno por un archivo inexistente.
- [ ] Cada tarea tiene su etiqueta de checkpoint: `git tag -l 'step-*'` lista `step-07-ventas`,
      `step-08-pagos`, `step-09-perfil-cliente`, `step-10-export-csv`, `step-11-recibo-pdf`,
      `step-12-deploy`, `step-13-e2e`, además de las seis de la épica 01.
- [ ] El comando de gate pasa limpio desde la raíz del proyecto.
- [ ] Cada contrato "Producido" existe con la firma indicada.
- [ ] No se modificó ningún archivo fuera del subárbol.
- [ ] `.env.example` quedó actualizado en `E2-T6` con todas las claves, valores vacíos.
- [ ] Un commit por tarea, cada uno con el prefijo de su id y seguido de su etiqueta.

# Inventario Tienda de Ropa — Blueprint

> Generado por The Architect el 2026-09-16
> Shape: internal-tool · `knowledge/shapes/internal-tool.md`
> Runtime track: ts-node · `knowledge/runtime-tracks/ts-node.md`
> Modo de emisión: bundle (13 pasos ≥ 12)
> Versión del blueprint: 1
> Versiones verificadas por última vez: 2026-09-15 — procedencia por paquete en §11

---

## 1. Project Overview & Non-Goals

### Visión

Sistema interno de registro, inventario y clientes para una tienda física de ropa, operado por una
sola persona: el dueño. Sustituye el control manual en hoja de cálculo por una base de datos real
donde **cada unidad física tiene un código de referencia único (SKU)**, aunque comparta artículo,
color y talla con otras unidades del mismo perchero. Esa unicidad por pieza es el requisito central
del producto: es lo que permite decir "esta camisa, no aquella camisa idéntica" al venderla.

Sobre ese inventario se registran ventas y pagos. Una venta puede pagarse en varias partes y el
sistema lleva el saldo de deuda de cada cliente sin que nadie sume a mano. El acceso es por
navegador —computadora en la tienda y celular en la calle— con una sola cuenta protegida por
contraseña. No es una tienda en línea: no hay carrito, no hay checkout público y no se cobra nada
por internet; los pagos se **registran** después de ocurrir en el mostrador.

### Usuarios

| Persona | A qué entra | Frecuencia |
|---|---|---|
| Dueño de la tienda (único usuario) | Registrar artículos, variantes y unidades con SKU; vender; registrar pagos parciales; consultar saldo | Diaria, varias veces al día |
| Dueño desde el celular | Consultar si una pieza sigue disponible y cuánto debe un cliente, fuera del local | Diaria, consultas cortas |

### Goals — alcance v1

1. Catálogo de **Artículos** y sus **Variantes** (color + talla), con precio base por artículo.
2. **Unidades** individuales con SKU único a nivel de base de datos, autogenerado por defecto y
   sobrescribible manualmente, con estado `disponible`/`vendida`/`reservada`.
3. **Clientes** con teléfono y dirección, desactivables en lugar de borrables.
4. **Ventas** de una o más unidades disponibles, con cálculo del monto total y paso atómico de esas
   unidades a `vendida`.
5. **Pagos** parciales contra una venta, con recálculo automático del estado
   (`pendiente`/`parcial`/`pagada`) y rechazo de todo pago que exceda el saldo.
6. **Perfil de cliente** con historial de compras, historial de pagos y saldo de deuda actual.
7. **Exportación CSV** del inventario completo y **recibo de venta en PDF** descargable.
8. **Login de un solo usuario** (sin registro público) y uso real desde navegador móvil.

### Non-Goals — explícitamente fuera del alcance v1

| No se construye | Por qué no ahora | Revisar cuando |
|---|---|---|
| Facturación fiscal, RNC, NCF | Cambia el modelo de datos (secuencias fiscales, anulaciones inmutables) y obliga a reglas de la DGII que nadie especificó | El dueño deba emitir comprobante fiscal y tenga su secuencia asignada |
| Multiusuario, roles, permisos, SSO | Hay exactamente un operador; roles con un solo usuario es infraestructura que solo puede fallar | Se contrate una segunda persona con acceso |
| Código de barras / escáner físico | Exige hardware inexistente y un formato de etiqueta impreso | Se compre el lector y se defina la impresora |
| Notificaciones automáticas (email/SMS) | Añade proveedor, plantillas, consentimiento y costo por mensaje a un flujo que hoy se resuelve por WhatsApp | Haya más de ~30 clientes con deuda viva simultánea |
| Reportes programados por correo | Depende del punto anterior y de un scheduler; el CSV bajo demanda cubre el caso real | El mismo reporte se pida más de una vez por semana |
| Pagos electrónicos reales (pasarela) | Aquí un pago es el **registro** de algo ya cobrado en el mostrador, no una transacción | Se venda en línea — eso además cambiaría de shape |
| Integración con POS físico | No hay POS instalado y cada fabricante trae su protocolo | La tienda adquiera un POS con API documentada |

**El builder no debe implementar nada de esta tabla**, ni como "añadido pequeño" en un paso vecino.
Si un paso parece exigir un non-goal, es un defecto del blueprint: detente y repórtalo.

### Métricas de éxito

| Métrica | Objetivo | Cómo se mide |
|---|---|---|
| Inventario migrado de la hoja de cálculo | 100% de las piezas con SKU único al cierre de la primera semana | `select count(*) from unidad;` contra el conteo físico |
| Tiempo de registro de una venta | Menos de 60 s desde `/ventas/nueva` a venta creada | Cronómetro sobre `tests/e2e/flujo-critico.spec.ts` |
| Saldos correctos sin intervención | 0 discrepancias con `sum(venta.monto_total_centavos) - sum(pago.monto_centavos)` | Consulta de reconciliación mensual |
| Disponibilidad en horario de tienda | `/api/health` responde 200 en ≥ 99% de los sondeos | Monitor de uptime sobre `/api/health` |

---

## 2. Tech Stack

**Runtime track: ts-node.** Esta tabla nombra *elecciones*, no versiones: cada pin vive en §11 y en
ningún otro lugar de la prosa. Los pins vienen del informe de `stack-researcher` de esta sesión;
`knowledge/runtime-tracks/ts-node.md` es el respaldo y sus advertencias se arrastran literalmente.

| Capa | Elección | Por qué esta, frente a cuál |
|---|---|---|
| Lenguaje / runtime | TypeScript sobre Node.js | Un solo lenguaje del formulario a la consulta SQL. Frente a Python + Django admin: el valor está en reglas propias (SKU, saldo), no en un CRUD genérico |
| Framework | Next.js App Router | Server Components leen la base sin capa HTTP y Server Actions dan mutaciones tipadas. Frente a Vite + Hono: dos despliegues y un cliente de datos a mano para un usuario |
| Estilos | Tailwind CSS v4 | Densidad y tablas legibles sin CSS a mano, configuración en CSS (`@theme`). Frente a CSS Modules: cada tabla reinventaría su espaciado |
| Capa de componentes | shadcn CLI (copia primitivas al repo) | El código queda en el repo y se edita; no es una dependencia que pueda romper. Frente a MUI: peso y una estética que hay que pelear |
| Base de datos | Postgres serverless en Neon | Constraint `UNIQUE` real sobre `sku` —el corazón del producto— y transacciones. Frente a SQLite en disco: el hosting es serverless y se abre desde el celular |
| ORM | Drizzle ORM + drizzle-kit | El esquema TS es la fuente de verdad y el SQL se diferencia de él; las consultas se parecen a SQL, que es lo auditable aquí. Frente a Prisma: cliente generado pesado y segunda fuente de verdad |
| Auth | better-auth self-hosted, un usuario, sin SSO | Sesiones en nuestra propia base, sin costo por asiento ni dependencia de un tercero para abrir la caja. Frente a Clerk: precio y acoplamiento innecesarios |
| Trabajo en segundo plano | NOT APPLICABLE — ninguna operación de v1 excede una petición | CSV y PDF se generan en la propia petición; una cola sería infraestructura sin trabajo |
| Pagos | NOT APPLICABLE — no se procesan pagos electrónicos | Un `pago` es el registro de efectivo, transferencia o tarjeta ya cobrada |
| Almacenamiento de archivos | NOT APPLICABLE — no se suben archivos en v1 | CSV y PDF viajan en la respuesta; sin fotos de producto no hay nada que guardar |
| Email / notificaciones | NOT APPLICABLE — sin correo saliente en v1 | Es non-goal de §1; no se instala proveedor ni plantillas |
| Hosting | Vercel (app) + Neon (base) | Despliegue en minutos para este framework y ramas de base por entorno. Frente a un VPS: el dueño no administra servidores |
| Gestor de paquetes | pnpm | `node_modules` estricto: la dependencia fantasma falla aquí, no en producción |
| Lint + formato | Biome | Una herramienta y un archivo de configuración en lugar de ESLint + Prettier |
| Pruebas | Vitest + Playwright | Vitest corre los módulos de servidor contra la base real; Playwright cubre el flujo que el negocio no puede perder |
| PDF | @react-pdf/renderer | El recibo se describe con los mismos componentes del resto del código y se renderiza a buffer en el route handler, sin Chromium |

### Verificación de compatibilidad

Comprobado contra `knowledge/stack-compatibility.md`: no hay combinaciones conocidas-malas. Tres
guardas de esa lista aplican y este blueprint las resuelve explícitamente:

1. **At-rules CSS que el linter no parsea** — Biome 2.5.5 falla en el `@theme` de Tailwind v4 salvo
   con `css.parser.tailwindDirectives`. §10 escribe esa clave en `biome.json` **antes** del primer
   `lint`.
2. **URL serverless sin pooler** — `DATABASE_URL` de tiempo de ejecución apunta al host *pooler* de
   Neon; el host directo solo se usaría en migración. Está dicho en la tabla de §10.
3. **Toolchain sin pinear** — `packageManager` en `package.json` y `.nvmrc` con `24`, escritos en §10.

Una sola identidad, un solo paradigma de estilos y un solo sistema de migraciones: las demás guardas
pasan por construcción.

---

## 3. Directory Structure

```
inventario-tienda/
  .claude/
    settings.json                 # permisos pre-aprobados (§19.3) — llega desde workspace/
    rules/base-de-datos.md        # convenciones de esquema y migraciones (§19.5)
    rules/servidor.md             # reglas de Server Actions y módulos de servidor (§19.5)
    rules/interfaz.md             # reglas de páginas y componentes (§19.5)
    skills/agregar-migracion/SKILL.md      # (§19.4)
    skills/agregar-recurso-crud/SKILL.md   # (§19.4)
  .github/workflows/ci.yml        # pipeline = §20.1 (creado en el paso 12)
  blueprints/inventario-tienda/   # ESTE bundle; excluido de biome, tsc, vitest y playwright
  drizzle/                        # migraciones SQL generadas por drizzle-kit, commiteadas
  public/                         # estáticos del scaffold
  scripts/
    seed.ts                       # datos mínimos + usuario dueño (paso 3)
    reset-db.ts                   # trunca tablas de dominio antes del E2E (paso 13)
    db-migrate-test.ts            # migra la rama de pruebas (llega desde workspace/, §19.6)
  src/
    app/
      layout.tsx                  # raíz: fuente, tokens, <html lang="es">
      login/page.tsx              # única ruta pública además de /api/health (paso 2)
      (app)/layout.tsx            # shell autenticado: navegación lateral + encabezado
      (app)/page.tsx              # panel: disponibles, ventas del día, deuda total
      (app)/articulos/page.tsx    # listado + alta (paso 4)
      (app)/articulos/[id]/page.tsx        # detalle + variantes (paso 4)
      (app)/articulos/actions.ts  # Server Actions de artículo y variante (paso 4)
      (app)/unidades/page.tsx     # listado, alta y cambio de estado (paso 5)
      (app)/unidades/actions.ts   # Server Actions de unidad/SKU (paso 5)
      (app)/clientes/page.tsx     # listado, alta, desactivación (paso 6)
      (app)/clientes/actions.ts   # Server Actions de cliente (paso 6)
      (app)/clientes/[id]/page.tsx         # perfil: compras, pagos, saldo (paso 9)
      (app)/ventas/page.tsx       # listado de ventas (paso 7)
      (app)/ventas/nueva/page.tsx # alta de venta (paso 7)
      (app)/ventas/actions.ts     # Server Action crearVenta (paso 7)
      (app)/ventas/[id]/page.tsx  # detalle + registro de pago (paso 8)
      (app)/ventas/[id]/actions.ts# Server Action registrarPago (paso 8)
      api/health/route.ts         # 200 + consulta real a Neon (paso 1) — pública
      api/auth/[...all]/route.ts  # handler de better-auth (paso 2)
      api/v1/exportaciones/inventario/route.ts   # CSV del inventario (paso 10)
      api/v1/ventas/[id]/recibo/route.ts         # PDF del recibo (paso 11)
    components/
      ui/                         # primitivas copiadas por shadcn; se editan libremente
      tabla-densa.tsx             # tabla compartida: cabecera fija, filas de 32px
      ventas/formulario-venta.tsx # selección de piezas y precios (paso 7)
      pagos/formulario-pago.tsx   # monto + método (paso 8)
    lib/
      env.ts                      # process.env parseado con zod — único acceso a variables
      dinero.ts                   # centavos <-> texto DOP, aritmética entera
      auth.ts                     # instancia better-auth + getSesion() (paso 2)
      db/index.ts                 # cliente Drizzle exportado (paso 1, ampliado en paso 3)
      db/schema.ts                # esquema de dominio (paso 3)
      db/auth-schema.ts           # tablas de better-auth (paso 2)
    server/
      articulos.ts                # consultas y reglas de artículo/variante (paso 4)
      unidades.ts                 # generación de SKU y transiciones de estado (paso 5)
      clientes.ts                 # alta, edición, desactivación, saldo (paso 6)
      clientes-perfil.ts          # compras, pagos y saldo de un cliente (paso 9)
      ventas.ts                   # creación atómica de venta (paso 7)
      pagos.ts                    # registro de pago y recálculo de estado (paso 8)
      exportacion-csv.ts          # serializador CSV del inventario (paso 10)
      recibo-pdf.tsx              # documento PDF del recibo (paso 11)
  tests/
    setup.ts                      # carga .env y apunta a TEST_DATABASE_URL (§19.6)
    api/health.test.ts            # paso 1
    api/recibo.test.ts            # paso 11
    db/schema.test.ts             # paso 3
    server/articulos.test.ts      # paso 4
    server/unidades.test.ts       # paso 5
    server/clientes.test.ts       # paso 6
    server/ventas.test.ts         # paso 7
    server/pagos.test.ts          # paso 8
    server/clientes-perfil.test.ts# paso 9
    server/exportacion-csv.test.ts# paso 10
    e2e/auth.setup.ts             # inicia sesión una vez y guarda storageState (paso 13)
    e2e/flujo-critico.spec.ts     # artículo -> 2 SKU -> cliente -> venta -> pago (paso 13)
    e2e/a11y.spec.ts              # teclado, etiquetas, un solo h1 por página (paso 13)
  .env.example                    # todas las claves, valores en blanco (§19.6, commiteado)
  .gitignore                      # del scaffold + excepción !.env.example (§10)
  .nvmrc                          # 24
  biome.json                      # escrito completo por §10 Bootstrap
  drizzle.config.ts               # configuración de drizzle-kit (paso 1)
  next.config.ts                  # del scaffold
  package.json                    # del scaffold + scripts añadidos por §10
  playwright.config.ts            # llega desde workspace/ (§19.6)
  postcss.config.mjs              # del scaffold (@tailwindcss/postcss)
  proxy.ts                        # protección de rutas (paso 2) — NO middleware.ts
  tsconfig.json                   # del scaffold + exclusión de blueprints/ (§10)
  vitest.config.ts                # llega desde workspace/ (§19.6)
  CLAUDE.md                       # llega desde workspace/ (§19.1)
  AGENTS.md                       # llega desde workspace/ (§19.2)
```

**Reglas de frontera**

- `src/app/**` importa de `components`, `server` y `lib`. **Nunca** de `src/lib/db/`: toda lectura y
  escritura pasa por un módulo de `src/server/`.
- `src/components/**` importa de `lib` y de otros componentes. Nunca de `server/` ni de `db/`.
- `src/server/**` importa de `db` y de `lib`. Nunca importa React ni nada de `components/`.
- `src/lib/db/**` no importa nada interno salvo `lib/env.ts`.
- `src/lib/env.ts` usa `node:fs`: **jamás** puede importarse desde un archivo `"use client"`.
- Un `actions.ts` solo exporta Server Actions (`"use server"`), y cada una vuelve a comprobar la
  sesión: un Server Action es un POST a su propia ruta y no hereda garantías del `proxy.ts`.

**Convención de resolución de módulos:** alias `@/` hacia `src/`, especificadores **sin extensión**,
y nunca `node archivo.ts` a secas. Declarada una sola vez y reconciliada contra los cuatro
cargadores en §19.6, *Resolution convention matrix*.

**Cada ruta dibujada aquí es un valor que además aparece en algún archivo emitido** (alias del
compilador, alias de Vitest, `testDir` de Playwright, `out` de drizzle-kit). La cadena literal la
decide la tabla *Cross-artifact value reconciliation* de §19.6; este árbol la copia.

**Dibujar un archivo aquí no lo crea.** Cada uno tiene un origen: lo escribe un paso de §9 (y figura
en su **Do** y en el `files` de su tarea) o se emite bajo `workspace/` (§19.6) y llega con la copia
guardada de §10. Los marcados "llega desde workspace/" son del segundo tipo.

---

## 4. Data Model

Todo el dinero se guarda como **entero en centavos** (`*_centavos`), nunca float ni `numeric`
convertido a número en JavaScript: la suma de pagos decide si una deuda está saldada y en coma
flotante eso no es exacto. La conversión a texto vive en `src/lib/dinero.ts` con aritmética entera
(`Math.trunc`, relleno de ceros), nunca `toLocaleString`, cuya salida depende del ICU del runtime.

### Entidades

**`articulo`** — el modelo de prenda del catálogo. Se desactiva, no se borra.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK, `defaultRandom()` | |
| `nombre` | text | not null | "Camisa lino manga larga" |
| `categoria` | text | not null | Texto acordado por el dueño: "Camisas", "Pantalones" |
| `descripcion` | text | nullable | Detalle opcional que sale en el recibo |
| `precio_base_centavos` | integer | not null | Precio de lista; la venta puede fijar otro por unidad |
| `activo` | boolean | not null, default `true` | Desactivación en vez de borrado |
| `creado_en` / `actualizado_en` | timestamptz | not null, default `now()` | |

**`variante`** — combinación color + talla de un artículo. No tiene stock: el stock son unidades.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `articulo_id` | uuid | FK → `articulo.id`, on delete restrict, not null | |
| `color` | text | not null | |
| `talla` | text | not null | "S", "M", "38" — texto, no enum: cada categoría usa su escala |
| `creado_en` / `actualizado_en` | timestamptz | not null, default `now()` | |
| — | — | **unique (`articulo_id`,`color`,`talla`)** | Impide duplicar la combinación |

**`unidad`** — **una pieza física concreta**; dos camisas idénticas son dos filas con SKU distinto.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `variante_id` | uuid | FK → `variante.id`, on delete restrict, not null | |
| `sku` | text | not null, **unique (`unidad_sku_unique`)** | El requisito central: la unicidad la impone la base de datos, nunca una comprobación previa en la aplicación |
| `sku_auto_generado` | boolean | not null, default `true` | `false` si lo escribió el dueño; decide si un choque se reintenta o se rechaza |
| `estado` | enum `estado_unidad` | not null, default `'disponible'` | `disponible` · `vendida` · `reservada` |
| `creado_en` / `actualizado_en` | timestamptz | not null, default `now()` | |

**`cliente`** — persona que compra, con o sin deuda. Se desactiva; se borra solo si nunca compró.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `nombre` | text | not null | |
| `telefono` | text | not null | Es el identificador real que usa el dueño |
| `direccion` | text | nullable | |
| `fecha_registro` | timestamptz | not null, default `now()` | Dato de negocio, distinto de `creado_en` |
| `activo` | boolean | not null, default `true` | Soft-delete |
| `creado_en` / `actualizado_en` | timestamptz | not null, default `now()` | |

**`venta`** — una operación. `monto_total_centavos` se deriva de las unidades y se persiste al crear
porque el precio de venta puede diferir del base y debe quedar congelado.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `cliente_id` | uuid | FK → `cliente.id`, on delete restrict, **nullable** | Nulo = contado sin cuenta |
| `fecha` | timestamptz | not null, default `now()` | |
| `monto_total_centavos` | integer | not null | Suma de `venta_unidad.precio_venta_centavos` |
| `estado` | enum `estado_venta` | not null, default `'pendiente'` | `pendiente` · `parcial` · `pagada` |
| `creado_en` / `actualizado_en` | timestamptz | not null, default `now()` | |

**`venta_unidad`** — unión venta ↔ unidad con el precio congelado de esa pieza.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| `venta_id` | uuid | FK → `venta.id`, on delete cascade, not null | |
| `unidad_id` | uuid | FK → `unidad.id`, on delete restrict, not null | |
| `precio_venta_centavos` | integer | not null | Lo cobrado por esta pieza |
| — | — | **PK compuesta (`venta_id`,`unidad_id`)** | |
| — | — | **unique (`unidad_id`)** | Una pieza no puede estar en dos ventas: segunda constraint que protege el inventario |

**`pago`** — abono contra una venta. Solo se inserta; nunca se edita.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | |
| `venta_id` | uuid | FK → `venta.id`, on delete cascade, not null | |
| `monto_centavos` | integer | not null, validado `> 0` en el borde | |
| `fecha` | timestamptz | not null, default `now()` | |
| `metodo` | enum `metodo_pago` | not null | `efectivo` · `transferencia` · `tarjeta` — dato, no cobro |
| `creado_en` | timestamptz | not null, default `now()` | |

**Tablas de autenticación** (better-auth 1.7.5), escritas a mano con esta forma exacta:

- **`user`**: `id` text PK · `name` text not null · `email` text not null unique · `email_verified`
  boolean not null default false · `image` text · `created_at`/`updated_at` timestamptz not null.
- **`session`**: `id` text PK · `expires_at` timestamptz not null · `token` text not null unique ·
  `ip_address` text · `user_agent` text · `user_id` text not null FK → `user.id` cascade ·
  `created_at`/`updated_at`.
- **`account`**: `id` text PK · **`provider_account_id` text not null** (renombrado desde
  `account_id` en 1.7.0 — este es el breaking change de la versión) · `provider_id` text not null ·
  `user_id` text not null FK → `user.id` cascade · `access_token`, `refresh_token`, `id_token`,
  `scope`, `password` text nullables · `access_token_expires_at`, `refresh_token_expires_at`
  timestamptz nullables · `created_at`/`updated_at`.
- **`verification`**: `id` text PK · `identifier` text not null · `value` text not null ·
  `expires_at` timestamptz not null · `created_at`/`updated_at`.

### Relaciones

- `articulo` —(1:N)→ `variante` · **restrict**: no se borra un artículo con variantes.
- `variante` —(1:N)→ `unidad` · **restrict**.
- `cliente` —(1:N)→ `venta` · **restrict**: es la regla "no se elimina un cliente con ventas",
  impuesta por la base además de por la aplicación.
- `venta` —(1:N)→ `venta_unidad` · **cascade**.
- `unidad` —(0..1)→ `venta_unidad` · **restrict** + `unique(unidad_id)`.
- `venta` —(1:N)→ `pago` · **cascade**.
- `user` —(1:N)→ `session`, `account` · **cascade**.

### Índices

| Tabla | Índice | Para qué consulta |
|---|---|---|
| `unidad` | unique(`sku`) | Alta de unidad y búsqueda por SKU desde el celular |
| `unidad` | (`estado`) | Listado de piezas disponibles al crear una venta |
| `unidad` | (`variante_id`) | Detalle de artículo: piezas por variante |
| `variante` | unique(`articulo_id`,`color`,`talla`) | Evita la variante duplicada |
| `venta` | (`cliente_id`) | Historial de compras del perfil |
| `pago` | (`venta_id`) | Suma de pagos y saldo |
| `venta_unidad` | unique(`unidad_id`) | Impide vender dos veces la misma pieza |
| `cliente` | (`nombre`) · `articulo` | (`nombre`) | Búsqueda por nombre en los listados |

### Esquema

`src/lib/db/schema.ts` — el builder pega esto tal cual:

```ts
import {
  boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";

export const estadoUnidad = pgEnum("estado_unidad", ["disponible", "vendida", "reservada"]);
export const estadoVenta = pgEnum("estado_venta", ["pendiente", "parcial", "pagada"]);
export const metodoPago = pgEnum("metodo_pago", ["efectivo", "transferencia", "tarjeta"]);

const creadoEn = timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();
const actualizadoEn = timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow();

export const articulo = pgTable("articulo", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  categoria: text("categoria").notNull(),
  descripcion: text("descripcion"),
  precioBaseCentavos: integer("precio_base_centavos").notNull(),
  activo: boolean("activo").notNull().default(true),
  creadoEn,
  actualizadoEn,
}, (t) => [index("articulo_nombre_idx").on(t.nombre)]);

export const variante = pgTable("variante", {
  id: uuid("id").primaryKey().defaultRandom(),
  articuloId: uuid("articulo_id").notNull()
    .references(() => articulo.id, { onDelete: "restrict" }),
  color: text("color").notNull(),
  talla: text("talla").notNull(),
  creadoEn,
  actualizadoEn,
}, (t) => [
  unique("variante_articulo_color_talla_unique").on(t.articuloId, t.color, t.talla),
]);

export const unidad = pgTable("unidad", {
  id: uuid("id").primaryKey().defaultRandom(),
  varianteId: uuid("variante_id").notNull()
    .references(() => variante.id, { onDelete: "restrict" }),
  sku: text("sku").notNull(),
  skuAutoGenerado: boolean("sku_auto_generado").notNull().default(true),
  estado: estadoUnidad("estado").notNull().default("disponible"),
  creadoEn,
  actualizadoEn,
}, (t) => [
  unique("unidad_sku_unique").on(t.sku),
  index("unidad_estado_idx").on(t.estado),
  index("unidad_variante_idx").on(t.varianteId),
]);

export const cliente = pgTable("cliente", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull(),
  direccion: text("direccion"),
  fechaRegistro: timestamp("fecha_registro", { withTimezone: true }).notNull().defaultNow(),
  activo: boolean("activo").notNull().default(true),
  creadoEn,
  actualizadoEn,
}, (t) => [index("cliente_nombre_idx").on(t.nombre)]);

export const venta = pgTable("venta", {
  id: uuid("id").primaryKey().defaultRandom(),
  clienteId: uuid("cliente_id").references(() => cliente.id, { onDelete: "restrict" }),
  fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  montoTotalCentavos: integer("monto_total_centavos").notNull(),
  estado: estadoVenta("estado").notNull().default("pendiente"),
  creadoEn,
  actualizadoEn,
}, (t) => [index("venta_cliente_idx").on(t.clienteId)]);

export const ventaUnidad = pgTable("venta_unidad", {
  ventaId: uuid("venta_id").notNull().references(() => venta.id, { onDelete: "cascade" }),
  unidadId: uuid("unidad_id").notNull().references(() => unidad.id, { onDelete: "restrict" }),
  precioVentaCentavos: integer("precio_venta_centavos").notNull(),
}, (t) => [
  primaryKey({ columns: [t.ventaId, t.unidadId] }),
  unique("venta_unidad_unidad_unique").on(t.unidadId),
]);

export const pago = pgTable("pago", {
  id: uuid("id").primaryKey().defaultRandom(),
  ventaId: uuid("venta_id").notNull().references(() => venta.id, { onDelete: "cascade" }),
  montoCentavos: integer("monto_centavos").notNull(),
  fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  metodo: metodoPago("metodo").notNull(),
  creadoEn,
}, (t) => [index("pago_venta_idx").on(t.ventaId)]);
```

`src/lib/db/auth-schema.ts` declara las cuatro tablas de arriba con `pgTable`, columnas `text()` y
`timestamp(..., { withTimezone: true })`, y las FK `user_id` con `onDelete: "cascade"`. La columna
del breaking change se escribe `providerAccountId: text("provider_account_id").notNull()`.

### Migraciones

Herramienta: **drizzle-kit**. El esquema TypeScript es la fuente de verdad; el SQL se deriva con
`pnpm db:generate` y se aplica con `pnpm db:migrate`. **Los archivos de `drizzle/` los nombra la
herramienta**: este blueprint nunca los nombra ni pide editarlos a mano; se commitean tal cual.

Regla de producción: **expandir y después contraer**. Una columna nueva llega nullable o con default,
el código empieza a escribirla y solo un despliegue posterior la vuelve `not null`. Nunca una
migración destructiva en el mismo despliegue que el cambio de código. Las migraciones son un paso
explícito de despliegue (§12), jamás al arrancar la aplicación: dos instancias competirían.

La rama de pruebas se migra con `pnpm db:migrate:test`, que aplica exactamente las mismas migraciones
contra `TEST_DATABASE_URL` (script emitido en §19.6).

### Datos semilla

`scripts/seed.ts` (`pnpm db:seed`) deja una base de desarrollo utilizable y es **idempotente**
(comprueba antes de insertar; correrlo dos veces no duplica nada). Crea: el usuario dueño desde
`OWNER_EMAIL`/`OWNER_PASSWORD` con `auth.api.signUpEmail` —nunca insertando el hash a mano—, un
artículo "Camisa lino manga larga" (categoría "Camisas", `precio_base_centavos` 145000), su variante
`blanco`/`M`, **dos unidades de esa misma variante con SKU distintos**, y un cliente "Cliente Demo"
con teléfono `809-000-0000`.

---

## 5. API Design

Dos superficies, y la elección no queda a criterio del builder:

- **Server Actions** para toda mutación de dominio: funciones asíncronas exportadas desde un
  `actions.ts` con `"use server"`, tipadas de extremo a extremo. No hay cliente REST a mano para un
  solo usuario.
- **Route Handlers** solo para lo que debe ser una URL: `/api/health`, `/api/auth/[...all]`, la
  descarga CSV y la descarga PDF.

Las lecturas de pantalla las hacen Server Components llamando a módulos de `src/server/`, sin HTTP.

### Convenciones

- **Ruta base de los route handlers de datos:** `/api/v1`. `/api/health` y `/api/auth` quedan fuera
  del versionado a propósito: son infraestructura.
- **Envolvente** — una sola forma para *todo* Server Action:

  ```ts
  export type Resultado<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: CodigoError; mensaje: string; campos?: Record<string, string> } };
  ```

  Los route handlers de datos devuelven ese mismo objeto como JSON con el código HTTP de la tabla.
  `/api/health` responde `{"ok":true,"db":true}` con 200 o `{"ok":false,"db":false}` con 503. Los que
  devuelven archivo responden el binario con `Content-Disposition`; su caso de error sí usa JSON.

- **Códigos de error** — conjunto cerrado, ninguno se inventa en tiempo de ejecución:

  | `code` | HTTP | Cuándo |
  |---|---|---|
  | `VALIDATION_ERROR` | 422 | El esquema zod del borde rechazó la entrada; `campos` trae mensaje por campo |
  | `UNAUTHENTICATED` | 401 | No hay sesión válida |
  | `NOT_FOUND` | 404 | El id no existe |
  | `SKU_DUPLICADO` | 409 | Alta de unidad con `sku` manual ya existente (violación 23505) |
  | `UNIDAD_NO_DISPONIBLE` | 409 | Se intentó vender una unidad cuyo estado no es `disponible` |
  | `PAGO_EXCEDE_SALDO` | 422 | El pago supera el saldo pendiente de la venta |
  | `CLIENTE_CON_VENTAS` | 409 | Se intentó **eliminar** un cliente con ventas o deuda > 0 |
  | `INTERNAL` | 500 | Cualquier otra excepción; mensaje genérico al usuario, detalle al log |

- **Validación:** `zod`. Cada Server Action y cada route handler parsea su entrada con un esquema
  declarado en el mismo módulo de `src/server/`, **antes** de tocar la base. Tipos con `z.infer`.
- **Paginación:** offset. `page` (1-based, default 1) y `per_page` (default 25, máximo 100),
  aplicados con `limit`/`offset` en SQL, nunca cortando un arreglo en memoria.
- **Idempotencia:** ningún endpoint acepta clave de idempotencia. La protección es estructural:
  `unique(venta_unidad.unidad_id)` impide que un doble clic venda dos veces la misma pieza y el
  segundo intento devuelve `UNIDAD_NO_DISPONIBLE`.
- **Límites de tasa:** un solo usuario; sin límite en endpoints de dominio. El único límite vivo es
  el que better-auth aplica por defecto a los intentos de inicio de sesión, y se deja activo.

### Rutas

| Método | Ruta | Qué hace | Auth | Límite |
|---|---|---|---|---|
| GET | `/api/health` | `select 1` contra Neon; 200 o 503 | pública | ninguno |
| ALL | `/api/auth/[...all]` | Handler de better-auth | pública | el de better-auth en sign-in |
| GET | `/api/v1/exportaciones/inventario` | CSV del inventario completo | sesión | ninguno |
| GET | `/api/v1/ventas/[id]/recibo` | PDF del recibo | sesión | ninguno |

Server Actions (todas re-verifican sesión y devuelven `Resultado<T>`):
`crearArticulo`, `editarArticulo`, `desactivarArticulo`, `crearVariante`, `eliminarVariante`
(`src/server/articulos.ts`) · `crearUnidad`, `cambiarEstadoUnidad` (`src/server/unidades.ts`) ·
`crearCliente`, `editarCliente`, `desactivarCliente`, `eliminarCliente` (`src/server/clientes.ts`) ·
`crearVenta` (`src/server/ventas.ts`) · `registrarPago` (`src/server/pagos.ts`).

### Endpoints críticos — detalle completo

**1. `crearUnidad`** — entrada
`{ varianteId: uuid, sku?: string (1..64, A-Z0-9 y guion), estado?: 'disponible'|'reservada' }`.
Si `sku` falta se autogenera `SKU-` + 10 hexadecimales en mayúsculas desde `crypto.randomUUID()` y
`sku_auto_generado = true`; si viene, se usa tal cual con `false`. El `insert` va **sin comprobación
previa de existencia**. Ante violación `23505` de `unidad_sku_unique`: si el SKU era automático se
reintenta hasta **3** veces (agotadas, `INTERNAL`); si era manual devuelve `SKU_DUPLICADO` (409) y no
escribe nada. Salida `{ ok: true, data: { id, sku } }`. Efecto: una fila en `unidad`, ninguna otra.

**2. `crearVenta`** — entrada
`{ clienteId?: uuid, lineas: Array<{ unidadId: uuid, precioVentaCentavos: int > 0 }> (min 1) }`.
Todo en **una transacción**: (1) `select … from unidad where id in (…) for update`; (2) si alguna no
existe → `NOT_FOUND`, si alguna tiene `estado <> 'disponible'` → `UNIDAD_NO_DISPONIBLE` y rollback
completo; (3) `monto_total_centavos = suma(precio_venta_centavos)`; (4) `insert into venta` con
`estado='pendiente'`; (5) una fila de `venta_unidad` por línea; (6) `update unidad set
estado='vendida'` para todas. Salida `{ ventaId, montoTotalCentavos }`.

**3. `registrarPago`** — entrada
`{ ventaId: uuid, montoCentavos: int > 0, metodo: 'efectivo'|'transferencia'|'tarjeta' }`.
En transacción: `select … from venta where id=$1 for update` (si no existe → `NOT_FOUND`);
`pagado = coalesce(sum(pago.monto_centavos),0)`; `saldo = monto_total_centavos - pagado`. **Si
`montoCentavos > saldo` → `PAGO_EXCEDE_SALDO` (422) y rollback: la regla de este producto es
rechazar, nunca truncar**, porque guardar un número distinto al tecleado destruye la confianza en el
saldo. Si cabe: `insert into pago` y recálculo — `pagada` si `pagado+monto >= total`, `parcial` si
`> 0`, `pendiente` si `0`. Salida `{ pagoId, estadoVenta, saldoCentavos }`.

**4. `eliminarCliente` / `desactivarCliente`** — `eliminarCliente(id)` cuenta ventas y calcula saldo:
con al menos una venta o saldo > 0 devuelve `CLIENTE_CON_VENTAS` (409) sin borrar nada e indica que
la operación disponible es desactivar; sin ventas ni deuda, `delete`. `desactivarCliente(id)` pone
`activo=false`, siempre permitido; el cliente inactivo desaparece del selector de venta nueva pero
conserva todo su historial.

**5. `GET /api/v1/exportaciones/inventario`** — sin sesión 401 con envolvente JSON. Con sesión: 200,
`Content-Type: text/csv; charset=utf-8`,
`Content-Disposition: attachment; filename="inventario.csv"`, una fila por unidad ordenada por `sku`
ascendente. **La primera línea es exactamente:**

```
sku,articulo,categoria,color,talla,estado,precio_base_dop
```

Separador coma, fin de línea `\n`, comillas dobles solo si el valor contiene coma, comilla o salto
(y la comilla interior se duplica). `precio_base_dop` se formatea con `src/lib/dinero.ts` por
aritmética entera (`1450.00`), nunca con `toLocaleString`.

---

## 6. Frontend Architecture

### Rutas

| Ruta | Página | Fuente de datos | Auth |
|---|---|---|---|
| `/login` | Inicio de sesión | Server Action de better-auth | pública |
| `/` | Panel: disponibles, ventas del día, deuda total | consulta de servidor | sesión |
| `/articulos` · `/articulos/[id]` | Listado/alta · detalle con variantes | consulta de servidor | sesión |
| `/unidades` | Listado con filtro por estado + alta | consulta de servidor | sesión |
| `/clientes` · `/clientes/[id]` | Listado/alta/desactivar · perfil con saldo | consulta de servidor | sesión |
| `/ventas` · `/ventas/nueva` · `/ventas/[id]` | Listado · alta · detalle y pago | consulta de servidor | sesión |

### Estrategia de renderizado

Todas las rutas del grupo `(app)` llevan `export const dynamic = "force-dynamic"`: es un panel de una
persona sobre datos que cambian al minuto, y cachear una lista de inventario produce decisiones sobre
stock viejo. `/login` es estática salvo su formulario cliente. Tras cada mutación el Server Action
llama `revalidatePath()` sobre la ruta afectada. **No** se activa `cacheComponents` ni `"use cache"`
en v1: mostrar una pieza vendida como disponible es exactamente el fallo que el sistema evita.

### Jerarquía de componentes

```
app/(app)/layout.tsx                      [servidor] shell, lee la sesión
└── components/layout/navegacion.tsx      [servidor] enlaces + ruta activa

app/(app)/ventas/nueva/page.tsx           [servidor] clientes activos + unidades disponibles
└── components/ventas/formulario-venta.tsx    ["use client"] selección múltiple y precios
    ├── components/tabla-densa.tsx             [servidor] piezas seleccionables
    └── components/ui/button.tsx               ["use client"] envía a crearVenta

app/(app)/ventas/[id]/page.tsx            [servidor] venta, líneas, pagos, saldo
└── components/pagos/formulario-pago.tsx  ["use client"] monto + método -> registrarPago
```

`"use client"` vive en la hoja que necesita estado o eventos, nunca en un `layout` ni en una `page`.

### Estado

- **Servidor:** sin librería de caché de cliente. Los datos llegan como props de Server Components y
  se refrescan con `revalidatePath()`; con un usuario, un `useQuery` sería una segunda copia que se
  desincroniza.
- **Formularios:** `react-hook-form` resolviendo contra el mismo esquema zod del servidor, más
  `useActionState` para el resultado del Server Action.
- **UI:** `useState` local (diálogo abierto, filtro). Sin store global.
- **Deliberadamente fuera del estado global:** la sesión (se lee en servidor en cada petición) y
  cualquier total de dinero (se calcula en SQL).
- **Sin actualizaciones optimistas** en dinero o inventario: mostrar una venta hecha antes de que la
  transacción confirme es el error que no se puede permitir.

### Carga, vacío y error

| Superficie | Cargando | Vacío | Error |
|---|---|---|---|
| Listados | `loading.tsx` con esqueleto de filas | "Aún no hay artículos. Crea el primero." + botón de alta | `error.tsx` con mensaje y botón "Reintentar" |
| `/ventas/nueva` | Esqueleto del selector | "No hay piezas disponibles. Registra unidades antes de vender." | Igual |
| `/clientes/[id]` | Esqueleto de las tres secciones | "Este cliente todavía no tiene compras." · "Sin pagos registrados." | Igual |
| Formularios | Botón deshabilitado con "Guardando…" | — | Error por campo bajo el input (texto, no solo color) + resumen con `role="alert"` |
| Descarga CSV / PDF | Botón en "Generando…" | — | Toast con el mensaje y el enlace intacto |

---

## 7. Design System

Sistema neutro, denso y funcional: el dueño mira tablas y formularios, no una portada.

### Colores

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--primary` | `#1D4ED8` | `#60A5FA` | Botones primarios, enlaces, anillo de foco |
| `--primary-fg` | `#FFFFFF` | `#0B1220` | Texto sobre primario |
| `--background` | `#FFFFFF` | `#0B1220` | Fondo de página |
| `--surface` | `#F8FAFC` | `#111A2E` | Tarjetas, paneles, cabecera de tabla, diálogos |
| `--border` | `#E2E8F0` | `#1E293B` | Separadores decorativos entre filas |
| `--border-strong` | `#64748B` | `#64748B` | Contorno de inputs, selects y botones |
| `--fg` | `#0F172A` | `#E2E8F0` | Texto de cuerpo |
| `--fg-muted` | `#475569` | `#94A3B8` | Texto secundario, encabezados de columna |
| `--destructive` | `#B91C1C` | `#F87171` | Errores, eliminar, estado `vendida` |
| `--success` | `#15803D` | `#4ADE80` | Confirmaciones, estado `disponible` |
| `--warning` | `#B45309` | `#FBBF24` | Estados `pendiente` y `parcial`, avisos |

Mapeo fijo de estados: `disponible`→success, `vendida`→destructive, `reservada`→fg-muted,
`pendiente`/`parcial`→warning, `pagada`→success. **Ninguna insignia se distingue solo por color:**
todas llevan su texto.

**Contraste** (WCAG 2.2 AA: 4.5:1 texto, 3:1 texto grande y contornos). Los tres pares de mayor
riesgo, medidos:

| Par | Ratio | Umbral |
|---|---|---|
| `#FFFFFF` sobre `--primary` `#1D4ED8` | **6.70:1** | 4.5:1 ✓ |
| `--warning` `#B45309` sobre `#FFFFFF` | **5.02:1** | 4.5:1 ✓ |
| `--border-strong` `#64748B` sobre `#FFFFFF` | **4.76:1** | 3:1 ✓ |

Por eso existe `--border-strong`: `#E2E8F0` da 1.2:1 contra blanco, válido para una línea decorativa
pero **no** para el contorno de un input, que es un componente de interfaz.

### Tipografía

| Rol | Familia | Tamaño / interlineado | Peso | Tracking |
|---|---|---|---|---|
| Display | Inter | 32px / 40px | 600 | -0.02em |
| Heading | Inter | 24px / 32px · 20px / 28px | 600 | -0.01em |
| Body | Inter | 14px / 20px | 400 | 0 |
| Etiqueta y cabecera de tabla | Inter | 12px / 16px | 500 | 0.01em |
| Mono (SKU, montos) | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` | 13px / 20px | 400 | 0 |

Cuerpo a 14px porque la unidad de trabajo es una tabla larga; 16px reduce a la mitad lo que cabe en
el celular sin ganar legibilidad a esta distancia.

**Carga de fuente:** Inter con `next/font/google`, `subsets: ["latin"]`, `display: "swap"`,
`variable: "--font-sans"`, autoalojada por el framework en el build (sin CDN en runtime). Respaldo:
`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`. Los SKU y montos
usan la pila mono del sistema: no se carga una segunda fuente.

### Espaciado, radios, elevación

- Escala base 4px — `4, 8, 12, 16, 24, 32, 48, 64`. Nada fuera de la escala.
- Altura de fila de tabla 32px; relleno horizontal de celda 12px.
- Radios: 6px en inputs, botones e insignias; 10px en tarjetas y diálogos; completo en avatares.
- Elevación plana (solo bordes), con dos excepciones:
  `--shadow-popover: 0 4px 12px rgb(15 23 42 / 0.12)` y
  `--shadow-dialog: 0 12px 32px rgb(15 23 42 / 0.20)`.
- Ancho máximo 1280px. Breakpoints `sm 640 · md 768 · lg 1024 · xl 1280`. Móvil primero: bajo `md`
  las tablas se apilan en tarjetas, jamás scroll horizontal.
- Área táctil mínima real 24×24 CSS px, objetivo 36×36 en acciones de fila.

### Movimiento

| Interacción | Duración | Easing |
|---|---|---|
| Hover / foco / cambio de color | 120ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Apertura de diálogo y popover | 160ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Toast entrando / saliendo | 200ms / 150ms | `cubic-bezier(0.2, 0, 0, 1)` |

Solo se animan `transform` y `opacity`, y todo se envuelve en
`@media (prefers-reduced-motion: reduce) { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }`.

### Estilo de componente

Utilitario y quieto: superficies planas, borde de 1px, tipografía pequeña y consistente, color
reservado para el estado. Un componente nuevo encaja si podría vivir dentro de una tabla de 200 filas
sin llamar la atención — sin degradados, sin sombras decorativas, sin iconografía ilustrativa. El
acento azul aparece como máximo una vez por pantalla, en la acción principal. No se analizó ninguna
referencia de marca: no existe.

---

## 8. Authentication & Authorization

### Proveedor y razón

**better-auth self-hosted**, correo + contraseña, con registro público **deshabilitado**. Un sistema
de un usuario no debe pagar por asiento ni depender de un tercero para abrir la caja; las sesiones
viven en la misma base Neon que el inventario, con el mismo respaldo y la misma migración.

### Flujos

- **Alta de la cuenta:** no hay pantalla de registro. El dueño se crea una vez con `pnpm db:seed`
  desde `OWNER_EMAIL`/`OWNER_PASSWORD`, vía `auth.api.signUpEmail`, para que el hash lo produzca la
  librería.
- **Inicio de sesión:** `/login` → `signIn.email` → cookie → redirección a `next` o a `/`.
  Credenciales incorrectas: "Correo o contraseña incorrectos", sin decir cuál falló, sin sesión.
- **Cierre de sesión:** botón en el encabezado → `signOut` → la fila de `session` se borra.
- **Expiración:** 7 días con renovación deslizante cada 24 h de uso; al expirar, la siguiente
  navegación va a `/login?next=<ruta>` y vuelve allí tras entrar.
- **Restablecimiento de contraseña:** **sin flujo por correo en v1** — sería el proveedor de email que
  §1 declara non-goal. La recuperación es operativa: cambiar `OWNER_PASSWORD` y volver a correr
  `pnpm db:seed`, que actualiza la credencial. Documentado en `CLAUDE.md`.
- **Eliminación de cuenta:** no existe; borrar la única cuenta deja el sistema inaccesible.

### Protección de rutas

| Superficie | Regla | Dónde se impone |
|---|---|---|
| Todo salvo `/login`, `/api/auth/*`, `/api/health` y estáticos | Sesión requerida; 307 a `/login?next=…` | `proxy.ts` (Next 16 renombró `middleware.ts`) |
| Cada Server Action | Sesión requerida; `UNAUTHENTICATED` sin tocar la base | El cuerpo de la acción, vía `getSesion()` de `src/lib/auth.ts` |
| `/api/v1/*` | Sesión requerida; 401 con envolvente JSON | El route handler, vía `getSesion()` |

**Regla de imposición:** la autorización se comprueba en el servidor en **cada** petición. El
`proxy.ts` es conveniencia de navegación, no seguridad: un Server Action es un POST a la ruta que lo
usa y un `matcher` que excluya una ruta se salta su comprobación. Ocultar un botón no es un permiso.

### Roles y permisos

| Rol | Puede | No puede |
|---|---|---|
| Dueño (único rol, implícito en tener sesión) | Todo: crear, editar, desactivar, vender, registrar pagos, exportar | Eliminar un cliente con ventas o deuda; eliminar un artículo con variantes; borrar una unidad ya vendida |
| Anónimo | Ver `/login` y `/api/health` | Todo lo demás |

No hay tabla de roles: §1 lo declara non-goal y una tabla con una sola fila es infraestructura que
solo puede fallar. Las tres prohibiciones no son permisos: son invariantes impuestos por constraints.

### Sesiones

Cookie opaca de better-auth respaldada por la tabla `session`. Banderas `HttpOnly`, `SameSite=Lax`,
`Secure` en producción (en local sobre HTTP no, o el navegador la descarta), `Path=/`. Vida 7 días,
renovación cada 24 h. CSRF: `SameSite=Lax` más la validación de `Origin` contra `BETTER_AUTH_URL` de
better-auth y la comprobación propia de origen de las Server Actions. Cerrar sesión borra la fila.

### Multi-tenancy / aislamiento por fila

NOT APPLICABLE — un único usuario y un único conjunto de datos; no existe frontera de tenant que una
consulta pueda cruzar. Por eso este blueprint **no** añade una columna `owner_id` decorativa que
nadie filtraría de verdad. §20.4 nombra el trabajo que reabriría esta sección.

---

## 9. BUILD ORDER

Cada paso lleva `Do`, `Done when`, `Verify` y `Checkpoint`. Un paso no está hecho hasta que sus
`Verify` pasan **y** los de los pasos anteriores siguen pasando. Reglas operativas:

- Todo comando corre **desde la raíz del proyecto**, nunca desde `blueprints/`.
- Ningún `Verify` depende del `Checkpoint` de su propio paso: al ejecutarse los archivos están
  escritos pero sin commitear y la etiqueta no existe.
- Las pruebas de servidor corren contra `TEST_DATABASE_URL`; `tests/setup.ts` lo impone y aborta si
  coincide con `DATABASE_URL`. Antes de cualquier prueba que toque la base va `pnpm db:migrate:test`.
- Cada archivo de prueba crea sus propios datos con sufijos `crypto.randomUUID()`: ninguna prueba
  depende del orden ni de los datos de otra.

### Step map

| # | Paso | Depende de | Toca | Gate |
|---|---|---|---|---|
| 1 | Cliente de base de datos, env y `/api/health` | — | `env.ts`, `db/index.ts`, `drizzle.config.ts`, `api/health/route.ts`, `tests/api/health.test.ts` | El servidor construido responde 200 en `/api/health` tras consultar Neon |
| 2 | Auth de un usuario y protección de rutas | 1 | `db/auth-schema.ts`, `lib/auth.ts`, `api/auth/[...all]/route.ts`, `login/page.tsx`, `proxy.ts` | Ruta protegida responde 307 a `/login` sin sesión |
| 3 | Esquema de dominio, migraciones y semilla | 2 | `db/schema.ts`, `db/index.ts`, `drizzle/**`, `scripts/seed.ts`, `tests/db/schema.test.ts` | `db:migrate` aplica y un SKU duplicado lo rechaza la constraint |
| 4 | CRUD de Artículo y Variante | 3 | `server/articulos.ts`, `articulos/actions.ts`, dos `page.tsx`, `tests/server/articulos.test.ts` | Variante duplicada rechazada |
| 5 | CRUD de Unidad y SKU | 4 | `server/unidades.ts`, `unidades/actions.ts`, `unidades/page.tsx`, `tests/server/unidades.test.ts` | Dos unidades de la misma variante con SKU distinto; SKU manual repetido → `SKU_DUPLICADO` |
| 6 | CRUD de Cliente con bloqueo de borrado | 3 | `server/clientes.ts`, `clientes/actions.ts`, `clientes/page.tsx`, `tests/server/clientes.test.ts` | Cliente con ventas no se elimina; se desactiva |
| 7 | Creación atómica de Venta | 5, 6 | `server/ventas.ts`, `ventas/actions.ts`, dos `page.tsx`, `tests/server/ventas.test.ts` | Unidad no disponible aborta la venta completa |
| 8 | Registro de Pago y recálculo de estado | 7 | `server/pagos.ts`, `ventas/[id]/page.tsx`, `ventas/[id]/actions.ts`, `tests/server/pagos.test.ts` | Pago que excede el saldo → `PAGO_EXCEDE_SALDO` y nada escrito |
| 9 | Perfil de Cliente con saldo | 8 | `server/clientes-perfil.ts`, `clientes/[id]/page.tsx`, `tests/server/clientes-perfil.test.ts` | El saldo coincide con total − pagos |
| 10 | Exportación CSV del inventario | 5 | `server/exportacion-csv.ts`, route handler, `tests/server/exportacion-csv.test.ts` | Cabecera CSV byte-exacta y una fila por unidad |
| 11 | Recibo de venta en PDF | 8 | `server/recibo-pdf.tsx`, route handler, `tests/api/recibo.test.ts` | La respuesta empieza por `%PDF-` con `Content-Type: application/pdf` |
| 12 | Despliegue a Vercel + Neon y CI | 9, 10, 11 | `.env.example`, `lib/env.ts`, `.github/workflows/ci.yml` | `/api/health` de producción responde 200 |
| 13 | Suite E2E del flujo crítico y a11y | 12 | `tests/e2e/*.ts`, `scripts/reset-db.ts` | El flujo completo pasa y el saldo queda en el valor esperado |

Primero el esqueleto de datos y el endpoint servido —que se **ejecuta** en su propio paso, no solo se
compila—, después autenticación y esquema, y luego la rebanada vertical completa (artículo → unidad →
cliente → venta → pago) antes de cualquier adorno. El contrato entre los scripts de `package.json`,
la salida `./drizzle` de `drizzle.config.ts` y el alias `@/` de `vitest.config.ts` queda ejercitado en
el paso 1, el primero donde ambos lados existen.

---

#### Step 1 — Cliente de base de datos, variables de entorno y `/api/health`

**Do**

El scaffold, la instalación y la configuración de herramientas ya ocurrieron en §10 Bootstrap. Crea:

- `src/lib/env.ts` — si `DATABASE_URL` no está en el entorno y existe `.env`, lo carga con
  `process.loadEnvFile()` (Next ya lo carga para la aplicación; esto cubre scripts y herramientas) y
  parsea `process.env` con `zod`. `DATABASE_URL` es **requerida**; `TEST_DATABASE_URL`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `OWNER_EMAIL` y `OWNER_PASSWORD`
  son **opcionales aquí** y las promueve el paso que las consume (§10, columna "Requerida desde el
  paso"). Exporta `env`. Usa `node:fs`: nunca se importa desde un archivo `"use client"`.
- `src/lib/db/index.ts` — `import ws from "ws"; neonConfig.webSocketConstructor = ws;` y un `Pool` de
  `@neondatabase/serverless` envuelto con `drizzle` de `drizzle-orm/neon-serverless`. Se usa el
  driver WebSocket y no el HTTP porque los pasos 7 y 8 necesitan **transacciones interactivas** con
  `select … for update`, que el driver HTTP no ofrece. Exporta `db`; el `schema` lo añade el paso 3.
- `drizzle.config.ts` — carga `.env` con `process.loadEnvFile()` guardado por `existsSync`, lee
  `process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL`, lanza nombrando la variable si
  falta, y exporta `defineConfig({ schema: ["./src/lib/db/schema.ts", "./src/lib/db/auth-schema.ts"],
  out: "./drizzle", dialect: "postgresql", strict: true, dbCredentials: { url } })`. Los archivos de
  esquema llegan en los pasos 2 y 3; drizzle-kit no se ejecuta hasta entonces.
- `src/app/api/health/route.ts` — `export const dynamic = "force-dynamic"` y un `GET` que ejecuta
  `db.execute(sql\`select 1\`)`: 200 con `{"ok":true,"db":true}` o 503 con `{"ok":false,"db":false}`,
  sin filtrar el mensaje del error al cuerpo.
- `tests/api/health.test.ts` — importa el `GET` y asserta 200 con `ok === true`; y una prueba que
  importa `src/lib/env.ts` con `DATABASE_URL` borrada y espera que lance con ese nombre en el mensaje.

**Done when**

- [ ] WHEN `pnpm install --frozen-lockfile` runs desde la raíz THE SYSTEM SHALL exit 0 sin modificar `pnpm-lock.yaml`.
- [ ] WHEN `pnpm typecheck` y `pnpm lint` run THE SYSTEM SHALL exit 0 en ambos, sin errores ni advertencias.
- [ ] WHEN se hace GET a `/api/health` contra el servidor construido THE SYSTEM SHALL responder 200 con un cuerpo que contiene `"ok":true`, tras ejecutar una consulta real contra Neon.
- [ ] WHEN falta `DATABASE_URL` al importar `src/lib/env.ts` THE SYSTEM SHALL lanzar un error cuyo mensaje contiene `DATABASE_URL`, en lugar de fallar más tarde en la primera consulta.
- [ ] WHEN `pnpm test tests/api/health.test.ts` runs THE SYSTEM SHALL exit 0 con 0 pruebas fallidas y 0 omitidas.

**Verify**

```bash
pnpm install --frozen-lockfile        # expect: exit 0, lockfile sin cambios
pnpm typecheck                        # expect: exit 0
pnpm lint                             # expect: exit 0
pnpm test tests/api/health.test.ts    # expect: exit 0, 0 failed, 0 skipped
pnpm build                            # expect: exit 0
pnpm exec next start -p 3000 & SRV=$!; sleep 12; code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health); body=$(curl -s http://localhost:3000/api/health); kill $SRV 2>/dev/null || true; test "$code" = 200 && printf '%s' "$body" | grep -q '"ok":true'
# expect: exit 0 — el endpoint servido se EJECUTA, no solo se compila
```

**Checkpoint**

```bash
git add -A && git commit -m "step 1: cliente de base de datos, env y health check"
git tag step-01-scaffold-db
git ls-files --error-unmatch src/lib/env.ts   # expect: exit 0 — commiteado una línea antes
# rollback si el paso 2 sale mal: git reset --hard step-01-scaffold-db
```

---

#### Step 2 — Auth de un solo usuario y protección de rutas

**Do**

- `src/lib/db/auth-schema.ts` — las cuatro tablas de §4 tal cual. **Antes de escribirlas**, ejecuta
  `npx auth@latest generate` y contrasta su salida con §4: 1.7.5 renombró `Account.accountId` a
  `providerAccountId`, y ese es el cambio que rompe respecto a 1.6.x. Si ese binario no resuelve en
  esta máquina, el esquema literal de §4 es la fuente de verdad y el paso continúa sin él: es una
  comprobación cruzada, no un bloqueo.
- `src/lib/auth.ts` — `betterAuth({ database: drizzleAdapter(db, { provider: "pg", schema: authSchema }), emailAndPassword: { enabled: true, disableSignUp: true }, session: { expiresIn: 604800, updateAge: 86400 }, secret, baseURL })`.
  Lee `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL` de `env` y **lanza nombrando la variable si falta**:
  es este módulo, no `env.ts`, quien las promueve a requeridas, para no romper el gate del paso 1.
  Exporta `getSesion()`, el único lector de sesión del proyecto.
- `src/app/api/auth/[...all]/route.ts` — `toNextJsHandler(auth)` exportando `GET` y `POST`.
- `src/app/login/page.tsx` — formulario de correo y contraseña; error genérico "Correo o contraseña
  incorrectos"; respeta el parámetro `next`.
- `proxy.ts` en la raíz — **no `middleware.ts`**; la función exportada se llama `proxy`. Redirige 307
  a `/login?next=<ruta>` cuando no hay cookie de sesión, con un `matcher` que excluye `login`,
  `api/auth`, `api/health`, `_next/static`, `_next/image` y `favicon.ico`.

Las tablas de auth se migran en el paso 3, junto con el dominio; por eso ningún criterio de este paso
ejecuta una consulta.

**Done when**

- [ ] WHEN una petición sin sesión hace GET a `/ventas` THE SYSTEM SHALL responder 307 con una cabecera `Location` que contiene `/login`.
- [ ] WHEN una petición sin sesión hace GET a `/login` THE SYSTEM SHALL responder 200.
- [ ] WHEN una petición sin sesión hace GET a `/api/health` THE SYSTEM SHALL responder 200, porque el `matcher` de `proxy.ts` excluye esa ruta.
- [ ] WHEN falta `BETTER_AUTH_SECRET` al importar `src/lib/auth.ts` THE SYSTEM SHALL lanzar un error cuyo mensaje contiene `BETTER_AUTH_SECRET`, en lugar de servir tráfico con sesiones sin firmar.
- [ ] WHEN `src/lib/auth.ts` se inspecciona THE SYSTEM SHALL contener `disableSignUp: true`, de modo que no exista registro público.

**Verify**

```bash
pnpm typecheck                                  # expect: exit 0
pnpm lint                                       # expect: exit 0
pnpm build                                      # expect: exit 0
grep -q "disableSignUp: true" src/lib/auth.ts   # expect: exit 0 — sin registro público
pnpm exec next start -p 3000 & SRV=$!; sleep 12; a=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ventas); loc=$(curl -s -o /dev/null -D - http://localhost:3000/ventas | grep -i '^location:'); b=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login); c=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health); kill $SRV 2>/dev/null || true; test "$a" = 307 && printf '%s' "$loc" | grep -q "/login" && test "$b" = 200 && test "$c" = 200
# expect: exit 0 — protegida 307 a /login, login 200, health sigue público 200
pnpm test tests/api/health.test.ts              # expect: exit 0 — el gate del paso 1 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 2: auth de un solo usuario y proteccion de rutas"
git tag step-02-auth
git ls-files --error-unmatch proxy.ts           # expect: exit 0
```

---

#### Step 3 — Esquema de dominio, migraciones y semilla

**Do**

- `src/lib/db/schema.ts` — el esquema completo de §4, con las tres constraints únicas.
- `src/lib/db/index.ts` — editar: pasar `{ schema: { ...schema, ...authSchema } }` a `drizzle()`.
- Generar y aplicar: `pnpm db:generate` emite el SQL en `drizzle/` — **el nombre lo elige drizzle-kit;
  no se escribe ni se edita a mano** — `pnpm db:migrate` lo aplica a desarrollo y
  `pnpm db:migrate:test` a la rama de pruebas. Si el SQL generado no contiene las tres constraints
  únicas de §4, se corrige el TypeScript y se regenera, nunca el SQL.
- `scripts/seed.ts` — la semilla idempotente de §4: usuario dueño con `auth.api.signUpEmail` (si el
  correo ya existe, actualiza la contraseña en vez de fallar), un artículo, una variante, **dos
  unidades de esa misma variante con SKU distintos** y un cliente demo.
- `tests/db/schema.test.ts` — un `select` contra **cada tabla que §4 define** (dominio y auth)
  esperando que resuelva, y una prueba que inserta dos `unidad` con el mismo `sku` esperando que la
  base rechace la segunda. Es una aserción de propiedad, no de conteo: si §4 crece, la lista crece.

**Done when**

- [ ] WHEN `pnpm db:migrate` runs contra la base de desarrollo THE SYSTEM SHALL exit 0 y crear todas las tablas que §4 define.
- [ ] WHEN se hace `select` sobre cada tabla que §4 define THE SYSTEM SHALL devolver un resultado sin error para todas ellas.
- [ ] WHEN se insertan dos filas de `unidad` con el mismo valor de `sku` THE SYSTEM SHALL rechazar la segunda con una violación de unicidad de la base de datos y dejar exactamente una fila con ese `sku`.
- [ ] WHEN `pnpm db:seed` runs dos veces seguidas THE SYSTEM SHALL exit 0 las dos veces y dejar el mismo número de filas en `articulo`, `variante`, `unidad` y `cliente`.
- [ ] WHEN la semilla termina THE SYSTEM SHALL dejar dos filas de `unidad` con la misma `variante_id` y valores de `sku` distintos.

**Verify**

```bash
pnpm db:generate                    # expect: exit 0 — emite la migración en drizzle/
pnpm db:migrate                     # expect: exit 0
pnpm db:migrate:test                # expect: exit 0 — misma migración en la rama de pruebas
pnpm db:seed                        # expect: exit 0
pnpm db:seed                        # expect: exit 0 — idempotente, no duplica
pnpm test tests/db/schema.test.ts   # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint         # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "step 3: esquema de dominio, migraciones y semilla"
git tag step-03-esquema
git ls-files --error-unmatch src/lib/db/schema.ts   # expect: exit 0
test -n "$(git ls-files drizzle)"                   # expect: exit 0 — migraciones commiteadas
```

---

#### Step 4 — CRUD de Artículo y Variante

**Do**

- `src/server/articulos.ts` — esquemas zod y `listarArticulos({ page, perPage })`,
  `obtenerArticulo`, `crearArticulo`, `editarArticulo`, `desactivarArticulo`, `crearVariante`,
  `eliminarVariante`. Todas devuelven `Resultado<T>` (§5) y empiezan con `getSesion()`.
  `desactivarArticulo` pone `activo=false`; **no existe borrado de artículo** porque la FK de
  `variante` es `restrict`. `crearVariante` captura la violación de
  `variante_articulo_color_talla_unique` y devuelve `VALIDATION_ERROR` marcando el campo `talla`.
- `src/app/(app)/articulos/actions.ts` — `"use server"`, expone las mutaciones y llama
  `revalidatePath("/articulos")`.
- `src/app/(app)/articulos/page.tsx` — listado paginado en SQL + formulario de alta, con estados
  vacío y de error de §6.
- `src/app/(app)/articulos/[id]/page.tsx` — detalle y gestión de variantes.
- `tests/server/articulos.test.ts` — alta correcta, nombre vacío, variante duplicada, desactivación y
  paginación.

**Done when**

- [ ] WHEN `crearArticulo` recibe `nombre` vacío THE SYSTEM SHALL devolver `ok: false` con `error.code` igual a `VALIDATION_ERROR` y no insertar ninguna fila.
- [ ] WHEN `crearVariante` recibe una combinación de `articulo_id`, `color` y `talla` que ya existe THE SYSTEM SHALL devolver `error.code` igual a `VALIDATION_ERROR` y dejar el número de variantes sin cambios.
- [ ] WHEN `desactivarArticulo` se ejecuta sobre un artículo con variantes THE SYSTEM SHALL poner `activo` en `false` y mantener la fila y sus variantes consultables.
- [ ] WHEN `listarArticulos` recibe `perPage` igual a 2 sobre un catálogo de al menos 3 artículos THE SYSTEM SHALL devolver exactamente 2 filas.
- [ ] WHEN cualquier función de `src/server/articulos.ts` se invoca sin sesión THE SYSTEM SHALL devolver `error.code` igual a `UNAUTHENTICATED` sin tocar la base de datos.

**Verify**

```bash
pnpm db:migrate:test                       # expect: exit 0
pnpm test tests/server/articulos.test.ts   # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint                # expect: exit 0
pnpm build                                 # expect: exit 0
pnpm test tests/db/schema.test.ts          # expect: exit 0 — el gate del paso 3 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 4: CRUD de articulo y variante"
git tag step-04-articulos
git ls-files --error-unmatch src/server/articulos.ts   # expect: exit 0
```

---

#### Step 5 — CRUD de Unidad y generación de SKU

**Do**

El paso que justifica el sistema.

- `src/server/unidades.ts` — `listarUnidades({ estado?, page, perPage })`, `crearUnidad`,
  `cambiarEstadoUnidad`, implementando el contrato de §5: SKU automático `SKU-` + 10 hexadecimales en
  mayúsculas de `crypto.randomUUID()`; `sku_auto_generado` según el origen; `insert` **sin
  comprobación previa**; violación `23505` de `unidad_sku_unique` → hasta 3 reintentos si era
  automático, `SKU_DUPLICADO` si era manual. La detección acepta `err.code === "23505"` o un mensaje
  que contenga `unidad_sku_unique` o `duplicate key`, porque la forma exacta la decide el driver.
  `cambiarEstadoUnidad` devuelve `UNIDAD_NO_DISPONIBLE` si se intenta volver a `disponible` una pieza
  que ya está en una venta.
- `src/app/(app)/unidades/actions.ts` — Server Actions + `revalidatePath("/unidades")`.
- `src/app/(app)/unidades/page.tsx` — tabla densa con filtro por estado aplicado en SQL, alta con SKU
  opcional e insignia de estado con texto además de color (§7).
- `tests/server/unidades.test.ts` — los cinco casos de abajo.

**Done when**

- [ ] WHEN se crean dos unidades con la misma `variante_id` y sin enviar `sku` THE SYSTEM SHALL insertar dos filas con valores de `sku` distintos y `sku_auto_generado` en `true`.
- [ ] WHEN `crearUnidad` recibe un `sku` manual que ya existe THE SYSTEM SHALL devolver `error.code` igual a `SKU_DUPLICADO` y dejar exactamente una fila con ese `sku`.
- [ ] WHEN `crearUnidad` recibe un `sku` manual nuevo THE SYSTEM SHALL insertar la fila con `sku_auto_generado` en `false`.
- [ ] WHEN se crean 50 unidades seguidas sin enviar `sku` THE SYSTEM SHALL producir 50 valores de `sku` distintos entre sí.
- [ ] WHEN `cambiarEstadoUnidad` intenta poner en `disponible` una unidad que ya pertenece a una venta THE SYSTEM SHALL devolver `error.code` igual a `UNIDAD_NO_DISPONIBLE` y no modificar la fila.

**Verify**

```bash
pnpm db:migrate:test                       # expect: exit 0
pnpm test tests/server/unidades.test.ts    # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint                # expect: exit 0
pnpm build                                 # expect: exit 0
pnpm test tests/server/articulos.test.ts   # expect: exit 0 — el gate del paso 4 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 5: CRUD de unidad y generacion de SKU"
git tag step-05-unidades
git ls-files --error-unmatch src/server/unidades.ts   # expect: exit 0
```

---

#### Step 6 — CRUD de Cliente con bloqueo de borrado

**Do**

- `src/server/clientes.ts` — `listarClientes({ soloActivos, page, perPage })`, `obtenerCliente`,
  `crearCliente`, `editarCliente`, `desactivarCliente`, `eliminarCliente` y `saldoDeCliente(id)`, que
  calcula `sum(venta.monto_total_centavos) - sum(pago.monto_centavos)` **en SQL**, en centavos
  enteros, devolviendo 0 y no `null` cuando no hay ventas. `eliminarCliente` aplica la regla de §5.
- `src/app/(app)/clientes/actions.ts` — Server Actions + `revalidatePath("/clientes")`.
- `src/app/(app)/clientes/page.tsx` — listado con filtro activos/todos, alta, edición y desactivación
  con diálogo de confirmación que nombra al cliente.
- `tests/server/clientes.test.ts` — el caso "cliente con ventas" inserta la venta mínima directamente
  con el cliente de base de datos, porque `crearVenta` llega en el paso 7 y este paso no puede
  depender de él.

**Done when**

- [ ] WHEN `crearCliente` recibe `telefono` vacío THE SYSTEM SHALL devolver `error.code` igual a `VALIDATION_ERROR` y no insertar ninguna fila.
- [ ] WHEN `eliminarCliente` se ejecuta sobre un cliente que tiene al menos una venta asociada THE SYSTEM SHALL devolver `error.code` igual a `CLIENTE_CON_VENTAS` y dejar la fila del cliente intacta.
- [ ] WHEN `eliminarCliente` se ejecuta sobre un cliente sin ventas y sin deuda THE SYSTEM SHALL borrar la fila y hacer que `obtenerCliente` devuelva `NOT_FOUND`.
- [ ] WHEN `desactivarCliente` se ejecuta THE SYSTEM SHALL poner `activo` en `false`, excluir al cliente del listado de activos y mantenerlo accesible por id.
- [ ] WHEN `saldoDeCliente` se consulta para un cliente sin ventas THE SYSTEM SHALL devolver 0 centavos y no `null`.

**Verify**

```bash
pnpm db:migrate:test                       # expect: exit 0
pnpm test tests/server/clientes.test.ts    # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint                # expect: exit 0
pnpm build                                 # expect: exit 0
pnpm test tests/server/unidades.test.ts    # expect: exit 0 — el gate del paso 5 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 6: CRUD de cliente con bloqueo de borrado"
git tag step-06-clientes
git ls-files --error-unmatch src/server/clientes.ts   # expect: exit 0
```

---

#### Step 7 — Creación atómica de Venta

**Do**

- `src/server/ventas.ts` — `listarVentas`, `obtenerVenta(id)` (con líneas y pagos) y `crearVenta`
  exactamente como lo define §5: una transacción con `select … for update` sobre las unidades, aborto
  completo con `UNIDAD_NO_DISPONIBLE` si alguna no está disponible, cálculo del total en centavos,
  inserción de `venta` y de una fila de `venta_unidad` por línea, y paso de todas las piezas a
  `vendida`. `clienteId` es opcional: sin él es venta de contado.
- `src/app/(app)/ventas/actions.ts` — Server Action + `revalidatePath("/ventas")` y
  `revalidatePath("/unidades")`.
- `src/app/(app)/ventas/nueva/page.tsx` — selector de cliente opcional y tabla de piezas
  `disponible`, con precio por línea precargado desde `precio_base_centavos` y editable.
- `src/app/(app)/ventas/page.tsx` — listado con estado e importe.
- `tests/server/ventas.test.ts` — los cinco casos de abajo, incluida la atomicidad.

**Done when**

- [ ] WHEN `crearVenta` recibe dos unidades disponibles THE SYSTEM SHALL crear una venta cuyo `monto_total_centavos` es la suma de los precios enviados y dejar ambas unidades en estado `vendida`.
- [ ] WHEN `crearVenta` recibe una unidad disponible y otra que ya está `vendida` THE SYSTEM SHALL devolver `error.code` igual a `UNIDAD_NO_DISPONIBLE`, no crear ninguna venta y dejar la unidad disponible todavía en estado `disponible`.
- [ ] WHEN `crearVenta` se ejecuta sin `clienteId` THE SYSTEM SHALL crear la venta con `cliente_id` nulo y estado `pendiente`.
- [ ] WHEN se intenta incluir la misma unidad en una segunda venta THE SYSTEM SHALL rechazar la operación y dejar una sola fila de `venta_unidad` para esa unidad.
- [ ] WHEN `crearVenta` recibe una lista de líneas vacía THE SYSTEM SHALL devolver `error.code` igual a `VALIDATION_ERROR` y no escribir nada.

**Verify**

```bash
pnpm db:migrate:test                       # expect: exit 0
pnpm test tests/server/ventas.test.ts      # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint                # expect: exit 0
pnpm build                                 # expect: exit 0
pnpm test tests/server/clientes.test.ts    # expect: exit 0 — el gate del paso 6 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 7: creacion atomica de venta"
git tag step-07-ventas
git ls-files --error-unmatch src/server/ventas.ts   # expect: exit 0
```

---

#### Step 8 — Registro de Pago y recálculo de estado

**Do**

- `src/server/pagos.ts` — `registrarPago` y `listarPagosDeVenta(ventaId)` según §5: transacción,
  `select … for update` sobre la venta, cálculo de `saldo`, **rechazo con `PAGO_EXCEDE_SALDO` si el
  monto supera el saldo** (nunca truncar), inserción del pago y recálculo del estado
  `pendiente`/`parcial`/`pagada`.
- `src/app/(app)/ventas/[id]/actions.ts` — Server Action + `revalidatePath` de la venta y del perfil
  del cliente.
- `src/app/(app)/ventas/[id]/page.tsx` — detalle con líneas, pagos, saldo y formulario de pago
  (monto + método), más el enlace al recibo que llegará en el paso 11.
- `tests/server/pagos.test.ts` — los cinco casos de abajo.

**Done when**

- [ ] WHEN se registra un pago menor que el total de la venta THE SYSTEM SHALL dejar la venta en estado `parcial` y devolver el saldo restante en centavos.
- [ ] WHEN la suma de pagos alcanza el total de la venta THE SYSTEM SHALL dejar la venta en estado `pagada` y devolver saldo 0.
- [ ] WHEN se registra un pago mayor que el saldo pendiente THE SYSTEM SHALL devolver `error.code` igual a `PAGO_EXCEDE_SALDO`, no insertar ninguna fila en `pago` y dejar el estado de la venta sin cambios.
- [ ] WHEN se registra un pago con `montoCentavos` menor o igual a 0 THE SYSTEM SHALL devolver `error.code` igual a `VALIDATION_ERROR` y no escribir nada.
- [ ] WHEN se registra un pago sobre una venta inexistente THE SYSTEM SHALL devolver `error.code` igual a `NOT_FOUND`.

**Verify**

```bash
pnpm db:migrate:test                     # expect: exit 0
pnpm test tests/server/pagos.test.ts     # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint              # expect: exit 0
pnpm build                               # expect: exit 0
pnpm test tests/server/ventas.test.ts    # expect: exit 0 — el gate del paso 7 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 8: registro de pago y recalculo de estado"
git tag step-08-pagos
git ls-files --error-unmatch src/server/pagos.ts   # expect: exit 0
```

---

#### Step 9 — Perfil de Cliente con saldo

**Do**

- `src/server/clientes-perfil.ts` — `perfilDeCliente(id)` que devuelve en una sola llamada: datos del
  cliente, sus ventas con el detalle de unidades (SKU, artículo, variante, precio), sus pagos
  ordenados por fecha, y el saldo actual en centavos calculado en SQL como
  `sum(venta.monto_total_centavos) - sum(pago.monto_centavos)`.
- `src/app/(app)/clientes/[id]/page.tsx` — las tres secciones con sus estados vacíos de §6 y el saldo
  destacado con el color de estado correspondiente (`warning` si > 0, `success` si 0).
- `tests/server/clientes-perfil.test.ts` — los cinco casos de abajo.

**Done when**

- [ ] WHEN un cliente tiene dos ventas y un pago parcial THE SYSTEM SHALL devolver un saldo igual a la suma de los totales menos la suma de los pagos, en centavos enteros.
- [ ] WHEN un cliente no tiene ventas THE SYSTEM SHALL devolver historial de compras vacío, historial de pagos vacío y saldo 0.
- [ ] WHEN se consulta el perfil de un id inexistente THE SYSTEM SHALL devolver `error.code` igual a `NOT_FOUND`.
- [ ] WHEN una venta del cliente está totalmente pagada THE SYSTEM SHALL mostrarla con estado `pagada` y no sumar nada al saldo.
- [ ] WHEN el perfil incluye una venta THE SYSTEM SHALL listar el `sku` de cada unidad vendida en esa venta.

**Verify**

```bash
pnpm db:migrate:test                             # expect: exit 0
pnpm test tests/server/clientes-perfil.test.ts   # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint                      # expect: exit 0
pnpm build                                       # expect: exit 0
pnpm test tests/server/pagos.test.ts             # expect: exit 0 — el gate del paso 8 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 9: perfil de cliente con saldo"
git tag step-09-perfil-cliente
git ls-files --error-unmatch src/server/clientes-perfil.ts   # expect: exit 0
```

---

#### Step 10 — Exportación CSV del inventario

**Do**

- `src/server/exportacion-csv.ts` — `filasDeInventario()` (join `unidad` → `variante` → `articulo`,
  ordenado por `sku`) y `serializarCsv(filas)`, que produce la cabecera literal de §5 y una línea por
  unidad, con `\n`, comillas solo cuando hacen falta y la comilla interior duplicada.
  `precio_base_dop` sale de `src/lib/dinero.ts` por aritmética entera; **está prohibido**
  `toLocaleString`, cuya salida depende del ICU del runtime.
- `src/app/api/v1/exportaciones/inventario/route.ts` — `getSesion()` o 401 con envolvente JSON; si
  hay sesión, 200 con `text/csv; charset=utf-8` y
  `Content-Disposition: attachment; filename="inventario.csv"`.
- `tests/server/exportacion-csv.test.ts` — los cinco casos de abajo.

**Done when**

- [ ] WHEN `serializarCsv` produce la salida THE SYSTEM SHALL emitir como primera línea exactamente `sku,articulo,categoria,color,talla,estado,precio_base_dop`.
- [ ] WHEN el inventario tiene N unidades THE SYSTEM SHALL emitir N líneas de datos además de la cabecera, una por unidad, ordenadas por `sku` ascendente.
- [ ] WHEN el nombre de un artículo contiene una coma o una comilla doble THE SYSTEM SHALL entrecomillar ese campo y duplicar la comilla interior.
- [ ] WHEN un artículo tiene `precio_base_centavos` igual a 145000 THE SYSTEM SHALL escribir `1450.00` en la columna `precio_base_dop`.
- [ ] WHEN se hace GET a `/api/v1/exportaciones/inventario` sin sesión THE SYSTEM SHALL responder 401 con un cuerpo JSON cuyo `error.code` es `UNAUTHENTICATED`.

**Verify**

```bash
pnpm db:migrate:test                               # expect: exit 0
pnpm test tests/server/exportacion-csv.test.ts     # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint                        # expect: exit 0
pnpm build                                         # expect: exit 0
pnpm test tests/server/clientes-perfil.test.ts     # expect: exit 0 — el gate del paso 9 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 10: exportacion CSV del inventario"
git tag step-10-export-csv
git ls-files --error-unmatch src/server/exportacion-csv.ts   # expect: exit 0
```

---

#### Step 11 — Recibo de venta en PDF

**Do**

Primero instala la dependencia de PDF (§11 la marca **sin pin: verificar antes de instalar**) y
comprueba en ese mismo momento que renderiza bajo la versión de React fijada:
`pnpm add @react-pdf/renderer` y una prueba de humo que renderice un documento mínimo a buffer. Si
esa comprobación falla, el paso se detiene y se reporta: es el riesgo que §20.2 anticipa, y la
decisión de sustituir la librería no es del builder.

- `src/server/recibo-pdf.tsx` — `documentoRecibo(venta)`: encabezado con el nombre de la tienda y la
  fecha, datos del cliente (o "Contado" si `cliente_id` es nulo), una fila por unidad con SKU,
  artículo, variante y precio, el total, los pagos registrados y el saldo. Los importes se formatean
  con `src/lib/dinero.ts`.
- `src/app/api/v1/ventas/[id]/recibo/route.ts` — sesión o 401; venta inexistente → 404 con envolvente
  JSON; si todo va bien, 200 con `application/pdf` y
  `Content-Disposition: attachment; filename="recibo-<id>.pdf"`.
- `tests/api/recibo.test.ts` — los cuatro casos de abajo.

**Done when**

- [ ] WHEN se hace GET a `/api/v1/ventas/[id]/recibo` con sesión y una venta existente THE SYSTEM SHALL responder 200 con `Content-Type: application/pdf` y un cuerpo cuyos primeros cinco bytes son `%PDF-`.
- [ ] WHEN la venta no existe THE SYSTEM SHALL responder 404 con un cuerpo JSON cuyo `error.code` es `NOT_FOUND`.
- [ ] WHEN la petición no tiene sesión THE SYSTEM SHALL responder 401 con un cuerpo JSON cuyo `error.code` es `UNAUTHENTICATED`.
- [ ] WHEN la venta no tiene cliente asociado THE SYSTEM SHALL generar el PDF igualmente, sin lanzar, identificando la operación como contado.

**Verify**

```bash
pnpm db:migrate:test                             # expect: exit 0
pnpm test tests/api/recibo.test.ts               # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint                      # expect: exit 0
pnpm build                                       # expect: exit 0
pnpm test tests/server/exportacion-csv.test.ts   # expect: exit 0 — el gate del paso 10 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 11: recibo de venta en PDF"
git tag step-11-recibo-pdf
git ls-files --error-unmatch src/server/recibo-pdf.tsx   # expect: exit 0
```

---

#### Step 12 — Despliegue a Vercel + Neon y CI

**Do**

- `src/lib/env.ts` — editar: añadir un `superRefine` que exija `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL` y `NEXT_PUBLIC_APP_URL` **solo cuando `NODE_ENV === "production"`**. Así ningún
  gate local anterior se rompe (§9, regla de degradación por paso).
- `.env.example` — editar: dejar todas las claves de §10 presentes con valor vacío.
- `.github/workflows/ci.yml` — un job en `ubuntu-latest` con Node 24 y pnpm que ejecuta exactamente
  la puerta de §20.1: `install --frozen-lockfile`, `typecheck`, `lint`, `db:migrate:test`, `test`,
  `build`. `DATABASE_URL` y `TEST_DATABASE_URL` vienen de los secretos del repositorio.
- Despliegue: crear el proyecto en Vercel (`vercel link --yes`), cargar las variables de producción
  (`vercel env add` para cada clave de §10 marcada como secreta), aplicar las migraciones contra la
  base de producción (`DRIZZLE_DATABASE_URL="$PROD_DATABASE_URL" pnpm db:migrate`) **antes** del
  despliegue, y desplegar con `vercel deploy --prod --yes --token "$VERCEL_TOKEN"`. La URL resultante
  se guarda en `PROD_URL` para el gate.

**Done when**

- [ ] WHEN `vercel deploy --prod` termina THE SYSTEM SHALL devolver una URL de producción que responde 200 en `/api/health` con un cuerpo que contiene `"ok":true`.
- [ ] WHEN se hace GET a una ruta protegida de producción sin sesión THE SYSTEM SHALL responder 307 con `Location` conteniendo `/login`.
- [ ] WHEN `NODE_ENV` es `production` y falta `BETTER_AUTH_SECRET` THE SYSTEM SHALL fallar al validar el entorno nombrando esa variable, en lugar de arrancar.
- [ ] WHEN el workflow de CI corre sobre este commit THE SYSTEM SHALL ejecutar los mismos comandos de la puerta global de §20.1, sin omitir ninguno.
- [ ] WHEN `pnpm build` runs en local tras el cambio de `src/lib/env.ts` THE SYSTEM SHALL exit 0 sin exigir las variables de producción.

**Verify**

```bash
pnpm typecheck && pnpm lint                 # expect: exit 0
pnpm build                                  # expect: exit 0 — el gate local no exige variables de producción
grep -q "db:migrate:test" .github/workflows/ci.yml   # expect: exit 0 — CI migra la rama de pruebas
code=$(curl -s -o /dev/null -w '%{http_code}' "$PROD_URL/api/health"); test "$code" = 200
# expect: exit 0 — el despliegue real responde
printf '%s' "$(curl -s "$PROD_URL/api/health")" | grep -q '"ok":true'   # expect: exit 0
prot=$(curl -s -o /dev/null -w '%{http_code}' "$PROD_URL/ventas"); test "$prot" = 307
# expect: exit 0 — producción también redirige al login
pnpm test tests/api/recibo.test.ts          # expect: exit 0 — el gate del paso 11 sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 12: despliegue a vercel + neon y CI"
git tag step-12-deploy
git ls-files --error-unmatch .github/workflows/ci.yml   # expect: exit 0
```

---

#### Step 13 — Suite E2E del flujo crítico y accesibilidad

**Do**

- `scripts/reset-db.ts` — `truncate` de las tablas de dominio (`pago`, `venta_unidad`, `venta`,
  `unidad`, `variante`, `articulo`, `cliente`) en ese orden, **sin tocar las tablas de auth**, contra
  `DATABASE_URL`. Se niega a ejecutarse si la URL contiene el nombre de la base de producción
  definido en `.env` como `PROD_DB_GUARD`.
- `tests/e2e/auth.setup.ts` — proyecto de preparación de Playwright: inicia sesión una vez con
  `OWNER_EMAIL`/`OWNER_PASSWORD` y guarda el `storageState` que reutilizan los demás proyectos.
- `tests/e2e/flujo-critico.spec.ts` — el flujo completo por interfaz: crear artículo → crear variante
  → crear **dos unidades de la misma variante con SKU distinto** → crear cliente → crear venta con
  ambas unidades → registrar un pago parcial → comprobar que la venta queda `parcial` y que el perfil
  del cliente muestra el saldo restante correcto.
- `tests/e2e/a11y.spec.ts` — sobre `/articulos`, `/ventas/nueva` y `/clientes/[id]`: un solo `h1` por
  página, todo input alcanzable por `getByLabel`, recorrido con `Tab` que llega al botón principal, y
  el mensaje de error de un formulario inválido expuesto como texto con `role="alert"`.

`playwright.config.ts` ya está en la raíz desde `workspace/` (§19.6): `testDir: "./tests/e2e"`,
`webServer` que hace `pnpm build && pnpm start` sobre `http://localhost:3000`.

**Done when**

- [ ] WHEN la suite E2E crea dos unidades de la misma variante THE SYSTEM SHALL mostrar dos filas con SKU distintos en `/unidades`.
- [ ] WHEN la suite registra una venta con esas dos unidades THE SYSTEM SHALL dejar ambas con estado `vendida` y la venta en estado `pendiente`.
- [ ] WHEN la suite registra un pago parcial sobre esa venta THE SYSTEM SHALL mostrar la venta en estado `parcial` y el perfil del cliente con un saldo igual al total menos el pago.
- [ ] WHEN la suite intenta registrar un pago mayor que el saldo THE SYSTEM SHALL mostrar el mensaje de error de `PAGO_EXCEDE_SALDO` y dejar el saldo sin cambios.
- [ ] WHEN `pnpm test:e2e tests/e2e/a11y.spec.ts` runs THE SYSTEM SHALL exit 0 con 0 pruebas fallidas.

**Verify**

```bash
pnpm db:reset && pnpm db:seed              # expect: exit 0 — base de e2e en estado conocido
pnpm test:e2e                              # expect: exit 0, 0 failed
pnpm test:e2e tests/e2e/a11y.spec.ts       # expect: exit 0, 0 failed
pnpm typecheck && pnpm lint                # expect: exit 0
pnpm db:migrate:test && pnpm test          # expect: exit 0 — toda la suite unitaria anterior sigue verde
```

**Checkpoint**

```bash
git add -A && git commit -m "step 13: suite e2e del flujo critico y accesibilidad"
git tag step-13-e2e
git ls-files --error-unmatch tests/e2e/flujo-critico.spec.ts   # expect: exit 0
```

---

### 9.1 Parity and cutover

NOT APPLICABLE — greenfield build, no system is being replaced.

---

## 10. Environment Setup

### Prerrequisitos

| Herramienta | Versión | Comprobación |
|---|---|---|
| Node.js | 24.18.0 LTS | `node -v` |
| pnpm | 11.17.0 vía corepack | `pnpm -v` |
| git | cualquiera reciente | `git --version` |
| curl | cualquiera | `curl --version` |
| Vercel CLI | instalada con `pnpm dlx vercel` en el paso 12 | `pnpm dlx vercel --version` |

### Cuentas a crear antes del paso 1

| Servicio | Para qué | URL | Primer paso que la necesita |
|---|---|---|---|
| Neon | Base Postgres: una rama `main` (desarrollo) y una rama `test` | https://console.neon.tech | 1 |
| Vercel | Hosting de la aplicación y variables de producción | https://vercel.com/signup | 12 |
| GitHub | Repositorio remoto y CI | https://github.com/new | 12 |

En Neon hay que crear **dos ramas** y copiar la cadena del **pooler** de cada una: la de `main` va a
`DATABASE_URL` y la de `test` a `TEST_DATABASE_URL`. Sin esas dos cadenas el paso 1 no arranca.

### Variables de entorno

| Variable | Para qué | De dónde sale | Requerida desde el paso | ¿Secreta? |
|---|---|---|---|---|
| `DATABASE_URL` | Conexión de la aplicación y de `db:migrate` | Neon → rama `main` → cadena del **pooler** | 1 | sí |
| `TEST_DATABASE_URL` | Base de las pruebas; `tests/setup.ts` aborta si coincide con la anterior | Neon → rama `test` → cadena del pooler | 3 | sí |
| `BETTER_AUTH_SECRET` | Firma de sesiones; mínimo 32 caracteres | `openssl rand -base64 32` | 2 | sí |
| `BETTER_AUTH_URL` | Origen válido para better-auth | `http://localhost:3000` en local; la URL de Vercel en producción | 2 | no |
| `NEXT_PUBLIC_APP_URL` | Enlaces absolutos y `baseURL` de Playwright | `http://localhost:3000` en local; la URL de Vercel en producción | 2 | no |
| `OWNER_EMAIL` | Correo del usuario dueño que crea la semilla | Lo elige el dueño | 3 | no |
| `OWNER_PASSWORD` | Contraseña del dueño; mínimo 12 caracteres | Lo elige el dueño | 3 | sí |
| `DRIZZLE_DATABASE_URL` | Sobrescribe el destino de drizzle-kit (rama de pruebas, producción) | La pone el comando, no el archivo `.env` | 3 | sí |
| `PROD_DB_GUARD` | Fragmento de la cadena de producción que `scripts/reset-db.ts` se niega a truncar | Nombre de la base de producción en Neon | 13 | no |
| `VERCEL_TOKEN` | Despliegue no interactivo | Vercel → Account Settings → Tokens | 12 | sí |
| `PROD_URL` | URL de producción que verifica el paso 12 | La imprime `vercel deploy --prod` | 12 | no |

`.env.example` está commiteado con todas las claves y valores vacíos. `.env` y `.env.*.local` están
ignorados. La aplicación valida el entorno al arrancar y falla ruidosamente; nunca cae a un valor por
defecto para un secreto.

**"Requerida desde el paso" es un contrato con §9**, no una nota: el validador trata una variable
como obligatoria solo a partir del paso indicado, y el módulo que la consume es quien la exige
(`src/lib/auth.ts` para las de auth, `src/lib/env.ts` en modo producción para el resto). Así la
llegada de un paso no rompe el gate de un paso anterior.

**Listar una variable aquí no la carga.** Next lee `.env` para la aplicación; nadie lo lee para
drizzle-kit, para los scripts ni para Vitest. El mecanismo explícito de carga está escrito en §19.6,
*Every tool that reads env vars*: cada herramienta carga el archivo desde su propio archivo de
configuración con `process.loadEnvFile()`.

### Archivos que deben quedar commiteados

El `.gitignore` que genera `create-next-app` incluye `.env*`, que se traga `.env.example`. La
excepción se escribe como línea literal en el bloque de Bootstrap, **después** del patrón que anula.

| Archivo | Por qué se commitea | Línea de excepción en el ignore |
|---|---|---|
| `.env.example` | Es el contrato de variables que lee el builder | `!.env.example` después de `.env*` |
| `biome.json` | Define el gate de lint que corre en el paso 1 | — no lo alcanza ningún patrón |
| `tsconfig.json` | Lleva la exclusión de `blueprints/` y el alias `@/` | — no lo alcanza ningún patrón |
| `vitest.config.ts` · `playwright.config.ts` · `tests/setup.ts` | Sin ellos ningún `Verify` puede ejecutarse | — no los alcanza ningún patrón |
| `scripts/db-migrate-test.ts` | Lo invoca `pnpm db:migrate:test` en casi todos los pasos | — no lo alcanza ningún patrón |
| `drizzle/**` | Las migraciones son código fuente, no artefactos | — no las alcanza ningún patrón |
| `pnpm-lock.yaml` | `--frozen-lockfile` es el primer gate del paso 1 | — no lo alcanza ningún patrón |
| `.claude/**`, `CLAUDE.md`, `AGENTS.md` | Configuración del agente que construye | — no los alcanza ningún patrón |
| `.github/workflows/ci.yml` | Es la puerta de §20.1 automatizada | — no lo alcanza ningún patrón |
| `blueprints/inventario-tienda/**` | Este bundle es la especificación del proyecto | — no lo alcanza ningún patrón |

### Bootstrap

```bash
# order matters: scaffold -> install -> pins -> config (biome/tsconfig) -> ignore file + excepciones
#                -> copia de workspace/ -> formato -> repo init -> primer commit -> .env -> migrar
# Todo comando de este bloque es no interactivo y seguro de volver a ejecutar.

# 1. Toolchain. `corepack enable` a secas falla con EACCES donde el bin global no es escribible
#    (Node instalado como root, casi toda imagen de CI). Directorio escribible explícito:
corepack enable --install-directory "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
corepack prepare pnpm@11.17.0 --activate
node -v    # expect: v24.x

# 2. Scaffold. `--eslint=false` NO desactiva ESLint: la opción no toma valor y se ignora en silencio.
#    `--biome` es la que da un proyecto solo-Biome.
#    Este comando ABORTA su propia instalación con ERR_PNPM_IGNORED_BUILDS y aun así sale 0.
pnpm create next-app@latest inventario-tienda --ts --app --tailwind --biome --src-dir --use-pnpm
cd inventario-tienda

# 3. pnpm 11 no ejecuta scripts de build sin permiso y `pnpm install` sale 1, no advierte.
#    La clave de pnpm 11 es `allowBuilds`, NO `onlyBuiltDependencies` (la vieja se acepta y no hace nada).
pnpm approve-builds --all
pnpm install --frozen-lockfile    # este es el gate real: solo sale 0 después de la línea anterior

# 4. Pins de §11. El scaffold fija biome 2.2.0 y typescript ^5: se sobrescriben aquí.
pnpm add next@16.3.5 react@19.3.0 react-dom@19.3.0
pnpm add drizzle-orm@0.45.2 @neondatabase/serverless@1.1.0 better-auth@1.7.5 zod@4.4.3 react-hook-form@7.83.0 ws
pnpm add -D typescript@~6.0.3 @biomejs/biome@2.5.5 vitest@4.1.10 @playwright/test@1.62.0 drizzle-kit@0.31.10 tsx@4.23.1 @types/ws @types/react@19.2.17 @types/react-dom@19.2.3
pnpm add -D tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3
pnpm exec playwright install --with-deps   # sin los binarios, el e2e falla en seco

# 5. Scripts y metadatos del manifiesto. El scaffold ya creó package.json: aquí solo se le añade.
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.lint="biome check ."
npm pkg set scripts.format="biome check --write ."
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:e2e="playwright test"
npm pkg set scripts.db:generate="drizzle-kit generate"
npm pkg set scripts.db:migrate="drizzle-kit migrate"
npm pkg set scripts.db:migrate:test="tsx scripts/db-migrate-test.ts"
npm pkg set scripts.db:studio="drizzle-kit studio"
npm pkg set scripts.db:seed="tsx scripts/seed.ts"
npm pkg set scripts.db:reset="tsx scripts/reset-db.ts"
npm pkg set engines.node=">=24.18.0"
echo "24" > .nvmrc

# 6. biome.json. `--biome` ya lo escribió y `biome init` se niega a sobrescribirlo, así que se
#    escribe entero aquí: Biome 2.5.5 no parsea el @theme de Tailwind v4 sin `tailwindDirectives`,
#    y el bundle vive dentro del proyecto, así que hay que excluir blueprints/.
#    VERIFICADO en vivo (2026-09-16), tres correcciones sobre la primera versión de este archivo:
#    (a) los patrones de carpeta van SIN el sufijo `/**` — Biome 2.5.5 lo marca como error
#        (`lint/suspicious/useBiomeIgnoreFolder`) y `pnpm lint` sale 1 solo por el propio config;
#    (b) `rules.recommended: true` es un campo obsoleto — `biome migrate` lo reescribe solo hasta
#        `"preset": "none"` (linter DESACTIVADO, no advierte de nada y el gate pasa por las razones
#        equivocadas), así que aquí se escribe directamente `"preset": "recommended"`;
#    (c) `public/` — que `create-next-app` llena con los 5 SVG de stock (`file.svg`, `globe.svg`,
#        `next.svg`, `vercel.svg`, `window.svg`) — se excluye: sin título, disparan
#        `lint/a11y/noSvgWithoutTitle` como error y bloquean el gate del paso 1 antes de que exista
#        una sola línea de código propio. Ningún paso de este blueprint los usa ni los edita.
cat > biome.json <<'JSON'
{
  "$schema": "https://biomejs.dev/schemas/2.5.5/schema.json",
  "files": {
    "includes": ["**", "!blueprints", "!.next", "!drizzle", "!node_modules", "!public"]
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": { "enabled": true, "rules": { "preset": "recommended" } },
  "javascript": { "formatter": { "quoteStyle": "double", "semicolons": "always" } },
  "css": { "parser": { "tailwindDirectives": true } },
  "assist": { "actions": { "source": { "organizeImports": "on" } } }
}
JSON

# 7. tsconfig.json: excluir el bundle para que tsc no compile una segunda copia de los configs.
node -e "const fs=require('fs');const p='tsconfig.json';const c=JSON.parse(fs.readFileSync(p,'utf8'));c.exclude=Array.from(new Set([...(c.exclude||[]),'node_modules','blueprints','.next']));fs.writeFileSync(p,JSON.stringify(c,null,2)+'\n');"

# 8. Ignore file y sus excepciones, ANTES del primer commit: una ruta ya trackeada no la excluye
#    ninguna regla posterior.
printf '\n# excepciones y artefactos de prueba\n!.env.example\n/playwright-report/\n/test-results/\n/blob-report/\n' >> .gitignore

# 9. Primitivas de shadcn. `shadcn init` a secas pregunta y bloquea un build desatendido;
#    el preset por defecto de la CLI es Base UI, así que Radix se pide explícitamente.
#    VERIFICADO en vivo (2026-09-16): `--base radix --no-monorepo` NO basta — la CLI 4.16.0
#    sigue abriendo un selector interactivo de preset (Nova/Vega/Maia/.../Custom) y cuelga un
#    build desatendido pese a esas banderas. `-y` por sí solo tampoco lo salta. El preset elegido
#    (íconos + fuente) es un eje independiente de `--base`; se fija "nova" porque es el default de
#    la propia CLI (`-d/--defaults` usa `--preset=base-nova`) y no afecta la librería de componentes.
pnpm dlx shadcn@4.16.0 init --base radix --no-monorepo --preset nova -y

# 10. Copia del workspace del bundle. NO clobber: el manifiesto y el lockfile nunca se sobrescriben
#     una vez instaladas las dependencias; una copia sin guarda los revertiría y el siguiente
#     comando fallaría por un binario ausente, que se lee como instalación rota.
#     VERIFICADO en vivo (2026-09-16): `rsync` no está garantizado — ausente en Git Bash de
#     Windows (`rsync: command not found`), que es un entorno real de builder para este stack.
#     Se usa la guarda por marcador en su lugar: portable, no depende de `rsync` ni de la
#     diferencia de código de salida de `cp -n` entre BSD/macOS (sale 1 al saltar) y GNU (sale 0).
[ -e .workspace-applied ] || { cp -R blueprints/inventario-tienda/workspace/. ./ && touch .workspace-applied; }

# 11. Formato único para reconciliar el scaffold y los archivos recién copiados con biome.json.
pnpm exec biome check --write .

# 12. Repositorio y primer commit: §9 etiqueta cada paso y §20.1 cuenta las etiquetas, así que el
#     repositorio tiene que existir antes del paso 1. El scaffold no siempre lo crea.
git rev-parse --git-dir >/dev/null 2>&1 || git init -b main   # idempotente
git add -A && git commit -m "chore: scaffold" --allow-empty

# 13. Entorno local. Rellena DATABASE_URL y TEST_DATABASE_URL con las dos ramas de Neon antes
#     de seguir; la última línea falla a propósito si siguen vacías.
[ -f .env ] || cp .env.example .env
grep -q '^DATABASE_URL=postgres' .env       # expect: exit 0 — el .env ya tiene una cadena real
grep -q '^TEST_DATABASE_URL=postgres' .env  # expect: exit 0
```

Tras este bloque el paso 1 puede empezar. Las migraciones y la semilla no corren aquí: las ejecuta el
paso 3, que es quien crea el esquema.

---

## 11. Dependencies

Esta sección es la tabla de procedencia de versiones y **el único lugar de la prosa donde aparece un
número de versión**. Las filas marcadas `UNVERIFIED — verify before install` no fueron comprobadas en
vivo esta sesión: se instalan sin pin y hay que verificarlas antes.

### Runtime

| Paquete | Versión | Fuente | Comprobado | Instalado por | Propósito |
|---|---|---|---|---|---|
| Node.js | 24.18.0 LTS | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Prerrequisitos (lo instala la persona) | Runtime del servidor y de los scripts |
| pnpm | 11.17.0 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap (`corepack prepare`) | Gestor de paquetes con `node_modules` estricto |
| next | 16.3.5 | stack-researcher — registro npm | 2026-09-15 | §10 Bootstrap (`pnpm add next@16.3.5`) | Framework de la aplicación |
| react / react-dom | 19.3.0 | stack-researcher — registro npm | 2026-09-15 | §10 Bootstrap | Librería de UI |
| drizzle-orm | 0.45.2 | stack-researcher — registro npm (sin cambios) | 2026-09-15 | §10 Bootstrap | ORM; el esquema TS es la fuente de verdad |
| @neondatabase/serverless | 1.1.0 | stack-researcher — registro npm (sin cambios) | 2026-09-15 | §10 Bootstrap | Driver de Neon; se usa el `Pool` por WebSocket para tener transacciones interactivas |
| better-auth | 1.7.5 | stack-researcher — registro npm | 2026-09-15 | §10 Bootstrap | Auth self-hosted. **Breaking change respecto a 1.6.x**: `Account.accountId` pasó a `providerAccountId`; el paso 2 contrasta el esquema con `npx auth@latest generate` |
| zod | 4.4.3 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap | Validación en cada borde. No verificado en vivo esta sesión |
| react-hook-form | 7.83.0 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap | Estado de formularios. No verificado en vivo esta sesión |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap | Estilos; configuración en CSS |
| ws | sin pin — **UNVERIFIED — verify before install** | — | — | §10 Bootstrap (`pnpm add ws`) | Constructor de WebSocket que exige el driver de Neon en Node |
| @react-pdf/renderer | sin pin — **UNVERIFIED — verify before install** | — | — | Paso 11 (`pnpm add @react-pdf/renderer`) | Render del recibo a PDF. Comprobar compatibilidad con React 19.3.0 en la prueba de humo del propio paso 11 |

### Desarrollo

| Paquete | Versión | Fuente | Comprobado | Instalado por | Propósito |
|---|---|---|---|---|---|
| typescript | ~6.0.3 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap | Compilador. Se fija la línea 6.x: Next rechaza TS 7 salvo con una bandera experimental |
| @biomejs/biome | 2.5.5 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap | Lint y formato. No verificado en vivo esta sesión |
| vitest | 4.1.10 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap | Pruebas de unidad e integración. No verificado en vivo |
| @playwright/test | 1.62.0 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap | E2E. No verificado en vivo |
| drizzle-kit | 0.31.10 | stack-researcher — registro npm (sin cambios) | 2026-09-15 | §10 Bootstrap | Generación y aplicación de migraciones |
| tsx | 4.23.1 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap | Ejecuta los scripts `.ts` respetando el alias `@/` |
| shadcn (CLI) | 4.16.0 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap (`pnpm dlx shadcn@4.16.0 init`) | Copia primitivas al repo; no es dependencia de runtime |
| @types/react / @types/react-dom | 19.2.17 / 19.2.3 | `knowledge/runtime-tracks/ts-node.md` | 2026-07-27 | §10 Bootstrap | Tipos de React |
| @types/ws | sin pin — **UNVERIFIED — verify before install** | — | — | §10 Bootstrap | Tipos del constructor de WebSocket |

### Deliberadamente no usados

| Rechazado | En su lugar | Por qué |
|---|---|---|
| prisma | drizzle-orm | Cliente generado y una segunda fuente de verdad para un esquema que aquí se audita en SQL |
| @tanstack/react-query | Server Components + `revalidatePath()` | Con un usuario, una caché de cliente es una segunda copia de la verdad que se desincroniza |
| stripe | — | No se cobra en línea: §1 lo declara non-goal |
| eslint / prettier | @biomejs/biome | Una herramienta y un archivo de configuración en vez de dos cadenas que reconciliar |
| dotenv | `process.loadEnvFile()` de Node 24 | Misma función, cero dependencias, disponible en el runtime que ya está fijado |
| @axe-core/playwright | Aserciones explícitas en `tests/e2e/a11y.spec.ts` | Evita una dependencia sin verificar en el último paso del build; las comprobaciones que importan aquí (etiquetas, `h1`, foco) se asertan directamente |

---

## 12. Deployment Strategy

### Hosting

**Vercel**, plan Hobby, región `iad1` (la más cercana a la región por defecto de Neon; mantener app y
base en la misma región evita sumar latencia a cada consulta). Framework detectado automáticamente:
build `pnpm build`, directorio de salida gestionado por el adaptador de Next, runtime Node 24
declarado por `engines.node` y `.nvmrc`. La base es **Neon**, plan gratuito, con una rama por entorno.

### Entornos

| Entorno | Rama | URL | Base de datos | Modo de terceros |
|---|---|---|---|---|
| Local | — | `http://localhost:3000` | Neon rama `main` (desarrollo) | — |
| Pruebas | — | — | Neon rama `test` | — |
| Preview | cualquier PR | URL automática de Vercel | Neon rama `test` | — |
| Producción | `main` | URL de producción de Vercel | Neon rama de producción | — |

No hay claves de terceros que cambiar entre entornos: este producto no integra ninguno.

### CI/CD

`.github/workflows/ci.yml`, en cada push y cada PR, en `ubuntu-latest`:

1. `actions/checkout`
2. `corepack enable && corepack prepare pnpm@11.17.0 --activate`, Node 24
3. `pnpm install --frozen-lockfile`
4. `pnpm typecheck`
5. `pnpm lint`
6. `pnpm db:migrate:test`
7. `pnpm test`
8. `pnpm build`

Son exactamente los comandos de §20.1 que no necesitan un navegador ni una URL de producción. Si un
check está en la puerta, está en CI; sin excepciones. El E2E se ejecuta localmente antes de
desplegar, porque exige base con datos y servidor arrancado.

### Publicación y reversión

Un merge a `main` despliega. Revertir es promover el despliegue anterior desde el panel de Vercel
(`vercel rollback` con la URL del despliegue previo), operación de segundos porque el artefacto
anterior sigue publicado. **Orden respecto a las migraciones:** primero se aplica la migración
(expandir), después se despliega el código. Una migración destructiva (contraer) va en un despliegue
posterior, nunca en el mismo, para que revertir el código no deje el esquema inservible.

### Dominio, DNS, TLS

En v1 se usa el dominio `*.vercel.app` que asigna la plataforma: no hay clientes externos que
memoricen una URL y un dominio propio añade una espera de propagación al build. Si el dueño compra
uno: registro `A` del ápice a `76.76.21.21`, `CNAME` de `www` a `cname.vercel-dns.com`, certificado
emitido y renovado automáticamente por Vercel, y redirección permanente de ápice a `www` configurada
en el panel. Esa compra es una tarea del checklist de lanzamiento (§20.1), no un paso de build.

---

## 13. Testing Strategy

| Capa | Framework | Qué cubre | Dónde | Cuándo corre |
|---|---|---|---|---|
| Unidad | Vitest | `src/lib/dinero.ts`, serialización CSV, generación de SKU, esquemas zod | `tests/server/**`, `tests/api/**` | Cada commit |
| Integración | Vitest contra la rama `test` de Neon | Cada módulo de `src/server/` con transacciones y constraints reales | `tests/server/**`, `tests/db/**` | Cada commit |
| E2E | Playwright | El flujo crítico completo y las comprobaciones de accesibilidad | `tests/e2e/**` | Antes de desplegar |

### Flujos críticos cubiertos E2E

1. Artículo → variante → **dos unidades de la misma variante con SKU distinto** → cliente → venta →
   pago parcial → saldo actualizado. Es el flujo que define el producto.
2. Rechazo de un pago que excede el saldo, con el saldo intacto después.
3. Redirección al login de una ruta protegida sin sesión, y vuelta a la ruta pedida tras entrar.

### Datos de prueba

Las pruebas de integración corren contra una **rama `test` de Neon**, nunca contra la base de
desarrollo: `tests/setup.ts` (emitido en §19.6) carga `.env`, exige `TEST_DATABASE_URL`, **aborta si
coincide con `DATABASE_URL`** y reasigna `process.env.DATABASE_URL` antes de que cualquier módulo
importe el cliente. El esquema se aplica con `pnpm db:migrate:test`, que usa el script emitido en
§19.6. Cada archivo de prueba crea sus propios datos con sufijos `crypto.randomUUID()` y no depende
del orden. El E2E corre contra la base de desarrollo, puesta en estado conocido con
`pnpm db:reset && pnpm db:seed`.

La base es un servicio alojado, no un contenedor local: el build exige red y las dos cadenas de
conexión de §10 desde el paso 1. Es una decisión consciente (§20.3, decisión 4): el driver HTTP/WS de
Neon se comporta distinto a un Postgres TCP local, y probar contra el segundo demostraría algo que no
es lo que corre en producción.

### Lo que deliberadamente no se prueba

- El render visual de las páginas: no hay pruebas de instantánea de píxeles. Con un solo usuario, el
  costo de mantenerlas supera lo que atrapan.
- El interior de better-auth y de drizzle: se prueba nuestro uso (redirección, sesión, constraints),
  no la librería.
- El contenido visual del PDF: se comprueba que es un PDF válido y que la ruta responde, no la
  maquetación. Comprobar píxeles de un PDF es frágil y el recibo lo revisa una persona.

---

## 14. Security & Secrets

| Preocupación | Control | Implementado en |
|---|---|---|
| Almacenamiento de secretos | Variables de entorno de Vercel y `.env` local ignorado; nunca en el repositorio | §10, panel de Vercel |
| Rotación de secretos | `BETTER_AUTH_SECRET` y `OWNER_PASSWORD` se rotan al menos una vez al año y de inmediato ante sospecha; rotar el primero cierra todas las sesiones | `CLAUDE.md`, §20.1 |
| Validación de entrada | `zod` en cada Server Action y cada route handler, antes de tocar la base | `src/server/**` |
| Codificación de salida / XSS | React escapa por defecto; no se usa `dangerouslySetInnerHTML` en ninguna parte | `src/app/**`, `src/components/**` |
| Inyección SQL | Solo consultas parametrizadas de Drizzle; prohibido construir SQL concatenando cadenas | `src/server/**`, `src/lib/db/**` |
| AuthN / AuthZ | Sesión comprobada en el servidor en cada petición y dentro de cada Server Action (§8) | `proxy.ts`, `src/lib/auth.ts` |
| CSRF | `SameSite=Lax`, validación de `Origin` de better-auth contra `BETTER_AUTH_URL` y la comprobación de origen de las Server Actions | `src/lib/auth.ts` |
| Límite de tasa / abuso | El límite de intentos de inicio de sesión de better-auth, activo; el resto del producto tiene un usuario | `src/lib/auth.ts` |
| Verificación de webhooks | NOT APPLICABLE — este sistema no recibe webhooks de nadie | — |
| Auditoría de dependencias | `pnpm audit --prod` en CI; lo arregla quien mantiene el repositorio | `.github/workflows/ci.yml` |
| Cabeceras de seguridad | En `next.config.ts`: `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'` | `next.config.ts` (paso 12) |
| Datos personales | Se guardan nombre, teléfono y dirección de clientes. Sin retención definida por ley aquí; el borrado real existe (`eliminarCliente`) para clientes sin ventas y la desactivación conserva el historial contable | `src/server/clientes.ts` |
| Higiene de logs | Nunca se registran contraseñas, tokens, cookies ni cadenas de conexión; los errores se loguean por código y mensaje propio, no volcando el objeto del driver | `src/server/**` |

**Reglas duras**

- Ningún secreto se commitea, se imprime en un log, se envía a un rastreador de errores ni se incrusta
  en el bundle del cliente. Todo lo que llega al navegador es público: se trata como tal.
- Toda comprobación de autorización corre **antes** del trabajo, no después.
- Las cadenas de conexión solo se leen a través de `src/lib/env.ts`; `process.env` no se lee en
  ningún otro archivo.

Este proyecto no maneja datos de salud, financieros regulados ni de menores, y no opera en la UE: no
hay régimen regulatorio aplicable más allá del deber general de custodia de los datos de contacto de
los clientes. Si la tienda empezara a emitir comprobantes fiscales, esa afirmación deja de valer y el
non-goal correspondiente de §1 se reabre.

---

## 15. Accessibility

**Objetivo: WCAG 2.2 nivel AA.** El dueño usa esto varias horas al día: la operación por teclado es
productividad antes que cumplimiento.

### Requisitos base

| Requisito | Regla |
|---|---|
| HTML semántico | Landmarks (`header`/`nav`/`main`), un solo `h1` por página, encabezados en orden, listas para listas, `<table>` real con `<th scope>` para el inventario |
| Teclado | Todo elemento interactivo alcanzable y operable por teclado, orden de tabulación lógico, sin trampas, enlace "Saltar al contenido" |
| Foco visible | Indicador visible en todo elemento enfocable, con `--primary` a ≥3:1 contra su fondo |
| Contraste | Texto 4.5:1, texto grande y contornos 3:1 — la paleta de §7 ya lo cumple y `--border-strong` existe por eso |
| Formularios | Todo input con etiqueta programática; errores en texto, nunca solo color; error anunciado con `role="alert"` |
| Imágenes | Las significativas con `alt`; las decorativas con `alt=""` |
| Movimiento | Todo lo animado respeta `prefers-reduced-motion: reduce` (§7) |
| Zoom / reflujo | Usable al 200% y a 320 CSS px de ancho sin scroll horizontal: bajo `md` las tablas se apilan en tarjetas |
| Regiones vivas | El resultado de una venta o un pago se anuncia con `aria-live="polite"` |

### Añadidos de WCAG 2.2 más olvidados

| SC | Requisito |
|---|---|
| 2.4.11 Foco no oscurecido | El encabezado fijo nunca tapa el elemento enfocado: la navegación reserva su altura con `scroll-margin-top` |
| 2.5.7 Movimientos de arrastre | No existe ninguna interacción de arrastre en el producto: seleccionar piezas es con casillas |
| 2.5.8 Tamaño del objetivo | Objetivos de al menos 24×24 CSS px; 36×36 en acciones de fila (§7) |
| 3.3.7 Entrada redundante | El alta de venta precarga el precio desde `precio_base_centavos` y el cliente seleccionado no se vuelve a pedir en el pago |
| 3.3.8 Autenticación accesible | Sin prueba cognitiva; el campo de contraseña permite pegar y funciona con gestor de contraseñas |

### Verificación

```bash
pnpm test:e2e tests/e2e/a11y.spec.ts   # expect: exit 0, 0 failed
```

Esa suite comprueba, sobre `/articulos`, `/ventas/nueva` y `/clientes/[id]`: un solo `h1`, todo input
alcanzable por `getByLabel`, recorrido con `Tab` hasta la acción principal, y el error de formulario
expuesto como texto con `role="alert"`. Las comprobaciones automáticas no cubren todo: antes de
lanzar se hace un recorrido solo con teclado de los tres flujos críticos, una pasada con lector de
pantalla sobre el flujo de venta y una pasada al 200% de zoom en el breakpoint más estrecho (§20.1).

---

## 16. Observability & Cost

### Instrumentación

| Señal | Herramienta | Qué captura | Quién la mira |
|---|---|---|---|
| Errores | Vercel Runtime Logs | Excepciones no controladas con ruta y marca de tiempo; sin PII ni secretos | El dueño del repositorio, tras un reporte |
| Logs | `console.error`/`console.info` estructurados en JSON con `evento`, `entidad` e `id`, recogidos por Vercel | Mutaciones de dominio y errores | El dueño del repositorio |
| Métricas | Vercel Analytics (incluido en el plan) | Peticiones, duración, tasa de error por ruta | Revisión semanal |
| Uptime | Monitor externo gratuito sobre `/api/health` cada 5 minutos | Disponibilidad real de aplicación + base | Alerta al correo del dueño |

No se instala Sentry en v1: con un usuario, los logs de la plataforma y el monitor de salud dan la
misma señal sin una dependencia más ni un coste mensual.

### Métricas que importan aquí

| Métrica | Objetivo | Alerta en |
|---|---|---|
| p95 de `crearVenta` (extremo a extremo) | < 800 ms | > 2 s durante 10 minutos |
| Tasa de error 5xx en rutas de `(app)` | < 0.5% | > 2% durante 10 minutos |
| Disponibilidad de `/api/health` | ≥ 99% mensual | 3 sondeos fallidos seguidos |
| Piezas `disponible` en inventario | Señal de negocio, sin umbral técnico | < 10 piezas: aviso de reposición al dueño |

### Health check

`GET /api/health` ejecuta `select 1` contra Neon y responde 200 solo si la consulta vuelve; 503 si
falla. No comprueba si las migraciones están al día, porque estas se aplican como paso de despliegue
y un desajuste se detecta en ese paso, no en tiempo de ejecución. Lo sondea el monitor externo cada 5
minutos.

### Modelo de costos

| Servicio | Capa gratuita | Costo a escala v1 | Costo a 10× | Precipicio a vigilar |
|---|---|---|---|---|
| Vercel | Hobby: 100 GB de ancho de banda | US$0/mes | US$0/mes | Uso comercial obliga al plan Pro (US$20/mes) |
| Neon | 0.5 GB de almacenamiento y horas de cómputo limitadas | US$0/mes | US$0-19/mes | Superar el almacenamiento o las horas de cómputo de la capa gratuita |
| Monitor de uptime | Plan gratuito con sondeo cada 5 min | US$0/mes | US$0/mes | Sondeo por debajo de 1 minuto |
| Dominio propio (opcional) | — | US$0 (sin dominio en v1) | ~US$12/año | — |

**Costo mensual estimado al lanzar: US$0.** La mayor partida potencial es Vercel: el plan Hobby
prohíbe el uso comercial, así que en cuanto esto opere un negocio real corresponde Pro a US$20/mes —
es una decisión de licencia, no de tráfico, y es la palanca más barata de vigilar. Ningún servicio
escala de forma superlineal con el uso a este tamaño.

---

## 17. Model Routing

NOT APPLICABLE — this project does not call an LLM at runtime.

---

## 18. Skills to Use During Build

| Skill | Pasos de §9 | Qué aporta ahí | Instalación |
|---|---|---|---|
| `ui-ux-pro-max` | 4, 5, 6, 7, 8, 9 | Estilo de tablas densas, formularios y diálogos, y una paleta de estado que sobrevive al modo oscuro | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` y después `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| `frontend-design` | 4, 7, 9 | Maquetación del shell del panel y de las vistas listado/detalle | `/plugin marketplace add anthropics/skills` y después `/plugin install example-skills@anthropic-agent-skills` |
| `playwright-cli` | 13 | Construcción y depuración de la suite E2E del flujo crítico | `npm install -g @playwright/cli@latest` y después `playwright-cli install --skills` |
| `pdf` | 11 | Generación y comprobación del recibo en PDF | `/plugin marketplace add anthropics/skills` y después `/plugin install document-skills@anthropic-agent-skills` |

Ninguna de las cuatro lleva barra: **se activan por intención**, no como comando. Ninguna es
obligatoria: si una no está instalada, el builder sigue con la guía de este blueprint, anota la
sustitución en una línea y continúa.

---

## 19. Agent Workspace

Los archivos de abajo se emiten como archivos reales bajo `blueprints/inventario-tienda/workspace/` y
llegan a la raíz del proyecto con **una sola copia guardada** en §10 Bootstrap:

```
[ -e .workspace-applied ] || { cp -R blueprints/inventario-tienda/workspace/. ./ && touch .workspace-applied; }
```

Se usa una guarda por **marcador** (`.workspace-applied`), no `rsync` ni `cp -Rn`: `rsync` no está
garantizado en todo entorno de build — verificado en vivo, ausente en Git Bash de Windows — y
`cp -Rn` **sale 1 en BSD/macOS cuando salta un archivo existente**, que es justo el caso para el que
se puso la guarda; bajo `set -e` la segunda ejecución de Bootstrap abortaría en la línea que existe
para hacerla segura. El marcador evita ambos problemas: la segunda ejecución ni siquiera intenta la
copia. **Nunca se sobrescriben `package.json` ni `pnpm-lock.yaml`** una vez instaladas las
dependencias: una copia sin guarda los revertiría a su versión sin dependencias y el siguiente
comando fallaría nombrando un binario ausente, error que se lee como instalación rota y hace perder
el paso entero.

**`.claude/commands/` no se emite nunca**: un comando de barra solo se dispara cuando una persona lo
escribe, y un builder autónomo no escribe nada. Los flujos repetibles van en §19.4.

### 19.1 `CLAUDE.md`

Emitido en `workspace/CLAUDE.md` (176 líneas). Contiene, en este orden: la tabla de comandos, la
puerta `pnpm typecheck && pnpm lint && pnpm test`, el stack en una línea, el recorrido de una
petición real por archivos reales, la tabla de direcciones de importación permitidas, la tabla de
fuentes únicas de verdad, ocho reglas de código numeradas y comprobables, los tokens de diseño
literales de §7, la tabla de variables de entorno, el índice de reglas de `.claude/rules/` y seis
líneas no negociables.

### 19.2 `AGENTS.md`

Emitido en `workspace/AGENTS.md`. Es el puente para agentes que no leen `CLAUDE.md`: una línea de
descripción, la tabla de comandos, las no negociables y el puntero a `CLAUDE.md` como fuente de
verdad. No duplica arquitectura ni tokens.

### 19.3 `.claude/settings.json`

Emitido en `workspace/.claude/settings.json`. Pre-aprueba **todos** los comandos que aparecen en
algún bloque `Verify` de §9 y en la puerta de §20.1 — instalación, typecheck, lint, build, start,
test, e2e, los cinco comandos `db:*`, `curl`, `grep`, `test`, `sleep`, `kill`, `printf`, `node`,
`npm pkg`, `pnpm exec`, `pnpm dlx`, `cp` y los comandos de git de lectura y etiquetado. Deniega
leer `.env`, hacer `git push`, `drizzle-kit drop` y `vercel remove`.

### 19.4 Project skills

| Skill | Se dispara con | Qué automatiza |
|---|---|---|
| `agregar-migracion` | "añadir columna", "cambiar el esquema", "nueva tabla" | Editar `src/lib/db/schema.ts`, `pnpm db:generate`, aplicar a desarrollo y a la rama de pruebas, y comprobar que la constraint esperada está en el SQL generado sin editarlo a mano |
| `agregar-recurso-crud` | "nuevo recurso", "añadir CRUD de …" | Crear el módulo de `src/server/`, su `actions.ts`, su página y su archivo de pruebas siguiendo la envolvente `Resultado<T>` y la comprobación de sesión |

Ambos se emiten en `workspace/.claude/skills/<nombre>/SKILL.md` con frontmatter `name` y
`description`.

### 19.5 `.claude/rules/*.md`

| Archivo | Globs de `paths` | Cubre |
|---|---|---|
| `.claude/rules/base-de-datos.md` | `src/lib/db/**`, `drizzle/**`, `drizzle.config.ts`, `scripts/**` | Esquema, migraciones generadas que no se editan, dinero en centavos, unicidad impuesta por la base |
| `.claude/rules/servidor.md` | `src/server/**`, `src/app/**/actions.ts` | `Resultado<T>`, códigos de error cerrados, sesión en cada acción, validación zod en el borde, transacciones |
| `.claude/rules/interfaz.md` | `src/app/**`, `src/components/**` | Server Components por defecto, `"use client"` en la hoja, tokens de §7, estados vacío/carga/error, accesibilidad |

### 19.6 Verify-critical config and local infrastructure

Archivos emitidos como archivos reales bajo `workspace/`, en la ruta que ocupan en el proyecto:

| Archivo | Ruta en el proyecto | Qué `Verify` lo necesita | Resolución / entorno que lleva escrito | Exclusión del bundle |
|---|---|---|---|---|
| `vitest.config.ts` | raíz | Pasos 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13 y §20.1 | `resolve.alias` `@` → `./src` (Vitest no lee los `paths` de tsconfig) y `setupFiles: ["./tests/setup.ts"]` | `exclude` incluye `"blueprints/**"` |
| `tests/setup.ts` | `tests/setup.ts` | Los mismos pasos | Carga `.env` con `process.loadEnvFile()`, exige `TEST_DATABASE_URL`, aborta si coincide con `DATABASE_URL` y reasigna `process.env.DATABASE_URL` | n/a — no recorre el árbol |
| `playwright.config.ts` | raíz | Paso 13 y §20.1 | `testDir: "./tests/e2e"`, `webServer` con `pnpm build && pnpm start`, `baseURL` `http://localhost:3000` | `testDir` confina el descubrimiento; el bundle nunca se recorre |
| `scripts/db-migrate-test.ts` | `scripts/` | Todo `pnpm db:migrate:test` (pasos 3–13 y §20.1) | Carga `.env` con `process.loadEnvFile()` y ejecuta drizzle-kit con `DRIZZLE_DATABASE_URL=TEST_DATABASE_URL` | n/a |
| `.env.example` | raíz | §10 Bootstrap (`grep`) y §20.1 | Contrato de claves; ningún valor real | n/a |
| `CLAUDE.md`, `AGENTS.md`, `.claude/**` | raíz | Configuración del agente; §20.1 comprueba que estén trackeados | — | n/a |

**No hay servicio local que aprovisionar.** La base es Neon, un servicio alojado creado en la sección
"Cuentas a crear antes del paso 1" de §10, con dos ramas y sus dos cadenas en `.env`. No hay
`docker-compose.yml` porque no hay nada que levantar en la máquina.

#### Resolution convention matrix

**La convención, dicha una sola vez:** especificadores **sin extensión** con el alias `@/` hacia
`src/` para todo lo que cruce carpetas, y relativos sin extensión dentro de la misma carpeta. **Nunca
se ejecuta un `.ts` con `node` a secas** — los scripts corren con `tsx`, que sí resuelve el alias.
Por eso este proyecto no necesita la variante con extensión `.ts` que el runtime track describe para
ejecución con Node desnudo.

| Contexto | Comando que lo ejercita | La convención ahí | Configuración y ajuste literal que lo hace funcionar |
|---|---|---|---|
| Código de la aplicación | `pnpm build` | `import { db } from "@/lib/db"` | `tsconfig.json` — `"paths": { "@/*": ["./src/*"] }` con `"moduleResolution": "bundler"`, ambos del scaffold |
| Archivos de prueba | `pnpm test` | igual | `vitest.config.ts` — `resolve.alias` `{ "@": fileURLToPath(new URL("./src", import.meta.url)) }`, escrito en §19.6 porque Vitest no hereda los `paths` de tsconfig |
| Scripts sueltos | `pnpm exec tsx scripts/seed.ts` | igual | `tsx` 4.23.1 lee los `paths` de `tsconfig.json`; por eso los scripts corren con `tsx` y nunca con `node scripts/seed.ts`, que resolvería el especificador literalmente y fallaría |
| Build / bundle | `pnpm build` | igual | Turbopack resuelve los `paths` de `tsconfig.json` y emite el bundle ya resuelto |
| Configuración de drizzle-kit | `pnpm db:generate` · `pnpm db:migrate` | rutas **relativas**: `"./src/lib/db/schema.ts"` | `drizzle.config.ts` — drizzle-kit empaqueta su config con esbuild y no aplica los `paths` de tsconfig; por eso ese archivo, y solo ese, usa rutas relativas desde la raíz |
| E2E | `pnpm test:e2e` | igual que la aplicación | `playwright.config.ts` — Playwright aplica los `paths` de `tsconfig.json`; aun así los specs no importan de `src/`, solo navegan |

#### Cross-artifact value reconciliation

| Valor compartido | Fuente única — el archivo que lo decide | Valor literal | Dónde más aparece | Comparado |
|---|---|---|---|---|
| Raíz de módulos | `tsconfig.json` — `paths` | `./src/*` (alias `@/*`) | `vitest.config.ts` alias · `biome.json` includes · árbol de §3 | sí |
| Salida de migraciones | `drizzle.config.ts` — `out` | `./drizzle` | §3 árbol · §10 tabla de archivos commiteados · Checkpoint del paso 3 · §19.5 globs | sí |
| Archivos de esquema | `drizzle.config.ts` — `schema` | `./src/lib/db/schema.ts`, `./src/lib/db/auth-schema.ts` | §3 árbol · pasos 2 y 3 · §4 | sí |
| Directorio E2E | `playwright.config.ts` — `testDir` | `./tests/e2e` | `vitest.config.ts` exclude · §3 árbol · paso 13 | sí |
| Archivo de setup de pruebas | `vitest.config.ts` — `setupFiles` | `./tests/setup.ts` | §19.6 tabla · §13 · §3 árbol | sí |
| Puerto local | `.env.example` — `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `playwright.config.ts` `baseURL` y `webServer.url` · Verify de los pasos 1, 2 · CLAUDE.md | sí |
| Ruta de salud | `src/app/api/health/route.ts` | `/api/health` | Verify de los pasos 1, 2, 12 · `proxy.ts` matcher · §16 · §20.1 | sí |
| Variable de conexión | `.env.example` — `DATABASE_URL` | `DATABASE_URL` | `src/lib/env.ts` · `drizzle.config.ts` · `tests/setup.ts` · §10 · CI | sí |
| Variable de pruebas | `.env.example` — `TEST_DATABASE_URL` | `TEST_DATABASE_URL` | `tests/setup.ts` · `scripts/db-migrate-test.ts` · §10 · CI | sí |
| Ruta del bundle | `biome.json` — `files.includes` | `blueprints/` | `tsconfig.json` exclude · `vitest.config.ts` exclude | sí |
| Nombres de scripts | `package.json` — `scripts` (§10 Bootstrap) | `typecheck`, `lint`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `db:migrate:test`, `db:seed`, `db:reset` | Verify de los 13 pasos · `tasks.json` · épicas · `settings.json` · CLAUDE.md · CI | sí |
| Etiquetas de checkpoint | §9 Checkpoints | `step-01-scaffold-db` … `step-13-e2e` | `tasks.json` campo `checkpoint` · épicas · §20.1 | sí |

#### Byte-exact artifact reconciliation

| Artefacto byte-exacto | Escrito por | Se compara por primera vez en | Reglas del blueprint que lo restringen | Llamada de runtime que lo produce, sobre el pin de §11 | Ambos confirmados |
|---|---|---|---|---|---|
| Cabecera CSV `sku,articulo,categoria,color,talla,estado,precio_base_dop` | §5, *Endpoints críticos*, punto 5 | Paso 10 | §4 nombres de columnas (`sku`, `categoria`, `color`, `talla`, `estado`, `precio_base_centavos` → columna de salida `precio_base_dop`); §5 separador coma, fin de línea `\n`, orden por `sku` | Ninguna: la cadena es una constante literal del propio código, no la produce ningún formateador del runtime | sí |
| Valor `1450.00` para 145000 centavos | §5 y criterio del paso 10 | Paso 10 | §4 "dinero en centavos enteros"; §5 formato con `src/lib/dinero.ts`; prohibición explícita de `toLocaleString` | `Math.trunc(145000/100) + "." + String(145000 % 100).padStart(2, "0")` → `"1450.00"`; aritmética entera de ECMAScript, idéntica en cualquier versión de Node | sí |
| Prefijo `%PDF-` del recibo | Criterio del paso 11 | Paso 11 | §5: `Content-Type: application/pdf`; los cinco primeros bytes son la firma del formato PDF, no una cadena de runtime | Ninguna: es la firma del formato, no un mensaje generado por el motor | sí |

Ningún artefacto de este blueprint incrusta un mensaje de error, una traza, un orden de claves ni un
formato de fecha producido por el runtime, que es la clase de literal que cambia entre versiones. Por
eso las tres filas se pueden confirmar sin ejecutar nada.

---

## 20. Acceptance Gate, Risks & Decision Log

### 20.1 Global acceptance gate

El proyecto está **hecho** cuando todos estos comandos salen 0 sobre un checkout limpio, y no antes.
Es el mismo conjunto que corre CI y contra el que se mide cada paso de §9.

```bash
pnpm install --frozen-lockfile     # expect: exit 0, lockfile sin cambios
pnpm typecheck                     # expect: exit 0, cero errores
pnpm lint                          # expect: exit 0, cero errores y cero advertencias
pnpm db:migrate:test               # expect: exit 0
pnpm test                          # expect: exit 0, 0 failed, 0 skipped
pnpm build                         # expect: exit 0
pnpm db:reset && pnpm db:seed      # expect: exit 0 — base de e2e en estado conocido
pnpm test:e2e                      # expect: exit 0, 0 failed
pnpm test:e2e tests/e2e/a11y.spec.ts   # expect: exit 0, 0 failed
pnpm exec next start -p 3000 & SRV=$!; sleep 12; code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health); kill $SRV 2>/dev/null || true; test "$code" = 200
# expect: exit 0 — se ejecuta el artefacto construido, no solo se compila
```

Cada expectativa es una propiedad, no un recuento: ningún comando cuenta tablas, pruebas ni rutas.
Cada línea sale 0 cuando el build es correcto, y ninguna trata "sale distinto de 0" como condición de
aprobado: donde el resultado correcto sería un fallo, se asserta el código concreto.

Además, estas puertas manuales, una vez antes de lanzar:

- [ ] Cada paso de §9 tiene su etiqueta en git: `git tag -l 'step-*'` lista una por paso, de
      `step-01-scaffold-db` a `step-13-e2e`. El repositorio lo creó §10 Bootstrap, no un scaffolder.
- [ ] Cada archivo de la tabla *Archivos que deben quedar commiteados* de §10 está en un checkout
      limpio — `git ls-files --error-unmatch <ruta>` sale 0, **una ruta por invocación**, y su
      comprobación de no-ignorado es `git check-ignore -q <ruta>; test $? -eq 1` **por ruta**
      (1 = no ignorado; 128 = error de uso, que así sí falla).
- [ ] El ignore file estaba en su sitio antes del primer commit:
      `git log --diff-filter=A --format=%H -- .gitignore` apunta al commit `chore: scaffold` de §10
      Bootstrap, no al commit de un paso de §9.
- [ ] Las tres filas de *Byte-exact artifact reconciliation* de §19.6 leen "Ambos confirmados: sí".
- [ ] El bloque Bootstrap de §10 se volvió a ejecutar una vez sobre un árbol ya arrancado, **salió
      0** y no cambió nada que importara: `package.json` conserva todas las dependencias instaladas y
      el siguiente comando sigue encontrando sus binarios.
- [ ] Todas las filas de *Cross-artifact value reconciliation* de §19.6 leen "Comparado: sí", y las
      puertas de lint, formato y typecheck se corrieron desde la raíz **con el bundle presente**.
- [ ] Cada non-goal de §1 sigue sin construirse.
- [ ] Cada variable de §10 está puesta en producción y ausente del repositorio.
- [ ] Los flujos críticos de §13 pasan contra la URL de producción.
- [ ] Pasada solo con teclado y una pasada con lector de pantalla sobre el flujo de venta (§15).
- [ ] Un error provocado a propósito aparece en los logs de Vercel con su ruta (§16).
- [ ] Se hizo una reversión de despliegue a propósito, una vez, en preview (§12).
- [ ] Si se compra dominio propio: DNS, TLS y redirección de ápice configurados (§12).

**Ninguna advertencia se ignora.** Una advertencia tolerada se vuelve permanente y la siguiente
advertencia real se esconde dentro.

### 20.2 Risk register

| Riesgo | Probabilidad | Impacto | Señal temprana | Mitigación |
|---|---|---|---|---|
| **SKU duplicado bajo escritura concurrente**: dos altas simultáneas generan el mismo código y una comprobación previa en la aplicación no lo impide | M | A | Dos unidades con el mismo `sku` en el listado, o un error `23505` no manejado | La unicidad la impone `unique("unidad_sku_unique")` en la base, **nunca** una consulta previa; el paso 5 inserta sin comprobar y maneja el `23505` con reintento (SKU automático) o `SKU_DUPLICADO` (manual). Dueño: el paso 5 |
| `@react-pdf/renderer` sin pin verificado puede no ser compatible con React 19.3.0 | M | M | La prueba de humo del paso 11 falla al renderizar a buffer | El paso 11 instala y hace la prueba de humo **antes** de escribir el recibo, de modo que el fallo aparece en el primer minuto del paso y no al final; si falla, se detiene y se reporta en vez de improvisar otra librería. Dueño: el paso 11 |
| El driver de Neon exige un constructor de WebSocket que el paso 1 no configure bien | M | A | `/api/health` devuelve 503 en el primer gate del paso 1 | `src/lib/db/index.ts` asigna `neonConfig.webSocketConstructor = ws` explícitamente y el gate del paso 1 ejecuta una consulta real: el fallo aparece donde cuesta una línea arreglarlo. Dueño: el paso 1 |
| Cambio de nombre `accountId` → `providerAccountId` en better-auth 1.7.5 | A | M | Error de columna inexistente al iniciar sesión, tras migrar | §4 fija el nombre nuevo y el paso 2 contrasta con `npx auth@latest generate` antes de dar el esquema por bueno. Dueño: el paso 2 |
| `ERR_PNPM_IGNORED_BUILDS` aborta la instalación del scaffold y este aun así sale 0 | A | A | `pnpm install --frozen-lockfile` sale 1 en el primer gate del paso 1 | §10 Bootstrap ejecuta `pnpm approve-builds --all` antes del `install --frozen-lockfile`, que es el gate real. Dueño: §10 |
| Neon agota la capa gratuita (almacenamiento u horas de cómputo) y suspende la base | B | A | Latencias crecientes o errores de conexión intermitentes en `/api/health` | El monitor de uptime avisa; el plan de pago de Neon arranca en menos de US$20/mes y §16 lo tiene presupuestado. Dueño: quien mantiene el repositorio |
| Ampliación de alcance hacia facturación fiscal a mitad del build | M | A | Aparece "y que también saque el comprobante" durante un paso de ventas | §1 lo declara non-goal con su disparador de revisión y §20.1 comprueba que siga sin construirse. Dueño: quien acepta el alcance |
| La única cuenta pierde la contraseña y no hay flujo de recuperación por correo | B | A | El dueño no puede entrar | La recuperación operativa está documentada: cambiar `OWNER_PASSWORD` y volver a correr `pnpm db:seed` (§8, `CLAUDE.md`). Dueño: quien mantiene el repositorio |

### 20.3 Decision log

| # | Decisión | Alternativa rechazada | Por qué | Se revertiría si |
|---|---|---|---|---|
| 1 | Runtime track TypeScript/Node con Next.js App Router | Python + admin de Django | El valor está en reglas propias (SKU único por pieza, saldo por cliente), no en un CRUD genérico; un admin generado habría que pelearlo desde el primer requisito | El alcance se redujera a listar y editar tablas sin reglas propias |
| 2 | Drizzle ORM | Prisma | El esquema TypeScript es la única fuente de verdad y las consultas se leen como SQL, que es lo que hay que auditar en las transacciones de venta y pago | Hiciera falta una GUI de administración incluida o un cliente generado para varios lenguajes |
| 3 | Postgres serverless en Neon | SQLite en disco | Hace falta acceso desde el celular y hosting serverless; además `UNIQUE` y transacciones reales son el corazón del producto | El sistema pasara a ser una aplicación local de un solo dispositivo |
| 4 | Base alojada también para las pruebas (rama `test` de Neon) | Postgres local en Docker | El driver de Neon por WebSocket se comporta distinto a un Postgres TCP local; probar contra el segundo demostraría algo que no es lo que corre en producción | Las pruebas tuvieran que correr sin red, o el costo de horas de cómputo de Neon se volviera relevante |
| 5 | Driver `neon-serverless` (WebSocket) y no `neon-http` | `drizzle-orm/neon-http` | Los pasos 7 y 8 necesitan transacciones interactivas con `select … for update`; el driver HTTP no las ofrece | Desaparecieran las transacciones multi-sentencia, que es lo mismo que decir que desaparece la venta atómica |
| 6 | better-auth self-hosted | Clerk | Un sistema de un usuario no debe pagar por asiento ni depender de un tercero para abrir la caja; las sesiones viven en la misma base | Entraran varios usuarios con SSO corporativo |
| 7 | Server Actions para mutaciones, Route Handlers solo para health, auth, CSV y PDF | API REST `/api/v1` completa | Con un solo consumidor, una API REST es un cliente HTTP escrito a mano y un contrato duplicado | Apareciera un segundo consumidor (app móvil nativa, integración POS) |
| 8 | Dinero en centavos enteros | `numeric(12,2)` convertido a número | La suma de pagos decide si una deuda está saldada; en coma flotante eso no es exacto y el error aparece tarde y en dinero | Hicieran falta fracciones menores al centavo o divisas con otra subunidad |
| 9 | Vercel + Neon | VPS con Docker | El dueño no administra servidores y el despliegue tiene que caber en minutos | El uso comercial en plan Hobby obligara a Pro y ese costo dejara de justificarse |
| 10 | Tailwind v4 con tokens en CSS, primitivas de shadcn copiadas al repo | Biblioteca de componentes instalada (MUI) | El código de los componentes queda en el repo y se edita; nada que actualizar puede romper una tabla | El equipo creciera y necesitara una biblioteca con soporte y garantías propias |
| 11 | Sin caché de servidor (`force-dynamic` en todo el grupo `(app)`) | `cacheComponents` con `"use cache"` | Mostrar una pieza vendida como disponible es exactamente el fallo que el sistema existe para evitar | El inventario creciera hasta que el listado tardara lo suficiente como para que la caché valiera el riesgo |
| 12 | Sin librería de a11y automatizada; aserciones explícitas en Playwright | `@axe-core/playwright` | Evita una dependencia sin verificar en el último paso del build; lo que importa aquí (etiquetas, `h1`, foco, error en texto) se asserta directamente | El producto sumara superficies suficientes para que revisar a mano dejara de escalar |

### 20.4 What to build next

1. **Notificaciones de deuda al cliente** — disparador: más de ~30 clientes con deuda viva
   simultánea. Es lo primero que el dueño va a pedir en cuanto el saldo deje de caber en su cabeza.
2. **Facturación fiscal (NCF)** — disparador: que un cliente exija comprobante fiscal y la secuencia
   esté asignada. Reabre §4 con secuencias y anulaciones inmutables.
3. **Lector de código de barras** — disparador: comprar el lector y definir la impresora de
   etiquetas. El SKU único de v1 ya es exactamente lo que se imprimiría.
4. **Segundo usuario con roles** — disparador: contratar a alguien con acceso. Reabre §8 y la sección
   de aislamiento por fila que hoy es NOT APPLICABLE.
5. **Reportes programados por correo** — disparador: que el mismo reporte se pida más de una vez por
   semana. Depende del punto 1.

---

*Fin del blueprint. El orden de build es §9. Se para cuando §20.1 está en verde.*

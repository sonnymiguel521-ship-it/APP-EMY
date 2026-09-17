---
name: agregar-recurso-crud
description: Usa esto al crear el CRUD de una entidad nueva o al añadir una operación de servidor —
  "nuevo recurso", "añadir CRUD de proveedores", "crear la acción de X", "hace falta una pantalla de
  listado y alta". Cubre el módulo de servidor, su actions.ts, la página y el archivo de pruebas con
  la envolvente y la comprobación de sesión correctas.
---

# Agregar un recurso CRUD

## Cuándo usarlo

Al añadir una entidad operable por el dueño (listar, crear, editar, desactivar) o una operación de
servidor nueva sobre una entidad existente.

## Pasos

1. **Esquema primero.** Si la entidad no existe en `src/lib/db/schema.ts`, usa antes la skill
   `agregar-migracion`. Un CRUD sobre una tabla que no está migrada falla en la primera prueba.
2. **`src/server/<recurso>.ts`** — el esquema zod de cada entrada y las funciones. Cada una:
   - empieza con `getSesion()` y devuelve `UNAUTHENTICATED` si no hay sesión, sin tocar la base;
   - parsea la entrada con zod y devuelve `VALIDATION_ERROR` con `campos` si falla;
   - devuelve `Resultado<T>`, nunca lanza para un caso previsto;
   - usa `limit`/`offset` para listar, nunca corta un arreglo en memoria;
   - envuelve en transacción cualquier operación que toque más de una fila con una invariante.
3. **`src/app/(app)/<recurso>/actions.ts`** — `"use server"`, delega en el módulo anterior y llama
   `revalidatePath()` de las rutas afectadas. Sin lógica de negocio aquí.
4. **`src/app/(app)/<recurso>/page.tsx`** — Server Component con `dynamic = "force-dynamic"`, listado
   paginado y formulario de alta. Declara los tres estados: cargando, vacío y error. Solo tokens de
   diseño; insignias de estado con texto además de color.
5. **`tests/server/<recurso>.test.ts`** — al menos un caso feliz, un caso de validación, un caso sin
   sesión y el caso de borde que define la regla de negocio del recurso. Datos propios con sufijos
   `crypto.randomUUID()`: ninguna prueba depende del orden ni de datos de otra.
6. Si hace falta una primitiva de interfaz que no está en `src/components/ui/`, cópiala con
   `pnpm dlx shadcn@4.16.0 add <componente>` y edítala libremente: ese código es nuestro.

## Verify

```bash
pnpm db:migrate:test                          # expect: exit 0
pnpm test tests/server/<recurso>.test.ts      # expect: exit 0, 0 failed, 0 skipped
pnpm typecheck && pnpm lint                   # expect: exit 0
pnpm build                                    # expect: exit 0
pnpm test                                     # expect: exit 0 — las pruebas anteriores siguen verdes
```

## No hagas

- No confíes en `proxy.ts` para autorizar: cada acción vuelve a llamar `getSesion()`.
- No inventes un código de error nuevo: el conjunto está cerrado en `.claude/rules/servidor.md`.
- No importes `src/lib/db/` desde una página ni desde un componente.
- No sumes dinero en JavaScript sobre valores formateados: los totales se calculan en SQL, en
  centavos enteros.

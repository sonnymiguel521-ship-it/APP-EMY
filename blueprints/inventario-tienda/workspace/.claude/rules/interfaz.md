---
description: Convenciones de páginas, componentes, tokens de diseño y accesibilidad
paths:
  - "src/app/**"
  - "src/components/**"
---

# Interfaz

- **Server Components por defecto.** `"use client"` va en la hoja que necesita estado o manejadores
  de eventos, nunca en un `layout` ni en una `page`.
- Toda ruta del grupo `(app)` exporta `const dynamic = "force-dynamic"`: mostrar una pieza vendida
  como disponible es exactamente el fallo que este sistema existe para evitar.
- Las páginas leen datos llamando a módulos de `src/server/`; **nunca** importan `src/lib/db/`
  directamente ni hacen `fetch` a la propia aplicación.
- `src/lib/env.ts` importa `node:fs`: **jamás** se importa desde un archivo `"use client"`, o el
  bundle del navegador se rompe con un error que no menciona `env.ts`.
- Máximo 300 líneas por componente, uno por archivo. Alias `@/` sin extensión; nada de `../../..`.
- **Solo tokens.** Ningún hex ni px suelto en un componente: los valores viven en el bloque `@theme`
  de `src/app/globals.css`. Espaciado únicamente en la escala 4, 8, 12, 16, 24, 32, 48, 64.
- **Estado por color nunca solo por color:** toda insignia de estado lleva su texto
  (`disponible` verde, `vendida` rojo, `reservada` gris, `pendiente` y `parcial` ámbar, `pagada`
  verde).
- El contorno de inputs y controles usa `--border-strong` (`#64748B`, 4.76:1), no `--border`, que es
  decorativo y no alcanza el 3:1 exigido a un componente de interfaz.
- **Toda superficie asíncrona declara sus tres estados:** cargando (`loading.tsx` con esqueleto de
  filas), vacío (texto que dice qué hacer y el botón de alta) y error (`error.tsx` con mensaje y
  botón de reintento).
- **Formularios:** `react-hook-form` resolviendo contra el mismo esquema zod del servidor, más
  `useActionState`. Cada input con etiqueta programática; el error se muestra como texto bajo el
  campo —nunca solo color— y el resumen lleva `role="alert"`.
- **Sin actualizaciones optimistas** en dinero ni en inventario: se espera la confirmación de la
  transacción.
- Los importes y los SKU se muestran con la pila mono y se formatean con `formatearDop` de
  `src/lib/dinero.ts`.
- **Accesibilidad exigible:** un solo `h1` por página, encabezados en orden, landmarks
  (`header`/`nav`/`main`), tabla real con `<th scope>` para el inventario, todo operable por teclado
  con foco visible, objetivos táctiles de 24×24 px mínimo, y todo lo animado respetando
  `prefers-reduced-motion`.
- Móvil primero: bajo 768px las tablas se apilan en tarjetas. Nunca scroll horizontal.
- Sin barrel files: importa del módulo fuente.

import { existsSync } from "node:fs";

// Vitest no arranca el framework, así que nadie carga .env por nosotros:
// este archivo es el mecanismo de carga de variables para toda la suite.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const urlDePruebas = process.env.TEST_DATABASE_URL;

if (!urlDePruebas) {
  throw new Error(
    "TEST_DATABASE_URL no está definida. Crea una rama `test` en Neon y copia su cadena del pooler en .env.",
  );
}

if (urlDePruebas === process.env.DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL es idéntica a DATABASE_URL. Las pruebas truncan y crean datos: deben apuntar a la rama `test`, nunca a la base de desarrollo.",
  );
}

// Todo módulo que importe src/lib/db lee DATABASE_URL: se reasigna aquí, antes
// de que el grafo de módulos de las pruebas se evalúe.
process.env.DATABASE_URL = urlDePruebas;
// @types/node marca NODE_ENV como solo lectura desde TS 5.something; se escribe a través de
// una vista mutable del mismo objeto en vez de silenciar el chequeo con un cast a `any`.
(process.env as Record<string, string | undefined>).NODE_ENV = process.env.NODE_ENV ?? "test";

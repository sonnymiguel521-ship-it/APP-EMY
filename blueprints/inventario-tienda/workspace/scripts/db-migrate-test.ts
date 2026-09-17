import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

// drizzle-kit se invoca fuera del framework: nadie carga .env por él.
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
    "TEST_DATABASE_URL es idéntica a DATABASE_URL: migrar la rama de pruebas apuntaría a la base de desarrollo.",
  );
}

// drizzle.config.ts prefiere DRIZZLE_DATABASE_URL sobre DATABASE_URL: esa es la
// única palanca para redirigir la migración sin tocar el archivo de config.
execSync("pnpm exec drizzle-kit migrate", {
  stdio: "inherit",
  env: { ...process.env, DRIZZLE_DATABASE_URL: urlDePruebas },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Vitest no hereda los `paths` de tsconfig.json: el alias se declara aquí.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    // Carga .env y apunta process.env.DATABASE_URL a TEST_DATABASE_URL antes de
    // que cualquier módulo importe el cliente de base de datos.
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // `blueprints/**` es el bundle de diseño: vive dentro del proyecto y contiene
    // una copia de este mismo archivo. Sin esta exclusión, las pruebas se
    // recogerían dos veces.
    exclude: ["tests/e2e/**", "blueprints/**", "node_modules/**", ".next/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Las pruebas de integración escriben en una base compartida: se corren sin
    // paralelismo de archivos para evitar colisiones entre ellos sin aislar por
    // transacción. `poolOptions.threads.singleThread` ya no existe en Vitest 4
    // (verificado en vivo: `pnpm typecheck` lo rechaza, TS2769) — `fileParallelism`
    // es el reemplazo documentado.
    fileParallelism: false,
  },
});

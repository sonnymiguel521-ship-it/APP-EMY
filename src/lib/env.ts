import { existsSync } from "node:fs";
import { z } from "zod";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  process.loadEnvFile(".env");
}

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL no está definida"),
  TEST_DATABASE_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  OWNER_EMAIL: z.string().optional(),
  OWNER_PASSWORD: z.string().optional(),
  PROD_DB_GUARD: z.string().optional(),
});

const schemaConProduccion = schema.superRefine((valores, ctx) => {
  if (process.env.NODE_ENV !== "production") return;

  for (const clave of ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    if (!valores[clave]) {
      ctx.addIssue({
        code: "custom",
        path: [clave],
        message: `${clave} no está definida y es obligatoria en producción`,
      });
    }
  }
});

const parsed = schemaConProduccion.safeParse(process.env);

if (!parsed.success) {
  const mensaje = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Variables de entorno inválidas — ${mensaje}`);
}

export const env = parsed.data;

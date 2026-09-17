import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

if (env.PROD_DB_GUARD && env.DATABASE_URL.includes(env.PROD_DB_GUARD)) {
  throw new Error(
    "DATABASE_URL parece apuntar a producción (coincide con PROD_DB_GUARD). Abortado.",
  );
}

async function main(): Promise<void> {
  await db.execute(
    sql`truncate table pago, venta_unidad, venta, unidad, variante, articulo, cliente cascade`,
  );
}

main()
  .then(() => {
    console.info("Base de dominio reiniciada.");
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as authSchema from "@/lib/db/auth-schema";
import { articulo, cliente, unidad, variante } from "@/lib/db/schema";
import { env } from "@/lib/env";

const secret = env.BETTER_AUTH_SECRET;
const baseURL = env.BETTER_AUTH_URL;
const ownerEmail = env.OWNER_EMAIL;
const ownerPassword = env.OWNER_PASSWORD;

if (!secret) throw new Error("BETTER_AUTH_SECRET no está definida");
if (!baseURL) throw new Error("BETTER_AUTH_URL no está definida");
if (!ownerEmail) throw new Error("OWNER_EMAIL no está definida");
if (!ownerPassword) throw new Error("OWNER_PASSWORD no está definida");

// src/lib/auth.ts fija disableSignUp: true para bloquear el registro público de
// la app en ejecución. La semilla necesita crear la cuenta del dueño a través del
// hashing propio de better-auth (nunca insertando el hash a mano), así que usa una
// instancia separada, solo para este script, con el registro habilitado.
const seedAuth = betterAuth({
  secret,
  baseURL,
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true, disableSignUp: false },
});

const DEMO_ARTICULO = {
  nombre: "Camisa lino manga larga",
  categoria: "Camisas",
  precioBaseCentavos: 145000,
};

const DEMO_VARIANTE = { color: "blanco", talla: "M" };

const DEMO_SKUS = ["DEMO-0001", "DEMO-0002"];

const DEMO_CLIENTE = { nombre: "Cliente Demo", telefono: "809-000-0000" };

async function crearDuenoSiFalta(): Promise<void> {
  const [existente] = await db
    .select({ id: authSchema.user.id })
    .from(authSchema.user)
    .where(eq(authSchema.user.email, ownerEmail as string))
    .limit(1);

  if (existente) {
    return;
  }

  await seedAuth.api.signUpEmail({
    body: { name: "Dueño", email: ownerEmail as string, password: ownerPassword as string },
  });
}

async function crearArticuloSiFalta(): Promise<string> {
  const [existente] = await db
    .select({ id: articulo.id })
    .from(articulo)
    .where(
      and(
        eq(articulo.nombre, DEMO_ARTICULO.nombre),
        eq(articulo.categoria, DEMO_ARTICULO.categoria),
      ),
    )
    .limit(1);

  if (existente) {
    return existente.id;
  }

  const [creado] = await db.insert(articulo).values(DEMO_ARTICULO).returning({ id: articulo.id });

  return creado.id;
}

async function crearVarianteSiFalta(articuloId: string): Promise<string> {
  const [existente] = await db
    .select({ id: variante.id })
    .from(variante)
    .where(
      and(
        eq(variante.articuloId, articuloId),
        eq(variante.color, DEMO_VARIANTE.color),
        eq(variante.talla, DEMO_VARIANTE.talla),
      ),
    )
    .limit(1);

  if (existente) {
    return existente.id;
  }

  const [creada] = await db
    .insert(variante)
    .values({ articuloId, ...DEMO_VARIANTE })
    .returning({ id: variante.id });

  return creada.id;
}

async function crearUnidadesSiFaltan(varianteId: string): Promise<void> {
  for (const sku of DEMO_SKUS) {
    const [existente] = await db
      .select({ id: unidad.id })
      .from(unidad)
      .where(eq(unidad.sku, sku))
      .limit(1);

    if (existente) {
      continue;
    }

    await db.insert(unidad).values({ varianteId, sku, skuAutoGenerado: false });
  }
}

async function crearClienteSiFalta(): Promise<void> {
  const [existente] = await db
    .select({ id: cliente.id })
    .from(cliente)
    .where(eq(cliente.telefono, DEMO_CLIENTE.telefono))
    .limit(1);

  if (existente) {
    return;
  }

  await db.insert(cliente).values(DEMO_CLIENTE);
}

async function main(): Promise<void> {
  await crearDuenoSiFalta();
  const articuloId = await crearArticuloSiFalta();
  const varianteId = await crearVarianteSiFalta(articuloId);
  await crearUnidadesSiFaltan(varianteId);
  await crearClienteSiFalta();
}

main()
  .then(() => {
    console.info("Semilla aplicada.");
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

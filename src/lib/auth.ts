import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import * as authSchema from "@/lib/db/auth-schema";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET no está definida");
}

if (!baseURL) {
  throw new Error("BETTER_AUTH_URL no está definida");
}

export const auth = betterAuth({
  secret,
  baseURL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  // nextCookies debe ser el último plugin: fija el Set-Cookie de cada
  // llamada a auth.api.* en Server Actions. Sin él, iniciarSesion() en
  // src/app/login/page.tsx nunca persiste la sesión en el navegador.
  plugins: [nextCookies()],
});

export async function getSesion() {
  return auth.api.getSession({ headers: await headers() });
}

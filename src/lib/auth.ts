import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
});

export async function getSesion() {
  return auth.api.getSession({ headers: await headers() });
}

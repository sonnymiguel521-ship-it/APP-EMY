import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sesion = await getSesion();

  redirect(sesion ? "/articulos" : "/login");
}

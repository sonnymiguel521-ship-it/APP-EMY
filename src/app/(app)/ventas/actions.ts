"use server";

import { revalidatePath } from "next/cache";
import { type CrearVentaInput, crearVenta } from "@/server/ventas";

export async function crearVentaAction(input: CrearVentaInput) {
  const resultado = await crearVenta(input);

  if (resultado.ok) {
    revalidatePath("/ventas");
    revalidatePath("/unidades");
  }

  return resultado;
}

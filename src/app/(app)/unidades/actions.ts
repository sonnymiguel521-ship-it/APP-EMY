"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/lib/resultado";
import { cambiarEstadoUnidad, crearUnidad } from "@/server/unidades";

export async function crearUnidadAction(
  _estadoPrevio: Resultado<unknown> | null,
  formData: FormData,
) {
  const skuIngresado = String(formData.get("sku") ?? "").trim();
  const estadoIngresado = String(formData.get("estado") ?? "");

  const resultado = await crearUnidad({
    varianteId: String(formData.get("varianteId") ?? ""),
    sku: skuIngresado ? skuIngresado.toUpperCase() : undefined,
    estado: estadoIngresado === "reservada" ? "reservada" : undefined,
  });

  if (resultado.ok) {
    revalidatePath("/unidades");
  }

  return resultado;
}

export async function cambiarEstadoUnidadAction(id: string, estado: "disponible" | "reservada") {
  await cambiarEstadoUnidad({ id, estado });

  revalidatePath("/unidades");
}

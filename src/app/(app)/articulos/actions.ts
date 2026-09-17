"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/lib/resultado";
import {
  crearArticulo,
  crearVariante,
  desactivarArticulo,
  eliminarVariante,
} from "@/server/articulos";

export async function crearArticuloAction(
  _estadoPrevio: Resultado<unknown> | null,
  formData: FormData,
) {
  const descripcion = String(formData.get("descripcion") ?? "").trim();

  const resultado = await crearArticulo({
    nombre: String(formData.get("nombre") ?? ""),
    categoria: String(formData.get("categoria") ?? ""),
    descripcion: descripcion || undefined,
    precioBaseCentavos: Number(formData.get("precioBaseCentavos") ?? Number.NaN),
  });

  if (resultado.ok) {
    revalidatePath("/articulos");
  }

  return resultado;
}

export async function crearVarianteAction(
  _estadoPrevio: Resultado<unknown> | null,
  formData: FormData,
) {
  const articuloId = String(formData.get("articuloId") ?? "");

  const resultado = await crearVariante({
    articuloId,
    color: String(formData.get("color") ?? ""),
    talla: String(formData.get("talla") ?? ""),
  });

  if (resultado.ok) {
    revalidatePath("/articulos");
    revalidatePath(`/articulos/${articuloId}`);
  }

  return resultado;
}

export async function desactivarArticuloAction(id: string): Promise<void> {
  await desactivarArticulo(id);

  revalidatePath("/articulos");
  revalidatePath(`/articulos/${id}`);
}

export async function eliminarVarianteAction(id: string, articuloId: string): Promise<void> {
  await eliminarVariante(id);

  revalidatePath("/articulos");
  revalidatePath(`/articulos/${articuloId}`);
}

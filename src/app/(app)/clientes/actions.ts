"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/lib/resultado";
import { crearCliente, desactivarCliente, eliminarCliente } from "@/server/clientes";

export async function crearClienteAction(
  _estadoPrevio: Resultado<unknown> | null,
  formData: FormData,
) {
  const direccion = String(formData.get("direccion") ?? "").trim();

  const resultado = await crearCliente({
    nombre: String(formData.get("nombre") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    direccion: direccion || undefined,
  });

  if (resultado.ok) {
    revalidatePath("/clientes");
  }

  return resultado;
}

export async function desactivarClienteAction(id: string): Promise<void> {
  await desactivarCliente(id);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

export async function eliminarClienteAction(id: string): Promise<Resultado<{ id: string }>> {
  const resultado = await eliminarCliente(id);

  if (resultado.ok) {
    revalidatePath("/clientes");
  }

  return resultado;
}

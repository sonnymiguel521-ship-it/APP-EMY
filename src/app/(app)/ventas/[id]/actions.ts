"use server";

import { revalidatePath } from "next/cache";
import { type RegistrarPagoInput, registrarPago } from "@/server/pagos";
import { obtenerVenta } from "@/server/ventas";

export async function registrarPagoAction(input: RegistrarPagoInput) {
  const resultado = await registrarPago(input);

  if (resultado.ok) {
    revalidatePath(`/ventas/${input.ventaId}`);
    revalidatePath("/ventas");

    const venta = await obtenerVenta(input.ventaId);
    if (venta.ok && venta.data.venta.clienteId) {
      revalidatePath(`/clientes/${venta.data.venta.clienteId}`);
    }
  }

  return resultado;
}

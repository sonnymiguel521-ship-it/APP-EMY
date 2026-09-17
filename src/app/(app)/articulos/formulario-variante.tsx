"use client";

import { useActionState } from "react";
import { crearVarianteAction } from "./actions";

export function FormularioVariante({ articuloId }: { articuloId: string }) {
  const [resultado, accion, pendiente] = useActionState(crearVarianteAction, null);
  const errorGeneral = resultado && !resultado.ok ? resultado.error : null;
  const campos = errorGeneral?.campos ?? {};

  return (
    <form action={accion} className="flex flex-col gap-3 max-w-sm">
      <h2 className="text-lg font-semibold">Nueva variante</h2>

      {errorGeneral && (
        <p role="alert" className="text-sm text-red-700">
          {errorGeneral.mensaje}
        </p>
      )}

      <input type="hidden" name="articuloId" value={articuloId} />

      <div className="flex flex-col gap-1">
        <label htmlFor="color">Color</label>
        <input id="color" name="color" required className="border px-2 py-1 rounded" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="talla">Talla</label>
        <input id="talla" name="talla" required className="border px-2 py-1 rounded" />
        {campos.talla && <p className="text-sm text-red-700">{campos.talla}</p>}
      </div>

      <button type="submit" disabled={pendiente} className="border rounded px-3 py-2 self-start">
        {pendiente ? "Creando..." : "Crear variante"}
      </button>
    </form>
  );
}

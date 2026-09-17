"use client";

import { useActionState } from "react";
import { crearUnidadAction } from "./actions";

interface VarianteOpcion {
  id: string;
  etiqueta: string;
}

export function FormularioUnidad({ variantes }: { variantes: VarianteOpcion[] }) {
  const [resultado, accion, pendiente] = useActionState(crearUnidadAction, null);
  const errorGeneral = resultado && !resultado.ok ? resultado.error : null;

  return (
    <form action={accion} className="flex flex-col gap-3 max-w-md">
      <h2 className="text-xl font-semibold">Nueva unidad</h2>

      {errorGeneral && (
        <p role="alert" className="text-sm text-red-700">
          {errorGeneral.mensaje}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="varianteId">Variante</label>
        <select id="varianteId" name="varianteId" required className="border px-2 py-1 rounded">
          <option value="">Selecciona una variante</option>
          {variantes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sku">SKU (opcional, se autogenera si se deja vacío)</label>
        <input id="sku" name="sku" className="border px-2 py-1 rounded font-mono" />
      </div>

      <button type="submit" disabled={pendiente} className="border rounded px-3 py-2 self-start">
        {pendiente ? "Creando..." : "Crear unidad"}
      </button>
    </form>
  );
}

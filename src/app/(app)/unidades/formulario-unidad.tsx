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
        <p role="alert" className="text-sm text-destructive">
          {errorGeneral.mensaje}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="varianteId">Variante</label>
        <select
          id="varianteId"
          name="varianteId"
          required
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        >
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
        <input
          id="sku"
          name="sku"
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 font-mono text-text"
        />
      </div>

      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded-[var(--radius-input)] bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pendiente ? "Creando..." : "Crear unidad"}
      </button>
    </form>
  );
}

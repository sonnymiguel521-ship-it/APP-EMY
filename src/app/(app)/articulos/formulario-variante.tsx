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
        <p role="alert" className="text-sm text-destructive">
          {errorGeneral.mensaje}
        </p>
      )}

      <input type="hidden" name="articuloId" value={articuloId} />

      <div className="flex flex-col gap-1">
        <label htmlFor="color">Color</label>
        <input
          id="color"
          name="color"
          required
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="talla">Talla</label>
        <input
          id="talla"
          name="talla"
          required
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        />
        {campos.talla && <p className="text-sm text-destructive">{campos.talla}</p>}
      </div>

      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded-[var(--radius-input)] bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pendiente ? "Creando..." : "Crear variante"}
      </button>
    </form>
  );
}

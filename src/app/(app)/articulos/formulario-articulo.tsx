"use client";

import { useActionState } from "react";
import { crearArticuloAction } from "./actions";

export function FormularioArticulo() {
  const [resultado, accion, pendiente] = useActionState(crearArticuloAction, null);
  const errorGeneral = resultado && !resultado.ok ? resultado.error : null;
  const campos = errorGeneral?.campos ?? {};

  return (
    <form action={accion} className="flex flex-col gap-3 max-w-md">
      <h2 className="text-xl font-semibold">Nuevo artículo</h2>

      {errorGeneral && (
        <p role="alert" className="text-sm text-destructive">
          {errorGeneral.mensaje}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="nombre">Nombre</label>
        <input
          id="nombre"
          name="nombre"
          required
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        />
        {campos.nombre && <p className="text-sm text-destructive">{campos.nombre}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="categoria">Categoría</label>
        <input
          id="categoria"
          name="categoria"
          required
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        />
        {campos.categoria && <p className="text-sm text-destructive">{campos.categoria}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="descripcion">Descripción</label>
        <input
          id="descripcion"
          name="descripcion"
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="precioBaseCentavos">Precio base (centavos)</label>
        <input
          id="precioBaseCentavos"
          name="precioBaseCentavos"
          type="number"
          min={0}
          required
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        />
        {campos.precioBaseCentavos && (
          <p className="text-sm text-destructive">{campos.precioBaseCentavos}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded-[var(--radius-input)] bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pendiente ? "Creando..." : "Crear artículo"}
      </button>
    </form>
  );
}

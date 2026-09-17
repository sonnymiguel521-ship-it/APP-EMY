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
        <p role="alert" className="text-sm text-red-700">
          {errorGeneral.mensaje}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" name="nombre" required className="border px-2 py-1 rounded" />
        {campos.nombre && <p className="text-sm text-red-700">{campos.nombre}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="categoria">Categoría</label>
        <input id="categoria" name="categoria" required className="border px-2 py-1 rounded" />
        {campos.categoria && <p className="text-sm text-red-700">{campos.categoria}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="descripcion">Descripción</label>
        <input id="descripcion" name="descripcion" className="border px-2 py-1 rounded" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="precioBaseCentavos">Precio base (centavos)</label>
        <input
          id="precioBaseCentavos"
          name="precioBaseCentavos"
          type="number"
          min={0}
          required
          className="border px-2 py-1 rounded"
        />
        {campos.precioBaseCentavos && (
          <p className="text-sm text-red-700">{campos.precioBaseCentavos}</p>
        )}
      </div>

      <button type="submit" disabled={pendiente} className="border rounded px-3 py-2 self-start">
        {pendiente ? "Creando..." : "Crear artículo"}
      </button>
    </form>
  );
}

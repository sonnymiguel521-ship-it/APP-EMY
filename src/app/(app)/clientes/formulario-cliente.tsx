"use client";

import { useActionState } from "react";
import { crearClienteAction } from "./actions";

export function FormularioCliente() {
  const [resultado, accion, pendiente] = useActionState(crearClienteAction, null);
  const errorGeneral = resultado && !resultado.ok ? resultado.error : null;
  const campos = errorGeneral?.campos ?? {};

  return (
    <form action={accion} className="flex flex-col gap-3 max-w-md">
      <h2 className="text-xl font-semibold">Nuevo cliente</h2>

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
        <label htmlFor="telefono">Teléfono</label>
        <input id="telefono" name="telefono" required className="border px-2 py-1 rounded" />
        {campos.telefono && <p className="text-sm text-red-700">{campos.telefono}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="direccion">Dirección</label>
        <input id="direccion" name="direccion" className="border px-2 py-1 rounded" />
      </div>

      <button type="submit" disabled={pendiente} className="border rounded px-3 py-2 self-start">
        {pendiente ? "Creando..." : "Crear cliente"}
      </button>
    </form>
  );
}

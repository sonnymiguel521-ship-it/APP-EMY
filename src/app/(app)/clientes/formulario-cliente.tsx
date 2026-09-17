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
        <label htmlFor="telefono">Teléfono</label>
        <input
          id="telefono"
          name="telefono"
          required
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        />
        {campos.telefono && <p className="text-sm text-destructive">{campos.telefono}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="direccion">Dirección</label>
        <input
          id="direccion"
          name="direccion"
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        />
      </div>

      <button
        type="submit"
        disabled={pendiente}
        className="self-start rounded-[var(--radius-input)] bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pendiente ? "Creando..." : "Crear cliente"}
      </button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatearDop } from "@/lib/dinero";
import { crearVentaAction } from "../actions";

interface UnidadDisponible {
  id: string;
  sku: string;
  etiqueta: string;
  precioBaseCentavos: number;
}

interface ClienteOpcion {
  id: string;
  nombre: string;
}

export function FormularioVenta({
  unidades,
  clientes,
}: {
  unidades: UnidadDisponible[];
  clientes: ClienteOpcion[];
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [precios, setPrecios] = useState<Record<string, number>>(() =>
    Object.fromEntries(unidades.map((u) => [u.id, u.precioBaseCentavos])),
  );
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());

  function alternarSeleccion(id: string) {
    setSeleccionadas((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function confirmarVenta() {
    setError(null);

    if (seleccionadas.size === 0) {
      setError("Selecciona al menos una pieza para crear la venta.");
      return;
    }

    const lineas = Array.from(seleccionadas).map((unidadId) => ({
      unidadId,
      precioVentaCentavos: precios[unidadId] ?? 0,
    }));

    iniciarTransicion(async () => {
      const resultado = await crearVentaAction({
        clienteId: clienteId || undefined,
        lineas,
      });

      if (!resultado.ok) {
        setError(resultado.error.mensaje);
        return;
      }

      router.push(`/ventas/${resultado.data.ventaId}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1 max-w-sm">
        <label htmlFor="clienteId">Cliente (opcional, contado si se deja vacío)</label>
        <select
          id="clienteId"
          value={clienteId}
          onChange={(evento) => setClienteId(evento.target.value)}
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
        >
          <option value="">Contado</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {unidades.length === 0 && <p>No hay piezas disponibles para vender.</p>}

      {unidades.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th scope="col" aria-label="Seleccionar" />
              <th scope="col">SKU</th>
              <th scope="col">Artículo</th>
              <th scope="col">Precio</th>
            </tr>
          </thead>
          <tbody>
            {unidades.map((u) => (
              <tr key={u.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Incluir ${u.sku}`}
                    checked={seleccionadas.has(u.id)}
                    onChange={() => alternarSeleccion(u.id)}
                  />
                </td>
                <td className="font-mono">{u.sku}</td>
                <td>{u.etiqueta}</td>
                <td className="font-mono">
                  <input
                    type="number"
                    min={1}
                    aria-label={`Precio de ${u.sku} en centavos`}
                    value={precios[u.id] ?? 0}
                    onChange={(evento) =>
                      setPrecios((actual) => ({
                        ...actual,
                        [u.id]: Number(evento.target.value),
                      }))
                    }
                    className="w-28 rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
                  />
                  <span className="ml-2 text-sm">({formatearDop(precios[u.id] ?? 0)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        type="button"
        onClick={confirmarVenta}
        disabled={pendiente}
        className="self-start rounded-[var(--radius-input)] bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pendiente ? "Creando..." : "Crear venta"}
      </button>
    </div>
  );
}

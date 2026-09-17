"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarPagoAction } from "./actions";

export function FormularioPago({ ventaId }: { ventaId: string }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [montoCentavos, setMontoCentavos] = useState(0);
  const [metodo, setMetodo] = useState<"efectivo" | "transferencia" | "tarjeta">("efectivo");

  function confirmarPago() {
    setError(null);

    iniciarTransicion(async () => {
      const resultado = await registrarPagoAction({ ventaId, montoCentavos, metodo });

      if (!resultado.ok) {
        setError(resultado.error.mensaje);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 max-w-sm">
      <h2 className="text-lg font-semibold">Registrar pago</h2>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="montoCentavos">Monto (centavos)</label>
        <input
          id="montoCentavos"
          type="number"
          min={1}
          value={montoCentavos}
          onChange={(evento) => setMontoCentavos(Number(evento.target.value))}
          className="border px-2 py-1 rounded"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="metodo">Método</label>
        <select
          id="metodo"
          value={metodo}
          onChange={(evento) =>
            setMetodo(evento.target.value as "efectivo" | "transferencia" | "tarjeta")
          }
          className="border px-2 py-1 rounded"
        >
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="tarjeta">Tarjeta</option>
        </select>
      </div>

      <button
        type="button"
        onClick={confirmarPago}
        disabled={pendiente || montoCentavos <= 0}
        className="border rounded px-3 py-2 self-start"
      >
        {pendiente ? "Registrando..." : "Registrar pago"}
      </button>
    </div>
  );
}

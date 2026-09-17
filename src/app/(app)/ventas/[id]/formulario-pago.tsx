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
        <p role="alert" className="text-sm text-destructive">
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
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
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
          className="rounded-[var(--radius-input)] border border-border-strong bg-background px-3 py-2 text-text"
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
        className="self-start rounded-[var(--radius-input)] bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pendiente ? "Registrando..." : "Registrar pago"}
      </button>
    </div>
  );
}

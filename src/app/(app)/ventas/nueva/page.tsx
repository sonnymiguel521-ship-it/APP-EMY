import { listarClientes } from "@/server/clientes";
import { listarUnidadesDisponiblesParaVenta } from "@/server/unidades";
import { FormularioVenta } from "./formulario-venta";

export const dynamic = "force-dynamic";

export default async function PaginaNuevaVenta() {
  const [unidadesResultado, clientesResultado] = await Promise.all([
    listarUnidadesDisponiblesParaVenta(),
    listarClientes({ soloActivos: true, page: 1, perPage: 100 }),
  ]);

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Nueva venta</h1>

      {!unidadesResultado.ok && (
        <p role="alert" className="text-sm text-destructive">
          {unidadesResultado.error.mensaje}
        </p>
      )}

      {unidadesResultado.ok && (
        <FormularioVenta
          unidades={unidadesResultado.data}
          clientes={clientesResultado.ok ? clientesResultado.data.items : []}
        />
      )}
    </main>
  );
}

import { listarUnidades, listarVariantesParaSelector } from "@/server/unidades";
import { cambiarEstadoUnidadAction } from "./actions";
import { FormularioUnidad } from "./formulario-unidad";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, string> = {
  disponible: "Disponible",
  vendida: "Vendida",
  reservada: "Reservada",
};

interface PaginaUnidadesProps {
  searchParams: Promise<{ estado?: string }>;
}

export default async function PaginaUnidades({ searchParams }: PaginaUnidadesProps) {
  const { estado } = await searchParams;
  const estadoValido =
    estado === "disponible" || estado === "vendida" || estado === "reservada" ? estado : undefined;

  const [resultado, variantesResultado] = await Promise.all([
    listarUnidades({ estado: estadoValido, page: 1, perPage: 50 }),
    listarVariantesParaSelector(),
  ]);

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Unidades</h1>

      <nav aria-label="Filtro por estado" className="flex gap-2">
        <a href="/unidades">Todas</a>
        <a href="/unidades?estado=disponible">Disponibles</a>
        <a href="/unidades?estado=vendida">Vendidas</a>
        <a href="/unidades?estado=reservada">Reservadas</a>
      </nav>

      {!resultado.ok && (
        <p role="alert" className="text-sm text-destructive">
          {resultado.error.mensaje}
        </p>
      )}

      {resultado.ok && resultado.data.items.length === 0 && (
        <p>No hay unidades con este filtro. Crea la primera con el formulario de abajo.</p>
      )}

      {resultado.ok && resultado.data.items.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col">Estado</th>
              <th scope="col" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {resultado.data.items.map((item) => (
              <tr key={item.id}>
                <td className="font-mono">{item.sku}</td>
                <td>{ETIQUETA_ESTADO[item.estado] ?? item.estado}</td>
                <td>
                  {item.estado === "disponible" && (
                    <form action={cambiarEstadoUnidadAction.bind(null, item.id, "reservada")}>
                      <button
                        type="submit"
                        className="rounded-[var(--radius-input)] border border-border-strong px-3 py-1 text-sm font-medium text-text hover:bg-surface"
                      >
                        Reservar
                      </button>
                    </form>
                  )}
                  {item.estado === "reservada" && (
                    <form action={cambiarEstadoUnidadAction.bind(null, item.id, "disponible")}>
                      <button
                        type="submit"
                        className="rounded-[var(--radius-input)] border border-border-strong px-3 py-1 text-sm font-medium text-text hover:bg-surface"
                      >
                        Liberar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <FormularioUnidad variantes={variantesResultado.ok ? variantesResultado.data : []} />
    </main>
  );
}

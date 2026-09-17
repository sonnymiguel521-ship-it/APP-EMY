import Link from "next/link";
import { listarClientes } from "@/server/clientes";
import { desactivarClienteAction } from "./actions";
import { FormularioCliente } from "./formulario-cliente";

export const dynamic = "force-dynamic";

interface PaginaClientesProps {
  searchParams: Promise<{ todos?: string }>;
}

export default async function PaginaClientes({ searchParams }: PaginaClientesProps) {
  const { todos } = await searchParams;
  const soloActivos = todos !== "1";

  const resultado = await listarClientes({ soloActivos, page: 1, perPage: 50 });

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Clientes</h1>

      <nav aria-label="Filtro" className="flex gap-2">
        <a href="/clientes">Activos</a>
        <a href="/clientes?todos=1">Todos</a>
      </nav>

      {!resultado.ok && (
        <p role="alert" className="text-sm text-red-700">
          {resultado.error.mensaje}
        </p>
      )}

      {resultado.ok && resultado.data.items.length === 0 && (
        <p>Todavía no hay clientes. Crea el primero con el formulario de abajo.</p>
      )}

      {resultado.ok && resultado.data.items.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Estado</th>
              <th scope="col" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {resultado.data.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/clientes/${item.id}`}>{item.nombre}</Link>
                </td>
                <td>{item.telefono}</td>
                <td>{item.activo ? "activo" : "inactivo"}</td>
                <td>
                  {item.activo && (
                    <form action={desactivarClienteAction.bind(null, item.id)}>
                      <button type="submit" className="border rounded px-2 py-1 text-sm">
                        Desactivar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <FormularioCliente />
    </main>
  );
}

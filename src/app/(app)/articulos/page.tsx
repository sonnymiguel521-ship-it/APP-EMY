import Link from "next/link";
import { formatearDop } from "@/lib/dinero";
import { listarArticulos } from "@/server/articulos";
import { FormularioArticulo } from "./formulario-articulo";

export const dynamic = "force-dynamic";

interface PaginaArticulosProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function PaginaArticulos({ searchParams }: PaginaArticulosProps) {
  const { page } = await searchParams;
  const resultado = await listarArticulos({ page: Number(page ?? 1), perPage: 25 });

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Artículos</h1>

      {!resultado.ok && (
        <p role="alert" className="text-sm text-destructive">
          {resultado.error.mensaje}
        </p>
      )}

      {resultado.ok && resultado.data.items.length === 0 && (
        <p>Todavía no hay artículos. Crea el primero con el formulario de abajo.</p>
      )}

      {resultado.ok && resultado.data.items.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Categoría</th>
              <th scope="col">Precio</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {resultado.data.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/articulos/${item.id}`}>{item.nombre}</Link>
                </td>
                <td>{item.categoria}</td>
                <td className="font-mono">{formatearDop(item.precioBaseCentavos)}</td>
                <td>{item.activo ? "activo" : "inactivo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <FormularioArticulo />
    </main>
  );
}

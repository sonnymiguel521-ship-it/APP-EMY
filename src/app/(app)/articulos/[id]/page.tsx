import { notFound } from "next/navigation";
import { formatearDop } from "@/lib/dinero";
import { listarVariantesDeArticulo, obtenerArticulo } from "@/server/articulos";
import { desactivarArticuloAction, eliminarVarianteAction } from "../actions";
import { FormularioVariante } from "../formulario-variante";

export const dynamic = "force-dynamic";

interface PaginaArticuloProps {
  params: Promise<{ id: string }>;
}

export default async function PaginaArticulo({ params }: PaginaArticuloProps) {
  const { id } = await params;
  const resultado = await obtenerArticulo(id);

  if (!resultado.ok) {
    if (resultado.error.code === "NOT_FOUND") notFound();

    return (
      <main className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-sm text-red-700">
          {resultado.error.mensaje}
        </p>
      </main>
    );
  }

  const variantesResultado = await listarVariantesDeArticulo(id);
  const variantes = variantesResultado.ok ? variantesResultado.data : [];

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">{resultado.data.nombre}</h1>

      <dl className="flex flex-col gap-1">
        <div>
          <dt className="inline font-medium">Categoría: </dt>
          <dd className="inline">{resultado.data.categoria}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Precio base: </dt>
          <dd className="inline font-mono">{formatearDop(resultado.data.precioBaseCentavos)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Estado: </dt>
          <dd className="inline">{resultado.data.activo ? "activo" : "inactivo"}</dd>
        </div>
      </dl>

      {resultado.data.activo && (
        <form action={desactivarArticuloAction.bind(null, id)}>
          <button type="submit" className="border rounded px-3 py-2">
            Desactivar artículo
          </button>
        </form>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Variantes</h2>

        {!variantesResultado.ok && (
          <p role="alert" className="text-sm text-red-700">
            {variantesResultado.error.mensaje}
          </p>
        )}

        {variantesResultado.ok && variantes.length === 0 && (
          <p>Este artículo todavía no tiene variantes.</p>
        )}

        {variantes.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr>
                <th scope="col">Color</th>
                <th scope="col">Talla</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {variantes.map((v) => (
                <tr key={v.id}>
                  <td>{v.color}</td>
                  <td>{v.talla}</td>
                  <td>
                    <form action={eliminarVarianteAction.bind(null, v.id, id)}>
                      <button type="submit" className="border rounded px-2 py-1 text-sm">
                        Eliminar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <FormularioVariante articuloId={id} />
      </section>
    </main>
  );
}

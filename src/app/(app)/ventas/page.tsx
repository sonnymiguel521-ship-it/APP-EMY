import Link from "next/link";
import { formatearDop } from "@/lib/dinero";
import { listarVentas } from "@/server/ventas";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagada: "Pagada",
};

export default async function PaginaVentas() {
  const resultado = await listarVentas({ page: 1, perPage: 50 });

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Ventas</h1>

      <Link href="/ventas/nueva" className="border rounded px-3 py-2 self-start">
        Nueva venta
      </Link>

      {!resultado.ok && (
        <p role="alert" className="text-sm text-red-700">
          {resultado.error.mensaje}
        </p>
      )}

      {resultado.ok && resultado.data.items.length === 0 && (
        <p>Todavía no hay ventas registradas.</p>
      )}

      {resultado.ok && resultado.data.items.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Total</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {resultado.data.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/ventas/${item.id}`}>
                    {new Date(item.fecha).toLocaleDateString("es-DO")}
                  </Link>
                </td>
                <td className="font-mono">{formatearDop(item.montoTotalCentavos)}</td>
                <td>{ETIQUETA_ESTADO[item.estado] ?? item.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

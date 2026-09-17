import Link from "next/link";
import { notFound } from "next/navigation";
import { formatearDop } from "@/lib/dinero";
import { perfilDeCliente } from "@/server/clientes-perfil";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagada: "Pagada",
};

const ETIQUETA_METODO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

interface PaginaPerfilClienteProps {
  params: Promise<{ id: string }>;
}

export default async function PaginaPerfilCliente({ params }: PaginaPerfilClienteProps) {
  const { id } = await params;
  const resultado = await perfilDeCliente(id);

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

  const { cliente, ventas, pagos, saldoCentavos } = resultado.data;

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">{cliente.nombre}</h1>

      <dl className="flex flex-col gap-1">
        <div>
          <dt className="inline font-medium">Teléfono: </dt>
          <dd className="inline">{cliente.telefono}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Saldo: </dt>
          <dd className="inline font-mono">{formatearDop(saldoCentavos)}</dd>
        </div>
      </dl>

      <section>
        <h2 className="text-xl font-semibold mb-2">Historial de compras</h2>
        {ventas.length === 0 && <p>Este cliente todavía no tiene compras.</p>}
        {ventas.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">SKUs</th>
                <th scope="col">Total</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/ventas/${v.id}`}>
                      {new Date(v.fecha).toLocaleDateString("es-DO")}
                    </Link>
                  </td>
                  <td className="font-mono">{v.skus.join(", ")}</td>
                  <td className="font-mono">{formatearDop(v.montoTotalCentavos)}</td>
                  <td>{ETIQUETA_ESTADO[v.estado] ?? v.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Historial de pagos</h2>
        {pagos.length === 0 && <p>Este cliente todavía no tiene pagos registrados.</p>}
        {pagos.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Monto</th>
                <th scope="col">Método</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.fecha).toLocaleDateString("es-DO")}</td>
                  <td className="font-mono">{formatearDop(p.montoCentavos)}</td>
                  <td>{ETIQUETA_METODO[p.metodo] ?? p.metodo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

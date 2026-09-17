import { notFound } from "next/navigation";
import { formatearDop } from "@/lib/dinero";
import { listarPagosDeVenta } from "@/server/pagos";
import { obtenerVenta } from "@/server/ventas";
import { FormularioPago } from "./formulario-pago";

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

interface PaginaVentaProps {
  params: Promise<{ id: string }>;
}

export default async function PaginaVenta({ params }: PaginaVentaProps) {
  const { id } = await params;
  const resultado = await obtenerVenta(id);

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

  const pagosResultado = await listarPagosDeVenta(id);
  const pagos = pagosResultado.ok ? pagosResultado.data : [];
  const totalPagado = pagos.reduce((acc, p) => acc + p.montoCentavos, 0);
  const saldo = resultado.data.venta.montoTotalCentavos - totalPagado;

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Venta</h1>

      <a href={`/api/v1/ventas/${id}/recibo`} className="border rounded px-3 py-2 self-start">
        Descargar recibo (PDF)
      </a>

      <dl className="flex flex-col gap-1">
        <div>
          <dt className="inline font-medium">Total: </dt>
          <dd className="inline font-mono">
            {formatearDop(resultado.data.venta.montoTotalCentavos)}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Estado: </dt>
          <dd className="inline">
            {ETIQUETA_ESTADO[resultado.data.venta.estado] ?? resultado.data.venta.estado}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Saldo: </dt>
          <dd className="inline font-mono">{formatearDop(saldo)}</dd>
        </div>
      </dl>

      <section>
        <h2 className="text-xl font-semibold mb-2">Piezas</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col">Precio</th>
            </tr>
          </thead>
          <tbody>
            {resultado.data.lineas.map((linea) => (
              <tr key={linea.unidadId}>
                <td className="font-mono">{linea.sku}</td>
                <td className="font-mono">{formatearDop(linea.precioVentaCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Pagos</h2>
        {pagos.length === 0 && <p>Todavía no se ha registrado ningún pago.</p>}
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

      {saldo > 0 && <FormularioPago ventaId={id} />}
    </main>
  );
}

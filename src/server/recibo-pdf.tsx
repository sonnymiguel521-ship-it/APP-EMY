import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { articulo, cliente, pago, unidad, variante, venta, ventaUnidad } from "@/lib/db/schema";
import { formatearDop } from "@/lib/dinero";
import { ERROR_NO_AUTENTICADO, errorResultado, type Resultado } from "@/lib/resultado";

const NOMBRE_TIENDA = "Inventario Tienda de Ropa";

interface LineaRecibo {
  sku: string;
  articulo: string;
  color: string;
  talla: string;
  precioVentaCentavos: number;
}

interface PagoRecibo {
  id: string;
  fecha: Date;
  montoCentavos: number;
  metodo: string;
}

export interface DatosRecibo {
  ventaId: string;
  fecha: Date;
  montoTotalCentavos: number;
  clienteNombre: string | null;
  lineas: LineaRecibo[];
  pagos: PagoRecibo[];
  saldoCentavos: number;
}

export async function obtenerDatosRecibo(id: string): Promise<Resultado<DatosRecibo>> {
  const sesion = await getSesion();
  if (!sesion) return ERROR_NO_AUTENTICADO;

  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return errorResultado("VALIDATION_ERROR", "El id no es válido.");

  const [filaVenta] = await db.select().from(venta).where(eq(venta.id, id)).limit(1);
  if (!filaVenta) return errorResultado("NOT_FOUND", "La venta no existe.");

  let clienteNombre: string | null = null;
  if (filaVenta.clienteId) {
    const [filaCliente] = await db
      .select({ nombre: cliente.nombre })
      .from(cliente)
      .where(eq(cliente.id, filaVenta.clienteId))
      .limit(1);
    clienteNombre = filaCliente?.nombre ?? null;
  }

  const lineas = await db
    .select({
      sku: unidad.sku,
      articulo: articulo.nombre,
      color: variante.color,
      talla: variante.talla,
      precioVentaCentavos: ventaUnidad.precioVentaCentavos,
    })
    .from(ventaUnidad)
    .innerJoin(unidad, eq(ventaUnidad.unidadId, unidad.id))
    .innerJoin(variante, eq(unidad.varianteId, variante.id))
    .innerJoin(articulo, eq(variante.articuloId, articulo.id))
    .where(eq(ventaUnidad.ventaId, id));

  const pagos = await db
    .select({
      id: pago.id,
      fecha: pago.fecha,
      montoCentavos: pago.montoCentavos,
      metodo: pago.metodo,
    })
    .from(pago)
    .where(eq(pago.ventaId, id))
    .orderBy(pago.fecha);

  const totalPagado = pagos.reduce((acc, p) => acc + p.montoCentavos, 0);

  return {
    ok: true,
    data: {
      ventaId: filaVenta.id,
      fecha: filaVenta.fecha,
      montoTotalCentavos: filaVenta.montoTotalCentavos,
      clienteNombre,
      lineas,
      pagos,
      saldoCentavos: filaVenta.montoTotalCentavos - totalPagado,
    },
  };
}

const estilos = StyleSheet.create({
  pagina: { padding: 32, fontSize: 11 },
  encabezado: { marginBottom: 16 },
  tienda: { fontSize: 16, fontWeight: 700 },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 4,
  },
  columna: { flex: 1 },
  seccion: { marginTop: 16 },
  totalLinea: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});

export function documentoRecibo(datos: DatosRecibo) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.encabezado}>
          <Text style={estilos.tienda}>{NOMBRE_TIENDA}</Text>
          <Text>Recibo de venta — {datos.fecha.toISOString().slice(0, 10)}</Text>
          <Text>Cliente: {datos.clienteNombre ?? "Contado"}</Text>
        </View>

        <View style={estilos.seccion}>
          <View style={estilos.fila}>
            <Text style={estilos.columna}>SKU</Text>
            <Text style={estilos.columna}>Artículo</Text>
            <Text style={estilos.columna}>Variante</Text>
            <Text style={estilos.columna}>Precio</Text>
          </View>
          {datos.lineas.map((linea) => (
            <View style={estilos.fila} key={linea.sku}>
              <Text style={estilos.columna}>{linea.sku}</Text>
              <Text style={estilos.columna}>{linea.articulo}</Text>
              <Text style={estilos.columna}>
                {linea.color}/{linea.talla}
              </Text>
              <Text style={estilos.columna}>{formatearDop(linea.precioVentaCentavos)}</Text>
            </View>
          ))}
        </View>

        <View style={estilos.totalLinea}>
          <Text>Total</Text>
          <Text>{formatearDop(datos.montoTotalCentavos)}</Text>
        </View>

        <View style={estilos.seccion}>
          <Text>Pagos</Text>
          {datos.pagos.length === 0 && <Text>Sin pagos registrados.</Text>}
          {datos.pagos.map((p) => (
            <View style={estilos.fila} key={p.id}>
              <Text style={estilos.columna}>{p.fecha.toISOString().slice(0, 10)}</Text>
              <Text style={estilos.columna}>{p.metodo}</Text>
              <Text style={estilos.columna}>{formatearDop(p.montoCentavos)}</Text>
            </View>
          ))}
        </View>

        <View style={estilos.totalLinea}>
          <Text>Saldo</Text>
          <Text>{formatearDop(datos.saldoCentavos)}</Text>
        </View>
      </Page>
    </Document>
  );
}

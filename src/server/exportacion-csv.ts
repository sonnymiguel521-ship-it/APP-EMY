import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { articulo, unidad, variante } from "@/lib/db/schema";
import { formatearDop } from "@/lib/dinero";

const CABECERA = "sku,articulo,categoria,color,talla,estado,precio_base_dop";

export interface FilaInventario {
  sku: string;
  articulo: string;
  categoria: string;
  color: string;
  talla: string;
  estado: string;
  precioBaseCentavos: number;
}

export async function filasDeInventario(): Promise<FilaInventario[]> {
  const filas = await db
    .select({
      sku: unidad.sku,
      articulo: articulo.nombre,
      categoria: articulo.categoria,
      color: variante.color,
      talla: variante.talla,
      estado: unidad.estado,
      precioBaseCentavos: articulo.precioBaseCentavos,
    })
    .from(unidad)
    .innerJoin(variante, eq(unidad.varianteId, variante.id))
    .innerJoin(articulo, eq(variante.articuloId, articulo.id))
    .orderBy(unidad.sku);

  return filas;
}

function escaparCampoCsv(valor: string): string {
  if (valor.includes(",") || valor.includes('"') || valor.includes("\n")) {
    return `"${valor.replace(/"/g, '""')}"`;
  }

  return valor;
}

export function serializarCsv(filas: FilaInventario[]): string {
  const lineas = filas.map((fila) =>
    [
      fila.sku,
      fila.articulo,
      fila.categoria,
      fila.color,
      fila.talla,
      fila.estado,
      formatearDop(fila.precioBaseCentavos),
    ]
      .map(escaparCampoCsv)
      .join(","),
  );

  return [CABECERA, ...lineas].join("\n");
}

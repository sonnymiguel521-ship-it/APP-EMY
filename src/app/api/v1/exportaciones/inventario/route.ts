import { NextResponse } from "next/server";
import { getSesion } from "@/lib/auth";
import { ERROR_NO_AUTENTICADO } from "@/lib/resultado";
import { filasDeInventario, serializarCsv } from "@/server/exportacion-csv";

export async function GET() {
  const sesion = await getSesion();

  if (!sesion) {
    return NextResponse.json(ERROR_NO_AUTENTICADO, { status: 401 });
  }

  const filas = await filasDeInventario();
  const csv = serializarCsv(filas);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inventario.csv"',
    },
  });
}

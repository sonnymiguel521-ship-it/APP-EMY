import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { documentoRecibo, obtenerDatosRecibo } from "@/server/recibo-pdf";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const resultado = await obtenerDatosRecibo(id);

  if (!resultado.ok) {
    const status = resultado.error.code === "UNAUTHENTICATED" ? 401 : 404;
    return NextResponse.json(resultado, { status });
  }

  const buffer = await renderToBuffer(documentoRecibo(resultado.data));

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recibo-${id}.pdf"`,
    },
  });
}

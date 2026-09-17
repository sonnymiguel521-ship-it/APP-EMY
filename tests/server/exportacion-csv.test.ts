import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSesion: vi.fn() }));

import { GET } from "@/app/api/v1/exportaciones/inventario/route";
import { getSesion } from "@/lib/auth";
import { type FilaInventario, serializarCsv } from "@/server/exportacion-csv";

function fila(overrides: Partial<FilaInventario> = {}): FilaInventario {
  return {
    sku: "SKU-0001",
    articulo: "Camisa",
    categoria: "Camisas",
    color: "blanco",
    talla: "M",
    estado: "disponible",
    precioBaseCentavos: 145000,
    ...overrides,
  };
}

describe("serializarCsv", () => {
  it("emite como primera línea exactamente la cabecera de §5", () => {
    const csv = serializarCsv([]);
    const primeraLinea = csv.split("\n")[0];

    expect(primeraLinea).toBe("sku,articulo,categoria,color,talla,estado,precio_base_dop");
  });

  it("emite N líneas de datos además de la cabecera, una por unidad, ordenadas por sku ascendente", () => {
    const filas = [fila({ sku: "SKU-0001" }), fila({ sku: "SKU-0002" }), fila({ sku: "SKU-0003" })];

    const csv = serializarCsv(filas);
    const lineas = csv.split("\n");

    expect(lineas).toHaveLength(filas.length + 1);
    expect(lineas[1].startsWith("SKU-0001")).toBe(true);
    expect(lineas[2].startsWith("SKU-0002")).toBe(true);
    expect(lineas[3].startsWith("SKU-0003")).toBe(true);
  });

  it("entrecomilla un campo con coma o comilla y duplica la comilla interior", () => {
    const csv = serializarCsv([fila({ articulo: 'Camisa, talla "grande"' })]);
    const segundaLinea = csv.split("\n")[1];

    expect(segundaLinea).toContain('"Camisa, talla ""grande"""');
  });

  it("un precio_base_centavos de 145000 se escribe como 1450.00", () => {
    const csv = serializarCsv([fila({ precioBaseCentavos: 145000 })]);
    const segundaLinea = csv.split("\n")[1];

    expect(segundaLinea.endsWith(",1450.00")).toBe(true);
  });
});

describe("GET /api/v1/exportaciones/inventario", () => {
  it("sin sesión responde 401 con un cuerpo JSON cuyo error.code es UNAUTHENTICATED", async () => {
    vi.mocked(getSesion).mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });
});

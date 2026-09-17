import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSesion: vi.fn() }));

import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { articulo, variante } from "@/lib/db/schema";
import {
  crearArticulo,
  crearVariante,
  desactivarArticulo,
  listarArticulos,
} from "@/server/articulos";

const PREFIJO = "Test E1T4";

const sesionFalsa = {
  session: { id: "sesion-test", token: "t", expiresAt: new Date(), userId: "usuario-test" },
  user: { id: "usuario-test", email: "dueno-test@example.com" },
} as unknown as Awaited<ReturnType<typeof getSesion>>;

async function contarArticulosDePrueba(): Promise<number> {
  const filas = await db
    .select()
    .from(articulo)
    .where(like(articulo.nombre, `${PREFIJO}%`));
  return filas.length;
}

describe("src/server/articulos.ts", () => {
  beforeEach(() => {
    vi.mocked(getSesion).mockReset();
  });

  afterAll(async () => {
    const filas = await db
      .select()
      .from(articulo)
      .where(like(articulo.nombre, `${PREFIJO}%`));
    for (const fila of filas) {
      await db.delete(variante).where(eq(variante.articuloId, fila.id));
      await db.delete(articulo).where(eq(articulo.id, fila.id));
    }
  });

  it("crearArticulo con nombre vacío devuelve VALIDATION_ERROR y no inserta ninguna fila", async () => {
    vi.mocked(getSesion).mockResolvedValue(sesionFalsa);

    const antes = await contarArticulosDePrueba();

    const resultado = await crearArticulo({
      nombre: "",
      categoria: `${PREFIJO} Categoria`,
      precioBaseCentavos: 1000,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await contarArticulosDePrueba()).toBe(antes);
  });

  it("crearVariante con combinación duplicada devuelve VALIDATION_ERROR y no cambia el conteo", async () => {
    vi.mocked(getSesion).mockResolvedValue(sesionFalsa);

    const creado = await crearArticulo({
      nombre: `${PREFIJO} Articulo Variante`,
      categoria: `${PREFIJO} Categoria`,
      precioBaseCentavos: 2000,
    });
    if (!creado.ok) throw new Error("fixture: no se pudo crear el artículo");

    const primera = await crearVariante({ articuloId: creado.data.id, color: "rojo", talla: "M" });
    expect(primera.ok).toBe(true);

    const variantesAntes = await db
      .select()
      .from(variante)
      .where(eq(variante.articuloId, creado.data.id));

    const segunda = await crearVariante({ articuloId: creado.data.id, color: "rojo", talla: "M" });

    expect(segunda.ok).toBe(false);
    if (!segunda.ok) {
      expect(segunda.error.code).toBe("VALIDATION_ERROR");
      expect(segunda.error.campos?.talla).toBeDefined();
    }

    const variantesDespues = await db
      .select()
      .from(variante)
      .where(eq(variante.articuloId, creado.data.id));

    expect(variantesDespues).toHaveLength(variantesAntes.length);
  });

  it("desactivarArticulo pone activo en false y deja el artículo y sus variantes consultables", async () => {
    vi.mocked(getSesion).mockResolvedValue(sesionFalsa);

    const creado = await crearArticulo({
      nombre: `${PREFIJO} Articulo Desactivar`,
      categoria: `${PREFIJO} Categoria`,
      precioBaseCentavos: 3000,
    });
    if (!creado.ok) throw new Error("fixture: no se pudo crear el artículo");

    const variante1 = await crearVariante({
      articuloId: creado.data.id,
      color: "azul",
      talla: "L",
    });
    expect(variante1.ok).toBe(true);

    const desactivado = await desactivarArticulo(creado.data.id);

    expect(desactivado.ok).toBe(true);
    if (desactivado.ok) {
      expect(desactivado.data.activo).toBe(false);
    }

    const [filaArticulo] = await db.select().from(articulo).where(eq(articulo.id, creado.data.id));
    expect(filaArticulo).toBeDefined();
    expect(filaArticulo.activo).toBe(false);

    const filasVariante = await db
      .select()
      .from(variante)
      .where(eq(variante.articuloId, creado.data.id));
    expect(filasVariante).toHaveLength(1);
  });

  it("listarArticulos con perPage 2 sobre un catálogo de al menos 3 devuelve exactamente 2 filas", async () => {
    vi.mocked(getSesion).mockResolvedValue(sesionFalsa);

    for (const sufijo of ["Pag A", "Pag B", "Pag C"]) {
      const creado = await crearArticulo({
        nombre: `${PREFIJO} ${sufijo}`,
        categoria: `${PREFIJO} Categoria`,
        precioBaseCentavos: 500,
      });
      expect(creado.ok).toBe(true);
    }

    const resultado = await listarArticulos({ page: 1, perPage: 2 });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.items).toHaveLength(2);
    }
  });

  it("cualquier función se invoca sin sesión y devuelve UNAUTHENTICATED sin tocar la base", async () => {
    vi.mocked(getSesion).mockResolvedValue(null);

    const antes = await contarArticulosDePrueba();

    const resultado = await crearArticulo({
      nombre: `${PREFIJO} Sin Sesion`,
      categoria: `${PREFIJO} Categoria`,
      precioBaseCentavos: 100,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("UNAUTHENTICATED");
    }
    expect(await contarArticulosDePrueba()).toBe(antes);
  });
});

import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getSesion: vi.fn() }));

import { getSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { cliente, venta } from "@/lib/db/schema";
import {
  crearCliente,
  desactivarCliente,
  eliminarCliente,
  listarClientes,
  obtenerCliente,
  saldoDeCliente,
} from "@/server/clientes";

const PREFIJO = "Test E1T6";

const sesionFalsa = {
  session: { id: "sesion-test", token: "t", expiresAt: new Date(), userId: "usuario-test" },
  user: { id: "usuario-test", email: "dueno-test@example.com" },
} as unknown as Awaited<ReturnType<typeof getSesion>>;

describe("src/server/clientes.ts", () => {
  beforeEach(() => {
    vi.mocked(getSesion).mockReset();
    vi.mocked(getSesion).mockResolvedValue(sesionFalsa);
  });

  afterAll(async () => {
    const filas = await db
      .select()
      .from(cliente)
      .where(like(cliente.nombre, `${PREFIJO}%`));
    for (const fila of filas) {
      await db.delete(venta).where(eq(venta.clienteId, fila.id));
      await db.delete(cliente).where(eq(cliente.id, fila.id));
    }
  });

  it("crearCliente con teléfono vacío devuelve VALIDATION_ERROR y no inserta ninguna fila", async () => {
    const antes = await db
      .select()
      .from(cliente)
      .where(like(cliente.nombre, `${PREFIJO}%`));

    const resultado = await crearCliente({ nombre: `${PREFIJO} Sin Telefono`, telefono: "" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("VALIDATION_ERROR");
    }

    const despues = await db
      .select()
      .from(cliente)
      .where(like(cliente.nombre, `${PREFIJO}%`));
    expect(despues).toHaveLength(antes.length);
  });

  it("eliminarCliente con ventas asociadas devuelve CLIENTE_CON_VENTAS y deja el cliente intacto", async () => {
    const creado = await crearCliente({
      nombre: `${PREFIJO} Con Ventas`,
      telefono: "809-111-1111",
    });
    if (!creado.ok) throw new Error("fixture: no se pudo crear el cliente");

    await db.insert(venta).values({ clienteId: creado.data.id, montoTotalCentavos: 1000 });

    const resultado = await eliminarCliente(creado.data.id);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("CLIENTE_CON_VENTAS");
    }

    const obtenido = await obtenerCliente(creado.data.id);
    expect(obtenido.ok).toBe(true);
  });

  it("eliminarCliente sin ventas borra la fila y obtenerCliente devuelve NOT_FOUND", async () => {
    const creado = await crearCliente({
      nombre: `${PREFIJO} Sin Ventas`,
      telefono: "809-222-2222",
    });
    if (!creado.ok) throw new Error("fixture: no se pudo crear el cliente");

    const resultado = await eliminarCliente(creado.data.id);
    expect(resultado.ok).toBe(true);

    const obtenido = await obtenerCliente(creado.data.id);
    expect(obtenido.ok).toBe(false);
    if (!obtenido.ok) {
      expect(obtenido.error.code).toBe("NOT_FOUND");
    }
  });

  it("desactivarCliente pone activo en false, lo excluye del listado de activos y sigue accesible por id", async () => {
    const creado = await crearCliente({
      nombre: `${PREFIJO} Desactivar`,
      telefono: "809-333-3333",
    });
    if (!creado.ok) throw new Error("fixture: no se pudo crear el cliente");

    const desactivado = await desactivarCliente(creado.data.id);
    expect(desactivado.ok).toBe(true);
    if (desactivado.ok) {
      expect(desactivado.data.activo).toBe(false);
    }

    const listaActivos = await listarClientes({ soloActivos: true, page: 1, perPage: 100 });
    expect(listaActivos.ok).toBe(true);
    if (listaActivos.ok) {
      expect(listaActivos.data.items.some((c) => c.id === creado.data.id)).toBe(false);
    }

    const obtenido = await obtenerCliente(creado.data.id);
    expect(obtenido.ok).toBe(true);
  });

  it("saldoDeCliente para un cliente sin ventas devuelve 0 centavos, no null", async () => {
    const creado = await crearCliente({
      nombre: `${PREFIJO} Sin Deuda`,
      telefono: "809-444-4444",
    });
    if (!creado.ok) throw new Error("fixture: no se pudo crear el cliente");

    const resultado = await saldoDeCliente(creado.data.id);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data).toBe(0);
    }
  });
});

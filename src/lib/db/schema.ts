import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const estadoUnidad = pgEnum("estado_unidad", ["disponible", "vendida", "reservada"]);
export const estadoVenta = pgEnum("estado_venta", ["pendiente", "parcial", "pagada"]);
export const metodoPago = pgEnum("metodo_pago", ["efectivo", "transferencia", "tarjeta"]);

const creadoEn = timestamp("creado_en", { withTimezone: true }).notNull().defaultNow();
const actualizadoEn = timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow();

export const articulo = pgTable(
  "articulo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    categoria: text("categoria").notNull(),
    descripcion: text("descripcion"),
    precioBaseCentavos: integer("precio_base_centavos").notNull(),
    activo: boolean("activo").notNull().default(true),
    creadoEn,
    actualizadoEn,
  },
  (t) => [index("articulo_nombre_idx").on(t.nombre)],
);

export const variante = pgTable(
  "variante",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articuloId: uuid("articulo_id")
      .notNull()
      .references(() => articulo.id, { onDelete: "restrict" }),
    color: text("color").notNull(),
    talla: text("talla").notNull(),
    creadoEn,
    actualizadoEn,
  },
  (t) => [unique("variante_articulo_color_talla_unique").on(t.articuloId, t.color, t.talla)],
);

export const unidad = pgTable(
  "unidad",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    varianteId: uuid("variante_id")
      .notNull()
      .references(() => variante.id, { onDelete: "restrict" }),
    sku: text("sku").notNull(),
    skuAutoGenerado: boolean("sku_auto_generado").notNull().default(true),
    estado: estadoUnidad("estado").notNull().default("disponible"),
    creadoEn,
    actualizadoEn,
  },
  (t) => [
    unique("unidad_sku_unique").on(t.sku),
    index("unidad_estado_idx").on(t.estado),
    index("unidad_variante_idx").on(t.varianteId),
  ],
);

export const cliente = pgTable(
  "cliente",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    telefono: text("telefono").notNull(),
    direccion: text("direccion"),
    fechaRegistro: timestamp("fecha_registro", { withTimezone: true }).notNull().defaultNow(),
    activo: boolean("activo").notNull().default(true),
    creadoEn,
    actualizadoEn,
  },
  (t) => [index("cliente_nombre_idx").on(t.nombre)],
);

export const venta = pgTable(
  "venta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id").references(() => cliente.id, { onDelete: "restrict" }),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    montoTotalCentavos: integer("monto_total_centavos").notNull(),
    estado: estadoVenta("estado").notNull().default("pendiente"),
    creadoEn,
    actualizadoEn,
  },
  (t) => [index("venta_cliente_idx").on(t.clienteId)],
);

export const ventaUnidad = pgTable(
  "venta_unidad",
  {
    ventaId: uuid("venta_id")
      .notNull()
      .references(() => venta.id, { onDelete: "cascade" }),
    unidadId: uuid("unidad_id")
      .notNull()
      .references(() => unidad.id, { onDelete: "restrict" }),
    precioVentaCentavos: integer("precio_venta_centavos").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ventaId, t.unidadId] }),
    unique("venta_unidad_unidad_unique").on(t.unidadId),
  ],
);

export const pago = pgTable(
  "pago",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventaId: uuid("venta_id")
      .notNull()
      .references(() => venta.id, { onDelete: "cascade" }),
    montoCentavos: integer("monto_centavos").notNull(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
    metodo: metodoPago("metodo").notNull(),
    creadoEn,
  },
  (t) => [index("pago_venta_idx").on(t.ventaId)],
);

CREATE TYPE "public"."estado_unidad" AS ENUM('disponible', 'vendida', 'reservada');--> statement-breakpoint
CREATE TYPE "public"."estado_venta" AS ENUM('pendiente', 'parcial', 'pagada');--> statement-breakpoint
CREATE TYPE "public"."metodo_pago" AS ENUM('efectivo', 'transferencia', 'tarjeta');--> statement-breakpoint
CREATE TABLE "articulo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text NOT NULL,
	"descripcion" text,
	"precio_base_centavos" integer NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cliente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"direccion" text,
	"fecha_registro" timestamp with time zone DEFAULT now() NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venta_id" uuid NOT NULL,
	"monto_centavos" integer NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"metodo" "metodo_pago" NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variante_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"sku_auto_generado" boolean DEFAULT true NOT NULL,
	"estado" "estado_unidad" DEFAULT 'disponible' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unidad_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "variante" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"articulo_id" uuid NOT NULL,
	"color" text NOT NULL,
	"talla" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variante_articulo_color_talla_unique" UNIQUE("articulo_id","color","talla")
);
--> statement-breakpoint
CREATE TABLE "venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"monto_total_centavos" integer NOT NULL,
	"estado" "estado_venta" DEFAULT 'pendiente' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venta_unidad" (
	"venta_id" uuid NOT NULL,
	"unidad_id" uuid NOT NULL,
	"precio_venta_centavos" integer NOT NULL,
	CONSTRAINT "venta_unidad_venta_id_unidad_id_pk" PRIMARY KEY("venta_id","unidad_id"),
	CONSTRAINT "venta_unidad_unidad_unique" UNIQUE("unidad_id")
);
--> statement-breakpoint
ALTER TABLE "pago" ADD CONSTRAINT "pago_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unidad" ADD CONSTRAINT "unidad_variante_id_variante_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variante"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variante" ADD CONSTRAINT "variante_articulo_id_articulo_id_fk" FOREIGN KEY ("articulo_id") REFERENCES "public"."articulo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta" ADD CONSTRAINT "venta_cliente_id_cliente_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."cliente"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_unidad" ADD CONSTRAINT "venta_unidad_venta_id_venta_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."venta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_unidad" ADD CONSTRAINT "venta_unidad_unidad_id_unidad_id_fk" FOREIGN KEY ("unidad_id") REFERENCES "public"."unidad"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articulo_nombre_idx" ON "articulo" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "cliente_nombre_idx" ON "cliente" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "pago_venta_idx" ON "pago" USING btree ("venta_id");--> statement-breakpoint
CREATE INDEX "unidad_estado_idx" ON "unidad" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "unidad_variante_idx" ON "unidad" USING btree ("variante_id");--> statement-breakpoint
CREATE INDEX "venta_cliente_idx" ON "venta" USING btree ("cliente_id");
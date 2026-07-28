CREATE TABLE "intentos_canje" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"huella" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intentos_canje" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "intentos_canje_huella_creado_en" ON "intentos_canje" USING btree ("huella","creado_en");
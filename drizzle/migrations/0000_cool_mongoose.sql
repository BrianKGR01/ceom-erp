CREATE TABLE "setup_healthcheck" (
	"id" serial PRIMARY KEY NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);

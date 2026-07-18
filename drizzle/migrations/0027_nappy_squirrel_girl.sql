ALTER TABLE "instituciones" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "instituciones" ADD COLUMN "auth_user_id" uuid;--> statement-breakpoint
ALTER TABLE "instituciones" ADD CONSTRAINT "instituciones_auth_user_id_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instituciones_email_unique" ON "instituciones" USING btree ("email") WHERE "instituciones"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "instituciones_auth_user_id_unique" ON "instituciones" USING btree ("auth_user_id") WHERE "instituciones"."auth_user_id" is not null;
ALTER POLICY "compras_gateway_sistema_bypass" ON "compras" TO authenticated USING ((select es_gateway_sistema())
      and (select public.tenant_tiene_consentimiento_vigente((tenant_id), 'financiero'::modulo_veedor)));--> statement-breakpoint
ALTER POLICY "pagos_compra_gateway_sistema_bypass" ON "pagos_compra" TO authenticated USING ((select es_gateway_sistema())
      and (select public.tenant_tiene_consentimiento_vigente(((select compras.tenant_id from compras where compras.id = pagos_compra.compra_id)), 'financiero'::modulo_veedor)));
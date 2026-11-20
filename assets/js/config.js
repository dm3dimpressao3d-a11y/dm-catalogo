/*
 * CONFIGURAÇÃO DO SUPABASE
 * ------------------------
 * Cole aqui os 2 valores do seu projeto:
 *   Supabase > Project Settings > API
 *     - Project URL        -> SUPABASE_URL
 *     - Publishable key (sb_publishable_...) ou a antiga "anon public" -> SUPABASE_ANON_KEY
 *
 * Pode ficar público: a chave publishable/anon foi feita para ir no navegador.
 * Quem protege os dados são as regras (RLS) do arquivo supabase/schema.sql.
 * NUNCA cole aqui a Secret key (sb_secret_...) nem a "service_role".
 *
 * Enquanto estiver com os textos "COLE_AQUI", o catálogo roda em
 * MODO DEMONSTRAÇÃO (dados de exemplo salvos só no seu navegador).
 */
window.DM_CONFIG = {
  SUPABASE_URL: "https://cxpuioeucofnuxjorknu.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_hRSRDCPnddfmxfUT_VhX1Q_2oTyqI22",
};

-- Seed de custos de produção (Dashboard)
-- Usa app_settings existente; não sobrescreve valores já salvos.

INSERT INTO app_settings (key, value) VALUES
  ('cost_cut_sew_per_item', '0'),
  ('cost_fabric_per_meter', '0'),
  ('cost_packaging_per_order', '0')
ON CONFLICT (key) DO NOTHING;

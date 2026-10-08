ALTER TABLE "configuracao_plataforma"
  ADD COLUMN "provider_name" VARCHAR(120) NOT NULL DEFAULT 'Fyberlink',
  ADD COLUMN "logo_data_url" TEXT,
  ADD COLUMN "text_primary" VARCHAR(7) NOT NULL DEFAULT '#0f172a',
  ADD COLUMN "text_secondary" VARCHAR(7) NOT NULL DEFAULT '#475569';
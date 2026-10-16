CREATE TYPE "TipoFotoRemocao" AS ENUM ('FOTO_SERIAL', 'FOTO_FACHADA');

CREATE TABLE "fotos_remocao" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ordem_id" UUID NOT NULL,
  "usuario_id" UUID,
  "usuario_nome" VARCHAR(160) NOT NULL,
  "tipo" "TipoFotoRemocao" NOT NULL,
  "imagem_data_url" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fotos_remocao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fotos_remocao_ordem_id_created_at_idx" ON "fotos_remocao"("ordem_id", "created_at");
ALTER TABLE "fotos_remocao" ADD CONSTRAINT "fotos_remocao_ordem_id_fkey"
  FOREIGN KEY ("ordem_id") REFERENCES "ordens_remocao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fotos_remocao" ADD CONSTRAINT "fotos_remocao_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "fotos_remocao" ("ordem_id", "usuario_id", "usuario_nome", "tipo", "imagem_data_url", "created_at")
SELECT ordem."id", COALESCE(ordem."tecnico_id", ordem."criado_por_id"), COALESCE(usuario."nome", 'Usuário removido'),
       'FOTO_SERIAL', ordem."foto_serial_url", ordem."updated_at"
FROM "ordens_remocao" AS ordem
LEFT JOIN "usuarios" AS usuario ON usuario."id" = COALESCE(ordem."tecnico_id", ordem."criado_por_id")
WHERE ordem."foto_serial_url" IS NOT NULL;

INSERT INTO "fotos_remocao" ("ordem_id", "usuario_id", "usuario_nome", "tipo", "imagem_data_url", "created_at")
SELECT ordem."id", COALESCE(ordem."tecnico_id", ordem."criado_por_id"), COALESCE(usuario."nome", 'Usuário removido'),
       'FOTO_FACHADA', ordem."foto_fachada_url", ordem."updated_at"
FROM "ordens_remocao" AS ordem
LEFT JOIN "usuarios" AS usuario ON usuario."id" = COALESCE(ordem."tecnico_id", ordem."criado_por_id")
WHERE ordem."foto_fachada_url" IS NOT NULL;
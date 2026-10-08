ALTER TABLE "checklists" DROP CONSTRAINT "checklists_usuario_id_fkey";
ALTER TABLE "checklists" ADD COLUMN "usuario_nome" VARCHAR(160);
UPDATE "checklists" AS checklist
SET "usuario_nome" = usuario."nome"
FROM "usuarios" AS usuario
WHERE checklist."usuario_id" = usuario."id";
ALTER TABLE "checklists" ALTER COLUMN "usuario_id" DROP NOT NULL;
ALTER TABLE "checklists" ADD COLUMN "excluido_em" TIMESTAMP(3);
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rotas_remocao" ALTER COLUMN "criado_por_id" DROP NOT NULL;
ALTER TABLE "rotas_remocao" DROP CONSTRAINT "rotas_remocao_criado_por_id_fkey";
ALTER TABLE "rotas_remocao" ADD CONSTRAINT "rotas_remocao_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "observacoes_remocao" ALTER COLUMN "usuario_id" DROP NOT NULL;
ALTER TABLE "observacoes_remocao" DROP CONSTRAINT "observacoes_remocao_usuario_id_fkey";
ALTER TABLE "observacoes_remocao" ADD CONSTRAINT "observacoes_remocao_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "movimentacoes_caixa" ALTER COLUMN "operador_id" DROP NOT NULL;
ALTER TABLE "movimentacoes_caixa" DROP CONSTRAINT "movimentacoes_caixa_operador_id_fkey";
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "movimentacoes_caixa_operador_id_fkey"
  FOREIGN KEY ("operador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "logs_auditoria"
  ADD COLUMN "autor_master_admin" BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE "logs_auditoria" AS log
SET "autor_master_admin" = EXISTS (
  SELECT 1
  FROM "usuarios_perfis" AS usuario_perfil
  JOIN "perfis" AS perfil ON perfil."id" = usuario_perfil."perfil_id"
  WHERE usuario_perfil."usuario_id" = log."usuario_id"
    AND perfil."code" = 'MASTER_ADMIN'
);

CREATE TABLE "termos_responsabilidade" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "descricao" TEXT NOT NULL,
  "criado_por_id" UUID,
  "criado_por_nome" VARCHAR(160) NOT NULL,
  "usuario_designado_id" UUID,
  "usuario_designado_nome" VARCHAR(160) NOT NULL,
  "usuario_designado_email" VARCHAR(160) NOT NULL,
  "assinatura_data" TEXT,
  "assinado_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "termos_responsabilidade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "termos_responsabilidade_usuario_designado_id_assinado_em_idx"
  ON "termos_responsabilidade"("usuario_designado_id", "assinado_em");
CREATE INDEX "termos_responsabilidade_created_at_idx"
  ON "termos_responsabilidade"("created_at");
ALTER TABLE "termos_responsabilidade" ADD CONSTRAINT "termos_responsabilidade_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "termos_responsabilidade" ADD CONSTRAINT "termos_responsabilidade_usuario_designado_id_fkey"
  FOREIGN KEY ("usuario_designado_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "checklist_templates"
SET "pergunta" = 'Clivador'
WHERE "categoria" = 'FERRAMENTAS' AND "pergunta" = 'Cortador';

INSERT INTO "checklist_templates" (
  "id", "categoria", "pergunta", "tipo_resposta", "obrigatoria", "item_critico", "ativo", "created_at"
)
SELECT gen_random_uuid(), 'FERRAMENTAS', 'Rotuladora', 'OK', TRUE, FALSE, TRUE, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "checklist_templates"
  WHERE "categoria" = 'FERRAMENTAS' AND "pergunta" = 'Rotuladora'
);

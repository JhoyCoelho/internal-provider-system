INSERT INTO "logs_auditoria" (
  "id", "usuario_id", "autor_master_admin", "acao", "entidade", "entidade_id", "valor_novo", "created_at"
)
SELECT gen_random_uuid(), checklist."usuario_id",
       EXISTS (
         SELECT 1 FROM "usuarios_perfis" AS usuario_perfil
         JOIN "perfis" AS perfil ON perfil."id" = usuario_perfil."perfil_id"
         WHERE usuario_perfil."usuario_id" = checklist."usuario_id" AND perfil."code" = 'MASTER_ADMIN'
       ),
       'CHECKLIST_PREENCHIDO', 'CHECKLIST', checklist."id"::text,
       jsonb_build_object('categoria', checklist."categoria", 'status', checklist."status", 'historicoReconstruido', TRUE),
       checklist."data_preenchimento"
FROM "checklists" AS checklist
WHERE checklist."usuario_id" IS NOT NULL
  AND checklist."data_preenchimento" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "logs_auditoria" AS log
    WHERE log."acao" = 'CHECKLIST_PREENCHIDO' AND log."entidade" = 'CHECKLIST' AND log."entidade_id" = checklist."id"::text
  );

INSERT INTO "logs_auditoria" (
  "id", "usuario_id", "autor_master_admin", "acao", "entidade", "entidade_id", "valor_novo", "created_at"
)
SELECT gen_random_uuid(), checklist."usuario_id",
       EXISTS (
         SELECT 1 FROM "usuarios_perfis" AS usuario_perfil
         JOIN "perfis" AS perfil ON perfil."id" = usuario_perfil."perfil_id"
         WHERE usuario_perfil."usuario_id" = checklist."usuario_id" AND perfil."code" = 'MASTER_ADMIN'
       ),
       'JUSTIFICATIVA_CHECKLIST_PREENCHIDA', 'CHECKLIST', checklist."id"::text,
       jsonb_build_object('categoria', checklist."categoria", 'status', checklist."status", 'historicoReconstruido', TRUE),
       checklist."updated_at"
FROM "checklists" AS checklist
WHERE checklist."usuario_id" IS NOT NULL
  AND checklist."justificativa_atraso" IS NOT NULL
  AND checklist."status" = 'EM_ATRASO'
  AND NOT EXISTS (
    SELECT 1 FROM "logs_auditoria" AS log
    WHERE log."acao" = 'JUSTIFICATIVA_CHECKLIST_PREENCHIDA' AND log."entidade" = 'CHECKLIST' AND log."entidade_id" = checklist."id"::text
  );

INSERT INTO "logs_auditoria" (
  "id", "usuario_id", "autor_master_admin", "acao", "entidade", "entidade_id", "valor_novo", "created_at"
)
SELECT gen_random_uuid(), ordem."criado_por_id",
       EXISTS (
         SELECT 1 FROM "usuarios_perfis" AS usuario_perfil
         JOIN "perfis" AS perfil ON perfil."id" = usuario_perfil."perfil_id"
         WHERE usuario_perfil."usuario_id" = ordem."criado_por_id" AND perfil."code" = 'MASTER_ADMIN'
       ),
       'REMOCAO_CRIADA', 'REMOCAO', ordem."id"::text,
       jsonb_build_object('status', ordem."status", 'historicoReconstruido', TRUE),
       ordem."created_at"
FROM "ordens_remocao" AS ordem
WHERE ordem."criado_por_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "logs_auditoria" AS log
    WHERE log."acao" = 'REMOCAO_CRIADA' AND log."entidade" = 'REMOCAO' AND log."entidade_id" = ordem."id"::text
  );

INSERT INTO "logs_auditoria" (
  "id", "usuario_id", "autor_master_admin", "acao", "entidade", "entidade_id", "valor_novo", "created_at"
)
SELECT gen_random_uuid(), rota."criado_por_id",
       EXISTS (
         SELECT 1 FROM "usuarios_perfis" AS usuario_perfil
         JOIN "perfis" AS perfil ON perfil."id" = usuario_perfil."perfil_id"
         WHERE usuario_perfil."usuario_id" = rota."criado_por_id" AND perfil."code" = 'MASTER_ADMIN'
       ),
       'ROTA_CRIADA', 'ROTA', rota."id"::text,
       jsonb_build_object('paradas', (SELECT COUNT(*) FROM "rotas_remocao_paradas" AS parada WHERE parada."rota_id" = rota."id"), 'historicoReconstruido', TRUE),
       rota."created_at"
FROM "rotas_remocao" AS rota
WHERE rota."criado_por_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "logs_auditoria" AS log
    WHERE log."acao" = 'ROTA_CRIADA' AND log."entidade" = 'ROTA' AND log."entidade_id" = rota."id"::text
  );

INSERT INTO "logs_auditoria" (
  "id", "usuario_id", "autor_master_admin", "acao", "entidade", "entidade_id", "valor_novo", "created_at"
)
SELECT gen_random_uuid(), termo."usuario_designado_id",
       EXISTS (
         SELECT 1 FROM "usuarios_perfis" AS usuario_perfil
         JOIN "perfis" AS perfil ON perfil."id" = usuario_perfil."perfil_id"
         WHERE usuario_perfil."usuario_id" = termo."usuario_designado_id" AND perfil."code" = 'MASTER_ADMIN'
       ),
       'TERMO_RESPONSABILIDADE_ASSINADO', 'TERMO_RESPONSABILIDADE', termo."id"::text,
       jsonb_build_object('usuarioDesignadoNome', termo."usuario_designado_nome", 'historicoReconstruido', TRUE),
       termo."assinado_em"
FROM "termos_responsabilidade" AS termo
WHERE termo."usuario_designado_id" IS NOT NULL
  AND termo."assinado_em" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "logs_auditoria" AS log
    WHERE log."acao" = 'TERMO_RESPONSABILIDADE_ASSINADO' AND log."entidade" = 'TERMO_RESPONSABILIDADE' AND log."entidade_id" = termo."id"::text
  );
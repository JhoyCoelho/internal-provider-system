INSERT INTO "checklist_templates" (
  "id", "categoria", "pergunta", "tipo_resposta", "obrigatoria", "item_critico", "ativo", "created_at"
)
SELECT gen_random_uuid(), template."categoria", template."pergunta", 'OK', TRUE, FALSE, TRUE, CURRENT_TIMESTAMP
FROM (VALUES
  ('CELULAR_CORPORATIVO', 'Tela e display'),
  ('CELULAR_CORPORATIVO', 'Carcaça e bordas'),
  ('CELULAR_CORPORATIVO', 'Câmeras frontal e traseira'),
  ('CELULAR_CORPORATIVO', 'Botões físicos'),
  ('CELULAR_CORPORATIVO', 'Conectores e portas'),
  ('CELULAR_CORPORATIVO', 'Carregador e cabo USB'),
  ('CELULAR_CORPORATIVO', 'Sistema'),
  ('CELULAR_CORPORATIVO', 'Bateria'),
  ('CELULAR_CORPORATIVO', 'Áudio'),
  ('CELULAR_CORPORATIVO', 'Conectividade')
) AS template("categoria", "pergunta")
WHERE NOT EXISTS (
  SELECT 1 FROM "checklist_templates" AS existing
  WHERE existing."categoria" = template."categoria"
    AND existing."pergunta" = template."pergunta"
);

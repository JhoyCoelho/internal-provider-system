-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('MASTER_ADMIN', 'SUPERVISOR', 'COORDENADOR', 'DIRETORIA', 'TECNICO', 'FINANCEIRO', 'COMERCIAL', 'OPERADOR_CAIXA');

-- CreateEnum
CREATE TYPE "PermissionCode" AS ENUM ('USERS_READ', 'USERS_WRITE', 'REPORTS_READ', 'AUDIT_READ', 'ORDERS_READ', 'ORDERS_WRITE', 'CHECKLIST_READ', 'CHECKLIST_WRITE', 'CASH_READ', 'CASH_WRITE', 'APPROVE_CLOSURE', 'APPROVE_LATE_CHECKLIST');

-- CreateEnum
CREATE TYPE "StatusOrdemRecolhimento" AS ENUM ('ABERTO', 'ROTEIRIZADO', 'CONCLUIDO', 'FALHA_TENTATIVA');

-- CreateEnum
CREATE TYPE "SubstatusFalha" AS ENUM ('CLIENTE_AUSENTE', 'RECUSA', 'MUDOU_SE', 'ENDERECO_NAO_LOCALIZADO');

-- CreateEnum
CREATE TYPE "TipoRespostaChecklist" AS ENUM ('OK', 'NAO_CONFORME', 'TEXTO');

-- CreateEnum
CREATE TYPE "StatusChecklist" AS ENUM ('PENDENTE', 'PREENCHIDO', 'EM_ATRASO', 'PENDENTE_APROVACAO', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "StatusMovimentoCaixa" AS ENUM ('ABERTO', 'FECHADO', 'PENDENTE_APROVACAO');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'INATIVO', 'BLOQUEADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "telefone" VARCHAR(40),
    "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO',
    "ultimo_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis" (
    "id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "descricao" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissoes" (
    "id" UUID NOT NULL,
    "code" "PermissionCode" NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_perfis" (
    "usuario_id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,

    CONSTRAINT "usuarios_perfis_pkey" PRIMARY KEY ("usuario_id","perfil_id")
);

-- CreateTable
CREATE TABLE "perfis_permissoes" (
    "perfil_id" UUID NOT NULL,
    "permissao_id" UUID NOT NULL,

    CONSTRAINT "perfis_permissoes_pkey" PRIMARY KEY ("perfil_id","permissao_id")
);

-- CreateTable
CREATE TABLE "ordens_recolhimento" (
    "id" UUID NOT NULL,
    "cliente_nome" VARCHAR(180) NOT NULL,
    "endereco" VARCHAR(255) NOT NULL,
    "bairro" VARCHAR(120) NOT NULL,
    "regiao" VARCHAR(120) NOT NULL,
    "equipamento_serial" VARCHAR(120) NOT NULL,
    "status" "StatusOrdemRecolhimento" NOT NULL DEFAULT 'ABERTO',
    "substatus_falha" "SubstatusFalha",
    "foto_serial_url" VARCHAR(500),
    "foto_fachada_url" VARCHAR(500),
    "tecnico_id" UUID,
    "criado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordens_recolhimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" UUID NOT NULL,
    "pergunta" VARCHAR(255) NOT NULL,
    "tipo_resposta" "TipoRespostaChecklist" NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
    "item_critico" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklists" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "data_preenchimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusChecklist" NOT NULL DEFAULT 'PENDENTE',
    "justificativa_atraso" TEXT,
    "aprovado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_respostas" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "valor_texto" TEXT,
    "valor_booleano" BOOLEAN,
    "resposta_tipo" "TipoRespostaChecklist" NOT NULL,
    "item_critico" BOOLEAN NOT NULL DEFAULT false,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_respostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_caixa" (
    "id" UUID NOT NULL,
    "operador_id" UUID NOT NULL,
    "turno_aberto_em" TIMESTAMP(3) NOT NULL,
    "turno_fechado_em" TIMESTAMP(3),
    "valor_esperado" DECIMAL(12,2) NOT NULL,
    "valor_em_maos" DECIMAL(12,2) NOT NULL,
    "divergencia" DECIMAL(12,2) NOT NULL,
    "justificativa" TEXT,
    "status" "StatusMovimentoCaixa" NOT NULL DEFAULT 'ABERTO',
    "aprovado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimentacoes_caixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "acao" VARCHAR(255) NOT NULL,
    "entidade" VARCHAR(120) NOT NULL,
    "entidade_id" VARCHAR(80),
    "valor_antigo" JSONB,
    "valor_novo" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_code_key" ON "perfis"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissoes_code_key" ON "permissoes"("code");

-- AddForeignKey
ALTER TABLE "usuarios_perfis" ADD CONSTRAINT "usuarios_perfis_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_perfis" ADD CONSTRAINT "usuarios_perfis_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfis_permissoes" ADD CONSTRAINT "perfis_permissoes_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfis_permissoes" ADD CONSTRAINT "perfis_permissoes_permissao_id_fkey" FOREIGN KEY ("permissao_id") REFERENCES "permissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_recolhimento" ADD CONSTRAINT "ordens_recolhimento_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_recolhimento" ADD CONSTRAINT "ordens_recolhimento_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_respostas" ADD CONSTRAINT "checklist_respostas_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_respostas" ADD CONSTRAINT "checklist_respostas_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_caixa" ADD CONSTRAINT "movimentacoes_caixa_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Schema SQL do MVP do sistema interno de ISP
-- Observação: o projeto usa Prisma como ORM, mas este script pode servir como base documental para DDL e revisão de negócio.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE role_code AS ENUM (
  'MASTER_ADMIN',
  'SUPERVISOR',
  'COORDENADOR',
  'DIRETORIA',
  'TECNICO',
  'FINANCEIRO',
  'COMERCIAL',
  'OPERADOR_CAIXA'
);

CREATE TYPE permission_code AS ENUM (
  'USERS_READ',
  'USERS_WRITE',
  'REPORTS_READ',
  'AUDIT_READ',
  'ORDERS_READ',
  'ORDERS_WRITE',
  'CHECKLIST_READ',
  'CHECKLIST_WRITE',
  'CASH_READ',
  'CASH_WRITE',
  'APPROVE_CLOSURE',
  'APPROVE_LATE_CHECKLIST'
);

CREATE TYPE status_ordem_remocao AS ENUM (
  'ABERTO',
  'ROTEIRIZADO',
  'CONCLUIDO',
  'FALHA_TENTATIVA'
);

CREATE TYPE substatus_falha AS ENUM (
  'CLIENTE_AUSENTE',
  'RECUSA',
  'MUDOU_SE',
  'ENDERECO_NAO_LOCALIZADO'
);

CREATE TYPE tipo_resposta_checklist AS ENUM (
  'OK',
  'NAO_CONFORME',
  'TEXTO'
);

CREATE TYPE status_checklist AS ENUM (
  'PENDENTE',
  'PREENCHIDO',
  'EM_ATRASO',
  'PENDENTE_APROVACAO',
  'APROVADO',
  'REPROVADO'
);

CREATE TYPE status_movimento_caixa AS ENUM (
  'ABERTO',
  'FECHADO',
  'PENDENTE_APROVACAO'
);

CREATE TYPE status_usuario AS ENUM (
  'ATIVO',
  'INATIVO',
  'BLOQUEADO'
);

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  telefone VARCHAR(40),
  status status_usuario NOT NULL DEFAULT 'ATIVO',
  ultimo_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE perfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code role_code NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  descricao TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code permission_code NOT NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios_perfis (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  perfil_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, perfil_id)
);

CREATE TABLE perfis_permissoes (
  perfil_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  permissao_id UUID NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
  PRIMARY KEY (perfil_id, permissao_id)
);

CREATE TABLE ordens_remocao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome VARCHAR(180) NOT NULL,
  endereco VARCHAR(255) NOT NULL,
  bairro VARCHAR(120) NOT NULL,
  regiao VARCHAR(120) NOT NULL,
  equipamento_serial VARCHAR(120) NOT NULL,
  status status_ordem_remocao NOT NULL DEFAULT 'ABERTO',
  substatus_falha substatus_falha,
  foto_serial_url VARCHAR(500),
  foto_fachada_url VARCHAR(500),
  tecnico_id UUID REFERENCES usuarios(id),
  criado_por_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta VARCHAR(255) NOT NULL,
  tipo_resposta tipo_resposta_checklist NOT NULL,
  obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,
  item_critico BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  data_preenchimento TIMESTAMPTZ NOT NULL,
  status status_checklist NOT NULL DEFAULT 'PENDENTE',
  justificativa_atraso TEXT,
  aprovado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES checklist_templates(id),
  valor_texto TEXT,
  valor_booleano BOOLEAN,
  resposta_tipo tipo_resposta_checklist NOT NULL,
  item_critico BOOLEAN NOT NULL DEFAULT FALSE,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE movimentacoes_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id UUID NOT NULL REFERENCES usuarios(id),
  turno_aberto_em TIMESTAMPTZ NOT NULL,
  turno_fechado_em TIMESTAMPTZ,
  valor_esperado DECIMAL(12,2) NOT NULL,
  valor_em_maos DECIMAL(12,2) NOT NULL,
  divergencia DECIMAL(12,2) NOT NULL,
  justificativa TEXT,
  status status_movimento_caixa NOT NULL DEFAULT 'ABERTO',
  aprovado_por_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE logs_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  acao VARCHAR(255) NOT NULL,
  entidade VARCHAR(120) NOT NULL,
  entidade_id VARCHAR(80),
  valor_antigo JSONB,
  valor_novo JSONB,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ordens_remocao_status ON ordens_remocao(status);
CREATE INDEX idx_ordens_remocao_regiao_bairro ON ordens_remocao(regiao, bairro);
CREATE INDEX idx_checklists_usuario_data ON checklists(usuario_id, data_preenchimento);
CREATE INDEX idx_logs_auditoria_entidade ON logs_auditoria(entidade, entidade_id);

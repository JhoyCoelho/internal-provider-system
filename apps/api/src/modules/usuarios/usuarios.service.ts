import bcrypt from 'bcryptjs';
import { Prisma, RoleCode, StatusUsuario } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const managedRoles = [RoleCode.MASTER_ADMIN, RoleCode.ADMIN, RoleCode.TECNICO] as const;
type ManagedRole = (typeof managedRoles)[number];

const safeUserSelect = {
  id: true,
  nome: true,
  email: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  ultimoLogin: true,
  roles: { select: { perfil: { select: { code: true } } } },
} satisfies Prisma.UsuarioSelect;

type SafeUser = Prisma.UsuarioGetPayload<{ select: typeof safeUserSelect }>;

function presentUser(user: SafeUser) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    status: user.status,
    role: user.roles[0]?.perfil.code ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ultimoLogin: user.ultimoLogin,
  };
}

async function getActiveRole(roleCode: ManagedRole) {
  const role = await prisma.perfil.findUnique({ where: { code: roleCode }, select: { id: true, active: true } });
  if (!role?.active) throw new Error('O tipo de usuário não está configurado. Execute o seed de permissões.');
  return role;
}

export async function listManagedUsers() {
  const users = await prisma.usuario.findMany({
    orderBy: [{ nome: 'asc' }, { email: 'asc' }],
    select: safeUserSelect,
  });
  return users.map(presentUser);
}

export async function createManagedUser(input: {
  nome: string;
  email: string;
  password: string;
  role: ManagedRole;
  actorId: string;
}) {
  const role = await getActiveRole(input.role);
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (transaction) => {
    const user = await transaction.usuario.create({
      data: {
        nome: input.nome.trim(),
        email: input.email.trim().toLowerCase(),
        passwordHash,
        status: StatusUsuario.ATIVO,
      },
    });
    await transaction.usuarioPerfil.create({ data: { usuarioId: user.id, perfilId: role.id } });
    await transaction.logAuditoria.create({
      data: {
        usuarioId: input.actorId,
        acao: 'USUARIO_CRIADO',
        entidade: 'USUARIO',
        entidadeId: user.id,
        valorNovo: { nome: input.nome.trim(), email: input.email.trim().toLowerCase(), role: input.role, status: StatusUsuario.ATIVO },
      },
    });
    const created = await transaction.usuario.findUniqueOrThrow({ where: { id: user.id }, select: safeUserSelect });
    return presentUser(created);
  });
}

export async function updateManagedUser(id: string, input: {
  nome: string;
  email: string;
  role: ManagedRole;
  status: StatusUsuario;
  password?: string;
  actorId: string;
}) {
  const role = await getActiveRole(input.role);
  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.usuario.findUnique({
      where: { id },
      include: { roles: { include: { perfil: { select: { code: true } } } } },
    });
    if (!existing) return null;
    const previousRole = existing.roles[0]?.perfil.code ?? null;

    const isActiveMaster = existing.status === StatusUsuario.ATIVO
      && existing.roles.some(({ perfil }) => perfil.code === RoleCode.MASTER_ADMIN);
    const willRemainActiveMaster = input.status === StatusUsuario.ATIVO && input.role === RoleCode.MASTER_ADMIN;
    if (isActiveMaster && !willRemainActiveMaster) {
      const activeMasters = await transaction.usuario.count({
        where: {
          status: StatusUsuario.ATIVO,
          roles: { some: { perfil: { is: { code: RoleCode.MASTER_ADMIN, active: true } } } },
        },
      });
      if (activeMasters <= 1) throw new Error('Não é possível desativar ou rebaixar o último MASTER ADMIN ativo.');
    }

    await transaction.usuario.update({
      where: { id },
      data: {
        nome: input.nome.trim(),
        email: input.email.trim().toLowerCase(),
        status: input.status,
        ...(passwordHash ? { passwordHash, passwordChangedAt: new Date() } : {}),
      },
    });
    await transaction.usuarioPerfil.deleteMany({ where: { usuarioId: id } });
    await transaction.usuarioPerfil.create({ data: { usuarioId: id, perfilId: role.id } });
    await transaction.logAuditoria.create({
      data: {
        usuarioId: input.actorId,
        acao: passwordHash ? 'USUARIO_E_CREDENCIAIS_ATUALIZADOS' : 'USUARIO_ATUALIZADO',
        entidade: 'USUARIO',
        entidadeId: id,
        valorAntigo: { nome: existing.nome, email: existing.email, role: previousRole, status: existing.status },
        valorNovo: {
          nome: input.nome.trim(),
          email: input.email.trim().toLowerCase(),
          role: input.role,
          status: input.status,
          senhaAlterada: Boolean(passwordHash),
        },
      },
    });

    const updated = await transaction.usuario.findUniqueOrThrow({ where: { id }, select: safeUserSelect });
    return presentUser(updated);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
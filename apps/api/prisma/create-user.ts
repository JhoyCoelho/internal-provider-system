import bcrypt from 'bcryptjs';
import { PermissionCode, PrismaClient, RoleCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.USER_EMAIL?.trim().toLowerCase();
  const nome = process.env.USER_NAME?.trim();
  const password = process.env.USER_PASSWORD;
  const roleCode = process.env.USER_ROLE as RoleCode | undefined;

  if (!email || !nome || !password || !roleCode) {
    throw new Error('Configure USER_EMAIL, USER_NAME, USER_PASSWORD e USER_ROLE no ambiente antes de executar.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('USER_EMAIL deve ser um e-mail válido.');
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('USER_PASSWORD deve ter entre 8 e 72 bytes.');
  }
  if (!Object.values(RoleCode).includes(roleCode)) throw new Error(`USER_ROLE inválido. Valores aceitos: ${Object.values(RoleCode).join(', ')}.`);
  if (await prisma.usuario.findUnique({ where: { email }, select: { id: true } })) {
    throw new Error('Já existe uma conta com esse e-mail; o comando não altera contas existentes.');
  }

  const role = await prisma.perfil.findUnique({ where: { code: roleCode }, select: { id: true, active: true } });
  if (!role?.active) throw new Error('O perfil solicitado não existe ou está desativado. Execute prisma:seed para provisionar perfis.');

  const permissions = await prisma.perfilPermissao.findMany({
    where: { perfilId: role.id },
    include: { permissao: { select: { code: true } } },
  });
  if (roleCode === RoleCode.TECNICO && !permissions.some(({ permissao }) => permissao.code === PermissionCode.ORDERS_STATUS_WRITE)) {
    throw new Error('O perfil técnico não possui a matriz de permissões esperada. Execute prisma:seed primeiro.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (transaction) => {
    const user = await transaction.usuario.create({ data: { email, nome, passwordHash, status: 'ATIVO' } });
    await transaction.usuarioPerfil.create({ data: { usuarioId: user.id, perfilId: role.id } });
  });

  console.log('Conta criada com sucesso. Remova USER_PASSWORD do ambiente temporário.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Falha ao criar a conta.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

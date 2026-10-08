import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, PermissionCode, RoleCode, TipoRespostaChecklist } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  { code: PermissionCode.USERS_READ, nome: 'Consultar usuários' },
  { code: PermissionCode.USERS_WRITE, nome: 'Gerenciar usuários' },
  { code: PermissionCode.REPORTS_READ, nome: 'Consultar relatórios' },
  { code: PermissionCode.AUDIT_READ, nome: 'Consultar auditoria' },
  { code: PermissionCode.ORDERS_READ, nome: 'Consultar ordens de remoção' },
  { code: PermissionCode.ORDERS_WRITE, nome: 'Gerenciar ordens de remoção' },
  { code: PermissionCode.ORDERS_STATUS_WRITE, nome: 'Atualizar status de remoção' },
  { code: PermissionCode.ORDERS_NOTE_WRITE, nome: 'Registrar observações de remoção' },
  { code: PermissionCode.CHECKLIST_READ, nome: 'Consultar checklists' },
  { code: PermissionCode.CHECKLIST_WRITE, nome: 'Preencher checklists' },
  { code: PermissionCode.CASH_READ, nome: 'Consultar caixa' },
  { code: PermissionCode.CASH_WRITE, nome: 'Movimentar caixa' },
  { code: PermissionCode.APPROVE_CLOSURE, nome: 'Aprovar fechamento de caixa' },
  { code: PermissionCode.APPROVE_LATE_CHECKLIST, nome: 'Aprovar checklist em atraso' },
];

const rolePermissions: Record<RoleCode, PermissionCode[]> = {
  [RoleCode.MASTER_ADMIN]: Object.values(PermissionCode),
  [RoleCode.ADMIN]: [
    PermissionCode.USERS_READ,
    PermissionCode.REPORTS_READ,
    PermissionCode.ORDERS_READ,
    PermissionCode.ORDERS_WRITE,
    PermissionCode.ORDERS_STATUS_WRITE,
    PermissionCode.ORDERS_NOTE_WRITE,
    PermissionCode.CASH_READ,
    PermissionCode.APPROVE_CLOSURE,
  ],
  [RoleCode.SUPERVISOR]: [
    PermissionCode.ORDERS_READ,
    PermissionCode.ORDERS_WRITE,
    PermissionCode.CASH_READ,
    PermissionCode.APPROVE_CLOSURE,
  ],
  [RoleCode.TECNICO]: [
    PermissionCode.ORDERS_READ,
    PermissionCode.ORDERS_STATUS_WRITE,
    PermissionCode.ORDERS_NOTE_WRITE,
    PermissionCode.REPORTS_READ,
    PermissionCode.CHECKLIST_READ,
    PermissionCode.CHECKLIST_WRITE,
  ],
  [RoleCode.FINANCEIRO]: [
    PermissionCode.CASH_READ,
    PermissionCode.CASH_WRITE,
    PermissionCode.APPROVE_CLOSURE,
  ],
  [RoleCode.OPERADOR_CAIXA]: [
    PermissionCode.CASH_READ,
    PermissionCode.CASH_WRITE,
  ],
  [RoleCode.COORDENADOR]: [
    PermissionCode.REPORTS_READ,
    PermissionCode.ORDERS_READ,
    PermissionCode.ORDERS_WRITE,
    PermissionCode.CASH_READ,
  ],
  [RoleCode.DIRETORIA]: [
    PermissionCode.REPORTS_READ,
    PermissionCode.CASH_READ,
    PermissionCode.APPROVE_CLOSURE,
  ],
  [RoleCode.COMERCIAL]: [
    PermissionCode.ORDERS_READ,
    PermissionCode.REPORTS_READ,
  ],
};

async function main() {
  const permissionRecords = new Map<PermissionCode, { id: string }>();

  for (const permission of permissions) {
    const record = await prisma.permissao.upsert({
      where: { code: permission.code },
      update: { nome: permission.nome },
      create: permission,
      select: { id: true },
    });
    permissionRecords.set(permission.code, record);
  }

  for (const [roleCode, rolePermissionCodes] of Object.entries(rolePermissions) as [RoleCode, PermissionCode[]][]) {
    const role = await prisma.perfil.upsert({
      where: { code: roleCode },
      update: {},
      create: {
        code: roleCode,
        nome: roleCode.replaceAll('_', ' '),
        active: true,
      },
      select: { id: true },
    });

    await prisma.perfilPermissao.deleteMany({ where: { perfilId: role.id } });
    await prisma.perfilPermissao.createMany({
      data: rolePermissionCodes.map((code) => ({ perfilId: role.id, permissaoId: permissionRecords.get(code)!.id })),
      skipDuplicates: true,
    });
  }

  const bootstrapEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (Boolean(bootstrapEmail) !== Boolean(bootstrapPassword)) {
    throw new Error('Configure INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD juntos para criar o administrador inicial.');
  }
  if (bootstrapEmail && bootstrapPassword) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bootstrapEmail)) throw new Error('INITIAL_ADMIN_EMAIL deve ser um e-mail válido.');
    if (bootstrapPassword.length < 16) throw new Error('INITIAL_ADMIN_PASSWORD deve conter pelo menos 16 caracteres.');
    if (Buffer.byteLength(bootstrapPassword, 'utf8') > 72) throw new Error('INITIAL_ADMIN_PASSWORD excede o limite de 72 bytes do bcrypt.');

    const adminRole = await prisma.perfil.findUniqueOrThrow({ where: { code: RoleCode.MASTER_ADMIN } });
    const passwordHash = await bcrypt.hash(bootstrapPassword, 12);
    const admin = await prisma.usuario.upsert({
      where: { email: bootstrapEmail },
      update: { passwordHash, status: 'ATIVO' },
      create: { email: bootstrapEmail, nome: 'Administrador do Sistema', passwordHash, status: 'ATIVO' },
    });
    await prisma.$transaction(async (transaction) => {
      await transaction.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
      await transaction.usuarioPerfil.create({ data: { usuarioId: admin.id, perfilId: adminRole.id } });
    });
    console.log('Administrador inicial configurado.');
  } else {
    console.log('Nenhum administrador foi criado. Configure as variáveis INITIAL_ADMIN_* para o bootstrap inicial.');
  }

  const templates = [
    { categoria: 'FERRAMENTAS', pergunta: 'Chave de fenda', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Chave Phillips', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Clivador', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Rotuladora', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Alicate de corte', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Bolsa de ferramentas', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Alicate decapador de fibra', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Decapador de drop', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Power meter', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Caneta VFL', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Lenços para limpeza de fibra', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Dispenser com álcool isopropílico', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Rolo de fita isolante', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'FERRAMENTAS', pergunta: 'Martelo', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'VEICULO', pergunta: 'Combustível suficiente', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'VEICULO', pergunta: 'Pneus em bom estado', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'VEICULO', pergunta: 'Documentação presente', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'VEICULO', pergunta: 'Veículo limpo e organizado', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'VEICULO', pergunta: 'Ferramentas armazenadas corretamente', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'VEICULO', pergunta: 'Escada presente e em boas condições', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'VEICULO', pergunta: 'Cadeado (para escada)', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'EPIS', pergunta: 'Capacete', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'EPIS', pergunta: 'Botina de segurança', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'EPIS', pergunta: 'Óculos de proteção', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'EPIS', pergunta: 'Luvas de proteção', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'EPIS', pergunta: 'Calça antichamas', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'EPIS', pergunta: 'Camisa antichamas', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'EPIS', pergunta: 'Cinto para trabalho em altura', tipoResposta: TipoRespostaChecklist.OK },
    { categoria: 'EPIS', pergunta: 'Talabarte', tipoResposta: TipoRespostaChecklist.OK },
  ];

  for (const template of templates) {
    const existingTemplate = await prisma.checklistTemplate.findFirst({
      where: { pergunta: template.pergunta },
      select: { id: true },
    });

    if (existingTemplate) {
      continue;
    } else {
      await prisma.checklistTemplate.create({ data: template });
    }
  }

  console.log('Papéis, permissões e templates configurados.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { JanelaChecklist, Prisma, RoleCode, StatusChecklist, StatusUsuario, TipoRespostaChecklist } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type ChecklistTemplateInput = {
  categoria?: string;
  pergunta: string;
  tipoResposta: TipoRespostaChecklist;
  obrigatoria?: boolean;
  itemCritico?: boolean;
  ativo?: boolean;
};

export type ChecklistAnswerInput = {
  templateId: string;
  respostaTipo: TipoRespostaChecklist;
  valorTexto?: string | null;
  valorBooleano?: boolean | null;
  itemCritico?: boolean;
};

const checklistCategories = ['FERRAMENTAS', 'VEICULO', 'EPIS'];
const checklistWindows = [
  { code: JanelaChecklist.INICIO_EXPEDIENTE, startMinute: 8 * 60, endMinute: 8 * 60 + 30 },
  { code: JanelaChecklist.FIM_EXPEDIENTE, startMinute: 17 * 60 + 45, endMinute: 18 * 60 + 30 },
];

function saoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, minuteOfDay: values.hour * 60 + values.minute, secondOfDay: values.hour * 3600 + values.minute * 60 + values.second };
}

function scheduledDate(year: number, month: number, day: number, minuteOfDay: number) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute));
}

async function ensureDailyChecklistSlots(usuarioId: string, now = new Date()) {
  const local = saoPauloDateParts(now);
  const today = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const lastSlot = await prisma.checklist.findFirst({
    where: { usuarioId, dataAgenda: { not: null } },
    orderBy: { dataAgenda: 'desc' },
    select: { dataAgenda: true },
  });
  const oldestBackfillDay = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  let date = lastSlot?.dataAgenda
    ? new Date(Math.max(lastSlot.dataAgenda.getTime(), oldestBackfillDay.getTime()))
    : today;

  while (date <= today) {
    const dataAgenda = new Date(date);
    const agendaLocalDate = { year: dataAgenda.getUTCFullYear(), month: dataAgenda.getUTCMonth() + 1, day: dataAgenda.getUTCDate() };
    for (const window of checklistWindows) {
      await prisma.checklist.createMany({
        data: checklistCategories.map((categoria) => ({
          usuarioId,
          categoria,
          janela: window.code,
          dataAgenda,
          dataPrevista: scheduledDate(agendaLocalDate.year, agendaLocalDate.month, agendaLocalDate.day, window.startMinute),
          dataPreenchimento: null,
          status: StatusChecklist.PENDENTE,
        })),
        skipDuplicates: true,
      });
    }
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  }
}

function isWindowOpen(janela: JanelaChecklist | null, dataAgenda: Date | null, now = new Date()) {
  if (!janela || !dataAgenda) return false;
  const local = saoPauloDateParts(now);
  const agendaDate = dataAgenda.toISOString().slice(0, 10);
  const today = new Date(Date.UTC(local.year, local.month - 1, local.day)).toISOString().slice(0, 10);
  if (agendaDate !== today) return false;
  const window = checklistWindows.find((candidate) => candidate.code === janela);
  return Boolean(window && local.secondOfDay >= window.startMinute * 60 && local.secondOfDay < window.endMinute * 60);
}

function isWindowPast(janela: JanelaChecklist | null, dataAgenda: Date | null, now = new Date()) {
  if (!janela || !dataAgenda) return false;
  const local = saoPauloDateParts(now);
  const agendaDate = dataAgenda.toISOString().slice(0, 10);
  const today = new Date(Date.UTC(local.year, local.month - 1, local.day)).toISOString().slice(0, 10);
  if (agendaDate < today) return true;
  if (agendaDate > today) return false;
  const window = checklistWindows.find((candidate) => candidate.code === janela);
  return Boolean(window && local.secondOfDay >= window.endMinute * 60);
}

export async function listChecklistTemplates() {
  return prisma.checklistTemplate.findMany({
    where: { ativo: true },
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function createChecklistTemplate(input: ChecklistTemplateInput) {
  return prisma.checklistTemplate.create({
    data: {
      categoria: input.categoria?.trim().toUpperCase() || 'GERAL',
      pergunta: input.pergunta.trim(),
      tipoResposta: input.tipoResposta,
      obrigatoria: input.obrigatoria ?? true,
      itemCritico: input.itemCritico ?? false,
      ativo: input.ativo ?? true,
    },
  });
}

export async function createChecklist(usuarioId: string, answers: ChecklistAnswerInput[], assinaturaData: string, checklistId: string, categoria?: string) {
  if (!checklistId) throw new Error('Selecione o checklist agendado que deseja preencher.');
  const pending = await prisma.checklist.findFirst({ where: { id: checklistId, usuarioId, excluidoEm: null, status: { in: [StatusChecklist.PENDENTE, StatusChecklist.EM_ATRASO] } } });
  if (!pending) throw new Error('Este checklist pendente não pertence ao usuário ou já foi preenchido. Atualize a tela e tente novamente.');
  if (pending.status === StatusChecklist.PENDENTE && !isWindowOpen(pending.janela, pending.dataAgenda)) {
    throw new Error('A janela de preenchimento encerrou. Envie a justificativa para preencher este checklist em atraso.');
  }
  if (categoria && pending.categoria !== categoria.trim().toUpperCase()) throw new Error('O tipo selecionado não corresponde ao checklist pendente.');

  await prisma.checklistResposta.deleteMany({ where: { checklistId } });
  return prisma.checklist.update({
      where: { id: checklistId },
      data: {
        status: StatusChecklist.PREENCHIDO,
        dataPreenchimento: new Date(),
        assinaturaData,
        respostas: { create: answers.map((answer) => ({ templateId: answer.templateId, respostaTipo: answer.respostaTipo, valorTexto: answer.valorTexto ?? null, valorBooleano: answer.valorBooleano ?? null, itemCritico: answer.itemCritico ?? false })) },
      },
      include: { respostas: true },
    });
}

export async function listPendingChecklistsByUser(usuarioId: string) {
  const now = new Date();
  await ensureDailyChecklistSlots(usuarioId, now);
  const local = saoPauloDateParts(now);
  const dataAgenda = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const rows = await prisma.checklist.findMany({
    where: {
      usuarioId,
      excluidoEm: null,
      dataAgenda: { lte: dataAgenda },
      status: { in: [StatusChecklist.PENDENTE, StatusChecklist.EM_ATRASO, StatusChecklist.PENDENTE_APROVACAO] },
    },
    select: { id: true, categoria: true, status: true, dataPrevista: true, dataAgenda: true, janela: true, justificativaAtraso: true },
    orderBy: { dataPrevista: 'asc' },
  });
  return rows.map((row) => {
    const canFillNow = row.status === StatusChecklist.EM_ATRASO || (row.status === StatusChecklist.PENDENTE && isWindowOpen(row.janela, row.dataAgenda, now));
    const requiresJustification = row.status === StatusChecklist.PENDENTE && isWindowPast(row.janela, row.dataAgenda, now);
    return { ...row, canFillNow, requiresJustification };
  });
}

export async function justifyLateChecklist(usuarioId: string, checklistId: string, motivo: string, descricao: string, assinaturaData: string) {
  const pending = await prisma.checklist.findFirst({ where: { id: checklistId, usuarioId, excluidoEm: null, status: { in: [StatusChecklist.PENDENTE, StatusChecklist.PENDENTE_APROVACAO] } } });
  if (!pending) throw new Error('Checklist pendente não encontrado para este usuário. Atualize a lista e selecione uma pendência sua.');
  if (pending.status === StatusChecklist.PENDENTE && isWindowOpen(pending.janela, pending.dataAgenda)) throw new Error('Este checklist ainda está dentro do horário normal de preenchimento.');
  if (pending.status === StatusChecklist.PENDENTE && !isWindowPast(pending.janela, pending.dataAgenda)) throw new Error('O horário deste checklist ainda não começou.');

  return prisma.checklist.update({
    where: { id: checklistId },
    data: { status: StatusChecklist.EM_ATRASO, justificativaAtraso: `${motivo}: ${descricao.trim()}`, assinaturaData },
    select: { id: true, categoria: true, status: true, dataPrevista: true },
  });
}

export async function createLateChecklist(usuarioId: string, answers: ChecklistAnswerInput[], justificativa: string, assinaturaData: string) {
  const checklist = await prisma.checklist.create({
    data: {
      usuarioId,
      dataPreenchimento: new Date(),
      status: StatusChecklist.PENDENTE_APROVACAO,
      justificativaAtraso: justificativa.trim(),
      assinaturaData,
      respostas: {
        create: answers.map((answer) => ({
          templateId: answer.templateId,
          respostaTipo: answer.respostaTipo,
          valorTexto: answer.valorTexto ?? null,
          valorBooleano: answer.valorBooleano ?? null,
          itemCritico: answer.itemCritico ?? false,
        })),
      },
    },
    include: {
      respostas: true,
    },
  });

  return checklist;
}

export async function listChecklistsByUser(usuarioId: string) {
  return prisma.checklist.findMany({
    where: { usuarioId, excluidoEm: null },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      respostas: {
        include: {
          template: true,
        },
      },
    },
  });
}

export async function approveChecklist(checklistId: string, aprovadorId: string) {
  const checklist = await prisma.checklist.findFirst({ where: { id: checklistId, excluidoEm: null } });

  if (!checklist) {
    throw new Error('Checklist não encontrado.');
  }

  return prisma.checklist.update({
    where: { id: checklistId },
    data: {
      status: StatusChecklist.APROVADO,
      aprovadoPorId: aprovadorId,
    },
  });
}

export async function rejectChecklist(checklistId: string, aprovadorId: string, motivo: string) {
  const checklist = await prisma.checklist.findFirst({ where: { id: checklistId, excluidoEm: null } });

  if (!checklist) {
    throw new Error('Checklist não encontrado.');
  }

  return prisma.checklist.update({
    where: { id: checklistId },
    data: {
      status: StatusChecklist.REPROVADO,
      aprovadoPorId: aprovadorId,
      justificativaAtraso: motivo,
    },
  });
}

export async function getChecklistHistory(usuarioId: string) {
  return prisma.checklist.findMany({
    where: { usuarioId, excluidoEm: null },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      categoria: true,
      janela: true,
      dataAgenda: true,
      dataPrevista: true,
      status: true,
      dataPreenchimento: true,
      justificativaAtraso: true,
      assinaturaData: true,
      createdAt: true,
      respostas: {
        select: {
          id: true,
          respostaTipo: true,
          valorTexto: true,
          valorBooleano: true,
          itemCritico: true,
          template: {
            select: {
              id: true,
              pergunta: true,
              tipoResposta: true,
              categoria: true,
            },
          },
        },
      },
    },
  });
}

export async function listChecklistReport(from?: Date, to?: Date) {
  const technicians = await prisma.usuario.findMany({
    where: { status: StatusUsuario.ATIVO, roles: { some: { perfil: { code: RoleCode.TECNICO } } } },
    select: { id: true },
  });
  await Promise.all(technicians.map(({ id }) => ensureDailyChecklistSlots(id)));

  const rows = await prisma.checklist.findMany({
    where: {
      excluidoEm: null,
      ...(from || to ? { dataAgenda: {
        not: null,
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      } } : {}),
    },
    orderBy: [{ dataAgenda: 'desc' }, { createdAt: 'desc' }],
    take: 2000,
    include: {
      usuario: { select: { id: true, nome: true, email: true } },
      respostas: {
        orderBy: { registradoEm: 'asc' },
        include: {
          template: { select: { id: true, pergunta: true, tipoResposta: true, categoria: true } },
        },
      },
    },
  });
  const now = new Date();
  return rows.map((row) => ({
    ...row,
    requiresJustification: row.status === StatusChecklist.PENDENTE && isWindowPast(row.janela, row.dataAgenda, now),
  }));
}

export async function listPendingChecklistForSupervisor() {
  return prisma.checklist.findMany({
    where: { status: StatusChecklist.PENDENTE_APROVACAO, excluidoEm: null },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
      respostas: {
        include: {
          template: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });
}

export async function getTemplateById(id: string) {
  return prisma.checklistTemplate.findUnique({ where: { id } });
}

export async function listChecklistTemplatesWithQuestions() {
  return prisma.checklistTemplate.findMany({
    orderBy: [{ createdAt: 'desc' }],
  });
}

export function buildChecklistValidationErrorTemplate(notifications: string[]) {
  return {
    message: 'Checklist com inconsistências.',
    errors: notifications,
  };
}

export type ChecklistAnswerPayload = Prisma.ChecklistRespostaUncheckedCreateInput;

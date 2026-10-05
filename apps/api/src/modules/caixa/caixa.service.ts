import { Prisma, StatusMovimentoCaixa } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export type OpenCashTurnInput = {
  operadorId: string;
  valorEsperado: number;
  turnoAbertoEm?: Date;
};

export type CloseCashTurnInput = {
  operadorId: string;
  valorEmMaos: number;
  justificativa?: string | null;
};

export async function openCashTurn(input: OpenCashTurnInput) {
  const activeShift = await prisma.movimentacaoCaixa.findFirst({
    where: {
      operadorId: input.operadorId,
      status: StatusMovimentoCaixa.ABERTO,
    },
  });

  if (activeShift) {
    throw new Error('Já existe um turno aberto para este operador.');
  }

  return prisma.movimentacaoCaixa.create({
    data: {
      operadorId: input.operadorId,
      valorEsperado: input.valorEsperado,
      valorEmMaos: 0,
      divergencia: 0,
      turnoAbertoEm: input.turnoAbertoEm ?? new Date(),
      status: StatusMovimentoCaixa.ABERTO,
    },
  });
}

export async function getOpenCashTurnByOperator(operadorId: string) {
  return prisma.movimentacaoCaixa.findFirst({
    where: {
      operadorId,
      status: StatusMovimentoCaixa.ABERTO,
    },
    orderBy: [{ turnoAbertoEm: 'desc' }],
  });
}

export async function closeCashTurn(input: CloseCashTurnInput) {
  const shift = await prisma.movimentacaoCaixa.findFirst({
    where: {
      operadorId: input.operadorId,
      status: StatusMovimentoCaixa.ABERTO,
    },
    orderBy: [{ turnoAbertoEm: 'desc' }],
  });

  if (!shift) {
    throw new Error('Não existe turno aberto para este operador.');
  }

  const divergencia = Number(shift.valorEsperado) - Number(input.valorEmMaos);

  const status = Math.abs(divergencia) > 5
    ? StatusMovimentoCaixa.PENDENTE_APROVACAO
    : StatusMovimentoCaixa.FECHADO;

  if (Math.abs(divergencia) > 5 && (!input.justificativa || input.justificativa.trim().length < 5)) {
    throw new Error('Justificativa obrigatória quando a divergência ultrapassar R$ 5,00.');
  }

  return prisma.movimentacaoCaixa.update({
    where: { id: shift.id },
    data: {
      valorEmMaos: input.valorEmMaos,
      divergencia,
      justificativa: input.justificativa ?? null,
      turnoFechadoEm: new Date(),
      status,
    },
  });
}

export async function listCashHistoryByOperator(operadorId: string) {
  return prisma.movimentacaoCaixa.findMany({
    where: { operadorId },
    orderBy: [{ turnoAbertoEm: 'desc' }],
  });
}

export async function approveCashClosure(turnoId: string, aprovadorId: string) {
  const turn = await prisma.movimentacaoCaixa.findUnique({ where: { id: turnoId } });

  if (!turn) {
    throw new Error('Movimentação de caixa não encontrada.');
  }

  return prisma.movimentacaoCaixa.update({
    where: { id: turnoId },
    data: {
      status: StatusMovimentoCaixa.FECHADO,
    },
  });
}

export async function getCashTurnById(turnoId: string) {
  return prisma.movimentacaoCaixa.findUnique({ where: { id: turnoId } });
}

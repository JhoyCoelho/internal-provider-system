import { StatusOrdemRemocao, StatusRotaRemocao } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type Coordinates = { latitude: number; longitude: number };
type RouteOrder = { id: string; localizacao: string; clienteNome: string; endereco: string; numero: string; bairro: string; pontoReferencia: string; status: StatusOrdemRemocao; tecnicoId: string | null };

const activeOrderStatuses = [StatusOrdemRemocao.ABERTO, StatusOrdemRemocao.FALHA_TENTATIVA];

function parseCoordinates(value: string): Coordinates {
  const parts = value.split(',').map(Number);
  if (parts.length !== 2 || !parts.every(Number.isFinite)) throw new Error('Origem inválida. Marque sua posição no mapa.');
  const [latitude, longitude] = parts;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error('Coordenadas de origem fora do intervalo válido.');
  return { latitude, longitude };
}

function orderCoordinates(order: RouteOrder): Coordinates {
  const coordinates = parseCoordinates(order.localizacao);
  return coordinates;
}

function distanceKm(first: Coordinates, second: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function routeDistance(origin: Coordinates, stops: RouteOrder[]) {
  let distance = 0;
  let previous = origin;
  for (const stop of stops) {
    const current = orderCoordinates(stop);
    distance += distanceKm(previous, current);
    previous = current;
  }
  return distance;
}

function optimizeStopOrder(origin: Coordinates, orders: RouteOrder[]) {
  const remaining = [...orders];
  const ordered: RouteOrder[] = [];
  let current = origin;

  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const distance = distanceKm(current, orderCoordinates(remaining[index]));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    const [next] = remaining.splice(nearestIndex, 1);
    ordered.push(next);
    current = orderCoordinates(next);
  }

  for (let pass = 0; pass < 20; pass += 1) {
    let improved = false;
    for (let start = 0; start < ordered.length - 1; start += 1) {
      for (let end = start + 1; end < ordered.length; end += 1) {
        const previous = start === 0 ? origin : orderCoordinates(ordered[start - 1]);
        const first = orderCoordinates(ordered[start]);
        const last = orderCoordinates(ordered[end]);
        const next = end + 1 < ordered.length ? orderCoordinates(ordered[end + 1]) : null;
        const currentDistance = distanceKm(previous, first) + (next ? distanceKm(last, next) : 0);
        const reversedDistance = distanceKm(previous, last) + (next ? distanceKm(first, next) : 0);
        if (reversedDistance + 0.001 < currentDistance) {
          ordered.splice(start, end - start + 1, ...ordered.slice(start, end + 1).reverse());
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  return ordered;
}

function routeInclude() {
  return {
    criadoPor: { select: { id: true, nome: true } },
    paradas: {
      orderBy: { sequencia: 'asc' as const },
      include: {
        ordem: {
          select: { id: true, clienteNome: true, endereco: true, numero: true, bairro: true, pontoReferencia: true, localizacao: true, status: true },
        },
      },
    },
  };
}

export async function createRemovalRoute(criadoPorId: string, orderIds: string[], originText: string) {
  const origin = parseCoordinates(originText);
  const uniqueIds = [...new Set(orderIds)];
  if (uniqueIds.length !== orderIds.length) throw new Error('A lista contém ordens duplicadas.');
  if (uniqueIds.length > 100) throw new Error('Uma rota pode conter no máximo 100 paradas.');

  return prisma.$transaction(async (transaction) => {
    const openRoute = await transaction.rotaRemocao.findFirst({
      where: { criadoPorId, status: StatusRotaRemocao.EM_ANDAMENTO, paradas: { some: { ordem: { status: StatusOrdemRemocao.ROTEIRIZADO } } } },
      select: { id: true },
    });
    if (openRoute) throw new Error('Você já tem uma rota em andamento. Conclua ou cancele essa rota antes de criar outra.');

    const orders = await transaction.ordemRemocao.findMany({
      where: { id: { in: uniqueIds }, status: { in: activeOrderStatuses } },
      select: { id: true, localizacao: true, clienteNome: true, endereco: true, numero: true, bairro: true, pontoReferencia: true, status: true, tecnicoId: true },
    });
    if (orders.length !== uniqueIds.length) throw new Error('Uma ou mais ordens não existem, já estão roteirizadas ou não estão disponíveis para uma nova rota. Atualize a fila.');

    const activeStops = await transaction.rotaRemocaoParada.findMany({
      where: { ordemId: { in: uniqueIds }, rota: { status: StatusRotaRemocao.EM_ANDAMENTO } },
      select: { ordemId: true },
    });
    if (activeStops.length) throw new Error('Uma ou mais ordens já estão em uma rota em andamento. Atualize a fila.');

    const ordered = optimizeStopOrder(origin, orders);
    const route = await transaction.rotaRemocao.create({
      data: {
        criadoPorId,
        origem: originText,
        distanciaKm: routeDistance(origin, ordered),
        paradas: { create: ordered.map((order, index) => ({ ordemId: order.id, sequencia: index + 1, statusAnterior: order.status, tecnicoAnteriorId: order.tecnicoId })) },
      },
      include: routeInclude(),
    });

    const updated = await transaction.ordemRemocao.updateMany({
      where: { id: { in: uniqueIds }, status: { in: activeOrderStatuses } },
      data: { status: StatusOrdemRemocao.ROTEIRIZADO, tecnicoId: criadoPorId },
    });
    if (updated.count !== uniqueIds.length) throw new Error('A fila mudou durante a criação da rota. Nenhuma alteração foi aplicada; atualize e tente novamente.');

    return transaction.rotaRemocao.findUniqueOrThrow({ where: { id: route.id }, include: routeInclude() });
  });
}

export async function getRemovalRoute(routeId: string, userId: string, canViewAll: boolean) {
  const route = await prisma.rotaRemocao.findUnique({ where: { id: routeId }, include: routeInclude() });
  if (!route) throw new Error('Rota não encontrada.');
  if (!canViewAll && route.criadoPorId !== userId) throw new Error('Você não tem acesso a esta rota.');
  if (route.status !== StatusRotaRemocao.EM_ANDAMENTO || !route.paradas.some((stop) => stop.ordem.status === StatusOrdemRemocao.ROTEIRIZADO)) {
    throw new Error('Esta rota não está mais ativa.');
  }
  return route;
}

export async function listRemovalRoutes(userId: string, canViewAll: boolean) {
  return prisma.rotaRemocao.findMany({
    where: {
      status: StatusRotaRemocao.EM_ANDAMENTO,
      paradas: { some: { ordem: { status: StatusOrdemRemocao.ROTEIRIZADO } } },
      ...(canViewAll ? {} : { criadoPorId: userId }),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: routeInclude(),
  });
}

export async function cancelRemovalRoute(routeId: string, cancelledById: string) {
  return prisma.$transaction(async (transaction) => {
    const route = await transaction.rotaRemocao.findUnique({
      where: { id: routeId },
      include: { paradas: { include: { ordem: { select: { id: true, status: true } } } } },
    });
    if (!route || route.status !== StatusRotaRemocao.EM_ANDAMENTO) throw new Error('Rota em andamento não encontrada.');

    for (const stop of route.paradas) {
      if (stop.ordem.status !== StatusOrdemRemocao.ROTEIRIZADO) continue;
      await transaction.ordemRemocao.update({
        where: { id: stop.ordemId },
        data: { status: stop.statusAnterior, tecnicoId: stop.tecnicoAnteriorId },
      });
    }

    return transaction.rotaRemocao.update({
      where: { id: routeId },
      data: { status: StatusRotaRemocao.CANCELADA, cancelledAt: new Date(), cancelledById },
      include: routeInclude(),
    });
  });
}

export async function closeRoutesForOrder(orderId: string) {
  const routes = await prisma.rotaRemocao.findMany({
    where: { status: StatusRotaRemocao.EM_ANDAMENTO, paradas: { some: { ordemId: orderId } } },
    select: { id: true },
  });
  for (const route of routes) {
    const unfinished = await prisma.rotaRemocaoParada.count({
      where: { rotaId: route.id, ordem: { status: StatusOrdemRemocao.ROTEIRIZADO } },
    });
    if (unfinished === 0) {
      await prisma.rotaRemocao.update({ where: { id: route.id }, data: { status: StatusRotaRemocao.CONCLUIDA, completedAt: new Date() } });
    }
  }
}

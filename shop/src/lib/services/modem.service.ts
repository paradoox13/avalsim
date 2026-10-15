import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../prisma';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { writeAudit } from '../audit';
import { normalizePersianText } from '../utils/persian';
import { isStaffActor, type Actor } from './phone.service';

/** کلید یکتای ضدتکرار: برای پلتفرم و هر نماینده جداگانه */
export function buildModemDedupeKey(
  owner: { type: 'PLATFORM' | 'RESELLER'; resellerId?: string | null },
  brand: string,
  model: string,
): string {
  const b = normalizePersianText(brand).toLowerCase().replace(/\s+/g, '-');
  const m = normalizePersianText(model).toLowerCase().replace(/\s+/g, '-');
  return owner.type === 'PLATFORM' ? `PLATFORM:${b}:${m}` : `R:${owner.resellerId}:${b}:${m}`;
}

export const VISIBLE_MODEM_FILTER: Prisma.ModemWhereInput = {
  isActive: true,
  deletedAt: null,
  stock: { gt: 0 },
  OR: [{ ownerType: 'PLATFORM' }, { reseller: { status: 'ACTIVE' } }],
};

export interface ModemFilter {
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  inStock?: boolean;
  sort: 'newest' | 'cheapest' | 'expensive' | 'popular';
  page: number;
  limit: number;
}

export async function listModems(
  filter: ModemFilter,
  options: { forStorefront?: boolean; extraWhere?: Prisma.ModemWhereInput } = {},
) {
  const AND: Prisma.ModemWhereInput[] = [];
  AND.push({ deletedAt: null });
  if (options.forStorefront) AND.push(VISIBLE_MODEM_FILTER);
  if (options.extraWhere) AND.push(options.extraWhere);

  if (filter.brands?.length) AND.push({ brand: { in: filter.brands } });
  if (filter.inStock) AND.push({ stock: { gt: 0 } });
  if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
    AND.push({
      price: {
        ...(filter.minPrice !== undefined ? { gte: BigInt(filter.minPrice) } : {}),
        ...(filter.maxPrice !== undefined ? { lte: BigInt(filter.maxPrice) } : {}),
      },
    });
  }
  if (filter.q) {
    AND.push({
      OR: [
        { title: { contains: filter.q } },
        { brand: { contains: filter.q } },
        { model: { contains: filter.q } },
        { sku: { contains: filter.q } },
      ],
    });
  }

  const orderBy: Prisma.ModemOrderByWithRelationInput[] =
    filter.sort === 'cheapest'
      ? [{ price: 'asc' }]
      : filter.sort === 'expensive'
        ? [{ price: 'desc' }]
        : filter.sort === 'popular'
          ? [{ views: 'desc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }];

  const where: Prisma.ModemWhereInput = { AND };
  const [items, total] = await Promise.all([
    prisma.modem.findMany({
      where,
      include: { operator: true },
      orderBy,
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    }),
    prisma.modem.count({ where }),
  ]);
  return { items, total, page: filter.page, limit: filter.limit };
}

export async function getModemById(id: string) {
  const modem = await prisma.modem.findUnique({ where: { id }, include: { operator: true } });
  if (!modem || modem.deletedAt) throw notFound('مودم یافت نشد');
  return modem;
}

export async function incrementModemViews(id: string): Promise<void> {
  await prisma.modem.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => undefined);
}

export interface ModemInput {
  brand: string;
  model: string;
  title: string;
  price: bigint;
  stock: number;
  description?: string;
  imageUrl?: string;
  warranty?: string;
  operatorId?: string;
  specs?: Record<string, string>;
}

function buildSku(
  owner: { type: 'PLATFORM' | 'RESELLER'; resellerId?: string | null },
  brand: string,
  model: string,
): string {
  const suffix = owner.type === 'RESELLER' ? `-R${(owner.resellerId ?? '').slice(-4).toUpperCase()}` : '';
  const clean = `${brand}-${model}`.replace(/[^\p{L}\p{N}]+/gu, '-').toUpperCase();
  return `MDM-${clean}${suffix}`.slice(0, 60);
}

export async function createModem(input: ModemInput, actor: Actor) {
  const owner = isStaffActor(actor)
    ? { type: 'PLATFORM' as const, resellerId: null }
    : { type: 'RESELLER' as const, resellerId: actor.resellerId ?? null };
  if (owner.type === 'RESELLER' && !owner.resellerId) {
    throw forbidden('پروفایل نمایندگی شما کامل نیست');
  }

  const dedupeKey = buildModemDedupeKey(owner, input.brand, input.model);
  const duplicate = await prisma.modem.findUnique({ where: { dedupeKey } });
  if (duplicate && !duplicate.deletedAt) {
    throw conflict('این مودم (برند + مدل) قبلاً ثبت شده است');
  }

  const data = {
    sku: buildSku(owner, input.brand, input.model),
    dedupeKey,
    brand: normalizePersianText(input.brand),
    model: normalizePersianText(input.model),
    title: normalizePersianText(input.title),
    price: input.price,
    stock: input.stock,
    description: input.description?.trim() || null,
    imageUrl: input.imageUrl || null,
    warranty: input.warranty || null,
    operatorId: input.operatorId || null,
    specs: (input.specs ?? undefined) as Prisma.InputJsonValue | undefined,
    ownerType: owner.type,
    resellerId: owner.resellerId,
    isActive: true,
  };

  const modem = duplicate?.deletedAt
    ? await prisma.modem.update({ where: { id: duplicate.id }, data: { ...data, deletedAt: null } })
    : await prisma.modem.create({ data });

  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'CREATE',
    entity: 'Modem',
    entityId: modem.id,
    after: { brand: modem.brand, model: modem.model, price: modem.price.toString() },
  });
  return modem;
}

async function assertModemOwnership(
  modem: { resellerId: string | null; ownerType: string },
  actor: Actor,
) {
  if (modem.ownerType === 'RESELLER' && modem.resellerId !== actor.resellerId && !isStaffActor(actor)) {
    throw forbidden('این مودم متعلق به شما نیست');
  }
}

export async function updateModem(
  id: string,
  input: Partial<ModemInput> & { isActive?: boolean },
  actor: Actor,
) {
  const modem = await prisma.modem.findUnique({ where: { id } });
  if (!modem || modem.deletedAt) throw notFound('مودم یافت نشد');
  await assertModemOwnership(modem, actor);
  if (input.stock !== undefined && input.stock < 0) throw badRequest('موجودی نمی‌تواند منفی باشد');

  const updated = await prisma.modem.update({
    where: { id },
    data: {
      ...(input.brand ? { brand: normalizePersianText(input.brand) } : {}),
      ...(input.model ? { model: normalizePersianText(input.model) } : {}),
      ...(input.title ? { title: normalizePersianText(input.title) } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      ...(input.warranty !== undefined ? { warranty: input.warranty || null } : {}),
      ...(input.operatorId !== undefined ? { operatorId: input.operatorId || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.brand || input.model
        ? {
            dedupeKey: buildModemDedupeKey(
              { type: modem.ownerType as 'PLATFORM' | 'RESELLER', resellerId: modem.resellerId },
              input.brand ?? modem.brand,
              input.model ?? modem.model,
            ),
          }
        : {}),
    },
  });

  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'UPDATE',
    entity: 'Modem',
    entityId: id,
    before: { price: modem.price.toString(), stock: modem.stock },
    after: { price: updated.price.toString(), stock: updated.stock },
  });
  return updated;
}

export async function softDeleteModem(id: string, actor: Actor) {
  const modem = await prisma.modem.findUnique({ where: { id } });
  if (!modem || modem.deletedAt) throw notFound('مودم یافت نشد');
  await assertModemOwnership(modem, actor);
  await prisma.modem.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'DELETE',
    entity: 'Modem',
    entityId: id,
    before: { brand: modem.brand, model: modem.model },
  });
}

/**
 * کاهش موجودی هنگام فروش.
 * شرط `stock >= quantity` تضمین می‌کند موجودی هرگز منفی نشود.
 */
export async function decreaseModemStock(tx: Tx, modemId: string, quantity: number): Promise<void> {
  const result = await tx.modem.updateMany({
    where: { id: modemId, deletedAt: null, isActive: true, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  if (result.count !== 1) throw conflict('موجودی مودم انتخابی کافی نیست');
  // با صفر شدن موجودی، از فروشگاه مخفی می‌شود
  await tx.modem.updateMany({ where: { id: modemId, stock: { lte: 0 } }, data: { isActive: false } });
}

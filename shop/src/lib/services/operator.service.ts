import { prisma } from '../prisma';
import { cacheDel, cached } from '../cache';

export interface OperatorWithTiers {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  slug: string;
  color: string;
  logoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  tiers: Array<{
    id: string;
    minQty: number;
    maxQty: number | null;
    unitPrice: bigint;
    description: string | null;
  }>;
}

/** لیست اپراتورها همراه با پله‌های قیمت کد فعال‌سازی (کش‌شده) */
export async function listOperatorsWithPrices(): Promise<OperatorWithTiers[]> {
  return cached('operators:with-prices', 120, async () => {
    const operators = await prisma.operator.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        activationPrices: {
          where: { isActive: true },
          orderBy: { minQty: 'asc' },
        },
      },
    });
    return operators.map((op) => ({
      id: op.id,
      code: op.code,
      name: op.name,
      nameEn: op.nameEn,
      slug: op.slug,
      color: op.color,
      logoUrl: op.logoUrl,
      isActive: op.isActive,
      sortOrder: op.sortOrder,
      tiers: op.activationPrices.map((p) => ({
        id: p.id,
        minQty: p.minQty,
        maxQty: p.maxQty,
        unitPrice: p.unitPrice,
        description: p.description,
      })),
    }));
  });
}

export async function invalidateOperatorCache(): Promise<void> {
  await cacheDel('operators:');
}

export function getUserFacingOperatorName(name: string): string {
  return name;
}

import { prisma, type Tx } from '../prisma';
import { badRequest, conflict, notFound } from '../errors';
import { secureToken } from '../utils/ids';
import { mulToman, sumToman, taxOf, type Toman } from '../utils/money';
import { getSettingNumber } from '../settings';
import { pickTier, type ActivationTier } from './activation.service';

export const CART_TTL_DAYS = 14;

export interface CartLine {
  id: string;
  productType: 'PHONE_NUMBER' | 'MODEM' | 'ACTIVATION_CODE';
  title: string;
  unitPrice: bigint;
  quantity: number;
  totalPrice: bigint;
  phoneNumberId: string | null;
  modemId: string | null;
  operatorId: string | null;
  meta: Record<string, unknown> | null;
  available: boolean;
  availableStock?: number;
  issue?: string;
}

export interface CartView {
  id: string;
  token: string;
  items: CartLine[];
  totals: {
    subtotal: bigint;
    discount: bigint;
    tax: bigint;
    total: bigint;
    itemCount: number;
    /** آیا سفارش شامل محصول نیازمند ارسال فیزیکی است؟ */
    requiresPhysicalDelivery: boolean;
  };
}

function expiryDate(): Date {
  return new Date(Date.now() + CART_TTL_DAYS * 86_400_000);
}

/** دریافت یا ساخت سبد خرید بر اساس توکن کوکی */
export async function ensureCart(token: string | undefined, userId?: string | null) {
  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token } });
    if (existing) {
      if (userId && existing.userId !== userId) {
        return prisma.cart.update({ where: { id: existing.id }, data: { userId } });
      }
      return existing;
    }
  }
  const newToken = token ?? secureToken(24);
  return prisma.cart.create({
    data: { token: newToken, userId: userId ?? null, expiresAt: expiryDate() },
  });
}

async function touchCart(cartId: string) {
  await prisma.cart.update({ where: { id: cartId }, data: { expiresAt: expiryDate() } });
}

/** افزودن شماره به سبد — با اعتبارسنجی موجود بودن */
export async function addPhoneToCart(cartId: string, phoneNumberId: string) {
  const phone = await prisma.phoneNumber.findUnique({
    where: { id: phoneNumberId },
    include: { operator: true },
  });
  if (!phone || phone.deletedAt) throw notFound('شماره یافت نشد');
  if (phone.status !== 'AVAILABLE') throw conflict('این شماره در حال حاضر قابل خرید نیست');

  const existing = await prisma.cartItem.findFirst({
    where: { cartId, productType: 'PHONE_NUMBER', phoneNumberId },
  });
  if (existing) return existing;

  const item = await prisma.cartItem.create({
    data: {
      cartId,
      productType: 'PHONE_NUMBER',
      phoneNumberId,
      unitPrice: phone.price,
      quantity: 1,
      title: `${phone.operator.name} ${phone.msisdn}`,
      meta: { msisdn: phone.msisdn, operator: phone.operator.name, rond: phone.isRond },
    },
  });
  await touchCart(cartId);
  return item;
}

export async function addModemToCart(cartId: string, modemId: string, quantity: number) {
  const modem = await prisma.modem.findUnique({ where: { id: modemId } });
  if (!modem || modem.deletedAt || !modem.isActive) throw notFound('مودم یافت نشد');
  if (quantity < 1) throw badRequest('تعداد نامعتبر است');
  if (modem.stock < quantity) throw conflict(`موجودی کافی نیست (موجودی فعلی: ${modem.stock})`);

  const existing = await prisma.cartItem.findFirst({
    where: { cartId, productType: 'MODEM', modemId },
  });
  if (existing) {
    const newQty = Math.min(existing.quantity + quantity, modem.stock);
    return prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } });
  }

  const item = await prisma.cartItem.create({
    data: {
      cartId,
      productType: 'MODEM',
      modemId,
      unitPrice: modem.price,
      quantity,
      title: modem.title,
      meta: { brand: modem.brand, model: modem.model },
    },
  });
  await touchCart(cartId);
  return item;
}

/** ثبت/به‌روزرسانی کد فعال‌سازی بر اساس اپراتور و تعداد */
export async function setActivationItem(cartId: string, operatorId: string, quantity: number) {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    include: { activationPrices: { where: { isActive: true } } },
  });
  if (!operator) throw notFound('اپراتور یافت نشد');
  if (quantity < 1) throw badRequest('تعداد نامعتبر است');

  const tiers: ActivationTier[] = operator.activationPrices.map((p) => ({
    minQty: p.minQty,
    maxQty: p.maxQty,
    unitPrice: p.unitPrice,
  }));
  const tier = pickTier(tiers, quantity);
  if (!tier) throw badRequest(`قیمتی برای ${operator.name} ثبت نشده است`);

  const existing = await prisma.cartItem.findFirst({
    where: { cartId, productType: 'ACTIVATION_CODE', operatorId },
  });
  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity, unitPrice: tier.unitPrice },
    });
  }

  const item = await prisma.cartItem.create({
    data: {
      cartId,
      productType: 'ACTIVATION_CODE',
      operatorId,
      unitPrice: tier.unitPrice,
      quantity,
      title: `کد فعال‌سازی ${operator.name}`,
      meta: { operator: operator.name },
    },
  });
  await touchCart(cartId);
  return item;
}

export async function updateCartItemQuantity(cartId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
  if (!item) throw notFound('آیتم سبد خرید یافت نشد');
  if (item.productType === 'PHONE_NUMBER') {
    throw badRequest('تعداد شماره قابل تغییر نیست');
  }
  if (quantity < 1) return removeCartItem(cartId, itemId);

  if (item.productType === 'MODEM' && item.modemId) {
    const modem = await prisma.modem.findUnique({ where: { id: item.modemId } });
    if (!modem || modem.stock < quantity) throw conflict('موجودی کافی نیست');
  }
  if (item.productType === 'ACTIVATION_CODE' && item.operatorId) {
    const tiers = await prisma.activationCodePrice.findMany({
      where: { operatorId: item.operatorId, isActive: true },
    });
    const tier = pickTier(
      tiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty, unitPrice: t.unitPrice })),
      quantity,
    );
    if (!tier) throw badRequest('قیمت برای این تعداد ثبت نشده است');
    return prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity, unitPrice: tier.unitPrice },
    });
  }
  return prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
}

export async function removeCartItem(cartId: string, itemId: string) {
  const result = await prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
  if (result.count === 0) throw notFound('آیتم سبد خرید یافت نشد');
  return { removed: true };
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
  return { cleared: true };
}

/** خلاصه‌ی سبد خرید همراه با اعتبارسنجی زنده‌ی قیمت و موجودی */
export async function getCartView(token: string | undefined, userId?: string | null): Promise<CartView> {
  const cart = await ensureCart(token, userId);
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: 'asc' },
  });

  const vatBasisPoints = await getSettingNumber('shop.vatBasisPoints');
  const lines: CartLine[] = [];
  let requiresPhysicalDelivery = false;

  for (const item of items) {
    let unitPrice = item.unitPrice;
    let available = true;
    let availableStock: number | undefined;
    let issue: string | undefined;

    if (item.productType === 'PHONE_NUMBER' && item.phoneNumberId) {
      const phone = await prisma.phoneNumber.findUnique({ where: { id: item.phoneNumberId } });
      if (!phone || phone.deletedAt || !['AVAILABLE', 'RESERVED'].includes(phone.status)) {
        available = false;
        issue = 'این شماره دیگر موجود نیست';
      } else {
        unitPrice = phone.price;
      }
    }

    if (item.productType === 'MODEM' && item.modemId) {
      const modem = await prisma.modem.findUnique({ where: { id: item.modemId } });
      if (!modem || modem.deletedAt || !modem.isActive) {
        available = false;
        issue = 'این مودم دیگر موجود نیست';
      } else {
        unitPrice = modem.price;
        availableStock = modem.stock;
        requiresPhysicalDelivery = true;
        if (modem.stock < item.quantity) {
          available = false;
          issue = `موجودی کافی نیست (موجودی فعلی: ${modem.stock})`;
        }
      }
    }

    if (item.productType === 'ACTIVATION_CODE') {
      requiresPhysicalDelivery = true;
      if (item.operatorId) {
        const tiers = await prisma.activationCodePrice.findMany({
          where: { operatorId: item.operatorId, isActive: true },
        });
        const tier = pickTier(
          tiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty, unitPrice: t.unitPrice })),
          item.quantity,
        );
        if (!tier) {
          available = false;
          issue = 'قیمت این محصول به‌روزرسانی شده است. لطفاً دوباره انتخاب کنید.';
        } else {
          unitPrice = tier.unitPrice;
        }
      }
    }

    lines.push({
      id: item.id,
      productType: item.productType,
      title: item.title,
      unitPrice,
      quantity: item.quantity,
      totalPrice: mulToman(unitPrice, item.quantity),
      phoneNumberId: item.phoneNumberId,
      modemId: item.modemId,
      operatorId: item.operatorId,
      meta: (item.meta as Record<string, unknown> | null) ?? null,
      available,
      availableStock,
      issue,
    });
  }

  const subtotal = sumToman(lines.filter((l) => l.available).map((l) => l.totalPrice));
  const tax = taxOf(subtotal, vatBasisPoints);
  const discount = 0n;

  return {
    id: cart.id,
    token: cart.token,
    items: lines,
    totals: {
      subtotal,
      discount,
      tax,
      total: subtotal - discount + tax,
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      requiresPhysicalDelivery,
    },
  };
}

/** پاک‌سازی سبدهای منقضی‌شده */
export async function purgeExpiredCarts(): Promise<number> {
  const result = await prisma.cart.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}

/** انتقال سبد مهمان به حساب کاربر پس از ورود */
export async function attachCartToUser(token: string, userId: string) {
  const cart = await prisma.cart.findUnique({ where: { token } });
  if (!cart) return null;
  return prisma.cart.update({ where: { id: cart.id }, data: { userId } });
}

export type { Toman };

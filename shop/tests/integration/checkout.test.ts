import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { reservePhoneNumbers, releaseExpiredReservations } from '@/lib/services/phone.service';
import { decreaseModemStock } from '@/lib/services/modem.service';
import { finalizePaidOrder } from '@/lib/services/order.service';
import { analyzeNumber } from '@/lib/utils/pattern';
import { extractMiddle, extractPrefix, extractSuffix } from '@/lib/filters/operator-detect';

/**
 * تست‌های یکپارچه با دیتابیس واقعی PostgreSQL.
 * اگر DATABASE_URL تنظیم نشده باشد، کل مجموعه رد می‌شود تا CI بدون دیتابیس هم سبز بماند.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

/** شماره‌های تست با پیش‌شماره‌ی مجاز تا با داده‌ی seed تضاد نداشته باشند */
const TEST_PHONES = ['09129999001', '09129999002', '09359999003', '09909999004', '09129999123'];

suite('یکپارچه: چرخه فروش و رزرو', () => {
  let operatorId = '';
  let resellerUserId = '';
  let resellerProfileId = '';
  let modemId = '';

  beforeAll(async () => {
    await prisma.phoneNumber.deleteMany({ where: { msisdn: { in: TEST_PHONES } } });

    const operator = await prisma.operator.findFirst({ where: { code: 'MCI' } });
    if (!operator) throw new Error('اپراتور MCI در دیتابیس نیست؛ ابتدا seed را اجرا کنید.');
    operatorId = operator.id;

    // نماینده‌ی تست
    const resellerUser = await prisma.user.upsert({
      where: { phone: '09129999000' },
      create: {
        fullName: 'نماینده تست',
        phone: '09129999000',
        username: `reseller-test-${Date.now()}`,
        passwordHash: 'x',
        roleKey: 'RESELLER',
      },
      update: {},
    });
    resellerUserId = resellerUser.id;

    const profile = await prisma.resellerProfile.upsert({
      where: { userId: resellerUser.id },
      create: {
        userId: resellerUser.id,
        code: `RSL-T${Date.now() % 100000}`,
        shopName: 'فروشگاه تست',
        phone: '09129999000',
        status: 'APPROVED',
        commissionRate: 1000, // ۱۰٪ برای محاسبه‌ی ساده
      },
      update: { commissionRate: 1000, status: 'APPROVED' },
    });
    resellerProfileId = profile.id;

    // مودم تست
    const modem = await prisma.modem.upsert({
      where: { dedupeKey: 'test:modem:integration' },
      create: {
        sku: 'MDM-TEST-INTEGRATION',
        dedupeKey: 'test:modem:integration',
        brand: 'TestBrand',
        model: 'IntegrationModel',
        title: 'مودم تست یکپارچه',
        price: 1_000_000n,
        stock: 3,
        ownerType: 'PLATFORM',
        isActive: true,
      },
      update: { stock: 3, isActive: true },
    });
    modemId = modem.id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { customerName: { startsWith: 'مشتری تست' } } });
    await prisma.phoneNumber.deleteMany({ where: { msisdn: { in: TEST_PHONES } } });
    await prisma.modem.deleteMany({ where: { dedupeKey: 'test:modem:integration' } });
    await prisma.cart.deleteMany({ where: { user: { phone: '09129999000' } } });
    await prisma.user.deleteMany({ where: { phone: '09129999000' } });
    await prisma.$disconnect();
  });

  async function createPhone(msisdn: string, price: bigint, forReseller = false) {
    const analysis = analyzeNumber(msisdn);
    return prisma.phoneNumber.create({
      data: {
        msisdn,
        operatorId,
        prefix: extractPrefix(msisdn),
        suffix: extractSuffix(msisdn),
        middle: extractMiddle(msisdn),
        length: msisdn.length,
        price,
        status: 'AVAILABLE',
        ownerType: forReseller ? 'RESELLER' : 'PLATFORM',
        resellerId: forReseller ? resellerUserId : null,
        isRond: analysis.isRond,
        isSequential: analysis.isSequential,
        isRepeated: analysis.isRepeated,
        isPalindrome: analysis.isPalindrome,
        rondScore: analysis.rondScore,
      },
    });
  }

  it('شماره‌ی تکراری در دیتابیس قابل ثبت نیست (کلید یکتا)', async () => {
    await createPhone(TEST_PHONES[0], 2_000_000n);
    await expect(createPhone(TEST_PHONES[0], 3_000_000n)).rejects.toThrow();
  });

  it('رزرو همزمان یک شماره فقط برای یک تراکنش موفق است', async () => {
    const phone = await createPhone(TEST_PHONES[1], 5_000_000n);

    const attempt = (token: string) =>
      prisma.$transaction(async (tx) => reservePhoneNumbers(tx, [phone.id], token, 15));

    const [first, second] = await Promise.all([attempt('order-a'), attempt('order-b')]);

    const successCount = [first, second].filter((r) => r.reserved.length === 1).length;
    expect(successCount).toBe(1);

    const saved = await prisma.phoneNumber.findUnique({ where: { id: phone.id } });
    expect(saved?.status).toBe('RESERVED');
    expect(['order-a', 'order-b']).toContain(saved?.reservedByToken);
  });

  it('رزروِ صاحب همان توکن دوباره تأیید می‌شود (تلاش دوباره‌ی کاربر)', async () => {
    const phone = await createPhone('09909999004', 4_000_000n);
    await prisma.$transaction((tx) => reservePhoneNumbers(tx, [phone.id], 'order-x', 15));
    const again = await prisma.$transaction((tx) => reservePhoneNumbers(tx, [phone.id], 'order-x', 15));
    expect(again.reserved).toHaveLength(1);
  });

  it('آزادسازی رزروهای منقضی‌شده شماره را به حالت موجود برمی‌گرداند', async () => {
    const phone = await createPhone('09359999003', 7_000_000n);
    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: {
        status: 'RESERVED',
        reservedAt: new Date(Date.now() - 3600_000),
        reservedUntil: new Date(Date.now() - 60_000),
        reservedByToken: 'expired-order',
      },
    });
    await releaseExpiredReservations();
    const released = await prisma.phoneNumber.findUnique({ where: { id: phone.id } });
    expect(released?.status).toBe('AVAILABLE');
    expect(released?.reservedByToken).toBeNull();
  });

  it('کاهش موجودی مودم از منفی‌شدن جلوگیری می‌کند', async () => {
    await expect(
      prisma.$transaction((tx) => decreaseModemStock(tx, modemId, 999)),
    ).rejects.toThrow();

    await prisma.$transaction((tx) => decreaseModemStock(tx, modemId, 2));
    const modem = await prisma.modem.findUnique({ where: { id: modemId } });
    expect(modem?.stock).toBe(1);
  });

  it('پرداخت موفق: شماره فروخته می‌شود، موجودی کم و کمیسیون نماینده واریز می‌گردد', async () => {
    const phone = await createPhone(TEST_PHONES[4], 10_000_000n, true); // متعلق به نماینده
    const analysisText = phone.msisdn;

    // سفارش در وضعیت رزروشده (شبیه‌سازی خروجی checkout)
    const order = await prisma.order.create({
      data: {
        orderNumber: `SH-TEST-${Date.now()}`,
        trackingCode: `TRK${Date.now().toString().slice(-7)}`,
        customerName: 'مشتری تست یکپارچه',
        customerPhone: '09129999000',
        status: 'PENDING_PAYMENT',
        subtotal: phone.price,
        total: phone.price,
        items: {
          create: [
            {
              productType: 'PHONE_NUMBER',
              title: `${analysisText}`,
              unitPrice: phone.price,
              quantity: 1,
              totalPrice: phone.price,
              phoneNumberId: phone.id,
              ownerType: 'RESELLER',
              resellerId: resellerUserId,
              commissionRate: 1000,
              commissionAmount: (phone.price * 1000n) / 10000n,
            },
          ],
        },
        payments: {
          create: {
            gateway: 'ZARINPAL',
            amount: phone.price,
            status: 'INITIATED',
            authority: `AUTH-TEST-${Date.now()}`,
          },
        },
      },
      include: { items: true, payments: true },
    });

    await prisma.$transaction((tx) => reservePhoneNumbers(tx, [phone.id], order.id, 15));
    const balanceBefore = (await prisma.resellerProfile.findUnique({ where: { id: resellerProfileId } }))!.balance;

    const result = await finalizePaidOrder(order.orderNumber, {
      gateway: 'ZARINPAL',
      authority: order.payments[0].authority!,
      refId: '99887766',
      cardPan: '6104-****-****-1234',
      raw: { code: 100 },
    });

    expect(result.alreadyProcessed).toBe(false);

    const soldPhone = await prisma.phoneNumber.findUnique({ where: { id: phone.id } });
    expect(soldPhone?.status).toBe('SOLD');
    expect(soldPhone?.soldOrderId).toBe(order.id);
    expect(soldPhone?.reservedByToken).toBeNull();

    const profile = await prisma.resellerProfile.findUnique({ where: { id: resellerProfileId } });
    // ۱۰٪ از ۱۰٫۰۰۰٫۰۰۰ = ۱٫۰۰۰٫۰۰۰ تومان کمیسیون
    expect(profile!.balance - balanceBefore).toBe(1_000_000n);
    expect(profile!.totalSales).toBeGreaterThanOrEqual(10_000_000n);

    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    expect(payment?.status).toBe('VERIFIED');
    expect(payment?.refId).toBe('99887766');

    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('PROCESSING'); // سفارش فقط شماره دارد → آماده‌سازی
    expect(updatedOrder?.paidAt).toBeTruthy();
  });

  it('تأیید دوباره‌ی همان پرداخت، فروش مجدد یا واریز مضاعف انجام نمی‌دهد (idempotent)', async () => {
    const order = await prisma.order.findFirst({
      where: { customerName: 'مشتری تست یکپارچه', status: 'PROCESSING' },
      include: { payments: true, items: true },
    });
    expect(order).toBeTruthy();

    const balanceBefore = (await prisma.resellerProfile.findUnique({ where: { id: resellerProfileId } }))!.balance;

    const result = await finalizePaidOrder(order!.orderNumber, {
      gateway: 'ZARINPAL',
      authority: order!.payments[0].authority!,
      refId: '99887766',
      raw: { code: 101 },
    });

    expect(result.alreadyProcessed).toBe(true);
    const profile = await prisma.resellerProfile.findUnique({ where: { id: resellerProfileId } });
    expect(profile!.balance).toBe(balanceBefore);
  });

  it('سفارش دارای کد فعال‌سازی در وضعیت «در انتظار ارسال فیزیکی» قرار می‌گیرد', async () => {
    const price = 2_500_000n;
    const order = await prisma.order.create({
      data: {
        orderNumber: `SH-TEST-ACT-${Date.now()}`,
        trackingCode: `ACT${Date.now().toString().slice(-7)}`,
        customerName: 'مشتری تست کد فعال‌سازی',
        customerPhone: '09129999000',
        status: 'PENDING_PAYMENT',
        subtotal: price * 2n,
        total: price * 2n,
        items: {
          create: [
            {
              productType: 'ACTIVATION_CODE',
              title: 'کد فعال‌سازی همراه اول',
              unitPrice: price,
              quantity: 2,
              totalPrice: price * 2n,
            },
          ],
        },
        payments: {
          create: {
            gateway: 'ZARINPAL',
            amount: price * 2n,
            status: 'INITIATED',
            authority: `AUTH-ACT-${Date.now()}`,
          },
        },
      },
      include: { payments: true },
    });

    const result = await finalizePaidOrder(order.orderNumber, {
      gateway: 'ZARINPAL',
      authority: order.payments[0].authority!,
      refId: '11223344',
      raw: { code: 100 },
    });

    expect(result.order.status).toBe('AWAITING_PHYSICAL_DELIVERY');

    await prisma.order.delete({ where: { id: order.id } });
  });
});

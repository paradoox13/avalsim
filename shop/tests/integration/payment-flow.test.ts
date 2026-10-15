import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSetting, getSettingString } from '@/lib/settings';
import { ensureCart, addPhoneToCart } from '@/lib/services/cart.service';
import { createOrderAndPayment } from '@/lib/services/order.service';
import { GET as paymentCallback } from '@/app/api/payment/callback/[gateway]/route';
import { analyzeNumber } from '@/lib/utils/pattern';
import { extractMiddle, extractPrefix, extractSuffix } from '@/lib/filters/operator-detect';

/**
 * تست یکپارچه‌ی چرخه‌ی کامل پرداخت از طریق route handler واقعی درگاه.
 *
 * ترافیک خروجی درگاه با fetch جعلی شبیه‌سازی می‌شود (شبکه‌ی خارجی در CI لازم نیست)،
 * اما تمام مسیرهای داخلی — ساخت سفارش، رزرو شماره، ثبت Payment، callback درگاه،
 * verify سرور‌به‌سرور و تسویه‌ی نهایی — روی دیتابیس واقعی PostgreSQL اجرا می‌شوند.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const TEST_MSISDN = '09129999111';
const TEST_CART_TOKEN = `test-cart-${Date.now()}`;

let operatorId = '';
let phoneId = '';
let cartId = '';
let authority = '';
let orderNumber = '';
let realFetch: typeof globalThis.fetch;
const fetchedUrls: string[] = [];

const nextAuthority = () => `AUTH-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

suite('یکپارچه: چرخه‌ی پرداخت از درگاه تا تسویه (route handler واقعی)', () => {
  let originalGateway = '';

  beforeAll(async () => {
    // --- درگاه فعال را برای تست روی آیدی‌پی (سندباکس) تنظیم می‌کنیم ---
    originalGateway = await getSettingString('payment.activeGateway');
    await setSetting('payment.activeGateway', 'IDPAY');
    await setSetting('payment.sandbox', 'true');
    await setSetting('payment.idpay.apiKey', 'test-api-key');

    // --- شبیه‌سازی شبکه‌ی درگاه ---
    realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      fetchedUrls.push(url);
      if (url.includes('/v1.1/payment/verify')) {
        return jsonResponse({
          status: 100,
          track_id: 998877,
          payment: { card_no: '610433******1234', hashed_card_no: 'hashed' },
          date: 1700000000,
        });
      }
      if (url.endsWith('/v1.1/payment')) {
        return jsonResponse({ id: nextAuthority(), link: 'https://idpay.ir/payment/test' });
      }
      return jsonResponse({}, 404);
    }) as typeof globalThis.fetch;

    // --- داده‌ی تست ---
    await prisma.phoneNumber.deleteMany({ where: { msisdn: TEST_MSISDN } });
    const operator = await prisma.operator.findFirst({ where: { code: 'MCI' } });
    if (!operator) throw new Error('اپراتور MCI در دیتابیس نیست؛ ابتدا seed را اجرا کنید.');
    operatorId = operator.id;

    const analysis = analyzeNumber(TEST_MSISDN);
    const phone = await prisma.phoneNumber.create({
      data: {
        msisdn: TEST_MSISDN,
        prefix: extractPrefix(TEST_MSISDN),
        suffix: extractSuffix(TEST_MSISDN),
        middle: extractMiddle(TEST_MSISDN),
        length: TEST_MSISDN.length,
        operatorId,
        price: 1500000n,
        status: 'AVAILABLE',
        isRond: analysis.isRond,
        isSequential: analysis.isSequential,
        isRepeated: analysis.isRepeated,
        isPalindrome: analysis.isPalindrome,
        rondScore: analysis.rondScore,
      },
      select: { id: true },
    });
    phoneId = phone.id;

    const cart = await ensureCart(TEST_CART_TOKEN, null);
    cartId = cart.id;
    await addPhoneToCart(cartId, phoneId);
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    await setSetting('payment.activeGateway', originalGateway || 'ZARINPAL');
    await prisma.order.deleteMany({ where: { customerName: 'خریدار تست' } });
    await prisma.phoneNumber.deleteMany({ where: { msisdn: TEST_MSISDN } });
    await prisma.cartItem.deleteMany({ where: { cartId } });
    await prisma.cart.deleteMany({ where: { id: cartId } });
    await prisma.$disconnect();
  });

  it('ثبت سفارش: سفارش معلق، شماره رزرو شده و پرداخت INITIATED ساخته می‌شود', async () => {
    const request = new Request('http://localhost/api/checkout', { method: 'POST' });
    const result = await createOrderAndPayment(
      { customerName: 'خریدار تست', customerPhone: '09121234567', province: 'تهران', city: 'تهران' },
      { cartToken: TEST_CART_TOKEN, userId: null, request },
    );

    expect(result.redirectUrl).toContain('idpay.ir');
    orderNumber = result.order.orderNumber;
    expect(orderNumber).toMatch(/^SH-\d{8}-\d{6}$/);

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.total).toBe(1500000n);

    const phone = await prisma.phoneNumber.findUniqueOrThrow({ where: { id: phoneId } });
    expect(phone.status).toBe('RESERVED');
    expect(phone.reservedByToken).toBe(order.id);

    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe('INITIATED');
    authority = payment.authority!;
    expect(authority).toBeTruthy();
  });

  it('بازگشت موفق از درگاه: verify سرور‌به‌سرور و تسویه‌ی نهایی انجام می‌شود', async () => {
    const request = new Request(
      `http://localhost/api/payment/callback/idpay?order=${orderNumber}&id=${authority}&status=100`,
      { method: 'GET' },
    );
    const response = await paymentCallback(request, { params: { gateway: 'idpay' } });

    expect(response.status).toBe(303);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('/payment/result');
    expect(location).toContain('status=success');

    // درگاه واقعی فراخوانی شده است (verify سرور‌به‌سرور)
    expect(fetchedUrls.some((u) => u.includes('/v1.1/payment/verify'))).toBe(true);

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    expect(['PAID', 'PROCESSING', 'AWAITING_PHYSICAL_DELIVERY']).toContain(order.status);
    expect(order.paidAt).not.toBeNull();

    const phone = await prisma.phoneNumber.findUniqueOrThrow({ where: { id: phoneId } });
    expect(phone.status).toBe('SOLD');
    expect(phone.soldOrderId).toBe(order.id);
    expect(phone.reservedByToken).toBeNull();

    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment.status).toBe('VERIFIED');
    expect(payment.refId).toBe('998877');
  });

  it('callback تکراری: فروش مجدد و واریز مضاعف انجام نمی‌شود (idempotent)', async () => {
    const before = await prisma.payment.count({ where: { authority } });
    const request = new Request(
      `http://localhost/api/payment/callback/idpay?order=${orderNumber}&id=${authority}&status=100`,
      { method: 'GET' },
    );
    const response = await paymentCallback(request, { params: { gateway: 'idpay' } });

    expect(response.status).toBe(303);
    expect(response.headers.get('location') ?? '').toContain('status=success');

    const after = await prisma.payment.count({ where: { authority } });
    expect(after).toBe(before);

    const soldPhones = await prisma.phoneNumber.count({ where: { soldOrderId: { not: null }, msisdn: TEST_MSISDN } });
    expect(soldPhones).toBe(1);
  });

  it('callback با شناسه‌ی ناشناس: به صفحه‌ی ناموفق هدایت می‌شود', async () => {
    const request = new Request(
      'http://localhost/api/payment/callback/idpay?order=SH-14030101-999999&id=UNKNOWN-AUTH&status=100',
      { method: 'GET' },
    );
    const response = await paymentCallback(request, { params: { gateway: 'idpay' } });
    expect(response.status).toBe(303);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('status=failed');
    expect(location).toContain('reason=payment_not_found');
  });

  it('callback برای درگاه غیرفعال رد می‌شود', async () => {
    const request = new Request('http://localhost/api/payment/callback/zarinpal?id=x&status=100', { method: 'GET' });
    const response = await paymentCallback(request, { params: { gateway: 'zarinpal' } });
    expect(response.status).toBe(303);
    expect(response.headers.get('location') ?? '').toContain('reason=inactive_gateway');
  });
});

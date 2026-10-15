import { ok, route } from '@/lib/api';
import { assertCronSecret } from '@/lib/cron';
import { releaseExpiredReservations } from '@/lib/services/phone.service';
import { cancelExpiredOrders } from '@/lib/services/order.service';
import { purgeExpiredCarts } from '@/lib/services/cart.service';

export const dynamic = 'force-dynamic';

/**
 * کارهای زمان‌بندی‌شده:
 * ۱) آزادسازی رزروهای منقضی‌شده‌ی شماره‌ها
 * ۲) لغو سفارش‌های پرداخت‌نشده‌ی منقضی
 * ۳) پاک‌سازی سبدهای خرید قدیمی
 *
 * فراخوانی: curl -H "x-cron-secret: $CRON_SECRET" https://shop.example.ir/api/cron/maintenance
 */
export const POST = route(async (request) => {
  assertCronSecret(request);
  const [reservations, orders, carts] = await Promise.all([
    releaseExpiredReservations(),
    cancelExpiredOrders(),
    purgeExpiredCarts(),
  ]);
  return ok({ releasedReservations: reservations, canceledOrders: orders, purgedCarts: carts });
});

export const GET = POST;

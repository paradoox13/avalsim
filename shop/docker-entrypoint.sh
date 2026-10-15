#!/bin/sh
set -e

echo "→ اجرای مایگریشن‌های دیتابیس..."
npx prisma migrate deploy

# seed فقط در اولین اجرا یا با متغیر RUN_SEED=true
if [ "$RUN_SEED" = "true" ]; then
  echo "→ اجرای seed اولیه..."
  npx tsx prisma/seed.ts || echo "هشدار: seed با خطا مواجه شد (احتمالاً قبلاً اجرا شده است)"
fi

echo "→ راه‌اندازی سرور..."
exec "$@"

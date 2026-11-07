#!/bin/sh
set -e

echo "→ اجرای مایگریشن‌های دیتابیس..."
npx prisma migrate deploy

# seed فقط در اولین اجرا یا با متغیر RUN_SEED=true
if [ "$RUN_SEED" = "true" ]; then
  if [ -f ./prisma/seed.cjs ]; then
    echo "→ اجرای seed اولیه..."
    node ./prisma/seed.cjs || echo "هشدار: seed با خطا مواجه شد (احتمالاً قبلاً اجرا شده است)"
  else
    echo "هشدار: prisma/seed.cjs در ایمیج نیست؛ seed اجرا نشد (ساخت ایمیج را بررسی کنید)."
  fi
fi

echo "→ راه‌اندازی سرور..."
exec "$@"

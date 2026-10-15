#!/bin/sh
# ---------------------------------------------------------------------------
#  پشتیبان‌گیری خودکار از دیتابیس PostgreSQL
#  در کانتینر backup به‌صورت روزانه توسط crond اجرا می‌شود.
#  بازیابی:  gunzip -c /backups/shop-YYYYMMDD-HHMM.sql.gz | psql -U shop -d shop
# ---------------------------------------------------------------------------
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
FILE="${BACKUP_DIR}/shop-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] شروع پشتیبان‌گیری → ${FILE}"
pg_dump --no-owner --no-privileges --clean --if-exists | gzip -9 > "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] پشتیبان ساخته شد (${SIZE})"

# حذف پشتیبان‌های قدیمی
find "$BACKUP_DIR" -name 'shop-*.sql.gz' -mtime "+${KEEP_DAYS}" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] پشتیبان‌های قدیمی‌تر از ${KEEP_DAYS} روز پاک شدند"

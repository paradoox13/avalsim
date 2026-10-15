'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { http } from '@/lib/client/api';
import { Save, Lock, Info } from 'lucide-react';

interface SettingRow {
  key: string;
  label: string;
  group: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'SECRET';
  value: string;
  isSet: boolean;
  description: string | null;
}

const GROUP_LABELS: Record<string, string> = {
  site: 'اطلاعات فروشگاه',
  shop: 'تنظیمات فروش',
  payment: 'درگاه پرداخت',
  sms: 'سرویس پیامک',
  security: 'امنیت',
  excel: 'اکسل',
  general: 'عمومی',
};

/** تنظیمات سیستم: درگاه پرداخت، پیامک، سایت و امنیت */
export default function AdminSettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await http.get<{ settings: SettingRow[] }>('/api/admin/settings');
      setRows(result.data.settings);
      const initial: Record<string, string> = {};
      for (const row of result.data.settings) initial[row.key] = row.type === 'SECRET' && row.isSet ? '' : row.value;
      setValues(initial);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت تنظیمات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      // فقط مقادیری که تغییر کرده‌اند ارسال می‌شوند؛ مقادیر SECRET خالی نادیده گرفته می‌شوند
      const changed: Record<string, string> = {};
      for (const row of rows) {
        const next = values[row.key] ?? '';
        if (row.type === 'SECRET' && next === '') continue;
        if (next !== (row.isSet ? (row.type === 'SECRET' ? '' : row.value) : row.value)) {
          changed[row.key] = next;
        }
      }
      if (!Object.keys(changed).length) {
        toast.info('تغییری برای ذخیره وجود ندارد');
        setSaving(false);
        return;
      }
      const result = await http.put<{ count: number }>('/api/admin/settings', { values: changed });
      toast.success(`${result.data.count} تنظیم ذخیره شد`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره تنظیمات ناموفق بود');
    } finally {
      setSaving(false);
    }
  }

  const grouped = rows.reduce<Record<string, SettingRow[]>>((acc, row) => {
    acc[row.group] = acc[row.group] ? [...acc[row.group], row] : [row];
    return acc;
  }, {});

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری تنظیمات…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">تنظیمات سیستم</h2>
          <p className="text-xs text-muted-foreground">
            مقادیر حساس (کلید درگاه و پیامک) رمزنگاری‌شده در دیتابیس نگهداری می‌شوند و هرگز در فرانت‌اند نمایش داده نمی‌شوند.
          </p>
        </div>
        <Button onClick={save} loading={saving}>
          <Save className="h-4 w-4" />
          ذخیره تغییرات
        </Button>
      </div>

      {Object.entries(grouped).map(([group, items]) => (
        <Card key={group} className="space-y-4 p-5">
          <h3 className="font-semibold">{GROUP_LABELS[group] ?? group}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((row) => (
              <div key={row.key} className="space-y-2">
                <Label className="flex items-center gap-2 text-xs">
                  {row.label}
                  {row.type === 'SECRET' ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
                  {row.isSet ? <Badge variant="success">تنظیم‌شده</Badge> : null}
                </Label>

                {row.type === 'BOOLEAN' ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={values[row.key] === 'true'}
                      onCheckedChange={(checked) =>
                        setValues((prev) => ({ ...prev, [row.key]: checked ? 'true' : 'false' }))
                      }
                      aria-label={row.label}
                    />
                    <span className="text-xs text-muted-foreground">
                      {values[row.key] === 'true' ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                ) : row.type === 'JSON' ? (
                  <Textarea
                    dir="ltr"
                    rows={4}
                    value={values[row.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [row.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    dir={row.type === 'NUMBER' || row.type === 'SECRET' ? 'ltr' : 'rtl'}
                    type={row.type === 'SECRET' ? 'password' : 'text'}
                    placeholder={row.type === 'SECRET' && row.isSet ? 'برای تغییر، مقدار جدید وارد کنید' : row.label}
                    value={values[row.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [row.key]: e.target.value }))}
                    autoComplete="off"
                  />
                )}

                {row.description ? (
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Info className="h-3 w-3" />
                    {row.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} size="lg">
          <Save className="h-4 w-4" />
          ذخیره تغییرات
        </Button>
      </div>
    </div>
  );
}

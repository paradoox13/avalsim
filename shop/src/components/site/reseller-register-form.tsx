'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { http } from '@/lib/client/api';
import { onlyDigits, toEnglishDigits } from '@/lib/utils/persian';
import { isValidIranianNationalId, isValidShaba } from '@/lib/validation/common';
import { checkPasswordStrength } from '@/lib/auth/password';
import { Store } from 'lucide-react';

/** فرم ثبت‌نام نماینده با اعتبارسنجی کد ملی، شبا و رمز عبور */
export function ResellerRegisterForm() {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    nationalId: '',
    shopName: '',
    province: '',
    city: '',
    address: '',
    postalCode: '',
    shaba: '',
    cardNumber: '',
    bankName: '',
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 3) next.fullName = 'نام کامل را وارد کنید';
    if (!/^09\d{9}$/.test(onlyDigits(form.phone))) next.phone = 'شماره موبایل معتبر وارد کنید';
    if (!isValidIranianNationalId(form.nationalId)) next.nationalId = 'کد ملی معتبر نیست';
    if (form.shopName.trim().length < 2) next.shopName = 'نام فروشگاه را وارد کنید';
    if (form.shaba && !isValidShaba(form.shaba)) next.shaba = 'شماره شبا معتبر نیست (IR + ۲۴ رقم)';
    if (!checkPasswordStrength(form.password).ok) {
      next.password = checkPasswordStrength(form.password).messages.join('، ');
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const result = await http.post<{ resellerCode?: string }>('/api/auth/reseller/register', {
        ...form,
        phone: onlyDigits(form.phone),
        nationalId: toEnglishDigits(form.nationalId),
        postalCode: form.postalCode ? onlyDigits(form.postalCode) : '',
        cardNumber: form.cardNumber ? onlyDigits(form.cardNumber) : '',
        shaba: form.shaba ? toEnglishDigits(form.shaba).toUpperCase() : '',
      });
      setDone(result.data.resellerCode ?? '');
      toast.success('ثبت‌نام نمایندگی ثبت شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت‌نام ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  if (done !== null) {
    return (
      <Card className="space-y-4 p-8 text-center">
        <Store className="mx-auto h-12 w-12 text-primary" aria-hidden />
        <h2 className="text-lg font-bold">درخواست نمایندگی شما ثبت شد</h2>
        <p className="text-sm text-muted-foreground">
          کد نمایندگی شما: <strong dir="ltr">{done || '—'}</strong>
          <br />
          پس از تأیید مدیر، می‌توانید از طریق صفحه‌ی ورود نمایندگان وارد شوید.
        </p>
        <Button asChild>
          <Link href="/reseller/login">ورود به پنل نمایندگان</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-6">
        <section className="space-y-4">
          <h2 className="font-semibold">اطلاعات هویتی</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label required>نام و نام خانوادگی</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName}</p> : null}
            </div>
            <div className="space-y-2">
              <Label required>شماره موبایل</Label>
              <Input
                dir="ltr"
                inputMode="tel"
                placeholder="09121234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
              {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
            </div>
            <div className="space-y-2">
              <Label required>کد ملی</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                maxLength={10}
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value.replace(/\D/g, '') })}
                required
              />
              {errors.nationalId ? <p className="text-xs text-destructive">{errors.nationalId}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>ایمیل</Label>
              <Input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-semibold">اطلاعات فروشگاه</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label required>نام فروشگاه</Label>
              <Input value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} required />
              {errors.shopName ? <p className="text-xs text-destructive">{errors.shopName}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>استان / شهر</Label>
              <div className="flex gap-2">
                <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="استان" />
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="شهر" />
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <Label>نشانی</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>کد پستی</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                maxLength={10}
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-semibold">اطلاعات تسویه</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>شماره شبا</Label>
              <Input
                dir="ltr"
                placeholder="IR000000000000000000000000"
                value={form.shaba}
                onChange={(e) => setForm({ ...form, shaba: e.target.value.toUpperCase() })}
              />
              {errors.shaba ? <p className="text-xs text-destructive">{errors.shaba}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>شماره کارت</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                maxLength={16}
                value={form.cardNumber}
                onChange={(e) => setForm({ ...form, cardNumber: e.target.value.replace(/\D/g, '') })}
              />
            </div>
            <div className="space-y-2">
              <Label>نام بانک</Label>
              <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-semibold">رمز عبور</h2>
          <div className="space-y-2">
            <Label required>رمز عبور</Label>
            <Input
              type="password"
              dir="ltr"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              required
            />
            {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}
            <p className="text-[11px] text-muted-foreground">
              رمز عبور باید حداقل ۸ کاراکتر و شامل حرف بزرگ، کوچک، عدد و کاراکتر ویژه باشد.
            </p>
          </div>
        </section>

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          ارسال درخواست نمایندگی
        </Button>
      </form>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { http } from '@/lib/client/api';
import { onlyDigits, toEnglishDigits } from '@/lib/utils/persian';
import { checkPasswordStrength } from '@/lib/auth/password';
import { UserPlus } from 'lucide-react';

/** فرم ثبت‌نام مشتری */
export function RegisterForm() {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '', nationalId: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const strength = checkPasswordStrength(form.password);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 3) next.fullName = 'نام و نام خانوادگی را کامل وارد کنید';
    if (!/^09\d{9}$/.test(onlyDigits(form.phone))) next.phone = 'شماره موبایل معتبر وارد کنید';
    if (!strength.ok) next.password = strength.messages.join('، ');
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await http.post('/api/auth/register', {
        fullName: form.fullName,
        phone: onlyDigits(form.phone),
        email: form.email || '',
        password: form.password,
        nationalId: form.nationalId ? toEnglishDigits(form.nationalId) : '',
      });
      toast.success('ثبت‌نام با موفقیت انجام شد');
      window.location.href = '/';
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت‌نام ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md space-y-6 p-7">
      <header className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient text-white">
          <UserPlus className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold">ساخت حساب کاربری</h1>
        <p className="text-sm text-muted-foreground">برای خرید سریع‌تر و پیگیری سفارش‌ها</p>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName" required>نام و نام خانوادگی</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
          {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" required>شماره موبایل</Label>
          <Input
            id="phone"
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
          <Label htmlFor="email">ایمیل (اختیاری)</Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nationalId">کد ملی (اختیاری)</Label>
          <Input
            id="nationalId"
            dir="ltr"
            inputMode="numeric"
            maxLength={10}
            value={form.nationalId}
            onChange={(e) => setForm({ ...form, nationalId: e.target.value.replace(/\D/g, '') })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" required>رمز عبور</Label>
          <Input
            id="password"
            type="password"
            dir="ltr"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
            required
          />
          {form.password ? (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(strength.score / 4) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {strength.ok ? 'رمز عبور مناسب است' : strength.messages[0]}
              </p>
            </div>
          ) : null}
          {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}
        </div>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          ثبت‌نام
        </Button>
      </form>

      <div className="space-y-2 text-center text-sm text-muted-foreground">
        <p>
          حساب دارید؟{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            وارد شوید
          </Link>
        </p>
        <p className="text-xs">
          می‌خواهید نماینده شوید؟{' '}
          <Link href="/reseller/register" className="font-medium text-primary hover:underline">
            ثبت‌نام نمایندگی
          </Link>
        </p>
      </div>
    </Card>
  );
}

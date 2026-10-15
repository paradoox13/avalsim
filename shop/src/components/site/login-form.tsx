'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { http } from '@/lib/client/api';
import { LogIn, KeyRound, ShieldCheck } from 'lucide-react';

interface LoginResponse {
  requiresTwoFactor: boolean;
  redirectTo?: string;
  user?: { fullName: string; roleKey: string };
}

/** فرم ورود مشترک برای مشتری، نماینده و مدیر (با پشتیبانی از ورود دو مرحله‌ای) */
export function LoginForm({
  portal,
  title,
  description,
  footer,
}: {
  portal: 'customer' | 'reseller' | 'admin';
  title: string;
  description?: string;
  footer?: React.ReactNode;
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (needsTwoFactor) {
        const result = await http.post<{ redirectTo: string }>('/api/auth/2fa', { code });
        toast.success('ورود موفق');
        window.location.href = result.data.redirectTo;
        return;
      }
      const result = await http.post<LoginResponse>('/api/auth/login', { identifier, password, portal });
      if (result.data.requiresTwoFactor) {
        setNeedsTwoFactor(true);
        toast.info('کد تأیید دو مرحله‌ای را وارد کنید');
        return;
      }
      toast.success(`خوش آمدید ${result.data.user?.fullName ?? ''}`);
      window.location.href = result.data.redirectTo ?? '/';
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ورود ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md space-y-6 p-7">
      <header className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient text-white">
          {needsTwoFactor ? <ShieldCheck className="h-6 w-6" /> : <LogIn className="h-6 w-6" />}
        </div>
        <h1 className="text-xl font-bold">{needsTwoFactor ? 'تأیید دو مرحله‌ای' : title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>

      <form onSubmit={submit} className="space-y-4">
        {needsTwoFactor ? (
          <div className="space-y-2">
            <Label htmlFor="code" required>کد ۶ رقمی برنامه Authenticator</Label>
            <Input
              id="code"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="identifier" required>
                {portal === 'customer' ? 'موبایل، ایمیل یا نام کاربری' : 'نام کاربری'}
              </Label>
              <Input
                id="identifier"
                dir="ltr"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" required>رمز عبور</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </>
        )}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {needsTwoFactor ? <KeyRound className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {needsTwoFactor ? 'تأیید و ورود' : 'ورود'}
        </Button>
      </form>

      {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}

      {portal === 'customer' ? (
        <div className="flex justify-between border-t pt-4 text-xs">
          <Link href="/reseller/login" className="text-primary hover:underline">
            ورود نمایندگان
          </Link>
          <Link href="/admin/login" className="text-primary hover:underline">
            ورود مدیران
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

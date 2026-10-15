'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { http } from '@/lib/client/api';
import { onlyDigits } from '@/lib/utils/persian';
import { Send } from 'lucide-react';

/** فرم تماس با ما با اعتبارسنجی سمت کلاینت */
export function ContactForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error('نام خود را وارد کنید');
      return;
    }
    if (!/^09\d{9}$/.test(onlyDigits(form.phone))) {
      toast.error('شماره موبایل معتبر وارد کنید');
      return;
    }
    if (form.message.trim().length < 10) {
      toast.error('متن پیام باید حداقل ۱۰ کاراکتر باشد');
      return;
    }

    setLoading(true);
    try {
      await http.post('/api/contact', { ...form, phone: onlyDigits(form.phone) });
      toast.success('پیام شما ارسال شد. به‌زودی پاسخ می‌دهیم.');
      setForm({ name: '', phone: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ارسال پیام ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name" required>نام و نام خانوادگی</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" required>شماره موبایل</Label>
            <Input
              id="phone"
              dir="ltr"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">موضوع</Label>
            <Input id="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="message" required>متن پیام</Label>
          <Textarea
            id="message"
            rows={6}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
          />
        </div>
        <Button type="submit" loading={loading}>
          <Send className="h-4 w-4" />
          ارسال پیام
        </Button>
      </form>
    </Card>
  );
}

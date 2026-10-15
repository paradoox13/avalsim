'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { http } from '@/lib/client/api';
import { Send, XCircle, Truck } from 'lucide-react';

const NEXT_STATUSES = [
  { value: 'PROCESSING', label: 'در حال آماده‌سازی' },
  { value: 'AWAITING_PHYSICAL_DELIVERY', label: 'در انتظار ارسال فیزیکی' },
  { value: 'SHIPPED', label: 'ارسال‌شده' },
  { value: 'DELIVERED', label: 'تحویل‌شده' },
  { value: 'REFUNDED', label: 'مرجوع‌شده' },
];

/** عملیات ادمین روی سفارش: تغییر وضعیت، ثبت مرسوله و لغو */
export function OrderActions({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(NEXT_STATUSES[0].value);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(
    action: 'status' | 'cancel',
    overrideStatus?: string,
  ) {
    setLoading(true);
    try {
      if (action === 'cancel') {
        await http.patch(`/api/admin/orders/${orderId}`, { action: 'cancel', note: note || 'لغو توسط مدیر' });
        toast.success('سفارش لغو شد');
      } else {
        await http.patch(`/api/admin/orders/${orderId}`, {
          action: 'status',
          status: overrideStatus ?? status,
          shippingCarrier: carrier || undefined,
          shippingTracking: tracking || undefined,
          note: note || undefined,
        });
        toast.success('وضعیت سفارش به‌روزرسانی شد');
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'عملیات ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold">عملیات</h3>
      <p className="text-xs text-muted-foreground">
        وضعیت فعلی: <strong>{currentStatus}</strong> — با تغییر وضعیت، پیامک اطلاع‌رسانی برای مشتری ارسال می‌شود.
      </p>

      <div className="space-y-2">
        <Label className="text-xs">وضعیت جدید</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {NEXT_STATUSES.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">شرکت حمل</Label>
          <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="پست پیشتاز" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">کد رهگیری پستی</Label>
          <Input dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">یادداشت</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => submit('status')} loading={loading}>
          <Send className="h-4 w-4" />
          ثبت و اطلاع‌رسانی
        </Button>
        <Button
          variant="outline"
          onClick={() => submit('status', 'SHIPPED')}
          disabled={loading || !tracking}
          title={!tracking ? 'برای ثبت مرسوله، کد رهگیری پستی لازم است' : undefined}
        >
          <Truck className="h-4 w-4" />
          ثبت مرسوله و ارسال
        </Button>
        <Button variant="destructive" onClick={() => submit('cancel')} disabled={loading}>
          <XCircle className="h-4 w-4" />
          لغو سفارش
        </Button>
      </div>
    </Card>
  );
}

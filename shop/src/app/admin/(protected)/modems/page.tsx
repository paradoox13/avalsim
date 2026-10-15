'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Money } from '@/components/site/money';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { http } from '@/lib/client/api';
import { toPersianDigits, onlyDigits } from '@/lib/utils/persian';
import { Plus, Trash2, Pencil } from 'lucide-react';

interface ModemRow {
  id: string;
  sku: string;
  brand: string;
  model: string;
  title: string;
  price: string;
  stock: number;
  isActive: boolean;
  ownerType: string;
  warranty: string | null;
  description: string | null;
}

const EMPTY = { brand: '', model: '', title: '', price: '', stock: '', warranty: '', description: '' };

export default function AdminModemsPage() {
  const [rows, setRows] = useState<ModemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ModemRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await http.get<ModemRow[]>(`/api/admin/modems?page=${page}&limit=30&inStock=false`);
      setRows(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت لیست');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      brand: form.brand,
      model: form.model,
      title: form.title,
      price: onlyDigits(form.price),
      stock: Number(onlyDigits(form.stock) || 0),
      warranty: form.warranty,
      description: form.description,
    };
    try {
      if (editing) await http.patch(`/api/admin/modems/${editing.id}`, payload);
      else await http.post('/api/admin/modems', payload);
      toast.success(editing ? 'ویرایش شد' : 'ثبت شد');
      setOpen(false);
      setEditing(null);
      setForm({ ...EMPTY });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره‌سازی ناموفق بود');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('این مودم حذف شود؟')) return;
    try {
      await http.delete(`/api/admin/modems/${id}`);
      toast.success('حذف شد');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'حذف ناموفق بود');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">مدیریت مودم‌ها</h2>
          <p className="text-xs text-muted-foreground">{toPersianDigits(total)} محصول</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm({ ...EMPTY });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          ثبت مودم
        </Button>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>محصول</TableHead>
              <TableHead>برند / مدل</TableHead>
              <TableHead>قیمت</TableHead>
              <TableHead>موجودی</TableHead>
              <TableHead>مالک</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[220px] truncate font-medium">{row.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.brand} / {row.model}</TableCell>
                  <TableCell><Money value={row.price} /></TableCell>
                  <TableCell>{toPersianDigits(row.stock)}</TableCell>
                  <TableCell className="text-xs">{row.ownerType === 'RESELLER' ? 'نماینده' : 'پلتفرم'}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive && row.stock > 0 ? 'success' : 'secondary'}>
                      {row.isActive && row.stock > 0 ? 'فعال' : 'غیرفعال'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="ویرایش"
                        onClick={() => {
                          setEditing(row);
                          setForm({
                            brand: row.brand,
                            model: row.model,
                            title: row.title,
                            price: row.price,
                            stock: String(row.stock),
                            warranty: row.warranty ?? '',
                            description: row.description ?? '',
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => remove(row.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">مودمی ثبت نشده است.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
        <span className="text-xs text-muted-foreground">صفحه {toPersianDigits(page)}</span>
        <Button variant="outline" size="sm" disabled={page * 30 >= total} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'ویرایش مودم' : 'ثبت مودم جدید'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label required>برند</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label required>مدل</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label required>عنوان محصول</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label required>قیمت (تومان)</Label>
                <Input dir="ltr" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label required>موجودی</Label>
                <Input dir="ltr" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>گارانتی</Label>
              <Input value={form.warranty} onChange={(e) => setForm({ ...form, warranty: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>توضیحات</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button type="submit" loading={saving} className="w-full">
              {editing ? 'ذخیره تغییرات' : 'ثبت مودم'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

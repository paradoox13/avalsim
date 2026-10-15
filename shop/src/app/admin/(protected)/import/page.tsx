'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/client/api';
import { toPersianDigits } from '@/lib/utils/persian';
import { Download, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, History } from 'lucide-react';

interface ImportResult {
  logId: string;
  total: number;
  created: number;
  skipped: number;
  failed: number;
  status: string;
  errors: Array<{ row: number; message: string }>;
  parseErrors: Array<{ row: number; message: string }>;
}

/** ایمپورت اکسل در سطح پلتفرم توسط ادمین */
export default function AdminImportPage() {
  const [type, setType] = useState<'PHONE_NUMBERS' | 'MODEMS'>('PHONE_NUMBERS');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      toast.error('ابتدا فایل اکسل را انتخاب کنید');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      const response = await apiFetch<ImportResult>(`/api/admin/import?type=${type}`, {
        method: 'POST',
        body: formData,
      });
      setResult(response.data);
      toast.success(`${toPersianDigits(response.data.created)} ردیف ثبت شد`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ایمپورت ناموفق بود');
      setResult(null);
    } finally {
      setUploading(false);
    }
  }

  const allErrors = [...(result?.parseErrors ?? []), ...(result?.errors ?? [])];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">ایمپورت گروهی از اکسل</h2>
          <p className="text-xs text-muted-foreground">افزودن گروهی شماره یا مودم به پلتفرم</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/import-logs">
            <History className="h-4 w-4" />
            تاریخچه ایمپورت‌ها
          </Link>
        </Button>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Label className="mb-1 block text-sm">نوع داده</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PHONE_NUMBERS">شماره سیم‌کارت</SelectItem>
                <SelectItem value="MODEMS">مودم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" asChild>
            <a href={`/api/admin/template?type=${type}`}>
              <Download className="h-4 w-4" />
              دانلود قالب اکسل
            </a>
          </Button>
        </div>

        <form onSubmit={upload} className="space-y-4">
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
          >
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="text-sm">{file ? file.name : 'فایل اکسل را اینجا رها کنید'}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              انتخاب فایل
            </Button>
          </div>
          <Button type="submit" loading={uploading} disabled={!file}>
            <Upload className="h-4 w-4" />
            شروع ایمپورت
          </Button>
        </form>
      </Card>

      {result ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            {result.status === 'COMPLETED' ? (
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" aria-hidden />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))]" aria-hidden />
            )}
            <h3 className="font-semibold">نتیجه</h3>
            <Badge variant={result.status === 'COMPLETED' ? 'success' : 'warning'}>
              {toPersianDigits(result.created)} از {toPersianDigits(result.total)} ردیف ثبت شد
            </Badge>
          </div>
          {allErrors.length ? (
            <div className="max-h-64 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">سطر</TableHead>
                    <TableHead>پیام</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allErrors.slice(0, 100).map((error, index) => (
                    <TableRow key={`${error.row}-${index}`}>
                      <TableCell>{toPersianDigits(error.row)}</TableCell>
                      <TableCell className="text-xs">{error.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

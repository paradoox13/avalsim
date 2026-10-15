import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { prisma } from '@/lib/prisma';

/**
 * پوسته‌ی صفحات محتوایی (درباره ما، قوانین، حریم خصوصی، سوالات متداول).
 * اگر محتوای فارسی در پنل مدیریت ثبت شده باشد، همان نمایش داده می‌شود؛
 * در غیر این صورت متن پیش‌فرض پروژه استفاده می‌شود.
 */
export async function ContentShell({
  slug,
  title,
  subtitle,
  children,
}: {
  slug: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const page = await prisma.contentPage
    .findUnique({ where: { slug } })
    .catch(() => null);

  const hasCustomContent = page?.isPublished && page.body;

  return (
    <div className="container max-w-4xl space-y-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{page?.title ?? title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>
      <Card className="p-6 leading-8">
        {hasCustomContent ? (
          <div className="whitespace-pre-line text-sm">{page.body}</div>
        ) : (
          <div className="space-y-4 text-sm">{children}</div>
        )}
      </Card>
    </div>
  );
}

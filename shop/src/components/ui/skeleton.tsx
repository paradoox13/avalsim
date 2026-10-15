import { cn } from '@/lib/utils/cn';

/** اسکلتون بارگذاری برای تجربه‌ی کاربری نرم */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

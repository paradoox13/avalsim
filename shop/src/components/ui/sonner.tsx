'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from 'next-themes';

/** اعلان‌های شناور راست‌چین */
export function Toaster() {
  const { theme } = useTheme();
  return (
    <SonnerToaster
      position="bottom-left"
      dir="rtl"
      theme={(theme as 'light' | 'dark' | 'system') ?? 'system'}
      richColors
      closeButton
      toastOptions={{
        className: 'font-sans text-sm',
      }}
    />
  );
}

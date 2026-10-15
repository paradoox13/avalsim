import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // کامپوننت‌های React از JSX بدون import استفاده می‌کنند (runtime خودکار)
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    testTimeout: 20000,
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** بررسی سلامت سرویس — برای Uptime Kuma و لودبالانسر */
export async function GET() {
  const started = Date.now();
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  const body = {
    ok: db,
    service: 'simshop',
    version: process.env.npm_package_version ?? '1.0.0',
    database: db ? 'up' : 'down',
    latencyMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: db ? 200 : 503 });
}

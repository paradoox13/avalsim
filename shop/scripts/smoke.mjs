/**
 * اسموک تست HTTP — قرارداد مسیرهای کلیدی را روی یک سرور واقعی بررسی می‌کند.
 *
 * چرا لازم است؟ تست‌های vitest لایه‌ی سرویس را پوشش می‌دهند، اما ریدایرکت‌های
 * میدل‌ور و layout ها فقط روی سرور اجراشده قابل مشاهده‌اند. همین اسکریپت باگ
 * «حلقه‌ی ریدایرکت صفحه‌ی ورود» را می‌گیرد.
 *
 * اجرا روی سرور محلی:
 *   npm run build && npx next start -p 3000 &
 *   npm run smoke
 *
 * اجرا روی هاست (پس از دیپلوی):
 *   BASE_URL=https://shop.example.ir ADMIN_PASSWORD='...' npm run smoke
 */
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile() {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n\r]*)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const fileEnv = loadEnvFile();
const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'superadmin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? fileEnv.SEED_ADMIN_PASSWORD ?? 'Admin@1403';
const RESELLER_USERNAME = process.env.RESELLER_USERNAME ?? 'reseller1';
// در seed، حساب نماینده‌ی نمونه همان رمز سوپر‌ادمین را دارد
const RESELLER_PASSWORD = process.env.RESELLER_PASSWORD ?? ADMIN_PASSWORD;

const ORIGIN = BASE_URL;
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(pathname, init = {}) {
  return fetch(`${BASE_URL}${pathname}`, {
    redirect: 'manual',
    ...init,
    headers: { Origin: ORIGIN, ...(init.headers ?? {}) },
  });
}

function setCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie();
  const one = response.headers.get('set-cookie');
  return one ? [one] : [];
}

function cookiesFrom(response, prefix) {
  return setCookies(response)
    .map((c) => c.split(';')[0])
    .filter((c) => c.startsWith(prefix))
    .join('; ');
}

/** CSRF + ورود + بازگرداندن کوکی آماده برای درخواست‌های بعدی */
async function login(identifier, password, portal) {
  const csrfRes = await request('/api/auth/csrf');
  const csrfJson = await csrfRes.json().catch(() => ({}));
  const csrfToken = csrfJson?.data?.csrfToken ?? csrfJson?.csrfToken;
  const csrfCookie = cookiesFrom(csrfRes, 'simshop_csrf');

  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken ?? '',
      Cookie: csrfCookie,
    },
    body: JSON.stringify({ identifier, password, portal }),
  });
  const body = await loginRes.json().catch(() => ({}));
  const sessionCookie = cookiesFrom(loginRes, 'simshop_session');

  return {
    ok: loginRes.status === 200 && Boolean(sessionCookie),
    status: loginRes.status,
    role: body?.data?.user?.roleKey ?? '-',
    csrfToken,
    cookie: [csrfCookie, sessionCookie].filter(Boolean).join('; '),
  };
}

async function main() {
  // ۱) سلامت سرویس و دیتابیس
  const health = await request('/api/health');
  const healthBody = await health.json().catch(() => ({}));
  record(
    'GET /api/health → 200 و دیتابیس up',
    health.status === 200 && healthBody.database === 'up',
    `status=${health.status} db=${healthBody.database}`,
  );

  // ۲) صفحه‌ی اصلی راست‌به‌چپ فارسی
  const home = await request('/');
  const homeHtml = await home.text();
  record(
    'GET / → 200 و RTL فارسی',
    home.status === 200 && /<html[^>]+dir="rtl"/.test(homeHtml),
    `status=${home.status} bytes=${homeHtml.length}`,
  );

  // ۳) صفحات عمومی باید بدون ورود باز شوند
  for (const p of ['/phones', '/modems', '/cart', '/checkout', '/track', '/faq']) {
    const res = await request(p);
    record(`GET ${p} → 200`, res.status === 200, `status=${res.status}`);
  }

  // ۴) صفحات ورود نباید ریدایرکت شوند (رگرسیون حلقه‌ی ریدایرکت)
  for (const p of ['/admin/login', '/reseller/login', '/reseller/register', '/login']) {
    const res = await request(p);
    record(
      `GET ${p} → 200 (بدون ریدایرکت)`,
      res.status === 200,
      `status=${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}`,
    );
  }

  // ۵) مسیرهای محافظت‌شده باید به صفحه‌ی ورود هدایت شوند
  for (const [p, loginPath] of [
    ['/admin', '/admin/login'],
    ['/reseller', '/reseller/login'],
  ]) {
    const res = await request(p);
    const location = res.headers.get('location') ?? '';
    record(
      `GET ${p} بدون ورود → 307 به ${loginPath}`,
      res.status === 307 && location.includes(loginPath),
      `status=${res.status} location=${location}`,
    );
  }

  // ۶) API محافظت‌شده بدون ورود
  const statsAnon = await request('/api/admin/stats');
  record('GET /api/admin/stats بدون ورود → 401', statsAnon.status === 401, `status=${statsAnon.status}`);

  // ۷) CSRF روی درخواست تغییردهنده بدون توکن
  const checkoutAnon = await request('/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  record(
    'POST /api/checkout بدون توکن CSRF → 403',
    checkoutAnon.status === 403,
    `status=${checkoutAnon.status}`,
  );

  // ۸) جریان کامل ورود مدیر (csrf → login → صفحات محافظت‌شده → خروج)
  const admin = await login(ADMIN_USERNAME, ADMIN_PASSWORD, 'admin');
  record(
    `ورود مدیر (${ADMIN_USERNAME}) → 200`,
    admin.ok,
    `status=${admin.status} role=${admin.role}`,
  );

  if (admin.cookie) {
    const adminPage = await request('/admin', { headers: { Cookie: admin.cookie } });
    const adminHtml = await adminPage.text();
    record(
      'GET /admin با نشست → 200 و رندر داشبورد',
      adminPage.status === 200 && adminHtml.includes('پنل مدیریت'),
      `status=${adminPage.status} bytes=${adminHtml.length}`,
    );

    const adminStats = await request('/api/admin/stats', { headers: { Cookie: admin.cookie } });
    record('GET /api/admin/stats با نشست → 200', adminStats.status === 200, `status=${adminStats.status}`);

    const resellerAsAdmin = await request('/reseller', { headers: { Cookie: admin.cookie } });
    record(
      'GET /reseller با نقش مدیر → هدایت به /',
      resellerAsAdmin.status === 307 && (resellerAsAdmin.headers.get('location') ?? '').endsWith('/'),
      `status=${resellerAsAdmin.status}`,
    );

    const logoutRes = await request('/api/auth/login', {
      method: 'DELETE',
      headers: { 'x-csrf-token': admin.csrfToken ?? '', Cookie: admin.cookie },
    });
    record('DELETE /api/auth/login (خروج) → 200', logoutRes.status === 200, `status=${logoutRes.status}`);

    // خروج = پاک‌کردن کوکی نشست (باطل‌سازی دسته‌جمعی توکن‌ها هنگام تغییر رمز انجام می‌شود)
    const cleared = setCookies(logoutRes).some(
      (c) => c.startsWith('simshop_session=') && /(max-age=0|expires=thu, 01 jan 1970)/i.test(c),
    );
    record('خروج کوکی نشست را پاک می‌کند', cleared, cleared ? 'max-age=0' : 'کوکی پاک نشد');

    const afterLogout = await request('/api/admin/stats');
    record(
      'پس از خروج (بدون کوکی)، /api/admin/stats → 401',
      afterLogout.status === 401,
      `status=${afterLogout.status}`,
    );
  } else {
    record('جریان ورود مدیر', false, 'نشست ساخته نشد؛ بررسی‌های وابسته رد شد');
  }

  // ۹) جریان کامل ورود نماینده — همان کلاس باگِ layout، مسیر موازی
  const reseller = await login(RESELLER_USERNAME, RESELLER_PASSWORD, 'reseller');
  record(
    `ورود نماینده (${RESELLER_USERNAME}) → 200`,
    reseller.ok,
    `status=${reseller.status} role=${reseller.role}`,
  );

  if (reseller.cookie) {
    const dash = await request('/reseller', { headers: { Cookie: reseller.cookie } });
    const dashHtml = await dash.text();
    record(
      'GET /reseller با نشست → 200 و رندر پنل نمایندگان',
      dash.status === 200 && dashHtml.includes('پنل نمایندگان'),
      `status=${dash.status} bytes=${dashHtml.length}`,
    );

    const stats = await request('/api/reseller/stats', { headers: { Cookie: reseller.cookie } });
    record('GET /api/reseller/stats با نشست → 200', stats.status === 200, `status=${stats.status}`);

    const adminAsReseller = await request('/admin', { headers: { Cookie: reseller.cookie } });
    record(
      'GET /admin با نقش نماینده → هدایت به /',
      adminAsReseller.status === 307 && (adminAsReseller.headers.get('location') ?? '').endsWith('/'),
      `status=${adminAsReseller.status}`,
    );
  } else {
    record('جریان ورود نماینده', false, 'نشست ساخته نشد؛ بررسی‌های وابسته رد شد');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} بررسی موفق روی ${BASE_URL}` +
      (failed.length ? `\nناموفق:\n${failed.map((f) => `  - ${f.name} (${f.detail})`).join('\n')}` : ''),
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('اسموک تست با خطا متوقف شد:', err);
  process.exit(1);
});

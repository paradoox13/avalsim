import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { OPERATOR_SEED } from '../src/lib/filters/operator-detect';
import { PERMISSION_CATALOG, DEFAULT_ROLE_PERMISSIONS, ROLE_KEYS } from '../src/lib/auth/rbac';
import { SETTING_DEFS } from '../src/lib/settings';
import { analyzeNumber } from '../src/lib/utils/pattern';
import { extractMiddle, extractPrefix, extractSuffix } from '../src/lib/filters/operator-detect';

const prisma = new PrismaClient();

const ROLE_LABELS: Record<string, { label: string; level: number; description: string }> = {
  CUSTOMER: { label: 'مشتری', level: 10, description: 'کاربر عادی فروشگاه' },
  RESELLER: { label: 'نماینده', level: 50, description: 'فروشنده محصولات در پنل اختصاصی' },
  ADMIN: { label: 'مدیر', level: 80, description: 'مدیریت فروشگاه و محصولات' },
  SUPER_ADMIN: { label: 'مدیر کل', level: 100, description: 'دسترسی کامل به همه بخش‌ها' },
};

async function seedPermissionsAndRoles() {
  console.log('→ نقش‌ها و دسترسی‌ها');
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: { key: permission.key, label: permission.label, group: permission.group },
      update: { label: permission.label, group: permission.group },
    });
  }

  for (const [key, meta] of Object.entries(ROLE_LABELS)) {
    const role = await prisma.role.upsert({
      where: { key },
      create: { key, label: meta.label, level: meta.level, description: meta.description, isSystem: true },
      update: { label: meta.label, level: meta.level, description: meta.description },
    });

    const permissions = DEFAULT_ROLE_PERMISSIONS[key as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
    for (const permissionKey of permissions) {
      const permission = await prisma.permission.findUnique({ where: { key: permissionKey } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }
}

async function seedOperators() {
  console.log('→ اپراتورها و پیش‌شماره‌ها');
  const operators = [...OPERATOR_SEED, {
    code: 'OTHER',
    name: 'سایر اپراتورها',
    nameEn: 'Other',
    slug: 'other',
    color: '#64748b',
    prefixes: [] as string[],
  }];

  for (const [index, operator] of operators.entries()) {
    const record = await prisma.operator.upsert({
      where: { code: operator.code },
      create: {
        code: operator.code,
        name: operator.name,
        nameEn: operator.nameEn,
        slug: operator.slug,
        color: operator.color,
        sortOrder: index,
        isActive: true,
      },
      update: { name: operator.name, nameEn: operator.nameEn, slug: operator.slug, color: operator.color },
    });

    for (const prefix of operator.prefixes) {
      await prisma.operatorPrefix.upsert({
        where: { prefix },
        create: { prefix, operatorId: record.id },
        update: { operatorId: record.id },
      });
    }
  }
}

/** قیمت پله‌ای نمونه برای کد فعال‌سازی */
async function seedActivationPrices() {
  console.log('→ قیمت کد فعال‌سازی');
  const tiers: Record<string, Array<{ minQty: number; maxQty: number | null; unitPrice: bigint }>> = {
    MCI: [
      { minQty: 1, maxQty: 9, unitPrice: 2_500_000n },
      { minQty: 10, maxQty: 49, unitPrice: 2_300_000n },
      { minQty: 50, maxQty: null, unitPrice: 2_100_000n },
    ],
    IRANCELL: [
      { minQty: 1, maxQty: 9, unitPrice: 2_200_000n },
      { minQty: 10, maxQty: 49, unitPrice: 2_050_000n },
      { minQty: 50, maxQty: null, unitPrice: 1_900_000n },
    ],
    RIGHTEL: [{ minQty: 1, maxQty: null, unitPrice: 3_100_000n }],
  };

  for (const [code, rows] of Object.entries(tiers)) {
    const operator = await prisma.operator.findUnique({ where: { code } });
    if (!operator) continue;
    for (const tier of rows) {
      await prisma.activationCodePrice.upsert({
        where: { operatorId_minQty: { operatorId: operator.id, minQty: tier.minQty } },
        create: {
          operatorId: operator.id,
          minQty: tier.minQty,
          maxQty: tier.maxQty,
          unitPrice: tier.unitPrice,
          isActive: true,
          description: 'قیمت پایه',
        },
        update: { maxQty: tier.maxQty, unitPrice: tier.unitPrice, isActive: true },
      });
    }
  }
}

async function seedSettings() {
  console.log('→ تنظیمات پیش‌فرض');
  for (const def of SETTING_DEFS) {
    await prisma.setting.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        value: def.value,
        type: def.type,
        group: def.group,
        label: def.label,
        description: def.description ?? null,
        isPublic: def.isPublic ?? false,
      },
      update: { label: def.label, group: def.group, type: def.type, isPublic: def.isPublic ?? false },
    });
  }
}

async function seedUsers() {
  console.log('→ کاربران نمونه');
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@1403';

  const roleMap = new Map(
    (await prisma.role.findMany()).map((role) => [role.key, role.id]),
  );

  const superAdmin = await prisma.user.upsert({
    where: { phone: '09120000001' },
    create: {
      fullName: 'مدیر کل سیستم',
      phone: '09120000001',
      username: 'superadmin',
      email: 'admin@shop.example.ir',
      passwordHash: await bcrypt.hash(password, 12),
      roleKey: ROLE_KEYS.SUPER_ADMIN,
      roleId: roleMap.get(ROLE_KEYS.SUPER_ADMIN) ?? null,
      status: 'ACTIVE',
    },
    update: { roleKey: ROLE_KEYS.SUPER_ADMIN, roleId: roleMap.get(ROLE_KEYS.SUPER_ADMIN) ?? null },
  });

  await prisma.user.upsert({
    where: { phone: '09120000002' },
    create: {
      fullName: 'مدیر فروشگاه',
      phone: '09120000002',
      username: 'admin',
      email: 'manager@shop.example.ir',
      passwordHash: await bcrypt.hash(password, 12),
      roleKey: ROLE_KEYS.ADMIN,
      roleId: roleMap.get(ROLE_KEYS.ADMIN) ?? null,
      status: 'ACTIVE',
    },
    update: { roleKey: ROLE_KEYS.ADMIN, roleId: roleMap.get(ROLE_KEYS.ADMIN) ?? null },
  });

  const resellerUser = await prisma.user.upsert({
    where: { phone: '09120000003' },
    create: {
      fullName: 'نماینده نمونه',
      phone: '09120000003',
      username: 'reseller1',
      passwordHash: await bcrypt.hash(password, 12),
      roleKey: ROLE_KEYS.RESELLER,
      roleId: roleMap.get(ROLE_KEYS.RESELLER) ?? null,
      status: 'ACTIVE',
    },
    update: {},
  });

  await prisma.resellerProfile.upsert({
    where: { userId: resellerUser.id },
    create: {
      userId: resellerUser.id,
      code: 'RSL-0001',
      shopName: 'فروشگاه نمونه',
      phone: '09120000003',
      province: 'تهران',
      city: 'تهران',
      status: 'APPROVED',
      commissionRate: 500,
      approvedById: superAdmin.id,
      approvedAt: new Date(),
      holderName: 'نماینده نمونه',
    },
    update: { status: 'APPROVED' },
  });

  await prisma.user.upsert({
    where: { phone: '09120000004' },
    create: {
      fullName: 'مشتری نمونه',
      phone: '09120000004',
      passwordHash: await bcrypt.hash(password, 12),
      roleKey: ROLE_KEYS.CUSTOMER,
      roleId: roleMap.get(ROLE_KEYS.CUSTOMER) ?? null,
      status: 'ACTIVE',
    },
    update: {},
  });

  console.log(`   ورود نمونه → نام کاربری: superadmin / رمز: ${password}`);
}

/** شماره‌های نمونه (سازگار با پیش‌شماره‌های واقعی) */
async function seedPhones() {
  console.log('→ شماره‌های نمونه');
  const existing = await prisma.phoneNumber.count();
  if (existing > 100) {
    console.log('   (شماره‌ها قبلاً ثبت شده‌اند — رد شد)');
    return;
  }

  const operators = await prisma.operator.findMany();
  const operatorByCode = new Map(operators.map((o) => [o.code, o.id]));

  const samples: Array<{ msisdn: string; price: bigint; code: string; description?: string }> = [
    { msisdn: '09121234567', price: 2_500_000n, code: 'MCI' },
    { msisdn: '09121234500', price: 3_200_000n, code: 'MCI' },
    { msisdn: '09122223333', price: 18_500_000n, code: 'MCI', description: 'سه رقم آخر یکسان' },
    { msisdn: '09121111111', price: 95_000_000n, code: 'MCI', description: 'شماره رند خاص' },
    { msisdn: '09123451234', price: 12_000_000n, code: 'MCI' },
    { msisdn: '09129998877', price: 4_100_000n, code: 'MCI' },
    { msisdn: '09301234567', price: 1_900_000n, code: 'IRANCELL' },
    { msisdn: '09352220000', price: 22_000_000n, code: 'IRANCELL', description: 'چهار رقم آخر یکسان' },
    { msisdn: '09364445555', price: 6_700_000n, code: 'IRANCELL' },
    { msisdn: '09376667788', price: 2_300_000n, code: 'IRANCELL' },
    { msisdn: '09201112233', price: 5_300_000n, code: 'RIGHTEL' },
    { msisdn: '09201234234', price: 8_900_000n, code: 'RIGHTEL', description: 'الگوی تکرارشونده' },
    { msisdn: '09901112233', price: 2_100_000n, code: 'MCI' },
    { msisdn: '09931234567', price: 1_750_000n, code: 'MCI' },
    { msisdn: '09981234567', price: 2_000_000n, code: 'SHATEL' },
    { msisdn: '09971234567', price: 2_050_000n, code: 'SAMANTEL' },
  ];

  for (const sample of samples) {
    const operatorId = operatorByCode.get(sample.code);
    if (!operatorId) continue;
    const analysis = analyzeNumber(sample.msisdn);
    const exists = await prisma.phoneNumber.findUnique({ where: { msisdn: sample.msisdn } });
    if (exists) continue;

    await prisma.phoneNumber.create({
      data: {
        msisdn: sample.msisdn,
        operatorId,
        prefix: extractPrefix(sample.msisdn),
        suffix: extractSuffix(sample.msisdn),
        middle: extractMiddle(sample.msisdn),
        length: sample.msisdn.length,
        price: sample.price,
        description: sample.description ?? null,
        ownerType: 'PLATFORM',
        isRond: analysis.isRond,
        isSequential: analysis.isSequential,
        isRepeated: analysis.isRepeated,
        isPalindrome: analysis.isPalindrome,
        rondScore: analysis.rondScore,
        views: Math.floor(Math.random() * 40),
      },
    });
  }
}

async function seedModems() {
  console.log('→ مودم‌های نمونه');
  const rows = [
    {
      brand: 'Huawei', model: 'B315s-22', title: 'مودم LTE هوآوی B315s-22',
      price: 3_200_000n, stock: 8, warranty: '۱۸ ماه شرکتی',
      description: 'مودم روتر ۴G با پشتیبانی از سیم‌کارت همه اپراتورها و وای‌فای دو باند.',
    },
    {
      brand: 'TP-Link', model: 'MR200', title: 'مودم TP-Link MR200',
      price: 2_450_000n, stock: 5, warranty: '۱۲ ماه',
      description: 'مودم ۴G همراه با پشتیبانی از کارت‌خوان و شبکه مهمان.',
    },
    {
      brand: 'ZTE', model: 'MF286R', title: 'مودم ZTE MF286R',
      price: 2_980_000n, stock: 3, warranty: '۶ ماه',
      description: 'مودم و روتر ۴G با باتری قابل حمل و درگاه شبکه.',
    },
    {
      brand: 'Huawei', model: 'E5573', title: 'مودم همراه هوآوی E5573',
      price: 1_850_000n, stock: 12, warranty: '۱۲ ماه',
      description: 'مودم همراه جیبی با باتری ۱۵۰۰ میلی‌آمپر و اتصال تا ۱۰ دستگاه.',
    },
  ];

  for (const row of rows) {
    const dedupeKey = `PLATFORM:${row.brand}:${row.model}`.toLowerCase();
    await prisma.modem.upsert({
      where: { dedupeKey },
      create: {
        sku: `MDM-${row.brand}-${row.model}`.toUpperCase(),
        dedupeKey,
        brand: row.brand,
        model: row.model,
        title: row.title,
        price: row.price,
        stock: row.stock,
        warranty: row.warranty,
        description: row.description,
        ownerType: 'PLATFORM',
        isActive: true,
        specs: { 'نوع اتصال': '4G LTE', 'تعداد پورت': '2' } as Prisma.InputJsonValue,
      },
      update: { price: row.price, stock: row.stock },
    });
  }
}

async function seedContentPages() {
  console.log('→ صفحات محتوایی');
  const pages = [
    {
      slug: 'about',
      title: 'درباره ما',
      kind: 'page',
      body: 'ما با هدف ساده‌کردن خرید شماره سیم‌کارت، مودم و کد فعال‌سازی در ایران فعالیت می‌کنیم.',
    },
    { slug: 'faq', title: 'سوالات متداول', kind: 'faq', body: 'پاسخ پرتکرارترین پرسش‌های کاربران در این صفحه قرار می‌گیرد.' },
    { slug: 'terms', title: 'قوانین و مقررات', kind: 'page', body: 'استفاده از این فروشگاه به معنی پذیرش قوانین جمهوری اسلامی ایران است.' },
    { slug: 'privacy', title: 'حریم خصوصی', kind: 'page', body: 'اطلاعات کاربران محرمانه است و در اختیار اشخاص ثالث قرار نمی‌گیرد.' },
  ];

  for (const page of pages) {
    await prisma.contentPage.upsert({
      where: { slug: page.slug },
      create: { slug: page.slug, title: page.title, body: page.body, kind: page.kind, isPublished: false },
      update: { title: page.title },
    });
  }
}

async function main() {
  console.log('🌱 شروع seed دیتابیس...\n');
  await seedPermissionsAndRoles();
  await seedOperators();
  await seedActivationPrices();
  await seedSettings();
  await seedUsers();
  await seedPhones();
  await seedModems();
  await seedContentPages();
  console.log('\n✅ seed با موفقیت انجام شد.');
}

main()
  .catch((error) => {
    console.error('❌ خطا در seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

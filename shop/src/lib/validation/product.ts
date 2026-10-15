import { z } from 'zod';
import { msisdnSchema, persianText, tomanSchema, booleanish } from './common';

export const phoneCreateSchema = z.object({
  msisdn: msisdnSchema,
  price: tomanSchema,
  description: persianText(500, 0).optional().or(z.literal('')),
  operatorId: z.string().cuid().optional(),
});

export const phoneUpdateSchema = z.object({
  price: tomanSchema.optional(),
  description: persianText(500, 0).optional().or(z.literal('')),
  status: z.enum(['AVAILABLE', 'INACTIVE']).optional(),
});

export const modemCreateSchema = z.object({
  brand: persianText(60),
  model: persianText(80),
  title: persianText(160),
  price: tomanSchema,
  stock: z.coerce.number().int().min(0).max(100000),
  description: persianText(2000, 0).optional().or(z.literal('')),
  imageUrl: z.string().url('آدرس تصویر معتبر نیست').optional().or(z.literal('')),
  warranty: persianText(80, 0).optional().or(z.literal('')),
  operatorId: z.string().cuid().optional().or(z.literal('')),
  specs: z.record(z.string(), z.string()).optional(),
});

export const modemUpdateSchema = modemCreateSchema.partial().extend({
  isActive: booleanish,
});

export const activationPriceSchema = z.object({
  operatorId: z.string().cuid(),
  unitPrice: tomanSchema,
  minQty: z.coerce.number().int().min(1).max(10000),
  maxQty: z.coerce.number().int().min(1).max(100000).nullable().optional(),
  isActive: booleanish,
  description: persianText(200, 0).optional().or(z.literal('')),
});

/** فیلترهای پیشرفته‌ی جستجوی شماره (صفحه‌ی اصلی) */
export const phoneFilterSchema = z.object({
  operators: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const list = Array.isArray(v) ? v : v.split(',');
      return list.map((s) => s.trim()).filter(Boolean);
    }),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  prefix: z.string().max(6).optional(),
  suffix: z.string().max(6).optional(),
  pattern: z.string().max(20).optional(),
  isRond: booleanish,
  isSequential: booleanish,
  isRepeated: booleanish,
  isPalindrome: booleanish,
  digits: z.coerce.number().int().min(8).max(11).optional(),
  repeatCount: z.coerce.number().int().min(2).max(11).optional(),
  q: z.string().max(64).optional(),
  sort: z.enum(['newest', 'cheapest', 'expensive', 'popular', 'rond']).catch('newest'),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(60).catch(24),
  onlyAvailable: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? true : v === true || v === 'true' || v === '1')),
  includeSold: booleanish,
  resellerId: z.string().cuid().optional(),
  view: z.enum(['grid', 'list']).catch('grid'),
});

export type PhoneFilterInput = z.infer<typeof phoneFilterSchema>;

export const modemFilterSchema = z.object({
  brands: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const list = Array.isArray(v) ? v : v.split(',');
      return list.map((s) => s.trim()).filter(Boolean);
    }),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  q: z.string().max(64).optional(),
  inStock: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? true : v === true || v === 'true' || v === '1')),
  sort: z.enum(['newest', 'cheapest', 'expensive', 'popular']).catch('newest'),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(60).catch(24),
});

export const activationQuoteSchema = z.object({
  items: z
    .array(
      z.object({
        operatorId: z.string().cuid(),
        quantity: z.coerce.number().int().min(1).max(1000),
      }),
    )
    .min(1, 'حداقل یک اپراتور را انتخاب کنید')
    .max(10),
});

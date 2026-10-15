import { z } from 'zod';
import { msisdnSchema, nationalIdSchema, persianText, shabaSchema } from './common';
import { checkPasswordStrength } from '../auth/password';

const strongPassword = z
  .string()
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
  .max(128, 'رمز عبور بیش از حد بلند است')
  .superRefine((value, ctx) => {
    const strength = checkPasswordStrength(value);
    if (!strength.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: strength.messages.join('، ') });
    }
  });

export const loginSchema = z.object({
  identifier: z.string().min(3, 'نام کاربری، ایمیل یا موبایل را وارد کنید').max(120),
  password: z.string().min(1, 'رمز عبور را وارد کنید').max(128),
  portal: z.enum(['customer', 'reseller', 'admin']).catch('customer'),
});

export const registerSchema = z.object({
  fullName: persianText(120, 3),
  phone: msisdnSchema,
  email: z.string().email('ایمیل معتبر نیست').optional().or(z.literal('')),
  password: strongPassword,
  nationalId: nationalIdSchema.optional().or(z.literal('')),
});

export const resellerRegisterSchema = z.object({
  fullName: persianText(120, 3),
  phone: msisdnSchema,
  email: z.string().email('ایمیل معتبر نیست').optional().or(z.literal('')),
  password: strongPassword,
  nationalId: nationalIdSchema,
  shopName: persianText(120, 2),
  province: persianText(60, 0).optional().or(z.literal('')),
  city: persianText(60, 0).optional().or(z.literal('')),
  address: persianText(400, 0).optional().or(z.literal('')),
  postalCode: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || /^\d{10}$/.test(v), { message: 'کد پستی باید ۱۰ رقم باشد' })
    .optional(),
  shaba: shabaSchema.optional().or(z.literal('')),
  cardNumber: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || /^\d{16}$/.test(v), { message: 'شماره کارت باید ۱۶ رقم باشد' })
    .optional(),
  bankName: persianText(60, 0).optional().or(z.literal('')),
});

export const checkoutSchema = z.object({
  customerName: persianText(120, 3),
  customerPhone: msisdnSchema,
  customerEmail: z.string().email('ایمیل معتبر نیست').optional().or(z.literal('')),
  nationalId: z.string().optional().or(z.literal('')),
  province: persianText(60, 0).optional().or(z.literal('')),
  city: persianText(60, 0).optional().or(z.literal('')),
  address: persianText(400, 0).optional().or(z.literal('')),
  postalCode: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v === '' || /^\d{10}$/.test(v), { message: 'کد پستی باید ۱۰ رقم باشد' })
    .optional(),
  note: persianText(500, 0).optional().or(z.literal('')),
});

export const twoFactorSchema = z.object({
  code: z.string().min(6, 'کد ۶ رقمی را وارد کنید').max(6),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPassword,
});

export const contactSchema = z.object({
  name: persianText(120, 2),
  phone: msisdnSchema,
  email: z.string().email().optional().or(z.literal('')),
  subject: persianText(160, 0).optional().or(z.literal('')),
  message: persianText(2000, 10),
});

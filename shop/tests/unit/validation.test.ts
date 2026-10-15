import { describe, expect, it } from 'vitest';
import { isValidIranianNationalId, isValidShaba, msisdnSchema, tomanSchema } from '@/lib/validation/common';
import { phoneCreateSchema } from '@/lib/validation/product';
import { checkoutSchema } from '@/lib/validation/auth';

describe('اعتبارسنجی کد ملی ایران', () => {
  it('کد ملی معتبر را می‌پذیرد', () => {
    // رقم کنترلی ۱ برای پایه ۰۹۳۰۱۲۳۴۵ محاسبه شده است
    expect(isValidIranianNationalId('0930123451')).toBe(true);
    expect(isValidIranianNationalId('۰۹۳۰۱۲۳۴۵۱')).toBe(true); // با ارقام فارسی
    expect(isValidIranianNationalId('1234567891')).toBe(true);
  });

  it('کد ملی نامعتبر را رد می‌کند', () => {
    expect(isValidIranianNationalId('0930123456')).toBe(false); // رقم کنترلی نادرست
    expect(isValidIranianNationalId('1111111111')).toBe(false); // ارقام تکراری
    expect(isValidIranianNationalId('12345')).toBe(false);
  });
});

describe('اعتبارسنجی شماره شبا', () => {
  it('شبا معتبر را می‌پذیرد', () => {
    expect(isValidShaba('IR820540102680020817909002')).toBe(true);
  });

  it('شبا نامعتبر را رد می‌کند', () => {
    expect(isValidShaba('IR000000000000000000000000')).toBe(false);
    expect(isValidShaba('IR123')).toBe(false);
  });
});

describe('اسکیمای شماره موبایل', () => {
  it('شماره را نرمال و تأیید می‌کند', () => {
    expect(msisdnSchema.parse('+98 912 123 4567')).toBe('09121234567');
    expect(msisdnSchema.parse('۰۹۱۲۱۲۳۴۵۶۷')).toBe('09121234567');
  });

  it('شماره نامعتبر را رد می‌کند', () => {
    expect(() => msisdnSchema.parse('12345')).toThrow();
  });
});

describe('اسکیمای مبلغ تومان', () => {
  it('رشته را به BigInt تبدیل می‌کند', () => {
    expect(tomanSchema.parse('۲٫۵۰۰٫۰۰۰')).toBe(2500000n);
  });

  it('مبلغ منفی را نمی‌پذیرد', () => {
    expect(() => tomanSchema.parse('-100')).toThrow();
    expect(() => tomanSchema.parse(-100)).toThrow();
    expect(() => tomanSchema.parse('−۵۰۰')).toThrow();
  });
});

describe('اسکیمای ثبت شماره', () => {
  it('ورودی معتبر را می‌پذیرد', () => {
    const parsed = phoneCreateSchema.parse({ msisdn: '09121234567', price: '2500000' });
    expect(parsed.msisdn).toBe('09121234567');
    expect(parsed.price).toBe(2500000n);
  });

  it('شماره نامعتبر را رد می‌کند', () => {
    expect(() => phoneCreateSchema.parse({ msisdn: '123', price: '1000' })).toThrow();
  });
});

describe('اسکیمای پرداخت', () => {
  it('اطلاعات خریدار را اعتبارسنجی می‌کند', () => {
    const parsed = checkoutSchema.parse({
      customerName: 'علی رضایی',
      customerPhone: '09121234567',
      postalCode: '1234567890',
    });
    expect(parsed.customerPhone).toBe('09121234567');
  });

  it('نام کوتاه و کد پستی نامعتبر را رد می‌کند', () => {
    expect(() => checkoutSchema.parse({ customerName: 'ا', customerPhone: '09121234567' })).toThrow();
    expect(() =>
      checkoutSchema.parse({
        customerName: 'علی رضایی',
        customerPhone: '09121234567',
        postalCode: '123',
      }),
    ).toThrow();
  });

  it('کاراکترهای خطرناک را از متن پاک می‌کند (دفاع XSS)', () => {
    const parsed = checkoutSchema.parse({
      customerName: '<script>alert(1)</script>علی',
      customerPhone: '09121234567',
    });
    expect(parsed.customerName).not.toContain('<');
    expect(parsed.customerName).not.toContain('>');
  });
});

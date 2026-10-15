import jalaali from 'jalaali-js';
import { toPersianDigits } from './persian';

const MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export interface JalaliParts {
  jy: number;
  jm: number;
  jd: number;
}

export function toJalali(date: Date): JalaliParts {
  const { jy, jm, jd } = jalaali.toJalaali(date);
  return { jy, jm, jd };
}

export function jalaliToDate(jy: number, jm: number, jd: number, hh = 0, mm = 0, ss = 0): Date {
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd, hh, mm, ss);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ۱۴۰۳/۰۸/۱۲ */
export function formatJalaliDate(date: Date | string | number, persian = true): string {
  const d = date instanceof Date ? date : new Date(date);
  const { jy, jm, jd } = toJalali(d);
  const text = `${jy}/${pad(jm)}/${pad(jd)}`;
  return persian ? toPersianDigits(text) : text;
}

/** ۱۴۰۳/۰۸/۱۲ - ۱۴:۳۰ */
export function formatJalaliDateTime(date: Date | string | number, persian = true): string {
  const d = date instanceof Date ? date : new Date(date);
  const text = `${formatJalaliDate(d, false)} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return persian ? toPersianDigits(text) : text;
}

/** ۱۲ آبان ۱۴۰۳ */
export function formatJalaliLong(date: Date | string | number, persian = true): string {
  const d = date instanceof Date ? date : new Date(date);
  const { jy, jm, jd } = toJalali(d);
  const text = `${jd} ${MONTHS[jm - 1]} ${jy}`;
  return persian ? toPersianDigits(text) : text;
}

export function jalaliMonthName(month: number): string {
  return MONTHS[month - 1] ?? '';
}

/**
 * کلید دوره‌ی مالی به شکل 140308 (سال و ماه شمسی) — برای شماره‌گذاری سفارش
 */
export function jalaliPeriodKey(date: Date = new Date()): string {
  const { jy, jm } = toJalali(date);
  return `${jy}${pad(jm)}`;
}

/** تاریخ شروع/پایان روز به وقت تهران */
export function startOfJalaliDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfJalaliDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export { jalaali };

/**
 * اعلان تایپ برای jalaali-js (این پکیج فایل تایپ همراه ندارد).
 */
declare module 'jalaali-js' {
  export interface JalaliDate {
    jy: number;
    jm: number;
    jd: number;
  }
  export interface GregorianDate {
    gy: number;
    gm: number;
    gd: number;
  }
  export function toJalaali(gy: number, gm: number, gd: number): JalaliDate;
  export function toJalaali(date: Date): JalaliDate;
  export function toGregorian(jy: number, jm: number, jd: number): GregorianDate;
  export function isValidJalaaliDate(jy: number, jm: number, jd: number): boolean;
  export function isLeapJalaaliYear(jy: number): boolean;
  export function jalaaliMonthLength(jy: number, jm: number): number;
  export function jalCal(jy: number): unknown;
  export function j2d(jy: number, jm: number, jd: number): number;
  export function d2j(jdn: number): JalaliDate;
  export function g2d(gy: number, gm: number, gd: number): number;
  export function d2g(jdn: number): GregorianDate;
  const jalaali: {
    toJalaali: typeof toJalaali;
    toGregorian: typeof toGregorian;
    isValidJalaaliDate: typeof isValidJalaaliDate;
    isLeapJalaaliYear: typeof isLeapJalaaliYear;
    jalaaliMonthLength: typeof jalaaliMonthLength;
    jalCal: typeof jalCal;
    j2d: typeof j2d;
    d2j: typeof d2j;
    g2d: typeof g2d;
    d2g: typeof d2g;
  };
  export default jalaali;
}

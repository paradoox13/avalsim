/**
 * تحلیل «زیبایی» شماره موبایل + ساخت الگوی جستجو.
 * این ماژول کاملاً خالص (pure) است تا به‌سادگی تست شود.
 */

export interface NumberAnalysis {
  /** رند: شماره‌ای با الگوهای ارزشمند بازار */
  isRond: boolean;
  /** متوالی: حداقل ۳ رقم پشت‌سرهم صعودی یا نزولی */
  isSequential: boolean;
  /** تکراری: حداقل ۴ بار تکرار یک رقم، یا بلوک تکرارشونده در انتها */
  isRepeated: boolean;
  /** آینه: کل شماره یا ۷ رقم آخر پالیندروم باشد */
  isPalindrome: boolean;
  /** امتیاز زیبایی ۰..۱۰۰ */
  rondScore: number;
  /** بیشترین تعداد تکرار یک رقم یکسان */
  maxRepeat: number;
  /** طولانی‌ترین دنباله‌ی متوالی (صعودی/نزولی) */
  longestSequence: number;
  /** برچسب‌های فارسی برای نمایش در UI */
  tags: string[];
}

const DEFAULT_ROND_THRESHOLD = 40;

function digitRuns(msisdn: string): { digit: string; count: number }[] {
  const runs: { digit: string; count: number }[] = [];
  for (const ch of msisdn) {
    const last = runs[runs.length - 1];
    if (last && last.digit === ch) last.count += 1;
    else runs.push({ digit: ch, count: 1 });
  }
  return runs;
}

function longestSequenceLength(msisdn: string): number {
  let best = 1;
  let asc = 1;
  let desc = 1;
  for (let i = 1; i < msisdn.length; i += 1) {
    const prev = Number(msisdn[i - 1]);
    const cur = Number(msisdn[i]);
    asc = cur === prev + 1 ? asc + 1 : 1;
    desc = cur === prev - 1 ? desc + 1 : 1;
    best = Math.max(best, asc, desc);
  }
  return best;
}

function isFullPalindrome(msisdn: string): boolean {
  return msisdn === [...msisdn].reverse().join('');
}

/** آینه‌ی ۷ رقمی آخر: 0912 345 6543 → «3456543» */
function isMirrorTail(msisdn: string): boolean {
  const tail = msisdn.slice(-7);
  if (tail.length < 7) return false;
  return tail === [...tail].reverse().join('');
}

/** بلوک تکرارشونده در انتهای شماره: «...3434» یا «...123123» */
function hasRepeatingTail(msisdn: string): boolean {
  for (const blockSize of [2, 3, 4]) {
    const tail = msisdn.slice(-blockSize * 2);
    if (tail.length < blockSize * 2) continue;
    const a = tail.slice(0, blockSize);
    const b = tail.slice(blockSize);
    if (a === b) return true;
  }
  return false;
}

/** الگوی AABB در جفت‌های رقمی: 0912 33 44 55 66 */
function hasPairPattern(msisdn: string): boolean {
  const body = msisdn.slice(3); // بعد از 091x بررسی می‌کنیم
  let pairs = 0;
  for (let i = 0; i + 1 < body.length; i += 2) {
    if (body[i] === body[i + 1]) pairs += 1;
  }
  return pairs >= 3;
}

export function analyzeNumber(
  msisdn: string,
  rondThreshold: number = DEFAULT_ROND_THRESHOLD,
): NumberAnalysis {
  const digits = msisdn.replace(/\D/g, '');
  const runs = digitRuns(digits);
  const maxRepeat = runs.reduce((max, r) => Math.max(max, r.count), 0);
  const longestSequence = longestSequenceLength(digits);
  const tail = digits.slice(-4);

  const palindrome = isFullPalindrome(digits) || isMirrorTail(digits);
  const sequential = longestSequence >= 3;
  const tailAllSame = tail.length === 4 && new Set(tail).size === 1;
  const repeatBlock = hasRepeatingTail(digits);
  const repeated = maxRepeat >= 4 || repeatBlock || hasPairPattern(digits);

  let score = 0;
  const tags: string[] = [];

  if (maxRepeat === digits.length && digits.length > 0) {
    score += 40;
    tags.push('تمام ارقام یکسان');
  }
  if (tailAllSame) {
    score += 30;
    tags.push('۴ رقم آخر یکسان');
  } else if (new Set(digits.slice(-3)).size === 1) {
    score += 22;
    tags.push('۳ رقم آخر یکسان');
  } else if (new Set(digits.slice(-2)).size === 1) {
    score += 12;
    tags.push('۲ رقم آخر یکسان');
  }
  if (isFullPalindrome(digits)) {
    score += 25;
    tags.push('پالیندروم کامل');
  } else if (isMirrorTail(digits)) {
    score += 18;
    tags.push('آینه');
  }
  if (longestSequence >= 5) {
    score += 20;
    tags.push('دنباله‌ی بلند متوالی');
  } else if (longestSequence >= 4) {
    score += 14;
    tags.push('دنباله‌ی متوالی');
  } else if (longestSequence >= 3) {
    score += 7;
  }
  if (repeatBlock) {
    score += 14;
    tags.push('بلوک تکرارشونده');
  }
  if (hasPairPattern(digits)) {
    score += 10;
    tags.push('جفت‌های همسان');
  }
  if (maxRepeat === 5) {
    score += 8;
    tags.push('۵ رقم یکسان');
  } else if (maxRepeat >= 6) {
    score += 14;
    tags.push('۶ رقم یکسان و بیشتر');
  }

  score = Math.max(0, Math.min(100, score));
  return {
    isRond: score >= rondThreshold,
    isSequential: sequential,
    isRepeated: repeated,
    isPalindrome: palindrome,
    rondScore: score,
    maxRepeat,
    longestSequence,
    tags,
  };
}

export const LIKE_ESCAPE_CHAR = '\\';

/** کاراکترهای مجاز الگو در فیلتر «الگوی عددی خاص» */
export const PATTERN_WILDCARD_SINGLE = '?';
export const PATTERN_WILDCARD_MULTI = '*';

/**
 * تبدیل الگوی کاربر به الگوی SQL LIKE.
 * `?` → دقیقاً یک رقم،  `*` → هر تعداد رقم.
 * مثال: «0912???1111» → «0912___1111»
 */
export function patternToLike(pattern: string): string {
  const normalized = pattern.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
  if (!normalized) return '%';
  let out = '';
  for (const ch of normalized) {
    if (ch === PATTERN_WILDCARD_SINGLE) out += '_';
    else if (ch === PATTERN_WILDCARD_MULTI) out += '%';
    else if (ch === '%' || ch === '_') out += `${LIKE_ESCAPE_CHAR}${ch}`; // جلوگیری از تزریق کاراکتر ویژه‌ی LIKE
    else if (/[0-9]/.test(ch)) out += ch;
    // سایر کاراکترها نادیده گرفته می‌شوند
  }
  return `%${out}%`;
}

/** آیا الگو حداقل یک رقم دارد؟ (اعتبارسنجی ورودی) */
export function isValidPattern(pattern: string): boolean {
  return /\d/.test(pattern) || pattern.includes(PATTERN_WILDCARD_MULTI);
}

/** توصیف فارسی برچسب‌ها برای نمایش */
export function describeAnalysis(a: NumberAnalysis): string {
  if (a.tags.length === 0) return 'شماره‌ی معمولی';
  return a.tags.join(' • ');
}

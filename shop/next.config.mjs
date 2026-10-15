/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // برای ایمیج‌های محصولات روی CDN/فضای ابری
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.users.ir' },
      { protocol: 'https', hostname: '**.arvanstorage.ir' },
      { protocol: 'https', hostname: 'cdn.jsdelivr.net' },
    ],
  },
  // خروجی standalone برای ایمیج کوچک داکر
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
export default nextConfig;

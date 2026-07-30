/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Lint still runs separately via `npm run lint`; it is not a deploy blocker.
  eslint: { ignoreDuringBuilds: true },
  // Type errors now fail the build. They were suppressed for a year and hid
  // 217 problems, four of which were live runtime bugs — a wrong dropdown
  // field, undefined variables, a crash in the error reporter. Leave this off.
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    // Batch 4 (bundle): tree-shake barrel imports so a screen that uses six
    // lucide icons does not pull the whole icon set into its bundle. Built-in
    // and safe — Next rewrites `import { X } from 'lucide-react'` to per-icon
    // imports at build time.
    optimizePackageImports: ['lucide-react'],
  },
  // F-11: the image optimizer is no longer an open proxy for any HTTPS host.
  // Restrict to the object store (uploads) and identity-avatar providers actually
  // embedded by the app. Add hostnames here if a new legitimate source appears.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '*.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: '*.gravatar.com' },
      { protocol: 'https', hostname: 'crm.ameyaheights.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

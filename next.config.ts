import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? '';

// 'unsafe-inline' en script-src es por el snippet de tema (dark/light) en
// app/layout.tsx, y en style-src por los style={{...}} inline que usa
// React en todo el proyecto (CSS Modules no alcanza para eso). No es una
// CSP estricta con nonce, pero igual bloquea inyección de <script>/<iframe>
// externos, que es lo que importa contra XSS de terceros.
const csp = [
  "default-src 'self'",
  `connect-src 'self' https://nominatim.openstreetmap.org https://*.sentry.io ${apiOrigin}`.trim(),
  "img-src 'self' data: blob: https://res.cloudinary.com https://picsum.photos https://*.tile.openstreetmap.org",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});

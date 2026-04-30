import type { NextConfig } from "next";

const storageRegion = process.env.STORAGE_REGION ?? "us-east-1";
const storageBucket = process.env.STORAGE_BUCKET;
const storageEndpoint = process.env.STORAGE_ENDPOINT;

function getStorageUploadOrigins(): string[] {
  const origins = new Set<string>();

  if (storageEndpoint) {
    try {
      origins.add(new URL(storageEndpoint).origin);
    } catch {
      // Ignore invalid endpoint values; uploads will still work where CSP allows them.
    }
  } else if (storageBucket) {
    origins.add(`https://${storageBucket}.s3.${storageRegion}.amazonaws.com`);
  }

  return [...origins];
}

const connectSrc = [
  "'self'",
  "https://api.paystack.co",
  "https://api.flutterwave.com",
  "https://api.resend.com",
  "https://api.ng.termii.com",
  "https://upstash.io",
  // Allow Vercel deployment URLs so preview builds and auth callbacks work
  "https://*.vercel.app",
  ...getStorageUploadOrigins(),
  "wss:",
].join(" ");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.paystack.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "frame-src 'self' https://js.paystack.co https://checkout.paystack.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const CANONICAL_DOMAIN = "www.admission.trinitateschools.com";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        // Redirect the stable Vercel project subdomain to the canonical domain
        source: "/:path*",
        has: [{ type: "host", value: "sams-josephs-projects-d429a6bf.vercel.app" }],
        destination: `https://${CANONICAL_DOMAIN}/:path*`,
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.s3.amazonaws.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

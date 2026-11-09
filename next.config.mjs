import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withSentryConfig } from "@sentry/nextjs/config"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Avoid picking parent folder lockfiles (e.g. ~/pnpm-lock.yaml) as workspace root.
    root: __dirname,
  },
  async headers() {
    return [
      {
        // O service worker nunca deve ficar preso em cache agressivo de CDN.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ]
  },
}

// Source maps sobem no build quando SENTRY_AUTH_TOKEN existe (lido do ambiente);
// sem o token o upload é pulado e o build segue normal. Os .map são apagados
// depois do upload, então não ficam públicos no deploy.
export default withSentryConfig(nextConfig, {
  org: "bagattoli-tech",
  project: "sgde",
  silent: true,
})

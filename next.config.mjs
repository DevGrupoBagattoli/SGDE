import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

export default nextConfig

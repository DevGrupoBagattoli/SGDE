import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Avoid picking parent folder lockfiles (e.g. ~/pnpm-lock.yaml) as workspace root.
    root: __dirname,
  },
}

export default nextConfig

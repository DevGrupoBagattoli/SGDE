import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const logoPath = path.join(projectRoot, "public", "bagattoli-tech-logo.png")
const outputDir = path.join(projectRoot, "public", "icons")

// O logotipo é escuro (preto + verde-lima) e ficaria ilegível sobre o fundo
// escuro "#09090b" do manifest. Usa-se o fundo claro do tema (--background de
// app/globals.css, oklch(1 0 0)) como base sólida para manter a marca legível.
const BACKGROUND = "#ffffff"

// Ícones regulares: logo em ~90% do canvas.
// Maskable: ~75% de conteúdo para respeitar a safe area do Android (recorte
// em formas variadas: círculo, squircle etc.).
const TARGETS = [
  { filename: "icon-192.png", size: 192, ratio: 0.9 },
  { filename: "icon-512.png", size: 512, ratio: 0.9 },
  { filename: "icon-192-maskable.png", size: 192, ratio: 0.75 },
  { filename: "icon-512-maskable.png", size: 512, ratio: 0.75 },
]

async function generateIcon({ filename, size, ratio }) {
  const innerSize = Math.round(size * ratio)
  const resizedLogo = await sharp(logoPath)
    .resize(innerSize, innerSize, { fit: "contain", background: BACKGROUND })
    .toBuffer()

  const outputPath = path.join(outputDir, filename)

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: resizedLogo, gravity: "centre" }])
    .png()
    .toFile(outputPath)

  // Auto-verificação: garante que o PNG final tem exatamente o tamanho esperado.
  const { width, height } = await sharp(outputPath).metadata()
  if (width !== size || height !== size) {
    throw new Error(`Dimensão inesperada em ${filename}: ${width}x${height} (esperado ${size}x${size})`)
  }

  return outputPath
}

async function main() {
  const metadata = await sharp(logoPath).metadata()
  console.log(
    `Logo de origem: ${metadata.width}x${metadata.height}px (alpha: ${metadata.hasAlpha ? "sim" : "não"})`
  )

  await mkdir(outputDir, { recursive: true })

  for (const target of TARGETS) {
    const outputPath = await generateIcon(target)
    console.log(`Gerado: ${path.relative(projectRoot, outputPath)} (${target.size}x${target.size})`)
  }
}

main().catch((error) => {
  console.error("Falha ao gerar os ícones do PWA:", error)
  process.exitCode = 1
})

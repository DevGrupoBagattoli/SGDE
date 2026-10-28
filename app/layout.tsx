import type { Metadata, Viewport } from "next"
import { Geist_Mono, Outfit } from "next/font/google"

import "./globals.css"
import { RegisterServiceWorker } from "@/components/push/register-sw"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";

const outfit = Outfit({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
}

/** Evita zoom automático no iOS ao focar inputs (e pinch-zoom), priorizando uso em celular. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", outfit.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  )
}

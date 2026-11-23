import type { Metadata, Viewport } from "next"

import { AppShell } from "@/components/app-shell"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/toaster"

import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Hồ sơ CSKV", template: "%s · Hồ sơ CSKV" },
  description: "Trợ lý lập hồ sơ tự động theo biểu mẫu dành cho Cảnh sát khu vực.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#151a24" },
  ],
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="vi" suppressHydrationWarning>
    <body>
      <ThemeProvider>
        <AppShell>{children}</AppShell>
        <Toaster />
      </ThemeProvider>
    </body>
  </html>
)

export default RootLayout

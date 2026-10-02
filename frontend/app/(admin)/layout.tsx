import type { Metadata, Viewport } from "next"
import "../globals.css"
import { Providers } from "@/components/providers"
import { fontVariables } from "@/lib/fonts"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: { default: "Painel · Açougue do Vandinho", template: "%s · Painel Vandinho" },
  robots: { index: false },
}

export const viewport: Viewport = { themeColor: "#050505" }

/** Root layout for the admin panel (light theme with the dark brand sidebar). */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cn("antialiased", fontVariables)}>
      <body className="min-h-dvh">
        <Providers theme="light">{children}</Providers>
      </body>
    </html>
  )
}

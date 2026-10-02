import type { Metadata, Viewport } from "next"
import "../globals.css"
import { Providers } from "@/components/providers"
import { CartDrawer } from "@/components/store/cart-drawer"
import { CartDrawerProvider } from "@/components/store/cart-context"
import { fontVariables } from "@/lib/fonts"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: { default: "Açougue do Vandinho", template: "%s · Açougue do Vandinho" },
  description: "Cortes selecionados, porcionados na hora. Peça pelo site e receba em casa ou retire no balcão.",
}

export const viewport: Viewport = { themeColor: "#050505" }

/** Root layout for customers and couriers (dark brand theme). */
export default function StoreRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cn("dark antialiased", fontVariables)}>
      <body className="min-h-dvh">
        <Providers theme="dark">
          <CartDrawerProvider>
            {children}
            <CartDrawer />
          </CartDrawerProvider>
        </Providers>
      </body>
    </html>
  )
}

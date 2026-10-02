"use client"

import { HeartIcon, HouseIcon, ReceiptTextIcon, ShoppingBagIcon, UserRoundIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCart } from "@/hooks/use-cart"
import { cn } from "@/lib/utils"
import { useCartDrawer } from "./cart-context"

const items = [
  { href: "/", label: "Início", icon: HouseIcon },
  { href: "/favoritos", label: "Favoritos", icon: HeartIcon },
  { href: "#carrinho", label: "Carrinho", icon: ShoppingBagIcon },
  { href: "/pedidos", label: "Pedidos", icon: ReceiptTextIcon },
  { href: "/perfil", label: "Perfil", icon: UserRoundIcon },
]

/** Mobile tab bar (hidden from md up, where the header carries these links). */
export function BottomNav() {
  const pathname = usePathname()
  const { cart } = useCart()
  const { setOpen } = useCartDrawer()
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t bg-[#0a0a0a]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          const cls = cn("flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold", active ? "text-gold-text" : "text-muted-foreground")
          const content = (
            <>
              <span className="relative">
                <Icon className="size-5.5" aria-hidden />
                {href === "#carrinho" && cart.itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {cart.itemCount}
                  </span>
                )}
              </span>
              {label}
            </>
          )
          return (
            <li key={href}>
              {href === "#carrinho" ? (
                <button type="button" className={cn(cls, "w-full")} onClick={() => setOpen(true)}>
                  {content}
                </button>
              ) : (
                <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

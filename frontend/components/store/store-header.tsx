"use client"

import { HeartIcon, MapPinIcon, ReceiptTextIcon, ShoppingBagIcon, UserRoundIcon } from "lucide-react"
import Link from "next/link"
import { usePop } from "@/components/anim/reveal"
import { Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { useCart } from "@/hooks/use-cart"
import { useSession } from "@/hooks/use-session"
import useSWR from "swr"
import type { Address } from "@/lib/types"
import { useCartDrawer } from "./cart-context"

export function CartButton() {
  const { cart } = useCart()
  const { setOpen } = useCartDrawer()
  const count = cart.itemCount
  const ref = usePop<HTMLSpanElement>(count)
  return (
    <Button variant="outline" size="icon-lg" className="relative" onClick={() => setOpen(true)} aria-label={`Carrinho com ${count} itens`}>
      <ShoppingBagIcon />
      {count > 0 && (
        <span ref={ref} className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
          {count}
        </span>
      )}
    </Button>
  )
}

function DeliveryTo() {
  const { me } = useSession()
  const { data } = useSWR<Address[]>(me?.role === "CUSTOMER" && me.addressCount ? "/me/addresses" : null)
  const main = data?.find((a) => a.isDefault) ?? data?.[0]
  if (!main) return <span className="text-xs text-muted-foreground">Entrega no bairro ou retirada no balcão</span>
  return (
    <Link href="/perfil/enderecos" className="flex min-h-6 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <MapPinIcon className="size-3.5 text-gold-text" aria-hidden />
      <span className="truncate">
        Entregar em {main.label} · {main.street}, {main.number}
      </span>
    </Link>
  )
}

export function StoreHeader() {
  const { me } = useSession()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-18 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Açougue do Vandinho — início">
          <Logo size={48} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link href="/" className="font-heading text-base leading-tight font-semibold tracking-[0.06em] uppercase">
            Açougue do Vandinho
          </Link>
          <DeliveryTo />
        </div>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Conta">
          <Link href="/favoritos" className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <HeartIcon className="size-4" aria-hidden /> Favoritos
          </Link>
          <Link href="/pedidos" className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <ReceiptTextIcon className="size-4" aria-hidden /> Pedidos
          </Link>
          <Link href={me ? "/perfil" : "/entrar"} className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <UserRoundIcon className="size-4" aria-hidden /> {me ? me.firstName : "Entrar"}
          </Link>
        </nav>
        <CartButton />
      </div>
    </header>
  )
}

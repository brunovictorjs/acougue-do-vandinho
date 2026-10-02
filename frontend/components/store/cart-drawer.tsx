"use client"

import { ArrowRightIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import { ProductImage } from "@/components/product-image"
import { Button, buttonVariants } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useCart } from "@/hooks/use-cart"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSession } from "@/hooks/use-session"
import { api } from "@/lib/api"
import { money } from "@/lib/format"
import type { Cart } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCartDrawer } from "./cart-context"
import { QuantityStepper } from "./quantity-stepper"

/** Cart as a modal drawer: bottom sheet on phones, side panel on larger screens. */
export function CartDrawer() {
  const { open, setOpen } = useCartDrawer()
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const { me } = useSession()
  const { cart, mutate } = useCart()
  const [busy, setBusy] = React.useState<string | null>(null)

  // Close when navigating.
  React.useEffect(() => setOpen(false), [pathname, setOpen])

  if (pathname.startsWith("/entregador")) return null

  async function change(itemId: string, quantity: number) {
    setBusy(itemId)
    try {
      await mutate(await api<Cart>(`/cart/items/${itemId}`, { method: "PATCH", body: { quantity } }), { revalidate: false })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar.")
    } finally {
      setBusy(null)
    }
  }

  async function remove(itemId: string) {
    setBusy(itemId)
    try {
      await mutate(await api<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }), { revalidate: false })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection={isMobile ? "down" : "right"}>
      <DrawerContent className={cn(!isMobile && "data-[swipe-axis=x]:sm:[--drawer-content-width:28rem]")}>
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <DrawerHeader className="flex-row items-baseline justify-between gap-3 text-left">
            <DrawerTitle className="font-display text-3xl">Seu carrinho</DrawerTitle>
            <DrawerDescription>{cart.itemCount === 1 ? "1 item" : `${cart.itemCount} itens`}</DrawerDescription>
          </DrawerHeader>

          {cart.itemCount === 0 ? (
            <Empty className="flex-1">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingBagIcon />
                </EmptyMedia>
                <EmptyTitle>Carrinho vazio</EmptyTitle>
                <EmptyDescription>{me ? "Escolha seus cortes no catálogo." : "Entre na sua conta para montar o pedido."}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href={me ? "/#catalogo" : "/entrar"} className={buttonVariants({ size: "lg" })} onClick={() => setOpen(false)}>
                  {me ? "Ver catálogo" : "Entrar"}
                </Link>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <ScrollArea className="min-h-0 flex-1 px-4">
                <ul className="flex flex-col">
                  {cart.items.map((item) => (
                    <li key={item.id} className="flex gap-3 border-t py-3 first:border-t-0">
                      <ProductImage src={item.coverUrl} alt={item.name} className="size-16 shrink-0 rounded-lg" iconClassName="size-6" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[item.cutOption, item.notes].filter(Boolean).join(" · ") || "Sem observações"}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" aria-label={`Remover ${item.name}`} disabled={busy === item.id} onClick={() => remove(item.id)}>
                            <Trash2Icon />
                          </Button>
                        </div>
                        {!item.available && <p className="text-xs font-semibold text-destructive">Indisponível — remova para continuar</p>}
                        <div className="flex items-center justify-between gap-2">
                          <QuantityStepper value={item.quantity} unit={item.unit} min={item.minQuantity} step={item.quantityStep} disabled={busy === item.id || !item.available} onChange={(q) => change(item.id, q)} />
                          <span className="font-heading text-base font-semibold text-gold-text">{money(item.totalCents)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              <DrawerFooter className="border-t bg-[#0a0a0a]">
                <dl className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd>{money(cart.subtotalCents)}</dd>
                  </div>
                  {cart.savingsCents > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Economia com ofertas</dt>
                      <dd className="text-success">− {money(cart.savingsCents)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Entrega</dt>
                    <dd className="text-muted-foreground">calculada no próximo passo</dd>
                  </div>
                </dl>
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="label-caps text-sm">Total parcial</span>
                  <span className="font-heading text-2xl font-semibold text-gold-text">{money(cart.subtotalCents)}</span>
                </div>
                <Link
                  href="/checkout"
                  aria-disabled={cart.hasUnavailable}
                  className={cn(buttonVariants({ size: "xl" }), "w-full", cart.hasUnavailable && "pointer-events-none opacity-50")}
                  onClick={() => setOpen(false)}
                >
                  Ir para o pagamento
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </DrawerFooter>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

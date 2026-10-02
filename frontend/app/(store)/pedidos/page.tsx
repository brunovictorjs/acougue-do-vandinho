"use client"

import { ChevronRightIcon, ReceiptTextIcon, RotateCcwIcon, StoreIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import useSWR from "swr"
import { PageTitle, ShopShell } from "@/components/store/shop-shell"
import { DeliveryStatusBadge, fulfilmentStatus, OrderStatusBadge } from "@/components/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { dateTime, money } from "@/lib/format"
import type { OrderStatus, OrderSummary } from "@/lib/types"

const FILTERS: Array<[string, string]> = [
  ["ALL", "Todos"],
  ["PAID", "Pagos"],
  ["CART", "No carrinho"],
  ["CANCELLED", "Cancelados"],
]

export default function OrdersPage() {
  const [filter, setFilter] = React.useState("ALL")
  const { data } = useSWR<OrderSummary[]>(`/orders${filter === "ALL" ? "" : `?status=${filter as OrderStatus}`}`, { refreshInterval: 15000 })

  return (
    <ShopShell>
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
        <PageTitle title="Meus pedidos" />
        <ToggleGroup variant="chip" size="none" className="no-scrollbar -mx-4 w-auto overflow-x-auto px-4" value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0])} aria-label="Filtrar pedidos">
          {FILTERS.map(([v, l]) => (
            <ToggleGroupItem key={v} value={v} className="shrink-0">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {!data ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptTextIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum pedido por aqui</EmptyTitle>
              <EmptyDescription>Quando você comprar, os pedidos aparecem nesta lista.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/#catalogo" className={buttonVariants({ size: "lg" })}>
                Ver catálogo
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.map((o) => (
              <li key={o.id}>
                <Link
                  href={o.status === "CART" ? `/pedidos/${o.id}/pagamento` : `/pedidos/${o.id}`}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-brand-gold-dark"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">#{o.code}</span>
                    <span className="text-xs text-muted-foreground">{dateTime(o.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <OrderStatusBadge status={o.status} />
                    {o.status !== "CART" && <DeliveryStatusBadge status={fulfilmentStatus(o)} />}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex-1 truncate text-sm text-muted-foreground">{o.itemNames.join(", ")}</span>
                    <span className="font-heading text-lg font-semibold">{money(o.totalCents)}</span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                  </div>
                  {o.status === "CART" && <span className={buttonVariants({ size: "lg", className: "w-full" })}>Continuar pagamento</span>}
                  {o.status === "CANCELLED" && (
                    <span className="flex items-center gap-2 text-xs text-success">
                      <RotateCcwIcon className="size-3.5" aria-hidden /> Valor reembolsado na forma de pagamento original
                    </span>
                  )}
                  {o.status === "PAID" && o.fulfillment === "PICKUP" && !o.pickedUpAt && (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <StoreIcon className="size-3.5" aria-hidden /> Código de retirada enviado no WhatsApp
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </ShopShell>
  )
}

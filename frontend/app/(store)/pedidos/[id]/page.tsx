"use client"

import { CheckIcon, ChevronLeftIcon, HeadsetIcon, MapPinIcon, RotateCcwIcon, StarIcon, StoreIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { ProductImage } from "@/components/product-image"
import { ReviewDrawer } from "@/components/store/product/reviews"
import { ShopShell } from "@/components/store/shop-shell"
import { DeliveryStatusBadge, fulfilmentStatus, OrderStatusBadge } from "@/components/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, errorMessage } from "@/lib/api"
import { dateTime, methodLabel, money, qty } from "@/lib/format"
import type { OrderDetail, StoreInfo } from "@/lib/types"
import { cn } from "@/lib/utils"

const REASONS = ["Pedi errado", "Demorou", "Não preciso mais", "Outro"]

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: order, mutate } = useSWR<OrderDetail>(`/orders/${id}`, { refreshInterval: 10000 })
  const { data: store } = useSWR<StoreInfo>("/store")
  const [confirming, setConfirming] = React.useState(false)
  const [reason, setReason] = React.useState(REASONS[0])
  const [busy, setBusy] = React.useState(false)
  const [reviewing, setReviewing] = React.useState<{ productId: string; name: string } | null>(null)

  async function cancel() {
    setBusy(true)
    try {
      await mutate(await api<OrderDetail>(`/orders/${id}/cancel`, { body: { reason } }), { revalidate: false })
      toast.success("Pedido cancelado. O reembolso foi iniciado.")
      setConfirming(false)
      setTimeout(() => void mutate(), 2500)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ShopShell>
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
        <Link href="/pedidos" className={buttonVariants({ variant: "ghost", className: "self-start" })}>
          <ChevronLeftIcon data-icon="inline-start" /> Meus pedidos
        </Link>
        {!order ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <h1 className="font-display text-4xl">Pedido #{order.code}</h1>

            <Card className={cn(order.status === "CANCELLED" ? "ring-destructive/40" : "ring-brand-gold-dark")}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <OrderStatusBadge status={order.status} />
                  {order.status !== "CART" && <DeliveryStatusBadge status={fulfilmentStatus({ ...order, deliveryStatus: order.delivery?.status })} />}
                </div>
                {order.status === "CANCELLED" && (
                  <p className="flex items-start gap-2 text-sm">
                    <RotateCcwIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {order.refund?.status === "SUCCEEDED"
                      ? `Reembolso de ${money(order.refund.amountCents)} concluído.`
                      : `Reembolso de ${money(order.totalCents)} em processamento. ${order.paymentMethod === "PIX" ? "No Pix, o valor volta para a conta de origem." : "No cartão, o estorno aparece na fatura em alguns dias úteis."}`}
                  </p>
                )}
                {order.status === "PAID" && order.fulfillment === "PICKUP" && !order.pickedUpAt && (
                  <div className="flex flex-col gap-2 rounded-lg bg-black p-4 text-center">
                    <span className="label-caps text-muted-foreground">Código de retirada</span>
                    <span className="font-mono text-3xl tracking-widest text-gold-text">{order.code}</span>
                    <span className="text-xs text-muted-foreground">Mostre este código no balcão.</span>
                  </div>
                )}
                {order.delivery?.status === "NOT_DELIVERED" && (
                  <Alert variant="destructive">
                    <TriangleAlertIcon />
                    <AlertDescription>
                      Não conseguimos entregar: {order.delivery.failureReason?.toLowerCase()}. Fale com um atendente para combinar uma nova entrega.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="label-caps text-sm text-muted-foreground">Andamento</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col">
                  {order.timeline.map((t, i) => {
                    const next = order.timeline.findIndex((x) => !x.done)
                    const active = i === next
                    return (
                      <li key={t.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                              t.done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary text-gold-text" : "border-muted-foreground/30"
                            )}
                          >
                            {t.done && <CheckIcon className="size-3.5" aria-hidden />}
                          </span>
                          {i < order.timeline.length - 1 && <span className={cn("min-h-6 w-0.5 flex-1", t.done ? "bg-brand-gold-dark" : "bg-border")} />}
                        </div>
                        <div className="flex flex-col pb-4">
                          <span className={cn("text-sm font-semibold", !t.done && !active && "text-muted-foreground")}>{t.label}</span>
                          <span className="text-xs text-muted-foreground">{t.at && t.done ? dateTime(t.at) : active ? "Próxima etapa" : "—"}</span>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="label-caps text-sm text-muted-foreground">{order.fulfillment === "PICKUP" ? "Retirada" : "Entrega"}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-start gap-3 text-sm">
                {order.fulfillment === "PICKUP" ? <StoreIcon className="size-5 text-gold-text" aria-hidden /> : <MapPinIcon className="size-5 text-gold-text" aria-hidden />}
                {order.fulfillment === "PICKUP" ? (
                  <span>
                    {store?.name}
                    <br />
                    <span className="text-muted-foreground">{store?.addressLine}</span>
                  </span>
                ) : (
                  <span>
                    {order.address?.label}
                    <br />
                    <span className="text-muted-foreground">
                      {order.address?.street}, {order.address?.number}
                      {order.address?.complement ? ` — ${order.address.complement}` : ""} · {order.address?.neighborhood} · {order.address?.city}/{order.address?.state}
                    </span>
                    {order.delivery?.courierName && order.delivery.status === "IN_TRANSIT" && <span className="mt-1 block text-info">{order.delivery.courierName} está a caminho.</span>}
                  </span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="label-caps text-sm text-muted-foreground">Itens</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {order.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-3">
                    <ProductImage src={i.coverUrl} alt={i.productName} className="size-12 shrink-0 rounded-lg" iconClassName="size-5" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{i.productName}</span>
                      <span className="text-xs text-muted-foreground">{[i.cutOption, qty(i.quantity, i.unit)].filter(Boolean).join(" · ")}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span>{money(i.totalCents)}</span>
                      {order.canReview && (
                        <Button variant="ghost" size="sm" className="h-8 text-gold-text" onClick={() => setReviewing({ productId: i.productId, name: i.productName })}>
                          <StarIcon data-icon="inline-start" /> Avaliar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{money(order.subtotalCents)}</span>
                </div>
                {order.fulfillment === "DELIVERY" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de entrega</span>
                    <span>{money(order.deliveryFeeCents)}</span>
                  </div>
                )}
                {order.paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pagamento</span>
                    <span>{methodLabel[order.paymentMethod]}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between">
                  <span className="label-caps text-sm">Total</span>
                  <span className="font-heading text-2xl font-semibold text-gold-text">{money(order.totalCents)}</span>
                </div>
              </CardContent>
            </Card>

            {order.canCancel && (
              <div className="flex flex-col gap-2">
                <Button variant="destructive" size="xl" onClick={() => setConfirming(true)}>
                  <XIcon data-icon="inline-start" /> Cancelar pedido
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {order.fulfillment === "PICKUP" ? "Dá para cancelar até a retirada." : "Dá para cancelar enquanto a entrega não sair para rota."}
                </p>
              </div>
            )}
            {store?.whatsapp && (
              <a href={`https://wa.me/${store.whatsapp}?text=${encodeURIComponent(`Quero falar com um atendente sobre o pedido ${order.code}`)}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <HeadsetIcon data-icon="inline-start" /> Falar com um atendente
              </a>
            )}

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-destructive/15 text-destructive">
                    <TriangleAlertIcon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Cancelar o pedido #{order.code}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Devolvemos {money(order.totalCents)} pela mesma forma de pagamento. Pix volta para a conta de origem; cartão aparece na fatura em alguns dias úteis.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <ToggleGroup variant="chip" size="none" className="flex-wrap" value={[reason]} onValueChange={(v) => v[0] && setReason(v[0])} aria-label="Motivo">
                  {REASONS.map((r) => (
                    <ToggleGroupItem key={r} value={r}>
                      {r}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter pedido</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" disabled={busy} onClick={cancel}>
                    Cancelar e reembolsar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {reviewing && (
              <ReviewDrawer
                key={reviewing.productId}
                open={!!reviewing}
                onOpenChange={(o) => !o && setReviewing(null)}
                productId={reviewing.productId}
                productName={reviewing.name}
                tags={["Macia", "Corte certo", "Bem embalada", "Chegou gelada", "Suculenta", "Bom tempero"]}
              />
            )}
          </>
        )}
      </main>
    </ShopShell>
  )
}

"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { CheckIcon, ClockIcon, CopyIcon, CreditCardIcon, MessageCircleIcon, RotateCcwIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import * as React from "react"
import { toast } from "sonner"
import useSWR, { useSWRConfig } from "swr"
import { StripePayment } from "@/components/store/payment/stripe-payment"
import { ShopShell } from "@/components/store/shop-shell"
import { DeliveryStatusBadge, fulfilmentStatus, OrderStatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { api, errorMessage } from "@/lib/api"
import { methodLabel, money, phone } from "@/lib/format"
import type { OrderDetail } from "@/lib/types"

gsap.registerPlugin(useGSAP)

function Countdown({ until }: { until: string }) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, new Date(until).getTime() - now)
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return (
    <span className="flex items-center gap-2 font-semibold text-gold-text" aria-live="polite">
      <ClockIcon className="size-4" aria-hidden />
      {left > 0 ? `Expira em ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : "QR Code expirado"}
    </span>
  )
}

function PaidScreen({ order }: { order: OrderDetail }) {
  const ref = React.useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline()
          .from("[data-check]", { scale: 0, rotate: -90, duration: 0.7, ease: "back.out(2)" })
          .from("[data-paid-line]", { autoAlpha: 0, y: 16, stagger: 0.08, duration: 0.5 }, "-=0.3")
      })
    },
    { scope: ref }
  )
  return (
    <div ref={ref} className="flex flex-col items-center gap-5 py-6 text-center">
      <span data-check className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-12" aria-hidden />
      </span>
      <h1 data-paid-line className="font-display text-5xl">
        Pagamento
        <br />
        <span className="text-brand-gold">aprovado!</span>
      </h1>
      <div data-paid-line className="flex flex-wrap justify-center gap-2">
        <OrderStatusBadge status={order.status} />
        <DeliveryStatusBadge status={fulfilmentStatus({ ...order, deliveryStatus: order.delivery?.status })} />
      </div>
      <Card data-paid-line className="w-full text-left">
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pedido</span>
            <span className="font-mono">#{order.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total pago</span>
            <span className="font-heading text-lg font-semibold text-gold-text">{money(order.totalCents)}</span>
          </div>
          {order.paymentMethod && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Forma</span>
              <span>{methodLabel[order.paymentMethod]}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{order.fulfillment === "PICKUP" ? "Retirada" : "Entrega"}</span>
            <span className="text-right">{order.fulfillment === "PICKUP" ? "No balcão, com o código do pedido" : `${order.address?.street}, ${order.address?.number}`}</span>
          </div>
        </CardContent>
      </Card>
      <Alert data-paid-line className="text-left">
        <MessageCircleIcon />
        <AlertDescription>
          {order.fulfillment === "PICKUP"
            ? "Enviamos no seu WhatsApp a localização da loja e o código de retirada."
            : `Enviamos a confirmação no WhatsApp ${phone(order.customer?.phone)}. Cada mudança de status chega por lá.`}
        </AlertDescription>
      </Alert>
      <div data-paid-line className="flex w-full flex-col gap-3">
        <Link href={`/pedidos/${order.id}`} className={buttonVariants({ size: "xl" })}>
          Acompanhar pedido
        </Link>
        <Link href="/" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Voltar à loja
        </Link>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>()
  const { data: order, mutate } = useSWR<OrderDetail>(`/orders/${id}`, {
    refreshInterval: (o) => (o && o.status === "CART" ? 3000 : 0),
  })
  const [busy, setBusy] = React.useState(false)
  const { mutate: globalMutate } = useSWRConfig()
  const paid = order?.status === "PAID"

  // Once paid, the old cart became an order: refresh the cart badge.
  React.useEffect(() => {
    if (paid) void globalMutate("/cart")
  }, [paid, globalMutate])

  async function simulate() {
    if (!order?.payment) return
    setBusy(true)
    try {
      await api(`/payments/${order.payment.id}/simulate`, { method: "POST" })
      await new Promise((r) => setTimeout(r, 600))
      await mutate()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const payment = order?.payment
  const pix = payment?.pix

  return (
    <ShopShell>
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
        {!order ? (
          <Skeleton className="h-96" />
        ) : order.status !== "CART" ? (
          order.status === "PAID" ? (
            <PaidScreen order={order} />
          ) : (
            <Alert>
              <AlertTitle>Pedido cancelado</AlertTitle>
              <AlertDescription>
                <Link href={`/pedidos/${order.id}`} className="underline">
                  Ver detalhes do pedido
                </Link>
              </AlertDescription>
            </Alert>
          )
        ) : !payment || payment.status === "CANCELED" || payment.status === "FAILED" ? (
          <Alert>
            <RotateCcwIcon />
            <AlertTitle>Este pagamento não está mais válido</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              O carrinho mudou ou o prazo terminou. Gere um novo pagamento.
              <Link href="/checkout" className={buttonVariants({ size: "lg" })}>
                Voltar ao pagamento
              </Link>
            </AlertDescription>
          </Alert>
        ) : payment.provider === "stripe" && payment.clientSecret ? (
          <>
            <h1 className="font-display text-4xl">Pagamento</h1>
            <p className="text-sm text-muted-foreground">
              Pedido #{order.code} · {money(order.totalCents)}
            </p>
            <StripePayment clientSecret={payment.clientSecret} amountCents={order.totalCents} />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner /> Pagou com Pix? Assim que o banco confirmar, esta tela atualiza sozinha.
            </p>
          </>
        ) : pix ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <OrderStatusBadge status="CART" />
            <h1 className="font-display text-4xl">Pague com Pix</h1>
            {pix.expiresAt && <Countdown until={pix.expiresAt} />}
            <div className="rounded-2xl border-4 border-brand-gold bg-white p-4">
              <QRCodeSVG value={pix.code} size={220} bgColor="#ffffff" fgColor="#050505" level="M" title="QR Code Pix" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-heading text-4xl font-semibold text-gold-text">{money(payment.amountCents)}</span>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Input readOnly value={pix.code} aria-label="Código Pix copia e cola" className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button
                size="xl"
                onClick={async () => {
                  await navigator.clipboard.writeText(pix.code)
                  toast.success("Código Pix copiado")
                }}
              >
                <CopyIcon data-icon="inline-start" /> Copiar código Pix
              </Button>
            </div>
            <ol className="list-decimal self-stretch pl-5 text-left text-sm text-muted-foreground">
              <li>Abra o app do seu banco e escolha Pix.</li>
              <li>Leia o QR Code ou cole o código.</li>
              <li>Confirme — a aprovação chega aqui e no WhatsApp.</li>
            </ol>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner /> Aguardando confirmação do pagamento…
            </p>
            {payment.provider === "fake" && (
              <Button variant="outline" size="lg" className="w-full border-dashed" disabled={busy} onClick={simulate}>
                {busy && <Spinner data-icon="inline-start" />}
                Simular pagamento (teste)
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <h1 className="font-display text-4xl">{methodLabel[payment.method]}</h1>
            <p className="text-sm text-muted-foreground">
              Pedido #{order.code} · {money(payment.amountCents)}
            </p>
            <Alert>
              <CreditCardIcon />
              <AlertDescription>Modo de testes: nenhum cartão é cobrado. Com o Stripe ativo, este formulário é o do Stripe.</AlertDescription>
            </Alert>
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault()
                void simulate()
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="cc-number">Número do cartão</FieldLabel>
                  <Input id="cc-number" inputMode="numeric" autoComplete="cc-number" defaultValue="4242 4242 4242 4242" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="cc-exp">Validade</FieldLabel>
                    <Input id="cc-exp" autoComplete="cc-exp" defaultValue="12/34" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="cc-cvc">CVC</FieldLabel>
                    <Input id="cc-cvc" autoComplete="cc-csc" defaultValue="123" />
                  </Field>
                </div>
              </FieldGroup>
              <Button type="submit" size="xl" disabled={busy}>
                {busy && <Spinner data-icon="inline-start" />}
                Pagar {money(payment.amountCents)}
              </Button>
            </form>
          </div>
        )}
      </main>
    </ShopShell>
  )
}

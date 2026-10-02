"use client"

import { CreditCardIcon, LandmarkIcon, LockIcon, PlusIcon, ShieldCheckIcon, StoreIcon, TruckIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { PageTitle, ShopShell } from "@/components/store/shop-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCart } from "@/hooks/use-cart"
import { useSession } from "@/hooks/use-session"
import { api, ApiError, errorMessage } from "@/lib/api"
import { money, qty } from "@/lib/format"
import type { Address, CheckoutResult, Fulfillment, PaymentMethod, StoreInfo } from "@/lib/types"

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="label-caps flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs text-foreground">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function CheckoutPage() {
  const router = useRouter()
  const { me } = useSession()
  const { cart, isLoading } = useCart()
  const { data: addresses } = useSWR<Address[]>(me ? "/me/addresses" : null)
  const { data: store } = useSWR<StoreInfo>("/store")
  const { data: payConfig } = useSWR<{ provider: "fake" | "stripe" }>("/payments/config")
  const [chosenFulfillment, setFulfillment] = React.useState<Fulfillment | null>(null)
  const [chosenAddressId, setAddressId] = React.useState<string>("")
  const [method, setMethod] = React.useState<PaymentMethod>("PIX")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (me && !me.onboardingComplete) router.replace("/cadastro")
  }, [me, router])

  // Defaults until the customer chooses: main served address, else pickup.
  const preferred = addresses?.find((a) => a.isDefault && a.delivery.served) ?? addresses?.find((a) => a.delivery.served)
  const addressId = chosenAddressId || preferred?.id || ""
  const fulfillment: Fulfillment = chosenFulfillment ?? (addresses && !preferred ? "PICKUP" : "DELIVERY")
  const address = addresses?.find((a) => a.id === addressId)
  const fee = fulfillment === "DELIVERY" ? (address?.delivery.feeCents ?? 0) : 0
  const total = cart.subtotalCents + fee
  const canPay = cart.itemCount > 0 && !cart.hasUnavailable && (fulfillment === "PICKUP" || !!address?.delivery.served)
  const isFake = payConfig?.provider !== "stripe"

  async function pay() {
    setBusy(true)
    try {
      const res = await api<CheckoutResult>("/cart/checkout", {
        body: { fulfillment, addressId: fulfillment === "DELIVERY" ? addressId : undefined, paymentMethod: isFake ? method : undefined },
      })
      router.push(`/pedidos/${res.orderId}/pagamento`)
    } catch (e) {
      if (e instanceof ApiError && e.code === "onboarding_required") router.push("/cadastro")
      toast.error(errorMessage(e))
      setBusy(false)
    }
  }

  if (!isLoading && cart.itemCount === 0) {
    return (
      <ShopShell>
        <main className="mx-auto max-w-xl px-4 py-10">
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Seu carrinho está vazio</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/#catalogo" className={buttonVariants({ size: "lg" })}>
                Ver catálogo
              </Link>
            </EmptyContent>
          </Empty>
        </main>
      </ShopShell>
    )
  }

  return (
    <ShopShell>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <PageTitle
          title="Pagamento"
          action={
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LockIcon className="size-3.5" aria-hidden /> Ambiente seguro
            </span>
          }
        />
        <div className="grid gap-8 md:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-8">
            <Step n={1} title="Como receber">
              <ToggleGroup variant="segment" size="none" className="w-full rounded-lg border bg-muted p-1" value={[fulfillment]} onValueChange={(v) => v[0] && setFulfillment(v[0] as Fulfillment)}>
                <ToggleGroupItem value="DELIVERY">
                  <TruckIcon /> Entrega
                </ToggleGroupItem>
                <ToggleGroupItem value="PICKUP">
                  <StoreIcon /> Retirada
                </ToggleGroupItem>
              </ToggleGroup>
            </Step>

            {fulfillment === "DELIVERY" ? (
              <Step n={2} title="Endereço de entrega">
                {!addresses ? (
                  <Skeleton className="h-24" />
                ) : (
                  <RadioGroup value={addressId} onValueChange={(v) => setAddressId(String(v))} aria-label="Endereço de entrega">
                    {addresses.map((a) => (
                      <FieldLabel key={a.id} htmlFor={`addr-${a.id}`} className="rounded-xl">
                        <Field orientation="horizontal" data-disabled={!a.delivery.served || undefined}>
                          <RadioGroupItem value={a.id} id={`addr-${a.id}`} disabled={!a.delivery.served} />
                          <FieldContent>
                            <FieldTitle>{a.label}</FieldTitle>
                            <FieldDescription>
                              {a.street}, {a.number} · {a.neighborhood}
                              {!a.delivery.served && " — não entregamos neste bairro"}
                            </FieldDescription>
                          </FieldContent>
                          {a.delivery.served && <span className="font-semibold text-gold-text">{money(a.delivery.feeCents ?? 0)}</span>}
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Um endereço por pedido. A taxa depende do bairro.</span>
                  <Link href="/perfil/enderecos?novo=1&voltar=/checkout" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    <PlusIcon data-icon="inline-start" /> Novo
                  </Link>
                </div>
              </Step>
            ) : (
              <Step n={2} title="Retirada na loja">
                <Card size="sm">
                  <CardContent className="flex items-start gap-3">
                    <StoreIcon className="mt-0.5 size-5 text-gold-text" aria-hidden />
                    <div className="flex flex-col">
                      <span className="font-semibold">{store?.name ?? "Açougue do Vandinho"}</span>
                      <span className="text-sm text-muted-foreground">{store?.addressLine}</span>
                      {store?.hours.length ? <span className="text-xs text-muted-foreground">{store.hours.map((h) => `${h.label} ${h.value}`).join(" · ")}</span> : null}
                    </div>
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground">Após o pagamento, você recebe no WhatsApp a localização da loja, os itens e o código do pedido.</p>
              </Step>
            )}

            <Step n={3} title="Forma de pagamento">
              {isFake ? (
                <>
                  <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} aria-label="Forma de pagamento">
                    {(
                      [
                        ["PIX", "Pix", "Aprovação na hora", LandmarkIcon],
                        ["CREDIT_CARD", "Cartão de crédito", "Visa, Mastercard, Elo e outros", CreditCardIcon],
                        ["DEBIT_CARD", "Cartão de débito", "Débito à vista", CreditCardIcon],
                      ] as const
                    ).map(([value, title, hint, Icon]) => (
                      <FieldLabel key={value} htmlFor={`pm-${value}`} className="rounded-xl">
                        <Field orientation="horizontal">
                          <RadioGroupItem value={value} id={`pm-${value}`} />
                          <FieldContent>
                            <FieldTitle>{title}</FieldTitle>
                            <FieldDescription>{hint}</FieldDescription>
                          </FieldContent>
                          <Icon className="size-5 text-muted-foreground" aria-hidden />
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                  <Alert>
                    <ShieldCheckIcon />
                    <AlertDescription>Modo de testes: o pagamento é simulado. Com o Stripe ativo, Pix e cartões aparecem no formulário seguro do Stripe.</AlertDescription>
                  </Alert>
                </>
              ) : (
                <Alert>
                  <ShieldCheckIcon />
                  <AlertDescription>Na próxima tela você escolhe Pix, cartão de crédito ou débito no formulário seguro do Stripe.</AlertDescription>
                </Alert>
              )}
            </Step>
          </div>

          <aside className="md:sticky md:top-24 md:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="label-caps text-sm text-muted-foreground">Resumo {cart.code && `· ${cart.code}`}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {cart.items.map((i) => (
                  <div key={i.id} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {i.name} · {qty(i.quantity, i.unit)}
                    </span>
                    <span>{money(i.totalCents)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{money(cart.subtotalCents)}</span>
                </div>
                {cart.savingsCents > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Economia com ofertas</span>
                    <span className="text-success">− {money(cart.savingsCents)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa de entrega</span>
                  <span>{fulfillment === "PICKUP" ? "Grátis" : money(fee)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="label-caps text-sm">Total</span>
                  <span className="font-heading text-3xl font-semibold text-gold-text">{money(total)}</span>
                </div>
                <Button size="xl" className="mt-2 w-full" disabled={!canPay || busy} onClick={pay}>
                  {busy && <Spinner data-icon="inline-start" />}
                  {isFake && method === "PIX" ? `Gerar Pix · ${money(total)}` : `Pagar ${money(total)}`}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheckIcon className="size-3.5" aria-hidden /> Pagamento processado pelo Stripe
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </ShopShell>
  )
}

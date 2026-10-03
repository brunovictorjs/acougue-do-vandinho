"use client"

import { CheckIcon, ChevronLeftIcon, ClockIcon, LockKeyholeIcon, MessageCircleIcon, NavigationIcon, PackageIcon, PhoneIcon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { LazyMap, type MapPoint } from "@/components/maps/map"
import { DeliveryStatusBadge } from "@/components/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError, errorMessage } from "@/lib/api"
import { distance, money, qty } from "@/lib/format"
import type { DeliveryView } from "@/lib/types"

type Detail = {
  delivery: DeliveryView
  store: { name: string; addressLine: string; latitude: number | null; longitude: number | null }
  route: { path: Array<[number, number]>; distanceMeters: number | null; durationSeconds: number | null; source: string } | null
  failureReasons: string[]
}

export default function CourierRoutePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, mutate, error } = useSWR<Detail>(`/courier/deliveries/${id}`)
  const [busy, setBusy] = React.useState(false)
  const [failing, setFailing] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [codeError, setCodeError] = React.useState<string | null>(null)
  const [reason, setReason] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [done, setDone] = React.useState<"DELIVERED" | "NOT_DELIVERED" | null>(null)

  if (error) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <p className="text-muted-foreground">Esta entrega não está mais disponível para você.</p>
        <Link href="/entregador" className={buttonVariants({ size: "lg" })}>
          Voltar para a lista
        </Link>
      </main>
    )
  }
  if (!data) return <Skeleton className="m-4 h-[80dvh]" />

  const d = data.delivery
  const points: MapPoint[] = []
  if (data.store.latitude != null && data.store.longitude != null) points.push({ lat: data.store.latitude, lng: data.store.longitude, label: data.store.name, kind: "store" })
  if (d.latitude != null && d.longitude != null) points.push({ lat: d.latitude, lng: d.longitude, label: d.customerName, kind: "customer" })
  const dest = d.latitude != null ? `${d.latitude},${d.longitude}` : encodeURIComponent(`${d.address.street}, ${d.address.number}, ${d.address.neighborhood}, ${d.address.city}`)
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
  const wazeUrl = d.latitude != null ? `https://waze.com/ul?ll=${dest}&navigate=yes` : `https://waze.com/ul?q=${dest}&navigate=yes`
  const eta = data.route?.durationSeconds ? `${Math.round(data.route.durationSeconds / 60)} min` : null
  const km = distance(data.route?.distanceMeters ?? d.distanceMeters)

  async function act(path: "start" | "delivered" | "not-delivered", body?: unknown) {
    setBusy(true)
    try {
      await api(`/courier/deliveries/${id}/${path}`, { method: "POST", body })
      if (path === "start") await mutate()
      else {
        setFailing(false)
        setConfirming(false)
        setDone(path === "delivered" ? "DELIVERED" : "NOT_DELIVERED")
      }
    } catch (e) {
      // A wrong code stays in the drawer so the courier can ask the customer again.
      if (e instanceof ApiError && (e.code === "delivery_code_invalid" || e.code === "delivery_code_missing")) {
        setCodeError(e.message)
        setCode("")
      } else toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function openConfirm() {
    setCode("")
    setCodeError(null)
    setConfirming(true)
  }

  if (done) {
    return (
      <main className="flex min-h-dvh flex-col items-center gap-5 px-6 pt-24 text-center">
        <span className={done === "DELIVERED" ? "flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground" : "flex size-24 items-center justify-center rounded-full bg-orange/15 text-orange"}>
          {done === "DELIVERED" ? <CheckIcon className="size-12" aria-hidden /> : <TriangleAlertIcon className="size-12" aria-hidden />}
        </span>
        <h1 className="font-display text-5xl">{done === "DELIVERED" ? "Entregue!" : "Não entregue"}</h1>
        <p className="text-muted-foreground">
          {done === "DELIVERED" ? `#${d.orderCode} saiu da sua lista. O cliente recebeu o aviso no WhatsApp.` : "Registramos o motivo e avisamos o cliente no WhatsApp. Leve o pedido de volta à loja."}
        </p>
        <div className="flex-1" />
        <Button size="xl" className="mb-8 w-full" onClick={() => router.push("/entregador")}>
          {done === "DELIVERED" ? "Próxima entrega" : "Voltar para a lista"}
        </Button>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="relative isolate h-[45dvh] min-h-72">
        {points.length ? (
          <LazyMap className="size-full" points={points} path={data.route?.path} zoomControl={false} />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground">Endereço sem coordenadas — use o botão Maps para navegar.</div>
        )}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex items-center justify-between">
          <Link href="/entregador" className="pointer-events-auto flex size-11 items-center justify-center rounded-lg border border-white/15 bg-black text-white hover:bg-[#161616]" aria-label="Voltar para a lista">
            <ChevronLeftIcon />
          </Link>
          {(eta || km) && (
            <span className="flex h-11 items-center gap-2 rounded-full border border-brand-gold-dark bg-black/85 px-4 text-sm font-semibold">
              <ClockIcon className="size-4 text-gold-text" aria-hidden />
              {[eta, km].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>

      <section className="relative z-10 -mt-5 flex flex-1 flex-col gap-4 rounded-t-2xl border-t bg-popover px-4 pt-5 pb-8">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm">#{d.orderCode}</span>
          <DeliveryStatusBadge status={d.status} />
        </div>
        <div className="flex flex-col">
          <h1 className="font-display text-3xl">{d.customerName}</h1>
          <span>{d.addressLine}</span>
          <span className="text-sm text-muted-foreground">
            {d.neighborhood} · {d.address.city}
            {d.address.reference ? ` · Ref.: ${d.address.reference}` : ""}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <a href={d.customerPhone ? `tel:+${d.customerPhone}` : undefined} aria-disabled={!d.customerPhone} className={buttonVariants({ variant: "outline", size: "lg" })}>
            <PhoneIcon data-icon="inline-start" /> Ligar
          </a>
          <a href={d.customerPhone ? `https://wa.me/${d.customerPhone}` : undefined} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <MessageCircleIcon data-icon="inline-start" /> Zap
          </a>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <NavigationIcon data-icon="inline-start" /> Maps
          </a>
        </div>
        <a href={wazeUrl} target="_blank" rel="noreferrer" className="-mt-2 text-center text-xs text-muted-foreground underline">
          Abrir no Waze
        </a>
        <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
          <PackageIcon className="mt-0.5 size-5 text-gold-text" aria-hidden />
          <div className="flex flex-1 flex-col text-sm">
            <span className="font-semibold">
              {d.itemCount} {d.itemCount === 1 ? "item" : "itens"} · já pago
            </span>
            <span className="text-muted-foreground">{d.items.map((i) => `${i.name} ${qty(i.quantity, i.unit)}`).join(", ")}</span>
            {d.status === "IN_TRANSIT" && <span className="mt-1 text-gold-text">Peça o código de entrega de 6 dígitos ao cliente antes de passar o pedido.</span>}
          </div>
          <span className="font-semibold text-gold-text">Taxa {money(d.feeCents)}</span>
        </div>

        <div className="flex-1" />
        {d.status === "AWAITING" && (
          <Button size="xl" disabled={busy} onClick={() => act("start")}>
            {busy && <Spinner data-icon="inline-start" />}
            Iniciar entrega
          </Button>
        )}
        {d.status === "IN_TRANSIT" && (
          <>
            <Button size="xl" className="h-14" disabled={busy} onClick={openConfirm}>
              <CheckIcon data-icon="inline-start" />
              Marcar como entregue
            </Button>
            <Button variant="outline" size="xl" className="border-brand-gold" disabled={busy} onClick={() => setFailing(true)}>
              Não foi possível entregar
            </Button>
          </>
        )}
      </section>

      <Drawer open={confirming} onOpenChange={setConfirming}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader className="text-left">
              <DrawerTitle className="font-display text-3xl">Código de entrega</DrawerTitle>
              <DrawerDescription>
                Pergunte ao cliente os 6 dígitos que ele recebeu no WhatsApp. Só entregue o pedido depois que o código for aceito.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-4 px-4 py-5">
              <Field data-invalid={codeError ? true : undefined} className="gap-3 text-center">
                <InputOTP
                  aria-label="Código de entrega"
                  containerClassName="justify-center"
                  maxLength={6}
                  value={code}
                  onChange={(v: string) => {
                    setCode(v)
                    setCodeError(null)
                  }}
                  onComplete={(v: string) => void act("delivered", { code: v })}
                  disabled={busy}
                  inputMode="numeric"
                  autoFocus
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="size-12 text-lg" aria-invalid={codeError ? true : undefined} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                {codeError ? <FieldError>{codeError}</FieldError> : <FieldDescription className="text-center">O código é do pedido, não do endereço — nunca conclua sem ele.</FieldDescription>}
              </Field>
            </div>
            <DrawerFooter>
              <Button size="xl" disabled={code.length < 6 || busy} onClick={() => act("delivered", { code })}>
                {busy ? <Spinner data-icon="inline-start" /> : <LockKeyholeIcon data-icon="inline-start" />}
                Confirmar entrega
              </Button>
              <Button variant="outline" size="lg" onClick={() => setConfirming(false)}>
                Voltar
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={failing} onOpenChange={setFailing}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader className="text-left">
              <DrawerTitle className="font-display text-3xl">O que aconteceu?</DrawerTitle>
              <DrawerDescription>O cliente recebe o motivo no WhatsApp.</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-4 px-4 py-5">
              <RadioGroup value={reason} onValueChange={(v) => setReason(String(v))} aria-label="Motivo">
                {data.failureReasons.map((r) => (
                  <FieldLabel key={r} htmlFor={`r-${r}`} className="rounded-xl">
                    <Field orientation="horizontal">
                      <RadioGroupItem value={r} id={`r-${r}`} />
                      <FieldContent>
                        <FieldTitle>{r}</FieldTitle>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
              <Field>
                <FieldLabel htmlFor="fail-notes">Observação</FieldLabel>
                <Textarea id="fail-notes" rows={2} maxLength={300} placeholder="Ex.: toquei 3 vezes e liguei 2 vezes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            <DrawerFooter>
              <Button size="xl" className="bg-orange text-orange-foreground hover:bg-orange/90" disabled={!reason || busy} onClick={() => act("not-delivered", { reason, notes: notes || undefined })}>
                Marcar como não entregue
              </Button>
              <Button variant="outline" size="lg" onClick={() => setFailing(false)}>
                Voltar
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  )
}

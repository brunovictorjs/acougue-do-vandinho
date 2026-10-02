"use client"

import { CreditCardIcon, HandPlatterIcon, LandmarkIcon, MapPinIcon, RotateCcwIcon, SearchIcon, StoreIcon, TruckIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { PeriodFilter, withPeriod, type Period } from "@/components/admin/period-filter"
import { DeliveryStatusBadge, fulfilmentStatus, OrderStatusBadge } from "@/components/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { dateTime, initials, methodLabel, money, phone, qty } from "@/lib/format"
import type { OrderDetail, OrderSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

type List = { total: number; page: number; pageSize: number; counts: Record<string, number>; items: OrderSummary[] }

const FULFILLMENT = [
  { value: "all", label: "Entrega e retirada" },
  { value: "DELIVERY", label: "Só entrega" },
  { value: "PICKUP", label: "Só retirada" },
]
const METHOD = [
  { value: "all", label: "Todas as formas" },
  { value: "PIX", label: "Pix" },
  { value: "CREDIT_CARD", label: "Crédito" },
  { value: "DEBIT_CARD", label: "Débito" },
]

function OrderSheet({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { data: o, mutate } = useSWR<OrderDetail>(id ? `/admin/orders/${id}` : null)
  const { me } = useSession()
  const isAdmin = me?.role === "ADMIN"
  const [confirm, setConfirm] = React.useState(false)
  const [confirmPickup, setConfirmPickup] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  async function markPickedUp() {
    if (!o) return
    setBusy(true)
    try {
      await mutate(await api<OrderDetail>(`/admin/orders/${o.id}/picked-up`, { method: "POST" }), { revalidate: false })
      toast.success(`Pedido ${o.code} entregue ao cliente.`)
      setConfirmPickup(false)
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!o) return
    setBusy(true)
    try {
      await mutate(await api<OrderDetail>(`/admin/orders/${o.id}/cancel`, { body: { reason: reason || undefined } }), { revalidate: false })
      toast.success(`Pedido ${o.code} cancelado — reembolso iniciado.`)
      setConfirm(false)
      onChanged()
      setTimeout(() => void mutate(), 2500)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function retryRefund() {
    if (!o) return
    try {
      await api(`/payments/orders/${o.id}/refund/retry`, { method: "POST" })
      toast.success("Reembolso reenviado")
      void mutate()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-mono text-lg">#{o?.code ?? "…"}</SheetTitle>
          <SheetDescription>{o ? `Criado ${dateTime(o.createdAt)}` : "Carregando"}</SheetDescription>
        </SheetHeader>
        {!o ? (
          <Skeleton className="mx-4 h-80" />
        ) : (
          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="flex flex-col gap-4 pb-6 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <OrderStatusBadge status={o.status} />
                {o.status !== "CART" && <DeliveryStatusBadge status={fulfilmentStatus({ ...o, deliveryStatus: o.delivery?.status })} />}
              </div>
              {o.customer && (
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-secondary text-xs font-semibold text-gold-text">{initials(o.customer.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-semibold">{o.customer.name}</span>
                    <span className="text-muted-foreground">
                      {phone(o.customer.phone)} · {o.customer.email}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                {o.fulfillment === "PICKUP" ? <StoreIcon className="mt-0.5 size-4 text-gold-text" aria-hidden /> : <MapPinIcon className="mt-0.5 size-4 text-gold-text" aria-hidden />}
                <span>
                  {o.fulfillment === "PICKUP"
                    ? "Retirada na loja"
                    : `${o.address?.label} · ${o.address?.street}, ${o.address?.number}${o.address?.complement ? ` — ${o.address.complement}` : ""} · ${o.address?.neighborhood} · taxa ${money(o.deliveryFeeCents)}`}
                </span>
              </div>
              {o.delivery?.courierName && (
                <p className="text-muted-foreground">
                  Entregador: <b className="text-foreground">{o.delivery.courierName}</b>
                  {o.delivery.failureReason && ` · não entregue: ${o.delivery.failureReason}`}
                </p>
              )}
              <Separator />
              {o.items.map((i) => (
                <div key={i.id} className="flex justify-between gap-3">
                  <span>
                    <b>{i.productName}</b>
                    <span className="block text-xs text-muted-foreground">{[i.cutOption, qty(i.quantity, i.unit), i.notes].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span>{money(i.totalCents)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{money(o.subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrega</span>
                <span>{money(o.deliveryFeeCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pagamento</span>
                <span>
                  {o.paymentMethod ? methodLabel[o.paymentMethod] : "—"}
                  {o.payment && <span className="ml-1 font-mono text-xs text-muted-foreground">({o.payment.provider})</span>}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <b>Total</b>
                <span className="font-heading text-2xl font-semibold">{money(o.totalCents)}</span>
              </div>
              {o.refund && (
                <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <span className="flex items-center gap-2">
                    <RotateCcwIcon className="size-4" aria-hidden /> Reembolso {money(o.refund.amountCents)}
                  </span>
                  <span className={cn("font-semibold", o.refund.status === "SUCCEEDED" ? "text-success" : o.refund.status === "FAILED" ? "text-destructive" : "text-warning")}>
                    {o.refund.status === "SUCCEEDED" ? "Concluído" : o.refund.status === "FAILED" ? "Falhou" : "Em processamento"}
                  </span>
                </div>
              )}
              {o.refund?.status === "FAILED" && isAdmin && (
                <Button variant="outline" onClick={retryRefund}>
                  Tentar reembolso de novo
                </Button>
              )}
              <div className="flex flex-col gap-1 rounded-lg bg-muted p-3 text-xs">
                <span className="label-caps mb-1 text-muted-foreground">Histórico</span>
                {o.timeline
                  .filter((t) => t.done)
                  .map((t) => (
                    <span key={t.key}>
                      {dateTime(t.at)} · {t.label}
                    </span>
                  ))}
              </div>
              {o.canMarkPickedUp && (
                <Button size="lg" onClick={() => setConfirmPickup(true)}>
                  <HandPlatterIcon data-icon="inline-start" /> Marcar como entregue
                </Button>
              )}
              {o.canCancel && isAdmin && (
                <Button variant="destructive" size="lg" onClick={() => setConfirm(true)}>
                  <RotateCcwIcon data-icon="inline-start" /> Cancelar e reembolsar
                </Button>
              )}
            </div>
          </ScrollArea>
        )}
        <AlertDialog open={confirmPickup} onOpenChange={setConfirmPickup}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Entregar o pedido #{o?.code} ao cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                Confira o código do pedido com o cliente no balcão. <b className="text-foreground">Esta operação é irreversível:</b> depois de marcado como entregue, o pedido não pode mais ser cancelado nem reembolsado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction disabled={busy} onClick={markPickedUp}>
                Confirmar entrega
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar o pedido #{o?.code}?</AlertDialogTitle>
              <AlertDialogDescription>O cliente recebe {o && money(o.totalCents)} de volta pela forma de pagamento original e é avisado no WhatsApp.</AlertDialogDescription>
            </AlertDialogHeader>
            <Field>
              <FieldLabel htmlFor="cancel-reason">Motivo (aparece no histórico)</FieldLabel>
              <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: produto em falta" />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={busy} onClick={cancel}>
                Cancelar e reembolsar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}

export default function AdminOrdersPage() {
  const [status, setStatus] = React.useState("all")
  const [fulfillment, setFulfillment] = React.useState("all")
  const [method, setMethod] = React.useState("all")
  const [period, setPeriod] = React.useState<Period>({})
  const [search, setSearch] = React.useState("")
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<string | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const qs = new URLSearchParams({ page: String(page) })
  if (status !== "all") qs.set("status", status)
  if (fulfillment !== "all") qs.set("fulfillment", fulfillment)
  if (method !== "all") qs.set("paymentMethod", method)
  if (q) qs.set("search", q)
  withPeriod(qs, period)
  const { data, mutate } = useSWR<List>(`/admin/orders?${qs}`, { keepPreviousData: true, refreshInterval: 15000 })
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const count = (k: string) => (data?.counts[k] ?? 0).toLocaleString("pt-BR")
  const all = data ? Object.values(data.counts).reduce((s, n) => s + n, 0) : 0

  return (
    <AdminPage title="Pedidos" description="Compras, status e reembolsos">
      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(String(v))
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="all">Todos · {all.toLocaleString("pt-BR")}</TabsTrigger>
          <TabsTrigger value="CART">No carrinho · {count("CART")}</TabsTrigger>
          <TabsTrigger value="PAID">Pagos · {count("PAID")}</TabsTrigger>
          <TabsTrigger value="CANCELLED">Cancelados · {count("CANCELLED")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-2">
        <InputGroup className="w-full max-w-xs bg-card">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput aria-label="Buscar pedidos" placeholder="Código, cliente ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </InputGroup>
        <Select items={FULFILLMENT} value={fulfillment} onValueChange={(v) => v && (setFulfillment(v), setPage(1))}>
          <SelectTrigger className="min-w-44 bg-card" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {FULFILLMENT.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select items={METHOD} value={method} onValueChange={(v) => v && (setMethod(v), setPage(1))}>
          <SelectTrigger className="min-w-40 bg-card" aria-label="Forma de pagamento">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {METHOD.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <PeriodFilter
          value={period}
          onChange={(p) => {
            setPeriod(p)
            setPage(1)
          }}
        />
      </div>

      <Card className="py-0">
        {!data ? (
          <Skeleton className="h-96" />
        ) : data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhum pedido encontrado</EmptyTitle>
              <EmptyDescription>Ajuste os filtros ou a busca.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo · pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((o) => (
                <TableRow key={o.id} data-state={selected === o.id ? "selected" : undefined} className="cursor-pointer" onClick={() => setSelected(o.id)}>
                  <TableCell className="pl-4">
                    <button type="button" className="flex flex-col text-left" onClick={() => setSelected(o.id)}>
                      <span className="font-mono text-xs font-semibold">{o.code}</span>
                      <span className="text-xs text-muted-foreground">{dateTime(o.createdAt)}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-col">
                      <span>{o.customerName}</span>
                      <span className="text-xs text-muted-foreground">{phone(o.customerPhone)}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-col gap-0.5 text-xs">
                      <span className="flex items-center gap-1.5">
                        {o.fulfillment === "DELIVERY" ? <TruckIcon className="size-3.5" aria-hidden /> : <StoreIcon className="size-3.5" aria-hidden />}
                        {o.fulfillment === "DELIVERY" ? "Entrega" : "Retirada"}
                      </span>
                      {o.paymentMethod && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          {o.paymentMethod === "PIX" ? <LandmarkIcon className="size-3.5" aria-hidden /> : <CreditCardIcon className="size-3.5" aria-hidden />}
                          {methodLabel[o.paymentMethod]}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <OrderStatusBadge status={o.status} />
                      {o.status === "PAID" && <DeliveryStatusBadge status={fulfilmentStatus(o)} />}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4 text-right font-semibold">{money(o.totalCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {pages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" text="Anterior" onClick={(e) => (e.preventDefault(), setPage((p) => Math.max(1, p - 1)))} aria-disabled={page === 1} />
            </PaginationItem>
            <PaginationItem className="px-3 text-sm text-muted-foreground">
              Página {page} de {pages}
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" text="Próxima" onClick={(e) => (e.preventDefault(), setPage((p) => Math.min(pages, p + 1)))} aria-disabled={page === pages} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      <OrderSheet id={selected} onClose={() => setSelected(null)} onChanged={() => void mutate()} />
    </AdminPage>
  )
}

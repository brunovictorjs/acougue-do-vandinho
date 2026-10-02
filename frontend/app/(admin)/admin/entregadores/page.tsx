"use client"

import { BanknoteIcon, CheckCheckIcon, ChevronRightIcon, ClockIcon, InfoIcon, TruckIcon, WalletIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import useSWR, { useSWRConfig } from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { PeriodFilter, periodLabel, withPeriod, type Period } from "@/components/admin/period-filter"
import { ListPagination } from "@/components/list-pagination"
import { PayoutBadge } from "@/components/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, errorMessage } from "@/lib/api"
import { dateTime, initials, money, phone, shortDate } from "@/lib/format"
import type { CourierDeliveries, CourierPayouts, PayoutLine } from "@/lib/types"
import { cn } from "@/lib/utils"

type Courier = CourierPayouts["couriers"][number]

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Loaded when the row opens: one page of the courier's deliveries in the period. */
function CourierDetail({ courier, period, selected, onSelect, onPay }: { courier: Courier; period: Period; selected: string[]; onSelect: (ids: string[]) => void; onPay: (items: PayoutLine[]) => void }) {
  const [page, setPage] = React.useState(1)
  const qs = withPeriod(new URLSearchParams({ page: String(page) }), period)
  const { data } = useSWR<CourierDeliveries>(`/admin/couriers/payouts/${courier.id}?${qs}`, { keepPreviousData: true })
  const items = data?.items ?? []
  const pendingHere = items.filter((i) => !i.courierPaidAt)
  const allHere = pendingHere.length > 0 && pendingHere.every((i) => selected.includes(i.id))
  const someHere = pendingHere.some((i) => selected.includes(i.id)) && !allHere
  const chosen = data?.pending.filter((i) => selected.includes(i.id)) ?? []
  const chosenCents = chosen.reduce((s, i) => s + i.feeCents, 0)
  const pendingCents = data?.pending.reduce((s, i) => s + i.feeCents, 0) ?? 0
  const toggle = (id: string, on: boolean) => onSelect(on ? [...selected, id] : selected.filter((s) => s !== id))
  const toggleHere = (on: boolean) => {
    const here = pendingHere.map((i) => i.id)
    onSelect(on ? [...new Set([...selected, ...here])] : selected.filter((id) => !here.includes(id)))
  }

  return (
    <div className="flex flex-col gap-3 bg-muted/40 px-4 py-4 md:pl-14">
      {courier.pendingOutsideCents > 0 && (
        <p className="flex items-center gap-2 text-xs text-orange">
          <ClockIcon className="size-3.5" aria-hidden />
          Fora deste período há mais {money(courier.pendingOutsideCents)} a pagar ({plural(courier.pendingOutsideCount, "entrega", "entregas")}). Amplie o período para vê-las.
        </p>
      )}
      {!data ? (
        <Skeleton className="h-40" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma entrega concluída neste período.</p>
      ) : (
        <Table className="rounded-lg bg-card">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-3">
                <Checkbox
                  aria-label="Selecionar as entregas aguardando pagamento desta página"
                  checked={allHere}
                  indeterminate={someHere}
                  disabled={pendingHere.length === 0}
                  onCheckedChange={(on) => toggleHere(on)}
                />
              </TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente · bairro</TableHead>
              <TableHead>Entregue</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="pr-3 text-right">Taxa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => {
              const paid = !!i.courierPaidAt
              const checked = selected.includes(i.id)
              return (
                <TableRow key={i.id} data-state={checked ? "selected" : undefined} className={cn(!paid && "cursor-pointer")} onClick={() => !paid && toggle(i.id, !checked)}>
                  <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label={`Selecionar entrega ${i.orderCode}`} checked={checked} disabled={paid} onCheckedChange={(on) => toggle(i.id, on)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold">#{i.orderCode}</TableCell>
                  <TableCell>
                    {i.customerFirstName}
                    <span className="text-muted-foreground"> · {i.neighborhood}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dateTime(i.deliveredAt)}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <PayoutBadge paid={paid} />
                      {paid && <span className="text-xs text-muted-foreground">em {shortDate(i.courierPaidAt)}</span>}
                    </span>
                  </TableCell>
                  <TableCell className="pr-3 text-right font-semibold">{money(i.feeCents)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      {data && <ListPagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      {!!data?.pending.length && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {chosen.length < data.pending.length && data.pending.length > pendingHere.length && (
            <Button variant="link" className="mr-auto px-0" onClick={() => onSelect(data.pending.map((i) => i.id))}>
              Selecionar todas as {data.pending.length} a pagar do período ({money(pendingCents)})
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {chosen.length ? (
              <>
                {plural(chosen.length, "entrega selecionada", "entregas selecionadas")} · <b className="text-foreground">{money(chosenCents)}</b>
              </>
            ) : (
              "Selecione as entregas que você pagou"
            )}
          </span>
          <Button disabled={!chosen.length} onClick={() => onPay(chosen)}>
            <CheckCheckIcon data-icon="inline-start" /> Marcar como pago
          </Button>
        </div>
      )}
    </div>
  )
}

export default function AdminCouriersPage() {
  const [period, setPeriod] = React.useState<Period>({})
  const [filter, setFilter] = React.useState<"all" | "pending">("all")
  const [open, setOpen] = React.useState<string[]>([])
  const [selected, setSelected] = React.useState<Record<string, string[]>>({})
  /** Snapshot of what is being paid, kept while the dialog animates closed. */
  const [confirming, setConfirming] = React.useState<{ courier: Courier; items: PayoutLine[] } | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const qs = withPeriod(new URLSearchParams(), period)
  const { data, mutate } = useSWR<CourierPayouts>(`/admin/couriers/payouts?${qs}`, { keepPreviousData: true })
  const { mutate: refresh } = useSWRConfig()
  const couriers = data?.couriers.filter((c) => (filter === "pending" ? c.pendingCents > 0 : c.deliveries > 0 || c.active)) ?? []

  const toggleOpen = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  const toPay = confirming?.items ?? []
  const toPayCents = toPay.reduce((s, i) => s + i.feeCents, 0)

  async function pay() {
    if (!confirming) return
    setBusy(true)
    try {
      const { courier } = confirming
      await api(`/admin/couriers/payouts/${courier.id}`, { body: { deliveryIds: toPay.map((i) => i.id) } })
      toast.success(`${money(toPayCents)} marcados como pagos para ${courier.name}.`)
      setSelected((s) => ({ ...s, [courier.id]: [] }))
      setConfirmOpen(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
      void mutate()
      // reload the open accordions too (their deliveries live under the same path)
      void refresh((key) => typeof key === "string" && key.startsWith(`/admin/couriers/payouts/${confirming.courier.id}?`))
    }
  }

  const kpis = data
    ? [
        { label: "Entregas concluídas", value: String(data.totals.deliveries), icon: TruckIcon },
        { label: "Taxas no período", value: money(data.totals.earnedCents), icon: WalletIcon },
        { label: "Já pago", value: money(data.totals.paidCents), icon: CheckCheckIcon },
        { label: "A pagar", value: money(data.totals.pendingCents), icon: BanknoteIcon, highlight: data.totals.pendingCents > 0 },
      ]
    : null

  return (
    <AdminPage
      title="Entregadores"
      description={`Entregas concluídas e taxas a pagar · ${periodLabel(period) ?? "este mês"}`}
      actions={
        <>
          <ToggleGroup variant="chip" size="none" value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as "all" | "pending")} aria-label="Filtrar entregadores">
            <ToggleGroupItem value="all">Todos</ToggleGroupItem>
            <ToggleGroupItem value="pending">Com taxa a pagar</ToggleGroupItem>
          </ToggleGroup>
          <PeriodFilter
            value={period}
            onChange={(p) => {
              setPeriod(p)
              setSelected({})
            }}
          />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis
          ? kpis.map(({ label, value, icon: Icon, highlight }) => (
              <Card key={label} className={cn(highlight && "ring-brand-gold-dark")}>
                <CardHeader>
                  <CardDescription className="label-caps">{label}</CardDescription>
                  <CardAction>
                    <Icon className="size-4 text-gold-text" aria-hidden />
                  </CardAction>
                  <CardTitle className={cn("font-heading text-3xl font-semibold", highlight && "text-gold-text")}>{value}</CardTitle>
                </CardHeader>
              </Card>
            ))
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>

      <Card className="py-0">
        {!data ? (
          <Skeleton className="h-96" />
        ) : couriers.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{filter === "pending" ? "Nenhuma taxa a pagar" : "Nenhum entregador"}</EmptyTitle>
              <EmptyDescription>{filter === "pending" ? "Todas as entregas deste período já foram pagas." : "Dê o papel “Entregador” a alguém em Usuários e papéis."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4" />
                <TableHead>Entregador</TableHead>
                <TableHead>Entregas</TableHead>
                <TableHead className="text-right">Taxas</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="pr-4 text-right">A pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {couriers.map((c) => {
                const expanded = open.includes(c.id)
                return (
                  <React.Fragment key={c.id}>
                    <TableRow data-state={expanded ? "selected" : undefined} className="cursor-pointer" onClick={() => toggleOpen(c.id)}>
                      <TableCell className="pl-4">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={`courier-${c.id}`}
                          aria-label={`${expanded ? "Fechar" : "Abrir"} entregas de ${c.name}`}
                          className="flex size-6 items-center justify-center rounded-md hover:bg-muted"
                          onClick={(e) => (e.stopPropagation(), toggleOpen(c.id))}
                        >
                          <ChevronRightIcon className={cn("size-4 transition-transform", expanded && "rotate-90")} aria-hidden />
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Avatar className="size-8">
                            {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt="" />}
                            <AvatarFallback className="bg-secondary text-xs text-gold-text">{initials(c.name)}</AvatarFallback>
                          </Avatar>
                          <span className="flex flex-col">
                            <span className="flex items-center gap-1.5 font-semibold">
                              {c.name}
                              {!c.active && <Badge variant="secondary">Ex-entregador</Badge>}
                            </span>
                            <span className="text-xs text-muted-foreground">{phone(c.phone)}</span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>{plural(c.deliveries, "entrega", "entregas")}</TableCell>
                      <TableCell className="text-right">{money(c.earnedCents)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{money(c.paidCents)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <span className={cn("font-semibold", c.pendingCents > 0 ? "text-gold-text" : "text-muted-foreground")}>{money(c.pendingCents)}</span>
                        {c.pendingOutsideCents > 0 && <span className="block text-xs text-orange">+ {money(c.pendingOutsideCents)} fora do período</span>}
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow id={`courier-${c.id}`} className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0 whitespace-normal">
                          <CourierDetail
                            key={qs.toString()}
                            courier={c}
                            period={period}
                            selected={selected[c.id] ?? []}
                            onSelect={(ids) => setSelected((s) => ({ ...s, [c.id]: ids }))}
                            onPay={(items) => {
                              setConfirming({ courier: c, items })
                              setConfirmOpen(true)
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Alert>
        <InfoIcon />
        <AlertDescription>
          Cada entrega concluída rende ao entregador a taxa de entrega cobrada no pedido. Marcar como pago é só um controle seu — nenhum dinheiro é transferido pelo sistema.
        </AlertDescription>
      </Alert>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Marcar {plural(toPay.length, "entrega", "entregas")} de {confirming?.courier.name} como paga{toPay.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Total de <b className="text-foreground">{money(toPayCents)}</b> em taxas. <b className="text-foreground">Esta operação é irreversível:</b> depois de confirmada, não
              será possível voltar estas entregas para “Aguardando pagamento”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg bg-muted p-3 text-sm">
            {toPay.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  <span className="font-mono text-xs font-semibold">#{i.orderCode}</span>
                  <span className="text-muted-foreground"> · {i.neighborhood}</span>
                </span>
                <span>{money(i.feeCents)}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={pay}>
              Confirmar pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  )
}

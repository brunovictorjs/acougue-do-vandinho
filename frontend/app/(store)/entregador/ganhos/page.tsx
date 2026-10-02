"use client"

import { ArrowLeftIcon, BanknoteIcon, CheckCheckIcon, ClockIcon, MapPinIcon, TruckIcon, WalletIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import useSWR from "swr"
import { PeriodFilter, type Period } from "@/components/admin/period-filter"
import { PayoutBadge } from "@/components/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { dateTime, money, shortDate } from "@/lib/format"
import type { CourierEarnings } from "@/lib/types"
import { cn } from "@/lib/utils"

const RANGES = { today: "Hoje", "7d": "7 dias", month: "Este mês" } as const
type Range = keyof typeof RANGES

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function rangeParams(r: Range | Period) {
  if (typeof r === "object") return `from=${r.from}&to=${r.to}`
  const to = new Date()
  const from = new Date()
  if (r === "7d") from.setDate(to.getDate() - 6)
  else if (r === "month") from.setDate(1)
  return `from=${day(from)}&to=${day(to)}`
}

const PAGE_SIZE = 10

const chartConfig = { amount: { label: "Ganhos", color: "#B77A00" } } satisfies ChartConfig

function Change({ value }: { value: number | null }) {
  if (value == null) return <span>sem comparação</span>
  const pct = `${value >= 0 ? "+" : ""}${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
  return (
    <span>
      <b className={value >= 0 ? "text-success" : "text-destructive"}>{pct}</b> vs. período anterior
    </span>
  )
}

export default function CourierEarningsPage() {
  const [range, setRange] = React.useState<Range | Period>("month")
  const [show, setShow] = React.useState<"all" | "pending" | "paid">("all")
  const [page, setPage] = React.useState(1)
  const { data } = useSWR<CourierEarnings>(`/courier/earnings?${rangeParams(range)}`, { keepPreviousData: true })
  const k = data?.kpis
  const items = data?.items.filter((i) => (show === "all" ? true : show === "paid" ? !!i.courierPaidAt : !i.courierPaidAt))
  const pages = Math.max(1, Math.ceil((items?.length ?? 0) / PAGE_SIZE))
  const current = Math.min(page, pages)
  const pageItems = items?.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const changeRange = (r: Range | Period) => {
    setRange(r)
    setPage(1)
  }
  const topHood = data?.byNeighborhood[0]?.amountCents ?? 0

  const kpis = k
    ? [
        { label: "Ganhos", value: money(k.earnedCents), icon: WalletIcon, note: <Change value={k.earnedChange} /> },
        { label: "Entregas", value: String(k.deliveries), icon: TruckIcon, note: <Change value={k.deliveriesChange} /> },
        { label: "Recebido", value: money(k.receivedCents), icon: CheckCheckIcon, note: "já pago pela loja" },
        { label: "A receber", value: money(k.pendingCents), icon: BanknoteIcon, note: `média ${money(k.averageFeeCents)} por entrega`, highlight: k.pendingCents > 0 },
      ]
    : null

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-10">
      <header className="flex items-center gap-3">
        <Link href="/entregador" aria-label="Voltar para as entregas" className={buttonVariants({ variant: "outline", size: "icon-lg" })}>
          <ArrowLeftIcon />
        </Link>
        <div className="flex flex-col">
          <h1 className="font-display text-3xl">Meus ganhos</h1>
          <span className="text-sm text-muted-foreground">Taxas das entregas concluídas</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup variant="chip" size="none" value={typeof range === "string" ? [range] : []} onValueChange={(v) => v[0] && changeRange(v[0] as Range)} aria-label="Período">
          {Object.entries(RANGES).map(([key, label]) => (
            <ToggleGroupItem key={key} value={key}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <PeriodFilter requireBoth value={typeof range === "object" ? range : {}} onChange={(p) => changeRange(p.from && p.to ? p : "month")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {kpis
          ? kpis.map(({ label, value, icon: Icon, note, highlight }) => (
              <Card key={label} size="sm" className={cn(highlight && "ring-brand-gold-dark")}>
                <CardHeader>
                  <CardDescription className="label-caps">{label}</CardDescription>
                  <CardAction>
                    <Icon className="size-4 text-gold-text" aria-hidden />
                  </CardAction>
                  <CardTitle className={cn("font-heading text-2xl font-semibold", highlight && "text-gold-text")}>{value}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">{note}</CardContent>
              </Card>
            ))
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>

      {!!k?.pendingOutsideCents && (
        <Alert>
          <ClockIcon />
          <AlertDescription>
            Fora deste período você ainda tem {money(k.pendingOutsideCents)} a receber ({k.pendingOutsideCount} {k.pendingOutsideCount === 1 ? "entrega" : "entregas"}).
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="label-caps text-sm">Ganhos por dia</CardTitle>
          <CardDescription>Toque nas barras para ver o valor</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
              <BarChart data={data.daily.map((d) => ({ ...d, amount: d.amountCents / 100, label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7) }))} margin={{ left: 0, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent formatter={(v) => money(Number(v) * 100)} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <Skeleton className="h-48" />
          )}
        </CardContent>
      </Card>

      {!!data?.byNeighborhood.length && (
        <Card>
          <CardHeader>
            <CardTitle className="label-caps text-sm">Bairros que mais renderam</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {data.byNeighborhood.map((h) => (
              <div key={h.neighborhood} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    <MapPinIcon className="size-4 text-gold-text" aria-hidden />
                    {h.neighborhood}
                  </span>
                  <span>{money(h.amountCents)}</span>
                </div>
                <Progress value={topHood ? (h.amountCents / topHood) * 100 : 0} aria-label={`${h.neighborhood}: ${money(h.amountCents)}`} />
                <span className="text-xs text-muted-foreground">
                  {h.deliveries} {h.deliveries === 1 ? "entrega" : "entregas"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3" aria-label="Entregas do período">
        <ToggleGroup variant="segment" size="none" className="w-full rounded-lg border bg-muted p-1" value={[show]} onValueChange={(v) => {
            if (!v[0]) return
            setShow(v[0] as typeof show)
            setPage(1)
          }}>
          <ToggleGroupItem value="all">Todas</ToggleGroupItem>
          <ToggleGroupItem value="pending">A receber</ToggleGroupItem>
          <ToggleGroupItem value="paid">Recebidas</ToggleGroupItem>
        </ToggleGroup>
        {!items ? (
          <Skeleton className="h-40" />
        ) : items.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Nenhuma entrega aqui</EmptyTitle>
              <EmptyDescription>Só entregas concluídas no período aparecem nesta lista.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {pageItems?.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-mono text-xs font-semibold">#{i.orderCode}</span>
                  <span className="truncate text-sm">
                    {i.customerFirstName} · {i.neighborhood}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Entregue {dateTime(i.deliveredAt)}
                    {i.courierPaidAt && ` · pago em ${shortDate(i.courierPaidAt)}`}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold">{money(i.feeCents)}</span>
                  <PayoutBadge courier paid={!!i.courierPaidAt} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" text="Anterior" onClick={(e) => (e.preventDefault(), setPage(Math.max(1, current - 1)))} aria-disabled={current === 1} />
              </PaginationItem>
              <PaginationItem className="px-2 text-sm text-muted-foreground">
                {current} de {pages}
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" text="Próxima" onClick={(e) => (e.preventDefault(), setPage(Math.min(pages, current + 1)))} aria-disabled={current === pages} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </section>
    </main>
  )
}

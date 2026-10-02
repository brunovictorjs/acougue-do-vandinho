"use client"

import { DownloadIcon, LandmarkIcon, CreditCardIcon, ReceiptTextIcon, RotateCcwIcon, TagIcon, WalletIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { PeriodFilter, type Period } from "@/components/admin/period-filter"
import { DeliveryStatusBadge, fulfilmentStatus, OrderStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "@/lib/api"
import { methodLabel, money, qty } from "@/lib/format"
import type { DeliveryStatus, Fulfillment, OrderStatus, PaymentMethod, Unit } from "@/lib/types"

interface Dashboard {
  period: { from: string; to: string }
  kpis: { grossCents: number; grossChange: number | null; paidOrders: number; paidOrdersChange: number | null; averageTicketCents: number; refundedCents: number; refundCount: number }
  closing: { grossCents: number; deliveryFeesCents: number; productsCents: number; refundedCents: number; netCents: number }
  byMethod: Array<{ method: PaymentMethod; amountCents: number; share: number; count: number }>
  daily: Array<{ date: string; amountCents: number; orders: number }>
  topProducts: Array<{ productId: string; name: string; unit: Unit; quantity: number; amountCents: number }>
  deliveries: Partial<Record<DeliveryStatus, number>>
  recentOrders: Array<{ id: string; code: string; customerName: string; status: OrderStatus; deliveryStatus: DeliveryStatus | null; fulfillment: Fulfillment; pickedUpAt: string | null; totalCents: number; createdAt: string }>
}

const RANGES = { "7d": "7 dias", month: "Este mês", "90d": "90 dias" } as const
type Range = keyof typeof RANGES

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function rangeParams(r: Range | Period) {
  if (typeof r === "object") return `from=${r.from}&to=${r.to}`
  const to = new Date()
  const from = new Date()
  if (r === "7d") from.setDate(to.getDate() - 6)
  else if (r === "90d") from.setDate(to.getDate() - 89)
  else from.setDate(1)
  return `from=${day(from)}&to=${day(to)}`
}

const chartConfig = { amount: { label: "Receita", color: "#B77A00" } } satisfies ChartConfig

function Change({ value }: { value: number | null }) {
  if (value == null) return <span>sem comparação</span>
  const pct = `${value >= 0 ? "+" : ""}${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
  return (
    <span>
      <b className={value >= 0 ? "text-success" : "text-destructive"}>{pct}</b> vs. período anterior
    </span>
  )
}

export default function DashboardPage() {
  const [range, setRange] = React.useState<Range | Period>("month")
  const params = rangeParams(range)
  const { data } = useSWR<Dashboard>(`/admin/finance/dashboard?${params}`, { keepPreviousData: true })

  async function exportCsv() {
    const { filename, csv } = await api<{ filename: string; csv: string }>(`/admin/finance/export?${params}`)
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }))
    const a = Object.assign(document.createElement("a"), { href: url, download: filename })
    a.click()
    URL.revokeObjectURL(url)
  }

  const kpis = data
    ? [
        { label: "Receita bruta", value: money(data.kpis.grossCents), icon: WalletIcon, note: <Change value={data.kpis.grossChange} /> },
        { label: "Pedidos pagos", value: String(data.kpis.paidOrders), icon: ReceiptTextIcon, note: <Change value={data.kpis.paidOrdersChange} /> },
        { label: "Ticket médio", value: money(data.kpis.averageTicketCents), icon: TagIcon, note: "por pedido pago" },
        { label: "Reembolsos", value: money(data.kpis.refundedCents), icon: RotateCcwIcon, note: `${data.kpis.refundCount} pedidos cancelados` },
      ]
    : null

  return (
    <AdminPage
      title="Visão geral"
      description="Vendas, finanças e operação do período"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup variant="chip" size="none" value={typeof range === "string" ? [range] : []} onValueChange={(v) => v[0] && setRange(v[0] as Range)} aria-label="Período">
            {Object.entries(RANGES).map(([k, l]) => (
              <ToggleGroupItem key={k} value={k}>
                {l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <PeriodFilter requireBoth value={typeof range === "object" ? range : {}} onChange={(p) => setRange(p.from && p.to ? p : "month")} />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis
          ? kpis.map(({ label, value, icon: Icon, note }) => (
              <Card key={label}>
                <CardHeader>
                  <CardDescription className="label-caps">{label}</CardDescription>
                  <CardAction>
                    <Icon className="size-4 text-gold-text" aria-hidden />
                  </CardAction>
                  <CardTitle className="font-heading text-3xl font-semibold">{value}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">{note}</CardContent>
              </Card>
            ))
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="label-caps text-sm">Receita diária</CardTitle>
            <CardDescription>Pedidos pagos por dia (passe o mouse nas barras)</CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart data={data.daily.map((d) => ({ ...d, amount: d.amountCents / 100, label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7) }))} margin={{ left: 4, right: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR")} mil` : String(v))} />
                  <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent formatter={(v) => money(Number(v) * 100)} />} />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <Skeleton className="h-64" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="label-caps text-sm">Por forma de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {data?.byMethod.map((m) => (
              <div key={m.method} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    {m.method === "PIX" ? <LandmarkIcon className="size-4" aria-hidden /> : <CreditCardIcon className="size-4" aria-hidden />}
                    {methodLabel[m.method]}
                  </span>
                  <span>{money(m.amountCents)}</span>
                </div>
                <Progress value={m.share * 100} aria-label={`${methodLabel[m.method]}: ${Math.round(m.share * 100)}% da receita`} />
                <span className="text-xs text-muted-foreground">
                  {Math.round(m.share * 100)}% da receita · {m.count} pedidos
                </span>
              </div>
            )) ?? <Skeleton className="h-40" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="label-caps text-sm">Pedidos recentes</CardTitle>
            <CardAction>
              <Link href="/admin/pedidos" className="text-sm font-semibold text-gold-text hover:underline">
                Ver todos
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.code}</TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <OrderStatusBadge status={o.status} />
                        {o.status !== "CART" && <DeliveryStatusBadge status={fulfilmentStatus(o)} />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{money(o.totalCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="label-caps text-sm">Fechamento do período</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {data && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produtos</span>
                  <span className="font-semibold">{money(data.closing.productsCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxas de entrega</span>
                  <span className="font-semibold">{money(data.closing.deliveryFeesCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receita bruta</span>
                  <span className="font-semibold">{money(data.closing.grossCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reembolsos</span>
                  <span className="font-semibold text-destructive">− {money(data.closing.refundedCents)}</span>
                </div>
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="label-caps">Líquido</span>
                  <span className="font-heading text-2xl font-semibold">{money(data.closing.netCents)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Taxas do Stripe não estão descontadas — confira o extrato no Dashboard do Stripe.</p>
                <Button variant="outline" onClick={() => void exportCsv()}>
                  <DownloadIcon data-icon="inline-start" /> Exportar CSV
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="label-caps text-sm">Mais vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3">
              {data?.topProducts.map((t, i) => (
                <li key={t.productId} className="flex items-center gap-3 text-sm">
                  <span className="w-4 font-heading font-semibold text-gold-text">{i + 1}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{qty(t.quantity, t.unit)}</span>
                  </span>
                  <span className="font-semibold">{money(t.amountCents)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(["AWAITING", "IN_TRANSIT", "DELIVERED", "NOT_DELIVERED"] as const).map((s) => (
          <Link key={s} href="/admin/entregas" className="flex items-center justify-between rounded-xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-brand-gold">
            <DeliveryStatusBadge status={s} />
            <span className="font-heading text-2xl font-semibold">{data?.deliveries[s] ?? 0}</span>
          </Link>
        ))}
      </div>
    </AdminPage>
  )
}

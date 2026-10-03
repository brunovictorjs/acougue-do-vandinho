"use client"

import { InfoIcon, MapPinIcon, RotateCcwIcon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { DeliveryStatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage } from "@/lib/api"
import { dateTime, initials, money, phone } from "@/lib/format"
import type { DeliveryStatus, DeliveryView } from "@/lib/types"

type Board = {
  columns: Record<DeliveryStatus, DeliveryView[]>
  couriers: Array<{ id: string; name: string; phone: string | null; inTransit: boolean; deliveredToday: number; feesToday: number }>
}

const COLUMNS: DeliveryStatus[] = ["AWAITING", "IN_TRANSIT", "DELIVERED", "NOT_DELIVERED", "CANCELLED"]

export default function AdminDeliveriesPage() {
  const { data, mutate } = useSWR<Board>("/admin/deliveries", { refreshInterval: 10000 })

  async function reschedule(d: DeliveryView) {
    try {
      await api(`/admin/deliveries/${d.id}/reschedule`, { method: "POST" })
      toast.success(`Entrega ${d.orderCode} voltou para a fila.`)
      void mutate()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <AdminPage title="Entregas" description="Fila em tempo real · concluídas e canceladas mostram só as de hoje">
      {!data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {COLUMNS.map((status) => (
              <section key={status} className="flex min-w-0 flex-col gap-3" aria-label={status}>
                <div className="flex items-center justify-between">
                  <DeliveryStatusBadge status={status} />
                  <span className="text-sm text-muted-foreground">{data.columns[status].length}</span>
                </div>
                {data.columns[status].length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Nenhuma</p>}
                {data.columns[status].map((d) => (
                  <Card key={d.id} size="sm">
                    <CardHeader>
                      <CardTitle className="font-mono text-xs">#{d.orderCode}</CardTitle>
                      <CardAction className="text-sm font-semibold">{money(d.feeCents)}</CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1.5 text-sm">
                      <span className="font-semibold">{d.customerName}</span>
                      <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPinIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {d.addressLine} · {d.neighborhood}
                      </span>
                      {d.courierName && <span className="text-xs">Entregador: {d.courierName}</span>}
                      {d.deliveryCode && (status === "AWAITING" || status === "IN_TRANSIT" || status === "NOT_DELIVERED") && (
                        <span className="text-xs text-muted-foreground">
                          Código de entrega: <span className="font-mono tracking-wider text-gold-text">{d.deliveryCode}</span>
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {status === "IN_TRANSIT" && `Saiu ${dateTime(d.startedAt)}`}
                        {status === "DELIVERED" && `Entregue ${dateTime(d.deliveredAt)}`}
                        {status === "AWAITING" && `Pago ${dateTime(d.createdAt)}`}
                        {status === "CANCELLED" && `Cancelado ${dateTime(d.cancelledAt)}`}
                      </span>
                      {status === "NOT_DELIVERED" && (
                        <>
                          <span className="text-xs font-semibold text-orange">
                            {d.failureReason}
                            {d.failureNotes ? ` · ${d.failureNotes}` : ""}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => reschedule(d)}>
                              <RotateCcwIcon data-icon="inline-start" /> Reagendar
                            </Button>
                            <Link href="/admin/pedidos" className="self-center text-xs font-semibold text-gold-text hover:underline">
                              Cancelar no pedido
                            </Link>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </section>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="label-caps text-sm">Entregadores</CardTitle>
                <CardAction className="flex gap-4">
                  <Link href="/admin/entregadores" className="text-sm font-semibold text-gold-text hover:underline">
                    Taxas a pagar
                  </Link>
                  <Link href="/admin/usuarios?papel=COURIER" className="text-sm font-semibold text-gold-text hover:underline">
                    Gerenciar
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hoje</TableHead>
                      <TableHead className="text-right">Taxas hoje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.couriers.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <Avatar className="size-8">
                              <AvatarFallback className="bg-secondary text-xs text-gold-text">{initials(c.name)}</AvatarFallback>
                            </Avatar>
                            <span className="flex flex-col">
                              {c.name}
                              <span className="text-xs text-muted-foreground">{phone(c.phone)}</span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>{c.inTransit ? <Badge className="bg-info/15 text-info">Em rota</Badge> : <Badge variant="secondary">Livre</Badge>}</TableCell>
                        <TableCell>{c.deliveredToday} {c.deliveredToday === 1 ? "entrega" : "entregas"}</TableCell>
                        <TableCell className="text-right">{money(c.feesToday)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Alert>
              <InfoIcon />
              <AlertDescription>
                Entregador é um usuário com o papel “Entregador”: a pessoa entra uma vez com Google e você troca o papel em Usuários e papéis. Taxas por bairro ficam em Configurações › Entrega.
              </AlertDescription>
            </Alert>
          </div>
        </>
      )}
    </AdminPage>
  )
}

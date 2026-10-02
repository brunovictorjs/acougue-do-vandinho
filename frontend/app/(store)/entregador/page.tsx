"use client"

import { InfoIcon, LogOutIcon, MapIcon, NavigationIcon, PackageIcon, RouteIcon, WalletIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { DeliveryStatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { logout, useSession } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { dateTime, distance, initials, money } from "@/lib/format"
import type { DeliveryView } from "@/lib/types"

type Board = { available: DeliveryView[]; mine: DeliveryView[] }

export default function CourierHomePage() {
  const router = useRouter()
  const { me } = useSession()
  const { data, mutate } = useSWR<Board>("/courier/deliveries", { refreshInterval: 10000 })
  const [tab, setTab] = React.useState("available")
  const [starting, setStarting] = React.useState<string | null>(null)
  const active = data?.mine.find((d) => d.status === "IN_TRANSIT")

  async function start(d: DeliveryView) {
    setStarting(d.id)
    try {
      await api(`/courier/deliveries/${d.id}/start`, { method: "POST" })
      router.push(`/entregador/${d.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
      void mutate()
      setStarting(null)
    }
  }

  const list = tab === "available" ? data?.available : data?.mine

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-10">
      <header className="flex items-center gap-3">
        <Avatar className="size-12 border-2 border-brand-gold">
          <AvatarFallback className="font-bold text-gold-text">{initials(`${me?.firstName} ${me?.lastName}`)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col">
          <span className="text-lg font-semibold">Olá, {me?.firstName}</span>
          <span className="text-sm text-muted-foreground">Entregador · Açougue do Vandinho</span>
        </div>
        <Link href="/entregador/ganhos" aria-label="Meus ganhos" className={buttonVariants({ variant: "outline", size: "icon-lg" })}>
          <WalletIcon />
        </Link>
        <Button variant="outline" size="icon-lg" aria-label="Sair" onClick={() => void logout()}>
          <LogOutIcon />
        </Button>
      </header>

      {active && (
        <Link href={`/entregador/${active.id}`} className="flex flex-col gap-2 rounded-xl border border-brand-gold-dark bg-[#0b0b0b] p-4">
          <div className="flex items-center justify-between">
            <span className="label-caps text-gold-text">Em andamento</span>
            <DeliveryStatusBadge status="IN_TRANSIT" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-1 flex-col">
              <span className="text-lg font-semibold">
                {active.customerFirstName} · #{active.orderCode}
              </span>
              <span className="text-sm text-muted-foreground">
                {active.addressLine} · {active.neighborhood}
              </span>
            </div>
            <span className={buttonVariants({ size: "icon-lg" })}>
              <NavigationIcon />
            </span>
          </div>
        </Link>
      )}

      <ToggleGroup variant="segment" size="none" className="w-full rounded-lg border bg-muted p-1" value={[tab]} onValueChange={(v) => v[0] && setTab(v[0])}>
        <ToggleGroupItem value="available">Disponíveis · {data?.available.length ?? 0}</ToggleGroupItem>
        <ToggleGroupItem value="mine">Minhas · {data?.mine.length ?? 0}</ToggleGroupItem>
      </ToggleGroup>
      <Alert>
        <InfoIcon />
        <AlertDescription>Pedidos entregues ou cancelados saem da lista automaticamente.</AlertDescription>
      </Alert>

      {!list ? (
        <Skeleton className="h-48" />
      ) : list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageIcon />
            </EmptyMedia>
            <EmptyTitle>{tab === "available" ? "Nenhuma entrega aguardando" : "Nenhuma entrega com você"}</EmptyTitle>
            <EmptyDescription>A lista atualiza sozinha a cada 10 segundos.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((d) => (
            <li key={d.id}>
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="font-mono text-sm">#{d.orderCode}</CardTitle>
                  <DeliveryStatusBadge status={d.status} />
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold">{d.customerFirstName}</span>
                    <span className="text-sm text-muted-foreground">{d.addressLine}</span>
                    <span className="text-sm text-muted-foreground">{d.neighborhood}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {d.distanceMeters != null && (
                      <span className="flex items-center gap-1.5">
                        <RouteIcon className="size-4 text-gold-text" aria-hidden /> {distance(d.distanceMeters)}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <PackageIcon className="size-4 text-gold-text" aria-hidden /> {d.itemCount} {d.itemCount === 1 ? "item" : "itens"}
                    </span>
                    <span className="ml-auto font-semibold text-gold-text">Taxa {money(d.feeCents)}</span>
                  </div>
                  {d.status === "NOT_DELIVERED" && (
                    <p className="text-xs text-orange">
                      {d.failureReason} · {dateTime(d.failedAt)} — devolva o pedido na loja.
                    </p>
                  )}
                </CardContent>
                {d.status !== "NOT_DELIVERED" && (
                  <CardFooter className="grid grid-cols-2 gap-2">
                    <Link href={`/entregador/${d.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                      <MapIcon data-icon="inline-start" /> Ver rota
                    </Link>
                    {d.status === "AWAITING" ? (
                      <Button size="lg" disabled={!!starting || !!active} onClick={() => start(d)}>
                        {starting === d.id && <Spinner data-icon="inline-start" />}
                        Iniciar
                      </Button>
                    ) : (
                      <Link href={`/entregador/${d.id}`} className={buttonVariants({ size: "lg" })}>
                        Continuar
                      </Link>
                    )}
                  </CardFooter>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {active && tab === "available" && (data?.available.length ?? 0) > 0 && <p className="text-center text-xs text-muted-foreground">Finalize a entrega em andamento para iniciar outra.</p>}
    </main>
  )
}

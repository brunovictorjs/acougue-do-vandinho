"use client"

import { ChevronLeftIcon, HouseIcon, InfoIcon, MapPinIcon, PencilIcon, PlusIcon, StoreIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { Suspense } from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AddressForm, emptyAddress, saveAddress, toValues } from "@/components/store/address-form"
import { PageTitle, ShopShell } from "@/components/store/shop-shell"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { money } from "@/lib/format"
import type { Address } from "@/lib/types"

function AddressesContent() {
  const router = useRouter()
  const params = useSearchParams()
  const back = params.get("voltar")
  const { mutate: mutateMe } = useSession()
  const { data, mutate } = useSWR<Address[]>("/me/addresses")
  const [editing, setEditing] = React.useState<Address | "new" | null>(params.get("novo") ? "new" : null)
  const [removing, setRemoving] = React.useState<Address | null>(null)

  async function makeDefault(a: Address) {
    try {
      await mutate(await api<Address[]>(`/me/addresses/${a.id}/default`, { method: "POST" }), { revalidate: false })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function remove() {
    if (!removing) return
    try {
      await mutate(await api<Address[]>(`/me/addresses/${removing.id}`, { method: "DELETE" }), { revalidate: false })
      void mutateMe()
      toast.success("Endereço excluído")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setRemoving(null)
    }
  }

  const Icon = (label: string) => (label === "Casa" ? HouseIcon : label === "Trabalho" ? StoreIcon : MapPinIcon)

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <Link href={back ?? "/perfil"} className={buttonVariants({ variant: "ghost", className: "self-start" })}>
        <ChevronLeftIcon data-icon="inline-start" /> {back ? "Voltar ao pagamento" : "Perfil"}
      </Link>
      <PageTitle title="Endereços" />
      {!data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((a) => {
            const I = Icon(a.label)
            return (
              <Card key={a.id} className={a.isDefault ? "ring-brand-gold-dark" : undefined}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-heading text-base tracking-wide uppercase">
                    <I className="size-5 text-gold-text" aria-hidden />
                    {a.label}
                    {a.isDefault && <Badge className="ml-auto rounded-sm font-heading tracking-widest uppercase">Principal</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm">
                  <span>
                    {a.street}, {a.number}
                    {a.complement ? ` — ${a.complement}` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {a.neighborhood} · {a.city}/{a.state} · {a.zipCode}
                  </span>
                  <span className={a.delivery.served ? "text-xs text-gold-text" : "text-xs text-muted-foreground"}>
                    {a.delivery.served ? `Entrega: ${money(a.delivery.feeCents ?? 0)} · até ${a.delivery.etaMinutes} min` : "Bairro fora da área de entrega (só retirada)"}
                  </span>
                </CardContent>
                <CardFooter className="gap-2">
                  {!a.isDefault && (
                    <Button variant="outline" size="sm" onClick={() => makeDefault(a)}>
                      Tornar principal
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                    <PencilIcon data-icon="inline-start" /> Editar
                  </Button>
                  <Button variant="destructive" size="icon" aria-label="Excluir endereço" disabled={data.length <= 1} onClick={() => setRemoving(a)}>
                    <Trash2Icon />
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
          <Button variant="outline" size="xl" className="border-brand-gold" onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" /> Adicionar endereço
          </Button>
          <Alert>
            <InfoIcon />
            <AlertDescription>Você precisa manter pelo menos um endereço. No pagamento, escolhe um para cada pedido.</AlertDescription>
          </Alert>
        </div>
      )}

      <Drawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DrawerContent>
          <div className="mx-auto flex max-h-[85dvh] w-full max-w-md flex-col">
            <DrawerHeader className="text-left">
              <DrawerTitle className="font-display text-3xl">{editing === "new" ? "Novo endereço" : "Editar endereço"}</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="min-h-0 flex-1 px-4 pb-6">
              {editing && (
                <AddressForm
                  key={editing === "new" ? "new" : editing.id}
                  initial={editing === "new" ? emptyAddress : toValues(editing)}
                  submitLabel="Salvar endereço"
                  onSubmit={async (values) => {
                    await saveAddress(values, editing === "new" ? undefined : editing.id)
                    await mutate()
                    void mutateMe()
                    setEditing(null)
                    toast.success("Endereço salvo")
                    if (back) router.push(back)
                  }}
                />
              )}
            </ScrollArea>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este endereço?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.street}, {removing?.number} — {removing?.neighborhood}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

export default function AddressesPage() {
  return (
    <ShopShell>
      <Suspense>
        <AddressesContent />
      </Suspense>
    </ShopShell>
  )
}

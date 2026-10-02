"use client"

import { InfoIcon, PlusIcon, PowerIcon, SearchIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import useSWR, { useSWRConfig } from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { ListPagination, type Paged } from "@/components/list-pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, errorMessage } from "@/lib/api"
import { money, shortDate } from "@/lib/format"

type Status = "SERVED" | "INACTIVE" | "UNLISTED"
type Filter = "all" | "unserved" | "served"
type Zone = { id: string; neighborhood: string; feeCents: number; etaMinutes: number; active: boolean }
type Address = {
  id: string
  label: string
  zipCode: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  createdAt: string
  customer: { id: string; fullName: string; email: string; phone: string | null }
  status: Status
  zone: Zone | null
  sameNeighborhood: number
}
type Data = Paged<Address> & { counts: Record<Filter, number> }

function StatusBadge({ a }: { a: Address }) {
  if (a.status === "SERVED" && a.zone) return <Badge className="bg-success/15 text-success">{money(a.zone.feeCents)} · até {a.zone.etaMinutes} min</Badge>
  if (a.status === "INACTIVE") return <Badge className="bg-warning/15 text-warning">Bairro desativado</Badge>
  return <Badge className="bg-orange/15 text-orange">Não atendido</Badge>
}

/** Remounted per neighborhood (via key) so the form starts prefilled. Registers the address's neighborhood as a delivery zone, prefilled with its name. */
function ZoneDialog({ neighborhood, onClose, onSaved }: { neighborhood: string | null; onClose: () => void; onSaved: (name: string) => void }) {
  const [v, setV] = React.useState({ neighborhood: neighborhood ?? "", fee: "8,00", eta: "60" })
  const [busy, setBusy] = React.useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { neighborhood: v.neighborhood, feeCents: Math.round(Number(v.fee.replace(",", ".")) * 100), etaMinutes: Number(v.eta), active: true }
      await api("/admin/delivery-zones", { method: "POST", body })
      onSaved(v.neighborhood.trim())
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!neighborhood} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Atender {neighborhood}</DialogTitle>
            <DialogDescription>O bairro entra em Bairros atendidos e todos os endereços dele passam a poder receber entregas.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="zone-name">Bairro</FieldLabel>
              <Input id="zone-name" value={v.neighborhood} onChange={(e) => setV({ ...v, neighborhood: e.target.value })} required />
              <FieldDescription>Maiúsculas e acentos não importam: “Sao Jose” e “São José” são o mesmo bairro.</FieldDescription>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="zone-fee">Taxa de entrega</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>R$</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput id="zone-fee" inputMode="decimal" value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} autoFocus />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="zone-eta">Prazo</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="zone-eta" inputMode="numeric" value={v.eta} onChange={(e) => setV({ ...v, eta: e.target.value.replace(/\D/g, "") })} />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>min</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !v.neighborhood.trim()}>
              {busy && <Spinner data-icon="inline-start" />} Adicionar bairro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminAddressesPage() {
  const { mutate: refresh } = useSWRConfig()
  const [tab, setTab] = React.useState<Filter>("unserved")
  const [search, setSearch] = React.useState("")
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [adding, setAdding] = React.useState<string | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const qs = new URLSearchParams({ status: tab, page: String(page) })
  if (q) qs.set("search", q)
  const { data, mutate } = useSWR<Data>(`/admin/addresses?${qs}`, { keepPreviousData: true })

  function reload() {
    void mutate()
    void refresh("/admin/addresses/pending")
    void refresh("/admin/delivery-zones")
  }

  async function activate(z: Zone) {
    try {
      await api(`/admin/delivery-zones/${z.id}`, { method: "PUT", body: { neighborhood: z.neighborhood, feeCents: z.feeCents, etaMinutes: z.etaMinutes, active: true } })
      toast.success(`${z.neighborhood} voltou a receber entregas.`)
      reload()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <AdminPage title="Endereços" description="Onde seus clientes moram. Cadastre os bairros que ainda não são atendidos para entregar em mais lugares.">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Filter)
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="all">Todos · {data?.counts.all ?? 0}</TabsTrigger>
          <TabsTrigger value="unserved">Sem bairro atendido · {data?.counts.unserved ?? 0}</TabsTrigger>
          <TabsTrigger value="served">Com bairro atendido · {data?.counts.served ?? 0}</TabsTrigger>
        </TabsList>
      </Tabs>
      <InputGroup className="w-full max-w-sm bg-card">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput aria-label="Buscar endereços" placeholder="Cliente, rua, bairro ou CEP" value={search} onChange={(e) => setSearch(e.target.value)} />
      </InputGroup>
      <Card className="py-0">
        {!data ? (
          <Skeleton className="h-64" />
        ) : data.items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {tab === "unserved" && !search ? "Todos os endereços estão em bairros atendidos." : "Nenhum endereço encontrado."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Cliente</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Cadastrado</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-4">
                    <span className="flex flex-col">
                      <span className="font-semibold">{a.customer.fullName}</span>
                      <span className="text-xs text-muted-foreground">{a.customer.email}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-col">
                      <span>
                        {a.street}, {a.number}
                        {a.complement && ` · ${a.complement}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.zipCode} · {a.city}/{a.state}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-col">
                      <span className="font-semibold">{a.neighborhood}</span>
                      {a.sameNeighborhood > 1 && <span className="text-xs text-muted-foreground">+{a.sameNeighborhood - 1} {a.sameNeighborhood === 2 ? "endereço" : "endereços"} neste bairro</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge a={a} />
                  </TableCell>
                  <TableCell>{shortDate(a.createdAt)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    {a.status === "UNLISTED" && (
                      <Button size="icon" aria-label={`Adicionar ${a.neighborhood} aos bairros atendidos`} onClick={() => setAdding(a.neighborhood)}>
                        <PlusIcon />
                      </Button>
                    )}
                    {a.status === "INACTIVE" && a.zone && (
                      <Button size="sm" variant="outline" onClick={() => activate(a.zone!)}>
                        <PowerIcon data-icon="inline-start" /> Ativar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {data && <ListPagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      <Alert>
        <InfoIcon />
        <AlertDescription>Endereços em bairros não atendidos só podem retirar na loja. Taxas e prazos ficam em Configurações › Bairros atendidos.</AlertDescription>
      </Alert>
      <ZoneDialog
        key={adding ?? ""}
        neighborhood={adding}
        onClose={() => setAdding(null)}
        onSaved={(name) => {
          setAdding(null)
          toast.success(`${name} agora é um bairro atendido.`)
          reload()
        }}
      />
    </AdminPage>
  )
}

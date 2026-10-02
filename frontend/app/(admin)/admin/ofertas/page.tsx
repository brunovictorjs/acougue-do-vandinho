"use client"

import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { ListPagination, type Paged } from "@/components/list-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, errorMessage } from "@/lib/api"
import { money, shortDate } from "@/lib/format"

type Discount = "PERCENT" | "AMOUNT" | "FIXED_PRICE"
type Offer = {
  id: string
  name: string
  discountType: Discount
  value: number
  startsAt: string
  endsAt: string | null
  active: boolean
  showBadge: boolean
  featured: boolean
  status: "LIVE" | "SCHEDULED" | "ENDED" | "INACTIVE"
  products: Array<{ id: string; name: string; priceCents: number }>
}
/** `currentOfferIds`: offers switched on and not ended that already hold this product. */
type ProductRow = { id: string; name: string; priceCents: number; category: string; currentOfferIds: string[] }

const STATUS: Record<Offer["status"], [string, string]> = {
  LIVE: ["Ativa", "bg-success/15 text-success"],
  SCHEDULED: ["Agendada", "bg-info/15 text-info"],
  ENDED: ["Encerrada", "bg-muted text-muted-foreground"],
  INACTIVE: ["Desligada", "bg-muted text-muted-foreground"],
}

const describe = (o: { discountType: Discount; value: number }) =>
  o.discountType === "PERCENT" ? `−${o.value}%` : o.discountType === "AMOUNT" ? `−${money(o.value)}` : `por ${money(o.value)}`

const normalize = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "")

interface Draft {
  id?: string
  name: string
  discountType: Discount
  value: string
  startsAt: string
  endsAt: string
  active: boolean
  showBadge: boolean
  featured: boolean
  productIds: string[]
}

const emptyDraft = (): Draft => ({
  name: "",
  discountType: "PERCENT",
  value: "",
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: "",
  active: true,
  showBadge: true,
  featured: true,
  productIds: [],
})

/** Mounted per draft (keyed by the parent), so the form state starts from the draft. */
function OfferSheet({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const { data: products } = useSWR<ProductRow[]>("/admin/products/options")
  const [d, setD] = React.useState<Draft>(draft)
  const [search, setSearch] = React.useState("")
  // A product can only be in one current (live or scheduled) offer — the API enforces the same rule.
  const taken = React.useMemo(() => new Set(products?.filter((p) => p.currentOfferIds.some((id) => id !== draft.id)).map((p) => p.id)), [products, draft.id])
  const term = normalize(search.trim())
  const selectable = products?.filter((p) => !taken.has(p.id) || d.productIds.includes(p.id))
  const visible = selectable?.filter((p) => !term || normalize(`${p.name} ${p.category}`).includes(term))
  const hiddenCount = (products?.length ?? 0) - (selectable?.length ?? 0)
  const [busy, setBusy] = React.useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }))
  const first = products?.find((p) => d.productIds.includes(p.id))
  const numeric = d.discountType === "PERCENT" ? Number(d.value) : Math.round(Number(d.value.replace(",", ".")) * 100)

  async function save() {
    setBusy(true)
    try {
      const body = {
        name: d.name,
        discountType: d.discountType,
        value: numeric,
        startsAt: new Date(d.startsAt).toISOString(),
        endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : null,
        active: d.active,
        showBadge: d.showBadge,
        featured: d.featured,
        productIds: d.productIds,
      }
      await api(d.id ? `/admin/offers/${d.id}` : "/admin/offers", { method: d.id ? "PUT" : "POST", body })
      toast.success("Oferta salva")
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const preview = first && numeric > 0 ? (d.discountType === "PERCENT" ? Math.round(first.priceCents * (1 - numeric / 100)) : d.discountType === "AMOUNT" ? first.priceCents - numeric : numeric) : null

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">{d.id ? "Editar oferta" : "Nova oferta"}</SheetTitle>
          <SheetDescription>O cliente sempre recebe a melhor oferta ativa de cada produto.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-4">
          <FieldGroup className="pb-4">
            <Field>
              <FieldLabel htmlFor="o-name">Nome</FieldLabel>
              <Input id="o-name" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Ofertas da semana" />
            </Field>
            <Field>
              <FieldLabel>Tipo de desconto</FieldLabel>
              <ToggleGroup variant="segment" size="none" className="w-full rounded-lg border bg-muted p-1" value={[d.discountType]} onValueChange={(v) => v[0] && set("discountType", v[0] as Discount)}>
                <ToggleGroupItem value="PERCENT">Percentual</ToggleGroupItem>
                <ToggleGroupItem value="AMOUNT">Valor (R$)</ToggleGroupItem>
                <ToggleGroupItem value="FIXED_PRICE">Preço final</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="o-value">{d.discountType === "PERCENT" ? "Desconto (%)" : d.discountType === "AMOUNT" ? "Desconto em R$" : "Preço final em R$"}</FieldLabel>
              <Input id="o-value" inputMode="decimal" value={d.value} onChange={(e) => set("value", e.target.value.replace(/[^\d,]/g, ""))} />
              {preview != null && first && (
                <FieldDescription>
                  Prévia em {first.name}: <span className="line-through">{money(first.priceCents)}</span> → <b>{money(Math.max(0, preview))}</b>
                </FieldDescription>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="o-start">Início</FieldLabel>
                <Input id="o-start" type="datetime-local" value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="o-end">Fim (opcional)</FieldLabel>
                <Input id="o-end" type="datetime-local" value={d.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
              </Field>
            </div>
            {(
              [
                ["active", "Ligada", "Desligue para pausar sem apagar"],
                ["showBadge", "Mostrar selo OFERTA", "Selo dourado no card do produto"],
                ["featured", "Destacar em “Ofertas da semana”", "Aparece no topo da página inicial"],
              ] as const
            ).map(([k, t, desc]) => (
              <Field key={k} orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{t}</FieldTitle>
                  <FieldDescription>{desc}</FieldDescription>
                </FieldContent>
                <Switch checked={d[k]} onCheckedChange={(v) => set(k, v)} aria-label={t} />
              </Field>
            ))}
            <Field>
              <FieldLabel>Produtos ({d.productIds.length})</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput aria-label="Buscar produtos" placeholder="Buscar produto ou categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
              </InputGroup>
              <div className="flex max-h-72 flex-col overflow-y-auto rounded-lg border">
                {!visible ? (
                  <Skeleton className="h-40" />
                ) : visible.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {!term
                      ? "Todos os produtos já estão em ofertas vigentes."
                      : products?.some((p) => taken.has(p.id) && normalize(`${p.name} ${p.category}`).includes(term))
                        ? "Os produtos encontrados já estão em outra oferta vigente."
                        : "Nenhum produto encontrado."}
                  </p>
                ) : (
                  visible.map((p) => {
                    const checked = d.productIds.includes(p.id)
                    return (
                      <FieldLabel key={p.id} htmlFor={`op-${p.id}`} className="rounded-none border-0 border-b last:border-0">
                        <Field orientation="horizontal">
                          <Checkbox id={`op-${p.id}`} checked={checked} onCheckedChange={(c) => set("productIds", c ? [...d.productIds, p.id] : d.productIds.filter((x) => x !== p.id))} />
                          <FieldContent>
                            <FieldTitle>{p.name}</FieldTitle>
                            <FieldDescription>
                              {p.category} · {money(p.priceCents)}
                            </FieldDescription>
                          </FieldContent>
                        </Field>
                      </FieldLabel>
                    )
                  })
                )}
              </div>
              {hiddenCount > 0 && (
                <FieldDescription>
                  {hiddenCount === 1 ? "1 produto já está" : `${hiddenCount} produtos já estão`} em outra oferta vigente e não aparece{hiddenCount === 1 ? "" : "m"} aqui.
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </ScrollArea>
        <SheetFooter>
          <Button size="lg" disabled={busy || !d.name || !d.productIds.length || !(numeric > 0)} onClick={save}>
            {busy && <Spinner data-icon="inline-start" />}
            Salvar oferta
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default function AdminOffersPage() {
  const [page, setPage] = React.useState(1)
  const { data, mutate } = useSWR<Paged<Offer>>(`/admin/offers?page=${page}`, { keepPreviousData: true })
  const [draft, setDraft] = React.useState<Draft | null>(null)

  async function toggle(o: Offer, active: boolean) {
    await mutate((list) => list && { ...list, items: list.items.map((x) => (x.id === o.id ? { ...x, active } : x)) }, { revalidate: false })
    await api(`/admin/offers/${o.id}/active`, { method: "PATCH", body: { active } }).catch((e) => toast.error(errorMessage(e)))
    void mutate()
  }
  async function remove(o: Offer) {
    await api(`/admin/offers/${o.id}`, { method: "DELETE" })
    toast.success("Oferta excluída")
    void mutate()
  }

  return (
    <AdminPage
      title="Ofertas"
      description="Descontos por produto, com período, selo e destaque"
      actions={
        <Button size="lg" onClick={() => setDraft(emptyDraft())}>
          <PlusIcon data-icon="inline-start" /> Nova oferta
        </Button>
      }
    >
      <Card className="py-0">
        {!data ? (
          <Skeleton className="h-64" />
        ) : data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhuma oferta</EmptyTitle>
              <EmptyDescription>Crie a primeira para aparecer em “Ofertas da semana”.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Oferta</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ligada</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-4 font-semibold">
                    {o.name}
                    {o.featured && <span className="block text-xs font-normal text-muted-foreground">Em destaque</span>}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{o.products.map((p) => p.name).join(", ")}</TableCell>
                  <TableCell>
                    <Badge className="rounded-sm">{describe(o)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {shortDate(o.startsAt)} – {o.endsAt ? shortDate(o.endsAt) : "sem fim"}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS[o.status][1]}>{STATUS[o.status][0]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={o.active} onCheckedChange={(v) => toggle(o, v)} aria-label={`Ligar ${o.name}`} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${o.name}`}
                        onClick={() =>
                          setDraft({
                            id: o.id,
                            name: o.name,
                            discountType: o.discountType,
                            value: o.discountType === "PERCENT" ? String(o.value) : (o.value / 100).toFixed(2).replace(".", ","),
                            startsAt: toLocalInput(o.startsAt),
                            endsAt: toLocalInput(o.endsAt),
                            active: o.active,
                            showBadge: o.showBadge,
                            featured: o.featured,
                            productIds: o.products.map((p) => p.id),
                          })
                        }
                      >
                        <PencilIcon />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Excluir ${o.name}`} onClick={() => remove(o)}>
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {data && <ListPagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      {draft && (
        <OfferSheet
          key={draft.id ?? "new"}
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            void mutate()
          }}
        />
      )}
    </AdminPage>
  )
}

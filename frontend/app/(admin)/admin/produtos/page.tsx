"use client"

import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, SearchIcon, StarIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { ListPagination, type Paged } from "@/components/list-pagination"
import { ProductImage } from "@/components/product-image"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage } from "@/lib/api"
import { money, unitLabel } from "@/lib/format"
import type { Unit } from "@/lib/types"

type Row = {
  id: string
  name: string
  slug: string
  category: string
  categoryId: string
  unit: Unit
  priceCents: number
  effectivePriceCents: number
  offerPercent: number
  published: boolean
  available: boolean
  isNew: boolean
  ratingAvg: number
  ratingCount: number
  coverUrl: string | null
}
type Category = { id: string; name: string; slug: string; position: number; productCount: number }

function Categories() {
  const { data, mutate } = useSWR<Category[]>("/admin/categories")
  const [name, setName] = React.useState("")
  const [editing, setEditing] = React.useState<{ id: string; name: string } | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api("/admin/categories", { body: { name } })
      setName("")
      void mutate()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
  async function rename() {
    if (!editing) return
    try {
      await api(`/admin/categories/${editing.id}`, { method: "PUT", body: { name: editing.name } })
      setEditing(null)
      void mutate()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
  async function move(index: number, dir: -1 | 1) {
    if (!data) return
    const ids = data.map((c) => c.id)
    const [it] = ids.splice(index, 1)
    ids.splice(index + dir, 0, it)
    await mutate(await api<Category[]>("/admin/categories/order", { method: "PUT", body: { ids } }), { revalidate: false })
  }
  async function remove(c: Category) {
    try {
      await api(`/admin/categories/${c.id}`, { method: "DELETE" })
      void mutate()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card className="xl:sticky xl:top-6 xl:self-start">
      <CardHeader>
        <CardTitle className="label-caps text-sm">Categorias</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {!data ? (
          <Skeleton className="h-40" />
        ) : (
          data.map((c, i) => (
            <div key={c.id} className="flex items-center gap-1 border-b py-1.5 last:border-0">
              {editing?.id === c.id ? (
                <InputGroup className="h-9">
                  <InputGroupInput aria-label="Nome da categoria" value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} autoFocus onKeyDown={(e) => e.key === "Enter" && void rename()} />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton onClick={rename}>Salvar</InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.productCount}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Subir ${c.name}`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUpIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Descer ${c.name}`} disabled={i === data.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDownIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Renomear ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${c.name}`} disabled={c.productCount > 0} onClick={() => remove(c)}>
                    <Trash2Icon />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
        <form onSubmit={create} className="mt-2 flex gap-2">
          <Input aria-label="Nova categoria" placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} required />
          <Button type="submit" size="icon-lg" aria-label="Adicionar categoria">
            <PlusIcon />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">A ordem aqui é a ordem dos filtros na loja. Só dá para excluir categorias vazias.</p>
      </CardContent>
    </Card>
  )
}

export default function AdminProductsPage() {
  const [search, setSearch] = React.useState("")
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [categoryId, setCategoryId] = React.useState("all")
  const { data: categories } = useSWR<Category[]>("/admin/categories")

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const qs = new URLSearchParams({ page: String(page) })
  if (q) qs.set("search", q)
  if (categoryId !== "all") qs.set("categoryId", categoryId)
  const { data, mutate } = useSWR<Paged<Row>>(`/admin/products?${qs}`, { keepPreviousData: true })

  async function flag(id: string, key: "published" | "available" | "isNew", value: boolean) {
    await mutate(
      (list) => list && { ...list, items: list.items.map((r) => (r.id === id ? { ...r, [key]: value } : r)) },
      { revalidate: false }
    )
    try {
      await api(`/admin/products/${id}/flags`, { method: "PATCH", body: { [key]: value } })
    } catch (e) {
      toast.error(errorMessage(e))
      void mutate()
    }
  }

  const catItems = [{ value: "all", label: "Todas as categorias" }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]

  return (
    <AdminPage
      title="Produtos"
      description={data ? `${data.total} produtos` : undefined}
      actions={
        <Link href="/admin/produtos/novo" className={buttonVariants({ size: "lg" })}>
          <PlusIcon data-icon="inline-start" /> Novo produto
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <InputGroup className="w-full max-w-xs bg-card">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput aria-label="Buscar produto" placeholder="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} />
            </InputGroup>
            <Select items={catItems} value={categoryId} onValueChange={(v) => v && (setCategoryId(v), setPage(1))}>
              <SelectTrigger className="min-w-48 bg-card" aria-label="Categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {catItems.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Card className="py-0">
            {!data ? (
              <Skeleton className="h-96" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Produto</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Publicado</TableHead>
                    <TableHead>Disponível</TableHead>
                    <TableHead>Novidade</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead className="pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        Nenhum produto encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <span className="flex items-center gap-3">
                          <ProductImage src={p.coverUrl} alt="" className="size-10 shrink-0 rounded-md" iconClassName="size-4" />
                          <span className="flex flex-col">
                            <Link href={`/admin/produtos/${p.id}`} className="font-semibold hover:underline">
                              {p.name}
                            </Link>
                            <span className="text-xs text-muted-foreground">{p.category}</span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          <span className="font-semibold">
                            {money(p.effectivePriceCents)} /{unitLabel[p.unit]}
                          </span>
                          {p.offerPercent > 0 && (
                            <span className="flex items-center gap-1.5 text-xs">
                              <span className="text-muted-foreground line-through">{money(p.priceCents)}</span>
                              <Badge className="h-4 rounded-sm px-1 text-[10px]">-{p.offerPercent}%</Badge>
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch checked={p.published} onCheckedChange={(v) => flag(p.id, "published", v)} aria-label={`Publicado: ${p.name}`} />
                      </TableCell>
                      <TableCell>
                        <Switch checked={p.available} onCheckedChange={(v) => flag(p.id, "available", v)} aria-label={`Disponível: ${p.name}`} />
                      </TableCell>
                      <TableCell>
                        <Switch checked={p.isNew} onCheckedChange={(v) => flag(p.id, "isNew", v)} aria-label={`Novidade: ${p.name}`} />
                      </TableCell>
                      <TableCell>
                        {p.ratingCount ? (
                          <span className="flex items-center gap-1">
                            <StarIcon className="size-3.5 fill-brand-gold text-brand-gold" aria-hidden />
                            {p.ratingAvg.toFixed(1)} <span className="text-xs text-muted-foreground">({p.ratingCount})</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4">
                        <Link href={`/admin/produtos/${p.id}`} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={`Editar ${p.name}`}>
                          <PencilIcon />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          {data && <ListPagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
        </div>
        <Categories />
      </div>
    </AdminPage>
  )
}

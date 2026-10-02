"use client"

import { SearchIcon, XIcon } from "lucide-react"
import * as React from "react"
import useSWRInfinite from "swr/infinite"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "@/lib/api"
import type { Category, ProductList } from "@/lib/types"
import { ProductCard } from "../product-card"
import { SectionHeading } from "./sections"

const SORTS = [
  { value: "popular", label: "Mais vendidos" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "rating", label: "Mais bem avaliados" },
  { value: "newest", label: "Novidades" },
]

export function Catalog({ categories, initial, offersFirst = false, newestFirst = false }: { categories: Category[]; initial: ProductList; offersFirst?: boolean; newestFirst?: boolean }) {
  const [category, setCategory] = React.useState<string>("")
  const [offersOnly, setOffersOnly] = React.useState(offersFirst)
  const [sort, setSort] = React.useState<string>(newestFirst ? "newest" : "popular")
  const [search, setSearch] = React.useState("")
  const [query, setQuery] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const isDefault = !category && !offersOnly && sort === "popular" && !query
  const key = (page: number) => {
    const qs = new URLSearchParams({ page: String(page + 1), pageSize: "12", sort })
    if (category) qs.set("category", category)
    if (offersOnly) qs.set("offers", "true")
    if (query) qs.set("search", query)
    return `/catalog/products?${qs}`
  }
  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite<ProductList>(key, (p: string) => api<ProductList>(p), {
    fallbackData: isDefault ? [initial] : undefined,
    revalidateFirstPage: false,
  })
  const pages = data ?? []
  const items = pages.flatMap((p) => p.items)
  const total = pages[0]?.total ?? 0
  const hasMore = items.length < total

  const chips = [{ slug: "all", name: "Todos" }, ...categories.filter((c) => c.productCount > 0)]

  return (
    <section id="catalogo" className="mx-auto flex max-w-6xl scroll-mt-20 flex-col gap-4 px-4 pt-12" aria-label="Catálogo">
      <SectionHeading title="Catálogo" />
      <InputGroup className="h-12">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput aria-label="Buscar produtos" placeholder="Buscar picanha, linguiça, kit…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </InputGroup>
      <ToggleGroup
        aria-label="Categorias"
        variant="chip"
        size="none"
        className="no-scrollbar -mx-4 w-auto max-w-none overflow-x-auto px-4"
        value={[category || "all"]}
        onValueChange={(v) => setCategory(!v[0] || v[0] === "all" ? "" : v[0])}
      >
        {chips.map((c) => (
          <ToggleGroupItem key={c.slug} value={c.slug} className="shrink-0">
            {c.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{isLoading && !items.length ? "Carregando…" : `${total} produtos`}</span>
          {offersOnly && (
            <Button variant="outline" size="sm" onClick={() => setOffersOnly(false)}>
              Só ofertas
              <XIcon data-icon="inline-end" />
            </Button>
          )}
        </div>
        <Select items={SORTS} value={sort} onValueChange={(v) => v && setSort(v)}>
          <SelectTrigger aria-label="Ordenar por" className="h-10 min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {isLoading && !items.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <div key={p.id} data-reveal>
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Nada encontrado</EmptyTitle>
            <EmptyDescription>Tente outro termo ou outra categoria.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {hasMore && (
        <Button variant="outline" size="xl" className="w-full border-brand-gold" disabled={isValidating} onClick={() => setSize(size + 1)}>
          {isValidating && <Spinner data-icon="inline-start" />}
          Carregar mais produtos
        </Button>
      )}
    </section>
  )
}

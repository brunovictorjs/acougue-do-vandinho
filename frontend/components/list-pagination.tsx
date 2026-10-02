"use client"

import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

/** Server-paginated list envelope (see `paged()` in the API). */
export interface Paged<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

/**
 * "Anterior · 21–40 de 134 · Próxima" under a list. Renders nothing when
 * everything fits in one page.
 */
export function ListPagination({ page, pageSize, total, onChange, className }: { page: number; pageSize: number; total: number; onChange: (page: number) => void; className?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  return (
    <Pagination className={cn(className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" text="Anterior" onClick={(e) => (e.preventDefault(), page > 1 && onChange(page - 1))} aria-disabled={page === 1} />
        </PaginationItem>
        <PaginationItem className="px-3 text-sm text-muted-foreground tabular-nums">
          {first}–{last} de {total.toLocaleString("pt-BR")}
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" text="Próxima" onClick={(e) => (e.preventDefault(), page < pages && onChange(page + 1))} aria-disabled={page === pages} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

"use client"

import { EyeIcon, EyeOffIcon, MessageSquareReplyIcon, SearchIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { PeriodFilter, withPeriod, type Period } from "@/components/admin/period-filter"
import { ListPagination, type Paged } from "@/components/list-pagination"
import { Stars } from "@/components/stars"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, errorMessage } from "@/lib/api"
import { shortDate } from "@/lib/format"

type Review = { id: string; product: string; productSlug: string; customer: string; rating: number; comment: string | null; tags: string[]; status: "PUBLISHED" | "HIDDEN"; reply: string | null; createdAt: string }
type Data = Paged<Review> & { stats: { average: number; published: number; unanswered: number; hidden: number } }

export default function AdminReviewsPage() {
  const [status, setStatus] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const [period, setPeriod] = React.useState<Period>({})
  const [q, setQ] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [replying, setReplying] = React.useState<Review | null>(null)
  const [reply, setReply] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const qs = new URLSearchParams({ page: String(page) })
  if (status === "PUBLISHED" || status === "HIDDEN") qs.set("status", status)
  if (status === "critical") qs.set("critical", "true")
  if (q) qs.set("search", q)
  withPeriod(qs, period)
  const { data, mutate } = useSWR<Data>(`/admin/reviews?${qs}`, { keepPreviousData: true })
  const items = data?.items

  async function setVisibility(r: Review) {
    try {
      await api(`/admin/reviews/${r.id}/status`, { method: "PATCH", body: { status: r.status === "HIDDEN" ? "PUBLISHED" : "HIDDEN" } })
      void mutate()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function sendReply() {
    if (!replying) return
    try {
      await api(`/admin/reviews/${replying.id}/reply`, { body: { reply } })
      toast.success("Resposta publicada")
      setReplying(null)
      void mutate()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <AdminPage title="Avaliações" description="Só clientes que receberam o produto podem avaliar">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="label-caps">Nota média</CardDescription>
            <CardTitle className="flex items-center gap-3 font-heading text-3xl font-semibold">
              {data ? data.stats.average.toFixed(1).replace(".", ",") : "—"}
              {data && <Stars value={data.stats.average} />}
            </CardTitle>
            <CardDescription>{data?.stats.published ?? 0} avaliações publicadas</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="label-caps">Críticas sem resposta</CardDescription>
            <CardTitle className="font-heading text-3xl font-semibold">{data?.stats.unanswered ?? "—"}</CardTitle>
            <CardDescription>notas de 1 a 3 estrelas</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="label-caps">Ocultas</CardDescription>
            <CardTitle className="font-heading text-3xl font-semibold">{data?.stats.hidden ?? "—"}</CardTitle>
            <CardDescription>não aparecem na loja</CardDescription>
          </CardHeader>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full max-w-xs bg-card">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput aria-label="Buscar avaliações" placeholder="Produto ou cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
        </InputGroup>
        <PeriodFilter
          value={period}
          onChange={(p) => {
            setPeriod(p)
            setPage(1)
          }}
        />
        <ToggleGroup variant="chip" size="none" value={[status]} onValueChange={(v) => v[0] && (setStatus(v[0]), setPage(1))} aria-label="Filtro">
          <ToggleGroupItem value="all">Todas</ToggleGroupItem>
          <ToggleGroupItem value="critical">Críticas</ToggleGroupItem>
          <ToggleGroupItem value="PUBLISHED">Publicadas</ToggleGroupItem>
          <ToggleGroupItem value="HIDDEN">Ocultas</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Card className="py-0">
        {!items ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Comentário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhuma avaliação encontrada com esses filtros.
                  </TableCell>
                </TableRow>
              )}
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 font-semibold">{r.product}</TableCell>
                  <TableCell>
                    {r.customer}
                    <span className="block text-xs text-muted-foreground">{shortDate(r.createdAt)}</span>
                  </TableCell>
                  <TableCell>
                    <Stars value={r.rating} size="size-3" />
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal">
                    <p className="text-sm">{r.comment ?? <span className="text-muted-foreground">Sem comentário</span>}</p>
                    {r.reply && <p className="mt-1 text-xs text-muted-foreground">Resposta: {r.reply}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge className={r.status === "PUBLISHED" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>{r.status === "PUBLISHED" ? "Publicada" : "Oculta"}</Badge>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReplying(r)
                          setReply(r.reply ?? "")
                        }}
                      >
                        <MessageSquareReplyIcon data-icon="inline-start" /> Responder
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={r.status === "HIDDEN" ? "Mostrar na loja" : "Ocultar da loja"} onClick={() => setVisibility(r)}>
                        {r.status === "HIDDEN" ? <EyeIcon /> : <EyeOffIcon />}
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
      <Dialog open={!!replying} onOpenChange={(o) => !o && setReplying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder {replying?.customer}</DialogTitle>
            <DialogDescription>A resposta aparece abaixo da avaliação, na página do produto.</DialogDescription>
          </DialogHeader>
          {replying?.comment && <p className="rounded-lg bg-muted p-3 text-sm">“{replying.comment}”</p>}
          <Textarea aria-label="Resposta" rows={4} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
          <DialogFooter>
            <Button onClick={sendReply}>Publicar resposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}

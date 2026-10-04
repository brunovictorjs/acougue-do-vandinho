"use client"

import { PencilIcon, StarIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { Stars } from "@/components/stars"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Field, FieldLabel } from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useSession } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { initials, shortDate } from "@/lib/format"
import type { ReviewList } from "@/lib/types"
import { cn } from "@/lib/utils"

const LABELS = ["", "Ruim", "Regular", "Boa", "Muito boa", "Excelente"]

export function ReviewDrawer({
  open,
  onOpenChange,
  productId,
  productName,
  tags,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  productId: string
  productName: string
  tags: string[]
  initial?: { rating: number; comment: string | null; tags: string[] } | null
  onSaved?: () => void
}) {
  const [rating, setRating] = React.useState(initial?.rating ?? 5)
  const [comment, setComment] = React.useState(initial?.comment ?? "")
  const [chosen, setChosen] = React.useState<string[]>(initial?.tags ?? [])
  const [busy, setBusy] = React.useState(false)

  async function submit() {
    setBusy(true)
    try {
      await api(`/products/${productId}/reviews`, { method: "PUT", body: { rating, comment: comment || undefined, tags: chosen } })
      toast.success("Obrigado pela avaliação!")
      onOpenChange(false)
      onSaved?.()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto flex w-full max-w-md flex-col">
          <DrawerHeader className="text-left">
            <DrawerDescription>{productName}</DrawerDescription>
            <DrawerTitle className="font-display text-3xl">Como estava?</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-5 px-4">
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-1" role="radiogroup" aria-label="Nota">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} estrelas`} onClick={() => setRating(n)} className="flex size-12 items-center justify-center">
                    <StarIcon className={cn("size-10", n <= rating ? "fill-brand-gold text-brand-gold" : "text-muted-foreground/50")} aria-hidden />
                  </button>
                ))}
              </div>
              <span className="font-semibold text-gold-text">{LABELS[rating]}</span>
            </div>
            <ToggleGroup multiple variant="chip" size="none" className="flex-wrap justify-center" value={chosen} onValueChange={setChosen} aria-label="O que você gostou">
              {tags.map((t) => (
                <ToggleGroupItem key={t} value={t}>
                  {t}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Field>
              <FieldLabel htmlFor="review-comment">Conte mais (opcional)</FieldLabel>
              <Textarea id="review-comment" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} className="mb-4" />
            </Field>
          </div>
          <DrawerFooter>
            <Button size="xl" disabled={busy} onClick={submit}>
              {busy && <Spinner data-icon="inline-start" />}
              Enviar avaliação
            </Button>
            <p className="text-center text-xs text-muted-foreground">Só quem comprou e recebeu o produto pode avaliar.</p>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function ProductReviews({ productId, productName, ratingAvg, ratingCount }: { productId: string; productName: string; ratingAvg: number; ratingCount: number }) {
  const { me } = useSession()
  const [filter, setFilter] = React.useState("all")
  const [open, setOpen] = React.useState(false)
  const { data, mutate } = useSWR<ReviewList>(`/products/${productId}/reviews?filter=${filter}`, { keepPreviousData: true })
  const total = data?.distribution.reduce((s, d) => s + d.count, 0) ?? ratingCount

  return (
    <section id="avaliacoes" className="flex scroll-mt-24 flex-col gap-5" aria-labelledby="avaliacoes-title">
      <div className="flex items-center justify-between">
        <h2 id="avaliacoes-title" className="font-display text-3xl">
          Avaliações
        </h2>
        {me && data?.canReview && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <PencilIcon data-icon="inline-start" />
            {data.mine ? "Editar avaliação" : "Avaliar"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex w-28 flex-col items-center gap-1">
          <span className="font-heading text-5xl font-semibold">{ratingCount ? ratingAvg.toLocaleString("pt-BR") : "—"}</span>
          <Stars value={ratingAvg} />
          <span className="text-xs text-muted-foreground">{total} avaliações</span>
        </div>
        <ul className="flex flex-1 flex-col gap-1.5" aria-label="Distribuição das notas">
          {(data?.distribution ?? [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }))).map((d) => (
            <li key={d.rating} className="flex items-center gap-2 text-xs">
              <span className="w-3">{d.rating}</span>
              <StarIcon className="size-3 fill-brand-gold text-brand-gold" aria-hidden />
              <Progress value={total ? (d.count / total) * 100 : 0} className="h-1.5 flex-1" aria-label={`${d.count} avaliações com ${d.rating} estrelas`} />
              <span className="w-6 text-right text-muted-foreground">{d.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <ToggleGroup variant="chip" size="none" className="flex-wrap" value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0])} aria-label="Filtrar avaliações">
        <ToggleGroupItem value="all">Todas</ToggleGroupItem>
        <ToggleGroupItem value="five">5 estrelas</ToggleGroupItem>
        <ToggleGroupItem value="critical">Críticas</ToggleGroupItem>
      </ToggleGroup>

      {!data ? (
        <Skeleton className="h-32" />
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não há avaliações {filter === "all" ? "para este produto" : "com este filtro"}.</p>
      ) : (
        <ul className="flex flex-col">
          {data.items.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 border-t py-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
                  <AvatarFallback className="text-xs font-semibold text-gold-text">{initials(r.author)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">{r.author}</span>
                  <span className="text-xs text-muted-foreground">{shortDate(r.createdAt)} · compra verificada</span>
                </div>
                <Stars value={r.rating} size="size-3" />
              </div>
              {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              {r.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              {r.reply && (
                <p className="rounded-lg border-l-0 bg-muted p-3 text-sm">
                  <span className="label-caps mb-1 block text-gold-text">Resposta da loja</span>
                  {r.reply}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && (
        <ReviewDrawer
          key={data.mine ? "edit" : "new"}
          open={open}
          onOpenChange={setOpen}
          productId={productId}
          productName={productName}
          tags={data.tags}
          initial={data.mine}
          onSaved={() => void mutate()}
        />
      )}
    </section>
  )
}

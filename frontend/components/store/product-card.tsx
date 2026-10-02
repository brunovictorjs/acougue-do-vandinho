"use client"

import { BellIcon, HeartIcon, PlusIcon, StarIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { ProductImage } from "@/components/product-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAddToCart } from "@/hooks/use-cart"
import { useFavorites } from "@/hooks/use-favorites"
import { money, unitLong } from "@/lib/format"
import type { ProductCard as Product } from "@/lib/types"
import { cn } from "@/lib/utils"

export function FavoriteButton({ productId, name, className }: { productId: string; name: string; className?: string }) {
  const { isFavorite, toggle } = useFavorites()
  const fav = isFavorite(productId)
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("rounded-full border-white/10 bg-black/70 backdrop-blur hover:bg-black", className)}
      aria-label={fav ? `Remover ${name} dos favoritos` : `Favoritar ${name}`}
      aria-pressed={fav}
      onClick={(e) => {
        e.preventDefault()
        void toggle(productId)
      }}
    >
      <HeartIcon className={cn(fav && "fill-brand-gold text-brand-gold")} />
    </Button>
  )
}

export function ProductSeals({ product }: { product: Product }) {
  return (
    <div className="flex flex-wrap gap-1">
      {product.offer?.showBadge && <Badge className="rounded-sm font-heading tracking-widest uppercase">Oferta -{product.offer.discountPercent}%</Badge>}
      {product.isNew && (
        <Badge variant="outline" className="rounded-sm border-brand-gold-dark bg-black font-heading tracking-widest text-gold-text uppercase">
          Novo
        </Badge>
      )}
      {!product.available && (
        <Badge variant="outline" className="rounded-sm bg-black font-heading tracking-widest uppercase">
          Esgotado
        </Badge>
      )}
    </div>
  )
}

export function ProductCard({ product, imageClassName }: { product: Product; imageClassName?: string }) {
  const add = useAddToCart()
  const [adding, setAdding] = React.useState(false)
  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-brand-gold-dark">
      <div className="relative">
        <Link href={`/produto/${product.slug}`} tabIndex={-1} aria-hidden>
          <ProductImage src={product.coverUrl} alt={product.name} label={product.coverUrl ? undefined : product.category.name} className={cn("aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.03]", imageClassName)} />
        </Link>
        <div className="absolute top-2 left-2">
          <ProductSeals product={product} />
        </div>
        <FavoriteButton productId={product.id} name={product.name} className="absolute top-2 right-2 z-10" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.ratingCount > 0 && (
          <p className="flex items-center gap-1 text-xs">
            <StarIcon className="size-3 fill-brand-gold text-brand-gold" aria-hidden />
            <span className="font-semibold">{product.ratingAvg.toLocaleString("pt-BR")}</span>
            <span className="text-muted-foreground">({product.ratingCount})</span>
          </p>
        )}
        <Link href={`/produto/${product.slug}`} className="line-clamp-2 min-h-10 text-sm leading-snug font-semibold after:absolute after:inset-0 after:content-['']">
          {product.name}
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col">
            {product.offer ? (
              <span className="text-xs text-muted-foreground line-through">{money(product.listPriceCents)}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground">{unitLong[product.unit]}</span>
            )}
            <span className="font-heading text-lg leading-tight font-semibold text-gold-text">{money(product.priceCents)}</span>
          </div>
          {product.available ? (
            <Button
              size="icon-lg"
              className="relative z-10"
              aria-label={`Adicionar ${product.name} ao carrinho`}
              disabled={adding}
              onClick={async () => {
                setAdding(true)
                await add({ productId: product.id, quantity: product.minQuantity, cutOption: product.cutOptions[0] ?? null })
                setAdding(false)
              }}
            >
              <PlusIcon />
            </Button>
          ) : (
            <Button size="icon-lg" variant="outline" className="relative z-10" disabled aria-label="Indisponível">
              <BellIcon />
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

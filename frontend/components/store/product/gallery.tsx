"use client"

import { ImageIcon, PlayIcon } from "lucide-react"
import * as React from "react"
import { ProductImage } from "@/components/product-image"
import type { ProductDetail } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ProductGallery({ product }: { product: ProductDetail }) {
  const media = product.media
  const [index, setIndex] = React.useState(0)
  const current = media[index]

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-none bg-muted md:rounded-2xl">
        {current?.type === "VIDEO" ? (
          <video key={current.id} src={current.url} controls playsInline className="size-full bg-black object-contain" aria-label={current.alt || `Vídeo de ${product.name}`} />
        ) : (
          <ProductImage src={current?.url} alt={current?.alt || product.name} label={current ? undefined : "Foto em breve"} className="size-full" iconClassName="size-16" />
        )}
        {media.length > 1 && (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold">
            {index + 1} / {media.length}
          </span>
        )}
      </div>
      {media.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 md:px-0" role="tablist" aria-label="Fotos e vídeos">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={m.type === "VIDEO" ? `Vídeo ${i + 1}` : `Foto ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn("relative size-16 shrink-0 overflow-hidden rounded-lg border-2", i === index ? "border-brand-gold" : "border-transparent opacity-70 hover:opacity-100")}
            >
              {m.type === "VIDEO" ? (
                <span className="flex size-full items-center justify-center bg-muted text-gold-text">
                  <PlayIcon className="size-6 fill-current" aria-hidden />
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
      {!media.length && (
        <p className="flex items-center gap-2 px-4 text-xs text-muted-foreground md:px-0">
          <ImageIcon className="size-4" aria-hidden /> As fotos deste corte serão publicadas em breve.
        </p>
      )}
    </div>
  )
}

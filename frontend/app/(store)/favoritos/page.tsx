"use client"

import { HeartIcon } from "lucide-react"
import Link from "next/link"
import useSWR from "swr"
import { ProductCard } from "@/components/store/product-card"
import { PageTitle, ShopShell } from "@/components/store/shop-shell"
import { buttonVariants } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useFavorites } from "@/hooks/use-favorites"
import type { ProductCard as Product } from "@/lib/types"

export default function FavoritesPage() {
  const { ids } = useFavorites()
  const { data } = useSWR<Product[]>("/me/favorites")
  const items = data?.filter((p) => ids.has(p.id)) ?? []

  return (
    <ShopShell>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        <PageTitle title="Favoritos" description="Seus cortes salvos para pedir de novo." />
        {!data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HeartIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum favorito ainda</EmptyTitle>
              <EmptyDescription>Toque no coração de um produto para salvá-lo aqui.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/#catalogo" className={buttonVariants({ size: "lg" })}>
                Ver catálogo
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
    </ShopShell>
  )
}

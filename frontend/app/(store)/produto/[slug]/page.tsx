import { ChevronLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Stars } from "@/components/stars"
import { FavoriteButton, ProductCard, ProductSeals } from "@/components/store/product-card"
import { ProductGallery } from "@/components/store/product/gallery"
import { PurchasePanel } from "@/components/store/product/purchase-panel"
import { ProductReviews } from "@/components/store/product/reviews"
import { ShopShell } from "@/components/store/shop-shell"
import { buttonVariants } from "@/components/ui/button"
import { ApiError, serverApi } from "@/lib/api"
import { money, shortDate, unitLong } from "@/lib/format"
import type { ProductCard as Card, ProductDetail } from "@/lib/types"

type Data = { product: ProductDetail; related: Card[] }

async function load(slug: string): Promise<Data> {
  try {
    return await serverApi<Data>(`/catalog/products/${encodeURIComponent(slug)}`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound()
    throw e
  }
}

export async function generateMetadata(props: PageProps<"/produto/[slug]">): Promise<Metadata> {
  const { slug } = await props.params
  const { product } = await load(slug)
  return { title: product.name, description: product.shortDescription }
}

export default async function ProductPage(props: PageProps<"/produto/[slug]">) {
  const { slug } = await props.params
  const { product, related } = await load(slug)

  return (
    <ShopShell>
      <main className="mx-auto max-w-6xl pb-28 md:px-4 md:pt-6 md:pb-12">
        <Link href="/#catalogo" className={buttonVariants({ variant: "ghost", className: "mx-2 my-2 md:mx-0" })}>
          <ChevronLeftIcon data-icon="inline-start" />
          Catálogo
        </Link>
        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          <div className="relative">
            <ProductGallery product={product} />
            <FavoriteButton productId={product.id} name={product.name} className="absolute top-3 right-3 size-11" />
          </div>
          <div className="flex flex-col gap-6 px-4 md:px-0">
            <div className="flex flex-col gap-3">
              <ProductSeals product={product} />
              <p className="label-caps text-muted-foreground">{product.category.name}</p>
              <h1 className="font-display text-4xl md:text-5xl">{product.name}</h1>
              {product.ratingCount > 0 && (
                <a href="#avaliacoes" className="flex items-center gap-2 text-sm">
                  <Stars value={product.ratingAvg} />
                  <b>{product.ratingAvg.toLocaleString("pt-BR")}</b>
                  <span className="text-muted-foreground">· {product.ratingCount} avaliações</span>
                </a>
              )}
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-heading text-4xl font-semibold text-gold-text">{money(product.priceCents)}</span>
                <span className="text-muted-foreground">{unitLong[product.unit]}</span>
                {product.offer && <span className="text-muted-foreground line-through">{money(product.listPriceCents)}</span>}
              </div>
              {product.offer?.endsAt && <p className="text-sm text-muted-foreground">Oferta válida até {shortDate(product.offer.endsAt)} ou enquanto durar o estoque.</p>}
              {product.shortDescription && <p className="text-muted-foreground">{product.shortDescription}</p>}
            </div>
            <PurchasePanel product={product} />
          </div>
        </div>

        <div className="mt-10 grid gap-10 px-4 md:grid-cols-2 md:px-0">
          {product.description && (
            <section aria-labelledby="descricao">
              <h2 id="descricao" className="font-display text-3xl">
                Descrição
              </h2>
              <div className="prose-product mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{product.description}</ReactMarkdown>
              </div>
            </section>
          )}
          <ProductReviews productId={product.id} productName={product.name} ratingAvg={product.ratingAvg} ratingCount={product.ratingCount} />
        </div>

        {related.length > 0 && (
          <section className="mt-12 flex flex-col gap-4 px-4 md:px-0" aria-labelledby="combina">
            <h2 id="combina" className="font-display text-3xl">
              Combina com
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>
    </ShopShell>
  )
}

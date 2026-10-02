import { ArrowRightIcon, AwardIcon, ShieldCheckIcon, TruckIcon } from "lucide-react"
import Link from "next/link"
import { ProductImage } from "@/components/product-image"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { money, unitLabel } from "@/lib/format"
import type { ProductCard as Product } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ProductCard } from "../product-card"

export function BenefitsBar() {
  const items = [
    { icon: AwardIcon, title: "Qualidade", text: "Cortes selecionados" },
    { icon: TruckIcon, title: "Entrega", text: "No seu bairro" },
    { icon: ShieldCheckIcon, title: "Confiança", text: "Pix, crédito e débito" },
  ]
  return (
    <section aria-label="Diferenciais" className="border-b">
      <ul className="mx-auto grid max-w-6xl grid-cols-3 gap-2 px-4 py-6">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} data-reveal className="flex flex-col items-center gap-1.5 text-center md:flex-row md:justify-center md:gap-3 md:text-left">
            <span className="flex size-11 items-center justify-center rounded-full border border-brand-gold-dark text-gold-text">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="font-heading text-sm font-semibold tracking-wider uppercase">{title}</span>
              <span className="text-xs text-muted-foreground">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {eyebrow && <span className="label-caps text-gold-text">{eyebrow}</span>}
        <h2 className="font-display text-3xl md:text-4xl">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function OffersSection({ offers }: { offers: Product[] }) {
  if (!offers.length) return null
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-10" aria-labelledby="ofertas">
      <SectionHeading
        eyebrow="Por tempo limitado"
        title="Ofertas da semana"
        action={
          <Link href="/?ofertas=1#catalogo" className="text-sm font-semibold text-gold-text hover:underline">
            Ver todas
          </Link>
        }
      />
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2">
        {offers.map((p) => (
          <div key={p.id} data-reveal className="w-60 shrink-0 snap-start md:w-64">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      <span id="ofertas" className="sr-only">
        Ofertas da semana
      </span>
    </section>
  )
}

export function NovidadesCard({ products }: { products: Product[] }) {
  if (!products.length) return null
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10" aria-labelledby="novidades-title">
      <div data-reveal className="flex flex-col gap-1 rounded-2xl border border-brand-gold-dark bg-[#0b0b0b] p-5 md:flex-row md:gap-8 md:p-8">
        <div className="flex flex-col gap-2 md:w-72 md:shrink-0">
          <div className="flex items-center justify-between">
            <Badge className="rounded-sm font-heading tracking-widest uppercase">Novidades</Badge>
            <span className="text-xs text-muted-foreground md:hidden">{products.length} produtos novos</span>
          </div>
          <h2 id="novidades-title" className="mt-2 font-display text-4xl">
            Chegou no balcão
          </h2>
          <p className="text-sm text-muted-foreground">Cortes que acabaram de entrar no catálogo.</p>
        </div>
        <ul className="mt-3 flex flex-1 flex-col md:mt-0">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/produto/${p.slug}`} className="flex items-center gap-3 border-t py-3 hover:bg-white/[0.02]">
                <ProductImage src={p.coverUrl} alt={p.name} className="size-15 shrink-0 rounded-lg" iconClassName="size-6" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.category.name}
                    {p.available ? "" : " · esgotado"}
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="font-heading text-base font-semibold text-gold-text">{money(p.priceCents)}</span>
                  <span className="text-[11px] text-muted-foreground">/{unitLabel[p.unit]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Link href="/?novidades=1#catalogo" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-3 w-full md:hidden")}>
        Ver catálogo completo
        <ArrowRightIcon data-icon="inline-end" />
      </Link>
    </section>
  )
}

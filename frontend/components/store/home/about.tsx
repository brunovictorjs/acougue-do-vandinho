"use client"

import { ClockIcon, CreditCardIcon, MapPinIcon, MessageCircleIcon, NavigationIcon, TruckIcon } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/brand"
import { LazyMap } from "@/components/maps/map"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { StoreInfo } from "@/lib/types"
import { cn } from "@/lib/utils"

export function About({ store }: { store: StoreInfo }) {
  const rows = [
    { icon: MapPinIcon, title: "Endereço", text: store.addressLine || "Endereço não informado" },
    { icon: ClockIcon, title: "Horário", text: store.hours.length ? store.hours.map((h) => `${h.label}: ${h.value}`).join(" · ") : "Consulte a loja" },
    { icon: TruckIcon, title: "Entrega", text: "Taxa por bairro, somada ao pedido. Retirada no balcão sem custo." },
    { icon: CreditCardIcon, title: "Pagamento", text: "Pix, cartão de crédito e débito — pelo site, com segurança Stripe." },
  ]
  const hasMap = store.latitude != null && store.longitude != null
  const directions = hasMap ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}` : `https://www.google.com/maps/search/${encodeURIComponent(store.addressLine)}`
  return (
    <section className="mx-auto mt-16 max-w-6xl border-t px-4 pt-12" aria-labelledby="sobre">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-4" data-reveal>
          <span className="label-caps text-gold-text">O açougue</span>
          <h2 id="sobre" className="font-display text-4xl md:text-5xl">
            Tradição de balcão, atendimento de bairro.
          </h2>
          {store.about && <p className="text-muted-foreground">{store.about}</p>}
          <ul className="flex flex-col">
            {rows.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4 border-t py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-gold-text">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="label-caps text-muted-foreground">{title}</span>
                  <span className="text-sm">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3" data-reveal>
          {hasMap && (
            <div className="h-64 overflow-hidden rounded-xl border md:h-full md:min-h-80">
              <LazyMap className="size-full" interactive={false} points={[{ lat: store.latitude!, lng: store.longitude!, label: store.name, kind: "store" }]} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <a href={directions} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              <NavigationIcon data-icon="inline-start" />
              Como chegar
            </a>
            {store.whatsapp && (
              <a href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                <MessageCircleIcon data-icon="inline-start" />
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function Footer({ store }: { store: StoreInfo }) {
  return (
    <footer className="mt-16 border-t border-brand-gold-dark bg-[#0a0a0a]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Logo size={56} />
          <span className="font-heading text-sm tracking-widest text-muted-foreground uppercase">Qualidade · Atendimento · Confiança</span>
        </div>
        <nav className="flex gap-5 text-sm" aria-label="Rodapé">
          <Link href="/pedidos" className="text-muted-foreground hover:text-foreground">
            Meus pedidos
          </Link>
          {store.whatsapp && (
            <a href={`https://wa.me/${store.whatsapp}`} className="text-muted-foreground hover:text-foreground">
              Fale com a gente
            </a>
          )}
        </nav>
      </div>
      <Separator />
      <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} {store.name}
        {store.cnpj ? ` · CNPJ ${store.cnpj}` : ""}
      </p>
    </footer>
  )
}

import { Reveal } from "@/components/anim/reveal"
import { About, Footer } from "@/components/store/home/about"
import { Catalog } from "@/components/store/home/catalog"
import { Hero } from "@/components/store/home/hero"
import { BenefitsBar, NovidadesCard, OffersSection } from "@/components/store/home/sections"
import { ShopShell } from "@/components/store/shop-shell"
import { serverApi } from "@/lib/api"
import type { CatalogHome, ProductList, StoreInfo } from "@/lib/types"

export default async function HomePage(props: PageProps<"/">) {
  const params = await props.searchParams
  const [home, initial, store] = await Promise.all([
    serverApi<CatalogHome>("/catalog/home"),
    serverApi<ProductList>("/catalog/products?page=1&pageSize=12&sort=popular"),
    serverApi<StoreInfo>("/store"),
  ])

  return (
    <ShopShell>
      <main>
        <Hero whatsapp={store.whatsapp} />
        <Reveal>
          <BenefitsBar />
          <OffersSection offers={home.offers} />
          <NovidadesCard products={home.novidades} />
          <Catalog categories={home.categories} initial={initial} offersFirst={params.ofertas === "1"} newestFirst={params.novidades === "1"} />
          <About store={store} />
        </Reveal>
      </main>
      <Footer store={store} />
    </ShopShell>
  )
}

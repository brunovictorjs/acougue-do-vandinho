import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Footer } from "@/components/store/home/about"
import { ShopShell } from "@/components/store/shop-shell"
import { serverApi } from "@/lib/api"
import type { StoreInfo, StoreLegal } from "@/lib/types"

/** Layout comum dos documentos legais públicos (/privacidade e /termos), escritos em Markdown no painel. */
export async function LegalPage({ doc, title }: { doc: "privacy" | "terms"; title: string }) {
  const [legal, store] = await Promise.all([serverApi<StoreLegal>("/store/legal"), serverApi<StoreInfo>("/store")])
  const { markdown, updatedAt } = legal[doc]

  return (
    <ShopShell>
      <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <header className="flex flex-col gap-2 border-b pb-6">
          <span className="label-caps text-gold-text">{store.name}</span>
          <h1 className="font-display text-4xl md:text-5xl">{title}</h1>
          {updatedAt && <p className="text-sm text-muted-foreground">Última atualização em {new Date(updatedAt).toLocaleDateString("pt-BR")}</p>}
        </header>
        <article className="prose-product mt-8">
          {markdown.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          ) : (
            <p>
              Este documento ainda não foi publicado.
              {store.whatsapp ? (
                <>
                  {" "}
                  Fale com a gente pelo <a href={`https://wa.me/${store.whatsapp}`}>WhatsApp</a> para mais informações.
                </>
              ) : null}
            </p>
          )}
        </article>
      </main>
      <Footer store={store} />
    </ShopShell>
  )
}

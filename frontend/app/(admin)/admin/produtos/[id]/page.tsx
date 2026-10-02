"use client"

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronLeftIcon, PlayIcon, PlusIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { api, errorMessage } from "@/lib/api"
import { money, shortDate } from "@/lib/format"
import type { Unit } from "@/lib/types"

type Media = { id: string; type: "IMAGE" | "VIDEO"; url: string; alt: string; position: number }
type Product = {
  id: string
  name: string
  slug: string
  categoryId: string
  unit: Unit
  priceCents: number
  shortDescription: string
  description: string
  published: boolean
  available: boolean
  isNew: boolean
  newUntil: string | null
  cutOptions: string[]
  minQuantity: number
  quantityStep: number
  media: Media[]
  activeOffer: null | { name: string; priceCents: number; discountPercent: number; endsAt: string | null }
}
type Category = { id: string; name: string }

const UNITS = [
  { value: "KG", label: "Quilo (kg)" },
  { value: "UNIT", label: "Unidade" },
  { value: "PACK", label: "Pacote" },
]

const toMoneyInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",")
const parseMoney = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100)
const toDecimal = (n: number) => String(n).replace(".", ",")
const parseDecimal = (v: string) => Number(v.replace(",", "."))

interface FormState {
  name: string
  slug: string
  categoryId: string
  unit: Unit
  price: string
  shortDescription: string
  description: string
  published: boolean
  available: boolean
  isNew: boolean
  newUntil: string
  cutOptions: string[]
  minQuantity: string
  quantityStep: string
}

const blank: FormState = {
  name: "",
  slug: "",
  categoryId: "",
  unit: "KG",
  price: "",
  shortDescription: "",
  description: "",
  published: true,
  available: true,
  isNew: true,
  newUntil: "",
  cutOptions: [],
  minQuantity: "0,5",
  quantityStep: "0,5",
}

function MediaManager({ product, onChange }: { product: Product; onChange: () => void }) {
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(0)

  async function upload(files: FileList) {
    setUploading(files.length)
    for (const f of Array.from(files)) {
      const form = new FormData()
      form.append("file", f)
      try {
        await api(`/admin/products/${product.id}/media`, { form })
      } catch (e) {
        toast.error(`${f.name}: ${errorMessage(e)}`)
      }
      setUploading((n) => n - 1)
    }
    onChange()
  }

  async function move(index: number, dir: -1 | 1) {
    const ids = product.media.map((m) => m.id)
    const [it] = ids.splice(index, 1)
    ids.splice(index + dir, 0, it)
    await api(`/admin/products/${product.id}/media/order`, { method: "PUT", body: { ids } })
    onChange()
  }

  async function remove(m: Media) {
    await api(`/admin/products/${product.id}/media/${m.id}`, { method: "DELETE" })
    onChange()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="label-caps text-sm">Fotos e vídeos</CardTitle>
        <CardDescription>A primeira foto é a capa do produto. Use as setas para ordenar.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {product.media.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {product.media.map((m, i) => (
              <li key={m.id} className="group relative overflow-hidden rounded-lg border bg-muted">
                {m.type === "VIDEO" ? (
                  <div className="flex aspect-square items-center justify-center bg-black text-brand-gold">
                    <PlayIcon className="size-8 fill-current" aria-hidden />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.alt} className="aspect-square w-full object-cover" />
                )}
                {i === 0 && m.type === "IMAGE" && <Badge className="absolute top-2 left-2 rounded-sm">Capa</Badge>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 p-1">
                  <Button type="button" size="icon-sm" variant="ghost" className="text-white" aria-label="Mover para a esquerda" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowLeftIcon />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" className="text-white" aria-label="Excluir mídia" onClick={() => remove(m)}>
                    <Trash2Icon />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" className="text-white" aria-label="Mover para a direita" disabled={i === product.media.length - 1} onClick={() => move(i, 1)}>
                    <ArrowRightIcon />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
          }}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:border-ring"
        >
          {uploading ? <Spinner /> : <UploadIcon className="size-6 text-gold-text" aria-hidden />}
          <span className="font-semibold">{uploading ? `Enviando ${uploading}…` : "Arraste arquivos ou clique para enviar"}</span>
          <span className="text-xs text-muted-foreground">JPG, PNG ou WEBP até 5 MB · MP4 ou WEBM até 50 MB</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          className="sr-only"
          aria-label="Enviar fotos ou vídeos"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files)
            e.target.value = ""
          }}
        />
      </CardContent>
    </Card>
  )
}

function formFrom(product: Product): FormState {
  return {
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    unit: product.unit,
    price: toMoneyInput(product.priceCents),
    shortDescription: product.shortDescription,
    description: product.description,
    published: product.published,
    available: product.available,
    isNew: product.isNew,
    newUntil: product.newUntil ? product.newUntil.slice(0, 10) : "",
    cutOptions: product.cutOptions,
    minQuantity: toDecimal(product.minQuantity),
    quantityStep: toDecimal(product.quantityStep),
  }
}

export default function ProductEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === "novo"
  const { data: categories } = useSWR<Category[]>("/admin/categories")
  const { data: product, mutate } = useSWR<Product>(isNew ? null : `/admin/products/${id}`)

  if (!categories || (!isNew && !product)) {
    return (
      <AdminPage title="Produto">
        <Skeleton className="h-96" />
      </AdminPage>
    )
  }
  const initial = product ? formFrom(product) : { ...blank, categoryId: categories[0]?.id ?? "" }
  return <ProductEditor key={id} id={id} isNew={isNew} initial={initial} categories={categories} product={product} onProductChange={(p) => void mutate(p, { revalidate: false })} reload={() => void mutate()} />
}

/** The form is mounted once the data is loaded, so its state starts from it. */
function ProductEditor({
  id,
  isNew,
  initial,
  categories,
  product,
  onProductChange,
  reload,
}: {
  id: string
  isNew: boolean
  initial: FormState
  categories: Category[]
  product: Product | undefined
  onProductChange: (p: Product) => void
  reload: () => void
}) {
  const router = useRouter()
  const [f, setF] = React.useState<FormState>(initial)
  const [cut, setCut] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const body = {
        name: f.name,
        slug: f.slug || undefined,
        categoryId: f.categoryId,
        unit: f.unit,
        priceCents: parseMoney(f.price),
        shortDescription: f.shortDescription,
        description: f.description,
        published: f.published,
        available: f.available,
        isNew: f.isNew,
        newUntil: f.isNew && f.newUntil ? new Date(`${f.newUntil}T23:59:59`).toISOString() : null,
        cutOptions: f.cutOptions,
        minQuantity: parseDecimal(f.minQuantity),
        quantityStep: parseDecimal(f.quantityStep),
      }
      const saved = await api<Product>(isNew ? "/admin/products" : `/admin/products/${id}`, { method: isNew ? "POST" : "PUT", body })
      toast.success("Produto salvo")
      if (isNew) router.replace(`/admin/produtos/${saved.id}`)
      else onProductChange(saved)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    try {
      const r = await api<{ archived: boolean }>(`/admin/products/${id}`, { method: "DELETE" })
      toast.success(r.archived ? "O produto tem pedidos, então foi despublicado em vez de excluído." : "Produto excluído")
      router.push("/admin/produtos")
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const catItems = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <AdminPage
      title={isNew ? "Novo produto" : "Editar produto"}
      description={isNew ? "Preencha e salve; as fotos são enviadas depois de salvar." : product?.name}
      actions={
        <>
          <Link href="/admin/produtos" className={buttonVariants({ variant: "outline" })}>
            <ChevronLeftIcon data-icon="inline-start" /> Produtos
          </Link>
          {!isNew && (
            <a href={`/produto/${product?.slug}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
              Ver na loja
            </a>
          )}
          <Button size="lg" type="submit" form="product-form" disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
            Salvar produto
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={save} className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="label-caps text-sm">Informações</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="p-name">Nome do produto</FieldLabel>
                  <Input id="p-name" value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={100} />
                </Field>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel>Categoria</FieldLabel>
                    <Select items={catItems} value={f.categoryId} onValueChange={(v) => v && set("categoryId", v)}>
                      <SelectTrigger className="w-full" aria-label="Categoria">
                        <SelectValue placeholder="Escolha" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {catItems.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Vendido por</FieldLabel>
                    <Select items={UNITS} value={f.unit} onValueChange={(v) => v && set("unit", v as Unit)}>
                      <SelectTrigger className="w-full" aria-label="Unidade">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {UNITS.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="p-price">Preço</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>R$</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput id="p-price" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value.replace(/[^\d,.]/g, ""))} required placeholder="0,00" />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>/{f.unit === "KG" ? "kg" : f.unit === "PACK" ? "pct" : "un"}</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="p-short">Descrição curta</FieldLabel>
                  <Input id="p-short" value={f.shortDescription} maxLength={200} onChange={(e) => set("shortDescription", e.target.value)} />
                  <FieldDescription>Aparece no card e nas buscas do atendente virtual.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="p-slug">Endereço na loja</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>/produto/</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput id="p-slug" value={f.slug} placeholder="gerado a partir do nome" onChange={(e) => set("slug", e.target.value)} />
                  </InputGroup>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="label-caps text-sm">Descrição detalhada</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownEditor id="p-desc" value={f.description} onChange={(v) => set("description", v)} />
            </CardContent>
          </Card>

          {isNew ? (
            <Alert>
              <UploadIcon />
              <AlertDescription>Salve o produto para enviar fotos e vídeos.</AlertDescription>
            </Alert>
          ) : (
            product && <MediaManager product={product} onChange={reload} />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="label-caps text-sm">Publicação</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {(
                  [
                    ["published", "Publicado", "Visível no catálogo"],
                    ["available", "Disponível", "Desligue quando acabar o estoque"],
                    ["isNew", "Novidade", "Entra no card “Chegou no balcão”"],
                  ] as const
                ).map(([key, title, desc]) => (
                  <Field key={key} orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>{title}</FieldTitle>
                      <FieldDescription>{desc}</FieldDescription>
                    </FieldContent>
                    <Switch checked={f[key]} onCheckedChange={(v) => set(key, v)} aria-label={title} />
                  </Field>
                ))}
                {f.isNew && (
                  <Field>
                    <FieldLabel htmlFor="p-new-until">Novidade até</FieldLabel>
                    <Input id="p-new-until" type="date" value={f.newUntil} onChange={(e) => set("newUntil", e.target.value)} />
                  </Field>
                )}
              </FieldGroup>
            </CardContent>
          </Card>

          {!isNew && (
            <Card>
              <CardHeader>
                <CardTitle className="label-caps text-sm">Oferta ativa</CardTitle>
                <CardAction>
                  <Link href="/admin/ofertas" className="text-sm font-semibold text-gold-text hover:underline">
                    Gerenciar
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="text-sm">
                {product?.activeOffer ? (
                  <div className="flex flex-col gap-1 rounded-lg bg-accent p-3">
                    <span className="font-semibold">{product.activeOffer.name}</span>
                    <span>
                      De <span className="line-through">{money(product.priceCents)}</span> por <b>{money(product.activeOffer.priceCents)}</b> (−{product.activeOffer.discountPercent}%)
                    </span>
                    {product.activeOffer.endsAt && <span className="text-xs text-muted-foreground">Até {shortDate(product.activeOffer.endsAt)}</span>}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhuma oferta ativa para este produto.</span>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="label-caps text-sm">Opções de corte</CardTitle>
              <CardDescription>O cliente escolhe uma ao adicionar ao carrinho.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {f.cutOptions.map((c) => (
                  <Badge key={c} variant="secondary" className="h-8 gap-1 pr-1 pl-3 text-sm">
                    {c}
                    <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remover ${c}`} onClick={() => set("cutOptions", f.cutOptions.filter((x) => x !== c))}>
                      <XIcon />
                    </Button>
                  </Badge>
                ))}
                {!f.cutOptions.length && <span className="text-sm text-muted-foreground">Sem opções (produto vendido como está).</span>}
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label="Nova opção de corte"
                  placeholder="Ex.: Em bifes"
                  value={cut}
                  onChange={(e) => setCut(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (cut.trim() && !f.cutOptions.includes(cut.trim())) set("cutOptions", [...f.cutOptions, cut.trim()])
                      setCut("")
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  aria-label="Adicionar opção"
                  onClick={() => {
                    if (cut.trim() && !f.cutOptions.includes(cut.trim())) set("cutOptions", [...f.cutOptions, cut.trim()])
                    setCut("")
                  }}
                >
                  <PlusIcon />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="label-caps text-sm">Quantidade</CardTitle>
              <CardDescription>{f.unit === "KG" ? "Em kg. O valor final é confirmado na balança." : "Em unidades."}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="p-min">Mínimo</FieldLabel>
                <Input id="p-min" inputMode="decimal" value={f.minQuantity} onChange={(e) => set("minQuantity", e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-step">Incremento</FieldLabel>
                <Input id="p-step" inputMode="decimal" value={f.quantityStep} onChange={(e) => set("quantityStep", e.target.value)} required />
              </Field>
            </CardContent>
          </Card>

          {!isNew && (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon data-icon="inline-start" /> Excluir produto
            </Button>
          )}
        </div>
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{product?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Se o produto já foi vendido, ele é apenas despublicado para manter o histórico dos pedidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  )
}

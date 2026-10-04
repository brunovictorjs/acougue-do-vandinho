"use client"

import { CheckIcon, ExternalLinkIcon, FileTextIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { LazyMap } from "@/components/maps/map"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage } from "@/lib/api"
import { money } from "@/lib/format"

type Settings = {
  name: string
  cnpj: string
  whatsapp: string
  addressLine: string
  latitude: number | null
  longitude: number | null
  hours: Array<{ label: string; value: string }>
  about: string
  pixExpirationMinutes: number
  privacyPolicy: string
  privacyUpdatedAt: string | null
  terms: string
  termsUpdatedAt: string | null
}
type LegalTemplates = { privacyPolicy: string; terms: string }
type Zone = { id: string; neighborhood: string; feeCents: number; etaMinutes: number; active: boolean }

const formatCoords = (lat: number | null, lng: number | null) => (lat != null && lng != null ? `${lat.toFixed(7)}, ${lng.toFixed(7)}` : "")

function StoreTab({ s, onSaved }: { s: Settings; onSaved: () => void }) {
  const [v, setV] = React.useState(s)
  const [busy, setBusy] = React.useState(false)
  const set = <K extends keyof Settings>(k: K, value: Settings[K]) => setV((x) => ({ ...x, [k]: value }))

  const [coords, setCoords] = React.useState(formatCoords(s.latitude, s.longitude))

  /** Places the pin from "lat, lng" (as copied from Google Maps); with the field empty, searches the address instead. */
  async function locate() {
    const m = coords.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/)
    if (m) {
      const lat = Number(m[1])
      const lng = Number(m[2])
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return toast.error("Coordenadas fora do intervalo válido.")
      setV((x) => ({ ...x, latitude: lat, longitude: lng }))
      return
    }
    if (coords.trim()) return toast.error("Use o formato latitude, longitude — ex.: -8.3294765, -34.9568481")
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(v.addressLine)}`)
      const rows = (await res.json()) as Array<{ lat: string; lon: string }>
      if (!rows.length) throw new Error("Endereço não encontrado no mapa. Informe as coordenadas ou arraste o pino.")
      const lat = Number(rows[0].lat)
      const lng = Number(rows[0].lon)
      setV((x) => ({ ...x, latitude: lat, longitude: lng }))
      setCoords(formatCoords(lat, lng))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function save() {
    setBusy(true)
    try {
      await api("/admin/settings", {
        method: "PATCH",
        body: { name: v.name, cnpj: v.cnpj, whatsapp: v.whatsapp.replace(/\D/g, ""), addressLine: v.addressLine, about: v.about, hours: v.hours, latitude: v.latitude ?? undefined, longitude: v.longitude ?? undefined },
      })
      toast.success("Configurações salvas")
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="label-caps text-sm">Dados da loja</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="s-name">Nome</FieldLabel>
              <Input id="s-name" value={v.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="s-cnpj">CNPJ</FieldLabel>
                <Input id="s-cnpj" value={v.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="s-wa">WhatsApp da loja</FieldLabel>
                <Input id="s-wa" value={v.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="5511900000000" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="s-about">Sobre a loja (aparece na página inicial)</FieldLabel>
              <Textarea id="s-about" rows={4} value={v.about} onChange={(e) => set("about", e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Horário de funcionamento</FieldLabel>
              <div className="flex flex-col gap-2">
                {v.hours.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <Input aria-label="Dias" value={h.label} onChange={(e) => set("hours", v.hours.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Seg a sex" />
                    <Input aria-label="Horário" value={h.value} onChange={(e) => set("hours", v.hours.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="08:00 às 19:00" />
                    <Button variant="ghost" size="icon-lg" aria-label="Remover horário" onClick={() => set("hours", v.hours.filter((_, j) => j !== i))}>
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" className="self-start" onClick={() => set("hours", [...v.hours, { label: "", value: "" }])}>
                  <PlusIcon data-icon="inline-start" /> Adicionar linha
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="label-caps text-sm">Endereço e localização</CardTitle>
          <CardDescription>Usados na retirada (mensagem com localização no WhatsApp) e como ponto de partida das rotas.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="s-addr">Endereço</FieldLabel>
            <Input id="s-addr" value={v.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
            <FieldDescription>Texto exibido para os clientes.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="s-coords">Coordenadas</FieldLabel>
            <div className="flex gap-2">
              <Input id="s-coords" inputMode="decimal" placeholder="-8.3294765, -34.9568481" value={coords} onChange={(e) => setCoords(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void locate()} />
              <Button variant="outline" onClick={locate}>
                Localizar
              </Button>
            </div>
            <FieldDescription>Não aparece para os clientes. Cole a latitude e a longitude do Google Maps (clique com o botão direito no local) e toque em Localizar.</FieldDescription>
          </Field>
          <div className="h-72 overflow-hidden rounded-xl border">
            <LazyMap
              className="size-full"
              points={[{ lat: v.latitude ?? -23.5475, lng: v.longitude ?? -46.6361, label: v.name, kind: "pin" }]}
              onMove={(lat, lng) => {
                setV((x) => ({ ...x, latitude: lat, longitude: lng }))
                setCoords(formatCoords(lat, lng))
              }}
            />
          </div>
          <FieldDescription>Arraste o pino para ajustar — o campo de coordenadas acompanha.</FieldDescription>
        </CardContent>
        <CardFooter>
          <Button size="lg" disabled={busy} onClick={save}>
            {busy ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
            Salvar dados da loja
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function ZonesTab() {
  const { data, mutate } = useSWR<Zone[]>("/admin/delivery-zones")
  const [edit, setEdit] = React.useState<{ id?: string; neighborhood: string; fee: string; eta: string; active: boolean } | null>(null)

  async function save() {
    if (!edit) return
    try {
      const body = { neighborhood: edit.neighborhood, feeCents: Math.round(Number(edit.fee.replace(",", ".")) * 100), etaMinutes: Number(edit.eta), active: edit.active }
      await api(edit.id ? `/admin/delivery-zones/${edit.id}` : "/admin/delivery-zones", { method: edit.id ? "PUT" : "POST", body })
      setEdit(null)
      void mutate()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  async function remove(z: Zone) {
    await api(`/admin/delivery-zones/${z.id}`, { method: "DELETE" })
    void mutate()
  }
  async function toggle(z: Zone, active: boolean) {
    await api(`/admin/delivery-zones/${z.id}`, { method: "PUT", body: { neighborhood: z.neighborhood, feeCents: z.feeCents, etaMinutes: z.etaMinutes, active } })
    void mutate()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="label-caps text-sm">Bairros atendidos</CardTitle>
        <CardDescription>A taxa é somada ao pedido. Endereços em bairros fora da lista só podem retirar na loja.</CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-48" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bairro</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((z) =>
                edit?.id === z.id ? null : (
                  <TableRow key={z.id}>
                    <TableCell className="font-semibold">{z.neighborhood}</TableCell>
                    <TableCell>{money(z.feeCents)}</TableCell>
                    <TableCell>até {z.etaMinutes} min</TableCell>
                    <TableCell>
                      <Switch checked={z.active} onCheckedChange={(v) => toggle(z, v)} aria-label={`Ativar ${z.neighborhood}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${z.neighborhood}`} onClick={() => setEdit({ id: z.id, neighborhood: z.neighborhood, fee: (z.feeCents / 100).toFixed(2).replace(".", ","), eta: String(z.etaMinutes), active: z.active })}>
                          <PencilIcon />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Excluir ${z.neighborhood}`} onClick={() => remove(z)}>
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
              {edit && (
                <TableRow>
                  <TableCell>
                    <Input aria-label="Bairro" value={edit.neighborhood} onChange={(e) => setEdit({ ...edit, neighborhood: e.target.value })} placeholder="Nome do bairro" autoFocus />
                  </TableCell>
                  <TableCell>
                    <InputGroup className="w-32">
                      <InputGroupAddon>
                        <InputGroupText>R$</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput aria-label="Taxa" inputMode="decimal" value={edit.fee} onChange={(e) => setEdit({ ...edit, fee: e.target.value })} />
                    </InputGroup>
                  </TableCell>
                  <TableCell>
                    <InputGroup className="w-32">
                      <InputGroupInput aria-label="Prazo em minutos" inputMode="numeric" value={edit.eta} onChange={(e) => setEdit({ ...edit, eta: e.target.value.replace(/\D/g, "") })} />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>min</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </TableCell>
                  <TableCell>
                    <Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} aria-label="Ativo" />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" aria-label="Salvar bairro" onClick={save}>
                        <CheckIcon />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Cancelar" onClick={() => setEdit(null)}>
                        <XIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" disabled={!!edit} onClick={() => setEdit({ neighborhood: "", fee: "8,00", eta: "60", active: true })}>
          <PlusIcon data-icon="inline-start" /> Adicionar bairro
        </Button>
      </CardFooter>
    </Card>
  )
}

function PaymentsTab({ s, onSaved }: { s: Settings; onSaved: () => void }) {
  const { data: cfg } = useSWR<{ provider: "fake" | "stripe" }>("/payments/config")
  const [minutes, setMinutes] = React.useState(String(s.pixExpirationMinutes))
  async function save() {
    try {
      await api("/admin/settings", { method: "PATCH", body: { pixExpirationMinutes: Number(minutes) } })
      toast.success("Salvo")
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="label-caps text-sm">Stripe</CardTitle>
          <CardDescription>Pix, cartão de crédito e débito</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {cfg?.provider === "stripe" ? <Badge className="bg-success/15 text-success">Stripe ativo</Badge> : <Badge className="bg-warning/15 text-warning">Pagamentos simulados (modo de testes)</Badge>}
          <Alert>
            <AlertDescription>
              Para usar o Stripe: defina PAYMENT_PROVIDER=stripe, STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET na API e NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no frontend. Ative Pix e cartões em Configurações › Formas de pagamento no Dashboard do Stripe. Reembolsos de pedidos cancelados são criados automaticamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="label-caps text-sm">Prazo para pagar</CardTitle>
          <CardDescription>Validade do QR Code Pix / sessão de pagamento (o Stripe exige no mínimo 30 minutos).</CardDescription>
        </CardHeader>
        <CardContent>
          <InputGroup className="w-40">
            <InputGroupInput aria-label="Minutos" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} />
            <InputGroupAddon align="inline-end">
              <InputGroupText>minutos</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </CardContent>
        <CardFooter>
          <Button onClick={save}>Salvar</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/** Documentos públicos exigidos na verificação do Google OAuth: /privacidade e /termos. */
function LegalTab({ s, field, onSaved }: { s: Settings; field: "privacyPolicy" | "terms"; onSaved: () => void }) {
  const doc = field === "privacyPolicy" ? { title: "Política de Privacidade", href: "/privacidade", updatedAt: s.privacyUpdatedAt } : { title: "Termos de Serviço", href: "/termos", updatedAt: s.termsUpdatedAt }
  const [v, setV] = React.useState(s[field])
  const [busy, setBusy] = React.useState(false)

  async function loadTemplate() {
    if (v.trim() && !confirm("Isso substitui o texto atual pelo modelo sugerido. Continuar?")) return
    try {
      const t = await api<LegalTemplates>("/admin/settings/legal-templates")
      setV(t[field])
      toast.success("Modelo carregado — revise e publique.")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  async function save() {
    setBusy(true)
    try {
      await api("/admin/settings", { method: "PATCH", body: { [field]: v } })
      toast.success(`${doc.title} publicada`)
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="label-caps text-sm">{doc.title}</CardTitle>
        <CardDescription>
          Publicada em <code className="text-foreground">{doc.href}</code> — use esse endereço na tela de consentimento do Google OAuth.
          {doc.updatedAt ? ` Última atualização em ${new Date(doc.updatedAt).toLocaleDateString("pt-BR")}.` : " Ainda não publicada."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!v.trim() && (
          <Alert>
            <AlertDescription>O documento está vazio e a página pública aparece em branco. Comece pelo modelo sugerido — ele já vem com os dados da loja — e ajuste o que for diferente na sua operação.</AlertDescription>
          </Alert>
        )}
        <MarkdownEditor id={`legal-${field}`} value={v} onChange={setV} />
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button size="lg" disabled={busy} onClick={save}>
          {busy ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
          Publicar
        </Button>
        <Button variant="outline" onClick={loadTemplate}>
          <FileTextIcon data-icon="inline-start" /> Usar modelo sugerido
        </Button>
        <Button variant="ghost" nativeButton={false} render={<Link href={doc.href} target="_blank" />}>
          <ExternalLinkIcon data-icon="inline-start" /> Ver página pública
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function SettingsPage() {
  const { data, mutate } = useSWR<Settings>("/admin/settings")
  return (
    <AdminPage title="Configurações" description="Loja, entrega, pagamentos e páginas legais">
      {!data ? (
        <Skeleton className="h-96" />
      ) : (
        <Tabs defaultValue="loja">
          <TabsList>
            <TabsTrigger value="loja">Loja</TabsTrigger>
            <TabsTrigger value="entrega">Entrega</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
            <TabsTrigger value="privacidade">Privacidade</TabsTrigger>
            <TabsTrigger value="termos">Termos</TabsTrigger>
          </TabsList>
          <TabsContent value="loja" className="mt-4">
            <StoreTab s={data} onSaved={() => void mutate()} />
          </TabsContent>
          <TabsContent value="entrega" className="mt-4">
            <ZonesTab />
          </TabsContent>
          <TabsContent value="pagamentos" className="mt-4">
            <PaymentsTab s={data} onSaved={() => void mutate()} />
          </TabsContent>
          <TabsContent value="privacidade" className="mt-4">
            <LegalTab s={data} field="privacyPolicy" onSaved={() => void mutate()} />
          </TabsContent>
          <TabsContent value="termos" className="mt-4">
            <LegalTab s={data} field="terms" onSaved={() => void mutate()} />
          </TabsContent>
        </Tabs>
      )}
    </AdminPage>
  )
}

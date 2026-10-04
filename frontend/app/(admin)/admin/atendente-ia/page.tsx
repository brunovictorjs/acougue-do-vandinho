"use client"

import { BellIcon, BotIcon, MailIcon, MapPinIcon, MessageCircleIcon, RotateCcwIcon, SendIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { ListPagination, type Paged } from "@/components/list-pagination"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport } from "@/components/ui/message-scroller"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage } from "@/lib/api"
import { dateTime, maskPhoneInput, phone } from "@/lib/format"
import { cn } from "@/lib/utils"

type Stats = { days: number; conversations: number; notifications: number; failed: number; handoffs: number; provider: "log" | "zapi"; email: { provider: "log" | "resend"; recipients: number } }
type Conversation = { phone: string; customerName: string | null; messages: number; lastAt: string; lastMessage: string; handedOff: boolean }
type Msg = { id: string; phone: string; direction: "INBOUND" | "OUTBOUND"; kind: string; body: string; status: string; createdAt: string; meta: Record<string, unknown> | null }
type Info = { engine: string; defaultPrompt: string; guardrails: string; tools: Array<{ name: string; description: string }> }
type Settings = {
  assistantEnabled: boolean
  assistantPrompt: string
  notifications: Record<string, boolean>
  notificationLabels: Record<string, string>
  adminEmailNotifications: Record<string, boolean>
  adminEmailNotificationLabels: Record<string, string>
}

/** WhatsApp formatting (*bold*) rendered for the admin transcript. */
function WaText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g)
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <b key={i}>{p.slice(1, -1)}</b> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </span>
  )
}

function Transcript({ phoneNumber }: { phoneNumber: string }) {
  const { data } = useSWR<Msg[]>(`/admin/whatsapp/conversations/${phoneNumber}`, { refreshInterval: 2000 })
  if (!data) return <Skeleton className="h-full" />
  if (!data.length) return <p className="p-6 text-sm text-muted-foreground">Nenhuma mensagem ainda. Envie uma mensagem de teste abaixo.</p>
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-2 p-4">
            {data.map((m, i) => {
              const day = new Date(m.createdAt).toLocaleDateString("pt-BR")
              const showDay = i === 0 || day !== new Date(data[i - 1].createdAt).toLocaleDateString("pt-BR")
              const mine = m.direction === "INBOUND"
              const tag = m.meta?.template ? `aviso: ${String(m.meta.template)}` : m.meta?.assistant ? "atendente IA" : null
              return (
                <MessageScrollerItem key={m.id} messageId={m.id} scrollAnchor={mine}>
                  {showDay && (
                    <Marker variant="separator" className="my-2">
                      <MarkerContent>{day}</MarkerContent>
                    </Marker>
                  )}
                  <Message align={mine ? "end" : "start"}>
                    <MessageContent>
                      <Bubble variant={mine ? "tinted" : "outline"} align={mine ? "end" : "start"}>
                        <BubbleContent>
                          {m.kind === "location" && (
                            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gold-text">
                              <MapPinIcon className="size-3.5" aria-hidden /> Localização
                            </span>
                          )}
                          <WaText text={m.body} />
                        </BubbleContent>
                      </Bubble>
                      <MessageFooter className={cn("flex gap-2 text-xs text-muted-foreground", mine && "justify-end")}>
                        {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {tag && <span>· {tag}</span>}
                        {m.meta?.handoff === true && <span className="text-info">· enviou atendentes</span>}
                        {m.status === "failed" && <span className="text-destructive">· falhou</span>}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function Conversations() {
  const [page, setPage] = React.useState(1)
  const { data, mutate } = useSWR<Paged<Conversation>>(`/admin/whatsapp/conversations?page=${page}`, { refreshInterval: 5000, keepPreviousData: true })
  const conversations = data?.items
  const [selected, setSelected] = React.useState<string | null>(null)
  const [simPhone, setSimPhone] = React.useState("(11) 98765-4321")
  const [text, setText] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const current = selected ?? conversations?.[0]?.phone ?? null

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      const res = await api<{ phone: string }>("/admin/whatsapp/simulate", { body: { phone: simPhone, text } })
      setText("")
      setSelected(res.phone)
      setPage(1) // the conversation just used is now the most recent
      void mutate()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Card className="py-0">
        <CardHeader className="pt-4">
          <CardTitle className="label-caps text-sm">Conversas</CardTitle>
        </CardHeader>
        <CardContent className="flex max-h-[34rem] flex-col gap-1 overflow-y-auto px-2 pb-2">
          {!conversations ? (
            <Skeleton className="h-40" />
          ) : conversations.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageCircleIcon />
                </EmptyMedia>
                <EmptyTitle>Sem conversas</EmptyTitle>
                <EmptyDescription>Mensagens e avisos aparecem aqui.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            conversations.map((c) => (
              <button
                key={c.phone}
                type="button"
                onClick={() => {
                  setSelected(c.phone)
                  setSimPhone(maskPhoneInput(c.phone.slice(2)))
                }}
                className={cn("flex flex-col gap-0.5 rounded-lg p-3 text-left hover:bg-muted", current === c.phone && "bg-accent")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{c.customerName ?? phone(c.phone)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{dateTime(c.lastAt)}</span>
                </span>
                {c.customerName && <span className="text-xs text-muted-foreground">{phone(c.phone)}</span>}
                <span className="line-clamp-2 text-xs text-muted-foreground">{c.lastMessage}</span>
                {c.handedOff && <Badge className="mt-1 bg-info/15 text-info">Pediu atendente humano</Badge>}
              </button>
            ))
          )}
        </CardContent>
        {data && <ListPagination className="border-t py-2" page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
      </Card>
      <Card className="flex h-[40rem] flex-col gap-0 py-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-sm">{current ? phone(current) : "Simulador"}</CardTitle>
          <CardDescription>Teste o atendente como se fosse um cliente no WhatsApp.</CardDescription>
        </CardHeader>
        <div className="min-h-0 flex-1 bg-muted/40">{current ? <Transcript phoneNumber={current} /> : <p className="p-6 text-sm text-muted-foreground">Envie uma mensagem para começar.</p>}</div>
        <form onSubmit={send} className="flex flex-col gap-2 border-t p-3 sm:flex-row">
          <InputGroup className="sm:max-w-52">
            <InputGroupAddon>
              <InputGroupText>
                <UserRoundIcon /> +55
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput aria-label="Telefone do cliente simulado" value={simPhone} onChange={(e) => setSimPhone(maskPhoneInput(e.target.value))} />
          </InputGroup>
          <InputGroup className="flex-1">
            <InputGroupInput aria-label="Mensagem" placeholder="Ex.: tem picanha hoje?" value={text} onChange={(e) => setText(e.target.value)} />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" disabled={busy || !text.trim()} aria-label="Enviar">
                {busy ? <Spinner /> : <SendIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </Card>
    </div>
  )
}

function Instructions({ info, settings, onSaved }: { info: Info; settings: Settings; onSaved: () => void }) {
  const [prompt, setPrompt] = React.useState(settings.assistantPrompt || info.defaultPrompt)
  const [busy, setBusy] = React.useState(false)

  async function save() {
    setBusy(true)
    try {
      await api("/admin/settings", { method: "PATCH", body: { assistantPrompt: prompt.trim() === info.defaultPrompt.trim() ? "" : prompt } })
      toast.success("Instruções salvas")
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
      <Card>
        <CardHeader>
          <CardTitle className="label-caps text-sm">Instruções do atendente</CardTitle>
          <CardDescription>Diga o que ele pode e não pode fazer. As regras fixas ao lado são sempre aplicadas.</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setPrompt(info.defaultPrompt)}>
              <RotateCcwIcon data-icon="inline-start" /> Restaurar padrão
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea aria-label="Instruções do atendente" rows={22} className="font-mono text-[13px] leading-relaxed" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <Button size="lg" className="self-start" disabled={busy} onClick={save}>
            {busy && <Spinner data-icon="inline-start" />}
            Salvar instruções
          </Button>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>Regras fixas (servidor)</AlertTitle>
          <AlertDescription>
            <pre className="font-sans text-xs whitespace-pre-wrap">{info.guardrails}</pre>
          </AlertDescription>
        </Alert>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="label-caps text-sm">O que a IA pode consultar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {info.tools.map((t) => (
              <div key={t.name} className="flex flex-col">
                <span className="font-mono text-xs font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.description}</span>
              </div>
            ))}
            <p className="rounded-lg bg-muted p-3 text-xs">Pedidos são filtrados pelo telefone que está conversando antes de chegar à IA — ela nunca recebe pedidos de outro cliente.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Um grupo de avisos ligáveis: o PATCH manda o mapa inteiro com a chave trocada. */
function NotificationToggles({
  title,
  description,
  icon,
  field,
  labels,
  values,
  onSaved,
}: {
  title: string
  description: string
  icon: React.ReactNode
  field: "notifications" | "adminEmailNotifications"
  labels: Record<string, string>
  values: Record<string, boolean>
  onSaved: () => void
}) {
  async function toggle(key: string, value: boolean) {
    try {
      await api("/admin/settings", { method: "PATCH", body: { [field]: { ...values, [key]: value } } })
      onSaved()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="label-caps text-sm">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {Object.entries(labels).map(([key, label]) => (
            <Field key={key} orientation="horizontal">
              <span className="text-gold-text" aria-hidden>
                {icon}
              </span>
              <FieldContent>
                <FieldTitle>{label}</FieldTitle>
              </FieldContent>
              <Switch checked={values[key]} onCheckedChange={(v) => toggle(key, v)} aria-label={label} />
            </Field>
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function Notifications({ settings, stats, onSaved }: { settings: Settings; stats?: Stats; onSaved: () => void }) {
  const mail = stats?.email
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <NotificationToggles
        title="Avisos automáticos no WhatsApp"
        description="Enviados só para o telefone de quem fez o pedido."
        icon={<BellIcon className="size-4" />}
        field="notifications"
        labels={settings.notificationLabels}
        values={settings.notifications}
        onSaved={onSaved}
      />
      <div className="flex flex-col gap-4">
        <NotificationToggles
          title="Avisos por e-mail para a administração"
          description={
            mail
              ? `Enviados para ${mail.recipients} ${mail.recipients === 1 ? "administrador" : "administradores"}${mail.provider === "log" ? " — por enquanto só no terminal da API" : ""}.`
              : "Enviados para os e-mails dos usuários administradores."
          }
          icon={<MailIcon className="size-4" />}
          field="adminEmailNotifications"
          labels={settings.adminEmailNotificationLabels}
          values={settings.adminEmailNotifications}
          onSaved={onSaved}
        />
        {mail?.provider === "log" && (
          <Alert>
            <MailIcon aria-hidden />
            <AlertTitle>E-mails em modo de testes</AlertTitle>
            <AlertDescription>
              Para entregar de verdade, configure EMAIL_PROVIDER=resend, RESEND_API_KEY e EMAIL_FROM (domínio verificado) no .env da API.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const { data: stats } = useSWR<Stats>("/admin/whatsapp/stats", { refreshInterval: 15000 })
  const { data: info } = useSWR<Info>("/admin/assistant")
  const { data: settings, mutate } = useSWR<Settings>("/admin/settings")

  async function setEnabled(v: boolean) {
    await api("/admin/settings", { method: "PATCH", body: { assistantEnabled: v } })
    void mutate()
  }

  return (
    <AdminPage title="Atendente IA" description="WhatsApp: atende clientes, consulta pedidos e envia avisos">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="label-caps">WhatsApp</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              {stats?.provider === "zapi" ? <Badge className="bg-success/15 text-success">Z-API conectada</Badge> : <Badge className="bg-warning/15 text-warning">Modo de testes (log)</Badge>}
            </CardTitle>
            <CardDescription>{stats?.provider === "zapi" ? "Mensagens reais" : "Mensagens aparecem no terminal da API e aqui"}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="label-caps">Atendente</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <BotIcon className="size-4 text-gold-text" aria-hidden /> {info?.engine ?? "…"}
            </CardTitle>
            <CardAction>{settings && <Switch checked={settings.assistantEnabled} onCheckedChange={setEnabled} aria-label="Atendente ativo" />}</CardAction>
            <CardDescription>{settings?.assistantEnabled ? "Respondendo automaticamente" : "Desligado — só avisos de pedido"}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="label-caps">Conversas · 7 dias</CardDescription>
            <CardTitle className="font-heading text-3xl font-semibold">{stats?.conversations ?? "—"}</CardTitle>
            <CardDescription>{stats?.handoffs ?? 0} pediram atendente humano</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="label-caps">Avisos · 7 dias</CardDescription>
            <CardTitle className="font-heading text-3xl font-semibold">{stats?.notifications ?? "—"}</CardTitle>
            <CardDescription>{stats?.failed ? `${stats.failed} com falha` : "nenhuma falha de envio"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">Conversas e simulador</TabsTrigger>
          <TabsTrigger value="prompt">Instruções</TabsTrigger>
          <TabsTrigger value="notify">Avisos automáticos</TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="mt-4">
          <Conversations />
        </TabsContent>
        <TabsContent value="prompt" className="mt-4">
          {info && settings ? <Instructions info={info} settings={settings} onSaved={() => void mutate()} /> : <Skeleton className="h-96" />}
        </TabsContent>
        <TabsContent value="notify" className="mt-4">
          {settings ? <Notifications settings={settings} stats={stats} onSaved={() => void mutate()} /> : <Skeleton className="h-64" />}
        </TabsContent>
      </Tabs>
      <Field>
        <FieldLabel className="sr-only">Ajuda</FieldLabel>
        <FieldDescription>
          Para ligar o WhatsApp de verdade: configure WHATSAPP_PROVIDER=zapi e as credenciais da Z-API no .env da API, e aponte o webhook “ao receber” da instância para /api/webhooks/zapi?secret=… .
        </FieldDescription>
      </Field>
    </AdminPage>
  )
}

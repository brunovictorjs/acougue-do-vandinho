"use client"

import { ArrowDownIcon, ArrowUpIcon, InfoIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { AdminPage } from "@/components/admin/admin-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, errorMessage } from "@/lib/api"
import { initials, maskPhoneInput, phone } from "@/lib/format"

type Attendant = { id: string; fullName: string; phone: string; active: boolean; position: number }

export default function AttendantsPage() {
  const { data, mutate } = useSWR<Attendant[]>("/admin/attendants")
  const [editing, setEditing] = React.useState<Attendant | null>(null)
  const [name, setName] = React.useState("")
  const [tel, setTel] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  function startEdit(a: Attendant) {
    setEditing(a)
    setName(a.fullName)
    setTel(maskPhoneInput(a.phone.startsWith("55") ? a.phone.slice(2) : a.phone))
  }
  function reset() {
    setEditing(null)
    setName("")
    setTel("")
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { fullName: name, phone: tel, active: editing?.active ?? true }
      await api(editing ? `/admin/attendants/${editing.id}` : "/admin/attendants", { method: editing ? "PUT" : "POST", body })
      toast.success(editing ? "Atendente atualizado" : "Atendente cadastrado")
      reset()
      void mutate()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggle(a: Attendant, active: boolean) {
    await api(`/admin/attendants/${a.id}`, { method: "PUT", body: { fullName: a.fullName, phone: a.phone, active } })
    void mutate()
  }
  async function move(i: number, dir: -1 | 1) {
    if (!data) return
    const ids = data.map((a) => a.id)
    const [it] = ids.splice(i, 1)
    ids.splice(i + dir, 0, it)
    await mutate(await api<Attendant[]>("/admin/attendants/order", { method: "PUT", body: { ids } }), { revalidate: false })
  }
  async function remove(a: Attendant) {
    await api(`/admin/attendants/${a.id}`, { method: "DELETE" })
    void mutate()
  }

  const active = data?.filter((a) => a.active) ?? []

  return (
    <AdminPage title="Atendentes" description="Contatos para atendimento humano pelo WhatsApp">
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="py-0">
            {!data ? (
              <Skeleton className="h-48" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Ordem</TableHead>
                    <TableHead>Nome completo</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Indicado pela IA</TableHead>
                    <TableHead className="pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((a, i) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-4">
                        <div className="flex">
                          <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                            <ArrowUpIcon />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Descer" disabled={i === data.length - 1} onClick={() => move(i, 1)}>
                            <ArrowDownIcon />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-secondary text-xs text-gold-text">{initials(a.fullName)}</AvatarFallback>
                          </Avatar>
                          <span className="font-semibold">{a.fullName}</span>
                        </span>
                      </TableCell>
                      <TableCell>{phone(a.phone)}</TableCell>
                      <TableCell>
                        <Switch checked={a.active} onCheckedChange={(v) => toggle(a, v)} aria-label={`Indicar ${a.fullName}`} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Editar ${a.fullName}`} onClick={() => startEdit(a)}>
                            <PencilIcon />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Excluir ${a.fullName}`} onClick={() => remove(a)}>
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          <Alert>
            <InfoIcon />
            <AlertDescription>
              Atendentes não são usuários da plataforma: é só um registro de nome e telefone. Quando o cliente pede atendimento humano, a IA envia todos os marcados como “Indicado pela IA”, nesta ordem.
            </AlertDescription>
          </Alert>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="label-caps text-sm">{editing ? "Editar atendente" : "Novo atendente"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={save} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="a-name">Nome completo</FieldLabel>
                    <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria Oliveira" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="a-phone">Telefone (WhatsApp)</FieldLabel>
                    <Input id="a-phone" type="tel" value={tel} onChange={(e) => setTel(maskPhoneInput(e.target.value))} placeholder="(11) 90000-0000" required />
                  </Field>
                </FieldGroup>
                <div className="flex gap-2">
                  {editing && (
                    <Button type="button" variant="outline" onClick={reset}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit" className="flex-1" size="lg" disabled={busy}>
                    {busy ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
                    {editing ? "Salvar" : "Cadastrar atendente"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="label-caps text-sm">Como o cliente recebe</CardTitle>
              <CardDescription>Resposta da IA quando pedem “falar com uma pessoa”.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-[#ece9e2] p-3">
                <div className="flex max-w-[18rem] flex-col gap-1.5 rounded-lg bg-white p-3 text-sm text-[#141414] shadow-sm">
                  <span>Claro! Estes são nossos atendentes, é só chamar um deles:</span>
                  {active.length ? (
                    active.map((a) => (
                      <span key={a.id}>
                        <b>{a.fullName}</b> · {phone(a.phone)}
                      </span>
                    ))
                  ) : (
                    <span className="text-[#5e5a53]">Nenhum atendente indicado.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPage>
  )
}

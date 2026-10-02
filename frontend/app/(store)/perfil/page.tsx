"use client"

import { CameraIcon, ChevronRightIcon, HeartIcon, LockIcon, LogOutIcon, MapPinIcon, MessageCircleIcon, ReceiptTextIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { PageTitle, ShopShell } from "@/components/store/shop-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { logout, useSession } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { initials, phone } from "@/lib/format"
import type { Me, StoreInfo } from "@/lib/types"

export default function ProfilePage() {
  const { me, mutate } = useSession()
  const { data: store } = useSWR<StoreInfo>("/store")
  const [busy, setBusy] = React.useState<"name" | "photo" | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const first = String(form.get("firstName") ?? "")
    const last = String(form.get("lastName") ?? "")
    setBusy("name")
    try {
      await mutate(await api<Me>("/me", { method: "PATCH", body: { firstName: first, lastName: last } }), { revalidate: false })
      toast.success("Perfil atualizado")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function uploadPhoto(file: File) {
    const form = new FormData()
    form.append("file", file)
    setBusy("photo")
    try {
      await mutate(await api<Me>("/me/avatar", { form }), { revalidate: false })
      toast.success("Foto atualizada")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const links = [
    { href: "/perfil/enderecos", icon: MapPinIcon, title: "Endereços", desc: me ? `${me.addressCount} ${me.addressCount === 1 ? "endereço" : "endereços"}` : "" },
    { href: "/pedidos", icon: ReceiptTextIcon, title: "Meus pedidos", desc: "Status, cancelamento e avaliações" },
    { href: "/favoritos", icon: HeartIcon, title: "Favoritos", desc: "Seus cortes salvos" },
  ]

  return (
    <ShopShell>
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6">
        <PageTitle title="Meu perfil" />
        {!me ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Avatar className="size-28 border-[3px] border-brand-gold">
                  {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="Sua foto" />}
                  <AvatarFallback className="text-3xl font-bold text-gold-text">{initials(`${me.firstName} ${me.lastName}`)}</AvatarFallback>
                </Avatar>
                <Button size="icon-lg" className="absolute right-0 bottom-0 rounded-full border-4 border-background" aria-label="Trocar foto de perfil" disabled={busy === "photo"} onClick={() => fileRef.current?.click()}>
                  {busy === "photo" ? <Spinner /> : <CameraIcon />}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Escolher foto de perfil"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadPhoto(f)
                    e.target.value = ""
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">JPG, PNG ou WEBP, até 5 MB</span>
            </div>

            <form key={me.id} onSubmit={saveName} className="flex flex-col gap-4">
              <FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="first">Nome</FieldLabel>
                    <Input id="first" name="firstName" autoComplete="given-name" defaultValue={me.firstName} required maxLength={60} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="last">Sobrenome</FieldLabel>
                    <Input id="last" name="lastName" autoComplete="family-name" defaultValue={me.lastName} maxLength={80} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="email">E-mail (Google)</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <LockIcon />
                    </InputGroupAddon>
                    <InputGroupInput id="email" value={me.email} readOnly disabled />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="wa">WhatsApp</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <MessageCircleIcon />
                    </InputGroupAddon>
                    <InputGroupInput id="wa" value={phone(me.phone) || "Não cadastrado"} readOnly />
                    {me.phoneVerified && (
                      <InputGroupAddon align="inline-end">
                        <Badge className="bg-success/15 text-success">Verificado</Badge>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                  <FieldDescription>
                    Para trocar o número, <Link href="/perfil/whatsapp">confirme um novo WhatsApp</Link>.
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <Button type="submit" size="xl" disabled={busy === "name"}>
                {busy === "name" && <Spinner data-icon="inline-start" />}
                Salvar alterações
              </Button>
            </form>

            <ItemGroup className="gap-2">
              {links.map(({ href, icon: Icon, title, desc }) => (
                <Item key={href} variant="outline" render={<Link href={href} />}>
                  <ItemMedia variant="icon" className="text-gold-text">
                    <Icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{title}</ItemTitle>
                    <ItemDescription>{desc}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                  </ItemActions>
                </Item>
              ))}
              {store?.whatsapp && (
                <Item variant="outline" render={<a href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer" />}>
                  <ItemMedia variant="icon" className="text-gold-text">
                    <MessageCircleIcon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Atendimento</ItemTitle>
                    <ItemDescription>Atendente virtual e humano no WhatsApp</ItemDescription>
                  </ItemContent>
                </Item>
              )}
            </ItemGroup>
            <Button variant="destructive" size="lg" onClick={() => void logout()}>
              <LogOutIcon data-icon="inline-start" /> Sair da conta
            </Button>
          </>
        )}
      </main>
    </ShopShell>
  )
}

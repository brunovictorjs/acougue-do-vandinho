"use client"

import { ChevronLeftIcon, MessageCircleIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import { PageTitle, ShopShell } from "@/components/store/shop-shell"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { useSession } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { maskPhoneInput, phone } from "@/lib/format"
import type { Me } from "@/lib/types"

/** Change the WhatsApp number: the new one must be confirmed with a code. */
export default function ChangePhonePage() {
  const router = useRouter()
  const { me, mutate } = useSession()
  const [value, setValue] = React.useState("")
  const [sent, setSent] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true)
    try {
      await api("/me/phone", { body: { phone: value } })
      setSent(true)
      toast.success("Código enviado pelo WhatsApp.")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirm(c: string) {
    setBusy(true)
    try {
      await mutate(await api<Me>("/me/phone/confirm", { body: { code: c } }), { revalidate: false })
      toast.success("WhatsApp atualizado")
      router.push("/perfil")
    } catch (err) {
      toast.error(errorMessage(err))
      setCode("")
      setBusy(false)
    }
  }

  return (
    <ShopShell>
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
        <Link href="/perfil" className={buttonVariants({ variant: "ghost", className: "self-start" })}>
          <ChevronLeftIcon data-icon="inline-start" /> Perfil
        </Link>
        <PageTitle title="Trocar WhatsApp" description={me?.phone ? `Número atual: ${phone(me.phone)}` : undefined} />
        {!sent ? (
          <form onSubmit={send} className="flex flex-col gap-5">
            <Field>
              <FieldLabel htmlFor="new-phone">Novo número</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>+55</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput id="new-phone" type="tel" inputMode="tel" placeholder="(11) 98765-4321" value={value} onChange={(e) => setValue(maskPhoneInput(e.target.value))} required />
              </InputGroup>
              <FieldDescription>Os avisos dos pedidos passam a ir para este número depois da confirmação.</FieldDescription>
            </Field>
            <Button type="submit" size="xl" disabled={busy || value.replace(/\D/g, "").length < 10}>
              {busy ? <Spinner data-icon="inline-start" /> : <MessageCircleIcon data-icon="inline-start" />}
              Enviar código
            </Button>
          </form>
        ) : (
          <Field>
            <FieldLabel htmlFor="otp">Código enviado para {value}</FieldLabel>
            <InputOTP id="otp" maxLength={6} value={code} onChange={setCode} onComplete={(c: string) => void confirm(c)} disabled={busy} inputMode="numeric" autoFocus>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <FieldDescription>Em modo de teste, o código aparece no terminal da API.</FieldDescription>
          </Field>
        )}
      </main>
    </ShopShell>
  )
}

"use client"

import { ArrowRightIcon, CheckIcon, ChevronLeftIcon, LockIcon, MessageCircleIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"
import { Logo } from "@/components/brand"
import { AddressForm, saveAddress } from "@/components/store/address-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { homeFor, useSession } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import { initials, maskPhoneInput, phone as fmtPhone } from "@/lib/format"
import type { Me } from "@/lib/types"

type Step = "phone" | "code" | "address" | "done"

/** Mandatory after the first Google login: verified WhatsApp + at least one address. */
export default function OnboardingPage() {
  const router = useRouter()
  const { me, mutate } = useSession()
  const [chosenStep, setStep] = React.useState<Step | null>(null)
  const [phoneInput, setPhoneInput] = React.useState("")
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  // Until the person moves on, the step follows what is still missing.
  const step: Step | null = chosenStep ?? (me && me.role === "CUSTOMER" && !me.onboardingComplete ? (me.phoneVerified ? "address" : "phone") : null)

  React.useEffect(() => {
    if (!me || chosenStep) return
    if (me.role !== "CUSTOMER") router.replace(homeFor(me))
    else if (me.onboardingComplete) router.replace("/")
  }, [me, chosenStep, router])

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true)
    try {
      await api("/me/phone", { body: { phone: phoneInput } })
      setStep("code")
      setCode("")
      toast.success("Código enviado pelo WhatsApp.")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirm(value = code) {
    setBusy(true)
    try {
      const updated = await api<Me>("/me/phone/confirm", { body: { code: value } })
      await mutate(updated, { revalidate: false })
      setStep(updated.onboardingComplete ? "done" : "address")
    } catch (err) {
      toast.error(errorMessage(err))
      setCode("")
    } finally {
      setBusy(false)
    }
  }

  const progress = step === "phone" || step === "code" ? 50 : 100
  if (!me || !step) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pt-5 pb-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Logo size={44} />
          <span className="text-sm text-muted-foreground">{step === "done" ? "Concluído" : step === "address" ? "Passo 2 de 2" : "Passo 1 de 2"}</span>
        </div>
        <Progress value={progress} aria-label="Progresso do cadastro" />
      </header>

      {(step === "phone" || step === "code") && (
        <section className="flex flex-1 flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-14 border-2 border-brand-gold">
              {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
              <AvatarFallback className="font-bold text-gold-text">{initials(`${me.firstName} ${me.lastName}`)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Conectado como</span>
              <span className="font-semibold">
                {me.firstName} {me.lastName}
              </span>
            </div>
          </div>
          <h1 className="font-display text-4xl">
            Qual o seu
            <br />
            WhatsApp?
          </h1>
          <p className="text-muted-foreground">É por ele que avisamos cada mudança no seu pedido e que o atendente virtual reconhece você.</p>

          {step === "phone" ? (
            <form onSubmit={sendCode} className="flex flex-1 flex-col gap-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="phone">Telefone celular</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>+55</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput id="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(11) 98765-4321" value={phoneInput} onChange={(e) => setPhoneInput(maskPhoneInput(e.target.value))} required />
                  </InputGroup>
                  <FieldDescription>Enviamos um código de 6 dígitos para confirmar que o número é seu.</FieldDescription>
                </Field>
              </FieldGroup>
              <div className="flex-1" />
              <Button type="submit" size="xl" disabled={busy || phoneInput.replace(/\D/g, "").length < 10}>
                {busy ? <Spinner data-icon="inline-start" /> : <MessageCircleIcon data-icon="inline-start" />}
                Enviar código
              </Button>
              <p className="text-center text-xs text-muted-foreground">Telefone e endereço são obrigatórios para fazer pedidos.</p>
            </form>
          ) : (
            <div className="flex flex-1 flex-col gap-5">
              <Field>
                <FieldLabel htmlFor="otp">Código enviado para {maskPhoneInput(phoneInput)}</FieldLabel>
                <InputOTP
                  id="otp"
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  onComplete={(v: string) => void confirm(v)}
                  disabled={busy}
                  inputMode="numeric"
                  autoFocus
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldDescription>Em modo de teste, o código aparece no terminal da API e em Admin › Atendente IA.</FieldDescription>
              </Field>
              <Alert>
                <LockIcon />
                <AlertDescription>O código vale por 10 minutos.</AlertDescription>
              </Alert>
              <div className="flex-1" />
              <div className="flex gap-3">
                <Button variant="outline" size="xl" onClick={() => setStep("phone")} aria-label="Trocar número">
                  <ChevronLeftIcon />
                </Button>
                <Button size="xl" className="flex-1" disabled={busy || code.length !== 6} onClick={() => confirm()}>
                  {busy && <Spinner data-icon="inline-start" />}
                  Confirmar
                </Button>
              </div>
              <Button variant="ghost" onClick={() => sendCode()} disabled={busy}>
                Reenviar código
              </Button>
            </div>
          )}
        </section>
      )}

      {step === "address" && (
        <section className="flex flex-col gap-5">
          <h1 className="font-display text-4xl">
            Onde a gente
            <br />
            entrega?
          </h1>
          <p className="text-muted-foreground">Você pode cadastrar outros endereços depois. Em cada pedido, escolhe um.</p>
          {me.phone && (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckIcon className="size-4" aria-hidden /> WhatsApp {fmtPhone(me.phone)} confirmado
            </p>
          )}
          <AddressForm
            submitLabel="Salvar e começar"
            showDefaultToggle={false}
            onSubmit={async (values) => {
              await saveAddress({ ...values, isDefault: true })
              await mutate()
              setStep("done")
            }}
          />
        </section>
      )}

      {step === "done" && (
        <section className="flex flex-1 flex-col items-center gap-5 pt-16 text-center">
          <span className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-12" aria-hidden />
          </span>
          <h1 className="font-display text-5xl">
            Tudo pronto,
            <br />
            <span className="text-brand-gold">{me.firstName}!</span>
          </h1>
          <p className="max-w-xs text-muted-foreground">Cadastro completo. Enviamos uma mensagem de boas-vindas no seu WhatsApp.</p>
          <div className="flex-1" />
          <Link href="/" className={buttonVariants({ size: "xl", className: "w-full" })}>
            Ir para a loja
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </section>
      )}
    </main>
  )
}

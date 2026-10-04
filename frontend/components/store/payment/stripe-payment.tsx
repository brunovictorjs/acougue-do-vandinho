"use client"

import { loadStripe } from "@stripe/stripe-js"
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout"
import * as React from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { money } from "@/lib/format"

const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
// `locale` só existe no construtor: elementsOptions do Checkout não aceita o campo.
// Sem ele o Payment Element segue o idioma do navegador e mostra "Card", "You will be
// shown a QR code…" para um cliente brasileiro.
const stripePromise = key ? loadStripe(key, { locale: "pt-BR" }) : null

const appearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#E5A900",
    colorBackground: "#0e0e0e",
    colorText: "#F5F5F5",
    colorTextSecondary: "#A6A6A6",
    colorDanger: "#F07167",
    borderRadius: "8px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
}

/**
 * As mensagens de recusa chegam em inglês mesmo com `locale: "pt-BR"` — elas vêm da API,
 * não da UI do Elements. Traduzimos pelo `declineCode`, que é estável, em vez da string.
 * Cartão perdido/roubado cai no texto genérico de propósito: dizer o motivo ao portador
 * entrega a informação justamente a quem está usando o cartão de outra pessoa.
 */
const DECLINE_MESSAGES: Record<string, string> = {
  insufficient_funds: "Saldo insuficiente. Tente outro cartão ou pague com Pix.",
  expired_card: "Esse cartão está vencido. Confira a validade ou use outro.",
  incorrect_cvc: "O código de segurança não confere. Confira o CVC.",
  incorrect_number: "O número do cartão não confere.",
  card_velocity_exceeded: "O limite do cartão foi atingido. Tente outro cartão ou pague com Pix.",
  authentication_required: "O banco pediu uma confirmação que não foi concluída. Tente de novo.",
  processing_error: "Não conseguimos falar com o banco agora. Tente de novo em instantes.",
}

const GENERIC_DECLINE = "O pagamento não foi aprovado. Tente outro cartão ou pague com Pix."
// `code: null` é o erro genérico do Checkout — cai aqui a sessão vencida, que é o caso
// de quem deixou o QR do Pix expirar. Não há código específico para distinguir, então a
// mensagem cobre o cenário e o `onFailure` abaixo deixa o servidor dar a palavra final.
const SESSION_GONE = "Este pagamento não está mais válido — o código pode ter expirado. Vamos gerar um novo para você."

type ConfirmError = { message: string; code: string | null; paymentFailed?: { declineCode: string | null } }

function paymentErrorMessage(error: ConfirmError) {
  if (error.code !== "paymentFailed") return SESSION_GONE
  const declineCode = error.paymentFailed?.declineCode
  return (declineCode && DECLINE_MESSAGES[declineCode]) || GENERIC_DECLINE
}

function PayForm({ amountCents, onFailure }: { amountCents: number; onFailure?: () => void }) {
  const state = useCheckoutElements()
  const [message, setMessage] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  if (state.type === "loading") return <Skeleton className="h-64" />
  if (state.type === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>Não foi possível carregar o formulário de pagamento. Atualize a página e tente de novo.</AlertDescription>
      </Alert>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state.type !== "success") return
    setBusy(true)
    // On success Stripe redirects to the session's return_url; we only land here on immediate errors.
    const result = await state.checkout.confirm()
    if (result.type === "error") {
      setMessage(paymentErrorMessage(result.error))
      // Uma falha pode ser recusa (o pedido segue pagável) ou sessão vencida (não segue).
      // O erro do Stripe não separa os dois de forma confiável, então revalidamos o
      // pedido: se o webhook já matou o pagamento, a página troca sozinha para a tela
      // de "gere um novo pagamento" em vez de deixar o cliente num botão morto.
      onFailure?.()
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {message && (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="xl" disabled={busy}>
        {busy && <Spinner data-icon="inline-start" />}
        Pagar {money(amountCents)}
      </Button>
    </form>
  )
}

/** Stripe Payment Element backed by a Checkout Session (ui_mode: elements). */
export function StripePayment({
  clientSecret,
  amountCents,
  onFailure,
}: {
  clientSecret: string
  amountCents: number
  /** Chamado quando o confirm() falha, para a página revalidar o pedido. */
  onFailure?: () => void
}) {
  if (!stripePromise) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Configure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no frontend para usar o Stripe.</AlertDescription>
      </Alert>
    )
  }
  return (
    <CheckoutElementsProvider stripe={stripePromise} options={{ clientSecret, elementsOptions: { appearance } }}>
      <PayForm amountCents={amountCents} onFailure={onFailure} />
    </CheckoutElementsProvider>
  )
}

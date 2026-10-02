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
const stripePromise = key ? loadStripe(key) : null

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

function PayForm({ amountCents }: { amountCents: number }) {
  const state = useCheckoutElements()
  const [message, setMessage] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  if (state.type === "loading") return <Skeleton className="h-64" />
  if (state.type === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.error.message}</AlertDescription>
      </Alert>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state.type !== "success") return
    setBusy(true)
    // On success Stripe redirects to the session's return_url; we only land here on immediate errors.
    const result = await state.checkout.confirm()
    if (result.type === "error") setMessage(result.error.message)
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
export function StripePayment({ clientSecret, amountCents }: { clientSecret: string; amountCents: number }) {
  if (!stripePromise) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Configure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no frontend para usar o Stripe.</AlertDescription>
      </Alert>
    )
  }
  return (
    <CheckoutElementsProvider stripe={stripePromise} options={{ clientSecret, elementsOptions: { appearance } }}>
      <PayForm amountCents={amountCents} />
    </CheckoutElementsProvider>
  )
}

"use client"

import { BikeIcon, InfoIcon, ShieldUserIcon, StoreIcon, UserRoundIcon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { Suspense } from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { Logo } from "@/components/brand"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { homeFor } from "@/hooks/use-session"
import { api, errorMessage } from "@/lib/api"
import type { Me } from "@/lib/types"
import { cn } from "@/lib/utils"

const ERRORS: Record<string, string> = {
  google_indisponivel: "O login com Google ainda não foi configurado na API (GOOGLE_CLIENT_ID).",
  estado_invalido: "A sessão de login expirou. Tente de novo.",
  falha_google: "Não foi possível entrar com o Google. Tente de novo.",
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next")
  const error = params.get("erro")
  const { data: providers } = useSWR<{ google: boolean; dev: boolean }>("/auth/providers")
  const [busy, setBusy] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!next) return
    try {
      sessionStorage.setItem("vnd_next", next)
    } catch {
      /* private mode */
    }
  }, [next])

  async function devLogin(role: Me["role"]) {
    setBusy(role)
    try {
      await api("/auth/dev-login", { body: { role } })
      const me = await api<Me>("/me")
      router.replace(next && me.role === "CUSTOMER" && me.onboardingComplete ? next : homeFor(me))
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
      setBusy(null)
    }
  }

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(229,169,0,0.18),transparent_70%)]" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 pt-14 pb-8">
        <Link href="/" className="self-center" aria-label="Voltar à loja">
          <Logo size={150} />
        </Link>
        <div className="flex-1" />
        <h1 className="font-display text-5xl leading-[0.95]">
          Entre e<br />
          <span className="text-brand-gold">faça seu pedido.</span>
        </h1>
        <p className="text-muted-foreground">Acompanhe entregas, salve favoritos e receba avisos do pedido no WhatsApp.</p>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{ERRORS[error] ?? "Não foi possível entrar."}</AlertDescription>
          </Alert>
        )}

        <a
          href="/api/auth/google"
          aria-disabled={providers ? !providers.google : undefined}
          className={cn(buttonVariants({ size: "xl", variant: "outline" }), "w-full bg-white font-sans text-base tracking-normal text-[#141414] normal-case hover:bg-white/90 hover:text-[#141414] dark:border-white dark:bg-white dark:hover:bg-white/90", providers && !providers.google && "pointer-events-none opacity-50")}
        >
          <GoogleMark />
          Continuar com Google
        </a>
        {providers && !providers.google && <p className="-mt-3 text-xs text-muted-foreground">Google SSO aparece aqui assim que GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET forem configurados na API.</p>}

        {providers?.dev && (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4">
            <p className="label-caps text-gold-text">Ambiente de testes · entrar como</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["CUSTOMER", "Cliente", UserRoundIcon],
                  ["COURIER", "Entregador", BikeIcon],
                  ["EMPLOYEE", "Funcionário", StoreIcon],
                  ["ADMIN", "Admin", ShieldUserIcon],
                ] as const
              ).map(([role, label, Icon]) => (
                <Button key={role} variant="outline" size="lg" className="h-auto flex-col gap-1.5 py-3 font-sans text-xs tracking-normal normal-case" disabled={!!busy} onClick={() => devLogin(role)}>
                  {busy === role ? <Spinner /> : <Icon />}
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Separator />
        <p className="flex gap-2 text-xs text-muted-foreground">
          <InfoIcon className="size-4 shrink-0 text-gold-text" aria-hidden />
          Clientes, entregadores e administradores usam o mesmo login. Cada um é levado à sua área de acordo com o papel.
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

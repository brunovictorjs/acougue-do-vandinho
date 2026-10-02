"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { Logo } from "@/components/brand"
import { Spinner } from "@/components/ui/spinner"
import { homeFor, useSession } from "@/hooks/use-session"

/** Google redirects here after the API set the session cookie. */
export default function LoginDonePage() {
  const router = useRouter()
  const { me, isLoading } = useSession()

  React.useEffect(() => {
    if (isLoading) return
    if (!me) {
      router.replace("/entrar?erro=falha_google")
      return
    }
    let next: string | null = null
    try {
      next = sessionStorage.getItem("vnd_next")
      sessionStorage.removeItem("vnd_next")
    } catch {
      /* ignore */
    }
    router.replace(next && me.role === "CUSTOMER" && me.onboardingComplete ? next : homeFor(me))
  }, [me, isLoading, router])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <Logo size={96} />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Entrando…
      </p>
    </main>
  )
}

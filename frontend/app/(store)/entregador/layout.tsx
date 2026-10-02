"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { Spinner } from "@/components/ui/spinner"
import { homeFor, useSession } from "@/hooks/use-session"

/** Courier area: only couriers (and admins, for support) get in. */
export default function CourierLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { me, isLoading } = useSession()
  const allowed = me && (me.role === "COURIER" || me.role === "ADMIN")

  React.useEffect(() => {
    if (isLoading) return
    if (!me) router.replace("/entrar?next=/entregador")
    else if (!allowed) router.replace(homeFor(me))
  }, [me, isLoading, allowed, router])

  if (!allowed) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </main>
    )
  }
  return <div className="mx-auto min-h-dvh max-w-lg">{children}</div>
}

"use client"

import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { AdminShell, adminHome, canOpenAdmin } from "@/components/admin/admin-shell"
import { Spinner } from "@/components/ui/spinner"
import { homeFor, useSession } from "@/hooks/use-session"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { me, isLoading } = useSession()
  const allowed = canOpenAdmin(me?.role, pathname)

  React.useEffect(() => {
    if (isLoading) return
    if (!me) router.replace(`/entrar?next=${encodeURIComponent(pathname)}`)
    else if (me.role === "EMPLOYEE" && !allowed) router.replace(adminHome(me.role))
    else if (!allowed) router.replace(homeFor(me))
  }, [me, isLoading, router, allowed, pathname])

  if (!allowed) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </main>
    )
  }
  return <AdminShell>{children}</AdminShell>
}

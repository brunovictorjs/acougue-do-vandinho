"use client"

import useSWR from "swr"
import { api } from "@/lib/api"
import type { Me } from "@/lib/types"

/** Current user, or null when logged out. */
export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<Me | null>("/me", async () => (await api<{ user: Me | null }>("/auth/session")).user, { revalidateOnFocus: false })
  return { me: data ?? null, isLoading: isLoading && !error, error, mutate }
}

export async function logout() {
  await api("/auth/logout", { method: "POST" })
  // Full reload on purpose: drops every cached SWR response of the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/"
}

/** Where a freshly logged-in person should land. */
export function homeFor(me: Me) {
  if (me.role === "ADMIN") return "/admin"
  if (me.role === "EMPLOYEE") return "/admin/pedidos"
  if (me.role === "COURIER") return "/entregador"
  return me.onboardingComplete ? "/" : "/cadastro"
}

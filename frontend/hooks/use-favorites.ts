"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import useSWR from "swr"
import { api } from "@/lib/api"
import { useSession } from "./use-session"

export function useFavorites() {
  const router = useRouter()
  const { me } = useSession()
  const { data, mutate } = useSWR<string[]>(me ? "/me/favorites/ids" : null, (p: string) => api<string[]>(p))
  const ids = new Set(data ?? [])

  async function toggle(productId: string) {
    if (!me) {
      router.push(`/entrar?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    const isFav = ids.has(productId)
    const next = isFav ? [...ids].filter((i) => i !== productId) : [...ids, productId]
    await mutate(next, { revalidate: false })
    try {
      await api(`/me/favorites/${productId}`, { method: isFav ? "DELETE" : "PUT" })
      if (!isFav) toast.success("Salvo nos favoritos")
    } catch {
      await mutate()
      toast.error("Não foi possível atualizar os favoritos.")
    }
  }

  return { ids, isFavorite: (id: string) => ids.has(id), toggle }
}

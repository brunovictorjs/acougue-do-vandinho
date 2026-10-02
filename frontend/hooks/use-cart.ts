"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import useSWR from "swr"
import { api, ApiError } from "@/lib/api"
import type { Cart } from "@/lib/types"
import { useSession } from "./use-session"
import { useCartDrawer } from "@/components/store/cart-context"

const EMPTY: Cart = { id: null, code: null, items: [], itemCount: 0, subtotalCents: 0, savingsCents: 0, hasUnavailable: false }

export function useCart() {
  const { me } = useSession()
  const enabled = !!me && me.role === "CUSTOMER"
  const { data, isLoading, mutate } = useSWR<Cart>(enabled ? "/cart" : null, (p: string) => api<Cart>(p))
  return { cart: data ?? EMPTY, isLoading, mutate, enabled }
}

/** Add to cart with the redirects the flow needs (login, mandatory onboarding). */
export function useAddToCart() {
  const router = useRouter()
  const { me } = useSession()
  const { mutate } = useCart()
  const drawer = useCartDrawer()

  return async (input: { productId: string; quantity: number; cutOption?: string | null; notes?: string | null }, opts: { open?: boolean } = {}) => {
    if (!me) {
      router.push(`/entrar?next=${encodeURIComponent(window.location.pathname)}`)
      return false
    }
    if (me.role !== "CUSTOMER") {
      toast.info("Entre com uma conta de cliente para comprar.")
      return false
    }
    if (!me.onboardingComplete) {
      router.push("/cadastro")
      return false
    }
    try {
      const cart = await api<Cart>("/cart/items", { body: input })
      await mutate(cart, { revalidate: false })
      if (opts.open ?? true) drawer.setOpen(true)
      else toast.success("Adicionado ao carrinho")
      return true
    } catch (e) {
      if (e instanceof ApiError && e.code === "onboarding_required") router.push("/cadastro")
      else toast.error(e instanceof Error ? e.message : "Não foi possível adicionar.")
      return false
    }
  }
}

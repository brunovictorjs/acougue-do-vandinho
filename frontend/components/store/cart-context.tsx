"use client"

import * as React from "react"

const CartDrawerContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null)

export function CartDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const value = React.useMemo(() => ({ open, setOpen }), [open])
  return <CartDrawerContext.Provider value={value}>{children}</CartDrawerContext.Provider>
}

export function useCartDrawer() {
  const ctx = React.useContext(CartDrawerContext)
  if (!ctx) throw new Error("useCartDrawer must be used inside CartDrawerProvider")
  return ctx
}

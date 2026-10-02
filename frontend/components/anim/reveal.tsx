"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import * as React from "react"

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Fades/slides in every `[data-reveal]` descendant as it enters the viewport.
 * Respects prefers-reduced-motion.
 */
export function Reveal({ children, className, stagger = 0.06 }: { children: React.ReactNode; className?: string; stagger?: number }) {
  const ref = React.useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const items = gsap.utils.toArray<HTMLElement>("[data-reveal]")
        gsap.set(items, { autoAlpha: 0, y: 24 })
        ScrollTrigger.batch(items, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger }),
        })
      })
      return () => mm.revert()
    },
    { scope: ref }
  )
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

/** Small "pop" used when a counter changes (cart badge). */
export function usePop<T extends HTMLElement>(dep: unknown) {
  const ref = React.useRef<T>(null)
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    gsap.fromTo(ref.current, { scale: 1.6 }, { scale: 1, duration: 0.45, ease: "back.out(3)" })
  }, [dep])
  return ref
}

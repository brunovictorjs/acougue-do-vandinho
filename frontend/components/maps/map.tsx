"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/** Leaflet touches `window`, so it only renders in the browser. */
export const LazyMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
})

export type { MapPoint } from "./leaflet-map"

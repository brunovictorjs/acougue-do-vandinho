"use client"

import L from "leaflet"
import * as React from "react"
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet"
import { cn } from "@/lib/utils"

export interface MapPoint {
  lat: number
  lng: number
  label: string
  kind: "store" | "customer" | "pin"
}

const pinIcon = (kind: MapPoint["kind"]) =>
  L.divIcon({
    className: "",
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    html:
      kind === "store"
        ? `<div style="width:34px;height:34px;border-radius:999px;background:#050505;border:3px solid #E5A900;display:flex;align-items:center;justify-content:center;color:#FFC928;font:700 13px Oswald,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.5)">V</div>`
        : `<svg width="36" height="44" viewBox="0 0 36 44"><path d="M18 43s-15-13-15-25a15 15 0 0 1 30 0c0 12-15 25-15 25z" fill="#E5A900" stroke="#050505" stroke-width="2"/><circle cx="18" cy="18" r="6" fill="#050505"/></svg>`,
  })

function FitBounds({ points, path }: { points: MapPoint[]; path?: Array<[number, number]> }) {
  const map = useMap()
  React.useEffect(() => {
    const all: Array<[number, number]> = [...points.map((p) => [p.lat, p.lng] as [number, number]), ...(path ?? [])]
    if (all.length === 1) map.setView(all[0], 16)
    else if (all.length > 1) map.fitBounds(L.latLngBounds(all), { padding: [40, 40] })
  }, [map, points, path])
  return null
}

/** OpenStreetMap tiles (free, attribution required). */
export default function LeafletMap({
  points,
  path,
  className,
  interactive = true,
  zoomControl = true,
  onMove,
}: {
  points: MapPoint[]
  path?: Array<[number, number]>
  className?: string
  interactive?: boolean
  zoomControl?: boolean
  onMove?: (lat: number, lng: number) => void
}) {
  const center: [number, number] = points[0] ? [points[0].lat, points[0].lng] : [-23.55, -46.63]
  return (
    <MapContainer
      center={center}
      zoom={15}
      className={cn("isolate", className)}
      scrollWheelZoom={false}
      dragging={interactive}
      zoomControl={interactive && zoomControl}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {path && path.length > 1 && (
        <>
          <Polyline positions={path} pathOptions={{ color: "#050505", weight: 9, opacity: 0.6 }} />
          <Polyline positions={path} pathOptions={{ color: "#E5A900", weight: 5 }} />
        </>
      )}
      {points.map((p, i) => (
        <Marker
          key={`${p.kind}-${i}`}
          position={[p.lat, p.lng]}
          icon={pinIcon(p.kind)}
          title={p.label}
          draggable={!!onMove && p.kind === "pin"}
          eventHandlers={
            onMove
              ? {
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng()
                    onMove(ll.lat, ll.lng)
                  },
                }
              : undefined
          }
        />
      ))}
      <FitBounds points={points} path={path} />
    </MapContainer>
  )
}

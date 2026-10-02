import { Injectable, Logger } from '@nestjs/common';

export interface RoutePlan {
  /** [lat, lng] pairs */
  path: Array<[number, number]>;
  distanceMeters: number | null;
  durationSeconds: number | null;
  source: 'osrm' | 'straight-line';
}

/**
 * Driving route from the store to the customer using the public OSRM demo
 * server (good for testing; use a paid/self-hosted router in production).
 * Falls back to a straight line when the router is unreachable.
 */
@Injectable()
export class RoutePlanner {
  private readonly logger = new Logger('RoutePlanner');

  async plan(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<RoutePlan> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const body = (await res.json()) as { routes?: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }> };
        const r = body.routes?.[0];
        if (r) {
          return {
            path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
            distanceMeters: Math.round(r.distance),
            durationSeconds: Math.round(r.duration),
            source: 'osrm',
          };
        }
      }
    } catch (err) {
      this.logger.warn(`OSRM unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }
    return {
      path: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      distanceMeters: Math.round(haversine(from, to)),
      durationSeconds: null,
      source: 'straight-line',
    };
  }
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

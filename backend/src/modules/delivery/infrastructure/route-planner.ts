import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';

export interface RoutePlan {
  /** [lat, lng] pairs */
  path: Array<[number, number]>;
  distanceMeters: number | null;
  durationSeconds: number | null;
  source: 'osrm' | 'straight-line';
}

/** A good route is worth keeping: the streets between store and customer do not move. */
const OSRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * The straight line is a placeholder, not an answer — expire it quickly so the
 * real route appears once the router is back, but not so quickly that an outage
 * turns every page view into another failed request.
 */
const FALLBACK_TTL_MS = 60_000;
/** Enough for every address the store delivers to; keeps the map from growing without bound. */
const MAX_ENTRIES = 500;

/** ~1 m of precision: the same delivery always lands on the same key. */
const round = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

/**
 * Driving route from the store to the customer using the public OSRM demo
 * server (good for testing; use a paid/self-hosted router in production).
 * Falls back to a straight line when the router is unreachable.
 *
 * Results are cached per coordinate pair because the courier screen asks for the
 * route on every load and revalidation, while the route itself never changes —
 * and the demo server allows only one request per second. Concurrent callers
 * share a single in-flight request instead of each firing their own.
 */
@Injectable()
export class RoutePlanner {
  private readonly logger = new Logger('RoutePlanner');
  private readonly cache = new Map<string, { plan: RoutePlan; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<RoutePlan>>();

  constructor(private readonly config: AppConfig) {}

  async plan(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<RoutePlan> {
    const key = `${round(from)}|${round(to)}`;

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.plan;

    const running = this.inFlight.get(key);
    if (running) return running;

    const request = this.fetchPlan(from, to)
      .then((plan) => {
        this.remember(key, plan);
        return plan;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, request);
    return request;
  }

  private remember(key: string, plan: RoutePlan) {
    // Re-inserting moves the key to the end, so the first entry is always the
    // least recently written one to drop.
    this.cache.delete(key);
    this.cache.set(key, {
      plan,
      expiresAt: Date.now() + (plan.source === 'osrm' ? OSRM_TTL_MS : FALLBACK_TTL_MS),
    });
    if (this.cache.size > MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }

  private async fetchPlan(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<RoutePlan> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, {
        headers: { 'User-Agent': this.config.userAgent },
        signal: AbortSignal.timeout(6000),
      });
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

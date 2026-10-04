import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Best-effort geocoding with OpenStreetMap Nominatim (free, rate-limited; fine
 * for testing). Returns null on any failure — the courier map then falls back
 * to "open in Google Maps" using the text address.
 */
@Injectable()
export class Geocoder {
  private readonly logger = new Logger('Geocoder');

  constructor(private readonly config: AppConfig) {}

  async locate(query: string): Promise<GeoPoint | null> {
    if (!this.config.geocoding) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': this.config.userAgent },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!rows.length) return null;
      return { latitude: Number(rows[0].lat), longitude: Number(rows[0].lon) };
    } catch (err) {
      this.logger.warn(`Geocoding failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}

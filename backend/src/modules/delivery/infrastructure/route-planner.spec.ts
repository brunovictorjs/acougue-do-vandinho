import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../../config/app-config.js';
import { RoutePlanner } from './route-planner.js';

const STORE = { lat: -23.5505, lng: -46.6333 };
const CUSTOMER = { lat: -23.5614, lng: -46.6565 };

const osrmReply = () =>
  new Response(
    JSON.stringify({
      routes: [{ distance: 2750.4, duration: 480.2, geometry: { coordinates: [[-46.6333, -23.5505], [-46.6565, -23.5614]] } }],
    }),
    { status: 200 },
  );

function planner() {
  return new RoutePlanner(new AppConfig());
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('RoutePlanner', () => {
  it('asks OSRM once and serves later calls from the cache', async () => {
    const fetchMock = vi.fn(async () => osrmReply());
    vi.stubGlobal('fetch', fetchMock);
    const routes = planner();

    const first = await routes.plan(STORE, CUSTOMER);
    const second = await routes.plan(STORE, CUSTOMER);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.source).toBe('osrm');
    expect(second).toEqual(first);
    expect(first.distanceMeters).toBe(2750);
    // OSRM answers [lng, lat]; the map needs [lat, lng].
    expect(first.path[0]).toEqual([-23.5505, -46.6333]);
  });

  it('identifies the application in the User-Agent, as the OSM policy requires', async () => {
    const fetchMock = vi.fn(async () => osrmReply());
    vi.stubGlobal('fetch', fetchMock);

    await planner().plan(STORE, CUSTOMER);

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/^acougue-do-vandinho\/1\.0 \(\+http/);
  });

  it('collapses concurrent calls for the same route into one request', async () => {
    const fetchMock = vi.fn(async () => osrmReply());
    vi.stubGlobal('fetch', fetchMock);
    const routes = planner();

    const [a, b, c] = await Promise.all([
      routes.plan(STORE, CUSTOMER),
      routes.plan(STORE, CUSTOMER),
      routes.plan(STORE, CUSTOMER),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('keeps separate entries per destination', async () => {
    const fetchMock = vi.fn(async () => osrmReply());
    vi.stubGlobal('fetch', fetchMock);
    const routes = planner();

    await routes.plan(STORE, CUSTOMER);
    await routes.plan(STORE, { lat: -23.6, lng: -46.7 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to a straight line and retries soon after, instead of caching the failure for a week', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    vi.stubGlobal('fetch', fetchMock);
    const routes = planner();

    const failed = await routes.plan(STORE, CUSTOMER);
    expect(failed.source).toBe('straight-line');
    expect(failed.distanceMeters).toBeGreaterThan(0);
    expect(failed.durationSeconds).toBeNull();

    // Within the short window the placeholder is reused, so an outage does not
    // turn every page view into another request.
    await routes.plan(STORE, CUSTOMER);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61_000);
    vi.stubGlobal('fetch', vi.fn(async () => osrmReply()));
    const recovered = await routes.plan(STORE, CUSTOMER);
    expect(recovered.source).toBe('osrm');
  });
});

import { Injectable } from '@nestjs/common';
import { pageOf } from '../../../shared/application/pagination.js';
import { normalizeName } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { DeliveryZonesService } from '../../store/application/delivery-zones.service.js';

/** SERVED: active zone · INACTIVE: zone exists but is switched off · UNLISTED: no zone at all. */
export type CoverageStatus = 'SERVED' | 'INACTIVE' | 'UNLISTED';
export type CoverageFilter = 'all' | 'served' | 'unserved';

/**
 * Every customer address checked against the delivery zones, so the admin can
 * spot neighborhoods people live in that the store does not deliver to yet.
 */
@Injectable()
export class AdminAddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zones: DeliveryZonesService,
  ) {}

  private async classified() {
    const [zones, addresses] = await Promise.all([
      this.zones.list(),
      this.prisma.address.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      }),
    ]);
    const zoneByName = new Map(zones.map((z) => [z.normalizedName, z]));
    const perNeighborhood = new Map<string, number>();
    for (const a of addresses) {
      const key = normalizeName(a.neighborhood);
      perNeighborhood.set(key, (perNeighborhood.get(key) ?? 0) + 1);
    }
    return addresses.map((a) => {
      const key = normalizeName(a.neighborhood);
      const zone = zoneByName.get(key) ?? null;
      const status: CoverageStatus = !zone ? 'UNLISTED' : zone.active ? 'SERVED' : 'INACTIVE';
      return {
        id: a.id,
        label: a.label,
        zipCode: a.zipCode,
        street: a.street,
        number: a.number,
        complement: a.complement,
        neighborhood: a.neighborhood,
        city: a.city,
        state: a.state,
        createdAt: a.createdAt,
        customer: { id: a.user.id, fullName: `${a.user.firstName} ${a.user.lastName}`.trim(), email: a.user.email, phone: a.user.phone },
        status,
        zone: zone && { id: zone.id, neighborhood: zone.neighborhood, feeCents: zone.feeCents, etaMinutes: zone.etaMinutes, active: zone.active },
        sameNeighborhood: perNeighborhood.get(key) ?? 1,
      };
    });
  }

  async list(params: { status?: CoverageFilter; search?: string; page?: number }) {
    const rows = await this.classified();
    const served = rows.filter((r) => r.status === 'SERVED').length;
    const search = params.search ? normalizeName(params.search) : '';
    const filtered = rows.filter((r) => {
      if (params.status === 'served' && r.status !== 'SERVED') return false;
      if (params.status === 'unserved' && r.status === 'SERVED') return false;
      if (!search) return true;
      const haystack = normalizeName([r.customer.fullName, r.customer.email, r.street, r.neighborhood, r.city, r.zipCode].join(' '));
      return haystack.includes(search);
    });
    return { counts: { all: rows.length, served, unserved: rows.length - served }, ...pageOf(filtered, params.page) };
  }

  /** Distinct neighborhoods with customers but no active zone — drives the sidebar badge. */
  async pendingNeighborhoods() {
    const rows = await this.classified();
    return { count: new Set(rows.filter((r) => r.status !== 'SERVED').map((r) => normalizeName(r.neighborhood))).size };
  }
}

import { Injectable } from '@nestjs/common';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import { normalizeName } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

export interface DeliveryQuote {
  served: boolean;
  zoneId: string | null;
  neighborhood: string;
  feeCents: number | null;
  etaMinutes: number | null;
}

/** Delivery fee is decided by neighborhood. Unlisted neighborhoods can only pick up. */
@Injectable()
export class DeliveryZonesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.deliveryZone.findMany({ orderBy: { neighborhood: 'asc' } });
  }

  async quote(neighborhood: string): Promise<DeliveryQuote> {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { normalizedName: normalizeName(neighborhood) } });
    if (!zone || !zone.active) {
      return { served: false, zoneId: null, neighborhood, feeCents: null, etaMinutes: null };
    }
    return { served: true, zoneId: zone.id, neighborhood: zone.neighborhood, feeCents: zone.feeCents, etaMinutes: zone.etaMinutes };
  }

  async save(input: { id?: string; neighborhood: string; feeCents: number; etaMinutes: number; active: boolean }) {
    const name = input.neighborhood.trim();
    if (!name) throw new BusinessRuleError('Informe o bairro.');
    if (input.feeCents < 0) throw new BusinessRuleError('A taxa não pode ser negativa.');
    const normalizedName = normalizeName(name);
    const clash = await this.prisma.deliveryZone.findUnique({ where: { normalizedName } });
    if (clash && clash.id !== input.id) throw new ConflictError('Esse bairro já está cadastrado.');
    const data = { neighborhood: name, normalizedName, feeCents: input.feeCents, etaMinutes: input.etaMinutes, active: input.active };
    if (input.id) {
      const found = await this.prisma.deliveryZone.findUnique({ where: { id: input.id } });
      if (!found) throw new NotFoundError('Bairro');
      return this.prisma.deliveryZone.update({ where: { id: input.id }, data });
    }
    return this.prisma.deliveryZone.create({ data });
  }

  async remove(id: string) {
    await this.prisma.deliveryZone.delete({ where: { id } }).catch(() => {
      throw new NotFoundError('Bairro');
    });
    return { ok: true };
  }
}

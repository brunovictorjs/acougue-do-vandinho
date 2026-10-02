import { Injectable } from '@nestjs/common';
import { BusinessRuleError, NotFoundError } from '../../../shared/domain/errors.js';
import { formatPhone, normalizePhone } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

export interface AttendantInput {
  fullName: string;
  phone: string;
  active: boolean;
}

/**
 * Human attendants are plain contact records (not platform users). The
 * assistant shares every active one, in `position` order, when a customer asks
 * for a person.
 */
@Injectable()
export class AttendantsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.attendant.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  }

  async active() {
    const rows = await this.prisma.attendant.findMany({ where: { active: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    return rows.map((a) => ({ fullName: a.fullName, phone: a.phone, phoneFormatted: formatPhone(a.phone) }));
  }

  private validate(input: AttendantInput) {
    const fullName = input.fullName.trim();
    if (fullName.split(/\s+/).length < 2) throw new BusinessRuleError('Informe o nome completo do atendente.');
    const phone = normalizePhone(input.phone);
    if (!phone) throw new BusinessRuleError('Telefone inválido. Use DDD + número.');
    return { fullName, phone, active: input.active };
  }

  async create(input: AttendantInput) {
    const last = await this.prisma.attendant.aggregate({ _max: { position: true } });
    return this.prisma.attendant.create({ data: { ...this.validate(input), position: (last._max.position ?? -1) + 1 } });
  }

  async update(id: string, input: AttendantInput) {
    await this.ensure(id);
    return this.prisma.attendant.update({ where: { id }, data: this.validate(input) });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.attendant.delete({ where: { id } });
    return { ok: true };
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(ids.map((id, position) => this.prisma.attendant.update({ where: { id }, data: { position } })));
    return this.list();
  }

  private async ensure(id: string) {
    const found = await this.prisma.attendant.findUnique({ where: { id } });
    if (!found) throw new NotFoundError('Atendente');
  }
}

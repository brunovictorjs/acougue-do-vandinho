import { Injectable } from '@nestjs/common';
import { Events } from '../../../shared/application/integration-events.js';
import { BusinessRuleError, NotFoundError } from '../../../shared/domain/errors.js';
import { DomainEventPublisher } from '../../../shared/infrastructure/events/domain-event-publisher.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { DeliveryZonesService } from '../../store/application/delivery-zones.service.js';
import { Geocoder } from '../infrastructure/geocoder.js';

export interface AddressInput {
  label: string;
  zipCode: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zones: DeliveryZonesService,
    private readonly geocoder: Geocoder,
    private readonly events: DomainEventPublisher,
  ) {}

  async list(userId: string) {
    const rows = await this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
    return Promise.all(rows.map(async (a) => ({ ...a, delivery: await this.zones.quote(a.neighborhood) })));
  }

  async get(userId: string, id: string) {
    const a = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!a) throw new NotFoundError('Endereço');
    return a;
  }

  private clean(input: AddressInput) {
    const zip = input.zipCode.replace(/\D/g, '');
    if (zip.length !== 8) throw new BusinessRuleError('CEP inválido.');
    const required: Array<[string, string]> = [
      [input.street, 'rua'],
      [input.number, 'número'],
      [input.neighborhood, 'bairro'],
      [input.city, 'cidade'],
      [input.state, 'estado'],
    ];
    for (const [value, name] of required) if (!value?.trim()) throw new BusinessRuleError(`Informe ${name}.`);
    return {
      label: input.label.trim() || 'Casa',
      zipCode: `${zip.slice(0, 5)}-${zip.slice(5)}`,
      street: input.street.trim(),
      number: input.number.trim(),
      complement: input.complement?.trim() || null,
      neighborhood: input.neighborhood.trim(),
      city: input.city.trim(),
      state: input.state.trim().toUpperCase().slice(0, 2),
      reference: input.reference?.trim() || null,
    };
  }

  private async coordinates(data: ReturnType<AddressesService['clean']>, input: AddressInput) {
    if (input.latitude != null && input.longitude != null) return { latitude: input.latitude, longitude: input.longitude };
    const point = await this.geocoder.locate(`${data.street}, ${data.number}, ${data.neighborhood}, ${data.city}, ${data.state}`);
    return { latitude: point?.latitude ?? null, longitude: point?.longitude ?? null };
  }

  async create(userId: string, input: AddressInput) {
    const data = this.clean(input);
    const count = await this.prisma.address.count({ where: { userId } });
    const isDefault = count === 0 || !!input.isDefault;
    const coords = await this.coordinates(data, input);
    const address = await this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...data, ...coords, userId, isDefault } });
    });
    if (count === 0) await this.announceOnboarding(userId);
    return { ...address, delivery: await this.zones.quote(address.neighborhood) };
  }

  async update(userId: string, id: string, input: AddressInput) {
    const current = await this.get(userId, id);
    const data = this.clean(input);
    const moved = current.street !== data.street || current.number !== data.number || current.neighborhood !== data.neighborhood || current.city !== data.city;
    const coords = moved || input.latitude != null ? await this.coordinates(data, input) : {};
    const address = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { ...data, ...coords, ...(input.isDefault ? { isDefault: true } : {}) } });
    });
    return { ...address, delivery: await this.zones.quote(address.neighborhood) };
  }

  async makeDefault(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.list(userId);
  }

  async remove(userId: string, id: string) {
    const address = await this.get(userId, id);
    const count = await this.prisma.address.count({ where: { userId } });
    if (count <= 1) throw new BusinessRuleError('Você precisa manter pelo menos um endereço.');
    await this.prisma.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return this.list(userId);
  }

  /** First address + verified phone completes onboarding → welcome message. */
  private async announceOnboarding(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'CUSTOMER' && user.phone && user.phoneVerifiedAt) {
      this.events.publish({ name: Events.CustomerOnboarded, userId, firstName: user.firstName, phone: user.phone });
    }
  }
}

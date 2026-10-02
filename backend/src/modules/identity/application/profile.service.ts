import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { Events } from '../../../shared/application/integration-events.js';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import { normalizePhone } from '../../../shared/domain/text.js';
import { DomainEventPublisher } from '../../../shared/infrastructure/events/domain-event-publisher.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { FileStorage } from '../../../shared/infrastructure/storage/file-storage.js';
import {
  assertCodeMatches,
  generatePhoneCode,
  hashPhoneCode,
  PHONE_CODE_TTL_MINUTES,
} from '../domain/phone-verification.js';

export interface MeView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  phoneVerified: boolean;
  role: 'CUSTOMER' | 'COURIER' | 'EMPLOYEE' | 'ADMIN';
  addressCount: number;
  onboardingComplete: boolean;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventPublisher,
    private readonly storage: FileStorage,
    private readonly config: AppConfig,
  ) {}

  async me(userId: string): Promise<MeView> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { addresses: true } } },
    });
    if (!u) throw new NotFoundError('Usuário');
    const phoneVerified = !!u.phoneVerifiedAt;
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: u.avatarUrl,
      phone: u.phone,
      phoneVerified,
      role: u.role,
      addressCount: u._count.addresses,
      // Couriers/admins are not forced through the customer onboarding.
      onboardingComplete: u.role !== 'CUSTOMER' || (phoneVerified && u._count.addresses > 0),
    };
  }

  async updateName(userId: string, firstName: string, lastName: string) {
    const first = firstName.trim();
    if (!first) throw new BusinessRuleError('Informe seu nome.');
    await this.prisma.user.update({ where: { id: userId }, data: { firstName: first, lastName: lastName.trim() } });
    return this.me(userId);
  }

  async updateAvatar(userId: string, file: { buffer: Buffer; mimetype: string; size: number; originalname: string }) {
    if (!IMAGE_TYPES.includes(file.mimetype)) throw new BusinessRuleError('Envie uma imagem JPG, PNG ou WEBP.');
    if (file.size > this.config.uploads.maxImageBytes) throw new BusinessRuleError('A imagem deve ter até 5 MB.');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const stored = await this.storage.save('avatars', file.originalname, file.buffer, file.mimetype);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: stored.url } });
    if (user.avatarUrl) await this.storage.remove(user.avatarUrl);
    return this.me(userId);
  }

  /** Sends a 6-digit code to the WhatsApp number (logged while Z-API is off). */
  async requestPhoneVerification(userId: string, rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BusinessRuleError('Telefone inválido. Use DDD + número.');
    const owner = await this.prisma.user.findUnique({ where: { phone } });
    if (owner && owner.id !== userId) throw new ConflictError('Este telefone já está em uso por outra conta.');

    const code = generatePhoneCode();
    await this.prisma.phoneVerification.deleteMany({ where: { userId } });
    await this.prisma.phoneVerification.create({
      data: {
        userId,
        phone,
        codeHash: hashPhoneCode(userId, code),
        expiresAt: new Date(Date.now() + PHONE_CODE_TTL_MINUTES * 60_000),
      },
    });
    this.events.publish({ name: Events.PhoneVerificationRequested, userId, phone, code });
    return { phone, expiresInMinutes: PHONE_CODE_TTL_MINUTES };
  }

  async confirmPhone(userId: string, code: string) {
    const pending = await this.prisma.phoneVerification.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    try {
      assertCodeMatches(pending, userId, code);
    } catch (e) {
      if (pending) await this.prisma.phoneVerification.update({ where: { id: pending.id }, data: { attempts: { increment: 1 } } });
      throw e;
    }
    const owner = await this.prisma.user.findUnique({ where: { phone: pending!.phone } });
    if (owner && owner.id !== userId) throw new ConflictError('Este telefone já está em uso por outra conta.');

    const before = await this.me(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { phone: pending!.phone, phoneVerifiedAt: new Date() } });
    await this.prisma.phoneVerification.deleteMany({ where: { userId } });
    const after = await this.me(userId);
    if (!before.onboardingComplete && after.onboardingComplete && after.phone) {
      this.events.publish({ name: Events.CustomerOnboarded, userId, firstName: after.firstName, phone: after.phone });
    }
    return after;
  }
}

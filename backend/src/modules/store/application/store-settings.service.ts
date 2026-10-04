import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { BusinessRuleError } from '../../../shared/domain/errors.js';
import { parseJson } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { FileStorage } from '../../../shared/infrastructure/storage/file-storage.js';
import { privacyPolicyTemplate, termsTemplate } from '../domain/legal-templates.js';
import { NOTIFICATION_TEMPLATES, NotificationTemplate, resolveNotifications } from '../domain/notification-templates.js';

export interface OpeningHours {
  label: string;
  value: string;
}

export interface StoreSettingsView {
  name: string;
  cnpj: string;
  whatsapp: string;
  addressLine: string;
  latitude: number | null;
  longitude: number | null;
  hours: OpeningHours[];
  about: string;
  heroImageUrl: string;
  pixExpirationMinutes: number;
  assistantEnabled: boolean;
  assistantPrompt: string;
  notifications: Record<NotificationTemplate, boolean>;
  notificationLabels: typeof NOTIFICATION_TEMPLATES;
  privacyPolicy: string;
  privacyUpdatedAt: Date | null;
  terms: string;
  termsUpdatedAt: Date | null;
}

export interface LegalDocumentView {
  markdown: string;
  updatedAt: Date | null;
}

export type StoreSettingsPatch = Partial<Omit<StoreSettingsView, 'notificationLabels' | 'privacyUpdatedAt' | 'termsUpdatedAt'>>;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly config: AppConfig,
  ) {}

  async get(): Promise<StoreSettingsView> {
    const s = await this.prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    return {
      name: s.name,
      cnpj: s.cnpj,
      whatsapp: s.whatsapp,
      addressLine: s.addressLine,
      latitude: s.latitude,
      longitude: s.longitude,
      hours: parseJson<OpeningHours[]>(s.hours, []),
      about: s.about,
      heroImageUrl: s.heroImageUrl,
      pixExpirationMinutes: s.pixExpirationMinutes,
      assistantEnabled: s.assistantEnabled,
      assistantPrompt: s.assistantPrompt,
      notifications: resolveNotifications(parseJson<Record<string, boolean>>(s.notifications, {})),
      notificationLabels: NOTIFICATION_TEMPLATES,
      privacyPolicy: s.privacyPolicy,
      privacyUpdatedAt: s.privacyUpdatedAt,
      terms: s.terms,
      termsUpdatedAt: s.termsUpdatedAt,
    };
  }

  /** What customers may see (no prompt, no toggles). */
  async publicInfo() {
    const s = await this.get();
    return {
      name: s.name,
      cnpj: s.cnpj,
      whatsapp: s.whatsapp,
      addressLine: s.addressLine,
      latitude: s.latitude,
      longitude: s.longitude,
      hours: s.hours,
      about: s.about,
      // Vazio: o frontend cai na imagem padrao do hero.
      heroImageUrl: s.heroImageUrl,
    };
  }

  /** Troca a imagem de fundo do hero e descarta a anterior. */
  async updateHeroImage(file: { buffer: Buffer; mimetype: string; size: number; originalname: string }) {
    if (!IMAGE_TYPES.includes(file.mimetype)) throw new BusinessRuleError('Envie uma imagem JPG, PNG ou WEBP.');
    if (file.size > this.config.uploads.maxImageBytes) throw new BusinessRuleError('A imagem deve ter ate 5 MB.');
    const current = await this.get();
    const stored = await this.storage.save('store', file.originalname, file.buffer, file.mimetype);
    await this.prisma.storeSettings.update({ where: { id: 1 }, data: { heroImageUrl: stored.url } });
    if (current.heroImageUrl) await this.storage.remove(current.heroImageUrl);
    return this.get();
  }

  /** Volta para a imagem padrao do hero. */
  async removeHeroImage() {
    const current = await this.get();
    if (!current.heroImageUrl) return current;
    await this.prisma.storeSettings.update({ where: { id: 1 }, data: { heroImageUrl: '' } });
    await this.storage.remove(current.heroImageUrl);
    return this.get();
  }

  /** Documentos publicos (/privacidade e /termos), tambem usados na tela de consentimento do Google OAuth. */
  async legal() {
    const s = await this.get();
    return {
      privacy: { markdown: s.privacyPolicy, updatedAt: s.privacyUpdatedAt } satisfies LegalDocumentView,
      terms: { markdown: s.terms, updatedAt: s.termsUpdatedAt } satisfies LegalDocumentView,
      store: { name: s.name, cnpj: s.cnpj, whatsapp: s.whatsapp, addressLine: s.addressLine },
    };
  }

  /** Rascunhos sugeridos, ja preenchidos com os dados da loja, como ponto de partida para o admin. */
  async legalTemplates() {
    const s = await this.get();
    const store = { name: s.name, cnpj: s.cnpj, addressLine: s.addressLine, whatsapp: s.whatsapp };
    return { privacyPolicy: privacyPolicyTemplate(store), terms: termsTemplate(store) };
  }

  async update(patch: StoreSettingsPatch) {
    const { hours, notifications, privacyPolicy, terms, ...rest } = patch;
    const current = await this.get();
    const now = new Date();
    await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {
        ...rest,
        ...(hours ? { hours: JSON.stringify(hours) } : {}),
        ...(notifications ? { notifications: JSON.stringify(notifications) } : {}),
        // O carimbo de ultima atualizacao so muda quando o texto publicado muda.
        ...(privacyPolicy !== undefined && privacyPolicy !== current.privacyPolicy ? { privacyPolicy, privacyUpdatedAt: now } : {}),
        ...(terms !== undefined && terms !== current.terms ? { terms, termsUpdatedAt: now } : {}),
      },
    });
    return this.get();
  }

  async isNotificationEnabled(template: NotificationTemplate) {
    return (await this.get()).notifications[template];
  }
}

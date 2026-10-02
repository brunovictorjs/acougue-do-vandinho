import { Injectable } from '@nestjs/common';
import { parseJson } from '../../../shared/domain/text.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
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
  pixExpirationMinutes: number;
  assistantEnabled: boolean;
  assistantPrompt: string;
  notifications: Record<NotificationTemplate, boolean>;
  notificationLabels: typeof NOTIFICATION_TEMPLATES;
}

export type StoreSettingsPatch = Partial<Omit<StoreSettingsView, 'notificationLabels'>>;

@Injectable()
export class StoreSettingsService {
  constructor(private readonly prisma: PrismaService) {}

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
      pixExpirationMinutes: s.pixExpirationMinutes,
      assistantEnabled: s.assistantEnabled,
      assistantPrompt: s.assistantPrompt,
      notifications: resolveNotifications(parseJson<Record<string, boolean>>(s.notifications, {})),
      notificationLabels: NOTIFICATION_TEMPLATES,
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
    };
  }

  async update(patch: StoreSettingsPatch) {
    const { hours, notifications, ...rest } = patch;
    await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {
        ...rest,
        ...(hours ? { hours: JSON.stringify(hours) } : {}),
        ...(notifications ? { notifications: JSON.stringify(notifications) } : {}),
      },
    });
    return this.get();
  }

  async isNotificationEnabled(template: NotificationTemplate) {
    return (await this.get()).notifications[template];
  }
}

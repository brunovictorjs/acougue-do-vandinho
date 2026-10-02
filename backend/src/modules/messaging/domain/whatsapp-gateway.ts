export interface LocationMessage {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
}

export interface SendResult {
  providerMessageId: string | null;
}

/**
 * Outbound WhatsApp port. `LogWhatsAppGateway` (default) prints messages to
 * the server log; `ZApiWhatsAppGateway` talks to Z-API once
 * WHATSAPP_PROVIDER=zapi and the instance credentials are set.
 */
export abstract class WhatsAppGateway {
  abstract readonly name: 'log' | 'zapi';
  abstract sendText(phone: string, text: string): Promise<SendResult>;
  abstract sendLocation(phone: string, location: LocationMessage): Promise<SendResult>;
}

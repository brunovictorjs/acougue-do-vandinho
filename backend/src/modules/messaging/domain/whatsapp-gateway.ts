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
 * A rejected send. `retryable` decides whether the outbox tries again: a
 * timeout, a 429 or a provider 5xx will succeed later, while a 400 on a
 * malformed number never will.
 */
export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'WhatsAppSendError';
  }
}

/**
 * Outbound WhatsApp port. `LogWhatsAppGateway` (default) prints messages to
 * the server log; `ZApiWhatsAppGateway` talks to Z-API once
 * WHATSAPP_PROVIDER=zapi and the instance credentials are set.
 *
 * Callers do not use this directly — `WhatsAppSender` queues into the outbox
 * and `OutboxWorker` is the only thing that invokes a gateway.
 */
export abstract class WhatsAppGateway {
  abstract readonly name: 'log' | 'zapi';
  abstract sendText(phone: string, text: string): Promise<SendResult>;
  abstract sendLocation(phone: string, location: LocationMessage): Promise<SendResult>;
}

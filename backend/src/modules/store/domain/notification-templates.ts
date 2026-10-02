/** WhatsApp notifications the admin can switch on/off. */
export const NOTIFICATION_TEMPLATES = {
  welcome: 'Boas-vindas após o cadastro',
  paid: 'Pagamento aprovado (entrega)',
  pickup: 'Retirada: localização e código',
  started: 'Saiu para entrega',
  delivered: 'Pedido entregue',
  picked_up: 'Pedido retirado na loja',
  failed: 'Não foi possível entregar',
  cancelled: 'Pedido cancelado e reembolso iniciado',
  refunded: 'Reembolso concluído',
} as const;

export type NotificationTemplate = keyof typeof NOTIFICATION_TEMPLATES;

export function resolveNotifications(stored: Record<string, boolean>): Record<NotificationTemplate, boolean> {
  const result = {} as Record<NotificationTemplate, boolean>;
  for (const key of Object.keys(NOTIFICATION_TEMPLATES) as NotificationTemplate[]) {
    result[key] = stored[key] ?? true;
  }
  return result;
}

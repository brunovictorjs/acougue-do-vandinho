/** Avisos por e-mail para a administração, cada um ligável/desligável no painel. */
export const ADMIN_EMAIL_NOTIFICATIONS = {
  paid: 'Pedido pago (preparar)',
  cancelled: 'Pedido cancelado e reembolsado',
  delivered: 'Pedido entregue ou retirado',
  failed: 'Pedido não entregue',
} as const;

export type AdminEmailNotification = keyof typeof ADMIN_EMAIL_NOTIFICATIONS;

export function resolveAdminEmailNotifications(stored: Record<string, boolean>): Record<AdminEmailNotification, boolean> {
  const result = {} as Record<AdminEmailNotification, boolean>;
  for (const key of Object.keys(ADMIN_EMAIL_NOTIFICATIONS) as AdminEmailNotification[]) {
    result[key] = stored[key] ?? true;
  }
  return result;
}

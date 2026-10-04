-- AlterTable: quais avisos de pedido a administração recebe por e-mail
-- (pago, cancelado, entregue/retirado, não entregue). Vazio = todos ligados.
ALTER TABLE "StoreSettings" ADD COLUMN "adminEmailNotifications" TEXT NOT NULL DEFAULT '{}';

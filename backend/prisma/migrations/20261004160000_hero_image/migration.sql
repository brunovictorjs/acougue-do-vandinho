-- AlterTable: imagem de fundo do hero da home, configurável pelo admin.
-- Vazio = o frontend usa a imagem padrão (/meats.jpg).
ALTER TABLE "StoreSettings" ADD COLUMN "heroImageUrl" TEXT NOT NULL DEFAULT '';

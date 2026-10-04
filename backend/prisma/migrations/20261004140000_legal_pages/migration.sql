-- AlterTable: páginas legais (política de privacidade e termos de serviço) em Markdown,
-- exigidas pela verificação do Google OAuth.
ALTER TABLE "StoreSettings" ADD COLUMN "privacyPolicy" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StoreSettings" ADD COLUMN "privacyUpdatedAt" DATETIME;
ALTER TABLE "StoreSettings" ADD COLUMN "terms" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StoreSettings" ADD COLUMN "termsUpdatedAt" DATETIME;

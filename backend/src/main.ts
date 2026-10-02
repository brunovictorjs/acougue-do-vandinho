import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';

async function bootstrap() {
  const bootConfig = new AppConfig();
  mkdirSync(bootConfig.uploads.dir, { recursive: true });

  // rawBody is required to verify Stripe webhook signatures.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(AppConfig);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: config.frontendUrl, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }));
  app.set('trust proxy', 1);

  await app.listen(config.port);
  const logger = new Logger('Bootstrap');
  logger.log(`API em http://localhost:${config.port}/api`);
  logger.log(
    `Pagamentos: ${config.payments.provider} · WhatsApp: ${config.whatsapp.provider} · IA: ${config.assistant.apiKey ? config.assistant.model : 'regras (sem ANTHROPIC_API_KEY)'} · Login dev: ${config.devLoginEnabled ? 'ligado' : 'desligado'}`,
  );
}
await bootstrap();

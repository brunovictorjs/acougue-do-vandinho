import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { AppConfig } from '../../../config/app-config.js';
import { PageQuery } from '../../../shared/application/pagination.js';
import { Public, Roles } from '../../../shared/presentation/auth.js';
import { InboundService } from '../application/inbound.service.js';

class SimulateDto {
  @IsString() @Length(10, 20) phone!: string;
  @IsString() @Length(1, 2000) text!: string;
}

/** Subset of Z-API's "on message received" payload we rely on. */
interface ZApiReceived {
  phone?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  isNewsletter?: boolean;
  senderName?: string;
  text?: { message?: string };
}

@Controller('webhooks/zapi')
export class ZApiWebhookController {
  constructor(
    private readonly inbound: InboundService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Query('secret') secret: string | undefined, @Body() body: ZApiReceived) {
    const expected = this.config.whatsapp.webhookSecret;
    if (!expected || secret !== expected) throw new ForbiddenException();
    // Only direct text messages from customers.
    if (body.fromMe || body.isGroup || body.isNewsletter || !body.phone || !body.text?.message) return { ignored: true };
    return this.inbound.receive(body.phone, body.text.message, body.senderName ?? null, 'zapi');
  }
}

@Roles('ADMIN')
@Controller('admin/whatsapp')
export class AdminWhatsAppController {
  constructor(private readonly inbound: InboundService) {}

  @Get('stats')
  stats() {
    return this.inbound.stats();
  }

  @Get('conversations')
  conversations(@Query() q: PageQuery) {
    return this.inbound.conversations(q.page);
  }

  @Get('conversations/:phone')
  messages(@Param('phone') phone: string) {
    return this.inbound.messages(phone);
  }

  /** Test the virtual attendant as if `phone` had sent `text` on WhatsApp. */
  @Post('simulate')
  @HttpCode(200)
  simulate(@Body() dto: SimulateDto) {
    return this.inbound.receive(dto.phone, dto.text, null, 'simulator');
  }
}

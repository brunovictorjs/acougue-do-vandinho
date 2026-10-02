import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../domain/errors.js';

/** Translates domain errors into HTTP responses with a stable `{ message, code }` body. */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('DomainError');

  catch(error: DomainError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status: number = HttpStatus.BAD_REQUEST;
    if (error instanceof NotFoundError) status = HttpStatus.NOT_FOUND;
    else if (error instanceof ForbiddenError) status = HttpStatus.FORBIDDEN;
    else if (error instanceof ConflictError) status = HttpStatus.CONFLICT;
    else if (error instanceof BusinessRuleError) status = HttpStatus.UNPROCESSABLE_ENTITY;
    this.logger.debug(`${status} ${error.code}: ${error.message}`);
    res.status(status).json({ statusCode: status, message: error.message, code: error.code });
  }
}

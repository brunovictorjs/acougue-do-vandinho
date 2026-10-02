/**
 * Domain/application errors. The presentation layer maps each kind to an HTTP
 * status (see DomainExceptionFilter), so use cases never import Nest's HTTP
 * exceptions.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code = 'domain_error',
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** A business rule was violated (HTTP 422). */
export class BusinessRuleError extends DomainError {}

/** The resource does not exist or is not visible to the caller (HTTP 404). */
export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(`${what} não encontrado(a).`, 'not_found');
  }
}

/** The caller may not perform this action (HTTP 403). */
export class ForbiddenError extends DomainError {
  constructor(message = 'Você não tem permissão para esta ação.') {
    super(message, 'forbidden');
  }
}

/** State changed concurrently or already in the target state (HTTP 409). */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'conflict');
  }
}

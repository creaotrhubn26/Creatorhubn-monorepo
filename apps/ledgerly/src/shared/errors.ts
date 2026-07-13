/** Typede domenefeil. API-laget oversetter disse til HTTP-statuser ved systemgrensen. */

export class DomainError extends Error {
  constructor(
    message: string,
    /** Maskinlesbar feilkode, stabil på tvers av versjoner. */
    readonly code: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class PeriodLockedError extends DomainError {
  constructor(message: string) {
    super(message, 'PERIOD_LOCKED');
    this.name = 'PeriodLockedError';
  }
}

export class UnbalancedEntryError extends DomainError {
  constructor(message: string) {
    super(message, 'UNBALANCED_ENTRY');
    this.name = 'UnbalancedEntryError';
  }
}

export class DuplicateError extends DomainError {
  constructor(message: string) {
    super(message, 'DUPLICATE');
    this.name = 'DuplicateError';
  }
}

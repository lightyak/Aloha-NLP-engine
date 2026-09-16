import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ProviderError,
  DatabaseError,
} from '../../src/utils/errors.js';

describe('Error Classes', () => {
  it('should instantiate AppError with defaults and custom parameters', () => {
    const error = new AppError('Custom error', 418, 'I_AM_A_TEAPOT', true, { detail: 123 });
    expect(error.message).toBe('Custom error');
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('I_AM_A_TEAPOT');
    expect(error.isOperational).toBe(true);
    expect(error.details).toEqual({ detail: 123 });
  });

  it('should instantiate ValidationError with 400 status', () => {
    const error = new ValidationError('Invalid field', { field: 'price' });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid field');
    expect(error.details).toEqual({ field: 'price' });
  });

  it('should instantiate NotFoundError with 404 status', () => {
    const error = new NotFoundError('Product');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Product not found');
  });

  it('should instantiate ConflictError with 409 status', () => {
    const error = new ConflictError('Resource already exists');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });

  it('should instantiate ProviderError with 502 status', () => {
    const error = new ProviderError('WhisperSTT', 'Connection timed out');
    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('PROVIDER_ERROR');
    expect(error.message).toContain('WhisperSTT');
  });

  it('should instantiate DatabaseError with 500 status', () => {
    const error = new DatabaseError('Connection refused');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('DATABASE_ERROR');
    expect(error.isOperational).toBe(false);
  });
});

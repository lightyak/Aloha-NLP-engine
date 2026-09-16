import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, reqId: req.id }, `Non-operational error: ${err.message}`);
    } else {
      logger.warn({ err, reqId: req.id }, `Operational error: ${err.message}`);
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Unhandled / unexpected errors
  logger.error({ err, reqId: req.id }, `Unhandled exception: ${err.message}`);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.app.isProduction ? 'An unexpected error occurred' : err.message,
      ...(config.app.isDevelopment ? { stack: err.stack } : {}),
    },
  });
}

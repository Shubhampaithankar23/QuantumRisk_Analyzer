import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const createError = (statusCode: number, code: string, message: string, details?: any): AppError => {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
};

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed against schema',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      success: false,
    });
  }

  const statusCode = err.statusCode || 500;
  const code =
    err.code ||
    (statusCode === 400
      ? 'BAD_REQUEST'
      : statusCode === 401
      ? 'UNAUTHORIZED'
      : statusCode === 403
      ? 'FORBIDDEN'
      : statusCode === 404
      ? 'NOT_FOUND'
      : statusCode === 409
      ? 'CONFLICT'
      : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    code,
    message,
    details: err.details || null,
    success: false,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

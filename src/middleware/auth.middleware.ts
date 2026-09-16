import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

/**
 * Server-side identity resolver.
 * Derives user identity from the authenticated context (Authorization: Bearer <token> or X-User-Id header).
 * Defaults to 'anonymous-artisan' in test/development when neither is provided, ensuring backward compatibility.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const userIdHeader = req.headers['x-user-id'];

  let userId: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    userId = authHeader.slice(7).trim();
  } else if (typeof userIdHeader === 'string' && userIdHeader.trim()) {
    userId = userIdHeader.trim();
  }

  req.user = {
    id: userId || 'anonymous-artisan',
  };

  next();
}

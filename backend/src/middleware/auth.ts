import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  institutionId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'pq-readiness-institutional-secret-key-2026-development';

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // In local demo development mode, fallback to default admin user if available
    try {
      const defaultUser = await prisma.user.findFirst({
        include: { institution: true },
      });
      if (defaultUser) {
        req.user = {
          id: defaultUser.id,
          email: defaultUser.email,
          name: defaultUser.name,
          role: defaultUser.role,
          institutionId: defaultUser.institutionId,
        };
        return next();
      }
    } catch {
      // Continue without user if database is not yet ready
    }

    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires one of [${roles.join(', ')}] roles.`,
      });
    }

    next();
  };
};

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { seedDatabase } from '../lib/seed';

const JWT_SECRET = process.env.JWT_SECRET || 'pq-readiness-institutional-secret-key-2026-development';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const login = async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { institution: true },
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password credentials',
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password credentials',
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      institutionId: user.institutionId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Record audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      institutionId: user.institutionId,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: JSON.stringify({ email: user.email, role: user.role }),
      ipAddress: req.ip,
    },
  });

  res.status(200).json({
    success: true,
    message: 'Authentication successful',
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        institution: user.institution,
      },
    },
  });
};

export const getMe = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      institution: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.status(200).json({
    success: true,
    data: user,
  });
};

export const seedDemo = async (req: Request, res: Response) => {
  try {
    const result = await seedDatabase();
    res.status(200).json({
      success: true,
      message: 'Demo institution and baseline datasets successfully initialized',
      data: result,
    });
  } catch (error: any) {
    console.error('Failed to seed demo data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed demo data',
      error: error.message,
    });
  }
};

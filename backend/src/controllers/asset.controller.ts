import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';

const assetSchema = z.object({
  name: z.string().min(2, 'Asset name is required'),
  identifier: z.string().min(2, 'Identifier/hostname is required'),
  assetType: z.enum([
    'WEBSITE',
    'SERVER',
    'APPLICATION',
    'DATABASE',
    'DIGITAL_CERTIFICATE',
    'STORAGE_BACKUP',
  ]),
  dataSensitivity: z
    .enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'HIGHLY_SENSITIVE', 'REGULATED'])
    .default('CONFIDENTIAL'),
  knownAlgorithms: z.string().optional(),
  informationSource: z
    .enum(['TLS_SCAN', 'IMPORT_CSV', 'IMPORT_XLSX', 'IMPORT_JSON', 'MANUAL'])
    .default('MANUAL'),
  tlsVersion: z.string().optional(),
  port: z.number().int().min(1).max(65535).default(443),
  environment: z.enum(['PRODUCTION', 'STAGING', 'DEVELOPMENT']).default('PRODUCTION'),
  notes: z.string().optional(),
});

export const getAssets = async (req: Request, res: Response) => {
  try {
    const {
      search,
      assetType,
      dataSensitivity,
      assessmentStatus,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { identifier: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    if (assetType && typeof assetType === 'string' && assetType !== 'ALL') {
      where.assetType = assetType;
    }

    if (dataSensitivity && typeof dataSensitivity === 'string' && dataSensitivity !== 'ALL') {
      where.dataSensitivity = dataSensitivity;
    }

    if (assessmentStatus && typeof assessmentStatus === 'string' && assessmentStatus !== 'ALL') {
      where.assessmentStatus = assessmentStatus;
    }

    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { updatedAt: 'desc' },
        include: {
          findings: {
            select: {
              id: true,
              riskLevel: true,
              status: true,
            },
          },
          assessments: {
            take: 1,
            orderBy: { assessedAt: 'desc' },
            select: {
              id: true,
              quantumRiskScore: true,
              overallReadinessStatus: true,
              assessedAt: true,
            },
          },
          scanJobs: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              completedAt: true,
            },
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: assets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Failed to get assets:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assets', error: error.message });
  }
};

export const getAssetById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        institution: true,
        findings: {
          include: {
            recommendations: true,
            remediationTasks: true,
          },
        },
        assessments: {
          orderBy: { assessedAt: 'desc' },
        },
        scanJobs: {
          orderBy: { createdAt: 'desc' },
          include: {
            results: true,
          },
        },
      },
    });

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    res.status(200).json({ success: true, data: asset });
  } catch (error: any) {
    console.error('Failed to get asset by ID:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve asset details', error: error.message });
  }
};

export const createAsset = async (req: Request, res: Response) => {
  try {
    const validatedData = assetSchema.parse(req.body);

    // Get default institution
    let institution = await prisma.institution.findFirst();
    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          name: 'Apex University of Science & Technology',
          domain: 'apex.edu',
        },
      });
    }

    const finalIdentifier = (
      validatedData.identifier && validatedData.identifier.trim() !== ''
        ? validatedData.identifier.trim()
        : validatedData.name.toLowerCase().replace(/[^a-z0-9.-]/g, '-')
    );

    // Check duplicate identifier
    const existing = await prisma.asset.findFirst({
      where: {
        identifier: finalIdentifier,
        institutionId: institution.id,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `An asset with identifier "${finalIdentifier}" already exists.`,
      });
    }

    // Manual asset creation is strictly recorded as MANUAL (user_reported, unverified)
    // Never allow manual creation to pretend to be a scanner_verified TLS scan
    const infoSource =
      validatedData.informationSource && validatedData.informationSource !== 'TLS_SCAN'
        ? validatedData.informationSource
        : 'MANUAL';

    const newAsset = await prisma.asset.create({
      data: {
        ...validatedData,
        identifier: finalIdentifier,
        informationSource: infoSource,
        institutionId: institution.id,
        assessmentStatus: 'PENDING',
      },
    });

    // Record initial AuditLog entry
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id || null,
        institutionId: institution.id,
        action: 'ASSET_CREATED',
        entityType: 'Asset',
        entityId: newAsset.id,
        details: JSON.stringify({
          name: newAsset.name,
          identifier: newAsset.identifier,
          informationSource: newAsset.informationSource,
          environment: newAsset.environment,
          dataSensitivity: newAsset.dataSensitivity,
          knownAlgorithms: newAsset.knownAlgorithms,
        }),
        ipAddress: req.ip || req.socket.remoteAddress || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Asset successfully registered (manual / user-reported entry)',
      data: newAsset,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: error.errors });
    }
    console.error('Failed to create asset:', error);
    res.status(500).json({ success: false, message: 'Failed to register asset', error: error.message });
  }
};

export const updateAsset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = assetSchema.partial().parse(req.body);

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    // Prevent changing source to TLS_SCAN manually
    if (validatedData.informationSource === 'TLS_SCAN' && asset.informationSource !== 'TLS_SCAN') {
      validatedData.informationSource = asset.informationSource as any;
    }

    // Compute field-by-field diff for edit history audit
    const changedFields: Record<string, { before: any; after: any }> = {};
    for (const [key, val] of Object.entries(validatedData)) {
      if ((asset as any)[key] !== val && val !== undefined) {
        changedFields[key] = { before: (asset as any)[key], after: val };
      }
    }

    const updated = await prisma.asset.update({
      where: { id },
      data: validatedData,
    });

    // Record audit log with exact delta for change history tracking
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id || null,
        institutionId: asset.institutionId,
        action: 'ASSET_UPDATED',
        entityType: 'Asset',
        entityId: updated.id,
        details: JSON.stringify({
          changedFields,
          updatedKeys: Object.keys(changedFields),
        }),
        ipAddress: req.ip || req.socket.remoteAddress || null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Asset updated successfully',
      data: updated,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: error.errors });
    }
    console.error('Failed to update asset:', error);
    res.status(500).json({ success: false, message: 'Failed to update asset', error: error.message });
  }
};

export const deleteAsset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const asset = await prisma.asset.findUnique({ where: { id } });

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    await prisma.asset.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id || null,
        institutionId: asset.institutionId,
        action: 'ASSET_DELETED',
        entityType: 'Asset',
        entityId: id,
        details: JSON.stringify({ name: asset.name, identifier: asset.identifier }),
        ipAddress: req.ip || req.socket.remoteAddress || null,
      },
    });

    res.status(200).json({
      success: true,
      message: `Asset "${asset.name}" and related assessments deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Failed to delete asset:', error);
    res.status(500).json({ success: false, message: 'Failed to delete asset', error: error.message });
  }
};

export const getAssetHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const history = await prisma.auditLog.findMany({
      where: {
        entityType: 'Asset',
        entityId: id,
      },
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: history,
      asset: {
        id: asset.id,
        name: asset.name,
        identifier: asset.identifier,
        informationSource: asset.informationSource,
      },
    });
  } catch (error: any) {
    console.error('Failed to get asset history:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve asset history', error: error.message });
  }
};

import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { runAssessmentForAsset } from '../services/assessment.service';

const assetSchema = z.object({
  name: z.string().min(2, 'Asset name is required'),
  identifier: z.string().optional(),
  assetType: z.string().min(2, 'Asset type is required'),
  dataSensitivity: z
    .enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'HIGHLY_SENSITIVE', 'REGULATED'])
    .default('CONFIDENTIAL'),
  knownAlgorithms: z.string().optional(),
  informationSource: z
    .enum(['TLS_SCAN', 'IMPORT_CSV', 'IMPORT_XLSX', 'IMPORT_JSON', 'MANUAL'])
    .default('MANUAL'),
  tlsVersion: z.string().optional(),
  port: z.number().int().min(1).max(65535).default(443),
  environment: z.string().default('PRODUCTION'),
  notes: z.string().optional(),
  department: z.string().optional(),
  owner: z.string().optional(),
  criticality: z.string().optional(),
  certPubKeyAlgo: z.string().optional(),
  certKeySize: z.union([z.number(), z.string()]).optional(),
  certSignatureAlgo: z.string().optional(),
  cipherSuite: z.string().optional(),
  keyExchangeGroup: z.string().optional(),
  cryptoInventory: z.array(z.any()).optional(),
});

const emptyStringToNull = (val: unknown) => {
  if (typeof val === 'string' && val.trim() === '') return null;
  return val;
};

const emptyStringToUndefined = (val: unknown) => {
  if (typeof val === 'string' && val.trim() === '') return undefined;
  if (val === null) return undefined;
  return val;
};

export const updateAssetSchema = z.object({
  name: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(2, 'Asset name must be at least 2 characters').optional()
  ),
  identifier: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1, 'System identifier cannot be empty').optional()
  ),
  assetType: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(2, 'Asset type is required').optional()
  ),
  dataSensitivity: z.preprocess(
    emptyStringToUndefined,
    z
      .enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'HIGHLY_SENSITIVE', 'REGULATED'], {
        errorMap: () => ({ message: 'Invalid data sensitivity tier' }),
      })
      .optional()
  ),
  knownAlgorithms: z.preprocess(
    (val) => (val === '' || val === 'Unknown' || val === null ? null : typeof val === 'string' ? val.trim() : val),
    z.string().nullable().optional()
  ),
  informationSource: z.preprocess(
    emptyStringToUndefined,
    z
      .enum(['TLS_SCAN', 'IMPORT_CSV', 'IMPORT_XLSX', 'IMPORT_JSON', 'MANUAL'], {
        errorMap: () => ({ message: 'Invalid information source' }),
      })
      .optional()
  ),
  tlsVersion: z.preprocess(
    (val) => (val === '' || val === 'Unknown' || val === null ? null : typeof val === 'string' ? val.trim() : val),
    z.string().nullable().optional()
  ),
  port: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? val : num;
    },
    z
      .number({ invalid_type_error: 'Port must be a valid integer' })
      .int('Port must be a valid integer')
      .min(1, 'Port must be between 1 and 65535')
      .max(65535, 'Port must be between 1 and 65535')
      .optional()
  ),
  environment: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
  notes: z.preprocess(
    (val) => (val === '' || val === null ? null : typeof val === 'string' ? val.trim() : val),
    z.string().nullable().optional()
  ),
  department: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  owner: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  criticality: z.preprocess(emptyStringToNull, z.union([z.number(), z.string()]).nullable().optional()),
  certPubKeyAlgo: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  certKeySize: z.preprocess(emptyStringToNull, z.union([z.number(), z.string()]).nullable().optional()),
  certSignatureAlgo: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  cipherSuite: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  keyExchangeGroup: z.preprocess(emptyStringToNull, z.string().nullable().optional()),
  cryptoInventory: z.array(z.any()).optional(),
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

    // Synthesize knownAlgorithms from crypto dropdowns if not directly specified
    let finalKnownAlgorithms = validatedData.knownAlgorithms;
    if (!finalKnownAlgorithms) {
      const items: any[] = [];
      if (validatedData.certPubKeyAlgo && validatedData.certPubKeyAlgo !== 'Unknown') {
        const sizeStr =
          validatedData.certKeySize && validatedData.certKeySize !== 'Unknown'
            ? `-${validatedData.certKeySize}`
            : '';
        items.push({
          algorithm: `${validatedData.certPubKeyAlgo}${sizeStr}`,
          purpose: 'DIGITAL_SIGNATURE',
          source: 'user_reported',
        });
      }
      if (validatedData.keyExchangeGroup && validatedData.keyExchangeGroup !== 'Unknown') {
        items.push({
          algorithm: validatedData.keyExchangeGroup,
          purpose: 'KEY_ESTABLISHMENT',
          source: 'user_reported',
        });
      }
      if (validatedData.cipherSuite && validatedData.cipherSuite !== 'Unknown') {
        items.push({
          algorithm: validatedData.cipherSuite,
          purpose: 'SYMMETRIC_ENCRYPTION',
          source: 'user_reported',
        });
      }
      if (Array.isArray(validatedData.cryptoInventory) && validatedData.cryptoInventory.length > 0) {
        for (const c of validatedData.cryptoInventory) {
          if (c && c.algorithm && c.algorithm !== 'Unknown') {
            items.push({
              algorithm: c.algorithm,
              keySize: c.keySize !== 'Unknown' ? c.keySize : undefined,
              purpose: c.purpose !== 'Unknown' ? c.purpose : 'UNKNOWN',
              source: c.evidenceSource || 'user_reported',
            });
          }
        }
      }
      if (items.length > 0) {
        finalKnownAlgorithms = JSON.stringify(items);
      }
    }

    let finalNotes = validatedData.notes || '';
    const metaParts: string[] = [];
    if (validatedData.department) metaParts.push(`Department: ${validatedData.department}`);
    if (validatedData.owner) metaParts.push(`Owner: ${validatedData.owner}`);
    if (validatedData.criticality) metaParts.push(`Criticality: ${validatedData.criticality}`);
    if (metaParts.length > 0) {
      finalNotes = finalNotes ? `${finalNotes} | ${metaParts.join(', ')}` : metaParts.join(', ');
    }

    const newAsset = await prisma.asset.create({
      data: {
        name: validatedData.name,
        identifier: finalIdentifier,
        assetType: validatedData.assetType,
        dataSensitivity: validatedData.dataSensitivity,
        knownAlgorithms: finalKnownAlgorithms || null,
        informationSource: infoSource,
        institutionId: institution.id,
        tlsVersion: validatedData.tlsVersion && validatedData.tlsVersion !== 'Unknown' ? validatedData.tlsVersion : null,
        port: validatedData.port || 443,
        environment: validatedData.environment || 'PRODUCTION',
        notes: finalNotes || null,
        assessmentStatus: 'PENDING',
      },
    });

    // Run assessment engine for this manual asset
    try {
      await runAssessmentForAsset(newAsset.id);
    } catch (assessErr) {
      console.warn('Initial assessment of manual asset:', assessErr);
    }

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

    // Validate and whitelist input data, coercing types and converting empty strings/nulls
    const validatedData = updateAssetSchema.parse(req.body);

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    // Never allow manual update to forge TLS_SCAN provenance
    let finalInfoSource = asset.informationSource;
    if (validatedData.informationSource && validatedData.informationSource !== 'TLS_SCAN') {
      if (asset.informationSource === 'MANUAL' || validatedData.informationSource === asset.informationSource) {
        finalInfoSource = validatedData.informationSource;
      }
    }

    // Synthesize knownAlgorithms from crypto dropdowns if not directly specified but dropdowns are passed
    let finalKnownAlgorithms = validatedData.knownAlgorithms;
    if (finalKnownAlgorithms === undefined) {
      const items: any[] = [];
      if (validatedData.certPubKeyAlgo && validatedData.certPubKeyAlgo !== 'Unknown') {
        const sizeStr =
          validatedData.certKeySize && validatedData.certKeySize !== 'Unknown'
            ? `-${validatedData.certKeySize}`
            : '';
        items.push({
          algorithm: `${validatedData.certPubKeyAlgo}${sizeStr}`,
          purpose: 'DIGITAL_SIGNATURE',
          source: 'user_reported',
        });
      }
      if (validatedData.keyExchangeGroup && validatedData.keyExchangeGroup !== 'Unknown') {
        items.push({
          algorithm: validatedData.keyExchangeGroup,
          purpose: 'KEY_ESTABLISHMENT',
          source: 'user_reported',
        });
      }
      if (validatedData.cipherSuite && validatedData.cipherSuite !== 'Unknown') {
        items.push({
          algorithm: validatedData.cipherSuite,
          purpose: 'SYMMETRIC_ENCRYPTION',
          source: 'user_reported',
        });
      }
      if (items.length > 0) {
        finalKnownAlgorithms = JSON.stringify(items);
      }
    }

    // Whitelist and map only supported Prisma Asset model fields
    const updatePayload: Record<string, any> = {};
    if (validatedData.name !== undefined) updatePayload.name = validatedData.name;
    if (validatedData.identifier !== undefined) updatePayload.identifier = validatedData.identifier;
    if (validatedData.assetType !== undefined) updatePayload.assetType = validatedData.assetType;
    if (validatedData.dataSensitivity !== undefined) updatePayload.dataSensitivity = validatedData.dataSensitivity;
    if (finalKnownAlgorithms !== undefined) updatePayload.knownAlgorithms = finalKnownAlgorithms;
    updatePayload.informationSource = finalInfoSource;
    if (validatedData.tlsVersion !== undefined) updatePayload.tlsVersion = validatedData.tlsVersion;
    if (validatedData.port !== undefined) updatePayload.port = validatedData.port;
    if (validatedData.environment !== undefined) updatePayload.environment = validatedData.environment;
    if (validatedData.notes !== undefined) updatePayload.notes = validatedData.notes;

    // Compute field-by-field diff for edit history audit
    const changedFields: Record<string, { before: any; after: any }> = {};
    for (const [key, val] of Object.entries(updatePayload)) {
      if ((asset as any)[key] !== val && val !== undefined) {
        changedFields[key] = { before: (asset as any)[key], after: val };
      }
    }

    const updated = await prisma.asset.update({
      where: { id },
      data: updatePayload,
    });

    // Re-run assessment after manual update
    try {
      await runAssessmentForAsset(updated.id);
    } catch (assessErr) {
      console.warn('Re-assessment of updated manual asset:', assessErr);
    }

    // Safely record audit log with exact delta for change history tracking
    try {
      let validUserId: string | null = null;
      const reqUserId = (req as any).user?.id;
      if (reqUserId) {
        const userExists = await prisma.user.findUnique({
          where: { id: reqUserId },
          select: { id: true },
        });
        if (userExists) {
          validUserId = userExists.id;
        }
      }

      await prisma.auditLog.create({
        data: {
          userId: validUserId,
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
    } catch (auditErr: any) {
      console.warn('[updateAsset] Failed to write audit log:', auditErr?.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Asset updated successfully',
      data: updated,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const details = error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed: ' + error.errors.map((e) => e.message).join('; '),
        errors: error.errors,
        details,
      });
    }

    if (error?.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Asset not found',
      });
    }

    if (error?.name === 'PrismaClientValidationError') {
      console.error('[updateAsset] PrismaClientValidationError:', {
        name: error.name,
        message: error.message,
        assetId: req.params?.id,
        body: req.body,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid asset data provided for update',
      });
    }

    console.error('[updateAsset] Error updating asset:', {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      assetId: req.params?.id,
      body: req.body,
      stack: error?.stack,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to update asset',
    });
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

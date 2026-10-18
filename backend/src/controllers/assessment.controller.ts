import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { runAssessmentForAsset, runAllAssessments } from '../services/assessment.service';

export const runAssetAssessment = async (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const result = await runAssessmentForAsset(assetId);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'ASSESSMENT_RUN',
        entityType: 'Asset',
        entityId: assetId,
        details: JSON.stringify({
          riskScore: result.quantumRiskScore,
          status: result.overallReadinessStatus,
          findingsCount: result.findings.length,
        }),
      },
    });

    res.status(200).json({
      success: true,
      message: `Assessment completed for asset. Quantum Risk Score: ${result.quantumRiskScore}/100.`,
      data: result,
    });
  } catch (error: any) {
    console.error('Failed to run asset assessment:', error);
    res.status(500).json({ success: false, message: 'Assessment failed', error: error.message });
  }
};

export const runAllAssetAssessments = async (req: Request, res: Response) => {
  try {
    const result = await runAllAssessments();

    await prisma.auditLog.create({
      data: {
        action: 'BATCH_ASSESSMENT_RUN',
        entityType: 'Assessment',
        details: JSON.stringify({ totalAssessed: result.totalAssessed }),
      },
    });

    res.status(200).json({
      success: true,
      message: `Batch assessment successfully executed across ${result.totalAssessed} assets.`,
      data: result,
    });
  } catch (error: any) {
    console.error('Failed to run batch assessments:', error);
    res.status(500).json({ success: false, message: 'Batch assessment failed', error: error.message });
  }
};

export const getAssessments = async (req: Request, res: Response) => {
  try {
    const assessments = await prisma.assessment.findMany({
      orderBy: { assessedAt: 'desc' },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            identifier: true,
            assetType: true,
            dataSensitivity: true,
            informationSource: true,
          },
        },
        findings: {
          select: {
            id: true,
            title: true,
            riskLevel: true,
            status: true,
            algorithmOrConfig: true,
            evidenceSource: true,
            evidenceId: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, data: assessments });
  } catch (error: any) {
    console.error('Failed to get assessments:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assessments', error: error.message });
  }
};

export const getAssessmentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        asset: true,
        findings: {
          include: {
            evidence: true,
            recommendations: true,
            remediationTasks: true,
          },
        },
      },
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    res.status(200).json({ success: true, data: assessment });
  } catch (error: any) {
    console.error('Failed to get assessment by ID:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assessment', error: error.message });
  }
};

export const getFindings = async (req: Request, res: Response) => {
  try {
    const { riskLevel, status, purpose, evidenceSource, search } = req.query;

    const where: any = {};
    if (riskLevel && riskLevel !== 'ALL') where.riskLevel = String(riskLevel);
    if (status && status !== 'ALL') where.status = String(status);
    if (purpose && purpose !== 'ALL') where.purpose = String(purpose);
    if (evidenceSource && evidenceSource !== 'ALL') where.evidenceSource = String(evidenceSource);

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search } },
        { algorithmOrConfig: { contains: search } },
        { riskReason: { contains: search } },
        { ruleId: { contains: search } },
        { asset: { name: { contains: search } } },
        { asset: { identifier: { contains: search } } },
      ];
    }

    const findings = await prisma.finding.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            identifier: true,
            assetType: true,
            dataSensitivity: true,
            informationSource: true,
          },
        },
        evidence: {
          select: {
            id: true,
            evidenceSource: true,
            evidenceType: true,
            observedProperty: true,
            observedValue: true,
            rawPayload: true,
            scannerVersion: true,
            verifiedAt: true,
            hashDigest: true,
            scanJob: {
              select: {
                id: true,
                targetHost: true,
                port: true,
                status: true,
                completedAt: true,
              },
            },
          },
        },
        recommendations: true,
        remediationTasks: true,
      },
    });

    res.status(200).json({ success: true, data: findings });
  } catch (error: any) {
    console.error('Failed to get findings:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve findings', error: error.message });
  }
};

const updateFindingSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_RISK']).optional(),
  owner: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  dueDate: z.string().optional(),
});

export const updateFinding = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateFindingSchema.parse(req.body);

    const finding = await prisma.finding.findUnique({ where: { id } });
    if (!finding) {
      return res.status(404).json({ success: false, message: 'Finding not found' });
    }

    const updated = await prisma.finding.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        asset: true,
        recommendations: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'FINDING_STATUS_UPDATED',
        entityType: 'Finding',
        entityId: id,
        details: JSON.stringify({ oldStatus: finding.status, newStatus: updated.status }),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Finding updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('Failed to update finding:', error);
    res.status(500).json({ success: false, message: 'Failed to update finding', error: error.message });
  }
};

export const getRecommendations = async (req: Request, res: Response) => {
  try {
    const recommendations = await prisma.recommendation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        finding: {
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                identifier: true,
                assetType: true,
                dataSensitivity: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({ success: true, data: recommendations });
  } catch (error: any) {
    console.error('Failed to get recommendations:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve recommendations', error: error.message });
  }
};

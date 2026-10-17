import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const totalAssets = await prisma.asset.count();
    const assessedAssets = await prisma.asset.count({
      where: {
        assessmentStatus: {
          in: ['ASSESSED', 'HIGH_RISK', 'LOW_RISK', 'POST_QUANTUM_READY', 'HYBRID_READY'],
        },
      },
    });

    const highRiskAssets = await prisma.asset.count({
      where: {
        OR: [
          { assessmentStatus: 'HIGH_RISK' },
          {
            findings: {
              some: {
                riskLevel: { in: ['CRITICAL', 'HIGH'] },
                status: { in: ['OPEN', 'IN_PROGRESS'] },
              },
            },
          },
        ],
      },
    });

    const pendingAssessments = await prisma.asset.count({
      where: { assessmentStatus: 'PENDING' },
    });

    const assessmentProgress =
      totalAssets > 0 ? Math.round((assessedAssets / totalAssets) * 100) : 0;

    // Risk distribution across all active findings
    const [critical, high, medium, low] = await Promise.all([
      prisma.finding.count({ where: { riskLevel: 'CRITICAL', status: { not: 'RESOLVED' } } }),
      prisma.finding.count({ where: { riskLevel: 'HIGH', status: { not: 'RESOLVED' } } }),
      prisma.finding.count({ where: { riskLevel: 'MEDIUM', status: { not: 'RESOLVED' } } }),
      prisma.finding.count({ where: { riskLevel: 'LOW', status: { not: 'RESOLVED' } } }),
    ]);

    // Recent scans
    const recentScansRaw = await prisma.scanJob.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        results: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const recentScans = recentScansRaw.map((scan) => {
      const res = scan.results[0];
      return {
        id: scan.id,
        targetHost: scan.targetHost,
        port: scan.port,
        status: scan.status,
        tlsVersionNegotiated: res?.tlsVersionNegotiated || undefined,
        certPubKeyAlgo: res?.certPubKeyAlgo || undefined,
        certKeySize: res?.certKeySize || undefined,
        completedAt: scan.completedAt?.toISOString(),
        createdAt: scan.createdAt.toISOString(),
      };
    });

    // Top urgent recommendations
    const urgentRecommendations = await prisma.recommendation.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        finding: {
          include: {
            asset: {
              select: {
                name: true,
                identifier: true,
                assetType: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        totalAssets,
        assessedAssets,
        highRiskAssets,
        pendingAssessments,
        assessmentProgress,
        riskDistribution: {
          critical,
          high,
          medium,
          low,
        },
        recentScans,
        urgentRecommendations,
      },
    });
  } catch (error: any) {
    console.error('Failed to get dashboard statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics',
      error: error.message,
    });
  }
};

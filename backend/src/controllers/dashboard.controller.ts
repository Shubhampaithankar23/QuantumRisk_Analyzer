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

    // Source separation (Live scan vs Manual entry vs File Import)
    const [liveScannedAssets, manualAssets, importedAssets] = await Promise.all([
      prisma.asset.count({ where: { informationSource: 'TLS_SCAN' } }),
      prisma.asset.count({ where: { informationSource: 'MANUAL' } }),
      prisma.asset.count({
        where: { informationSource: { in: ['IMPORT_CSV', 'IMPORT_XLSX', 'IMPORT_JSON'] } },
      }),
    ]);

    // Evidence breakdown by verification provenance
    const [scannerVerifiedEvidence, userReportedEvidence, importedEvidence, inferredEvidence] =
      await Promise.all([
        prisma.evidence.count({ where: { evidenceSource: 'scanner_verified' } }),
        prisma.evidence.count({ where: { evidenceSource: 'user_reported' } }),
        prisma.evidence.count({ where: { evidenceSource: 'imported' } }),
        prisma.evidence.count({ where: { evidenceSource: 'inferred' } }),
      ]);

    // Remediation Tracking stats
    const [remOpen, remInProgress, remResolved, remAcceptedRisk] = await Promise.all([
      prisma.finding.count({ where: { status: 'OPEN' } }),
      prisma.finding.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.finding.count({ where: { status: 'RESOLVED' } }),
      prisma.finding.count({ where: { status: 'ACCEPTED_RISK' } }),
    ]);
    const remTotal = remOpen + remInProgress + remResolved + remAcceptedRisk;
    const remProgressPct =
      remTotal > 0 ? Math.round(((remResolved + remAcceptedRisk) / remTotal) * 100) : 0;

    // Scan jobs status overview
    const [scanTotal, scanQueued, scanRunning, scanCompleted, scanFailed] = await Promise.all([
      prisma.scanJob.count(),
      prisma.scanJob.count({ where: { status: 'QUEUED' } }),
      prisma.scanJob.count({ where: { status: 'RUNNING' } }),
      prisma.scanJob.count({ where: { status: 'COMPLETED' } }),
      prisma.scanJob.count({ where: { status: 'FAILED' } }),
    ]);

    // Inconclusive / Insufficient Evidence assessments
    const inconclusiveCount = await prisma.assessment.count({
      where: {
        overallReadinessStatus: { in: ['INSUFFICIENT_EVIDENCE', 'NOT_ASSESSED'] },
      },
    });

    // Assets with missing information (no evidence recorded or missing crypto telemetry)
    const assetsWithMissingTelemetry = await prisma.asset.findMany({
      where: {
        OR: [
          { evidence: { none: {} } },
          { assessmentStatus: 'NOT_ASSESSED' },
          { tlsVersion: null, knownAlgorithms: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        identifier: true,
        assetType: true,
        informationSource: true,
        assessmentStatus: true,
        tlsVersion: true,
      },
    });

    const totalMissingInfoCount = await prisma.asset.count({
      where: {
        OR: [
          { evidence: { none: {} } },
          { assessmentStatus: 'NOT_ASSESSED' },
          { tlsVersion: null, knownAlgorithms: null },
        ],
      },
    });

    // Recent scans with results & check counts
    const recentScansRaw = await prisma.scanJob.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        results: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            checks: true,
            evidence: true,
          },
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
        checksCount: scan._count.checks,
        evidenceCount: scan._count.evidence,
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
        sourceDistribution: {
          liveScanned: liveScannedAssets,
          manual: manualAssets,
          imported: importedAssets,
        },
        evidenceStats: {
          scannerVerified: scannerVerifiedEvidence,
          userReported: userReportedEvidence,
          imported: importedEvidence,
          inferred: inferredEvidence,
        },
        remediationStats: {
          open: remOpen,
          inProgress: remInProgress,
          resolved: remResolved,
          acceptedRisk: remAcceptedRisk,
          total: remTotal,
          progressPct: remProgressPct,
        },
        scanStats: {
          total: scanTotal,
          queued: scanQueued,
          running: scanRunning,
          completed: scanCompleted,
          failed: scanFailed,
        },
        missingInfo: {
          count: totalMissingInfoCount,
          assets: assetsWithMissingTelemetry,
        },
        inconclusiveCount,
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

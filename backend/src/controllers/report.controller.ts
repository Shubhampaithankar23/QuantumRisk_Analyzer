import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generatePdfReport } from '../services/report.service';

export const getReportSummary = async (req: Request, res: Response) => {
  try {
    const institution = await prisma.institution.findFirst();

    const [totalAssets, assessedAssets, highRiskAssets, allFindings] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.count({
        where: { assessmentStatus: { in: ['ASSESSED', 'HIGH_RISK', 'LOW_RISK'] } },
      }),
      prisma.asset.count({ where: { assessmentStatus: 'HIGH_RISK' } }),
      prisma.finding.findMany({
        include: {
          asset: true,
          recommendations: true,
        },
      }),
    ]);

    const criticalCount = allFindings.filter((f) => f.riskLevel === 'CRITICAL').length;
    const highCount = allFindings.filter((f) => f.riskLevel === 'HIGH').length;
    const mediumCount = allFindings.filter((f) => f.riskLevel === 'MEDIUM').length;
    const lowCount = allFindings.filter((f) => f.riskLevel === 'LOW').length;

    res.status(200).json({
      success: true,
      data: {
        institution: institution || { name: 'Institutional Cryptographic Inventory' },
        generatedAt: new Date().toISOString(),
        ruleVersion: '2024.1-NIST-FIPS',
        standards: ['NIST FIPS 203', 'NIST FIPS 204', 'NIST FIPS 205', 'NSA CNSA 2.0'],
        metrics: {
          totalAssets,
          assessedAssets,
          highRiskAssets,
          readinessCoveragePct: totalAssets > 0 ? Math.round((assessedAssets / totalAssets) * 100) : 0,
          findings: {
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
            low: lowCount,
            total: allFindings.length,
          },
        },
        limitations:
          'Evaluations of web and TLS endpoints reflect externally observable protocol handshakes. Internal databases, cryptographic keys embedded in source code, and unexposed servers require internal source code and configuration audit.',
      },
    });
  } catch (error: any) {
    console.error('Failed to get report summary:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report summary', error: error.message });
  }
};

export const exportPdfReport = async (req: Request, res: Response) => {
  try {
    const pdfBuffer = await generatePdfReport();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="pq-readiness-assessment-report.pdf"'
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Failed to generate PDF report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF export', error: error.message });
  }
};

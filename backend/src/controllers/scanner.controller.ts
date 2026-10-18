import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { executeTlsScan, validateScanTarget } from '../services/scanner.service';

const scanRequestSchema = z.object({
  targetHost: z.string().min(3, 'Target hostname is required'),
  port: z.number().int().min(1).max(65535).default(443),
  confirmAuthorized: z.boolean().refine((val) => val === true, {
    message: 'Explicit authorization is mandatory before initiating a cryptographic scan.',
  }),
  assetId: z.string().optional(),
});

export const startScan = async (req: Request, res: Response) => {
  const startTime = Date.now();
  let scanJobId: string | undefined;

  try {
    const { targetHost, port, confirmAuthorized, assetId } = scanRequestSchema.parse(req.body);

    // Initial pre-validation of target & SSRF guard
    const resolvedIp = await validateScanTarget(targetHost, port);

    // Create ScanJob
    const scanJob = await prisma.scanJob.create({
      data: {
        targetHost,
        port,
        status: 'RUNNING',
        scanType: 'TLS_INSPECTION',
        authorizationConfirmed: confirmAuthorized,
        authorizedBy: req.user?.email || 'Authorized Security Administrator',
        ipAddress: resolvedIp,
        startedAt: new Date(),
        assetId: assetId || null,
      },
    });
    // Record explicit authorization consent in AuditLog
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        institutionId: req.user?.institutionId || null,
        action: 'SCAN_AUTHORIZATION_CONSENT',
        entityType: 'ScanJob',
        entityId: scanJob.id,
        details: JSON.stringify({
          targetHost,
          port,
          resolvedIp,
          authorizationConfirmed: confirmAuthorized,
          authorizedBy: req.user?.email || 'Authorized Security Administrator',
          timestamp: new Date().toISOString(),
        }),
        ipAddress: req.ip || resolvedIp,
      },
    });

    // Execute scan with IP pinning and populate ScanCheck / Evidence
    const scanOutput = await executeTlsScan(targetHost, port, scanJob.id);
    const executionTimeMs = Date.now() - startTime;

    // Save ScanResult
    const scanResult = await prisma.scanResult.create({
      data: {
        scanJobId: scanJob.id,
        targetHost: scanOutput.targetHost,
        port: scanOutput.port,
        tlsVersionNegotiated: scanOutput.tlsVersionNegotiated || null,
        supportedTlsVersions: JSON.stringify(scanOutput.supportedTlsVersions),
        cipherSuiteNegotiated: scanOutput.cipherSuiteNegotiated || null,
        certSubject: scanOutput.certSubject || null,
        certIssuer: scanOutput.certIssuer || null,
        certValidFrom: scanOutput.certValidFrom || null,
        certValidTo: scanOutput.certValidTo || null,
        certPubKeyAlgo: scanOutput.certPubKeyAlgo || null,
        certKeySize: scanOutput.certKeySize || null,
        certSignatureAlgo: scanOutput.certSignatureAlgo || null,
        certSerial: scanOutput.certSerial || null,
        keyExchangeGroup: scanOutput.keyExchangeGroup || null,
        isPqHybrid: scanOutput.isPqHybrid,
        ocspStapled: scanOutput.ocspStapled,
        scannerVersion: scanOutput.scannerVersion,
        rawDetails: JSON.stringify(scanOutput.rawDetails),
      },
    });

    // Update ScanJob to COMPLETED
    await prisma.scanJob.update({
      where: { id: scanJob.id },
      data: {
        status: 'COMPLETED',
        executionTimeMs,
        completedAt: new Date(),
      },
    });

    // Update or link asset if one exists, or create a verified asset record
    let linkedAssetId = assetId;
    if (!linkedAssetId) {
      const existingAsset = await prisma.asset.findFirst({
        where: { identifier: targetHost },
      });
      if (existingAsset) {
        linkedAssetId = existingAsset.id;
        await prisma.asset.update({
          where: { id: existingAsset.id },
          data: {
            tlsVersion: scanOutput.tlsVersionNegotiated || existingAsset.tlsVersion,
            informationSource: 'TLS_SCAN',
            knownAlgorithms: JSON.stringify([
              { algorithm: scanOutput.certPubKeyAlgo || 'Unknown', purpose: 'DIGITAL_SIGNATURE' },
              { algorithm: scanOutput.keyExchangeGroup || 'Unknown', purpose: 'KEY_ESTABLISHMENT' },
              { algorithm: scanOutput.cipherSuiteNegotiated || 'Unknown', purpose: 'SYMMETRIC_ENCRYPTION' },
            ]),
          },
        });
      } else {
        const institution = await prisma.institution.findFirst();
        if (institution) {
          const newAsset = await prisma.asset.create({
            data: {
              name: `Web Endpoint (${targetHost})`,
              identifier: targetHost,
              assetType: 'WEBSITE',
              institutionId: institution.id,
              dataSensitivity: 'CONFIDENTIAL',
              tlsVersion: scanOutput.tlsVersionNegotiated || 'Unknown',
              port: scanOutput.port,
              informationSource: 'TLS_SCAN',
              assessmentStatus: 'PENDING',
              knownAlgorithms: JSON.stringify([
                { algorithm: scanOutput.certPubKeyAlgo || 'Unknown', purpose: 'DIGITAL_SIGNATURE' },
                { algorithm: scanOutput.keyExchangeGroup || 'Unknown', purpose: 'KEY_ESTABLISHMENT' },
                { algorithm: scanOutput.cipherSuiteNegotiated || 'Unknown', purpose: 'SYMMETRIC_ENCRYPTION' },
              ]),
              notes: `Discovered and verified via authorized live TLS inspection on ${new Date().toISOString()}`,
            },
          });
          linkedAssetId = newAsset.id;
          await prisma.scanJob.update({
            where: { id: scanJob.id },
            data: { assetId: newAsset.id },
          });
        }
      }
    }

    // Record audit log
    await prisma.auditLog.create({
      data: {
        action: 'TLS_SCAN_COMPLETED',
        entityType: 'ScanJob',
        entityId: scanJob.id,
        details: JSON.stringify({
          targetHost,
          port,
          tlsVersion: scanOutput.tlsVersionNegotiated,
          pubKeyAlgo: scanOutput.certPubKeyAlgo,
          executionTimeMs,
        }),
      },
    });

    res.status(200).json({
      success: true,
      message: `TLS Inspection completed successfully for "${targetHost}" in ${executionTimeMs}ms.`,
      data: {
        scanJobId: scanJob.id,
        targetHost,
        port,
        status: 'COMPLETED',
        executionTimeMs,
        result: scanOutput,
        linkedAssetId,
      },
    });
  } catch (error: any) {
    console.error('Scan execution failed:', error);

    if (scanJobId) {
      await prisma.scanJob.update({
        where: { id: scanJobId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Scan execution failed',
    });
  }
};

export const getScans = async (req: Request, res: Response) => {
  try {
    const scans = await prisma.scanJob.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        results: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        checks: true,
        evidence: true,
        asset: {
          select: { id: true, name: true, identifier: true, assetType: true },
        },
      },
    });

    res.status(200).json({ success: true, data: scans });
  } catch (error: any) {
    console.error('Failed to get scan list:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve scans', error: error.message });
  }
};

export const getScanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scan = await prisma.scanJob.findUnique({
      where: { id },
      include: {
        results: true,
        checks: true,
        evidence: true,
        asset: true,
      },
    });

    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan job not found' });
    }

    res.status(200).json({ success: true, data: scan });
  } catch (error: any) {
    console.error('Failed to get scan by id:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve scan', error: error.message });
  }
};

export const deleteScan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const scan = await prisma.scanJob.findUnique({ where: { id } });
    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan record not found' });
    }

    await prisma.scanJob.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: 'SCAN_DELETED',
        entityType: 'ScanJob',
        entityId: id,
        details: JSON.stringify({ targetHost: scan.targetHost }),
      },
    });

    res.status(200).json({
      success: true,
      message: `Scan record for "${scan.targetHost}" deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Failed to delete scan:', error);
    res.status(500).json({ success: false, message: 'Failed to delete scan record', error: error.message });
  }
};

export const clearAllScans = async (req: Request, res: Response) => {
  try {
    const result = await prisma.scanJob.deleteMany({});
    res.status(200).json({
      success: true,
      message: `Cleared ${result.count} scan record(s).`,
    });
  } catch (error: any) {
    console.error('Failed to clear scans:', error);
    res.status(500).json({ success: false, message: 'Failed to clear scan records', error: error.message });
  }
};


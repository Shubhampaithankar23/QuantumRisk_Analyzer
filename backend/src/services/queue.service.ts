import prisma from '../lib/prisma';
import { executeTlsScan, validateScanTarget } from './scanner.service';

export interface EnqueueScanInput {
  targetHost: string;
  port?: number;
  authorizationConfirmed: boolean;
  authorizedBy: string;
  userId?: string;
  assetId?: string;
  institutionId?: string;
}

let isWorkerActive = false;
let workerInterval: NodeJS.Timeout | null = null;

export async function enqueueScanJob(input: EnqueueScanInput) {
  const port = input.port || 443;
  const cleanHost = input.targetHost.trim().toLowerCase();

  // Validate target & SSRF guard upfront before queuing
  const resolvedIp = await validateScanTarget(cleanHost, port);

  // Create Queued ScanJob in DB
  const scanJob = await prisma.scanJob.create({
    data: {
      targetHost: cleanHost,
      port,
      status: 'QUEUED',
      scanType: 'TLS_INSPECTION',
      authorizationConfirmed: input.authorizationConfirmed,
      authorizedBy: input.authorizedBy,
      ipAddress: resolvedIp,
      userId: input.userId || null,
      assetId: input.assetId || null,
      institutionId: input.institutionId || null,
    },
  });

  // Record audit log for consent and initiation
  await prisma.auditLog.create({
    data: {
      userId: input.userId || null,
      institutionId: input.institutionId || null,
      action: 'SCAN_JOB_QUEUED',
      entityType: 'ScanJob',
      entityId: scanJob.id,
      details: JSON.stringify({
        targetHost: cleanHost,
        port,
        resolvedIp,
        authorizationConfirmed: input.authorizationConfirmed,
        authorizedBy: input.authorizedBy,
      }),
      ipAddress: resolvedIp,
    },
  });

  // Trigger processing immediately in next tick
  setImmediate(() => {
    processNextScanJob().catch((err) => console.error('[Queue Worker] Error processing job:', err));
  });

  return scanJob;
}

export async function processNextScanJob(): Promise<boolean> {
  // Find oldest queued job
  const nextJob = await prisma.scanJob.findFirst({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
  });

  if (!nextJob) {
    return false; // No work pending
  }

  const startTime = Date.now();

  // Transition to RUNNING
  const activeJob = await prisma.scanJob.update({
    where: { id: nextJob.id },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  try {
    // Execute real TLS scan
    const scanOutput = await executeTlsScan(activeJob.targetHost, activeJob.port, activeJob.id);
    const executionTimeMs = Date.now() - startTime;

    // Save legacy ScanResult for full backward compatibility
    await prisma.scanResult.create({
      data: {
        scanJobId: activeJob.id,
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

    // Mark job as COMPLETED
    await prisma.scanJob.update({
      where: { id: activeJob.id },
      data: {
        status: 'COMPLETED',
        executionTimeMs,
        completedAt: new Date(),
      },
    });

    // Link or create verified asset record
    let linkedAssetId = activeJob.assetId;
    if (!linkedAssetId) {
      const existingAsset = await prisma.asset.findFirst({
        where: { identifier: activeJob.targetHost },
      });
      if (existingAsset) {
        linkedAssetId = existingAsset.id;
        await prisma.asset.update({
          where: { id: existingAsset.id },
          data: {
            tlsVersion: scanOutput.tlsVersionNegotiated || existingAsset.tlsVersion,
            informationSource: 'TLS_SCAN',
          },
        });
      }
    }

    return true;
  } catch (scanErr: any) {
    const executionTimeMs = Date.now() - startTime;
    await prisma.scanJob.update({
      where: { id: activeJob.id },
      data: {
        status: 'FAILED',
        errorMessage: scanErr?.message || 'Scan execution encountered an unhandled error',
        executionTimeMs,
        completedAt: new Date(),
      },
    });
    return true;
  }
}

export function startScanQueueWorker(intervalMs = 3000) {
  if (isWorkerActive) return;
  isWorkerActive = true;

  workerInterval = setInterval(async () => {
    try {
      await processNextScanJob();
    } catch (err) {
      console.error('[Scan Queue Worker Loop Error]:', err);
    }
  }, intervalMs);

  console.log(`[Scan Queue Worker] Initialized SQLite DB-backed queue worker (interval: ${intervalMs}ms)`);
}

export function stopScanQueueWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  isWorkerActive = false;
}

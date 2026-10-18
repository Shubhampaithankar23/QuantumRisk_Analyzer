import prisma from '../src/lib/prisma';
import { enqueueScanJob, processNextScanJob } from '../src/services/queue.service';
import { runAssessmentForAsset } from '../src/services/assessment.service';

async function main() {
  console.log('=== QuantumRisk Analyzer — Phase 6 E2E Real Scan Verification ===');

  const institution = await prisma.institution.findFirst();
  if (!institution) {
    throw new Error('No institution found in database.');
  }

  const user = await prisma.user.findFirst();

  // 1. Create or find Asset for example.com
  let asset = await prisma.asset.findFirst({
    where: { identifier: 'example.com' },
  });

  if (!asset) {
    asset = await prisma.asset.create({
      data: {
        name: 'Example Public Documentation Portal',
        identifier: 'example.com',
        assetType: 'WEBSITE',
        institutionId: institution.id,
        dataSensitivity: 'PUBLIC',
        informationSource: 'TLS_SCAN',
        assessmentStatus: 'PENDING',
        port: 443,
      },
    });
    console.log(`[Asset] Created asset '${asset.name}' (ID: ${asset.id})`);
  } else {
    console.log(`[Asset] Found existing asset '${asset.name}' (ID: ${asset.id})`);
  }

  // 2. Queue live scan job with explicit authorization confirmation
  const scanJob = await enqueueScanJob({
    targetHost: 'example.com',
    port: 443,
    authorizationConfirmed: true,
    authorizedBy: user?.email || 'admin@apex.edu',
    userId: user?.id,
    assetId: asset.id,
    institutionId: institution.id,
  });

  console.log(`[ScanJob Queued] ID: ${scanJob.id}, Host: ${scanJob.targetHost}:${scanJob.port}, Status: ${scanJob.status}`);

  // 3. Process the queued scan job with the real DB queue worker
  console.log('[Worker] Processing queued scan job with Python SSLyze scanner...');
  const success = await processNextScanJob();

  if (!success) {
    throw new Error('Worker found no queued job to process.');
  }

  const processedJob = await prisma.scanJob.findUnique({
    where: { id: scanJob.id },
  });

  if (!processedJob) {
    throw new Error('Could not find processed scan job.');
  }

  console.log(`[Worker Completed] ScanJob ${processedJob.id} finished with status: ${processedJob.status}`);

  // 4. Retrieve ScanCheck and Evidence records
  const scanChecks = await prisma.scanCheck.findMany({
    where: { scanJobId: processedJob.id },
  });
  console.log(`[ScanChecks Recorded] Count: ${scanChecks.length}`);
  scanChecks.forEach((c) => {
    console.log(`  - Check: ${c.checkType} | Status: ${c.status} | Library: ${c.scannerEngine}`);
    if (c.limitations) console.log(`    Limitations: ${c.limitations}`);
  });

  const evidences = await prisma.evidence.findMany({
    where: { scanJobId: processedJob.id },
  });
  console.log(`[Evidence Hashes Recorded] Count: ${evidences.length}`);
  evidences.forEach((e) => {
    console.log(`  - Property: ${e.observedProperty} = "${e.observedValue}" | SHA-256: ${e.hashDigest}`);
  });

  // 5. Run deterministic assessment engine on the scanned asset
  console.log(`\n[Assessment Engine] Evaluating asset '${asset.id}' against NIST FIPS standards...`);
  const assessmentResult = await runAssessmentForAsset(asset.id);

  console.log(`[Assessment Result] Overall Status: ${assessmentResult.overallReadinessStatus}`);
  console.log(`[Assessment Result] Quantum Risk Score: ${assessmentResult.quantumRiskScore} / 100`);
  console.log(`[Assessment Result] Summary: ${assessmentResult.summary}`);
  console.log(`[Assessment Result] Score Breakdown:`, assessmentResult.scoreBreakdown);

  console.log(`\n[Findings Generated] Count: ${assessmentResult.findings.length}`);
  assessmentResult.findings.forEach((f: any, idx: number) => {
    console.log(`  ${idx + 1}. [${f.riskLevel}] ${f.title}`);
    console.log(`     - Algorithm: ${f.algorithmOrConfig}`);
    console.log(`     - Purpose: ${f.purpose}`);
    console.log(`     - Rule: ${f.ruleId} (${f.standardRef})`);
    console.log(`     - Evidence ID: ${f.evidenceId} (Provenance: ${f.evidenceSource})`);
    if (f.recommendations && f.recommendations.length > 0) {
      console.log(`     - Recommended Upgrade: ${f.recommendations[0].recommendedAlgorithm} (${f.recommendations[0].standardRef})`);
    }
  });

  // 6. Verify AuditLog entries
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityId: processedJob.id },
        { entityId: asset.id },
      ],
    },
    orderBy: { timestamp: 'desc' },
    take: 5,
  });
  console.log(`\n[Audit Trail Entries] Count: ${auditLogs.length}`);
  auditLogs.forEach((l) => {
    console.log(`  - Action: ${l.action} | Entity: ${l.entityType} (${l.entityId}) | Time: ${l.timestamp.toISOString()}`);
  });

  console.log('\n=== E2E Real Scan Verification Finished Successfully ===');
}

main()
  .catch((err) => {
    console.error('E2E Verification Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

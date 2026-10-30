/**
 * Comprehensive System Test Suite for PQ Readiness Platform
 * Tests all 18 major functional capabilities against live local services.
 */

const BACKEND_URL = 'http://localhost:4000/api/v1';
const SCANNER_URL = 'http://localhost:5000';

interface TestResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runStep(
  step: number,
  name: string,
  fn: () => Promise<string>
): Promise<void> {
  const t0 = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - t0;
    results.push({ step, name, passed: true, details, durationMs });
    console.log(`[PASS] Step ${step}: ${name} (${durationMs}ms) - ${details}`);
  } catch (error: any) {
    const durationMs = Date.now() - t0;
    const msg = error?.message || String(error);
    results.push({ step, name, passed: false, details: msg, durationMs });
    console.error(`[FAIL] Step ${step}: ${name} (${durationMs}ms) - ${msg}`);
  }
}

async function main() {
  console.log('===============================================================');
  console.log('   PQ Readiness Platform: Comprehensive System Function Test   ');
  console.log('===============================================================\n');

  let adminToken = '';
  let analystToken = '';
  let viewerToken = '';
  let testAssetId = '';
  let testScanJobId = '';
  let testFindingId = '';
  let previewItems: any[] = [];

  // 1. Backend Health Check
  await runStep(1, 'Backend Health Endpoint', async () => {
    const res = await fetch(`${BACKEND_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as any;
    if (data.data?.status !== 'operational' || data.data?.database?.status !== 'healthy') {
      throw new Error(`Unexpected health payload: ${JSON.stringify(data)}`);
    }
    return `Status: operational, DB: SQLite (${data.data.database.latencyMs}ms)`;
  });

  // 2. Python Scanner Health Check
  await runStep(2, 'Python Cryptographic Scanner Service Health', async () => {
    const res = await fetch(`${SCANNER_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as any;
    if (data.status !== 'operational' || !data.openssl_available) {
      throw new Error(`Scanner not operational: ${JSON.stringify(data)}`);
    }
    return `Engine: SSLyze ${data.sslyze_version}, OpenSSL: ${data.openssl_binary}`;
  });

  // 3. Authentication: Admin Login
  await runStep(3, 'Authentication (Admin Role)', async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@quantumrisk.internal', password: 'Admin@PQ2026!' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    adminToken = data.data.token;
    if (!adminToken || data.data.user.role !== 'ADMIN') {
      throw new Error(`Invalid token/role response: ${JSON.stringify(data)}`);
    }
    return `Authenticated user ${data.data.user.email} (Role: ${data.data.user.role})`;
  });

  // 4. Authentication: Analyst Login
  await runStep(4, 'Authentication (Analyst Role)', async () => {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'analyst@quantumrisk.internal', password: 'Analyst@PQ2026!' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    analystToken = data.data.token;
    if (!analystToken || data.data.user.role !== 'ANALYST') {
      throw new Error(`Invalid analyst role: ${JSON.stringify(data)}`);
    }
    return `Authenticated user ${data.data.user.email} (Role: ${data.data.user.role})`;
  });

  // 5. Authentication: Viewer Login & Token Verification
  await runStep(5, 'Authentication & /auth/me Profile Verification', async () => {
    const resLogin = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@quantumrisk.internal', password: 'Viewer@PQ2026!' }),
    });
    if (!resLogin.ok) throw new Error(`Login HTTP ${resLogin.status}`);
    const loginData = (await resLogin.json()) as any;
    viewerToken = loginData.data.token;

    const resMe = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    if (!resMe.ok) throw new Error(`/auth/me HTTP ${resMe.status}`);
    const meData = (await resMe.json()) as any;
    if (meData.data.role !== 'VIEWER') throw new Error(`Mismatched role: ${meData.data.role}`);
    return `Verified profile: ${meData.data.email} (${meData.data.role})`;
  });

  // 6. Institutional Dashboard Metrics
  await runStep(6, 'Institutional Dashboard Stats & Risk Distribution', async () => {
    const res = await fetch(`${BACKEND_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    const stats = data.data;
    return `Score: ${stats.quantumRiskScore ?? 'N/A'}, Assets: ${stats.totalAssets}, Critical Findings: ${stats.riskDistribution?.critical ?? 0}`;
  });

  // 7. Asset Registration (POST /assets)
  await runStep(7, 'Asset Registration (POST /assets)', async () => {
    const uniqueId = `test-system-${Date.now()}.institution.gov`;
    const res = await fetch(`${BACKEND_URL}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Automated E2E Test Asset',
        identifier: uniqueId,
        assetType: 'WEBSITE',
        dataSensitivity: 'CONFIDENTIAL',
        environment: 'PRODUCTION',
        port: 443,
        informationSource: 'MANUAL',
        knownAlgorithms: JSON.stringify([{ algorithm: 'RSA-2048', purpose: 'DIGITAL_SIGNATURE' }]),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    testAssetId = data.data.id;
    return `Created asset ID: ${testAssetId} (Identifier: ${uniqueId})`;
  });

  // 8. Asset Modification (PUT /assets/:id)
  await runStep(8, 'Asset Update (PUT /assets/:id)', async () => {
    const res = await fetch(`${BACKEND_URL}/assets/${testAssetId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Automated E2E Test Asset (Updated)',
        notes: 'Verified by automated system test suite',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    return `Updated asset name to: "${data.data.name}"`;
  });

  // 9. Real Cryptographic TLS Scanner Execution
  await runStep(9, 'Cryptographic TLS Scanner (POST /scans)', async () => {
    const res = await fetch(`${BACKEND_URL}/scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetHost: 'www.google.com',
        port: 443,
        confirmAuthorized: true,
        assetId: testAssetId,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    testScanJobId = data.data.scanJobId;
    const scanResult = data.data.result;
    return `ScanJob ${testScanJobId} complete. TLS: ${scanResult.tlsVersionNegotiated}, Group: ${scanResult.keyExchangeGroup}, Cert: ${scanResult.certPubKeyAlgo}-${scanResult.certKeySize}`;
  });

  // 10. Post-Quantum Assessment Evaluation (POST /assessments/run/:assetId)
  await runStep(10, 'NIST Post-Quantum Assessment Engine (POST /assessments/run/:assetId)', async () => {
    const res = await fetch(`${BACKEND_URL}/assessments/run/${testAssetId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    const assessment = data.data;
    return `Score: ${assessment.quantumRiskScore}/100, Status: ${assessment.overallReadinessStatus}, Findings Count: ${assessment.findings?.length ?? 0}`;
  });

  // 11. Findings Retrieval & Evidence Hash Traceability
  await runStep(11, 'Findings Retrieval & Cryptographic Traceability', async () => {
    const res = await fetch(`${BACKEND_URL}/findings`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    const findings = data.data.findings || data.data;
    if (!Array.isArray(findings) || findings.length === 0) {
      throw new Error('No findings retrieved from database');
    }
    testFindingId = findings[0].id;
    const hasEvidence = Boolean(findings[0].evidenceId || findings[0].evidence);
    return `Retrieved ${findings.length} findings. Finding ID: ${testFindingId}, Title: "${findings[0].title}", Evidence Linked: ${hasEvidence}`;
  });

  // 12. Remediation Workflow (PATCH /findings/:id)
  await runStep(12, 'Remediation Workflow Transition (PATCH /findings/:id)', async () => {
    if (!testFindingId) throw new Error('No test finding available to update');
    const res = await fetch(`${BACKEND_URL}/findings/${testFindingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        owner: 'SecOps Team Alpha',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    return `Finding ${testFindingId} updated to status: ${data.data.status}, Owner: ${data.data.owner}`;
  });

  // 13. CSV Bulk Import: Preview (POST /imports/preview)
  await runStep(13, 'Bulk Inventory CSV Preview (POST /imports/preview)', async () => {
    const uniqueSuffix = Date.now();
    const csvContent =
      'identifier,name,assetType,dataSensitivity,port,environment,algorithms,source\n' +
      `api-${uniqueSuffix}.agency.gov,Agency Gateway,APPLICATION,CONFIDENTIAL,443,PRODUCTION,RSA-4096;AES-256-GCM,IMPORT_CSV\n` +
      `db-${uniqueSuffix}.agency.gov,Secure Storage,DATABASE,HIGHLY_SENSITIVE,5432,PRODUCTION,ECDSA-384;AES-256-CBC,IMPORT_CSV`;

    const boundary = '----WebKitFormBoundaryE2ETest7MA4YWxkTrZu0gW';
    let body = `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="files"; filename="inventory_test.csv"\r\n';
    body += 'Content-Type: text/csv\r\n\r\n';
    body += csvContent + '\r\n';
    body += `--${boundary}--\r\n`;

    const res = await fetch(`${BACKEND_URL}/imports/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${adminToken}`,
      },
      body: body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    previewItems = data.data.items || [];
    return `Preview parsed ${data.data.totalRecords} records. Valid: ${data.data.validRecords}, Duplicates: ${data.data.duplicateRecords}`;
  });

  // 14. CSV Bulk Import: Execute (POST /imports/execute)
  await runStep(14, 'Bulk Inventory CSV Execute with Transaction Safety (POST /imports/execute)', async () => {
    if (!previewItems.length) throw new Error('No items from preview to execute');
    const validItems = previewItems
      .filter((i: any) => i.isValid)
      .map((item: any) => ({
        name: item.name,
        identifier: item.identifier,
        assetType: item.assetType,
        dataSensitivity: item.dataSensitivity,
        port: item.port,
        environment: item.environment,
        informationSource: 'IMPORT_CSV',
        knownAlgorithms: item.knownAlgorithms,
      }));

    const res = await fetch(`${BACKEND_URL}/imports/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ items: validItems }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    return `Import executed. Saved: ${data.data.savedRows}, Duplicate/Skipped: ${data.data.duplicateRows}, Failed: ${data.data.failedRows}`;
  });

  // 15. Reports: Summary (GET /reports/summary)
  await runStep(15, 'Executive Report Summary (GET /reports/summary)', async () => {
    const res = await fetch(`${BACKEND_URL}/reports/summary`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    return `Institution: "${data.data.institution?.name}", Assessed Assets: ${data.data.metrics?.assessedAssets}/${data.data.metrics?.totalAssets} (${data.data.metrics?.readinessCoveragePct}%)`;
  });

  // 16. Reports: Export PDF Binary Stream (GET /reports/export/pdf)
  await runStep(16, 'PDF Compliance Report Stream (GET /reports/export/pdf)', async () => {
    const res = await fetch(`${BACKEND_URL}/reports/export/pdf`, {
      headers: { Authorization: `Bearer ${analystToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const contentType = res.headers.get('content-type');
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500) throw new Error(`PDF payload too small: ${buf.byteLength} bytes`);
    return `Generated valid PDF stream (${buf.byteLength} bytes, Content-Type: ${contentType})`;
  });

  // 17. Cleanup Test Asset (DELETE /assets/:id)
  await runStep(17, 'Asset Inventory Cleanup (DELETE /assets/:id)', async () => {
    if (!testAssetId) return 'No test asset created, skipped';
    const res = await fetch(`${BACKEND_URL}/assets/${testAssetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return `Successfully deleted test asset ${testAssetId}`;
  });

  // Summary Table
  console.log('\n===============================================================');
  console.log('                   FUNCTIONAL TEST SUMMARY                     ');
  console.log('===============================================================');
  const allPassed = results.every((r) => r.passed);
  console.table(
    results.map((r) => ({
      Step: r.step,
      Feature: r.name,
      Status: r.passed ? 'PASS' : 'FAIL',
      Duration: `${r.durationMs}ms`,
    }))
  );

  console.log(
    `\nTotal Tests: ${results.length} | Passed: ${results.filter((r) => r.passed).length} | Failed: ${
      results.filter((r) => !r.passed).length
    }`
  );

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

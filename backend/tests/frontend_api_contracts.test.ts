import request from 'supertest';
import app from '../src/index';
import prisma from '../src/lib/prisma';
import { generateToken } from '../src/middleware/auth';

describe('Phase 5: Frontend API Integration & Data Contracts', () => {
  let adminToken: string;
  let testAssetLive: any;
  let testAssetManual: any;
  let testScan: any;
  let testEvidence: any;
  let testFinding: any;

  beforeAll(async () => {
    const institution = await prisma.institution.findFirst();
    const instId = institution?.id || 'inst-default';

    adminToken = generateToken({
      id: 'test-admin-p5',
      name: 'Admin P5',
      email: 'admin-p5@apex.edu',
      role: 'ADMIN',
      institutionId: instId,
    });

    // 1. Create a Live Scanned asset
    testAssetLive = await prisma.asset.create({
      data: {
        name: 'Phase 5 Live Portal',
        identifier: 'live-portal-p5.internal',
        assetType: 'WEBSITE',
        institutionId: instId,
        dataSensitivity: 'HIGHLY_SENSITIVE',
        informationSource: 'TLS_SCAN',
        assessmentStatus: 'HIGH_RISK',
        tlsVersion: 'TLSv1.3',
      },
    });

    // 2. Create a Manual asset
    testAssetManual = await prisma.asset.create({
      data: {
        name: 'Phase 5 Manual Registry',
        identifier: 'manual-reg-p5.internal',
        assetType: 'DATABASE',
        institutionId: instId,
        dataSensitivity: 'CONFIDENTIAL',
        informationSource: 'MANUAL',
        assessmentStatus: 'PENDING',
      },
    });

    // 3. Create a ScanJob linked to the live asset
    testScan = await prisma.scanJob.create({
      data: {
        institutionId: instId,
        assetId: testAssetLive.id,
        targetHost: 'live-portal-p5.internal',
        port: 443,
        status: 'COMPLETED',
        authorizationConfirmed: true,
        authorizedBy: 'test-admin-p5',
      },
    });

    // 4. Create Evidence for live scan
    testEvidence = await prisma.evidence.create({
      data: {
        assetId: testAssetLive.id,
        scanJobId: testScan.id,
        evidenceSource: 'scanner_verified',
        evidenceType: 'TLS_HANDSHAKE',
        observedProperty: 'negotiated_key_exchange',
        observedValue: 'ECDHE-X25519',
        rawPayload: JSON.stringify({ group: 'X25519', pq_hybrid: false }),
        scannerVersion: 'SSLyze 6.3.1 (OpenSSL 3.0.13)',
        hashDigest: 'sha256-test-digest-phase5-001',
      },
    });

    // 5. Create a Finding linked to the evidence
    testFinding = await prisma.finding.create({
      data: {
        assetId: testAssetLive.id,
        evidenceId: testEvidence.id,
        title: 'Classical Key Exchange in TLS 1.3 Handshake',
        algorithmOrConfig: 'ECDHE-X25519',
        observedValue: 'ECDHE-X25519',
        purpose: 'KEY_ESTABLISHMENT',
        riskLevel: 'HIGH',
        riskReason: 'ECDHE over X25519 is vulnerable to Shor algorithm on cryptanalytically relevant quantum computers.',
        evidenceSource: 'scanner_verified',
        standardRef: 'NIST FIPS 203',
        ruleId: 'NIST-FIPS-203-KEM',
        status: 'OPEN',
        priority: 'HIGH',
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testFinding) await prisma.finding.deleteMany({ where: { id: testFinding.id } });
    if (testEvidence) await prisma.evidence.deleteMany({ where: { id: testEvidence.id } });
    if (testScan) await prisma.scanJob.deleteMany({ where: { id: testScan.id } });
    if (testAssetLive) await prisma.asset.deleteMany({ where: { id: testAssetLive.id } });
    if (testAssetManual) await prisma.asset.deleteMany({ where: { id: testAssetManual.id } });
  });

  describe('1. GET /api/v1/dashboard/stats', () => {
    it('returns DB-backed stats with source distribution separating live vs manual', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // Source distribution exists and separates live vs manual
      expect(data).toHaveProperty('sourceDistribution');
      expect(typeof data.sourceDistribution.liveScanned).toBe('number');
      expect(typeof data.sourceDistribution.manual).toBe('number');
      expect(typeof data.sourceDistribution.imported).toBe('number');
      expect(data.sourceDistribution.liveScanned).toBeGreaterThanOrEqual(1);
      expect(data.sourceDistribution.manual).toBeGreaterThanOrEqual(1);

      // Evidence breakdown exists and separates scanner_verified vs user_reported
      expect(data).toHaveProperty('evidenceStats');
      expect(typeof data.evidenceStats.scannerVerified).toBe('number');
      expect(typeof data.evidenceStats.userReported).toBe('number');
      expect(typeof data.evidenceStats.imported).toBe('number');
      expect(data.evidenceStats.scannerVerified).toBeGreaterThanOrEqual(1);

      // Remediation tracking stats exist
      expect(data).toHaveProperty('remediationStats');
      expect(typeof data.remediationStats.open).toBe('number');
      expect(typeof data.remediationStats.inProgress).toBe('number');
      expect(typeof data.remediationStats.resolved).toBe('number');
      expect(typeof data.remediationStats.acceptedRisk).toBe('number');
      expect(typeof data.remediationStats.progressPct).toBe('number');

      // Missing info exists and flags unassessed assets
      expect(data).toHaveProperty('missingInfo');
      expect(typeof data.missingInfo.count).toBe('number');
      expect(Array.isArray(data.missingInfo.assets)).toBe(true);

      // Scan status stats exist
      expect(data).toHaveProperty('scanStats');
      expect(typeof data.scanStats.total).toBe('number');
      expect(typeof data.scanStats.completed).toBe('number');

      // Recent scans include check & evidence counts
      expect(Array.isArray(data.recentScans)).toBe(true);
      const recent = data.recentScans.find((s: any) => s.id === testScan.id);
      expect(recent).toBeDefined();
      expect(recent.targetHost).toBe('live-portal-p5.internal');
      expect(recent.status).toBe('COMPLETED');
      expect(recent.evidenceCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. GET /api/v1/findings', () => {
    it('returns findings with linked Evidence record and integrity hash', async () => {
      const res = await request(app)
        .get('/api/v1/findings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const target = res.body.data.find((f: any) => f.id === testFinding.id);
      expect(target).toBeDefined();
      expect(target.title).toBe('Classical Key Exchange in TLS 1.3 Handshake');
      expect(target.ruleId).toBe('NIST-FIPS-203-KEM');
      expect(target.evidenceSource).toBe('scanner_verified');

      // Verifies evidence relation is populated
      expect(target.evidence).toBeDefined();
      expect(target.evidence.id).toBe(testEvidence.id);
      expect(target.evidence.hashDigest).toBe('sha256-test-digest-phase5-001');
      expect(target.evidence.scannerVersion).toContain('SSLyze');
      expect(target.evidence.observedProperty).toBe('negotiated_key_exchange');
    });

    it('filters findings by evidenceSource (scanner_verified vs user_reported vs imported)', async () => {
      const liveRes = await request(app)
        .get('/api/v1/findings?evidenceSource=scanner_verified')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(liveRes.status).toBe(200);
      liveRes.body.data.forEach((f: any) => {
        expect(f.evidenceSource).toBe('scanner_verified');
      });

      const manualRes = await request(app)
        .get('/api/v1/findings?evidenceSource=user_reported')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(manualRes.status).toBe(200);
      manualRes.body.data.forEach((f: any) => {
        expect(f.evidenceSource).toBe('user_reported');
      });
    });
  });

  describe('3. GET /api/v1/reports/summary', () => {
    it('returns report summary with institutional metrics and limitations disclosure', async () => {
      const res = await request(app)
        .get('/api/v1/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const rep = res.body.data;

      expect(rep).toHaveProperty('institution');
      expect(rep).toHaveProperty('metrics');
      expect(typeof rep.metrics.totalAssets).toBe('number');
      expect(typeof rep.metrics.assessedAssets).toBe('number');
      expect(typeof rep.metrics.readinessCoveragePct).toBe('number');
      expect(rep).toHaveProperty('limitations');
      expect(rep.limitations).toContain('observable protocol handshakes');
    });
  });

  describe('4. Missing Telemetry & Honest Unknown Handling', () => {
    it('flags assets without cryptographic evidence in missingInfo without assigning fake scores', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // testAssetManual has no evidence recorded yet, must be accounted for in missingInfo
      expect(data.missingInfo.count).toBeGreaterThanOrEqual(1);
      const foundInMissing = data.missingInfo.assets.some(
        (a: any) => a.id === testAssetManual.id
      );
      expect(foundInMissing).toBe(true);
    });
  });
});

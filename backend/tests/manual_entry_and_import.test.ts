import request from 'supertest';
import app from '../src/index';
import prisma from '../src/lib/prisma';
import { generateToken } from '../src/middleware/auth';
import { runAssessmentForAsset } from '../src/services/assessment.service';

describe('Phase 4: Manual Asset Entry & Two-Stage Import Engine Suite', () => {
  let testInstId: string;
  let adminUserId: string;
  let viewerUserId: string;
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    let institution = await prisma.institution.findFirst();
    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          name: 'Manual & Import Test University',
          domain: 'import-test.edu',
        },
      });
    }
    testInstId = institution.id;

    // Create real DB users to satisfy SQLite foreign key constraints on AuditLog.userId
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-phase4-${Date.now()}@apex.edu`,
        name: 'Phase 4 Admin',
        passwordHash: 'dummy-hash-for-tests',
        role: 'ADMIN',
        institutionId: testInstId,
      },
    });
    adminUserId = adminUser.id;

    const viewerUser = await prisma.user.create({
      data: {
        email: `viewer-phase4-${Date.now()}@apex.edu`,
        name: 'Phase 4 Viewer',
        passwordHash: 'dummy-hash-for-tests',
        role: 'VIEWER',
        institutionId: testInstId,
      },
    });
    viewerUserId = viewerUser.id;

    adminToken = generateToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: 'ADMIN',
      institutionId: testInstId,
    });

    viewerToken = generateToken({
      id: viewerUser.id,
      email: viewerUser.email,
      name: viewerUser.name,
      role: 'VIEWER',
      institutionId: testInstId,
    });
  });

  afterAll(async () => {
    // Clean up test assets
    await prisma.asset.deleteMany({
      where: {
        OR: [
          { identifier: { contains: 'manual-test' } },
          { identifier: { contains: 'import-test' } },
          { identifier: { contains: 'batch-test' } },
          { identifier: { contains: 'unknown-test' } },
          { identifier: { contains: 'audit-test' } },
        ],
      },
    });
    if (adminUserId) await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
    if (viewerUserId) await prisma.user.delete({ where: { id: viewerUserId } }).catch(() => {});
    await prisma.$disconnect();
  });

  describe('1. Required-Field Validation & Minimal Entry', () => {
    it('should reject creation if asset name is missing (400 validation error)', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assetType: 'SERVER',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
      const hasNameError = res.body.errors.some((e: any) => e.path.includes('name'));
      expect(hasNameError).toBe(true);
    });

    it('should reject creation if asset type is missing (400 validation error)', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Nameless Type Asset',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      const hasTypeError = res.body.errors.some((e: any) => e.path.includes('assetType'));
      expect(hasTypeError).toBe(true);
    });

    it('should successfully create asset with only required fields (name, assetType) and auto-generate identifier', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Manual Test Minimal Asset',
          assetType: 'SERVER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Manual Test Minimal Asset');
      expect(res.body.data.assetType).toBe('SERVER');
      expect(res.body.data.identifier).toBe('manual-test-minimal-asset');
      expect(res.body.data.informationSource).toBe('MANUAL');
    });
  });

  describe('2. "Unknown" Handling & Insufficient Evidence Non-Defaulting', () => {
    it('should accept "Unknown" in all dropdowns without inventing values and assess as NOT_ASSESSED (never HIGH by default)', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Manual Test Unknown Host',
          identifier: 'manual-test-unknown-host.edu',
          assetType: 'APPLICATION',
          tlsVersion: 'Unknown',
          certPubKeyAlgo: 'Unknown',
          certKeySize: 'Unknown',
          keyExchangeGroup: 'Unknown',
          cipherSuite: 'Unknown',
          notes: 'Asset with unverified crypto configuration',
        });

      expect(res.status).toBe(201);
      const asset = res.body.data;
      expect(asset.informationSource).toBe('MANUAL');

      // Check assessment status and risk score
      const assessment = await prisma.assessment.findFirst({
        where: { assetId: asset.id },
        orderBy: { assessedAt: 'desc' },
      });

      expect(assessment).toBeDefined();
      expect(assessment?.quantumRiskScore).toBe(0);
      expect(assessment?.overallReadinessStatus).toBe('NOT_ASSESSED');

      // Asset status must remain PENDING, NEVER defaulting to HIGH_RISK
      const assetDb = await prisma.asset.findUnique({ where: { id: asset.id } });
      expect(assetDb?.assessmentStatus).toBe('PENDING');
      expect(assetDb?.assessmentStatus).not.toBe('HIGH_RISK');
    });
  });

  describe('3. Strict Provenance Enforceability & Manual Label Integrity', () => {
    let createdAssetId: string;

    it('should register manual asset with informationSource: MANUAL and user_reported provenance', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Manual Test Web Gateway',
          identifier: 'manual-test-gateway.edu',
          assetType: 'WEBSITE',
          dataSensitivity: 'CONFIDENTIAL',
          tlsVersion: 'TLSv1.3',
          port: 443,
          environment: 'PRODUCTION',
          knownAlgorithms: JSON.stringify([
            { algorithm: 'RSA-2048', purpose: 'DIGITAL_SIGNATURE' },
            { algorithm: 'ECDHE-P256', purpose: 'KEY_ESTABLISHMENT' },
          ]),
          notes: 'Manually logged by system administrator',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.informationSource).toBe('MANUAL');
      createdAssetId = res.body.data.id;

      // Findings generated must carry evidenceSource: user_reported and lower confidence
      const findings = await prisma.finding.findMany({
        where: { assetId: createdAssetId },
      });
      expect(findings.length).toBeGreaterThan(0);
      for (const f of findings) {
        expect(f.evidenceSource).toBe('user_reported');
        expect(f.evidenceSource).not.toBe('scanner_verified');
        expect(f.confidence).not.toBe('HIGH'); // Lower confidence for user-reported
        expect(f.limitations).toContain('User-reported (unverified)');
      }
    });

    it('should never allow manual asset creation or edit to forge TLS_SCAN provenance', async () => {
      const createRes = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Manual Test Claiming Fake Scan',
          identifier: 'manual-test-fake-scan.edu',
          assetType: 'SERVER',
          informationSource: 'TLS_SCAN', // Unauthorized attempt to forge scanner verification
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.informationSource).toBe('MANUAL');
      expect(createRes.body.data.informationSource).not.toBe('TLS_SCAN');

      // Attempting to forge via PUT
      const updateRes = await request(app)
        .put(`/api/v1/assets/${createdAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          informationSource: 'TLS_SCAN',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.informationSource).toBe('MANUAL');
      expect(updateRes.body.data.informationSource).not.toBe('TLS_SCAN');
    });
  });

  describe('4. CRUD, Edit History & Audit Logging', () => {
    let auditAssetId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Audit Test Asset',
          identifier: 'audit-test-node.edu',
          assetType: 'SERVER',
          dataSensitivity: 'CONFIDENTIAL',
          environment: 'PRODUCTION',
          notes: 'Initial audit test registration',
        });
      auditAssetId = res.body.data.id;
    });

    it('should record field-by-field diff in AuditLog upon asset update', async () => {
      const updateRes = await request(app)
        .put(`/api/v1/assets/${auditAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dataSensitivity: 'HIGHLY_SENSITIVE',
          environment: 'STAGING',
          notes: 'Updated following security audit',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.dataSensitivity).toBe('HIGHLY_SENSITIVE');
      expect(updateRes.body.data.environment).toBe('STAGING');

      // Verify AuditLog record contains exact before and after delta
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Asset',
          entityId: auditAssetId,
          action: 'ASSET_UPDATED',
        },
        orderBy: { timestamp: 'desc' },
      });

      expect(auditLog).toBeDefined();
      const details = JSON.parse(auditLog?.details || '{}');
      expect(details.changedFields).toBeDefined();
      expect(details.changedFields.dataSensitivity.before).toBe('CONFIDENTIAL');
      expect(details.changedFields.dataSensitivity.after).toBe('HIGHLY_SENSITIVE');
      expect(details.changedFields.environment.before).toBe('PRODUCTION');
      expect(details.changedFields.environment.after).toBe('STAGING');
    });

    it('should retrieve asset edit history via GET /api/v1/assets/:id/history', async () => {
      const historyRes = await request(app)
        .get(`/api/v1/assets/${auditAssetId}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(Array.isArray(historyRes.body.data)).toBe(true);
      expect(historyRes.body.data.length).toBeGreaterThanOrEqual(2); // ASSET_CREATED and ASSET_UPDATED
      expect(historyRes.body.asset.id).toBe(auditAssetId);
    });

    it('should delete asset and record ASSET_DELETED audit event', async () => {
      const deleteRes = await request(app)
        .delete(`/api/v1/assets/${auditAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);

      const deletedCheck = await prisma.asset.findUnique({ where: { id: auditAssetId } });
      expect(deletedCheck).toBeNull();

      const deleteAudit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Asset',
          entityId: auditAssetId,
          action: 'ASSET_DELETED',
        },
      });
      expect(deleteAudit).toBeDefined();
    });
  });

  describe('5. RBAC Authorization: Viewer Cannot Edit or Mutate Assets/Imports', () => {
    let protectedAssetId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Protected Asset for RBAC',
          identifier: 'manual-test-rbac-asset.edu',
          assetType: 'DATABASE',
        });
      protectedAssetId = res.body.data.id;
    });

    it('should allow VIEWER to read assets', async () => {
      const res = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject VIEWER attempting to create an asset (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Unauthorized Asset',
          assetType: 'SERVER',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should reject VIEWER attempting to update an asset (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .put(`/api/v1/assets/${protectedAssetId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          environment: 'STAGING',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should reject VIEWER attempting to delete an asset (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .delete(`/api/v1/assets/${protectedAssetId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should reject VIEWER attempting to preview imports (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/imports/preview')
        .set('Authorization', `Bearer ${viewerToken}`)
        .attach('files', Buffer.from('name,identifier\nTest,test.edu', 'utf-8'), 'test.csv');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('6. Two-Stage Import Engine (Preview with Bad Rows + Commit)', () => {
    // CSV with valid rows, intra-batch duplicate, and invalid rows (missing name, missing host, invalid port)
    const mixedCsv = [
      'name,identifier,assetType,dataSensitivity,knownAlgorithms,tlsVersion,port',
      'Batch Valid Node,batch-test-valid.edu,SERVER,CONFIDENTIAL,RSA-2048,TLSv1.3,443',
      ',batch-test-bad-name.edu,SERVER,INTERNAL,None,TLSv1.3,443', // Row 2: Missing name
      'Batch Missing Host,,SERVER,INTERNAL,None,TLSv1.3,443', // Row 3: Missing identifier
      'Batch Bad Port,batch-test-bad-port.edu,SERVER,INTERNAL,None,TLSv1.3,99999', // Row 4: Invalid port
      'Batch Duplicate Node,batch-test-valid.edu,SERVER,INTERNAL,None,TLSv1.3,443', // Row 5: Duplicate identifier
    ].join('\n');

    it('Stage 1 (Preview): should flag invalid rows with per-row errors without dropping or auto-fixing, committing ZERO rows to DB', async () => {
      const countBefore = await prisma.asset.count({
        where: { identifier: { contains: 'batch-test' } },
      });
      expect(countBefore).toBe(0);

      const previewRes = await request(app)
        .post('/api/v1/imports/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', Buffer.from(mixedCsv, 'utf-8'), 'inventory-batch.csv');

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.success).toBe(true);

      const data = previewRes.body.data;
      expect(data.totalRecords).toBe(5);
      expect(data.validRecords).toBe(1); // Only row 1 is valid & unique
      expect(data.invalidRecords).toBe(3); // Rows 2, 3, 4 are invalid
      expect(data.duplicateRecords).toBe(1); // Row 5 is duplicate

      // Verify specific per-row errors
      const row2 = data.items.find((i: any) => i.rowNumber === 2);
      expect(row2.isValid).toBe(false);
      expect(row2.errors).toContain('Missing required asset name');

      const row3 = data.items.find((i: any) => i.rowNumber === 3);
      expect(row3.isValid).toBe(false);
      expect(row3.errors).toContain('Missing required hostname or identifier');

      const row4 = data.items.find((i: any) => i.rowNumber === 4);
      expect(row4.isValid).toBe(false);
      expect(row4.errors.some((e: string) => e.includes('Invalid port number'))).toBe(true);

      // Verify ZERO records were inserted into the database during preview
      const countAfter = await prisma.asset.count({
        where: { identifier: { contains: 'batch-test' } },
      });
      expect(countAfter).toBe(0);
    });

    it('Stage 2 (Commit): should commit valid items, create ImportJob, and record Evidence strictly labelled imported', async () => {
      const itemsToCommit = [
        {
          name: 'Batch Valid Node',
          identifier: 'batch-test-valid.edu',
          assetType: 'SERVER',
          dataSensitivity: 'CONFIDENTIAL',
          knownAlgorithms: 'RSA-2048, AES-256-GCM',
          tlsVersion: 'TLSv1.3',
          port: 443,
          environment: 'PRODUCTION',
          sourceFile: 'inventory-batch.csv',
          sourceFormat: 'CSV',
          rowNumber: 1,
        },
      ];

      const commitRes = await request(app)
        .post('/api/v1/imports/execute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: itemsToCommit,
          skipDuplicates: true,
        });

      expect(commitRes.status).toBe(200);
      expect(commitRes.body.success).toBe(true);
      expect(commitRes.body.data.imported).toBe(1);

      // Verify Asset inserted with informationSource: IMPORT_CSV
      const asset = await prisma.asset.findFirst({
        where: { identifier: 'batch-test-valid.edu' },
      });
      expect(asset).toBeDefined();
      expect(asset?.informationSource).toBe('IMPORT_CSV');

      // Verify Evidence records created strictly labelled 'imported'
      const evidenceList = await prisma.evidence.findMany({
        where: { assetId: asset?.id },
      });
      expect(evidenceList.length).toBeGreaterThan(0);
      for (const ev of evidenceList) {
        expect(ev.evidenceSource).toBe('imported');
        expect(ev.evidenceSource).not.toBe('scanner_verified');
      }

      // Verify ImportJob and AuditLog records
      const importJob = await prisma.importJob.findUnique({
        where: { id: commitRes.body.data.importJobId },
      });
      expect(importJob).toBeDefined();
      expect(importJob?.importedRows).toBe(1);
      expect(importJob?.status).toBe('COMPLETED');
    });

    it('should support JSON inventory upload in preview and commit', async () => {
      const jsonInventory = JSON.stringify([
        {
          name: 'JSON Cloud Function',
          identifier: 'import-test-json.edu',
          type: 'APPLICATION',
          sensitivity: 'INTERNAL',
          crypto: 'AES-256-GCM',
          tls: 'TLSv1.3',
        },
      ]);

      const previewRes = await request(app)
        .post('/api/v1/imports/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', Buffer.from(jsonInventory, 'utf-8'), 'cloud-functions.json');

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.data.totalRecords).toBe(1);
      expect(previewRes.body.data.items[0].name).toBe('JSON Cloud Function');
      expect(previewRes.body.data.items[0].assetType).toBe('APPLICATION');
      expect(previewRes.body.data.items[0].dataSensitivity).toBe('INTERNAL');
    });

    it('should retrieve import job history via GET /api/v1/imports/history', async () => {
      const historyRes = await request(app)
        .get('/api/v1/imports/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(Array.isArray(historyRes.body.data)).toBe(true);
      expect(historyRes.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('7. Reproducibility: Same Manual Input -> Same Deterministic Score', () => {
    let deterministicAssetId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Deterministic Manual Test Node',
          identifier: 'manual-test-deterministic.edu',
          assetType: 'SERVER',
          dataSensitivity: 'CONFIDENTIAL',
          knownAlgorithms: JSON.stringify([
            { algorithm: 'RSA-2048', purpose: 'DIGITAL_SIGNATURE' },
            { algorithm: 'ECDHE-P256', purpose: 'KEY_ESTABLISHMENT' },
            { algorithm: 'AES-128-GCM', purpose: 'SYMMETRIC_ENCRYPTION' },
          ]),
        });
      deterministicAssetId = res.body.data.id;
    });

    it('evaluates manual asset multiple times and produces identical score and status', async () => {
      const run1 = await runAssessmentForAsset(deterministicAssetId);
      const run2 = await runAssessmentForAsset(deterministicAssetId);
      const run3 = await runAssessmentForAsset(deterministicAssetId);

      expect(run1.quantumRiskScore).toBe(run2.quantumRiskScore);
      expect(run2.quantumRiskScore).toBe(run3.quantumRiskScore);
      expect(run1.overallReadinessStatus).toBe(run2.overallReadinessStatus);
      expect(run2.overallReadinessStatus).toBe(run3.overallReadinessStatus);
      expect(run1.findings.length).toBe(run2.findings.length);
      expect(run2.findings.length).toBe(run3.findings.length);

      const bd1 = JSON.parse(run1.scoreBreakdown);
      const bd2 = JSON.parse(run2.scoreBreakdown);
      expect(bd1.finalScore).toBe(bd2.finalScore);
      expect(bd1.basePoints).toBe(bd2.basePoints);
      expect(bd1.status).toBe(bd2.status);
      expect(bd1.contributingFindings.length).toBe(bd2.contributingFindings.length);
      for (let i = 0; i < bd1.contributingFindings.length; i++) {
        expect(bd1.contributingFindings[i].pointsAdded).toBe(bd2.contributingFindings[i].pointsAdded);
        expect(bd1.contributingFindings[i].ruleId).toBe(bd2.contributingFindings[i].ruleId);
      }
    });
  });
});

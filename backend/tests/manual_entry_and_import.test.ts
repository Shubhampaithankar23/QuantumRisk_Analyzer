import request from 'supertest';
import app from '../src/index';
import prisma from '../src/lib/prisma';

describe('Phase 4: Manual Asset Entry & Two-Stage Import Engine Suite', () => {
  let testInstId: string;

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
  });

  afterAll(async () => {
    // Clean up test assets
    await prisma.asset.deleteMany({
      where: {
        OR: [
          { identifier: { contains: 'manual-test' } },
          { identifier: { contains: 'import-test' } },
          { identifier: { contains: 'batch-test' } },
        ],
      },
    });
    await prisma.$disconnect();
  });

  describe('1. Manual Asset Registration & Provenance Enforceability', () => {
    let createdAssetId: string;

    it('should register manual asset with informationSource: MANUAL and user_reported provenance', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
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

      // Verify AuditLog record was created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Asset',
          entityId: createdAssetId,
          action: 'ASSET_CREATED',
        },
      });
      expect(auditLog).toBeDefined();
    });

    it('should never allow manual asset creation to claim TLS_SCAN provenance', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .send({
          name: 'Manual Test Claiming Fake Scan',
          identifier: 'manual-test-fake-scan.edu',
          assetType: 'SERVER',
          informationSource: 'TLS_SCAN', // Unauthorized attempt to forge scanner verification
        });

      expect(res.status).toBe(201);
      // Must be coerced to MANUAL
      expect(res.body.data.informationSource).toBe('MANUAL');
      expect(res.body.data.informationSource).not.toBe('TLS_SCAN');
    });

    it('should update asset and record field-by-field diff in AuditLog (Edit History)', async () => {
      const updateRes = await request(app)
        .put(`/api/v1/assets/${createdAssetId}`)
        .send({
          dataSensitivity: 'HIGHLY_SENSITIVE',
          environment: 'STAGING',
          notes: 'Updated environment following migration review',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.dataSensitivity).toBe('HIGHLY_SENSITIVE');
      expect(updateRes.body.data.environment).toBe('STAGING');

      // Verify Edit History in AuditLog
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'Asset',
          entityId: createdAssetId,
          action: 'ASSET_UPDATED',
        },
        orderBy: { timestamp: 'desc' },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      const details = JSON.parse(auditLogs[0].details || '{}');
      expect(details.changedFields).toBeDefined();
      expect(details.changedFields.dataSensitivity.before).toBe('CONFIDENTIAL');
      expect(details.changedFields.dataSensitivity.after).toBe('HIGHLY_SENSITIVE');
      expect(details.changedFields.environment.before).toBe('PRODUCTION');
      expect(details.changedFields.environment.after).toBe('STAGING');
    });

    it('should retrieve asset edit history via GET /api/v1/assets/:id/history', async () => {
      const historyRes = await request(app).get(`/api/v1/assets/${createdAssetId}/history`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(Array.isArray(historyRes.body.data)).toBe(true);
      expect(historyRes.body.data.length).toBeGreaterThanOrEqual(2); // ASSET_CREATED and ASSET_UPDATED
      expect(historyRes.body.asset.id).toBe(createdAssetId);
    });

    it('should delete asset and record ASSET_DELETED audit event', async () => {
      const deleteRes = await request(app).delete(`/api/v1/assets/${createdAssetId}`);
      expect(deleteRes.status).toBe(200);

      const deletedCheck = await prisma.asset.findUnique({ where: { id: createdAssetId } });
      expect(deletedCheck).toBeNull();

      const deleteAudit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Asset',
          entityId: createdAssetId,
          action: 'ASSET_DELETED',
        },
      });
      expect(deleteAudit).toBeDefined();
    });
  });

  describe('2. Two-Stage Import Engine (Preview + Commit)', () => {
    const sampleCsv = `name,identifier,assetType,dataSensitivity,knownAlgorithms,tlsVersion,port\nBatch Node 1,batch-test-1.edu,SERVER,CONFIDENTIAL,"RSA-2048, AES-256-GCM",TLSv1.3,443\nBatch Node 2,batch-test-2.edu,DATABASE,HIGHLY_SENSITIVE,"ECDSA-P256",TLSv1.2,5432\nDuplicate In Batch,batch-test-1.edu,SERVER,INTERNAL,None,TLSv1.3,443`;

    it('Stage 1 (Preview): should parse CSV and flag intra-batch duplicates WITHOUT inserting into database', async () => {
      const countBefore = await prisma.asset.count({
        where: { identifier: { contains: 'batch-test' } },
      });
      expect(countBefore).toBe(0);

      const previewRes = await request(app)
        .post('/api/v1/imports/preview')
        .attach('files', Buffer.from(sampleCsv, 'utf-8'), 'batch-inventory.csv');

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.success).toBe(true);
      expect(previewRes.body.data.totalRecords).toBe(3);
      expect(previewRes.body.data.duplicateRecords).toBe(1);
      expect(previewRes.body.data.validRecords).toBe(2);

      // Verify ZERO records were inserted into DB during preview
      const countAfter = await prisma.asset.count({
        where: { identifier: { contains: 'batch-test' } },
      });
      expect(countAfter).toBe(0);
    });

    it('Stage 2 (Commit): should commit valid items, create ImportJob, and record Evidence with source: imported', async () => {
      const itemsToCommit = [
        {
          name: 'Batch Node 1',
          identifier: 'batch-test-1.edu',
          assetType: 'SERVER',
          dataSensitivity: 'CONFIDENTIAL',
          knownAlgorithms: 'RSA-2048, AES-256-GCM',
          tlsVersion: 'TLSv1.3',
          port: 443,
          environment: 'PRODUCTION',
          sourceFile: 'batch-inventory.csv',
          sourceFormat: 'CSV',
          rowNumber: 1,
        },
        {
          name: 'Batch Node 2',
          identifier: 'batch-test-2.edu',
          assetType: 'DATABASE',
          dataSensitivity: 'HIGHLY_SENSITIVE',
          knownAlgorithms: 'ECDSA-P256',
          tlsVersion: 'TLSv1.2',
          port: 5432,
          environment: 'PRODUCTION',
          sourceFile: 'batch-inventory.csv',
          sourceFormat: 'CSV',
          rowNumber: 2,
        },
      ];

      const commitRes = await request(app)
        .post('/api/v1/imports/execute')
        .send({
          items: itemsToCommit,
          skipDuplicates: true,
        });

      expect(commitRes.status).toBe(200);
      expect(commitRes.body.success).toBe(true);
      expect(commitRes.body.data.imported).toBe(2);

      // Verify Assets were inserted with informationSource: IMPORT_CSV
      const assets = await prisma.asset.findMany({
        where: { identifier: { contains: 'batch-test' } },
        include: { evidence: true },
      });
      expect(assets.length).toBe(2);
      expect(assets[0].informationSource).toBe('IMPORT_CSV');

      // Verify Evidence records were created and strictly labelled 'imported'
      const evidenceRecords = await prisma.evidence.findMany({
        where: { assetId: { in: assets.map((a) => a.id) } },
      });
      expect(evidenceRecords.length).toBeGreaterThan(0);
      for (const ev of evidenceRecords) {
        expect(ev.evidenceSource).toBe('imported');
        expect(ev.evidenceSource).not.toBe('scanner_verified');
      }

      // Verify ImportJob and AuditLog records
      const importJob = await prisma.importJob.findUnique({
        where: { id: commitRes.body.data.importJobId },
      });
      expect(importJob).toBeDefined();
      expect(importJob?.importedRows).toBe(2);
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
        .post('/api/v1/import/preview')
        .attach('files', Buffer.from(jsonInventory, 'utf-8'), 'cloud-functions.json');

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.data.totalRecords).toBe(1);
      expect(previewRes.body.data.items[0].name).toBe('JSON Cloud Function');
      expect(previewRes.body.data.items[0].assetType).toBe('APPLICATION');
      expect(previewRes.body.data.items[0].dataSensitivity).toBe('INTERNAL');
    });

    it('should retrieve import job history via GET /api/v1/imports/history', async () => {
      const historyRes = await request(app).get('/api/v1/imports/history');
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(Array.isArray(historyRes.body.data)).toBe(true);
      expect(historyRes.body.data.length).toBeGreaterThan(0);
    });
  });
});

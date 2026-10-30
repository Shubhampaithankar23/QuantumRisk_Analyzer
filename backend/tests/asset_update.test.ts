import request from 'supertest';
import app from '../src/index';
import prisma from '../src/lib/prisma';
import { generateToken } from '../src/middleware/auth';

describe('Asset Update Endpoint Suite (PUT /api/v1/assets/:id)', () => {
  let adminToken: string;
  let institutionId: string;
  let manualAssetId: string;

  beforeAll(async () => {
    let institution = await prisma.institution.findFirst();
    if (!institution) {
      institution = await prisma.institution.create({
        data: { name: 'Asset Update Test University', domain: 'update-test.edu' },
      });
    }
    institutionId = institution.id;

    let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: `admin-update-test-${Date.now()}@update-test.edu`,
          name: 'Update Test Admin',
          passwordHash: 'hashed',
          role: 'ADMIN',
          institutionId,
        },
      });
    }
    adminToken = generateToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: 'ADMIN',
      institutionId,
    });
  });

  beforeEach(async () => {
    // Create a fresh manual asset for each test
    const res = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Initial Manual Gateway',
        identifier: `manual-gw-${Date.now()}.internal`,
        assetType: 'WEBSITE',
        dataSensitivity: 'CONFIDENTIAL',
        tlsVersion: 'TLSv1.3',
        port: 443,
        environment: 'PRODUCTION',
        notes: 'Initial test asset notes',
        knownAlgorithms: JSON.stringify([
          { algorithm: 'RSA-2048', purpose: 'DIGITAL_SIGNATURE', source: 'user_reported' },
        ]),
      });

    expect(res.status).toBe(201);
    manualAssetId = res.body.data.id;
  });

  afterEach(async () => {
    if (manualAssetId) {
      await prisma.asset.delete({ where: { id: manualAssetId } }).catch(() => {});
    }
  });

  it('successfully updates manual asset with full modal payload and preserves user_reported provenance', async () => {
    const updatePayload = {
      name: 'Updated Quantum Gateway',
      identifier: 'updated-quantum-gw.internal',
      assetType: 'SERVER',
      dataSensitivity: 'HIGHLY_SENSITIVE',
      tlsVersion: 'TLSv1.3',
      port: 8443,
      environment: 'STAGING',
      knownAlgorithms: JSON.stringify([
        { algorithm: 'ML-DSA-65', purpose: 'DIGITAL_SIGNATURE' },
        { algorithm: 'AES-256-GCM', purpose: 'SYMMETRIC_ENCRYPTION' },
      ]),
      informationSource: 'MANUAL',
      notes: 'Updated via edit modal',
    };

    const res = await request(app)
      .put(`/api/v1/assets/${manualAssetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Quantum Gateway');
    expect(res.body.data.identifier).toBe('updated-quantum-gw.internal');
    expect(res.body.data.assetType).toBe('SERVER');
    expect(res.body.data.dataSensitivity).toBe('HIGHLY_SENSITIVE');
    expect(res.body.data.port).toBe(8443);
    expect(res.body.data.environment).toBe('STAGING');
    expect(res.body.data.notes).toBe('Updated via edit modal');
    expect(res.body.data.informationSource).toBe('MANUAL');
  });

  it('normalizes empty strings and nulls for optional fields, and coerces string port', async () => {
    const res = await request(app)
      .put(`/api/v1/assets/${manualAssetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Normalized Asset',
        identifier: '', // empty string should preserve existing identifier
        tlsVersion: '', // empty string should normalize to null
        notes: '', // empty string should normalize to null
        port: '9443', // string port coerced to integer number
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Normalized Asset');
    expect(res.body.data.port).toBe(9443);
    expect(res.body.data.tlsVersion).toBeNull();
    expect(res.body.data.notes).toBeNull();
    expect(res.body.data.identifier).toContain('manual-gw-');
  });

  it('prevents manual update from forging TLS_SCAN provenance', async () => {
    const res = await request(app)
      .put(`/api/v1/assets/${manualAssetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Forged Provenance Attempt',
        informationSource: 'TLS_SCAN',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.informationSource).toBe('MANUAL');
    expect(res.body.data.informationSource).not.toBe('TLS_SCAN');
  });

  it('returns 400 validation error when name is too short', async () => {
    const res = await request(app)
      .put(`/api/v1/assets/${manualAssetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'A',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation failed');
    expect(res.body.errors).toBeDefined();
    expect(res.body.details).toBeDefined();
  });

  it('returns 400 validation error when port is out of range', async () => {
    const res = await request(app)
      .put(`/api/v1/assets/${manualAssetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        port: 99999,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Port must be between 1 and 65535');
  });

  it('returns 400 validation error when dataSensitivity is invalid', async () => {
    const res = await request(app)
      .put(`/api/v1/assets/${manualAssetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dataSensitivity: 'SUPER_SECRET_UNSUPPORTED',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid data sensitivity tier');
  });

  it('returns 404 when asset id does not exist', async () => {
    const res = await request(app)
      .put('/api/v1/assets/nonexistent-cuid-99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Should Not Exist',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Asset not found');
  });

  it('gracefully handles audit logging when JWT userId is not in database without throwing 500', async () => {
    const fakeToken = generateToken({
      id: 'deleted-user-id-99999',
      email: 'deleted@update-test.edu',
      name: 'Deleted User',
      role: 'ADMIN',
      institutionId,
    });

    const res = await request(app)
      .put(`/api/v1/assets/${manualAssetId}`)
      .set('Authorization', `Bearer ${fakeToken}`)
      .send({
        name: 'Graceful Audit Asset',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Graceful Audit Asset');
  });
});

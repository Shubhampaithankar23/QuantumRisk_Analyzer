import request from 'supertest';
import app from '../src/index';
import prisma from '../src/lib/prisma';

describe('End-to-End API Integration Suite', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  let createdAssetId: string;
  let testFindingId: string;

  it('POST /api/v1/assets should register a new digital asset', async () => {
    const res = await request(app)
      .post('/api/v1/assets')
      .send({
        name: 'Test Healthcare Telehealth Portal',
        identifier: 'telehealth-test.apex.edu',
        assetType: 'WEBSITE',
        dataSensitivity: 'REGULATED',
        knownAlgorithms: 'RSA-2048, ECDHE-P256, AES-128-GCM',
        port: 443,
        environment: 'PRODUCTION',
        notes: 'HIPAA and student health telehealth consultation portal',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.identifier).toBe('telehealth-test.apex.edu');
    createdAssetId = res.body.data.id;
  });

  it('POST /api/v1/assets should reject duplicate identifiers with 409', async () => {
    const res = await request(app)
      .post('/api/v1/assets')
      .send({
        name: 'Duplicate Telehealth Portal',
        identifier: 'telehealth-test.apex.edu',
        assetType: 'WEBSITE',
        dataSensitivity: 'REGULATED',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists');
  });

  it('POST /api/v1/assessments/run/:assetId should execute NIST evaluation', async () => {
    const res = await request(app).post(`/api/v1/assessments/run/${createdAssetId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.quantumRiskScore).toBeGreaterThanOrEqual(50);
    expect(res.body.data.overallReadinessStatus).toBe('QUANTUM_VULNERABLE');
    expect(res.body.data.findings.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/findings should return findings for evaluated assets', async () => {
    const res = await request(app).get('/api/v1/findings?search=telehealth');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    testFindingId = res.body.data[0].id;
  });

  it('PATCH /api/v1/findings/:id should update status and remediation owner', async () => {
    const res = await request(app)
      .patch(`/api/v1/findings/${testFindingId}`)
      .send({
        status: 'IN_PROGRESS',
        owner: 'Telehealth Security Taskforce',
        priority: 'CRITICAL',
        dueDate: '2027-01-15',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.owner).toBe('Telehealth Security Taskforce');
  });

  it('GET /api/v1/reports/export/pdf should stream an official PDF assessment report', async () => {
    const res = await request(app).get('/api/v1/reports/export/pdf');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.body.length).toBeGreaterThan(500); // Verify non-empty PDF bytes
  });

  it('DELETE /api/v1/assets/:id should clean up test asset', async () => {
    const res = await request(app).delete(`/api/v1/assets/${createdAssetId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

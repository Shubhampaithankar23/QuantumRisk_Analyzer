import request from 'supertest';
import app from '../src/index';
import prisma from '../src/lib/prisma';

describe('Health and System Endpoints', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/v1/health should return 200 with operational database status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('operational');
    expect(res.body.data.database.engine).toBe('SQLite');
    expect(res.body.data.database.status).toBe('healthy');
    expect(res.body.data.postQuantumStandards).toContain('NIST FIPS 203 (ML-KEM)');
  });

  it('GET /api/v1/system/rules should return active NIST post-quantum rules', async () => {
    const res = await request(app).get('/api/v1/system/rules');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.engineVersion).toBe('2024.1-NIST-FIPS');
    expect(res.body.data.standards.length).toBeGreaterThanOrEqual(4);
  });
});

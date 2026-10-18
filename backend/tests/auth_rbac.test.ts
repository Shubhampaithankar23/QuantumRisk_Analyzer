import request from 'supertest';
import app from '../src/index';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateToken, AuthUser } from '../src/middleware/auth';

describe('Phase 1: Data Models, Auth & RBAC Authorization Suite', () => {
  let instA: any;
  let instB: any;
  let adminUser: any;
  let analystUser: any;
  let viewerUser: any;
  let crossInstUser: any;

  let adminToken: string;
  let analystToken: string;
  let viewerToken: string;
  let crossInstToken: string;

  beforeAll(async () => {
    // Setup test institutions
    instA = await prisma.institution.create({
      data: {
        name: 'Institution Alpha Test',
        domain: 'alpha-test.edu',
        type: 'UNIVERSITY',
      },
    });

    instB = await prisma.institution.create({
      data: {
        name: 'Institution Beta Test',
        domain: 'beta-test.edu',
        type: 'RESEARCH_INSTITUTION',
      },
    });

    const hash = await bcrypt.hash('TestPassword@123', 8);

    // Admin user (Institution A)
    adminUser = await prisma.user.create({
      data: {
        email: `admin-${Date.now()}@alpha-test.edu`,
        name: 'Admin Alpha',
        passwordHash: hash,
        role: 'ADMIN',
        institutionId: instA.id,
      },
    });

    // Analyst user (Institution A)
    analystUser = await prisma.user.create({
      data: {
        email: `analyst-${Date.now()}@alpha-test.edu`,
        name: 'Analyst Alpha',
        passwordHash: hash,
        role: 'ANALYST',
        institutionId: instA.id,
      },
    });

    // Viewer user (Institution A)
    viewerUser = await prisma.user.create({
      data: {
        email: `viewer-${Date.now()}@alpha-test.edu`,
        name: 'Viewer Alpha',
        passwordHash: hash,
        role: 'VIEWER',
        institutionId: instA.id,
      },
    });

    // Cross-institution user (Institution B)
    crossInstUser = await prisma.user.create({
      data: {
        email: `cross-${Date.now()}@beta-test.edu`,
        name: 'Analyst Beta',
        passwordHash: hash,
        role: 'ANALYST',
        institutionId: instB.id,
      },
    });

    adminToken = generateToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: 'ADMIN',
      institutionId: instA.id,
    });

    analystToken = generateToken({
      id: analystUser.id,
      email: analystUser.email,
      name: analystUser.name,
      role: 'ANALYST',
      institutionId: instA.id,
    });

    viewerToken = generateToken({
      id: viewerUser.id,
      email: viewerUser.email,
      name: viewerUser.name,
      role: 'VIEWER',
      institutionId: instA.id,
    });

    crossInstToken = generateToken({
      id: crossInstUser.id,
      email: crossInstUser.email,
      name: crossInstUser.name,
      role: 'ANALYST',
      institutionId: instB.id,
    });
  });

  afterAll(async () => {
    // Clean up created test entities
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUser.id, analystUser.id, viewerUser.id, crossInstUser.id] },
      },
    });
    await prisma.institution.deleteMany({
      where: { id: { in: [instA.id, instB.id] } },
    });
    await prisma.$disconnect();
  });

  describe('1. Authentication & Token Verification', () => {
    it('should reject unauthenticated request with 401 and structured code UNAUTHORIZED', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('x-enforce-auth', 'true');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(res.body.message).toContain('Access denied');
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid or forged token with 403 and code FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-jwt-forged-token-value');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.message).toContain('Invalid or expired');
      expect(res.body.success).toBe(false);
    });

    it('should authenticate valid JWT token and return user profile', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(analystUser.email);
      expect(res.body.data.role).toBe('ANALYST');
    });
  });

  describe('2. Structured Error Envelope { code, message, details }', () => {
    it('should return VALIDATION_ERROR with structured details array on invalid Zod input', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: '123' }); // Invalid email and short password

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('Validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBeGreaterThan(0);
      expect(res.body.details[0]).toHaveProperty('field');
      expect(res.body.details[0]).toHaveProperty('message');
    });
  });

  describe('3. Role-Based Access Control (RBAC)', () => {
    it('ADMIN role can access admin endpoints', async () => {
      const res = await request(app)
        .post('/api/v1/auth/seed-demo')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('ANALYST role can read dashboard stats', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('VIEWER role can read assets', async () => {
      const res = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('4. New Database Models: ScanCheck and Evidence Verification', () => {
    it('should create and query ScanCheck model in SQLite with foreign relations', async () => {
      const job = await prisma.scanJob.create({
        data: {
          targetHost: 'scancheck-test.apex.edu',
          port: 443,
          status: 'QUEUED',
          authorizationConfirmed: true,
          authorizedBy: 'Tester',
        },
      });

      const check = await prisma.scanCheck.create({
        data: {
          scanJobId: job.id,
          checkName: 'TLS_VERSIONS',
          checkType: 'TLS',
          status: 'SUCCESS',
          observedData: JSON.stringify({ supported: ['TLSv1.2', 'TLSv1.3'], negotiated: 'TLSv1.3' }),
          durationMs: 45,
        },
      });

      expect(check.id).toBeDefined();
      expect(check.scanJobId).toBe(job.id);
      expect(check.checkName).toBe('TLS_VERSIONS');

      // Clean up
      await prisma.scanJob.delete({ where: { id: job.id } });
    });

    it('should create and query Evidence model with direct Finding relation', async () => {
      const asset = await prisma.asset.create({
        data: {
          name: 'Evidence Test Host',
          identifier: 'evidence-test.apex.edu',
          assetType: 'WEBSITE',
          institutionId: instA.id,
          dataSensitivity: 'CONFIDENTIAL',
        },
      });

      const evidence = await prisma.evidence.create({
        data: {
          assetId: asset.id,
          evidenceSource: 'scanner_verified',
          evidenceType: 'X509_CERTIFICATE',
          observedProperty: 'cert_pub_key_algo',
          observedValue: 'RSA-2048',
          scannerVersion: 'SSLyze-6.3.1',
          verifiedAt: new Date(),
          hashDigest: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        },
      });

      expect(evidence.id).toBeDefined();
      expect(evidence.observedValue).toBe('RSA-2048');
      expect(evidence.evidenceSource).toBe('scanner_verified');

      const finding = await prisma.finding.create({
        data: {
          assetId: asset.id,
          evidenceId: evidence.id,
          title: 'Quantum Vulnerable RSA Key Size',
          algorithmOrConfig: 'RSA-2048',
          observedValue: 'RSA-2048',
          purpose: 'DIGITAL_SIGNATURE',
          riskLevel: 'HIGH',
          riskReason: 'Shor algorithm vulnerability',
          evidenceSource: 'scanner_verified',
          standardRef: 'NIST FIPS 204',
        },
      });

      expect(finding.evidenceId).toBe(evidence.id);

      // Verify relation fetch
      const fetchedFinding = await prisma.finding.findUnique({
        where: { id: finding.id },
        include: { evidence: true },
      });

      expect(fetchedFinding?.evidence?.observedValue).toBe('RSA-2048');
      expect(fetchedFinding?.evidence?.scannerVersion).toBe('SSLyze-6.3.1');

      // Clean up
      await prisma.asset.delete({ where: { id: asset.id } });
    });
  });
});

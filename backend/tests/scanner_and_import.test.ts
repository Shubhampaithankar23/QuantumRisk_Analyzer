import { isPrivateOrReservedIp, validateScanTarget, validateRedirectChain } from '../src/services/scanner.service';
import { normalizeAssetType, normalizeSensitivity } from '../src/services/import.service';
import prisma from '../src/lib/prisma';
import request from 'supertest';
import app from '../src/index';

describe('Phase 2: Safe Scanner & SSRF Defense Suite', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Comprehensive IP Filter & SSRF Defenses', () => {
    it('should block RFC1918 private IPv4 addresses', () => {
      expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('10.254.10.5')).toBe(true);
      expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.31.255.255')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.100.254')).toBe(true);
    });

    it('should block loopback and zero addresses', () => {
      expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('127.1.2.3')).toBe(true);
      expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true);
    });

    it('should block AWS / Cloud metadata and Link-Local addresses', () => {
      expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true); // Cloud metadata
      expect(isPrivateOrReservedIp('169.254.1.1')).toBe(true); // Link-local
    });

    it('should block Carrier-Grade NAT (CGNAT 100.64.0.0/10)', () => {
      expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('100.64.127.254')).toBe(true);
    });

    it('should block Documentation / Test-Net ranges and Multicast', () => {
      expect(isPrivateOrReservedIp('192.0.2.1')).toBe(true); // TEST-NET-1
      expect(isPrivateOrReservedIp('198.51.100.1')).toBe(true); // TEST-NET-2
      expect(isPrivateOrReservedIp('203.0.113.1')).toBe(true); // TEST-NET-3
      expect(isPrivateOrReservedIp('224.0.0.1')).toBe(true); // Multicast
      expect(isPrivateOrReservedIp('240.0.0.1')).toBe(true); // Reserved
    });

    it('should block IPv6 loopback, link-local, unique local, and IPv4-mapped IPv6', () => {
      expect(isPrivateOrReservedIp('::1')).toBe(true);
      expect(isPrivateOrReservedIp('::')).toBe(true);
      expect(isPrivateOrReservedIp('fe80::1')).toBe(true); // Link local
      expect(isPrivateOrReservedIp('fc00::1')).toBe(true); // Unique local
      expect(isPrivateOrReservedIp('fd12:3456:789a::1')).toBe(true); // Unique local
      expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true); // IPv4-mapped loopback
      expect(isPrivateOrReservedIp('::ffff:169.254.169.254')).toBe(true); // IPv4-mapped cloud metadata
      expect(isPrivateOrReservedIp('::ffff:10.0.0.1')).toBe(true); // IPv4-mapped private
    });

    it('should permit valid public IP addresses', () => {
      expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
      expect(isPrivateOrReservedIp('142.250.190.46')).toBe(false);
    });
  });

  describe('2. Hostname Validation & Port Guard', () => {
    it('should reject localhost, IP literals, and internal domain suffixes', async () => {
      await expect(validateScanTarget('localhost')).rejects.toThrow(/strictly prohibited/);
      await expect(validateScanTarget('127.0.0.1')).rejects.toThrow(/Must be a fully-qualified domain name/);
      await expect(validateScanTarget('database.local')).rejects.toThrow(/strictly prohibited/);
      await expect(validateScanTarget('auth.internal')).rejects.toThrow(/strictly prohibited/);
      await expect(validateScanTarget('router.lan')).rejects.toThrow(/strictly prohibited/);
      await expect(validateScanTarget('nas.home')).rejects.toThrow(/strictly prohibited/);
    });

    it('should reject unauthorized ports and permit only 443 / 8443', async () => {
      await expect(validateScanTarget('example.com', 22)).rejects.toThrow(/Port 22 is not permitted/);
      await expect(validateScanTarget('example.com', 80)).rejects.toThrow(/Port 80 is not permitted/);
      await expect(validateScanTarget('example.com', 8080)).rejects.toThrow(/Port 8080 is not permitted/);
    });
  });

  describe('3. Redirect Chain Validation', () => {
    it('should reject non-HTTPS schemes immediately', async () => {
      await expect(validateRedirectChain('http://google.com')).rejects.toThrow(
        /Only HTTPS connections are permitted/
      );
      await expect(validateRedirectChain('ftp://files.example.com')).rejects.toThrow(
        /Only HTTPS connections are permitted/
      );
    });

    it('should reject redirects to private IP or internal targets', async () => {
      await expect(validateRedirectChain('https://localhost')).rejects.toThrow(/strictly prohibited/);
    });
  });

  describe('4. Scan Authorization Consent Audit Logging', () => {
    it('should enforce confirmAuthorized: true and record consent in AuditLog', async () => {
      // Must fail when confirmAuthorized is false
      const unauthRes = await request(app)
        .post('/api/v1/scans')
        .send({
          targetHost: 'example.com',
          port: 443,
          confirmAuthorized: false,
        });

      expect(unauthRes.status).toBe(400);

      // Must succeed and record audit log consent when authorized
      const authRes = await request(app)
        .post('/api/v1/scans')
        .send({
          targetHost: 'example.com',
          port: 443,
          confirmAuthorized: true,
        });

      expect([200, 201]).toContain(authRes.status);
      expect(authRes.body.success).toBe(true);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'SCAN_AUTHORIZATION_CONSENT',
          entityId: authRes.body.data.scanJobId,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('SCAN_AUTHORIZATION_CONSENT');
      const details = JSON.parse(auditLog?.details || '{}');
      expect(details.authorizationConfirmed).toBe(true);
      expect(details.targetHost).toBe('example.com');

      // Verify ScanCheck records were created
      const checks = await prisma.scanCheck.findMany({
        where: { scanJobId: authRes.body.data.scanJobId },
      });
      expect(checks.length).toBeGreaterThanOrEqual(1);

      // Verify Evidence records were created
      const evidence = await prisma.evidence.findMany({
        where: { scanJobId: authRes.body.data.scanJobId },
      });
      expect(evidence.length).toBeGreaterThanOrEqual(1);
      expect(evidence[0].evidenceSource).toBe('scanner_verified');
      expect(evidence[0].hashDigest).toBeDefined();

      // Clean up test scan job
      await prisma.scanJob.delete({ where: { id: authRes.body.data.scanJobId } });
    });
  });

  describe('5. Bulk Import Normalization', () => {
    it('should correctly normalize asset categories', () => {
      expect(normalizeAssetType('web application')).toBe('WEBSITE');
      expect(normalizeAssetType('database server')).toBe('DATABASE');
      expect(normalizeAssetType('ssl certificate')).toBe('DIGITAL_CERTIFICATE');
      expect(normalizeAssetType('s3 archive backup')).toBe('STORAGE_BACKUP');
      expect(normalizeAssetType('rest api')).toBe('APPLICATION');
    });

    it('should correctly normalize sensitivity ratings', () => {
      expect(normalizeSensitivity('hipaa regulated')).toBe('REGULATED');
      expect(normalizeSensitivity('secret / classified')).toBe('HIGHLY_SENSITIVE');
      expect(normalizeSensitivity('confidential')).toBe('CONFIDENTIAL');
      expect(normalizeSensitivity('internal only')).toBe('INTERNAL');
      expect(normalizeSensitivity('public website')).toBe('PUBLIC');
    });
  });
});

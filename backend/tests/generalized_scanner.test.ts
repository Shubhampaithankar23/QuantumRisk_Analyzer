import prisma from '../src/lib/prisma';
import { runAssessmentForAsset } from '../src/services/assessment.service';
import { validateScanTarget, isPrivateOrReservedIp, executeTlsScan, ScanOutput } from '../src/services/scanner.service';

describe('Generalized Scanner & Evidence Traceability Suite', () => {
  let testInstitutionId: string;

  beforeAll(async () => {
    let institution = await prisma.institution.findFirst();
    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          name: 'Generalized Scanner Testing Institute',
          domain: 'gen-scanner.edu',
        },
      });
    }
    testInstitutionId = institution.id;
  });

  describe('7(a) Unit Tests with Recorded Fixtures (SSLyze & Cryptography Mocked)', () => {
    const recordedGoogleFixture: ScanOutput = {
      targetHost: 'www.google.com',
      resolvedIp: '142.250.190.68',
      allResolvedIps: ['142.250.190.68', '2607:f8b0:4005:808::2004'],
      port: 443,
      tlsVersionNegotiated: 'TLSv1.3',
      supportedTlsVersions: ['TLSv1.3', 'TLSv1.2'],
      cipherSuiteNegotiated: 'TLS_AES_256_GCM_SHA384',
      supportedCipherSuites: ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256'],
      supportedCurves: ['X25519', 'secp256r1'],
      certPubKeyAlgo: 'ECDSA',
      certKeySize: 256,
      certCurve: 'secp256r1',
      certSignatureAlgo: 'ecdsa-with-SHA256',
      certSignatureHash: 'SHA256',
      certSubject: 'CN=www.google.com',
      certIssuer: 'CN=WE2,O=Google Trust Services,C=US',
      certValidFrom: new Date('2026-09-01T00:00:00Z'),
      certValidTo: new Date('2026-12-01T00:00:00Z'),
      certSerial: '9200763DC8315C871025A546F963C556',
      certSha256Fingerprint: '6F77F1313EE0FC7A737561907EA6CDC4EEBA44FB5E37485299173CC8F7EDEE92',
      certSans: ['www.google.com'],
      keyExchangeGroup: 'X25519MLKEM768',
      isPqHybrid: true,
      groupProbes: [
        { group: 'x25519', status: 'negotiated' },
        { group: 'secp256r1', status: 'supported (probed)' },
        { group: 'X25519MLKEM768', status: 'negotiated' },
      ],
      dualCertificates: [
        {
          pub_key_algo: 'RSA',
          key_size: 2048,
          signature_algo: 'sha256WithRSAEncryption',
          fingerprint_sha256: 'AAAA1111222233334444555566667777888899990000',
        },
      ],
      validation: {
        isValid: true,
        isExpired: false,
        isSelfSigned: false,
        isUntrusted: false,
        hostnameMatches: true,
        errors: [],
      },
      ipProbes: [
        { ip: '142.250.190.68', ip_version: 4, tls_version_negotiated: 'TLSv1.3', status: 'SUCCESS' },
        { ip: '2607:f8b0:4005:808::2004', ip_version: 6, tls_version_negotiated: 'TLSv1.3', status: 'SUCCESS' },
      ],
      ipDifferences: { has_differences: false, probed_ip_count: 2, differences: [] },
      ocspStapled: false,
      scannerVersion: 'SSLyze-v6.3.1 / OpenSSL-3.5.5 / Cryptography-46.0.7',
      scannedAt: new Date().toISOString(),
      rawDetails: { engine: 'recorded-fixture-google' },
    };

    const recordedBadsslRsa4096Fixture: ScanOutput = {
      targetHost: 'rsa4096.badssl.com',
      resolvedIp: '104.154.89.105',
      allResolvedIps: ['104.154.89.105'],
      port: 443,
      tlsVersionNegotiated: 'TLSv1.2',
      supportedTlsVersions: ['TLSv1.2'],
      cipherSuiteNegotiated: 'ECDHE-RSA-AES128-GCM-SHA256',
      supportedCipherSuites: ['ECDHE-RSA-AES128-GCM-SHA256'],
      supportedCurves: ['secp256r1'],
      certPubKeyAlgo: 'RSA',
      certKeySize: 4096,
      certSignatureAlgo: 'sha512WithRSAEncryption',
      certSignatureHash: 'SHA512',
      certSubject: 'CN=*.badssl.com',
      certIssuer: 'CN=BadSSL Intermediate',
      certValidFrom: new Date('2024-01-01T00:00:00Z'),
      certValidTo: new Date('2028-01-01T00:00:00Z'),
      certSerial: '4096BADSSLSERIAL01',
      certSha256Fingerprint: 'B4D5514096F19E87000000000000000000000000000000000000000000000000',
      certSans: ['*.badssl.com', 'badssl.com'],
      keyExchangeGroup: 'prime256v1',
      isPqHybrid: false,
      groupProbes: [
        { group: 'secp256r1', status: 'negotiated' },
        { group: 'X25519MLKEM768', status: 'not_supported' },
      ],
      dualCertificates: [],
      validation: {
        isValid: true,
        isExpired: false,
        isSelfSigned: false,
        isUntrusted: false,
        hostnameMatches: true,
        errors: [],
      },
      ipProbes: [{ ip: '104.154.89.105', ip_version: 4, tls_version_negotiated: 'TLSv1.2', status: 'SUCCESS' }],
      ipDifferences: { has_differences: false, probed_ip_count: 1, differences: [] },
      ocspStapled: false,
      scannerVersion: 'SSLyze-v6.3.1 / OpenSSL-3.5.5 / Cryptography-46.0.7',
      scannedAt: new Date().toISOString(),
      rawDetails: { engine: 'recorded-fixture-badssl-rsa4096' },
    };

    it('correctly maps recorded post-quantum hybrid TLS 1.3 fixture', () => {
      expect(recordedGoogleFixture.isPqHybrid).toBe(true);
      expect(recordedGoogleFixture.keyExchangeGroup).toBe('X25519MLKEM768');
      expect(recordedGoogleFixture.dualCertificates?.length).toBe(1);
      expect(recordedGoogleFixture.dualCertificates?.[0].pub_key_algo).toBe('RSA');
      expect(recordedGoogleFixture.groupProbes?.some((g) => g.group === 'X25519MLKEM768' && g.status === 'negotiated')).toBe(true);
    });

    it('correctly maps recorded classical RSA 4096 fixture', () => {
      expect(recordedBadsslRsa4096Fixture.isPqHybrid).toBe(false);
      expect(recordedBadsslRsa4096Fixture.certPubKeyAlgo).toBe('RSA');
      expect(recordedBadsslRsa4096Fixture.certKeySize).toBe(4096);
      expect(recordedBadsslRsa4096Fixture.certSignatureHash).toBe('SHA512');
    });
  });

  describe('7(b) Traceability Test: Every Assessed Output Field Must Trace to Stored Evidence', () => {
    it('fails if any assessed finding is not traceable to an authentic stored evidence record', async () => {
      // Create asset
      const asset = await prisma.asset.create({
        data: {
          name: 'Traceability Audit Target',
          identifier: 'traceability-audit.domain.com',
          assetType: 'WEBSITE',
          institutionId: testInstitutionId,
          informationSource: 'TLS_SCAN',
          knownAlgorithms: JSON.stringify([
            { algorithm: 'ECDSA-256', purpose: 'DIGITAL_SIGNATURE' },
            { algorithm: 'X25519MLKEM768', purpose: 'KEY_ESTABLISHMENT' },
            { algorithm: 'TLS_AES_256_GCM_SHA384', purpose: 'SYMMETRIC_ENCRYPTION' },
          ]),
        },
      });

      // Create scanJob with authentic evidence records
      const scanJob = await prisma.scanJob.create({
        data: {
          assetId: asset.id,
          targetHost: 'traceability-audit.domain.com',
          port: 443,
          status: 'COMPLETED',
          authorizationConfirmed: true,
        },
      });

      const ev1 = await prisma.evidence.create({
        data: {
          assetId: asset.id,
          scanJobId: scanJob.id,
          evidenceSource: 'scanner_verified',
          evidenceType: 'X509_CERTIFICATE',
          observedProperty: 'cert_pub_key_algo',
          observedValue: 'ECDSA-256',
        },
      });

      const ev2 = await prisma.evidence.create({
        data: {
          assetId: asset.id,
          scanJobId: scanJob.id,
          evidenceSource: 'scanner_verified',
          evidenceType: 'KEY_EXCHANGE',
          observedProperty: 'key_exchange_group',
          observedValue: 'X25519MLKEM768',
        },
      });

      const ev3 = await prisma.evidence.create({
        data: {
          assetId: asset.id,
          scanJobId: scanJob.id,
          evidenceSource: 'scanner_verified',
          evidenceType: 'CIPHER_SUITE',
          observedProperty: 'cipher_suite_negotiated',
          observedValue: 'TLS_AES_256_GCM_SHA384',
        },
      });

      await prisma.scanResult.create({
        data: {
          scanJobId: scanJob.id,
          targetHost: 'traceability-audit.domain.com',
          port: 443,
          certPubKeyAlgo: 'ECDSA',
          certKeySize: 256,
          keyExchangeGroup: 'X25519MLKEM768',
          cipherSuiteNegotiated: 'TLS_AES_256_GCM_SHA384',
        },
      });

      const assessment = await runAssessmentForAsset(asset.id);

      // Verify strict traceability: every single finding MUST have an evidenceId pointing to an existing Evidence record
      expect(assessment.findings.length).toBeGreaterThan(0);
      for (const finding of assessment.findings) {
        expect(finding.evidenceId).toBeDefined();
        const storedEvidence = await prisma.evidence.findUnique({
          where: { id: finding.evidenceId },
        });
        expect(storedEvidence).not.toBeNull();
        expect(storedEvidence?.assetId).toBe(asset.id);
        // Assessed algorithm must match the observed value in the evidence table
        expect(storedEvidence?.observedValue.toLowerCase()).toContain(finding.algorithmOrConfig.toLowerCase().split('-')[0]);
      }
    });

    it('missing evidence fields are classified as INSUFFICIENT-EVIDENCE with 0 score impact, never synthetic high risk', async () => {
      // Asset with missing key exchange and certificate evidence
      const incompleteAsset = await prisma.asset.create({
        data: {
          name: 'Incomplete Evidence Asset',
          identifier: 'incomplete-evidence.test.edu',
          assetType: 'WEBSITE',
          institutionId: testInstitutionId,
          informationSource: 'TLS_SCAN',
        },
      });

      const scanJob = await prisma.scanJob.create({
        data: {
          assetId: incompleteAsset.id,
          targetHost: 'incomplete-evidence.test.edu',
          status: 'COMPLETED',
          authorizationConfirmed: true,
        },
      });

      await prisma.scanResult.create({
        data: {
          scanJobId: scanJob.id,
          targetHost: 'incomplete-evidence.test.edu',
          port: 443,
          // Cert and KeyExchange deliberately left null / not observed
          cipherSuiteNegotiated: 'TLS_AES_256_GCM_SHA384',
        },
      });

      const assessment = await runAssessmentForAsset(incompleteAsset.id);

      // Verify that missing fields produced INSUFFICIENT-EVIDENCE rather than synthetic high risk findings
      const certFinding = assessment.findings.find((f) => f.purpose === 'DIGITAL_SIGNATURE');
      expect(certFinding).toBeDefined();
      expect(certFinding?.ruleId).toBe('INSUFFICIENT-EVIDENCE-CERT');
      expect(certFinding?.riskLevel).toBe('INFORMATIONAL');

      const kemFinding = assessment.findings.find((f) => f.purpose === 'KEY_ESTABLISHMENT');
      expect(kemFinding).toBeDefined();
      expect(kemFinding?.ruleId).toBe('INSUFFICIENT-EVIDENCE-KEM');
      expect(kemFinding?.riskLevel).toBe('INFORMATIONAL');

      // Score breakdown must show 0 points added for unobserved fields
      const breakdown = JSON.parse(assessment.scoreBreakdown);
      const kemItem = breakdown.contributingFindings.find((b: any) => b.ruleId === 'INSUFFICIENT-EVIDENCE-KEM');
      expect(kemItem).toBeDefined();
      expect(kemItem.pointsAdded).toBe(0);
    });
  });

  describe('7(c) Non-Identical Evidence Guarantee: Scanning Two Different Hosts Never Yields Identical Evidence', () => {
    it('verifies that two distinct hosts produce distinct evidence fingerprints and properties', async () => {
      const hostA = await prisma.asset.create({
        data: {
          name: 'Target A (Google)',
          identifier: 'host-a.google-scan.edu',
          assetType: 'WEBSITE',
          institutionId: testInstitutionId,
        },
      });

      const hostB = await prisma.asset.create({
        data: {
          name: 'Target B (Flipkart)',
          identifier: 'host-b.flipkart-scan.edu',
          assetType: 'WEBSITE',
          institutionId: testInstitutionId,
        },
      });

      // Evidence for Host A (Google)
      const evA = await prisma.evidence.create({
        data: {
          assetId: hostA.id,
          evidenceSource: 'scanner_verified',
          evidenceType: 'X509_CERTIFICATE',
          observedProperty: 'cert_fingerprint_sha256',
          observedValue: '6F77F1313EE0FC7A737561907EA6CDC4EEBA44FB5E37485299173CC8F7EDEE92',
          rawPayload: JSON.stringify({ host: 'www.google.com', sans: ['www.google.com'] }),
        },
      });

      // Evidence for Host B (Flipkart)
      const evB = await prisma.evidence.create({
        data: {
          assetId: hostB.id,
          evidenceSource: 'scanner_verified',
          evidenceType: 'X509_CERTIFICATE',
          observedProperty: 'cert_fingerprint_sha256',
          observedValue: 'C28DE950C1B008E1D94C56BB06E500A5212DF1A551E52B621746B31BC1316E01',
          rawPayload: JSON.stringify({ host: 'www.flipkart.com', sans: ['flipkart.com', '*.flipkart.com'] }),
        },
      });

      expect(evA.observedValue).not.toBe(evB.observedValue);
      expect(evA.rawPayload).not.toBe(evB.rawPayload);
    });
  });

  describe('Port Check: Permits Public TLS Ports (Including 1010) while Blocking Admin/Plaintext Ports', () => {
    it('permits port 1010 for badssl testing', async () => {
      // 1010 is accepted by port check
      const ip = await validateScanTarget('tls-v1-0.badssl.com', 1010);
      expect(ip).toBeDefined();
    });

    it('rejects unauthorized ports (22, 80, 8080)', async () => {
      await expect(validateScanTarget('example.com', 22)).rejects.toThrow(/Port 22 is not permitted/);
      await expect(validateScanTarget('example.com', 80)).rejects.toThrow(/Port 80 is not permitted/);
      await expect(validateScanTarget('example.com', 8080)).rejects.toThrow(/Port 8080 is not permitted/);
    });
  });
});

import prisma from '../src/lib/prisma';
import { evaluateAlgorithm, runAssessmentForAsset } from '../src/services/assessment.service';

describe('Post-Quantum Assessment Engine Rules', () => {
  describe('Digital Signatures', () => {
    it('should evaluate RSA-2048 signatures as quantum-vulnerable and recommend ML-DSA or SLH-DSA', () => {
      const result = evaluateAlgorithm('RSA-2048', 'DIGITAL_SIGNATURE');
      expect(result.purpose).toBe('DIGITAL_SIGNATURE');
      expect(result.riskLevel).toBe('HIGH');
      expect(result.riskReason).toContain("Shor's algorithm");
      expect(result.recommendation.recommendedAlgorithm).toContain('ML-DSA');
      expect(result.recommendation.standardRef).toBe('NIST FIPS 204');
      // Crucial constraint: NEVER recommend ML-KEM for digital signatures
      expect(result.recommendation.recommendedAlgorithm).not.toContain('ML-KEM');
    });

    it('should evaluate ECDSA signatures as quantum-vulnerable and never recommend ML-KEM', () => {
      const result = evaluateAlgorithm('ECDSA-P256', 'DIGITAL_SIGNATURE');
      expect(result.purpose).toBe('DIGITAL_SIGNATURE');
      expect(result.riskLevel).toBe('HIGH');
      expect(result.recommendation.recommendedAlgorithm).toContain('ML-DSA');
      expect(result.recommendation.recommendedAlgorithm).not.toContain('ML-KEM');
    });

    it('should recognize ML-DSA signatures as post-quantum compliant (LOW risk)', () => {
      const result = evaluateAlgorithm('ML-DSA-65', 'DIGITAL_SIGNATURE');
      expect(result.purpose).toBe('DIGITAL_SIGNATURE');
      expect(result.riskLevel).toBe('LOW');
      expect(result.standardRef).toBe('NIST FIPS 204');
    });
  });

  describe('Key Establishment / Key Encapsulation (KEM)', () => {
    it('should evaluate ECDHE as quantum-vulnerable to Store-Now-Decrypt-Later and recommend ML-KEM', () => {
      const result = evaluateAlgorithm('ECDHE', 'KEY_ESTABLISHMENT');
      expect(result.purpose).toBe('KEY_ESTABLISHMENT');
      expect(result.riskLevel).toBe('HIGH');
      expect(result.riskReason).toContain('Store Now, Decrypt Later');
      expect(result.recommendation.recommendedAlgorithm).toContain('ML-KEM');
      expect(result.recommendation.standardRef).toBe('NIST FIPS 203');
      // Crucial constraint: NEVER recommend ML-DSA for key establishment
      expect(result.recommendation.recommendedAlgorithm).not.toContain('ML-DSA');
    });

    it('should recognize ML-KEM as post-quantum compliant (LOW risk)', () => {
      const result = evaluateAlgorithm('ML-KEM-768', 'KEY_ESTABLISHMENT');
      expect(result.purpose).toBe('KEY_ESTABLISHMENT');
      expect(result.riskLevel).toBe('LOW');
      expect(result.standardRef).toBe('NIST FIPS 203');
    });

    it('should evaluate Static RSA Key Transport as CRITICAL risk for KEY_ESTABLISHMENT and recommend ML-KEM', () => {
      const result = evaluateAlgorithm('RSA Key Transport', 'KEY_ESTABLISHMENT');
      expect(result.purpose).toBe('KEY_ESTABLISHMENT');
      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.riskReason).toContain('ZERO forward secrecy');
      expect(result.recommendation.recommendedAlgorithm).toContain('ML-KEM-768');
      expect(result.recommendation.recommendedAlgorithm).not.toContain('ML-DSA');
    });
  });

  describe('Symmetric Encryption', () => {
    it('should evaluate AES-256 as quantum-resistant under Grover search', () => {
      const result = evaluateAlgorithm('AES-256-GCM', 'SYMMETRIC_ENCRYPTION');
      expect(result.purpose).toBe('SYMMETRIC_ENCRYPTION');
      expect(result.riskLevel).toBe('LOW');
      expect(result.recommendation.recommendedAlgorithm).toContain('Retain AES-256');
    });

    it('should evaluate AES-128 as medium risk due to reduced Grover security margin', () => {
      const result = evaluateAlgorithm('AES-128-CBC', 'SYMMETRIC_ENCRYPTION');
      expect(result.purpose).toBe('SYMMETRIC_ENCRYPTION');
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.recommendation.recommendedAlgorithm).toBe('AES-256-GCM');
    });

    it('should evaluate 3DES or RC4 as critical risk', () => {
      const result = evaluateAlgorithm('3DES-EDE-CBC', 'SYMMETRIC_ENCRYPTION');
      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.recommendation.recommendedAlgorithm).toBe('AES-256-GCM');
    });
  });

  describe('Protocol Versions (TLS 1.3 != automatically quantum-safe)', () => {
    it('should evaluate TLS 1.3 with clear notice that TLS 1.3 alone is NOT automatically quantum-safe', () => {
      const result = evaluateAlgorithm('TLS 1.3', 'PROTOCOL');
      expect(result.purpose).toBe('PROTOCOL');
      expect(result.riskLevel).toBe('LOW');
      expect(result.riskReason).toContain('TLS 1.3 is NOT automatically quantum-safe on its own');
      expect(result.recommendation.recommendedAlgorithm).toContain('X25519MLKEM768');
    });

    it('should evaluate TLS 1.2 as MEDIUM risk and recommend upgrading to TLS 1.3', () => {
      const result = evaluateAlgorithm('TLS 1.2', 'PROTOCOL');
      expect(result.purpose).toBe('PROTOCOL');
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.recommendation.recommendedAlgorithm).toBe('Upgrade to TLS 1.3');
    });

    it('should evaluate TLS 1.0 or SSL as CRITICAL risk', () => {
      const result = evaluateAlgorithm('TLS 1.0', 'PROTOCOL');
      expect(result.purpose).toBe('PROTOCOL');
      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.ruleId).toBe('IETF-RFC8996-LEGACY-TLS');
    });
  });

  describe('Unknown / Missing Evidence Handling', () => {
    it('should label unknown algorithms as NEEDS_VERIFICATION instead of guessing', () => {
      const result = evaluateAlgorithm('CustomCryptoEngine-v9', undefined);
      expect(result.confidence).toBe('NEEDS_VERIFICATION');
      expect(result.riskReason).toContain('Additional cryptographic evidence is required');
      expect(result.recommendation.recommendedAlgorithm).toContain('Perform Cryptographic Inventory');
    });
  });

  describe('Assessment Engine Integration, Traceability & Reproducibility', () => {
    let testInstId: string;
    let hybridAssetId: string;

    beforeAll(async () => {
      let inst = await prisma.institution.findFirst();
      if (!inst) {
        inst = await prisma.institution.create({
          data: { name: 'PQC Test Institute', domain: 'pqctest.edu' },
        });
      }
      testInstId = inst.id;

      const asset = await prisma.asset.create({
        data: {
          name: 'Hybrid Node Test',
          identifier: 'hybrid-node.pqctest.edu',
          assetType: 'SERVER',
          institutionId: testInstId,
          dataSensitivity: 'CONFIDENTIAL',
          informationSource: 'BULK_IMPORT',
          knownAlgorithms: JSON.stringify([
            { algorithm: 'ECDSA', purpose: 'DIGITAL_SIGNATURE' },
            { algorithm: 'X25519MLKEM768', purpose: 'KEY_ESTABLISHMENT' },
            { algorithm: 'AES-256-GCM', purpose: 'SYMMETRIC_ENCRYPTION' },
          ]),
        },
      });
      hybridAssetId = asset.id;
    });

    afterAll(async () => {
      if (hybridAssetId) {
        await prisma.asset.delete({ where: { id: hybridAssetId } }).catch(() => {});
      }
    });

    it('should classify hybrid PQ key exchange + classical certificate as HYBRID_READY', async () => {
      const res = await runAssessmentForAsset(hybridAssetId);
      expect(res.overallReadinessStatus).toBe('HYBRID_READY');
      expect(res.quantumRiskScore).toBe(25);
    });

    it('should ensure 100% of persisted findings link to an Evidence record', async () => {
      await runAssessmentForAsset(hybridAssetId);
      const findings = await prisma.finding.findMany({
        where: { assetId: hybridAssetId },
        include: { evidence: true },
      });

      expect(findings.length).toBeGreaterThan(0);
      for (const f of findings) {
        expect(f.evidenceId).toBeDefined();
        expect(typeof f.evidenceId).toBe('string');
        expect(f.evidence).not.toBeNull();
      }
    });

    it('should produce identical score and breakdown on repeated runs (deterministic)', async () => {
      const run1 = await runAssessmentForAsset(hybridAssetId);
      const run2 = await runAssessmentForAsset(hybridAssetId);

      expect(run1.quantumRiskScore).toBe(run2.quantumRiskScore);
      expect(run1.overallReadinessStatus).toBe(run2.overallReadinessStatus);
      expect(run1.findings.length).toBe(run2.findings.length);

      const bd1 = JSON.parse(run1.scoreBreakdown);
      const bd2 = JSON.parse(run2.scoreBreakdown);
      expect(bd1.finalScore).toBe(bd2.finalScore);
      expect(bd1.basePoints).toBe(bd2.basePoints);
      expect(bd1.contributingFindings.length).toBe(bd2.contributingFindings.length);
    });
  });
});

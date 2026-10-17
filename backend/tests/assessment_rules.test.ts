import { evaluateAlgorithm } from '../src/services/assessment.service';

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

  describe('Unknown / Missing Evidence Handling', () => {
    it('should label unknown algorithms as NEEDS_VERIFICATION instead of guessing', () => {
      const result = evaluateAlgorithm('CustomCryptoEngine-v9', undefined);
      expect(result.confidence).toBe('NEEDS_VERIFICATION');
      expect(result.riskReason).toContain('Additional cryptographic evidence is required');
      expect(result.recommendation.recommendedAlgorithm).toContain('Perform Cryptographic Inventory');
    });
  });
});

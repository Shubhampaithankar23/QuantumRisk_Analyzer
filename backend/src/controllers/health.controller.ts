import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getHealth = async (req: Request, res: Response) => {
  let dbStatus = 'healthy';
  let latencyMs = 0;

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    latencyMs = Date.now() - start;
  } catch (error) {
    dbStatus = 'unreachable';
    console.error('Database health check failed:', error);
  }

  res.status(dbStatus === 'healthy' ? 200 : 503).json({
    success: dbStatus === 'healthy',
    data: {
      status: dbStatus === 'healthy' ? 'operational' : 'degraded',
      service: 'pq-readiness-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        engine: 'SQLite',
        status: dbStatus,
        latencyMs,
      },
      postQuantumStandards: [
        'NIST FIPS 203 (ML-KEM)',
        'NIST FIPS 204 (ML-DSA)',
        'NIST FIPS 205 (SLH-DSA)',
        'NIST SP 800-208',
        'NSA CNSA 2.0',
      ],
    },
  });
};

export const getRules = (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      engineVersion: '2024.1-NIST-FIPS',
      rulesetName: 'Institutional Quantum Vulnerability Assessment Standard',
      standards: [
        {
          id: 'FIPS-203',
          name: 'NIST FIPS 203',
          purpose: 'Module-Lattice-Based Key-Encapsulation Mechanism Standard (ML-KEM)',
          publicationDate: 'August 2024',
          targetClass: 'Key Establishment / Encapsulation',
          recommendedAlgorithms: ['ML-KEM-512', 'ML-KEM-768', 'ML-KEM-1024', 'X25519MLKEM768 (Hybrid)'],
        },
        {
          id: 'FIPS-204',
          name: 'NIST FIPS 204',
          purpose: 'Module-Lattice-Based Digital Signature Standard (ML-DSA)',
          publicationDate: 'August 2024',
          targetClass: 'Digital Signatures / Identity',
          recommendedAlgorithms: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
        },
        {
          id: 'FIPS-205',
          name: 'NIST FIPS 205',
          purpose: 'Stateless Hash-Based Digital Signature Standard (SLH-DSA)',
          publicationDate: 'August 2024',
          targetClass: 'Digital Signatures / Firmware & Long-Term Trust',
          recommendedAlgorithms: ['SLH-DSA-SHA2-128s', 'SLH-DSA-SHAKE-128s', 'SLH-DSA-SHA2-256s'],
        },
        {
          id: 'CNSA-2.0',
          name: 'NSA Commercial National Security Algorithm Suite 2.0',
          purpose: 'Timeline and algorithms for National Security Systems and Critical Infrastructure',
          publicationDate: 'September 2022',
          targetClass: 'Comprehensive PQC Migration',
          recommendedAlgorithms: ['ML-KEM-1024', 'ML-DSA-87', 'LMS', 'XMSS', 'AES-256', 'SHA-384', 'SHA-512'],
        },
      ],
      principles: [
        'Purpose-Specific Evaluation: Digital signatures must not be replaced with KEMs; key exchange must not use signature algorithms.',
        'Shor\'s Algorithm Vulnerability: RSA, DSA, ECDSA, DH, and ECDH are rendered insecure by Cryptanalytically Relevant Quantum Computers (CRQCs).',
        'Store Now, Decrypt Later (SNDL): Encrypted key exchanges are at immediate risk of interception for future retrospective decryption.',
        'Symmetric Retainability: AES-256 remains post-quantum secure against Grover\'s algorithm (128-bit quantum security level).',
        'TLS 1.3 Reality: TLS 1.3 is not post-quantum secure by default unless hybrid or PQC key exchange groups and PQC certificates are negotiated.',
        'Evidence Integrity: Unverifiable or incomplete algorithm inputs are flagged as "Needs Verification" rather than estimated.',
      ],
    },
  });
};

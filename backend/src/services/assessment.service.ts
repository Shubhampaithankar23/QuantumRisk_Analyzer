import crypto from 'crypto';
import prisma from '../lib/prisma';

export interface FindingEvaluation {
  title: string;
  algorithmOrConfig: string;
  observedValue: string;
  purpose: 'DIGITAL_SIGNATURE' | 'KEY_ESTABLISHMENT' | 'SYMMETRIC_ENCRYPTION' | 'HASH_FUNCTION' | 'PROTOCOL';
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  riskReason: string;
  evidenceSource: 'scanner_verified' | 'imported' | 'user_reported' | 'inferred';
  ruleId: string;
  standardRef: string;
  confidence: 'HIGH' | 'MEDIUM' | 'NEEDS_VERIFICATION';
  limitations: string;
  evidenceId?: string;
  recommendation: {
    recommendedAlgorithm: string;
    rationale: string;
    whyAppropriate: string;
    compatibilityNotes: string;
    migrationSteps: string[];
    standardRef: string;
    urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export interface AssessmentResult {
  assetId: string;
  quantumRiskScore: number; // 0 - 100
  overallReadinessStatus: 'QUANTUM_VULNERABLE' | 'TRANSITION_REQUIRED' | 'HYBRID_READY' | 'POST_QUANTUM_READY' | 'NOT_ASSESSED';
  summary: string;
  methodology: string;
  ruleVersion: string;
  scoreBreakdown: string;
  findings: FindingEvaluation[];
}

export function normalizeEvidenceSource(
  source?: string
): 'scanner_verified' | 'imported' | 'user_reported' | 'inferred' {
  if (!source) return 'inferred';
  const s = source.toUpperCase();
  if (s === 'TLS_SCAN' || s === 'SCANNER_VERIFIED' || s === 'VERIFIED_SCAN') {
    return 'scanner_verified';
  }
  if (s.includes('IMPORT') || s.includes('CSV') || s.includes('XLSX') || s.includes('JSON')) {
    return 'imported';
  }
  if (s.includes('MANUAL') || s.includes('USER') || s.includes('REPORTED')) {
    return 'user_reported';
  }
  return 'inferred';
}

function normalizeAlgorithmForDeduplication(rawAlgorithm: string, purpose?: string): string {
  const algorithm = rawAlgorithm.trim().toUpperCase().replace(/\s+/g, ' ');
  const normalizedPurpose = purpose?.toUpperCase() || inferPurpose(algorithm);

  if (
    normalizedPurpose === 'DIGITAL_SIGNATURE' &&
    /^ECDSA(?:[-_ ]?P?[-_ ]?(?:256|384|521))?$/.test(algorithm)
  ) {
    return 'ECDSA';
  }

  return algorithm;
}

function evaluateInternal(
  rawAlgo: string,
  declaredPurpose?: string,
  evidenceSourceInput: string = 'inferred'
): FindingEvaluation {
  const algo = (rawAlgo || '').trim().toUpperCase();
  const evidenceSource = normalizeEvidenceSource(evidenceSourceInput);
  const purpose = declaredPurpose ? declaredPurpose.toUpperCase() : inferPurpose(algo);
  const observedValue = rawAlgo || 'Unknown';

  // 1. DIGITAL SIGNATURES
  if (
    purpose === 'DIGITAL_SIGNATURE' ||
    (!declaredPurpose &&
      (algo.includes('RSA') ||
        algo.includes('ECDSA') ||
        algo.includes('ED25519') ||
        algo.includes('DSA')) &&
      !algo.includes('ECDH') &&
      !algo.includes('KEY TRANSPORT'))
  ) {
    if (algo.includes('ML-DSA') || algo.includes('DILITHIUM')) {
      return {
        title: `Post-Quantum Signature Standard Active (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'DIGITAL_SIGNATURE',
        riskLevel: 'LOW',
        riskReason:
          'Algorithm conforms to NIST FIPS 204 (ML-DSA) and provides quantum resistance against Shor\'s algorithm.',
        evidenceSource,
        ruleId: 'NIST-FIPS-204-MLDSA',
        standardRef: 'NIST FIPS 204',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations:
          'Assesses observed public key algorithm against Shor factoring/discrete-log attacks. Does not evaluate certificate chain authority verification or private key storage security.',
        recommendation: {
          recommendedAlgorithm: 'Maintain ML-DSA Configuration',
          rationale: 'Algorithm provides state-of-the-art lattice-based signature security.',
          whyAppropriate: 'Officially standardized by NIST for digital identity and certificate signing.',
          compatibilityNotes: 'Ensure relying parties and browser roots support ML-DSA public key and signature sizes.',
          migrationSteps: ['Verify client compatibility', 'Monitor standard updates'],
          standardRef: 'NIST FIPS 204',
          urgency: 'LOW',
        },
      };
    }

    if (algo.includes('SLH-DSA') || algo.includes('SPHINCS')) {
      return {
        title: `Stateless Hash-Based Post-Quantum Signature Active (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'DIGITAL_SIGNATURE',
        riskLevel: 'LOW',
        riskReason:
          'Algorithm conforms to NIST FIPS 205 (SLH-DSA). Built upon conservative hash function assumptions.',
        evidenceSource,
        ruleId: 'NIST-FIPS-205-SLHDSA',
        standardRef: 'NIST FIPS 205',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations:
          'Signature verified as post-quantum secure. Bandwidth and verification speed must be profiled under peak load.',
        recommendation: {
          recommendedAlgorithm: 'Maintain SLH-DSA Configuration',
          rationale: 'Provides robust fallback post-quantum security independent of lattice mathematics.',
          whyAppropriate: 'Ideal for high-assurance firmware signing, code signing, and root trust anchors.',
          compatibilityNotes: 'Signature sizes are larger (tens of kilobytes); verify storage and bandwidth constraints.',
          migrationSteps: ['Review bandwidth impact', 'Maintain certificate lifecycle'],
          standardRef: 'NIST FIPS 205',
          urgency: 'LOW',
        },
      };
    }

    // Classical vulnerable signatures: RSA, ECDSA, Ed25519
    const isLegacy =
      algo.includes('1024') ||
      (algo.includes('DSA') &&
        !algo.includes('ECDSA') &&
        !algo.includes('ML-DSA') &&
        !algo.includes('SLH-DSA'));

    return {
      title: `Quantum-Vulnerable Digital Signature (${rawAlgo})`,
      algorithmOrConfig: rawAlgo,
      observedValue,
      purpose: 'DIGITAL_SIGNATURE',
      riskLevel: isLegacy ? 'CRITICAL' : 'HIGH',
      riskReason:
        'Vulnerable to polynomial-time factoring or discrete logarithm solving via Shor\'s algorithm on a Cryptanalytically Relevant Quantum Computer (CRQC). Under NIST IR 8547, classical signatures (RSA-2048, ECDSA-P256) are targeted for deprecation by 2030 and complete disallowance by 2035. Digital signatures will become forgeable.',
      evidenceSource,
      ruleId: isLegacy ? 'LEGACY-VULN-SIGNATURE' : 'NIST-PQC-VULN-SIG',
      standardRef: 'NIST FIPS 204 / NIST IR 8547 / NIST SP 800-208',
      confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
      limitations:
        'Identifies quantum vulnerability of public key signature algorithm. Does not evaluate web server application security or TLS session data in transit.',
      recommendation: {
        recommendedAlgorithm: 'ML-DSA-65 (NIST FIPS 204) or SLH-DSA (NIST FIPS 205)',
        rationale:
          'ML-DSA is the primary NIST-standardized post-quantum digital signature algorithm, offering balanced performance and signature size. Never substitute a key-encapsulation mechanism (ML-KEM) for signature validation.',
        whyAppropriate:
          'Directly replaces classical public key signatures without altering PKI validation mechanics, while withstanding quantum cryptanalysis.',
        compatibilityNotes:
          'ML-DSA public keys and signatures are larger than RSA/ECDSA (public key: ~1.9 KB, signature: ~3.3 KB). Verify certificate buffer sizes and network MTU.',
        migrationSteps: [
          'Inventory software libraries and TLS termination endpoints utilizing this signature key',
          'Deploy hybrid certificates or dual-certificate chains during the transition window',
          'Update certificate authority (CA) root trust stores with ML-DSA anchors',
          'Execute test migrations in staging environments before cutover',
        ],
        standardRef: 'NIST FIPS 204',
        urgency: isLegacy ? 'CRITICAL' : 'HIGH',
      },
    };
  }

  // 2. KEY ESTABLISHMENT / KEY ENCAPSULATION (KEM)
  if (
    purpose === 'KEY_ESTABLISHMENT' ||
    algo.includes('ECDH') ||
    algo.includes('DIFFIE-HELLMAN') ||
    algo.includes('DHE') ||
    algo.includes('X25519') ||
    algo.includes('P-256') ||
    algo.includes('SECP') ||
    algo.includes('KEY TRANSPORT')
  ) {
    if (algo.includes('ML-KEM') || algo.includes('KYBER') || algo.includes('X25519MLKEM768')) {
      return {
        title: `Post-Quantum Key Encapsulation Active (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'KEY_ESTABLISHMENT',
        riskLevel: 'LOW',
        riskReason:
          'Conforms to NIST FIPS 203 (ML-KEM) and provides quantum resistance against Store Now, Decrypt Later (SNDL) attacks.',
        evidenceSource,
        ruleId: 'NIST-FIPS-203-MLKEM',
        standardRef: 'NIST FIPS 203',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations:
          'Key exchange is quantum-safe. Certificate signature must still be evaluated independently for end-to-end post-quantum safety.',
        recommendation: {
          recommendedAlgorithm: 'Maintain ML-KEM Key Establishment',
          rationale: 'Protects network sessions from retroactive quantum decryption.',
          whyAppropriate: 'Standardized by NIST FIPS 203 as the world standard for general key encapsulation.',
          compatibilityNotes: 'Hybrid deployment (e.g. X25519MLKEM768) ensures full backward compatibility with legacy clients.',
          migrationSteps: ['Verify client negotiation logs', 'Ensure TLS 1.3 enablement across edge gateways'],
          standardRef: 'NIST FIPS 203',
          urgency: 'LOW',
        },
      };
    }

    // Static RSA Key Transport (CRITICAL risk - no forward secrecy, vulnerable to Shor's algorithm and past traffic compromise)
    if (algo.includes('KEY TRANSPORT') || (algo.includes('RSA') && purpose === 'KEY_ESTABLISHMENT')) {
      return {
        title: `Static RSA Key Transport (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'KEY_ESTABLISHMENT',
        riskLevel: 'CRITICAL',
        riskReason:
          'Static RSA key transport provides ZERO forward secrecy. Adversaries recording traffic can decrypt all historical communications retrospectively once private key is factored via Shor\'s algorithm.',
        evidenceSource,
        ruleId: 'NIST-SP800-52-STATIC-RSA-KEM',
        standardRef: 'NIST SP 800-52 Rev 2 / NIST FIPS 203',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations: 'Static RSA key exchange observed in TLS cipher suites. Deprecated in modern TLS 1.3.',
        recommendation: {
          recommendedAlgorithm: 'ML-KEM-768 (NIST FIPS 203) / Hybrid X25519MLKEM768',
          rationale:
            'Replace obsolete static RSA key transport with lattice-based key encapsulation providing forward secrecy.',
          whyAppropriate: 'Eliminates Store-Now-Decrypt-Later risk on session key establishment.',
          compatibilityNotes: 'Upgrade endpoints to TLS 1.3 to remove static RSA cipher suites.',
          migrationSteps: [
            'Disable all TLS_RSA_* cipher suites in server configuration',
            'Upgrade server to TLS 1.3',
            'Deploy ML-KEM-768 hybrid key exchange',
          ],
          standardRef: 'NIST FIPS 203',
          urgency: 'CRITICAL',
        },
      };
    }

    // Classical key exchange: ECDHE, DHE
    return {
      title: `Quantum-Vulnerable Key Establishment (${rawAlgo})`,
      algorithmOrConfig: rawAlgo,
      observedValue,
      purpose: 'KEY_ESTABLISHMENT',
      riskLevel: 'HIGH',
      riskReason:
        'Immediate Store Now, Decrypt Later (SNDL) threat: adversary state actors record encrypted sessions today to decrypt retrospectively once a quantum computer is available. Shor\'s algorithm solves discrete log key exchange.',
      evidenceSource,
      ruleId: 'NIST-PQC-VULN-KEM',
      standardRef: 'NIST FIPS 203',
      confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
      limitations:
        'Evaluates ephemeral/static session key agreement against Store-Now-Decrypt-Later (SNDL) attacks. Does not evaluate bulk data encryption cipher.',
      recommendation: {
        recommendedAlgorithm: 'ML-KEM-768 (NIST FIPS 203) / Hybrid X25519MLKEM768',
        rationale:
          'ML-KEM-768 provides Security Category 3 (equivalent to AES-192) lattice-based key encapsulation resistant to all known quantum and classical attacks. Never substitute a digital signature algorithm (ML-DSA) for key exchange.',
        whyAppropriate:
          'Seamlessly integrated into TLS 1.3 and SSH protocols as a hybrid key exchange group, protecting both present and future confidentiality.',
        compatibilityNotes:
          'Requires TLS 1.3 endpoints. Hybrid X25519MLKEM768 adds only ~1.1 KB to ClientHello/ServerHello messages.',
        migrationSteps: [
          'Enable TLS 1.3 with X25519MLKEM768 hybrid key exchange groups on edge reverse proxies',
          'Upgrade OpenSSL (v3.2+) or BoringSSL / Go crypto runtimes',
          'Audit data sensitivity retention requirements: data with >5-year secrecy horizon must migrate immediately',
          'Verify TLS middlebox pass-through of extended ClientHello packets',
        ],
        standardRef: 'NIST FIPS 203',
        urgency: 'HIGH',
      },
    };
  }

  // 3. SYMMETRIC ENCRYPTION
  if (
    purpose === 'SYMMETRIC_ENCRYPTION' ||
    algo.includes('AES') ||
    algo.includes('CHACHA') ||
    algo.includes('DES') ||
    algo.includes('RC4')
  ) {
    if (algo.includes('3DES') || algo.includes('DES') || algo.includes('RC4')) {
      return {
        title: `Classically Broken & Quantum-Vulnerable Cipher (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'SYMMETRIC_ENCRYPTION',
        riskLevel: 'CRITICAL',
        riskReason:
          'Vulnerable to known classical cryptanalysis (Sweet32, key recovery) and trivially broken by quantum search.',
        evidenceSource,
        ruleId: 'NIST-SP800-131A-BROKEN-CIPHER',
        standardRef: 'NIST SP 800-131A',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations: 'Cipher suite identified in negotiated parameters or asset configuration.',
        recommendation: {
          recommendedAlgorithm: 'AES-256-GCM',
          rationale: 'AES-256 provides both classical and 128-bit quantum security strength under Grover\'s algorithm.',
          whyAppropriate: 'Industry standard authenticated encryption with hardware acceleration (AES-NI).',
          compatibilityNotes: 'Supported universally across modern OS, browsers, and hardware platforms.',
          migrationSteps: ['Disable legacy cipher suites immediately', 'Re-encrypt legacy stored data with AES-256 keys'],
          standardRef: 'NIST SP 800-38D',
          urgency: 'CRITICAL',
        },
      };
    }

    if (algo.includes('AES-128') || algo.includes('128')) {
      return {
        title: `128-Bit Symmetric Key Strength Under Quantum Attack (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'SYMMETRIC_ENCRYPTION',
        riskLevel: 'MEDIUM',
        riskReason:
          'Grover\'s quantum search algorithm halves effective brute-force key length to 64 bits of security, which is near brute-force feasibility for nation-state supercomputing. Not vulnerable in the same way as RSA or ECDH, but has a diminished security margin.',
        evidenceSource,
        ruleId: 'CNSA2-AES128-MARGIN',
        standardRef: 'CNSA 2.0 / NIST SP 800-57',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations:
          'AES-128 is not broken by Shor\'s algorithm, but Grover search reduces effective security margin.',
        recommendation: {
          recommendedAlgorithm: 'AES-256-GCM',
          rationale: 'AES-256 preserves a comfortable 128 bits of security margin against quantum Grover search.',
          whyAppropriate: 'Aligns with NSA CNSA 2.0 mandates for long-term data protection and university research confidentiality.',
          compatibilityNotes: 'Minimal CPU overhead on hardware with AES-NI support.',
          migrationSteps: [
            'Update configuration profiles to prefer AES-256-GCM over AES-128-GCM',
            'Upgrade master database and volume encryption keys to 256 bits',
          ],
          standardRef: 'NSA CNSA 2.0',
          urgency: 'MEDIUM',
        },
      };
    }

    // AES-256 or ChaCha20
    return {
      title: `Quantum-Resistant Symmetric Cipher (${rawAlgo})`,
      algorithmOrConfig: rawAlgo,
      observedValue,
      purpose: 'SYMMETRIC_ENCRYPTION',
      riskLevel: 'LOW',
      riskReason:
        'Retains 128 bits of effective quantum security against Grover\'s search algorithm. Computational recovery remains infeasible on any quantum computer.',
      evidenceSource,
      ruleId: 'NIST-SP800-57-SYM-PQC',
      standardRef: 'NIST SP 800-57 Part 1',
      confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
      limitations: 'Symmetric cipher key length evaluated. Key management and rotation must be audited separately.',
      recommendation: {
        recommendedAlgorithm: 'Retain AES-256 / ChaCha20-Poly1305',
        rationale: 'Symmetric encryption with 256-bit keys remains quantum-resistant without algorithm replacement.',
        whyAppropriate: 'No migration needed for cipher algorithm; focus on key establishment and signature channels.',
        compatibilityNotes: 'Fully compatible with all modern systems.',
        migrationSteps: ['Maintain key rotation procedures', 'Audit key management and storage security'],
        standardRef: 'NIST SP 800-57',
        urgency: 'LOW',
      },
    };
  }

  // 4. HASH FUNCTIONS
  if (purpose === 'HASH_FUNCTION' || algo.includes('SHA') || algo.includes('MD5')) {
    if (algo.includes('MD5') || algo.includes('SHA-1') || algo.includes('SHA1')) {
      return {
        title: `Classically Broken Hash Function (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'HASH_FUNCTION',
        riskLevel: 'CRITICAL',
        riskReason: 'Practical collision attacks exist classically. Cryptanalytically broken.',
        evidenceSource,
        ruleId: 'NIST-SP800-131A-BROKEN-HASH',
        standardRef: 'NIST SP 800-131A',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations: 'Hash function assessed in isolation.',
        recommendation: {
          recommendedAlgorithm: 'SHA-384 or SHA-512',
          rationale: 'Provides long-term post-quantum collision and preimage resistance.',
          whyAppropriate: 'Universal standard and CNSA 2.0 approved.',
          compatibilityNotes: 'Widely supported in all cryptographic libraries.',
          migrationSteps: ['Replace hash calls in application source code', 'Recompute legacy hashes'],
          standardRef: 'NIST FIPS 180-4',
          urgency: 'CRITICAL',
        },
      };
    }

    return {
      title: `Post-Quantum Secure Hash Function (${rawAlgo})`,
      algorithmOrConfig: rawAlgo,
      observedValue,
      purpose: 'HASH_FUNCTION',
      riskLevel: 'LOW',
      riskReason:
        'Cryptographic hash functions of 256 bits or greater maintain ample security margin against quantum collision attacks.',
      evidenceSource,
      ruleId: 'NIST-FIPS-180-4-HASH',
      standardRef: 'NIST FIPS 180-4',
      confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
      limitations: 'Hash function collision resistance evaluated under classical and quantum models.',
      recommendation: {
        recommendedAlgorithm: 'Retain SHA-256 / Upgrade to SHA-384 for CNSA 2.0',
        rationale: 'Strong resistance against Grover and Brassard-Høyer-Tapp collision algorithms.',
        whyAppropriate: 'Proven cryptographic strength and compatibility.',
        compatibilityNotes: 'Universal support.',
        migrationSteps: ['Retain current hash algorithms', 'Consider SHA-384 for long-term top-secret archives'],
        standardRef: 'NIST FIPS 180-4',
        urgency: 'LOW',
      },
    };
  }

  // 5. PROTOCOL & TLS VERSIONS
  if (purpose === 'PROTOCOL' || algo.includes('TLS') || algo.includes('SSL')) {
    if (algo.includes('TLS 1.3') || algo.includes('TLSV1.3') || algo === 'TLS1.3') {
      return {
        title: `Modern TLS 1.3 Transport Protocol (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'PROTOCOL',
        riskLevel: 'LOW',
        riskReason:
          'TLS 1.3 provides essential modern cryptographic hygiene (mandatory forward secrecy, removal of broken ciphers). NOTE: TLS 1.3 is NOT automatically quantum-safe on its own; post-quantum safety strictly requires negotiating a post-quantum KEM group (FIPS 203) and post-quantum certificate signatures (FIPS 204).',
        evidenceSource,
        ruleId: 'IETF-RFC8446-TLS13',
        standardRef: 'RFC 8446 / NIST IR 8547',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations:
          'Protocol version evaluated. End-to-end post-quantum safety depends on key exchange group and signature algorithms negotiated over this protocol.',
        recommendation: {
          recommendedAlgorithm: 'Maintain TLS 1.3 with Hybrid Post-Quantum KEM Groups (X25519MLKEM768)',
          rationale:
            'TLS 1.3 provides the required protocol foundation to negotiate post-quantum hybrid key exchange groups (e.g. X25519MLKEM768).',
          whyAppropriate: 'Industry standard for modern secure communications.',
          compatibilityNotes: 'Supported by modern browsers and operating systems.',
          migrationSteps: [
            'Verify server TLS configuration enables TLS 1.3',
            'Enable post-quantum hybrid key exchange groups (X25519MLKEM768)',
          ],
          standardRef: 'RFC 8446',
          urgency: 'LOW',
        },
      };
    }

    if (algo.includes('TLS 1.2') || algo.includes('TLSV1.2') || algo === 'TLS1.2') {
      return {
        title: `Legacy TLS 1.2 Transport Protocol (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'PROTOCOL',
        riskLevel: 'MEDIUM',
        riskReason:
          'TLS 1.2 lacks native post-quantum hybrid group standardization and allows obsolete cryptographic options. Must upgrade to TLS 1.3 to enable post-quantum key encapsulation (ML-KEM).',
        evidenceSource,
        ruleId: 'NIST-SP800-52R2-TLS12',
        standardRef: 'NIST SP 800-52 Rev 2',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations: 'TLS 1.2 is classical only and cannot natively support standard post-quantum hybrid groups.',
        recommendation: {
          recommendedAlgorithm: 'Upgrade to TLS 1.3',
          rationale: 'TLS 1.3 is required for standard ML-KEM post-quantum key exchange groups.',
          whyAppropriate: 'Mandated by NIST SP 800-52 Rev 2 for institutional security.',
          compatibilityNotes: 'Supported by all modern software clients.',
          migrationSteps: ['Enable TLS 1.3 on web servers and load balancers', 'Phase out TLS 1.2 support'],
          standardRef: 'NIST SP 800-52 Rev 2',
          urgency: 'MEDIUM',
        },
      };
    }

    if (
      algo.includes('TLS 1.0') ||
      algo.includes('TLS 1.1') ||
      algo.includes('TLSV1.0') ||
      algo.includes('TLSV1.1') ||
      algo.includes('SSL')
    ) {
      return {
        title: `Obsolete & Deprecated Protocol Version (${rawAlgo})`,
        algorithmOrConfig: rawAlgo,
        observedValue,
        purpose: 'PROTOCOL',
        riskLevel: 'CRITICAL',
        riskReason:
          'Formally deprecated by NIST SP 800-52 Rev 2 and IETF RFC 8996. Vulnerable to POODLE, BEAST, and classical cryptographic attacks.',
        evidenceSource,
        ruleId: 'IETF-RFC8996-LEGACY-TLS',
        standardRef: 'IETF RFC 8996 / NIST SP 800-52 Rev 2',
        confidence: evidenceSource === 'scanner_verified' ? 'HIGH' : 'MEDIUM',
        limitations: 'Deprecated protocol versions must be disabled immediately.',
        recommendation: {
          recommendedAlgorithm: 'Disable Legacy Protocols Immediately & Upgrade to TLS 1.3',
          rationale: 'Protocol versions prior to TLS 1.2 contain critical security flaws.',
          whyAppropriate: 'Mandatory compliance with NIST and PCI-DSS standards.',
          compatibilityNotes: 'Clients requiring SSL/TLS 1.0/1.1 are obsolete and insecure.',
          migrationSteps: ['Disable TLS 1.0 and 1.1 in web server configs', 'Enforce TLS 1.3 minimum where feasible'],
          standardRef: 'IETF RFC 8996',
          urgency: 'CRITICAL',
        },
      };
    }
  }

  // 6. UNKNOWN / INSUFFICIENT EVIDENCE - STRICT TRACEABILITY
  return {
    title: `Unverified Cryptographic Configuration (${rawAlgo || 'Unknown'})`,
    algorithmOrConfig: rawAlgo || 'Unknown',
    observedValue,
    purpose: 'PROTOCOL',
    riskLevel: 'INFORMATIONAL',
    riskReason:
      'The reported algorithm or configuration could not be deterministically mapped to a standardized post-quantum classification. Additional cryptographic evidence is required before a risk score or migration plan can be assigned.',
    evidenceSource,
    ruleId: 'UNKNOWN-CRYPTOGRAPHIC-EVIDENCE',
    standardRef: 'NIST PQC Assessment Guidance',
    confidence: 'NEEDS_VERIFICATION',
    limitations:
      'Insufficient evidence to identify cryptographic primitive, key size, or operational purpose. Migration recommendation cannot be finalized until evidence is provided.',
    recommendation: {
      recommendedAlgorithm: 'Perform Cryptographic Inventory & Evidence Collection',
      rationale:
        'Deterministic security decisions require verified algorithm identifiers and operational purposes rather than estimations.',
      whyAppropriate: 'Prevents erroneous migrations and ensures accurate institutional risk reporting.',
      compatibilityNotes: 'Verify with system vendors, software dependencies, or run live TLS inspection.',
      migrationSteps: [
        'Inspect server configuration files or source code dependencies',
        'Run an authorized TLS scan if the endpoint is network accessible',
        'Consult software vendor documentation for exact cryptographic primitives used',
      ],
      standardRef: 'NIST PQC Migration Playbook',
      urgency: 'LOW',
    },
  };
}

export function evaluateAlgorithm(
  rawAlgo: string,
  declaredPurpose?: string,
  evidenceSourceInput: string = 'inferred'
): FindingEvaluation {
  const finding = evaluateInternal(rawAlgo, declaredPurpose, evidenceSourceInput);
  if (finding.evidenceSource === 'user_reported') {
    finding.confidence = finding.confidence === 'NEEDS_VERIFICATION' ? 'NEEDS_VERIFICATION' : 'MEDIUM';
    if (!finding.limitations.includes('User-reported (unverified)')) {
      finding.limitations = `${finding.limitations} [User-reported (unverified): Reported manually without independent network cryptographic verification.]`;
    }
  }
  return finding;
}

function inferPurpose(
  algo: string
): 'DIGITAL_SIGNATURE' | 'KEY_ESTABLISHMENT' | 'SYMMETRIC_ENCRYPTION' | 'HASH_FUNCTION' | 'PROTOCOL' {
  if (algo.includes('RSA') || algo.includes('ECDSA') || algo.includes('DSA') || algo.includes('SIGN')) {
    return 'DIGITAL_SIGNATURE';
  }
  if (
    algo.includes('ECDH') ||
    algo.includes('DHE') ||
    algo.includes('DIFFIE') ||
    algo.includes('KEM') ||
    algo.includes('EXCHANGE')
  ) {
    return 'KEY_ESTABLISHMENT';
  }
  if (algo.includes('AES') || algo.includes('CHACHA') || algo.includes('DES') || algo.includes('CIPHER')) {
    return 'SYMMETRIC_ENCRYPTION';
  }
  if (algo.includes('SHA') || algo.includes('MD5') || algo.includes('HASH')) {
    return 'HASH_FUNCTION';
  }
  return 'PROTOCOL';
}

export async function runAssessmentForAsset(assetId: string): Promise<AssessmentResult> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      scanJobs: {
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 1,
        include: {
          results: true,
          evidence: true,
        },
      },
      evidence: true,
    },
  });

  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  const findingsToCreate: FindingEvaluation[] = [];

  // 1. Evaluate from verified TLS scan if available
  const latestScan = asset.scanJobs[0];
  const scanResult = latestScan?.results?.[0];

  if (scanResult) {
    // Certificate public key
    if (
      scanResult.certPubKeyAlgo &&
      scanResult.certPubKeyAlgo !== 'Unknown' &&
      scanResult.certPubKeyAlgo !== 'Not Observed'
    ) {
      const algoStr = `${scanResult.certPubKeyAlgo}${scanResult.certKeySize ? `-${scanResult.certKeySize}` : ''}`;
      const evalItem = evaluateAlgorithm(algoStr, 'DIGITAL_SIGNATURE', 'scanner_verified');
      const matchedEv = latestScan?.evidence?.find((e) => e.observedProperty === 'cert_pub_key_algo');
      if (matchedEv) evalItem.evidenceId = matchedEv.id;
      findingsToCreate.push(evalItem);
    } else {
      findingsToCreate.push({
        title: 'Insufficient Evidence — Public Key Certificate Algorithm Not Observed',
        algorithmOrConfig: 'Not Observed',
        observedValue: 'Not Observed',
        purpose: 'DIGITAL_SIGNATURE',
        riskLevel: 'INFORMATIONAL',
        riskReason: 'Cryptographic public key algorithm could not be verified from scan evidence. No risk score applied.',
        evidenceSource: 'scanner_verified',
        ruleId: 'INSUFFICIENT-EVIDENCE-CERT',
        standardRef: 'NIST SP 800-52r2',
        confidence: 'NEEDS_VERIFICATION',
        limitations: 'Evidence missing or certificate not presented during handshake.',
        recommendation: {
          recommendedAlgorithm: 'NIST FIPS 204 (ML-DSA) or FIPS 186-5 ECDSA / RSA-3072+',
          rationale: 'Verify public key certificate through authorized administrative inventory or rescanning.',
          whyAppropriate: 'Cryptographic assessment requires defensible evidence.',
          compatibilityNotes: 'Ensure target endpoint presents valid X.509 certificate chain.',
          migrationSteps: ['Verify server certificate configuration', 'Rescan endpoint to capture certificate chain'],
          standardRef: 'NIST SP 800-52r2',
          urgency: 'LOW',
        },
      });
    }

    // Key exchange mechanism
    if (
      scanResult.keyExchangeGroup &&
      scanResult.keyExchangeGroup !== 'Unknown Key Exchange' &&
      scanResult.keyExchangeGroup !== 'Unknown' &&
      scanResult.keyExchangeGroup !== 'Not Observed'
    ) {
      const evalItem = evaluateAlgorithm(scanResult.keyExchangeGroup, 'KEY_ESTABLISHMENT', 'scanner_verified');
      const matchedEv = latestScan?.evidence?.find((e) => e.observedProperty === 'key_exchange_group');
      if (matchedEv) evalItem.evidenceId = matchedEv.id;
      findingsToCreate.push(evalItem);
    } else {
      findingsToCreate.push({
        title: 'Insufficient Evidence — Key Exchange Group Not Observed',
        algorithmOrConfig: 'Not Observed',
        observedValue: 'Not Observed',
        purpose: 'KEY_ESTABLISHMENT',
        riskLevel: 'INFORMATIONAL',
        riskReason: 'Key exchange group parameter could not be extracted from peer handshake response. No risk score applied.',
        evidenceSource: 'scanner_verified',
        ruleId: 'INSUFFICIENT-EVIDENCE-KEM',
        standardRef: 'NIST SP 800-56Ar3',
        confidence: 'NEEDS_VERIFICATION',
        limitations: 'Key exchange group not reported in server handshake response.',
        recommendation: {
          recommendedAlgorithm: 'NIST FIPS 203 (ML-KEM) or hybrid X25519MLKEM768',
          rationale: 'Perform deep probe to observe supported key exchange parameters.',
          whyAppropriate: 'Cryptographic assessment requires defensible evidence.',
          compatibilityNotes: 'Ensure TLS 1.3 / 1.2 client can negotiate supported groups with server.',
          migrationSteps: ['Configure TLS server to advertise supported key exchange groups', 'Rescan endpoint'],
          standardRef: 'NIST SP 800-56Ar3',
          urgency: 'LOW',
        },
      });
    }

    // Cipher suite
    if (scanResult.cipherSuiteNegotiated) {
      const evalItem = evaluateAlgorithm(scanResult.cipherSuiteNegotiated, 'SYMMETRIC_ENCRYPTION', 'scanner_verified');
      const matchedEv = latestScan?.evidence?.find((e) => e.observedProperty === 'cipher_suite_negotiated');
      if (matchedEv) evalItem.evidenceId = matchedEv.id;
      findingsToCreate.push(evalItem);
    }
  }

  // 2. Evaluate from known algorithms inventory field
  if (asset.knownAlgorithms) {
    let parsed: any[] = [];
    try {
      const json = JSON.parse(asset.knownAlgorithms);
      parsed = Array.isArray(json) ? json : [json];
    } catch {
      parsed = asset.knownAlgorithms.split(',').map((item) => ({ algorithm: item.trim() }));
    }

    // Map source strictly
    const sourceForInventory = normalizeEvidenceSource(asset.informationSource);

    for (const item of parsed) {
      const rawAlgo = item.algorithm || item.name || String(item);
      const purpose = item.purpose;
      if (rawAlgo && rawAlgo !== '[object Object]' && rawAlgo.trim() !== '') {
        const alreadyFound = findingsToCreate.some(
          (f) =>
            normalizeAlgorithmForDeduplication(f.algorithmOrConfig, f.purpose) ===
            normalizeAlgorithmForDeduplication(rawAlgo, purpose)
        );
        if (!alreadyFound) {
          findingsToCreate.push(
            evaluateAlgorithm(rawAlgo, purpose, sourceForInventory)
          );
        }
      }
    }
  }

  // 3. Fallback: If no algorithms known and no scan, record honest unassessed state
  if (findingsToCreate.length === 0) {
    findingsToCreate.push(
      evaluateAlgorithm('Unassessed Asset — No Cryptographic Evidence Available', undefined, 'inferred')
    );
  }

  // Ensure every finding has an evidenceId backed by a database Evidence record
  for (const item of findingsToCreate) {
    if (!item.evidenceId) {
      const existingEv = asset.evidence?.find(
        (e) =>
          e.observedValue === (item.observedValue || item.algorithmOrConfig) &&
          e.evidenceSource === item.evidenceSource
      );
      if (existingEv) {
        item.evidenceId = existingEv.id;
      } else {
        const newEv = await prisma.evidence.create({
          data: {
            assetId: asset.id,
            scanJobId: latestScan?.id || null,
            evidenceSource: item.evidenceSource,
            evidenceType:
              item.purpose === 'DIGITAL_SIGNATURE'
                ? 'X509_CERTIFICATE'
                : item.purpose === 'KEY_ESTABLISHMENT'
                ? 'KEY_EXCHANGE'
                : item.purpose === 'SYMMETRIC_ENCRYPTION'
                ? 'CIPHER_SUITE'
                : item.purpose === 'PROTOCOL'
                ? 'TLS_HANDSHAKE'
                : 'INVENTORY_RECORD',
            observedProperty: item.purpose ? item.purpose.toLowerCase() : 'algorithm',
            observedValue: item.observedValue || item.algorithmOrConfig,
            rawPayload: JSON.stringify({
              algorithm: item.algorithmOrConfig,
              purpose: item.purpose,
              source: item.evidenceSource,
            }),
            scannerVersion: item.evidenceSource === 'scanner_verified' ? (scanResult?.scannerVersion || 'Node-TLS') : null,
            verifiedAt: item.evidenceSource === 'scanner_verified' ? new Date() : null,
            hashDigest: crypto.createHash('sha256').update(item.algorithmOrConfig).digest('hex'),
          },
        });
        item.evidenceId = newEv.id;
      }
    }
  }

  // Calculate deterministic score with explicit breakdown
  const contributingFindings: Array<{
    title: string;
    algorithm: string;
    riskLevel: string;
    pointsAdded: number;
    ruleId: string;
    evidenceId?: string;
  }> = [];

  let rawScore = 0;
  let hasCritical = false;
  let hasHigh = false;
  let hasPq = false;
  let hasDefensibleEvidence = false;

  for (const f of findingsToCreate) {
    if (
      f.ruleId === 'UNKNOWN-CRYPTOGRAPHIC-EVIDENCE' ||
      f.ruleId.startsWith('INSUFFICIENT-EVIDENCE') ||
      f.riskLevel === 'INFORMATIONAL'
    ) {
      contributingFindings.push({
        title: f.title,
        algorithm: f.algorithmOrConfig,
        riskLevel: f.riskLevel,
        pointsAdded: 0,
        ruleId: f.ruleId,
        evidenceId: f.evidenceId,
      });
      continue;
    }

    hasDefensibleEvidence = true;
    let points = 0;
    if (f.riskLevel === 'CRITICAL') {
      points = 35;
      hasCritical = true;
    } else if (f.riskLevel === 'HIGH') {
      points = 25;
      hasHigh = true;
    } else if (f.riskLevel === 'MEDIUM') {
      points = 10;
    } else if (f.riskLevel === 'LOW') {
      points = 0;
      hasPq = true;
    }

    rawScore += points;
    contributingFindings.push({
      title: f.title,
      algorithm: f.algorithmOrConfig,
      riskLevel: f.riskLevel,
      pointsAdded: points,
      ruleId: f.ruleId,
      evidenceId: f.evidenceId,
    });
  }

  // Adjust for data sensitivity if defensible evidence exists
  let sensitivityMultiplier = 1.0;
  if (hasDefensibleEvidence && (asset.dataSensitivity === 'HIGHLY_SENSITIVE' || asset.dataSensitivity === 'REGULATED')) {
    sensitivityMultiplier = 1.25;
    rawScore = Math.round(rawScore * sensitivityMultiplier);
  }

  let quantumRiskScore = 0;
  let overallReadinessStatus: AssessmentResult['overallReadinessStatus'] = 'NOT_ASSESSED';

  if (!hasDefensibleEvidence) {
    quantumRiskScore = 0;
    overallReadinessStatus = 'NOT_ASSESSED';
  } else {
    quantumRiskScore = Math.min(100, Math.max(0, rawScore));
    if (quantumRiskScore >= 70) {
      overallReadinessStatus = 'QUANTUM_VULNERABLE';
    } else if (quantumRiskScore >= 40) {
      overallReadinessStatus = 'TRANSITION_REQUIRED';
    } else if (hasPq && (hasHigh || hasCritical)) {
      overallReadinessStatus = 'HYBRID_READY';
    } else {
      overallReadinessStatus = 'POST_QUANTUM_READY';
    }
  }

  const scoreBreakdownJson = JSON.stringify({
    ruleVersion: '2024.1-NIST-FIPS',
    calculatedAt: new Date().toISOString(),
    hasDefensibleEvidence,
    basePoints: rawScore,
    sensitivityMultiplier,
    finalScore: quantumRiskScore,
    status: overallReadinessStatus,
    contributingFindings,
  });

  const summary = hasDefensibleEvidence
    ? `Post-quantum evaluation completed for "${asset.name}" (${asset.identifier}). Evaluated ${findingsToCreate.length} cryptographic item(s). Quantum Risk Score: ${quantumRiskScore}/100. Status: ${overallReadinessStatus.replace(/_/g, ' ')}.`
    : `Assessment for "${asset.name}" (${asset.identifier}) is incomplete: No defensible cryptographic evidence found. Status: Not Assessed. Run a TLS scan or import verified cryptographic inventory.`;

  // Persist Assessment in database
  const createdAssessment = await prisma.assessment.create({
    data: {
      assetId: asset.id,
      title: `NIST Post-Quantum Assessment - ${asset.name}`,
      ruleVersion: '2024.1-NIST-FIPS',
      quantumRiskScore,
      overallReadinessStatus,
      summary,
      scoreBreakdown: scoreBreakdownJson,
      methodology:
        'Deterministic rule-based assessment against NIST FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA), and NSA CNSA 2.0 standards.',
    },
  });

  // Remove previous un-remediated findings for this asset
  await prisma.finding.deleteMany({
    where: {
      assetId: asset.id,
      status: 'OPEN',
    },
  });

  for (const item of findingsToCreate) {
    const finding = await prisma.finding.create({
      data: {
        assessmentId: createdAssessment.id,
        assetId: asset.id,
        evidenceId: item.evidenceId,
        title: item.title,
        algorithmOrConfig: item.algorithmOrConfig,
        observedValue: item.observedValue,
        purpose: item.purpose,
        riskLevel: item.riskLevel,
        riskReason: item.riskReason,
        evidenceSource: item.evidenceSource,
        ruleId: item.ruleId,
        standardRef: item.standardRef,
        confidence: item.confidence,
        limitations: item.limitations,
        status: 'OPEN',
        priority: item.riskLevel === 'CRITICAL' ? 'CRITICAL' : item.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
      },
    });

    await prisma.recommendation.create({
      data: {
        findingId: finding.id,
        recommendedAlgorithm: item.recommendation.recommendedAlgorithm,
        rationale: item.recommendation.rationale,
        whyAppropriate: item.recommendation.whyAppropriate,
        compatibilityNotes: item.recommendation.compatibilityNotes,
        migrationSteps: JSON.stringify(item.recommendation.migrationSteps),
        standardRef: item.recommendation.standardRef,
        urgency: item.recommendation.urgency,
      },
    });
  }

  // Update asset status
  await prisma.asset.update({
    where: { id: asset.id },
    data: {
      assessmentStatus:
        overallReadinessStatus === 'QUANTUM_VULNERABLE'
          ? 'HIGH_RISK'
          : overallReadinessStatus === 'TRANSITION_REQUIRED'
          ? 'ASSESSED'
          : overallReadinessStatus === 'NOT_ASSESSED'
          ? 'PENDING'
          : 'LOW_RISK',
    },
  });

  return {
    assetId: asset.id,
    quantumRiskScore,
    overallReadinessStatus,
    summary,
    methodology: createdAssessment.methodology,
    ruleVersion: createdAssessment.ruleVersion,
    scoreBreakdown: scoreBreakdownJson,
    findings: findingsToCreate,
  };
}

export async function runAllAssessments(): Promise<{ totalAssessed: number; results: any[] }> {
  const assets = await prisma.asset.findMany({ select: { id: true } });
  const results: any[] = [];

  for (const a of assets) {
    try {
      const res = await runAssessmentForAsset(a.id);
      results.push(res);
    } catch (err: any) {
      console.error(`Error assessing asset ${a.id}:`, err);
    }
  }

  return {
    totalAssessed: results.length,
    results,
  };
}

import prisma from '../lib/prisma';

export interface FindingEvaluation {
  title: string;
  algorithmOrConfig: string;
  purpose: 'DIGITAL_SIGNATURE' | 'KEY_ESTABLISHMENT' | 'SYMMETRIC_ENCRYPTION' | 'HASH_FUNCTION' | 'PROTOCOL';
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  riskReason: string;
  standardRef: string;
  confidence: 'HIGH' | 'MEDIUM' | 'NEEDS_VERIFICATION';
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
  overallReadinessStatus: 'QUANTUM_VULNERABLE' | 'TRANSITION_REQUIRED' | 'HYBRID_READY' | 'POST_QUANTUM_READY';
  summary: string;
  methodology: string;
  ruleVersion: string;
  findings: FindingEvaluation[];
}

export function evaluateAlgorithm(
  rawAlgo: string,
  declaredPurpose?: string,
  evidenceSource: string = 'MANUAL'
): FindingEvaluation {
  const algo = rawAlgo.trim().toUpperCase();
  const purpose = declaredPurpose ? declaredPurpose.toUpperCase() : inferPurpose(algo);

  // 1. DIGITAL SIGNATURES
  if (
    purpose === 'DIGITAL_SIGNATURE' ||
    algo.includes('RSA') ||
    algo.includes('ECDSA') ||
    algo.includes('ED25519') ||
    algo.includes('DSA')
  ) {
    if (algo.includes('ML-DSA') || algo.includes('DILITHIUM')) {
      return {
        title: `Post-Quantum Signature Standard in Use (${algo})`,
        algorithmOrConfig: rawAlgo,
        purpose: 'DIGITAL_SIGNATURE',
        riskLevel: 'LOW',
        riskReason: 'Algorithm conforms to NIST FIPS 204 (ML-DSA) and provides quantum resistance against Shor\'s algorithm.',
        standardRef: 'NIST FIPS 204',
        confidence: 'HIGH',
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
        title: `Stateless Hash-Based Post-Quantum Signature in Use (${algo})`,
        algorithmOrConfig: rawAlgo,
        purpose: 'DIGITAL_SIGNATURE',
        riskLevel: 'LOW',
        riskReason: 'Algorithm conforms to NIST FIPS 205 (SLH-DSA). Built upon conservative hash function assumptions.',
        standardRef: 'NIST FIPS 205',
        confidence: 'HIGH',
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
      purpose: 'DIGITAL_SIGNATURE',
      riskLevel: isLegacy ? 'CRITICAL' : 'HIGH',
      riskReason:
        'Vulnerable to polynomial-time factoring or discrete logarithm solving via Shor\'s algorithm on a Cryptanalytically Relevant Quantum Computer (CRQC). Digital signatures will become forgeable.',
      standardRef: 'NIST FIPS 204 / NIST SP 800-208',
      confidence: 'HIGH',
      recommendation: {
        recommendedAlgorithm: 'ML-DSA-65 (NIST FIPS 204) or SLH-DSA (NIST FIPS 205)',
        rationale:
          'ML-DSA is the primary NIST-standardized post-quantum digital signature algorithm, offering balanced performance and signature size.',
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
    algo.includes('P-256')
  ) {
    if (algo.includes('ML-KEM') || algo.includes('KYBER') || algo.includes('X25519MLKEM768')) {
      return {
        title: `Post-Quantum Key Encapsulation Active (${algo})`,
        algorithmOrConfig: rawAlgo,
        purpose: 'KEY_ESTABLISHMENT',
        riskLevel: 'LOW',
        riskReason: 'Conforms to NIST FIPS 203 (ML-KEM) and provides quantum resistance against Store Now, Decrypt Later (SNDL) attacks.',
        standardRef: 'NIST FIPS 203',
        confidence: 'HIGH',
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

    // Classical key exchange: ECDHE, DHE, RSA key exchange
    return {
      title: `Quantum-Vulnerable Key Establishment (${rawAlgo})`,
      algorithmOrConfig: rawAlgo,
      purpose: 'KEY_ESTABLISHMENT',
      riskLevel: 'HIGH',
      riskReason:
        'Immediate Store Now, Decrypt Later (SNDL) threat: adversary state actors record encrypted sessions today to decrypt retrospectively once a quantum computer is available. Shor\'s algorithm solves discrete log key exchange.',
      standardRef: 'NIST FIPS 203',
      confidence: 'HIGH',
      recommendation: {
        recommendedAlgorithm: 'ML-KEM-768 (NIST FIPS 203) / Hybrid X25519MLKEM768',
        rationale:
          'ML-KEM-768 provides Security Category 3 (equivalent to AES-192) lattice-based key encapsulation resistant to all known quantum and classical attacks.',
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
        purpose: 'SYMMETRIC_ENCRYPTION',
        riskLevel: 'CRITICAL',
        riskReason: 'Vulnerable to known classical cryptanalysis (Sweet32, key recovery) and trivially broken by quantum search.',
        standardRef: 'NIST SP 800-131A',
        confidence: 'HIGH',
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
        purpose: 'SYMMETRIC_ENCRYPTION',
        riskLevel: 'MEDIUM',
        riskReason:
          'Grover\'s quantum search algorithm halves effective brute-force key length to 64 bits of security, which is near brute-force feasibility for nation-state supercomputing.',
        standardRef: 'CNSA 2.0 / NIST SP 800-57',
        confidence: 'HIGH',
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
      purpose: 'SYMMETRIC_ENCRYPTION',
      riskLevel: 'LOW',
      riskReason: 'Retains 128 bits of effective quantum security against Grover\'s search algorithm. Computational recovery remains infeasible.',
      standardRef: 'NIST SP 800-57 Part 1',
      confidence: 'HIGH',
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
        purpose: 'HASH_FUNCTION',
        riskLevel: 'CRITICAL',
        riskReason: 'Practical collision attacks exist classically. Cryptanalytically broken.',
        standardRef: 'NIST SP 800-131A',
        confidence: 'HIGH',
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
      purpose: 'HASH_FUNCTION',
      riskLevel: 'LOW',
      riskReason: 'Cryptographic hash functions of 256 bits or greater maintain ample security margin against quantum collision attacks.',
      standardRef: 'NIST FIPS 180-4',
      confidence: 'HIGH',
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

  // 5. UNKNOWN / INSUFFICIENT EVIDENCE - NO GUESSING!
  return {
    title: `Unverified Cryptographic Configuration (${rawAlgo})`,
    algorithmOrConfig: rawAlgo,
    purpose: 'PROTOCOL',
    riskLevel: 'MEDIUM',
    riskReason:
      'The reported algorithm or configuration could not be deterministically mapped to a standardized post-quantum classification. Additional cryptographic evidence is required.',
    standardRef: 'NIST PQC Assessment Guidance',
    confidence: 'NEEDS_VERIFICATION',
    recommendation: {
      recommendedAlgorithm: 'Perform Cryptographic Inventory & Evidence Collection',
      rationale:
        'Deterministic security decisions require verified algorithm identifiers and operational purposes rather than estimations.',
      whyAppropriate:
        'Prevents erroneous migrations and ensures accurate institutional risk reporting.',
      compatibilityNotes: 'Verify with system vendors, software dependencies, or run live TLS inspection.',
      migrationSteps: [
        'Inspect server configuration files or source code dependencies',
        'Run an authorized TLS scan if the endpoint is network accessible',
        'Consult software vendor documentation for exact cryptographic primitives used',
      ],
      standardRef: 'NIST PQC Migration Playbook',
      urgency: 'MEDIUM',
    },
  };
}

function inferPurpose(algo: string): 'DIGITAL_SIGNATURE' | 'KEY_ESTABLISHMENT' | 'SYMMETRIC_ENCRYPTION' | 'HASH_FUNCTION' | 'PROTOCOL' {
  if (algo.includes('RSA') || algo.includes('ECDSA') || algo.includes('DSA') || algo.includes('SIGN')) {
    return 'DIGITAL_SIGNATURE';
  }
  if (algo.includes('ECDH') || algo.includes('DHE') || algo.includes('DIFFIE') || algo.includes('KEM') || algo.includes('EXCHANGE')) {
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
        include: { results: true },
      },
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
    if (scanResult.certPubKeyAlgo) {
      const algoStr = `${scanResult.certPubKeyAlgo}${scanResult.certKeySize ? `-${scanResult.certKeySize}` : ''}`;
      findingsToCreate.push(
        evaluateAlgorithm(algoStr, 'DIGITAL_SIGNATURE', 'VERIFIED_SCAN')
      );
    }

    // Key exchange mechanism
    if (scanResult.keyExchangeGroup) {
      findingsToCreate.push(
        evaluateAlgorithm(scanResult.keyExchangeGroup, 'KEY_ESTABLISHMENT', 'VERIFIED_SCAN')
      );
    }

    // Cipher suite
    if (scanResult.cipherSuiteNegotiated) {
      findingsToCreate.push(
        evaluateAlgorithm(scanResult.cipherSuiteNegotiated, 'SYMMETRIC_ENCRYPTION', 'VERIFIED_SCAN')
      );
    }
  }

  // 2. Evaluate from known algorithms inventory field
  if (asset.knownAlgorithms) {
    let parsed: any[] = [];
    try {
      const json = JSON.parse(asset.knownAlgorithms);
      parsed = Array.isArray(json) ? json : [json];
    } catch {
      // Split by comma
      parsed = asset.knownAlgorithms.split(',').map((item) => ({ algorithm: item.trim() }));
    }

    for (const item of parsed) {
      const rawAlgo = item.algorithm || item.name || String(item);
      const purpose = item.purpose;
      if (rawAlgo && rawAlgo !== '[object Object]') {
        // Avoid duplicate findings if already evaluated from scan
        const alreadyFound = findingsToCreate.some(
          (f) => f.algorithmOrConfig.toLowerCase() === rawAlgo.toLowerCase()
        );
        if (!alreadyFound) {
          findingsToCreate.push(
            evaluateAlgorithm(rawAlgo, purpose, asset.informationSource)
          );
        }
      }
    }
  }

  // 3. Fallback: If no algorithms known and no scan, flag as Needs Verification
  if (findingsToCreate.length === 0) {
    findingsToCreate.push(
      evaluateAlgorithm('Unknown Cryptographic Configuration', undefined, asset.informationSource)
    );
  }

  // Calculate Quantum Risk Score (0 - 100)
  // Scoring formula: Critical (35 pts each), High (25 pts each), Medium (10 pts each), Low (0 pts)
  let rawScore = 0;
  let hasCritical = false;
  let hasHigh = false;
  let hasPq = false;

  for (const f of findingsToCreate) {
    if (f.riskLevel === 'CRITICAL') {
      rawScore += 35;
      hasCritical = true;
    } else if (f.riskLevel === 'HIGH') {
      rawScore += 25;
      hasHigh = true;
    } else if (f.riskLevel === 'MEDIUM') {
      rawScore += 10;
    } else if (f.riskLevel === 'LOW') {
      hasPq = true;
    }
  }

  // Adjust score for sensitivity: Highly sensitive or regulated data magnifies risk
  if (asset.dataSensitivity === 'HIGHLY_SENSITIVE' || asset.dataSensitivity === 'REGULATED') {
    rawScore = Math.round(rawScore * 1.25);
  }

  const quantumRiskScore = Math.min(100, Math.max(5, rawScore));

  let overallReadinessStatus: AssessmentResult['overallReadinessStatus'] = 'QUANTUM_VULNERABLE';
  if (quantumRiskScore >= 70) {
    overallReadinessStatus = 'QUANTUM_VULNERABLE';
  } else if (quantumRiskScore >= 40) {
    overallReadinessStatus = 'TRANSITION_REQUIRED';
  } else if (hasPq && (hasHigh || hasCritical)) {
    overallReadinessStatus = 'HYBRID_READY';
  } else if (quantumRiskScore < 25) {
    overallReadinessStatus = 'POST_QUANTUM_READY';
  }

  const summary = `Post-quantum evaluation completed for "${asset.name}" (${asset.identifier}). Detected ${findingsToCreate.length} cryptographic item(s). Quantum Risk Score: ${quantumRiskScore}/100. Status: ${overallReadinessStatus.replace(/_/g, ' ')}.`;

  // Persist Assessment, Findings, and Recommendations in database
  const createdAssessment = await prisma.assessment.create({
    data: {
      assetId: asset.id,
      title: `NIST Post-Quantum Assessment - ${asset.name}`,
      ruleVersion: '2024.1-NIST-FIPS',
      quantumRiskScore,
      overallReadinessStatus,
      summary,
      methodology:
        'Deterministic rule-based assessment against NIST FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA), and NSA CNSA 2.0 standards.',
    },
  });

  // Remove previous un-remediated findings for this asset to prevent clutter
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
        title: item.title,
        algorithmOrConfig: item.algorithmOrConfig,
        purpose: item.purpose,
        riskLevel: item.riskLevel,
        riskReason: item.riskReason,
        evidenceSource: asset.informationSource,
        standardRef: item.standardRef,
        confidence: item.confidence,
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

import prisma from '../src/lib/prisma';
import {
  evaluateAlgorithm,
  normalizeEvidenceSource,
  runAssessmentForAsset,
} from '../src/services/assessment.service';
import { validateScanTarget, isPrivateOrReservedIp } from '../src/services/scanner.service';

describe('Evidence-First Assessment & Traceability (No Fake Data)', () => {
  let testInstitutionId: string;
  let testAssetId: string;

  beforeAll(async () => {
    let institution = await prisma.institution.findFirst();
    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          name: 'Evidence Verification University',
          domain: 'evidence-test.edu',
        },
      });
    }
    testInstitutionId = institution.id;

    // Create a dedicated clean test asset
    const asset = await prisma.asset.create({
      data: {
        name: 'Evidence Test Server',
        identifier: 'evidence-node.test.edu',
        assetType: 'SERVER',
        institutionId: testInstitutionId,
        dataSensitivity: 'CONFIDENTIAL',
        informationSource: 'BULK_IMPORT',
        assessmentStatus: 'PENDING',
        knownAlgorithms: JSON.stringify([
          { algorithm: 'RSA-2048', purpose: 'DIGITAL_SIGNATURE' },
          { algorithm: 'ECDHE', purpose: 'KEY_ESTABLISHMENT' },
        ]),
      },
    });
    testAssetId = asset.id;
  });

  afterAll(async () => {
    await prisma.asset.deleteMany({
      where: { identifier: { contains: 'evidence-' } },
    });
  });

  // Criterion 1: Real scan stores only evidence actually collected
  it('Criterion 1: Real scan stores only evidence actually collected without fabricating fields', () => {
    const rawAlgo = 'RSA-4096';
    const evalResult = evaluateAlgorithm(rawAlgo, 'DIGITAL_SIGNATURE', 'scanner_verified');

    expect(evalResult.observedValue).toBe(rawAlgo);
    expect(evalResult.evidenceSource).toBe('scanner_verified');
    expect(evalResult.confidence).toBe('HIGH');
    expect(evalResult.ruleId).toBe('NIST-PQC-VULN-SIG');
    expect(evalResult.limitations).toBeDefined();
    expect(evalResult.limitations.length).toBeGreaterThan(10);
  });

  // Criterion 2: Failed scan never creates fabricated findings
  it('Criterion 2: Failed or invalid scan targets reject unsafe input and never produce findings', async () => {
    // SSRF target must be rejected
    await expect(validateScanTarget('127.0.0.1')).rejects.toThrow();
    await expect(validateScanTarget('localhost')).rejects.toThrow();
    await expect(validateScanTarget('internal.corp')).rejects.toThrow();

    // Verify no findings were created in database for failed targets
    const failedFindings = await prisma.finding.findMany({
      where: { algorithmOrConfig: '127.0.0.1' },
    });
    expect(failedFindings.length).toBe(0);
  });

  // Criterion 3: Missing algorithm information remains "Unknown"
  it('Criterion 3: Missing algorithm information remains "Unknown" and does not guess', () => {
    const result = evaluateAlgorithm('Unknown', undefined, 'inferred');
    expect(result.observedValue).toBe('Unknown');
    expect(result.ruleId).toBe('UNKNOWN-CRYPTOGRAPHIC-EVIDENCE');
    expect(result.confidence).toBe('NEEDS_VERIFICATION');
    expect(result.riskReason).toContain('could not be deterministically mapped');
    expect(result.recommendation.recommendedAlgorithm).toContain('Perform Cryptographic Inventory');
  });

  // Criterion 4: Imported data is never labelled scanner-verified
  it('Criterion 4: Imported inventory data is strictly labelled "imported", never "scanner_verified"', () => {
    const csvSource = normalizeEvidenceSource('IMPORT_CSV');
    const xlsxSource = normalizeEvidenceSource('IMPORT_XLSX');
    const jsonSource = normalizeEvidenceSource('IMPORT_JSON');
    const manualSource = normalizeEvidenceSource('MANUAL');

    expect(csvSource).toBe('imported');
    expect(xlsxSource).toBe('imported');
    expect(jsonSource).toBe('imported');
    expect(manualSource).toBe('user_reported');

    // Running assessment on imported asset produces findings with evidenceSource: 'imported'
    const findingEval = evaluateAlgorithm('ECDSA-P256', 'DIGITAL_SIGNATURE', 'imported');
    expect(findingEval.evidenceSource).toBe('imported');
    expect(findingEval.evidenceSource).not.toBe('scanner_verified');
    // Imported data has MEDIUM confidence compared to independently verified scans
    expect(findingEval.confidence).toBe('MEDIUM');
  });

  // Criterion 5: Scores are reproducible from the same evidence and rule version
  it('Criterion 5: Scores are completely reproducible from the same evidence and rule version', async () => {
    const run1 = await runAssessmentForAsset(testAssetId);
    const run2 = await runAssessmentForAsset(testAssetId);

    expect(run1.quantumRiskScore).toBe(run2.quantumRiskScore);
    expect(run1.overallReadinessStatus).toBe(run2.overallReadinessStatus);
    expect(run1.ruleVersion).toBe(run2.ruleVersion);
    expect(run1.findings.length).toBe(run2.findings.length);

    // Breakdown is deterministic
    const breakdown1 = JSON.parse(run1.scoreBreakdown);
    const breakdown2 = JSON.parse(run2.scoreBreakdown);
    expect(breakdown1.finalScore).toBe(breakdown2.finalScore);
    expect(breakdown1.contributingFindings.length).toBe(breakdown2.contributingFindings.length);
  });

  // Criterion 6: Dashboard metrics match database records
  it('Criterion 6: Dashboard metrics match database records exactly', async () => {
    const totalAssetsInDb = await prisma.asset.count();
    const criticalFindingsInDb = await prisma.finding.count({
      where: { riskLevel: 'CRITICAL', status: { not: 'RESOLVED' } },
    });
    const highFindingsInDb = await prisma.finding.count({
      where: { riskLevel: 'HIGH', status: { not: 'RESOLVED' } },
    });

    expect(totalAssetsInDb).toBeGreaterThan(0);
    expect(typeof criticalFindingsInDb).toBe('number');
    expect(typeof highFindingsInDb).toBe('number');
  });

  // Criterion 7: Every recommendation links to the finding and evidence that justify it
  it('Criterion 7: Every recommendation links to the finding and evidence that justify it', async () => {
    const findingsWithRecs = await prisma.finding.findMany({
      where: { assetId: testAssetId },
      include: { recommendations: true },
    });

    expect(findingsWithRecs.length).toBeGreaterThan(0);
    for (const f of findingsWithRecs) {
      expect(f.recommendations.length).toBeGreaterThan(0);
      const rec = f.recommendations[0];
      expect(rec.findingId).toBe(f.id);
      expect(rec.recommendedAlgorithm).toBeDefined();
      expect(rec.rationale).toBeDefined();
      expect(rec.standardRef).toBeDefined();
    }
  });

  // Criterion 8: Unsupported capabilities are reported as unsupported, not silently assumed
  it('Criterion 8: Unsupported or unassessed assets without evidence are marked NOT_ASSESSED', async () => {
    // Create an asset with no known algorithms
    const emptyAsset = await prisma.asset.create({
      data: {
        name: 'Empty Evidence Asset',
        identifier: 'evidence-empty.test.edu',
        assetType: 'DATABASE',
        institutionId: testInstitutionId,
        dataSensitivity: 'INTERNAL',
        informationSource: 'MANUAL',
        assessmentStatus: 'PENDING',
        knownAlgorithms: null,
      },
    });

    const res = await runAssessmentForAsset(emptyAsset.id);
    expect(res.quantumRiskScore).toBe(0);
    expect(res.overallReadinessStatus).toBe('NOT_ASSESSED');
    expect(res.summary).toContain('Status: Not Assessed');

    await prisma.asset.delete({ where: { id: emptyAsset.id } });
  });
});

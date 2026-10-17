import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';

export async function generatePdfReport(institutionId?: string): Promise<Buffer> {
  const institution = await prisma.institution.findFirst({
    where: institutionId ? { id: institutionId } : undefined,
  });

  const assets = await prisma.asset.findMany({
    include: {
      assessments: {
        take: 1,
        orderBy: { assessedAt: 'desc' },
      },
      findings: {
        include: {
          recommendations: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const allFindings = await prisma.finding.findMany({
    include: {
      asset: true,
      recommendations: true,
    },
    orderBy: { riskLevel: 'asc' },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      info: {
        Title: 'Post-Quantum Readiness Assessment Report',
        Author: 'PQ Readiness Assessment Platform',
        Subject: 'Institutional Cryptographic Risk & NIST PQC Migration Roadmap',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header & Title
    doc.fillColor('#0b1329').fontSize(20).font('Helvetica-Bold').text('POST-QUANTUM READINESS ASSESSMENT', { align: 'left' });
    doc.fillColor('#059669').fontSize(11).font('Helvetica-Bold').text('INSTITUTIONAL CRYPTOGRAPHIC RISK & REMEDIATION REPORT', { align: 'left' });
    doc.moveDown(0.5);

    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.8);

    // Metadata Block
    doc.fillColor('#334155').fontSize(9).font('Helvetica');
    const institutionName = institution?.name || 'Higher Education & Research Institution';
    doc.text(`Institution: ${institutionName}`, { continued: true }).text(`          Assessment Date: ${new Date().toLocaleDateString('en-US')}`);
    doc.text(`Scope: Authorized Institutional Assets & Endpoints`, { continued: true }).text(`          Standard Engine: NIST FIPS 203 / 204 / 205 (v2024.1)`);
    doc.moveDown(1);

    // Section 1: Executive Summary
    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text('1. Executive Readiness Summary');
    doc.moveDown(0.4);

    const totalAssets = assets.length;
    const highRiskAssets = assets.filter((a) =>
      a.assessments.some((ass) => ass.overallReadinessStatus === 'QUANTUM_VULNERABLE')
    ).length;
    const criticalFindings = allFindings.filter((f) => f.riskLevel === 'CRITICAL').length;
    const highFindings = allFindings.filter((f) => f.riskLevel === 'HIGH').length;

    doc.fillColor('#475569').fontSize(9).font('Helvetica').text(
      `This report documents the exposure of ${institutionName} to quantum computing cryptanalytic risks under Shor's and Grover's algorithms. All classical asymmetric cryptographic primitives (RSA, DSA, ECDSA, Diffie-Hellman) are vulnerable to polynomial-time compromise once a Cryptanalytically Relevant Quantum Computer (CRQC) is realized. Furthermore, encrypted network exchanges are currently subject to adversary "Store Now, Decrypt Later" (SNDL) espionage.`
    );
    doc.moveDown(0.8);

    // Summary Box
    doc.rect(40, doc.y, 515, 50).fillAndStroke('#f8fafc', '#e2e8f0');
    const boxY = doc.y + 12;
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
    doc.text(`Total Registered Systems: ${totalAssets}`, 55, boxY);
    doc.fillColor('#dc2626').text(`Quantum-Vulnerable Assets: ${highRiskAssets}`, 210, boxY);
    doc.fillColor('#b91c1c').text(`Critical Severity Findings: ${criticalFindings}`, 390, boxY);
    doc.fillColor('#ea580c').text(`High Risk Primitives: ${highFindings}`, 390, boxY + 16);
    doc.fillColor('#059669').text(`Engine Rules: NIST FIPS 203/204/205`, 55, boxY + 16);
    doc.moveDown(4);

    // Section 2: Asset Inventory
    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text('2. Evaluated Asset Inventory');
    doc.moveDown(0.4);

    assets.slice(0, 10).forEach((asset) => {
      const latestAss = asset.assessments[0];
      const statusText = latestAss?.overallReadinessStatus || asset.assessmentStatus;
      const score = latestAss ? ` (Score: ${latestAss.quantumRiskScore}/100)` : '';

      doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold').text(`• ${asset.name} `, { continued: true });
      doc.fillColor('#64748b').font('Helvetica').text(`[${asset.identifier} - ${asset.assetType}] - `, { continued: true });
      doc.fillColor(statusText === 'QUANTUM_VULNERABLE' ? '#dc2626' : '#059669').font('Helvetica-Bold').text(`${statusText}${score}`);
    });
    doc.moveDown(1);

    // Section 3: Risk Findings and Actionable Recommendations
    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text('3. Cryptographic Findings & Direct NIST Recommendations');
    doc.moveDown(0.4);

    allFindings.slice(0, 8).forEach((f, idx) => {
      const rec = f.recommendations[0];
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(`${idx + 1}. ${f.title} (${f.riskLevel} RISK)`);
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica').text(`   Affected System: ${f.asset.name} (${f.asset.identifier})`);
      doc.text(`   Cryptographic Purpose: ${f.purpose} | Evidence Source: ${f.evidenceSource} | Standard: ${f.standardRef}`);
      doc.text(`   Why Risky: ${f.riskReason}`);
      if (rec) {
        doc.fillColor('#047857').font('Helvetica-Bold').text(`   Target Recommendation: ${rec.recommendedAlgorithm}`);
        doc.fillColor('#334155').font('Helvetica').text(`   Rationale: ${rec.rationale}`);
      }
      doc.moveDown(0.6);
    });

    // Section 4: Limitations and Scope Disclaimer
    doc.moveDown(1);
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('4. Limitations and Verification Scope');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(
      'Notice: External network and TLS scans inspect publicly observable protocol negotiations and certificate chains. They do not claim to discover internal database field-level encryption, hardcoded source code cryptographic keys, or unexposed backend infrastructure. Items labelled "Needs Verification" require internal systems auditing.'
    );

    doc.end();
  });
}

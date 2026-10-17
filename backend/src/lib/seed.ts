import bcrypt from 'bcryptjs';
import prisma from './prisma';

export async function seedDatabase() {
  console.log('[Seed] Checking existing baseline institutional data...');

  let institution = await prisma.institution.findFirst({
    where: { domain: 'apex.edu' },
  });

  if (!institution) {
    institution = await prisma.institution.create({
      data: {
        name: 'Apex University of Science & Technology',
        domain: 'apex.edu',
        contactEmail: 'infosec@apex.edu',
        type: 'UNIVERSITY',
      },
    });
    console.log(`[Seed] Created institution: ${institution.name}`);
  }

  // Check admin users
  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@apex.edu' },
  });

  if (!adminUser) {
    const passwordHash = await bcrypt.hash('Admin@123456', 10);
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@apex.edu',
        name: 'Dr. Evelyn Reed (Chief Information Security Officer)',
        passwordHash,
        role: 'ADMIN',
        institutionId: institution.id,
      },
    });
    console.log(`[Seed] Created default administrator: ${adminUser.email}`);
  }

  let internalAdmin = await prisma.user.findUnique({
    where: { email: 'admin@quantumrisk.internal' },
  });

  if (!internalAdmin) {
    const internalHash = await bcrypt.hash('Admin@PQ2026!', 10);
    internalAdmin = await prisma.user.create({
      data: {
        email: 'admin@quantumrisk.internal',
        name: 'QuantumRisk Platform Administrator',
        passwordHash: internalHash,
        role: 'ADMIN',
        institutionId: institution.id,
      },
    });
    console.log(`[Seed] Created internal administrator: ${internalAdmin.email}`);
  }

  // Check baseline assets
  const existingAssetsCount = await prisma.asset.count({
    where: { institutionId: institution.id },
  });

  if (existingAssetsCount === 0) {
    console.log('[Seed] Inserting baseline institutional assets...');
    const baselineAssets = [
      {
        name: 'Student & Faculty Authentication Portal',
        identifier: 'portal.apex.edu',
        assetType: 'WEBSITE',
        institutionId: institution.id,
        dataSensitivity: 'CONFIDENTIAL',
        knownAlgorithms: JSON.stringify([
          { algorithm: 'RSA-2048', purpose: 'DIGITAL_SIGNATURE' },
          { algorithm: 'ECDHE', purpose: 'KEY_ESTABLISHMENT' },
          { algorithm: 'AES-128-GCM', purpose: 'SYMMETRIC_ENCRYPTION' },
        ]),
        informationSource: 'MANUAL',
        assessmentStatus: 'PENDING',
        tlsVersion: 'TLSv1.2',
        port: 443,
        environment: 'PRODUCTION',
        notes: 'Central SSO portal servicing 28,000 undergraduate and graduate students.',
      },
      {
        name: 'Institutional Research Data Archive',
        identifier: 'research-archive.apex.edu',
        assetType: 'STORAGE_BACKUP',
        institutionId: institution.id,
        dataSensitivity: 'HIGHLY_SENSITIVE',
        knownAlgorithms: JSON.stringify([
          { algorithm: 'RSA-4096', purpose: 'DIGITAL_SIGNATURE' },
          { algorithm: 'AES-256-CBC', purpose: 'SYMMETRIC_ENCRYPTION' },
          { algorithm: 'SHA-256', purpose: 'HASH_FUNCTION' },
        ]),
        informationSource: 'MANUAL',
        assessmentStatus: 'PENDING',
        tlsVersion: 'TLSv1.3',
        port: 443,
        environment: 'PRODUCTION',
        notes: 'Stores 10-20 year longitudinal biomedical and quantum physics experimental data.',
      },
      {
        name: 'Campus Enterprise VPN Gateway',
        identifier: 'vpn.apex.edu',
        assetType: 'SERVER',
        institutionId: institution.id,
        dataSensitivity: 'CONFIDENTIAL',
        knownAlgorithms: JSON.stringify([
          { algorithm: 'Diffie-Hellman-2048', purpose: 'KEY_ESTABLISHMENT' },
          { algorithm: 'RSA-2048', purpose: 'DIGITAL_SIGNATURE' },
          { algorithm: 'AES-256-GCM', purpose: 'SYMMETRIC_ENCRYPTION' },
        ]),
        informationSource: 'MANUAL',
        assessmentStatus: 'PENDING',
        tlsVersion: 'TLSv1.2',
        port: 443,
        environment: 'PRODUCTION',
        notes: 'Remote gateway for administrative, faculty, and off-campus hospital research access.',
      },
      {
        name: 'Institutional Root Certification Authority',
        identifier: 'apex-internal-root-ca-01',
        assetType: 'DIGITAL_CERTIFICATE',
        institutionId: institution.id,
        dataSensitivity: 'HIGHLY_SENSITIVE',
        knownAlgorithms: JSON.stringify([
          { algorithm: 'RSA-4096', purpose: 'DIGITAL_SIGNATURE' },
          { algorithm: 'SHA-384', purpose: 'HASH_FUNCTION' },
        ]),
        informationSource: 'MANUAL',
        assessmentStatus: 'PENDING',
        port: 443,
        environment: 'PRODUCTION',
        notes: 'Private PKI issuing enterprise device certificates, VPN credentials, and internal TLS certs.',
      },
      {
        name: 'Quantum Optics Simulation Cluster API',
        identifier: 'q-cluster.lab.apex.edu',
        assetType: 'APPLICATION',
        institutionId: institution.id,
        dataSensitivity: 'HIGHLY_SENSITIVE',
        knownAlgorithms: JSON.stringify([
          { algorithm: 'ECDSA-P384', purpose: 'DIGITAL_SIGNATURE' },
          { algorithm: 'ECDHE-P384', purpose: 'KEY_ESTABLISHMENT' },
          { algorithm: 'AES-256-GCM', purpose: 'SYMMETRIC_ENCRYPTION' },
        ]),
        informationSource: 'MANUAL',
        assessmentStatus: 'PENDING',
        tlsVersion: 'TLSv1.3',
        port: 443,
        environment: 'PRODUCTION',
        notes: 'High-performance computing cluster for quantum chemistry and physics modeling.',
      },
      {
        name: 'Student Financial & Registrar Database',
        identifier: 'sis-db.internal.apex.edu',
        assetType: 'DATABASE',
        institutionId: institution.id,
        dataSensitivity: 'REGULATED',
        knownAlgorithms: JSON.stringify([
          { algorithm: 'AES-256-CBC', purpose: 'SYMMETRIC_ENCRYPTION' },
          { algorithm: 'RSA-2048', purpose: 'DIGITAL_SIGNATURE' },
        ]),
        informationSource: 'MANUAL',
        assessmentStatus: 'PENDING',
        port: 5432,
        environment: 'PRODUCTION',
        notes: 'FERPA & PCI-DSS regulated repository storing student financial transactions and grades.',
      },
    ];

    for (const assetData of baselineAssets) {
      await prisma.asset.create({ data: assetData });
    }
    console.log(`[Seed] Seeded ${baselineAssets.length} baseline institutional assets.`);
  }

  return {
    institution: { id: institution.id, name: institution.name, domain: institution.domain },
    adminEmail: adminUser.email,
  };
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Seeding completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Error seeding database:', err);
      process.exit(1);
    });
}

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "contactEmail" TEXT,
    "type" TEXT NOT NULL DEFAULT 'UNIVERSITY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ANALYST',
    "institutionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "dataSensitivity" TEXT NOT NULL DEFAULT 'CONFIDENTIAL',
    "knownAlgorithms" TEXT,
    "informationSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "assessmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "tlsVersion" TEXT,
    "port" INTEGER NOT NULL DEFAULT 443,
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT,
    "assetId" TEXT,
    "targetHost" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 443,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "scanType" TEXT NOT NULL DEFAULT 'TLS_INSPECTION',
    "authorizationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "authorizedBy" TEXT,
    "ipAddress" TEXT,
    "executionTimeMs" INTEGER,
    "errorMessage" TEXT,
    "userId" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanJob_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScanJob_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScanJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanJobId" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "checkType" TEXT NOT NULL DEFAULT 'TLS',
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "observedData" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanCheck_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT,
    "scanJobId" TEXT,
    "scanCheckId" TEXT,
    "evidenceSource" TEXT NOT NULL DEFAULT 'scanner_verified',
    "evidenceType" TEXT NOT NULL,
    "observedProperty" TEXT NOT NULL,
    "observedValue" TEXT NOT NULL,
    "rawPayload" TEXT,
    "scannerVersion" TEXT,
    "verifiedAt" DATETIME,
    "hashDigest" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Evidence_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evidence_scanCheckId_fkey" FOREIGN KEY ("scanCheckId") REFERENCES "ScanCheck" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanJobId" TEXT NOT NULL,
    "targetHost" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "tlsVersionNegotiated" TEXT,
    "supportedTlsVersions" TEXT,
    "cipherSuiteNegotiated" TEXT,
    "supportedCipherSuites" TEXT,
    "certSubject" TEXT,
    "certIssuer" TEXT,
    "certValidFrom" DATETIME,
    "certValidTo" DATETIME,
    "certPubKeyAlgo" TEXT,
    "certKeySize" INTEGER,
    "certSignatureAlgo" TEXT,
    "certSerial" TEXT,
    "keyExchangeGroup" TEXT,
    "isPqHybrid" BOOLEAN NOT NULL DEFAULT false,
    "ocspStapled" BOOLEAN NOT NULL DEFAULT false,
    "rawDetails" TEXT,
    "scannerVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanResult_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL DEFAULT '2024.1-NIST-FIPS',
    "quantumRiskScore" INTEGER NOT NULL,
    "overallReadinessStatus" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "scoreBreakdown" TEXT,
    "assessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT,
    "assetId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "title" TEXT NOT NULL,
    "algorithmOrConfig" TEXT NOT NULL,
    "observedValue" TEXT,
    "purpose" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "riskReason" TEXT NOT NULL,
    "evidenceSource" TEXT NOT NULL,
    "standardRef" TEXT NOT NULL,
    "ruleId" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'HIGH',
    "limitations" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "owner" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'HIGH',
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Finding_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Finding_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Finding_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "recommendedAlgorithm" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "whyAppropriate" TEXT NOT NULL,
    "compatibilityNotes" TEXT NOT NULL,
    "migrationSteps" TEXT NOT NULL,
    "standardRef" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'HIGH',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recommendation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportJob_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" TEXT,
    "errorMessage" TEXT NOT NULL,
    CONSTRAINT "ImportError_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemediationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'HIGH',
    "dueDate" DATETIME,
    "resolvedAt" DATETIME,
    "resolutionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RemediationTask_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "institutionId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");


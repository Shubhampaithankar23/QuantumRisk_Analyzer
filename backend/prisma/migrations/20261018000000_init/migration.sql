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
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "provenance" TEXT NOT NULL DEFAULT 'imported',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "evidenceSource" TEXT NOT NULL DEFAULT 'user_reported',
    "department" TEXT,
    "owner" TEXT,
    "criticality" TEXT NOT NULL DEFAULT 'MEDIUM',
    "cryptoInventory" TEXT,
    "certSignatureAlgo" TEXT,
    "certPubKeyAlgo" TEXT,
    "certKeySize" INTEGER,
    "certExpiryDate" DATETIME,
    "cipherSuite" TEXT,
    "keyExchangeGroup" TEXT,
    CONSTRAINT "Asset_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetHost" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 443,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "tlsVersionNegotiated" TEXT,
    "cipherSuiteNegotiated" TEXT,
    "kexGroupNegotiated" TEXT,
    "certSignatureAlgo" TEXT,
    "certPubKeyAlgo" TEXT,
    "certKeySize" INTEGER,
    "certExpiryDate" DATETIME,
    "errorMessage" TEXT,
    "rawScanOutput" TEXT,
    "assetId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scan_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PASS',
    "target" TEXT NOT NULL,
    "details" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanCheck_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT,
    "assetId" TEXT,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "digest" TEXT,
    "source" TEXT NOT NULL DEFAULT 'scanner_verified',
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Evidence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "quantumRiskScore" REAL NOT NULL,
    "overallStatus" TEXT NOT NULL DEFAULT 'VULNERABLE',
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rulesEngineVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "scoreBreakdown" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'HIGH',
    CONSTRAINT "Assessment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "algorithmOrConfig" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "quantumRiskLevel" TEXT NOT NULL,
    "riskReason" TEXT NOT NULL,
    "evidenceSource" TEXT NOT NULL DEFAULT 'scanner_verified',
    "confidence" TEXT NOT NULL DEFAULT 'HIGH',
    "remediationStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "remediationNotes" TEXT,
    "evidenceId" TEXT,
    "remediationOwner" TEXT,
    "remediationDueDate" DATETIME,
    "resolvedAt" DATETIME,
    "standardsReference" TEXT,
    "scopeLimitation" TEXT,
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
    "migrationComplexity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "urgency" TEXT NOT NULL DEFAULT 'PLAN_NOW',
    "standardDocument" TEXT NOT NULL DEFAULT 'NIST FIPS 203/204/205',
    "hybridOption" TEXT,
    "actionSteps" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
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
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportJob_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "userId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_domain_key" ON "Institution"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_identifier_institutionId_key" ON "Asset"("identifier", "institutionId");

-- CreateIndex
CREATE INDEX "ScanCheck_scanId_idx" ON "ScanCheck"("scanId");

-- CreateIndex
CREATE INDEX "Evidence_scanId_idx" ON "Evidence"("scanId");

-- CreateIndex
CREATE INDEX "Evidence_assetId_idx" ON "Evidence"("assetId");

-- CreateIndex
CREATE INDEX "Finding_assessmentId_idx" ON "Finding"("assessmentId");

-- CreateIndex
CREATE INDEX "Finding_assetId_idx" ON "Finding"("assetId");

-- CreateIndex
CREATE INDEX "Finding_evidenceId_idx" ON "Finding"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_findingId_key" ON "Recommendation"("findingId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

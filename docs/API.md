# REST API Documentation: PQ Readiness Assessment Platform

Base URL: `http://localhost:4000/api/v1`

All responses follow a consistent JSON format:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message",
  "meta": { ... }
}
```

---

## 1. Health & System
- `GET /api/v1/health`
  - Returns backend health, version, database connection state, and uptime.
- `GET /api/v1/system/rules`
  - Returns active post-quantum assessment rules, rule engine version, and NIST standard references.

## 2. Authentication & Institution
- `POST /api/v1/auth/login`
  - Authenticate administrative or analyst user.
- `GET /api/v1/auth/me`
  - Current session details and user permissions.
- `POST /api/v1/auth/seed-demo`
  - Seeds sample institution and baseline data for local evaluation.

## 3. Asset Inventory
- `GET /api/v1/assets`
  - List assets with optional filtering (`assetType`, `dataSensitivity`, `assessmentStatus`, `search`).
- `GET /api/v1/assets/:id`
  - Retrieve single asset with associated scan results, assessments, and findings.
- `POST /api/v1/assets`
  - Create a new asset record.
- `PUT /api/v1/assets/:id`
  - Update existing asset attributes.
- `DELETE /api/v1/assets/:id`
  - Delete an asset and associated findings.

## 4. Bulk File Imports
- `POST /api/v1/imports/preview`
  - Multi-part form-data accepting CSV, XLSX, or JSON files. Parses records, performs column mapping, detects duplicates, and returns validation summary without writing to DB.
- `POST /api/v1/imports/execute`
  - Confirms import of validated records into database, categorizing them as "Imported Evidence". Returns success count and error log.

## 5. Website Scanning Service
- `POST /api/v1/scans`
  - Initiates a TLS/crypto scan against an authorized target host.
  - Body: `{ "targetHost": "portal.university.edu", "port": 443, "confirmAuthorized": true }`
  - Security validation: validates host, runs SSRF safety checks, rejects private/loopback/cloud-metadata targets.
- `GET /api/v1/scans/:id`
  - Status and results of a specific scan job.
- `GET /api/v1/scans`
  - History of recent scans.

## 6. Assessments & Findings
- `POST /api/v1/assessments/run/:assetId`
  - Evaluates an asset's cryptographic profile against the NIST rules engine and generates findings & recommendations.
- `POST /api/v1/assessments/run-all`
  - Evaluates all registered assets in batch.
- `GET /api/v1/assessments`
  - Lists historical assessments.
- `GET /api/v1/assessments/:id`
  - Detailed assessment report with score breakdown and findings.
- `GET /api/v1/findings`
  - List findings across assets with filtering (`riskLevel`, `status`, `assetType`).
- `PATCH /api/v1/findings/:id`
  - Update finding status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `ACCEPTED_RISK`), owner, or due date.
- `GET /api/v1/recommendations`
  - List direct algorithm replacement recommendations.

## 7. Dashboard Metrics
- `GET /api/v1/dashboard/stats`
  - Returns aggregate counts: total assets, assessed assets, high/critical risk count, pending assessments, risk distribution, and urgent actions.

## 8. Reports & PDF Export
- `GET /api/v1/reports/summary`
  - Generates comprehensive institutional readiness summary data.
- `GET /api/v1/reports/export/pdf`
  - Downloads structured PDF assessment report ready for institutional leadership and auditors.

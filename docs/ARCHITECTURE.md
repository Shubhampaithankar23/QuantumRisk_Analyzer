# System Architecture: PQ Readiness Assessment Platform

## 1. System Overview

```
                      +---------------------------------------+
                      |       Next.js Frontend (Port 3000)     |
                      |   App Router, Tailwind CSS, Lucide    |
                      +-------------------+-------------------+
                                          |
                                HTTP REST /api/v1
                                          |
                                          v
                      +---------------------------------------+
                      |     Express.js Backend (Port 4000)    |
                      | TypeScript, Helmet, Rate Limiter, CORS|
                      +-----+-------------+-------------+-----+
                            |             |             |
           +----------------+             |             +---------------+
           |                              |                             |
           v                              v                             v
+--------------------+        +--------------------+        +--------------------+
| SQLite / Prisma    |        | TLS Scanner Engine |        | Assessment Engine  |
| - Institutions     |        | - TLS 1.0 - 1.3    |        | - NIST FIPS 203    |
| - Assets           |        | - Cert Extraction  |        | - NIST FIPS 204    |
| - Assessments      |        | - Cipher Suites    |        | - NIST FIPS 205    |
| - Findings         |        | - SSRF Guard       |        | - CNSA 2.0         |
| - Remediation      |        +--------------------+        +--------------------+
+--------------------+
```

## 2. Component Design

### 2.1 Frontend (`/frontend`)
- **Framework**: Next.js 14+ with React 18/19, TypeScript
- **Styling**: Tailwind CSS configured with custom color palette (Dark slate/navy `#0B132B`, `#1C2541`, rich emerald accents `#10B981`, crisp neutral background `#F8FAFC`).
- **Pages / Views**:
  - `/` (Dashboard): Institution overview, readiness score distribution, urgent findings, recent scans.
  - `/assets`: Institutional asset inventory, filtering by criticality and type, manual creation and editing.
  - `/scan-import`: Dual-purpose workspace for single-host authorized TLS scanning and bulk multi-file upload (CSV, XLSX, JSON).
  - `/assessments`: Assessment execution records, asset-specific quantum risk scoring (0-100), re-assessment triggers.
  - `/findings`: Granular vulnerability findings, purpose-specific categorization, severity badges.
  - `/recommendations`: Direct NIST-aligned migration roadmaps with step-by-step guidance.
  - `/reports`: Executive assessment report generation and PDF downloads.
  - `/settings`: Institution metadata, engine rule versions, audit logging.

### 2.2 Backend (`/backend`)
- **Runtime**: Node.js 20+ with Express.js, TypeScript.
- **REST Endpoints**: Strictly under `/api/v1/`.
- **Database**: SQLite accessed via Prisma ORM for local, zero-external-dependency persistence.
- **Security Middlewares**:
  - `helmet`: Secure HTTP headers (HSTS, CSP, XSS protection).
  - `cors`: Restricted to authorized frontend origins.
  - `express-rate-limit`: Prevents abuse and denial of service.
  - Input validation: Zod or express-validator schemas on all inputs.
  - SSRF protection: DNS resolution and IP validation before scanning.

### 2.3 Post-Quantum Assessment Logic
The platform categorizes cryptographic algorithms by **functional purpose**:
1. **Key Establishment / Key Encapsulation (KEM)**
   - *Quantum Vulnerable*: RSA key exchange, DH, DHE, ECDH, ECDHE (vulnerable to Shor's algorithm; immediate Store Now Decrypt Later threat).
   - *Recommended PQ Replacement*: ML-KEM-768 or ML-KEM-1024 (NIST FIPS 203) / Hybrid schemes (X25519MLKEM768).
2. **Digital Signatures & Authentication**
   - *Quantum Vulnerable*: RSA (2048, 3072, 4096), ECDSA (P-256, P-384, P-521), Ed25519 (vulnerable to Shor's algorithm).
   - *Recommended PQ Replacement*: ML-DSA-65/87 (NIST FIPS 204) for general signatures, SLH-DSA (NIST FIPS 205) for stateless hash-based applications.
3. **Symmetric Encryption**
   - *Quantum Safe*: AES-256, ChaCha20-Poly1305 (Grover's algorithm halves key space; 256 bits retains 128-bit quantum security).
   - *Transitional*: AES-128 (retains 64-bit security against quantum attack; acceptable short term, phase out long term).
   - *Classically Broken*: 3DES, DES, RC4 (Critical risk).
4. **Cryptographic Hash Functions**
   - *Quantum Safe*: SHA-256, SHA-384, SHA-512, SHA-3 (Grover collision search requires large resources; SHA-384/512 recommended for CNSA 2.0).
   - *Classically Broken*: MD5, SHA-1 (Critical risk).

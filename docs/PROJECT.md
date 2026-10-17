# PQ Readiness Platform — Project Documentation & Tracking

## Project Overview
**PQ Readiness** is a dedicated Post-Quantum Security Assessment Platform tailored for higher education institutions, universities, colleges, and research organizations. It provides automated and inventory-based evaluation of cryptographic configurations, identifying quantum-vulnerable algorithms (e.g., RSA, ECDSA, ECDHE) and providing actionable, purpose-aligned migration recommendations based on NIST Post-Quantum Cryptography standards (FIPS 203, FIPS 204, FIPS 205).

---

## Architecture Summary
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide icons (`http://localhost:3000`)
- **Backend**: Node.js, Express.js, TypeScript, REST API under `/api/v1` (`http://localhost:4000`)
- **Database**: SQLite with Prisma ORM and migrations
- **Standards & Rules Engine**: NIST FIPS 203 (ML-KEM), NIST FIPS 204 (ML-DSA), NIST FIPS 205 (SLH-DSA), CNSA 2.0, SP 800-208

---

## Implementation Phases & Status

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Environment inspection, directory structure, Git, root package.json, documentation | **Completed** |
| **Phase 2** | SQLite, Prisma models, backend configuration, security middleware, health check API | **Completed** |
| **Phase 3** | Frontend layout, dark navy/green institutional theme, dashboard UI | **Completed** |
| **Phase 4** | Asset inventory management & bulk file import (CSV, XLSX, JSON) | **In Progress** |
| **Phase 5** | Authorized website scanner (TLS probing, cert extraction, SSRF security controls) | Planned |
| **Phase 6** | Post-quantum assessment engine & direct NIST-aligned recommendation generator | Planned |
| **Phase 7** | End-to-end integration of all frontend pages with backend REST APIs | Planned |
| **Phase 8** | Remediation task tracking & downloadable PDF reports | Planned |
| **Phase 9** | Comprehensive testing, security audit, and documentation finalization | Planned |

---

## Key Security & Technical Principles
1. **SSRF Guard**: Strict validation of scan target hostnames; denial of loopback, RFC1918 private IP addresses, cloud metadata endpoints (169.254.169.254), and non-standard TLS ports.
2. **Explicit Authorization Check**: Website scanning requires explicit affirmative administrative confirmation before execution.
3. **Purpose-Aligned Assessment**:
   - Digital signatures (RSA, ECDSA) are assessed for signature replacement (ML-DSA, SLH-DSA). ML-KEM is *never* recommended for signatures.
   - Key establishment (ECDH, ECDHE, DH) is assessed for key encapsulation replacement (ML-KEM). ML-DSA is *never* recommended for key exchange.
   - TLS 1.3 alone is *never* classified as proof of quantum safety without post-quantum or hybrid key exchange.
   - Unknown algorithms are flagged as "Needs Verification" rather than guessed.
4. **Data Integrity**: Imported inventory data is categorized as "Imported Evidence" and clearly distinguished from real-time verified TLS scan results.

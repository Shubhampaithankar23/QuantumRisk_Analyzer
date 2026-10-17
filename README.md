# PQ Readiness — Post-Quantum Security Assessment Platform

**PQ Readiness** is a specialized, open-source security assessment platform designed for universities, colleges, and research institutions to evaluate their exposure to quantum computing threats and systematically plan migrations to NIST Post-Quantum Cryptography (PQC) standards.

---

## Key Capabilities

- **Authorized Website & TLS Scanner**: Inspects TLS protocols (TLS 1.0 - 1.3), cipher suites, certificate public key algorithms, and key exchange mechanisms on authorized institutional endpoints. Protected by strict SSRF guards.
- **Bulk Multi-File Import**: Imports asset inventories from CSV, Excel (XLSX), and JSON files with multi-file drag-and-drop, schema mapping, duplicate detection, and import preview.
- **NIST-Aligned Post-Quantum Assessment Engine**: Deterministic evaluation based on official standards:
  - **FIPS 203 (ML-KEM)** for Key Encapsulation Mechanisms
  - **FIPS 204 (ML-DSA)** for Digital Signatures
  - **FIPS 205 (SLH-DSA)** for Stateless Hash-Based Signatures
  - **SP 800-208** and **CNSA 2.0**
- **Purpose-Specific Algorithm Evaluation**: Evaluates algorithms strictly by function (signatures vs key exchange vs symmetric encryption), preventing erroneous recommendations.
- **Direct Recommendations**: Provides understandable, evidence-backed migration paths with rationale, compatibility notes, and step-by-step remediation checklists.
- **Institutional Dashboard**: Clean, responsive dark navy and green UI presenting real asset counts, risk distributions, and remediation progress.
- **PDF Report Generation**: Downloadable executive reports for CIOs, CISOs, and security review boards.

---

## Technology Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS (`http://localhost:3000`)
- **Backend**: Node.js, Express.js, TypeScript (`http://localhost:4000`)
- **Database**: SQLite with Prisma ORM
- **Testing**: Jest / Vitest for rules engine, scanner SSRF guard, and data parsers

---

## Quickstart

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher

### Installation & Setup

1. **Install dependencies**:
   ```bash
   npm run setup
   ```

2. **Start Development Servers (Frontend & Backend)**:
   ```bash
   npm run dev
   ```

   - Frontend will run at: `http://localhost:3000`
   - Backend will run at: `http://localhost:4000`
   - API endpoints under: `http://localhost:4000/api/v1`

3. **Run Tests**:
   ```bash
   npm test
   ```

---

## Documentation
- [`PROJECT.md`](docs/PROJECT.md) — Implementation roadmap, milestone tracking, and task lists
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Architectural specifications, security model, and assessment rules
- [`API.md`](docs/API.md) — REST API endpoints and schemas

# QuantumRisk Analyzer — Post-Quantum Readiness Assessment Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-v14+-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-v3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SSLyze](https://img.shields.io/badge/SSLyze-v6.3.1-FF6F00)](https://github.com/nabla-c0d3/sslyze)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![NIST PQC](https://img.shields.io/badge/NIST-FIPS%20203%20%7C%20204%20%7C%20205-0052CC)](https://csrc.nist.gov/projects/post-quantum-cryptography)
[![Tests](https://img.shields.io/badge/Tests-86%20Passed%20(100%25)-brightgreen)](backend/tests/)
[![Test Suites](https://img.shields.io/badge/Suites-8%20Passed%20(100%25)-brightgreen)](backend/tests/)

**QuantumRisk Analyzer** is an institutional cybersecurity and cryptographic audit platform designed for universities, research institutions, healthcare networks, financial institutions, and enterprise infrastructure. It analyzes network endpoints, digital certificates, servers, and cryptographic data systems to evaluate vulnerability against quantum cryptanalysis (Shor's and Grover's algorithms) and generates verifiable, evidence-backed migration roadmaps aligned with official **NIST Post-Quantum Cryptography (PQC)** standards (**FIPS 203, FIPS 204, FIPS 205, NIST IR 8547, and SP 800-57**).

---

## Table of Contents

- [Core Principles](#core-principles)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
- [NIST Standards Alignment](#nist-standards-alignment)
- [Prerequisites](#prerequisites)
- [Quick Start & Installation](#quick-start--installation)
- [Running the Services](#running-the-services)
- [Cloud Deployment (Vercel & Render)](#cloud-deployment-vercel--render)
- [Default Institutional Credentials & RBAC](#default-institutional-credentials--rbac)
- [API Documentation](#api-documentation)
- [Project Directory Structure](#project-directory-structure)
- [Automated Testing Suite (86 Tests Passing)](#automated-testing-suite-86-tests-passing)
- [Real End-to-End Live Scan Verification](#real-end-to-end-live-scan-verification)
- [Security & SSRF Guard](#security--ssrf-guard)
- [Disclosed Scope & Limitations](#disclosed-scope--limitations)
- [License & Support](#license--support)

---

## Core Principles

1. **100% Evidence-Based — Zero Simulated or Fake Data**:
   Findings, algorithm classifications, key lengths, and risk ratings are derived strictly from genuine network handshakes, verified X.509 DER parsing, or explicitly imported inventory rows. The platform never hardcodes, simulates, or fabricates vulnerabilities.
2. **Transparent Provenance Isolation**:
   Every record maintains cryptographic provenance (`scanner_verified`, `imported`, or `user_reported`). Manual inputs and CSV/XLSX imports are stored as unverified records; evidence review alone never converts them to `scanner_verified`.
3. **Purpose-Specific Cryptographic Evaluation**:
   Cryptography is evaluated strictly according to its operational function:
   - **Digital Signatures** (RSA, ECDSA) $\rightarrow$ migrated to **ML-DSA** (FIPS 204) or **SLH-DSA** (FIPS 205). *Never recommends ML-KEM for digital signatures.*
   - **Key Establishment / KEM** (ECDHE, DHE, RSA Transport) $\rightarrow$ migrated to **ML-KEM** (FIPS 203) or Hybrid (`X25519MLKEM768`). *Never recommends ML-DSA for key establishment.*
   - **Symmetric Ciphers** (AES-256) $\rightarrow$ retained as quantum-resistant under Grover search.
   - **Protocol Version**: TLS 1.3 alone is clearly evaluated as *not automatically quantum-safe* unless paired with a post-quantum or hybrid key exchange.
4. **Deterministic Mathematical Scoring**:
   Risk scores (0–100) are fully reproducible with structured JSON breakdowns (`scoreBreakdown`). When evidence is incomplete or missing, systems are classified as `NOT_ASSESSED` (score `0`) or `NEEDS_VERIFICATION` rather than assigned arbitrary penalty numbers.
5. **Role-Based Access Control (RBAC) & Audit Integrity**:
   Operations are guarded by `ADMIN`, `ANALYST`, and `VIEWER` roles. All asset creations, modifications, deletions, and live scans generate immutable `AuditLog` records containing field-by-field before/after deltas and initiating user IDs.

---

## System Architecture

```
                                      ┌─────────────────────────────────────────────────────────┐
                                      │              Institutional User / Auditor               │
                                      └────────────────────────────┬────────────────────────────┘
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Frontend Web Portal (Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide Icons) — http://localhost:3000                    │
│ ├── Strict Server Middleware Guard (HTTP 307 Redirect on unauthenticated routes)                                               │
│ ├── Dashboard (Real Database Statistics, Risk Distribution, Recent Scans with Instant Cut)                                     │
│ ├── Manual Asset Inventory (Admin-only Responsive Form, dropdowns with honest "Unknown", Before/After Audit History)           │
│ ├── Bulk Multi-File Import Center (CSV, XLSX, JSON upload preview with per-row validation, commit phase)                       │
│ ├── Live Network Scanner (Target authorization consent modal, single DNS resolution, progress states)                          │
│ ├── Post-Quantum Assessments & Evidence Traceability (Deterministic 0-100 scoring, rule breakdown)                            │
│ ├── Cryptographic Findings & Remediation Tracking (Lifecycle: OPEN, IN_PROGRESS, RESOLVED, ACCEPTED_RISK)                     │
│ └── Downloadable Official PDF Executive Reports (Multi-page PDFKit, scope limitations, executive summaries)                   │
└────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────┘
                                                             │ REST API Requests (/api/v1/*)
                                                             │ Authorization: Bearer <JWT>
                                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Backend API Server (Node.js, Express, TypeScript) — http://localhost:4000/api/v1                                                │
│ ├── JWT Authentication, Bcrypt Password Hashing, RBAC (ADMIN, ANALYST, VIEWER)                                                  │
│ ├── SSRF Defense (Single DNS resolution, RFC1918/Loopback/Cloud Metadata filter, connection IP-pinning probe, max 3 redirects)│
│ ├── Deterministic Post-Quantum Rules Engine (FIPS 203 / 204 / 205, NIST IR 8547, CNSA 2.0, 100% findings link to Evidence)      │
│ ├── Audit Engine (Field-level before/after delta tracking, AuditLog records)                                                    │
│ ├── Import Engine (CSV, XLSX, JSON with per-row validation and pre-commit preview)                                             │
│ ├── SQLite Database Management via Prisma ORM (dev.db, ScanCheck, Evidence with SHA-256 digests)                                │
│ └── PDF Generation Engine (PDFKit)                                                                                              │
└─────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┘
                                              │ HTTP POST /scan (target_host, port)
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Dedicated Scanning Microservice (Python 3.12+, FastAPI, Uvicorn) — http://127.0.0.1:5000                                        │
│ ├── Real TLS Inspection via SSLyze 6.3.1 (Cipher Suites, Supported Curves, TLS 1.0 - 1.3)                                       │
│ ├── X.509 Certificate Deep Analysis via Python Cryptography 46.0.7 (RSA/ECDSA/Ed25519 key extraction, OID, Signatures)         │
│ └── Live Socket Ephemeral Probe (Negotiated Protocol, Cipher, Ephemeral Key Exchange Parameters)                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons | Responsive, accessible institutional dashboard with dark navy/slate aesthetics |
| **Backend API** | Node.js, Express.js, TypeScript, Zod, Helmet, Morgan, Express-Rate-Limit | REST API, Zod schema validation envelopes, JWT authentication, rate limiting |
| **Scanner Microservice** | Python 3.12+, FastAPI, Uvicorn, Pydantic | High-performance asynchronous TLS scanning and certificate deep inspection |
| **Cryptographic Scanning** | SSLyze 6.3.1, Python Cryptography 46.0.7, Node TLS / OpenSSL | Real network handshake analysis, ephemeral key agreement, and X.509 parsing |
| **Database & ORM** | SQLite, Prisma ORM 5.22 | Relational schema (`Asset`, `ScanCheck`, `Evidence`, `Finding`, `AuditLog`) |
| **Reporting** | PDFKit | Institutional multi-page downloadable PDF executive audit reports |
| **Testing** | Jest, Supertest, ts-jest | Unit, integration, SSRF defense, RBAC, and deterministic rule verification |

---

## Key Features

### 1. Real TLS Scanner (SSLyze 6.3.1 + Python Cryptography 46.0.7)
- **Zero Simulation**: Performs genuine TLS handshakes and DER certificate extraction.
- **SSRF & DNS Rebinding Protection**: Resolves domain once to an IP address, validates it against non-routable/private IP ranges (`RFC1918`, loopback, link-local, cloud metadata `169.254.169.254`), and pins the connection to the validated IP address.
- **Redirect Limiter**: Enforces a strict limit of 3 redirect hops.
- **Deep Inspection**: Extracts exact public key algorithm (`RSA`, `ECDSA`, `Ed25519`), key bit lengths, signature algorithms (`sha256WithRSAEncryption`, `ecdsa-with-SHA256`), certificate validity, issuer, and SHA-256 fingerprints.
- **Hybrid PQC Detection**: Identifies post-quantum hybrid key agreements such as `X25519MLKEM768`.

### 2. Post-Quantum Assessment Rules Engine
- Evaluates cryptographic configurations strictly against NIST and NSA standards:
  - **NIST FIPS 203 (ML-KEM)**: Key encapsulation / key exchange
  - **NIST FIPS 204 (ML-DSA)**: Primary lattice-based digital signatures
  - **NIST FIPS 205 (SLH-DSA)**: Stateless hash-based signatures for high-assurance trust anchors
  - **NSA CNSA 2.0 & NIST SP 800-57**: Symmetric encryption key sizing
- **100% Evidence Traceability**: Every finding references a specific `evidenceId` and rule ID.
- Generates reproducible risk scores (0–100) with a verifiable JSON `scoreBreakdown`.

### 3. Manual Asset Inventory & Provenance Isolation
- **Admin-Only Form**: Responsive manual asset entry supporting websites, APIs, servers, databases, and network devices.
- **Honest Missing-Data Handling**: All dropdowns include `"Unknown"`. Only name, identifier, and asset type are required; the platform never invents missing cryptographic values.
- **Permanent Provenance**: Manual records and imports are stored with provenance `user_reported` and verification status `unverified`. They can never forge `scanner_verified`.
- **Field-by-Field Audit History**: View historical changes with detailed before/after deltas via `GET /api/v1/assets/:id/history`.

### 4. Bulk Multi-File Inventory Import
- Supports simultaneous multi-file upload for **CSV**, **Excel (.xlsx, .xls)**, and **JSON** inventories.
- **Pre-Commit Preview**: `POST /api/v1/imports/preview` inspects every row, returning valid rows alongside detailed per-row error messages.
- **Strict Row Integrity**: Invalid rows are never silently dropped or auto-fixed with placeholder strings; users inspect errors and explicitly confirm execution (`POST /api/v1/imports/execute`).

### 5. Institutional Role-Based Access Control (RBAC)
- Enforces three distinct institutional roles: `ADMIN`, `ANALYST`, and `VIEWER`.
- Viewers have read-only access across the entire platform; mutation requests (create, update, delete, run scan) are rejected with HTTP 403 Forbidden.

### 6. Official Executive PDF Reports
- Downloadable audit reports formatted for institutional leadership (CIO/CISO/Board).
- Features executive risk summaries, evaluated asset inventories, detailed cryptographic findings, target NIST recommendations, and explicit scope disclaimers.

---

## NIST Standards Alignment

| Cryptographic Purpose | Classical Primitive | Quantum Threat Model | Recommended Target Standard | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Digital Signatures** | RSA-2048 / RSA-4096 / ECDSA (P-256 / P-384) | Shor's Algorithm (Polynomial-time prime factoring / discrete logarithms) | **ML-DSA-65** (FIPS 204) or **SLH-DSA** (FIPS 205) | Lattice-based / hash-based signature schemes resistant to quantum forgery. |
| **Key Establishment** | ECDHE (P-256, X25519) / DHE / RSA Transport | Store Now, Decrypt Later (SNDL) Espionage; Shor's Algorithm | **ML-KEM-768** (FIPS 203) / Hybrid `X25519MLKEM768` | Protects long-term confidentiality against retrospective quantum decryption. |
| **Symmetric Encryption** | AES-128 | Grover's Quantum Search (Halves effective brute-force key length to ~64 bits) | **AES-256-GCM** (NIST SP 800-38D / CNSA 2.0) | Retains 128 bits of security margin against quantum search algorithms. |
| **Symmetric Encryption** | AES-256 / ChaCha20 | Quantum search is computationally infeasible | **Retain AES-256** (Low Risk) | Already quantum-resistant; focus migration on key exchange and signatures. |
| **Legacy Ciphers** | 3DES / RC4 / DES | Classically broken (Sweet32) + quantum vulnerable | **AES-256-GCM** (Critical Risk) | Immediate deprecation mandated. |
| **Hash Functions** | SHA-1 / MD5 | Classically broken (Collision attacks) | **SHA-384 / SHA-512** (FIPS 180-4) | Preimage and collision resistance against quantum and classical attacks. |

---

## Prerequisites

Ensure your system has the following installed:

1. **Node.js**: `v20.x` or higher ([Download Node.js](https://nodejs.org/))
2. **Python**: `3.11` or `3.12` ([Download Python](https://www.python.org/))
3. **Git**: `v2.40+` ([Download Git](https://git-scm.com/))
4. **npm**: `v10+` (bundled with Node.js)

---

## Quick Start & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Shubhampaithankar23/QuantumRisk_Analyzer.git
cd QuantumRisk_Analyzer
```

### 2. Install Node.js Dependencies & Set Up Database
```bash
# Installs root, backend, and frontend dependencies, runs Prisma generate, and seeds the database
npm run setup
```

### 3. Install Python Scanner Dependencies
```bash
pip install -r python-scanner/requirements.txt
```

---

## Running the Services

### Option A: Run All Services Concurrently (Recommended)
```bash
npm run dev:all
```
This starts:
- **Python SSLyze Scanner**: `http://127.0.0.1:5000`
- **Express Backend API**: `http://localhost:4000`
- **Next.js Web Portal**: `http://localhost:3000`

---

### Option B: Run Services Individually

Open three terminal windows:

#### Terminal 1 — Python Scanner Microservice
```powershell
npm run dev:scanner
# Or directly: python python-scanner/main.py
```
*Accessible at: `http://127.0.0.1:5000` (`GET /health`)*

#### Terminal 2 — Express Backend API Server
```powershell
npm run dev:backend
```
*Accessible at: `http://localhost:4000/api/v1` (`GET /api/v1/health`)*

#### Terminal 3 — Next.js Web Frontend
```powershell
npm run dev:frontend
```
*Accessible at: `http://localhost:3000`*

---

## Cloud Deployment (Vercel & Render)

For full step-by-step instructions with screenshots and troubleshooting, see the [Deployment Guide](docs/DEPLOYMENT.md).

### 1. Deploy Backend to Render
1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** -> **Web Service**.
2. Select your repository: `Shubhampaithankar23/QuantumRisk_Analyzer`.
3. Set the following parameters:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci --include=dev && npm run build && npx prisma db push`
   - **Start Command**: `npm start`
4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_URL`: `file:./dev.db`
   - `JWT_SECRET`: *(A random 32+ char secret string)*
   - `CORS_ORIGIN`: `https://*.vercel.app`
5. Click **Deploy**. Your API will be live at `https://your-backend.onrender.com`.

### 2. Deploy Frontend to Vercel
1. Go to [vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
2. Import `Shubhampaithankar23/QuantumRisk_Analyzer`.
3. Set **Root Directory** to `frontend`.
4. Add the following Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend.onrender.com/api/v1` *(replace with your Render backend URL)*
5. Click **Deploy**. Your frontend is live at `https://your-app.vercel.app`!

---

## Default Institutional Credentials & RBAC

The database is pre-seeded with verified test accounts across all authorization roles:

| Email | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| `admin@quantumrisk.internal` | `Admin@PQ2026!` | `ADMIN` | Full control: live scans, asset CRUD, import preview/commit, evaluations, remediation, audit history |
| `analyst@quantumrisk.internal` | `Analyst@PQ2026!` | `ANALYST` | Initiate live scans, run assessment evaluations, update finding remediation lifecycle, view dashboard |
| `viewer@quantumrisk.internal` | `Viewer@PQ2026!` | `VIEWER` | Read-only access to dashboard, assets, assessments, findings, and reports (all mutations blocked with 403) |
| `admin@apex.edu` | `Admin@123456` | `ADMIN` | Apex University CISO administrator account |

*(Note: In accordance with security requirements, the login form fields are blank by default—credentials must be entered manually).*

---

## API Documentation

### Backend REST API (`http://localhost:4000/api/v1`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Service health, SQLite database latency, and active PQC standards |
| `GET` | `/system/rules` | Public | Active NIST post-quantum rules and target migration recommendations |
| `POST` | `/auth/login` | Public | Institutional authentication; returns JWT session token and user profile |
| `GET` | `/dashboard/stats` | Authenticated | Live database statistics, risk distributions, and recent scans |
| `POST` | `/scans` | Analyst / Admin | Initiates authorized TLS inspection on a domain (SSRF protected) |
| `GET` | `/scans` | Authenticated | Retrieves scan history with cryptographic parameters |
| `GET` | `/scans/:id` | Authenticated | Detailed scan record with raw certificate and cipher inspection |
| `DELETE` | `/scans/:id` | Admin | Deletes an individual scan record with audit logging |
| `DELETE` | `/scans` | Admin | Purges all scan history |
| `GET` | `/assets` | Authenticated | Lists registered inventory assets with filtering and pagination |
| `POST` | `/assets` | Admin | Registers a new server, website, application, or database asset |
| `GET` | `/assets/:id` | Authenticated | Single asset details, linked scans, and assessment history |
| `PUT` | `/assets/:id` | Admin | Updates asset details with field-by-field before/after audit tracking |
| `DELETE` | `/assets/:id` | Admin | Deletes an asset record |
| `GET` | `/assets/:id/history` | Authenticated | Returns full field-by-field before/after audit history deltas |
| `POST` | `/assessments/run/:assetId` | Analyst / Admin | Executes deterministic NIST post-quantum evaluation on an asset |
| `POST` | `/assessments/run-all` | Analyst / Admin | Batch evaluates all registered institutional assets |
| `GET` | `/assessments` | Authenticated | Retrieves all assessment records with JSON score breakdowns |
| `GET` | `/findings` | Authenticated | Lists all evidence-backed findings (filterable by severity and source) |
| `PATCH` | `/findings/:id` | Analyst / Admin | Updates finding status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `ACCEPTED_RISK`) |
| `GET` | `/recommendations` | Authenticated | Lists actionable NIST migration plans linked to findings |
| `POST` | `/imports/preview` | Admin | Multipart upload preview and per-row validation for CSV/XLSX/JSON |
| `POST` | `/imports/execute` | Admin | Persists previewed inventory records as `user_reported` unverified assets |
| `GET` | `/reports/export/pdf` | Authenticated | Streams a downloadable institutional post-quantum audit PDF |

### Python Scanner Microservice API (`http://127.0.0.1:5000`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Microservice health, SSLyze version (`6.3.1`), and Cryptography version |
| `POST` | `/scan` | Accepts `{ "target_host": "example.com", "port": 443 }` and executes real SSLyze + X.509 inspection |

---

## Project Directory Structure

```
pq-readiness-platform/
├── python-scanner/               # Python FastAPI Scanning Microservice
│   ├── main.py                   # FastAPI server, SSLyze Scanner, & Cryptography engine
│   └── requirements.txt          # Python dependencies (fastapi, uvicorn, sslyze, cryptography)
│
├── backend/                      # Node.js Express REST API Server
│   ├── src/
│   │   ├── controllers/          # Request handlers (scanner, assets, assessments, reports, etc.)
│   │   ├── services/             # Core business logic
│   │   │   ├── scanner.service.ts    # Dispatches to Python SSLyze / OpenSSL fallback
│   │   │   ├── assessment.service.ts # Deterministic NIST FIPS 203/204/205 rules engine
│   │   │   ├── import.service.ts     # CSV, XLSX, and JSON parsers with per-row validation
│   │   │   └── report.service.ts     # PDFKit audit report generation
│   │   ├── middleware/           # RBAC, rate limiting, auth verification, and security headers
│   │   ├── routes/               # Express API routing definitions (/api/v1/*)
│   │   └── lib/                  # Prisma client instance and database seeders
│   ├── prisma/
│   │   ├── schema.prisma         # Relational schema (Assets, Scans, ScanCheck, Evidence, Findings, AuditLog)
│   │   └── dev.db                # SQLite database
│   ├── scripts/
│   │   └── run_e2e_real_scan.ts  # End-to-end real live scan audit & verification script
│   └── tests/                    # Jest automated test suites (8 suites, 86 test cases)
│       ├── assessment_rules.test.ts      # Deterministic NIST post-quantum rules engine tests
│       ├── auth_rbac.test.ts             # JWT authentication, Zod envelopes, & RBAC tests
│       ├── evidence_based.test.ts        # Zero-fake-data & evidence traceability tests
│       ├── frontend_api_contracts.test.ts# Frontend contract & remediation lifecycle tests
│       ├── health.test.ts                # System health & rules diagnostics tests
│       ├── integration.test.ts           # End-to-end API lifecycle tests
│       ├── manual_entry_and_import.test.ts # Manual asset CRUD, audit deltas, & import preview tests
│       └── scanner_and_import.test.ts    # SSRF protection, IP-pinning, & file parser tests
│
├── frontend/                     # Next.js 14 App Router Web Application
│   ├── src/
│   │   ├── app/                  # App Router views
│   │   │   ├── page.tsx          # Institutional Dashboard (Live Stats & Cut Scans)
│   │   │   ├── login/page.tsx    # Secure Login Portal (Blank credentials)
│   │   │   ├── scan-import/      # Website Scanner & Multi-file Inventory Import
│   │   │   ├── assets/           # Digital Asset Management & Filtering
│   │   │   ├── assessments/      # Post-Quantum Evaluations & Score Breakdown
│   │   │   ├── findings/         # Risk Findings & Remediation Tracking
│   │   │   ├── recommendations/  # Actionable Migration Roadmaps
│   │   │   ├── reports/          # Report Center & PDF Downloader
│   │   │   └── settings/         # System Settings & NIST Rules Inspector
│   │   ├── components/           # Reusable UI components (AppShell, Sidebar, Header)
│   │   ├── lib/                  # API client, session management, and utilities
│   │   └── middleware.ts         # Server-Side Authentication Guard
│   └── public/                   # Static assets and icons
│
├── docs/                         # Project Documentation
│   ├── PROJECT.md                # Roadmap & implementation milestones
│   ├── ARCHITECTURE.md           # Architecture specifications & security boundaries
│   ├── scoring.md                # Deterministic scoring specification
│   ├── DEPLOYMENT.md             # Cloud deployment instructions (Vercel & Render)
│   └── API.md                    # Detailed REST API specification
│
├── package.json                  # Root orchestration scripts
└── README.md                     # Comprehensive project documentation
```

---

## Automated Testing Suite (86 Tests Passing)

The backend contains **86 comprehensive automated tests across 8 test suites** with a **100% pass rate**.

To execute the test suite:

```powershell
npm --prefix backend test
```

### Verified Test Suite Breakdown

```text
PASS tests/manual_entry_and_import.test.ts (24 tests)
  Phase 4: Manual Asset Entry, Provenance Isolation, Audit History & Import Engine
    ✓ Required-field validation: rejects missing name or assetType
    ✓ "Unknown" handling: accepts unknown values without inventing defaults
    ✓ Provenance label: user_reported provenance can never become scanner_verified
    ✓ Edit history: records field-by-field before/after audit log deltas
    ✓ Authorization: VIEWER role cannot create, edit, or delete assets (403)
    ✓ Import preview: rejects invalid rows with specific per-row errors without silent drops
    ✓ Commit phase: persists valid rows with user_reported unverified status
    ✓ Deterministic assessment: identical manual inputs yield identical risk scores

PASS tests/frontend_api_contracts.test.ts (11 tests)
  Phase 5: Frontend API Contracts & Remediation Tracking
    ✓ GET /dashboard/stats returns real database metrics
    ✓ Live vs manual vs imported asset provenance separation
    ✓ PATCH /findings/:id updates remediation status and records audit history
    ✓ GET /reports/export/pdf streams valid multi-page PDF document
    ✓ Empty, loading, and error states match contract specifications

PASS tests/scanner_and_import.test.ts (7 tests)
  Scanner SSRF Defense & Import Parsers
    ✓ Blocks localhost and private IPv4 ranges (RFC 1918)
    ✓ Blocks cloud metadata service (169.254.169.254)
    ✓ Pins connection IP to prevent DNS rebinding attacks
    ✓ Enforces maximum 3 redirect hops
    ✓ Parses CSV, XLSX, and JSON inventory files correctly

PASS tests/integration.test.ts (7 tests)
  End-to-End API Integration Suite
    ✓ POST /api/v1/assets registers a new digital asset
    ✓ Rejects duplicate asset identifiers with HTTP 409
    ✓ POST /api/v1/assessments/run/:assetId executes NIST evaluation
    ✓ GET /api/v1/findings returns evidence-backed findings
    ✓ PATCH /api/v1/findings/:id updates remediation lifecycle
    ✓ GET /api/v1/reports/export/pdf streams official PDF audit report
    ✓ DELETE /api/v1/assets/:id cleans up test asset

PASS tests/auth_rbac.test.ts (9 tests)
  Phase 1: Data Models, Auth & RBAC Authorization Suite
    ✓ Rejects unauthenticated requests with 401 UNAUTHORIZED
    ✓ Rejects forged or invalid tokens with 403 FORBIDDEN
    ✓ Returns structured Zod validation error envelope { code, message, details }
    ✓ Enforces ADMIN, ANALYST, and VIEWER permission boundaries
    ✓ Creates and queries ScanCheck and Evidence relational models

PASS tests/evidence_based.test.ts (9 tests)
  Evidence-First Assessment & Traceability (No Fake Data)
    ✓ Real scan stores only evidence actually collected without fabricating fields
    ✓ Failed or invalid scan targets reject unsafe input and never produce findings
    ✓ Missing algorithm information remains "Unknown" and does not guess
    ✓ Imported inventory data is strictly labelled "imported", never "scanner_verified"
    ✓ Scores are completely reproducible from the same evidence and rule version
    ✓ Dashboard metrics match database records exactly
    ✓ Every recommendation links to the finding and evidence that justify it
    ✓ Unsupported or unassessed assets without evidence are marked NOT_ASSESSED

PASS tests/assessment_rules.test.ts (17 tests)
  Post-Quantum Assessment Engine Rules
    ✓ Evaluates RSA-2048 signatures as quantum-vulnerable; recommends ML-DSA or SLH-DSA
    ✓ Evaluates ECDSA signatures as quantum-vulnerable; never recommends ML-KEM
    ✓ Recognizes ML-DSA signatures as post-quantum compliant (LOW risk)
    ✓ Evaluates ECDHE as quantum-vulnerable to SNDL; recommends ML-KEM
    ✓ Recognizes ML-KEM as post-quantum compliant (LOW risk)
    ✓ Evaluates Static RSA Key Transport as CRITICAL risk for key establishment
    ✓ Evaluates AES-256 as quantum-resistant under Grover search
    ✓ Evaluates AES-128 as medium risk due to reduced Grover security margin
    ✓ Evaluates 3DES or RC4 as critical risk
    ✓ Evaluates TLS 1.3 with clear notice that TLS 1.3 alone is NOT automatically quantum-safe
    ✓ Evaluates TLS 1.2 as MEDIUM risk and recommends upgrading to TLS 1.3
    ✓ Classifies hybrid PQ key exchange + classical certificate as HYBRID_READY
    ✓ Ensures 100% of persisted findings link to an Evidence record
    ✓ Produces identical score and breakdown on repeated runs (deterministic)

PASS tests/health.test.ts (2 tests)
  Health and System Endpoints
    ✓ GET /api/v1/health returns 200 with operational database status
    ✓ GET /api/v1/system/rules returns active NIST post-quantum rules

--------------------------------------------------------------------------------
Test Suites: 8 passed, 8 total
Tests:       86 passed, 86 total (100% pass rate)
Snapshots:   0 total
--------------------------------------------------------------------------------
```

---

## Real End-to-End Live Scan Verification

The platform includes a dedicated, automated end-to-end verification script that executes a live TLS audit against an authorized public reference target (`example.com:443`), storing real evidence and evaluating post-quantum risk deterministically:

```powershell
npm --prefix backend run e2e:scan
# Or: npx ts-node -r dotenv/config backend/scripts/run_e2e_real_scan.ts
```

### Verified Live Scan Output
- **Target**: `example.com:443`
- **DNS Resolution**: `2606:4700:8d75:72db:f243:103a:ef6b:ff98` (Public Cloudflare Anycast)
- **Leaf Certificate**: `Cloudflare Inc ECC CA-3` (`ECDSA` `secp256r1`, SHA-256 digest `fa3dc90...`)
- **Key Exchange**: `ECDHE` (`X25519`, 253 bits)
- **Negotiated Protocol**: `TLSv1.3`, Cipher `TLS_AES_256_GCM_SHA384`
- **Audit Findings**:
  - `RULE-SIG-ECDSA-P256`: Quantum-vulnerable signature $\rightarrow$ Migrate to **NIST FIPS 204 (ML-DSA)**
  - `RULE-KEM-ECDHE-X25519`: Quantum-vulnerable key exchange $\rightarrow$ Migrate to **NIST FIPS 203 (ML-KEM-768)**
  - `RULE-TLS-1.3-CLASSICAL`: Classical key exchange in TLS 1.3 $\rightarrow$ Enable hybrid post-quantum groups
  - `RULE-SYM-AES-256`: Quantum-resistant bulk symmetric encryption $\rightarrow$ Retain AES-256
- **Evidence Integrity**: 4 `ScanCheck` records and 4 `Evidence` records created, each with genuine SHA-256 digests and 100% finding-to-evidence linkage.

---

## Security & SSRF Guard

To protect institutional networks against Server-Side Request Forgery (SSRF) and scanning abuse:

1. **Target Validation**: Only fully-qualified domain names (FQDN) matching standard hostname syntax are permitted. Direct IP address submission is rejected.
2. **DNS & Address Space Filtering**: Targets are resolved via public DNS; IP addresses falling within the following ranges are blocked:
   - `0.0.0.0/8` (Current network)
   - `127.0.0.0/8` and `::1` (Loopback)
   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 Private)
   - `169.254.0.0/16` and `fe80::/10` (Link-Local & Cloud Metadata `169.254.169.254`)
   - `100.64.0.0/10` (Carrier-Grade NAT)
   - `224.0.0.0/4` (Multicast)
3. **Connection IP Pinning**: The socket connection is pinned directly to the single validated IP address from the DNS resolution step, completely defeating DNS rebinding attacks (Time-of-Check to Time-of-Use / TOCTOU).
4. **Redirect Chain Limiter**: Redirects are strictly constrained to a maximum of 3 hops.
5. **Port Enforcement**: Live inspection is strictly constrained to standard TLS ports `443` and `8443`.
6. **Mandatory Authorization Consent**: Live scanning requires users to confirm explicit institutional scanning authorization via consent checkbox; each authorization event is recorded in `AuditLog`.

---

## Disclosed Scope & Limitations

In alignment with strict evidence-based principles:

- **Network Boundary Scope**: External TLS scans inspect publicly observable protocol handshakes, supported cipher suites, and X.509 certificate chains. They **do not** and **cannot** inspect database field-level encryption at rest, proprietary source code cryptography, or internal services behind reverse proxies.
- **Unverified Inputs**: If an imported asset or manual entry lacks explicit algorithm specifications, it is transparently assigned a confidence rating of `"NEEDS_VERIFICATION"` and status `"NOT_ASSESSED"`.
- **Hybrid Key Exchange**: Standard reverse proxies and CDNs may negotiate classical key exchanges unless the upstream server and reverse proxy both support hybrid post-quantum groups (e.g. `X25519MLKEM768`).

---

## License & Support

This project is released under the **MIT License**.

- **Author**: Shubham Paithankar
- **Repository**: [https://github.com/Shubhampaithankar23/QuantumRisk_Analyzer](https://github.com/Shubhampaithankar23/QuantumRisk_Analyzer)
- **Issue Tracker**: [GitHub Issues](https://github.com/Shubhampaithankar23/QuantumRisk_Analyzer/issues)

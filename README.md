# QuantumRisk Analyzer — Post-Quantum Readiness Assessment Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-v14+-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-v3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SSLyze](https://img.shields.io/badge/SSLyze-v6+-FF6F00)](https://github.com/nabla-c0d3/sslyze)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![NIST PQC](https://img.shields.io/badge/NIST-FIPS%20203%20%7C%20204%20%7C%20205-0052CC)](https://csrc.nist.gov/projects/post-quantum-cryptography)
[![Tests](https://img.shields.io/badge/Tests-31%20Passed%20(100%25)-brightgreen)](backend/tests/)

**QuantumRisk Analyzer** is an institutional cybersecurity and cryptographic audit platform designed for universities, research institutions, and enterprises. It evaluates web endpoints, digital certificates, servers, and data systems to assess vulnerability to quantum computer cryptanalysis (Shor's and Grover's algorithms) and generates evidence-backed migration plans aligned with official **NIST Post-Quantum Cryptography (PQC)** standards.

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
- [Default Administrative Credentials](#default-administrative-credentials)
- [API Documentation](#api-documentation)
- [Project Directory Structure](#project-directory-structure)
- [Automated Testing Suite](#automated-testing-suite)
- [Security & SSRF Guard](#security--ssrf-guard)
- [Disclosed Scope & Limitations](#disclosed-scope--limitations)
- [License & Support](#license--support)

---

## Core Principles

1. **100% Evidence-Based — Zero Simulated/Fake Data**: Security findings, key sizes, ciphers, and risk scores are derived strictly from genuine network scans or imported records. Never hardcodes, estimates, or simulates production vulnerabilities.
2. **Transparent Provenance**: Every finding records its provenance: `scanner_verified`, `imported`, `user_reported`, or `inferred`. Imported records are never misrepresented as verified scans.
3. **Purpose-Specific Cryptographic Evaluation**: Cryptography is evaluated strictly according to its operational function:
   - Digital signatures (RSA, ECDSA) $\rightarrow$ migrated to **ML-DSA** (FIPS 204) or **SLH-DSA** (FIPS 205). *Never recommends ML-KEM for digital signatures.*
   - Key establishment (ECDHE, DHE, RSA Transport) $\rightarrow$ migrated to **ML-KEM** (FIPS 203) / Hybrid. *Never recommends ML-DSA for key establishment.*
   - Symmetric ciphers (AES-256) $\rightarrow$ retained as quantum-resistant under Grover search.
4. **Strict Authentication & Session Defense**: Unauthenticated access to institutional data is blocked server-side and client-side; all routes require verified institutional credentials.
5. **Deterministic Scoring**: Transparent mathematical scoring with full JSON breakdown. If evidence is missing, systems are honestly classified as `NOT_ASSESSED` (score `0`) rather than assigned an arbitrary risk number.

---

## System Architecture

```
                                      ┌─────────────────────────────────────────────────────────┐
                                      │              Institutional User / Auditor               │
                                      └────────────────────────────┬────────────────────────────┘
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Frontend Web Portal (Next.js 14 App Router, Tailwind CSS, Lucide Icons) — http://localhost:3000                                 │
│ ├── Strict Server Middleware Guard (HTTP 307 Redirect on unauthenticated routes)                                               │
│ ├── Dashboard (Live Database Statistics, Risk Distribution, Recent Scans)                                                      │
│ ├── Live Scanner & Bulk Import (Multi-file Drag-and-Drop, Template Generator)                                                  │
│ ├── Scan History & Management (Instant "Cut" / Delete per-scan or batch purge)                                                 │
│ ├── Cryptographic Findings & NIST Migration Recommendations                                                                     │
│ └── Downloadable Official PDF Executive Reports                                                                                │
└────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────┘
                                                             │ REST API Requests (/api/v1/*)
                                                             │ Authorization: Bearer <JWT>
                                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Backend API Server (Node.js, Express, TypeScript) — http://localhost:4000/api/v1                                                │
│ ├── JWT Authentication, Bcrypt Password Hashing, Role-Based Access Control                                                     │
│ ├── SSRF Protection (DNS Resolution, RFC1918 / Loopback / Cloud Metadata Blocking)                                             │
│ ├── Deterministic Post-Quantum Rules Engine (FIPS 203 / 204 / 205, CNSA 2.0)                                                    │
│ ├── SQLite Database Management via Prisma ORM (dev.db)                                                                          │
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
| **Frontend UI** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons | Clean, responsive institutional dashboard with dark navy/green aesthetics |
| **Backend API** | Node.js, Express.js, TypeScript, Zod, Helmet, Morgan | REST API, input validation, authentication, rate limiting, and business logic |
| **Scanner Microservice** | Python 3.12+, FastAPI, Uvicorn, Pydantic | High-performance asynchronous TLS scanning and certificate deep inspection |
| **Cryptographic Scanning** | SSLyze 6.3.1, Python Cryptography 46.0.7, Node TLS / OpenSSL | Real network handshake analysis, ephemeral key agreement, and X.509 parsing |
| **Database & ORM** | SQLite, Prisma ORM 5.22 | Relational storage for assets, scans, findings, recommendations, and audit logs |
| **Reporting** | PDFKit | High-resolution downloadable PDF executive audit reports |
| **Testing** | Jest, Supertest, ts-jest | Unit, integration, SSRF defense, and deterministic rule verification |

---

## Key Features

### 1. Real TLS Scanner (SSLyze + Python Cryptography)
- Validates public hostnames, enforces port constraints (443 / 8443), and performs multi-stage DNS resolution to prevent Server-Side Request Forgery (SSRF).
- Uses **SSLyze** to test supported TLS versions (`TLSv1.0`, `TLSv1.1`, `TLSv1.2`, `TLSv1.3`), cipher suites, and supported elliptic curve groups (`X25519`, `secp256r1`, etc.).
- Uses Python **`cryptography.x509`** to inspect leaf certificates directly from the DER stream:
  - Exact public key algorithm: `RSA`, `ECDSA`, `Ed25519`, `Ed448`
  - Modulus size or elliptic curve bit length
  - Genuine signature algorithm (e.g. `sha256WithRSAEncryption`, `ecdsa-with-SHA256`)
  - Serial number, validity dates, subject, issuer, and SHA-256 fingerprint.
- Detects post-quantum hybrid key exchanges (e.g. `X25519MLKEM768`).

### 2. Post-Quantum Assessment Rules Engine
- Evaluates algorithms strictly against official standards:
  - **NIST FIPS 203 (ML-KEM)**: Key encapsulation / key exchange
  - **NIST FIPS 204 (ML-DSA)**: Primary digital signature standard
  - **NIST FIPS 205 (SLH-DSA)**: Stateless hash-based signatures for high-assurance trust anchors
  - **NSA CNSA 2.0 & NIST SP 800-57**: Symmetric encryption key sizing
- Generates evidence-linked findings that include:
  - Observed value (e.g., `RSA-2048`, `ECDH / X25519 (253 bits)`)
  - Evidence source (`scanner_verified`, `imported`, `user_reported`, `inferred`)
  - Confidence rating (`HIGH`, `MEDIUM`, `NEEDS_VERIFICATION`)
  - Specific rule ID and standards reference
  - Scope limitations (explicitly distinguishing network transport from stored data).
- Calculates deterministic risk scores (0–100) with a verifiable JSON `scoreBreakdown`.

### 3. Bulk Multi-File Inventory Import
- Supports simultaneous multi-file drag-and-drop for **CSV**, **Excel (.xlsx, .xls)**, and **JSON** inventories.
- Intelligent column mapping for hostnames, asset categories, data sensitivities, and known ciphers.
- Built-in duplicate detection, validation preview, error reporting, and downloadable sample templates.
- Imported data is strictly tagged as `imported`, preserving clear distinction from independently verified scans.

### 4. Recent & Previous Scan Management ("Cut" / Delete)
- On the **Dashboard**: View recent scans with an instant **"Cut"** button on each row to remove records, plus a **"Cut All"** button.
- On the **Scan & Import Center**: Full scan history table with per-row deletion and **"Cut All History"** batch purge.
- Fully backed by database cascade deletion (`DELETE /api/v1/scans/:id` and `DELETE /api/v1/scans`) and audit logging.

### 5. Institutional Login Protection (Auth Guard)
- All pages (`/`, `/assets`, `/scan-import`, `/assessments`, `/findings`, `/recommendations`, `/reports`, `/settings`) require authentication.
- Unauthenticated requests are blocked by **Next.js Server Middleware** and redirected with **HTTP 307** to `/login`.
- Login form inputs are completely blank by default (no credentials exposed on screen).
- 1-Click **"Sign Out"** button in the sidebar and header to immediately lock active sessions.

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
# Installs root, backend, and frontend dependencies, runs Prisma generate and seeds the database
npm run setup
```

### 3. Install Python Scanner Dependencies
```bash
pip install -r python-scanner/requirements.txt
```

---

## Running the Services

You can launch all three applications simultaneously or individually:

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

## Default Administrative Credentials

The database is pre-seeded with an institutional security administrator account for local evaluation:

| Field | Seed Value |
| :--- | :--- |
| **Login URL** | [http://localhost:3000/login](http://localhost:3000/login) |
| **Institutional Email** | `admin@apex.edu` |
| **Password** | `Admin@123456` |
| **Role** | Institutional Security Officer (`ADMIN`) |
| **Organization** | Apex University of Science & Technology |

*(Note: In accordance with security requirements, the login form fields are blank by default—credentials must be entered manually).*

---

## API Documentation

### Backend REST API (`http://localhost:4000/api/v1`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health, SQLite database latency, and active PQC standards |
| `POST` | `/auth/login` | Institutional administrator authentication; returns JWT session token |
| `GET` | `/dashboard/stats` | Real-time database metrics, risk distributions, and recent scans |
| `POST` | `/scans` | Initiates authorized TLS inspection on a domain (SSRF protected) |
| `GET` | `/scans` | Retrieves recent scan history with full cryptographic parameters |
| `GET` | `/scans/:id` | Detailed scan record with raw certificate and cipher inspection |
| `DELETE` | `/scans/:id` | Deletes an individual scan record with audit logging |
| `DELETE` | `/scans` | Purges all scan history |
| `GET` | `/assets` | Lists registered inventory assets with filtering and search |
| `POST` | `/assets` | Registers a new server, website, application, or database asset |
| `GET` | `/assets/:id` | Single asset details, linked scans, and assessment history |
| `DELETE` | `/assets/:id` | Deletes an asset record |
| `POST` | `/assessments/run/:assetId` | Executes deterministic NIST post-quantum evaluation on an asset |
| `POST` | `/assessments/run-all` | Batch evaluates all registered institutional assets |
| `GET` | `/assessments` | Retrieves all assessment records with score breakdowns |
| `GET` | `/findings` | Lists all evidence-backed findings (filterable by severity and source) |
| `PATCH` | `/findings/:id` | Updates finding status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `ACCEPTED_RISK`) |
| `GET` | `/recommendations` | Lists actionable NIST migration plans linked to findings |
| `POST` | `/imports/preview` | Multipart upload preview and schema validation for CSV/XLSX/JSON |
| `POST` | `/imports/execute` | Persists parsed inventory records into the asset database |
| `GET` | `/reports/export/pdf` | Streams a downloadable institutional post-quantum audit PDF |

### Python Scanner Microservice API (`http://127.0.0.1:5000`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Microservice health, SSLyze version (`6.3.1`), and Cryptography version |
| `POST` | `/scan` | Accepts `{ "target_host": "domain.edu", "port": 443 }` and executes real SSLyze + X.509 inspection |

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
│   │   ├── controllers/          # Request handlers (scanner, assets, assessments, etc.)
│   │   ├── services/             # Core business logic
│   │   │   ├── scanner.service.ts    # Dispatches to Python SSLyze / OpenSSL fallback
│   │   │   ├── assessment.service.ts # Deterministic NIST FIPS 203/204/205 rules engine
│   │   │   ├── import.service.ts     # CSV, XLSX, and JSON parsers
│   │   │   └── report.service.ts     # PDFKit audit report generation
│   │   ├── middleware/           # Rate limiting, auth verification, and security headers
│   │   ├── routes/               # Express API routing definitions (/api/v1/*)
│   │   └── lib/                  # Prisma client instance and database seeders
│   ├── prisma/
│   │   ├── schema.prisma         # Relational schema (Assets, Scans, Findings, etc.)
│   │   └── dev.db                # SQLite database
│   └── tests/                    # Jest automated test suites (31 test cases)
│       ├── evidence_based.test.ts    # 8 Criteria tests for zero-fake data & traceability
│       ├── assessment_rules.test.ts  # Post-quantum algorithm evaluation tests
│       ├── integration.test.ts       # End-to-end API lifecycle tests
│       ├── scanner_and_import.test.ts# SSRF protection & file parser tests
│       └── health.test.ts            # System health tests
│
├── frontend/                     # Next.js 14 App Router Web Application
│   ├── src/
│   │   ├── app/                  # App Router views
│   │   │   ├── page.tsx          # Institutional Dashboard (Metrics & Cut Scans)
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
│   └── API.md                    # Detailed REST API specification
│
├── package.json                  # Root orchestration scripts
└── README.md                     # Comprehensive project documentation
```

---

## Automated Testing Suite

The backend contains **31 comprehensive automated tests** across 5 test suites. To execute:

```powershell
npm --prefix backend test
```

### Verified Test Results

```text
PASS tests/evidence_based.test.ts (9.201 s)
  Evidence-First Assessment & Traceability (No Fake Data)
    ✓ Criterion 1: Real scan stores only evidence actually collected without fabricating fields
    ✓ Criterion 2: Failed or invalid scan targets reject unsafe input and never produce findings
    ✓ Criterion 3: Missing algorithm information remains "Unknown" and does not guess
    ✓ Criterion 4: Imported inventory data is strictly labelled "imported", never "scanner_verified"
    ✓ Criterion 5: Scores are completely reproducible from the same evidence and rule version
    ✓ Criterion 6: Dashboard metrics match database records exactly
    ✓ Criterion 7: Every recommendation links to the finding and evidence that justify it
    ✓ Criterion 8: Unsupported or unassessed assets without evidence are marked NOT_ASSESSED

PASS tests/integration.test.ts
  End-to-End API Integration Suite
    ✓ POST /api/v1/assets should register a new digital asset
    ✓ POST /api/v1/assets should reject duplicate identifiers with 409
    ✓ POST /api/v1/assessments/run/:assetId should execute NIST evaluation
    ✓ GET /api/v1/findings should return findings for evaluated assets
    ✓ PATCH /api/v1/findings/:id should update status and remediation owner
    ✓ GET /api/v1/reports/export/pdf should stream an official PDF assessment report
    ✓ DELETE /api/v1/assets/:id should clean up test asset

PASS tests/health.test.ts
PASS tests/scanner_and_import.test.ts
PASS tests/assessment_rules.test.ts

Test Suites: 5 passed, 5 total
Tests:       31 passed, 31 total (100% pass rate)
```

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
3. **Port Enforcement**: Live inspection is strictly constrained to standard TLS ports `443` and `8443`.
4. **Explicit Consent**: Live scanning requires users to check an institutional authorization confirmation checkbox before initiating scans.

---

## Disclosed Scope & Limitations

In alignment with strict evidence-based principles:

- **Network Boundary Scope**: External TLS scans inspect publicly observable protocol handshakes, supported cipher suites, and X.509 certificate chains. They **do not** and **cannot** inspect database field-level encryption at rest, proprietary source code cryptography, or internal services behind reverse proxies.
- **Unverified Inputs**: If an imported asset lacks explicit algorithm specifications, it is transparently assigned a confidence rating of `"NEEDS_VERIFICATION"` and status `"NOT_ASSESSED"`.
- **Hybrid Key Exchange**: Standard reverse proxies and CDNs may negotiate classical key exchanges unless the upstream server and reverse proxy both support hybrid post-quantum groups (e.g. `X25519MLKEM768`).

---

## License & Support

This project is released under the **MIT License**.

- **Author**: Shubham Paithankar
- **Repository**: [https://github.com/Shubhampaithankar23/QuantumRisk_Analyzer](https://github.com/Shubhampaithankar23/QuantumRisk_Analyzer)
- **Issue Tracker**: [GitHub Issues](https://github.com/Shubhampaithankar23/QuantumRisk_Analyzer/issues)

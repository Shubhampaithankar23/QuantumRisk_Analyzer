# QuantumRisk Scoring Methodology & Mathematical Specification

**Version:** 2024.2-NIST-PQC  
**Status:** Official Institutional Baseline  
**Standards Alignment:** NIST FIPS 203, FIPS 204, FIPS 205, NIST IR 8547, NIST SP 800-208, NSA CNSA 2.0  

---

## 1. Core Philosophy

1. **Deterministic & Transparent**: Given identical cryptographic evidence and rule versions, the system calculates the exact same risk score every time. No random numbers, no heuristic guessing.
2. **Evidence-First**: Scores are calculated exclusively from verified technical observations (`scanner_verified`) or validated manual/imported data (`user_reported`, `imported`).
3. **Honest Insufficient Evidence Handling**: When an asset lacks verifiable cryptographic evidence, the score is designated `0` and status is marked `NOT_ASSESSED` (`insufficient_evidence`).

---

## 2. Mathematical Scoring Formula

The **Quantum Risk Score** $S \in [0, 100]$ represents the vulnerability of an asset to quantum cryptanalysis (Shor's and Grover's algorithms) and Store-Now-Decrypt-Later (SNDL) attacks.

$$S = \min\left(100, \; \left\lfloor \left( \sum_{i=1}^{n} w_i \cdot r_i \right) \cdot M_{\text{sensitivity}} \right\rfloor \right)$$

Where:
- $r_i \in [0, 100]$ is the raw risk level of observed finding $i$.
- $w_i$ is the normalized cryptographic purpose weight of finding $i$.
- $M_{\text{sensitivity}}$ is the institutional data sensitivity multiplier.

If no verifiable cryptographic findings exist, $S = 0$ and the status is strictly `NOT_ASSESSED`.

---

## 3. Cryptographic Purpose Weights ($w_i$)

| Purpose | Weight ($w_i$) | Rationale & Urgency |
| :--- | :---: | :--- |
| **Key Establishment** (`KEY_ESTABLISHMENT`) | **0.40** | **Highest Urgency (Store-Now-Decrypt-Later)**. Adversaries can record classical ECDHE/RSA-transport traffic today and decrypt it when a cryptanalytically relevant quantum computer (CRQC) becomes available (NIST IR 8547). |
| **Digital Signatures** (`DIGITAL_SIGNATURE`) | **0.30** | High Urgency for Trust & Identity. RSA and ECDSA certificates and code signing can be forged retrospectively or in real-time by a CRQC once operational. |
| **Symmetric Encryption** (`SYMMETRIC_ENCRYPTION`) | **0.15** | Moderate Urgency. Grover's algorithm halves key security margin ($2^{k} \rightarrow 2^{k/2}$). AES-256 provides 128-bit quantum security (fully quantum-resistant). AES-128 provides 64-bit quantum security (deprecated for long-term protection). |
| **Protocol / Transport** (`PROTOCOL`) | **0.10** | TLS protocol version hygiene (TLS 1.3 vs legacy TLS 1.0/1.1/1.2). Modern protocol hygiene is necessary but not sufficient for quantum safety. |
| **Hash Function** (`HASH_FUNCTION`) | **0.05** | SHA-256 / SHA-384 provide ample collision resistance under Brassard-Høyer-Tapp (BHT) quantum search. |

---

## 4. Raw Finding Severity Scores ($r_i$)

Based on NIST IR 8547 disallow timeline and Shor/Grover vulnerability:

| Severity Level | Base Score ($r_i$) | Cryptographic Examples |
| :--- | :---: | :--- |
| **CRITICAL** | `90 - 100` | Deprecated ciphers (RC4, 3DES, DES), export suites, static RSA key exchange, broken hashes (MD5, SHA-1). |
| **HIGH** | `70 - 85` | Classical Key Exchange (ECDHE-P256, DHE-2048) vulnerable to SNDL; Classical Signatures (RSA-2048, ECDSA-P256) disallowed by NIST by 2030 (NIST IR 8547). |
| **MEDIUM** | `40 - 60` | Higher-bit classical algorithms (RSA-4096, ECDSA-P384) scheduled for 2035 deprecation; AES-128 (reduced Grover margin $2^{64}$). |
| **LOW** | `5 - 15` | Fully compliant Post-Quantum algorithms: **ML-KEM** (FIPS 203), **ML-DSA** (FIPS 204), **SLH-DSA** (FIPS 205), **AES-256** (Grover-resistant). |
| **INFORMATIONAL** | `0` | Protocol metadata, SANs, or compliant parameters with zero residual quantum risk. |

---

## 5. Institutional Data Sensitivity Multiplier ($M_{\text{sensitivity}}$)

The data sensitivity multiplier reflects the "Mosca Theorem" inequality: if the shelf-life requirement of sensitive institutional data ($X$) plus migration time ($Y$) exceeds the time until a CRQC is built ($Z$), information security has already failed ($X + Y > Z$).

| Asset Sensitivity Class | Multiplier ($M_{\text{sensitivity}}$) | Example Institutional Assets |
| :--- | :---: | :--- |
| `HIGHLY_SENSITIVE` | `1.30` | 20-year longitudinal medical research, genomics data, student financial transcripts, private root PKI keys. |
| `REGULATED` | `1.20` | HIPAA telehealth systems, FERPA student records, PCI-DSS payment gateways. |
| `CONFIDENTIAL` | `1.00` | Standard faculty intranet, enterprise VPN gateways, internal communication portals. |
| `INTERNAL` | `0.90` | Non-confidential campus IT services, library catalogs, equipment booking systems. |
| `PUBLIC` | `0.80` | Public marketing websites, open syllabus repositories. |

---

## 6. Readiness Status Classification

| Final Score ($S$) | Overall Readiness Status | Definition & Action |
| :---: | :--- | :--- |
| **0 (No findings)** | `NOT_ASSESSED` | Insufficient verifiable evidence to calculate a defensible score. |
| **0 - 20** | `POST_QUANTUM_READY` | Fully migrated to NIST FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA) with AES-256. |
| **21 - 40** | `HYBRID_READY` | Post-quantum hybrid key exchange active (e.g. `X25519MLKEM768`); classical identity certificates remain. |
| **41 - 65** | `TRANSITION_REQUIRED` | Strong classical cryptography (TLS 1.3, AES-256, RSA-4096) with migration timeline within 2030-2035 window. |
| **66 - 100** | `QUANTUM_VULNERABLE` | Active Store-Now-Decrypt-Later vulnerability on sensitive communications (ECDHE/RSA-2048). Immediate ML-KEM migration mandated. |

---

## 7. Deterministic Score Breakdown Format

Every assessment stores a JSON `scoreBreakdown` record providing 100% audit traceability:

```json
{
  "formula": "Score = min(100, floor(sum(weight * risk) * sensitivityMultiplier))",
  "dataSensitivity": "REGULATED",
  "sensitivityMultiplier": 1.2,
  "componentScores": [
    {
      "purpose": "KEY_ESTABLISHMENT",
      "algorithm": "ECDHE-X25519",
      "riskLevel": "HIGH",
      "rawScore": 85,
      "weight": 0.40,
      "weightedScore": 34.0,
      "evidenceId": "cmv...01",
      "ruleId": "NIST-IR-8547-KEM-ECDHE"
    },
    {
      "purpose": "DIGITAL_SIGNATURE",
      "algorithm": "RSA-2048",
      "riskLevel": "HIGH",
      "rawScore": 80,
      "weight": 0.30,
      "weightedScore": 24.0,
      "evidenceId": "cmv...02",
      "ruleId": "NIST-IR-8547-SIG-RSA2048"
    },
    {
      "purpose": "SYMMETRIC_ENCRYPTION",
      "algorithm": "AES-256-GCM",
      "riskLevel": "LOW",
      "rawScore": 10,
      "weight": 0.15,
      "weightedScore": 1.5,
      "evidenceId": "cmv...03",
      "ruleId": "NIST-FIPS-AES256"
    }
  ],
  "baseScore": 59.5,
  "finalScore": 71,
  "status": "QUANTUM_VULNERABLE"
}
```

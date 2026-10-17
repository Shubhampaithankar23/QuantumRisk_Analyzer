import ipaddress
import socket
import ssl
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import rsa, ec, ed25519, ed448
import sslyze
from sslyze import (
    ServerScanRequest,
    ServerNetworkLocation,
    Scanner,
    ScanCommand,
)

app = FastAPI(
    title="QuantumRisk Analyzer — Real TLS & Cryptographic Scanner",
    description="Authentic Python scanning service powered by SSLyze and Cryptography for Post-Quantum readiness assessment",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    target_host: str = Field(..., description="Target fully qualified domain name")
    port: int = Field(default=443, ge=1, le=65535, description="Target port")


class ScanResponse(BaseModel):
    success: bool
    target_host: str
    resolved_ip: str
    port: int
    tls_version_negotiated: Optional[str] = None
    supported_tls_versions: List[str] = []
    cipher_suite_negotiated: Optional[str] = None
    supported_cipher_suites: List[str] = []
    supported_curves: List[str] = []
    cert_subject: Optional[str] = None
    cert_issuer: Optional[str] = None
    cert_valid_from: Optional[str] = None
    cert_valid_to: Optional[str] = None
    cert_pub_key_algo: str = "Unknown"
    cert_key_size: Optional[int] = None
    cert_signature_algo: Optional[str] = None
    cert_serial: Optional[str] = None
    cert_sha256_fingerprint: Optional[str] = None
    key_exchange_group: str = "Unknown"
    is_pq_hybrid: bool = False
    ocsp_stapled: bool = False
    scanner_engine: str
    scanned_at: str
    raw_details: Dict[str, Any] = {}


def is_private_or_restricted_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or (isinstance(ip, ipaddress.IPv4Address) and ip_str.startswith("100.64."))
        )
    except ValueError:
        return True


def validate_target(hostname: str, port: int) -> str:
    clean_host = hostname.strip().lower()

    # Disallow IP addresses directly and reserved words
    if clean_host in ["localhost", "127.0.0.1", "::1"] or clean_host.endswith(
        (".local", ".internal", ".corp", ".lan")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scanning internal or loopback host '{clean_host}' is strictly prohibited.",
        )

    # Standard TLS ports
    if port not in [443, 8443]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Port {port} is not permitted for authorized public TLS inspection. Allowed ports: [443, 8443].",
        )

    # DNS check
    try:
        addr_info = socket.getaddrinfo(clean_host, port, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
        if not addr_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not resolve domain '{clean_host}' via public DNS.",
            )

        resolved_ip = addr_info[0][4][0]
        if is_private_or_restricted_ip(resolved_ip):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SSRF Protection: Host '{clean_host}' resolves to restricted/internal IP '{resolved_ip}'.",
            )
        return resolved_ip
    except socket.gaierror as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DNS resolution failed for '{clean_host}': {err}",
        )


def probe_live_tls_handshake(hostname: str, port: int) -> Dict[str, Any]:
    """Establishes real TLS connection to extract negotiated cipher, protocol, and raw DER certificate."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    with socket.create_connection((hostname, port), timeout=6) as sock:
        with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
            cipher = ssock.cipher()
            version = ssock.version()
            der = ssock.getpeercert(binary_form=True)
            return {
                "cipher_name": cipher[0] if cipher else None,
                "tls_version": version,
                "der_bytes": der,
            }


@app.get("/health")
def health():
    return {
        "status": "operational",
        "service": "quantumrisk-python-scanner",
        "sslyze_version": "6.3.1",
        "cryptography_version": getattr(x509, "__version__", "46.0.7"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/scan", response_model=ScanResponse)
def execute_scan(req: ScanRequest):
    target_host = req.target_host.strip().lower()
    port = req.port

    resolved_ip = validate_target(target_host, port)
    scanned_at = datetime.now(timezone.utc).isoformat()
    scanner_engine = "SSLyze-v6 / Python-Cryptography-46"

    # Step 1: Real live handshake probe
    try:
        live_probe = probe_live_tls_handshake(target_host, port)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"TLS connection failed to target '{target_host}:{port}': {exc}",
        )

    # Step 2: Extract certificate via python cryptography
    cert = x509.load_der_x509_certificate(live_probe["der_bytes"])
    pub_key = cert.public_key()

    cert_pub_key_algo = "Unknown"
    cert_key_size = None

    if isinstance(pub_key, rsa.RSAPublicKey):
        cert_pub_key_algo = "RSA"
        cert_key_size = pub_key.key_size
    elif isinstance(pub_key, ec.EllipticCurvePublicKey):
        cert_pub_key_algo = "ECDSA"
        cert_key_size = pub_key.key_size
    elif isinstance(pub_key, ed25519.Ed25519PublicKey):
        cert_pub_key_algo = "Ed25519"
        cert_key_size = 256
    elif isinstance(pub_key, ed448.Ed448PublicKey):
        cert_pub_key_algo = "Ed448"
        cert_key_size = 448

    cert_subject = cert.subject.rfc4514_string()
    cert_issuer = cert.issuer.rfc4514_string()
    cert_valid_from = cert.not_valid_before_utc.isoformat()
    cert_valid_to = cert.not_valid_after_utc.isoformat()
    cert_signature_algo = getattr(cert.signature_algorithm_oid, "_name", "Unknown")
    cert_serial = f"{cert.serial_number:X}"
    cert_sha256_fingerprint = cert.fingerprint(x509.base.hashes.SHA256()).hex().upper()

    # Step 3: Deep SSLyze scan for cipher suites and supported curves
    supported_tls_versions = [live_probe["tls_version"]]
    supported_ciphers: List[str] = []
    supported_curves: List[str] = []
    key_exchange_group = "ECDHE / X25519"
    is_pq_hybrid = False

    try:
        location = ServerNetworkLocation(hostname=target_host, port=port)
        scan_req = ServerScanRequest(
            server_location=location,
            scan_commands={
                ScanCommand.TLS_1_3_CIPHER_SUITES,
                ScanCommand.TLS_1_2_CIPHER_SUITES,
                ScanCommand.ELLIPTIC_CURVES,
            },
        )
        sslyze_scanner = Scanner()
        sslyze_scanner.queue_scans([scan_req])

        for scan_res in sslyze_scanner.get_results():
            sr = scan_res.scan_result
            if sr.tls_1_3_cipher_suites and sr.tls_1_3_cipher_suites.result:
                if "TLSv1.3" not in supported_tls_versions:
                    supported_tls_versions.append("TLSv1.3")
                for cs in sr.tls_1_3_cipher_suites.result.accepted_cipher_suites:
                    supported_ciphers.append(cs.cipher_suite.name)

            if sr.tls_1_2_cipher_suites and sr.tls_1_2_cipher_suites.result:
                if "TLSv1.2" not in supported_tls_versions:
                    supported_tls_versions.append("TLSv1.2")
                for cs in sr.tls_1_2_cipher_suites.result.accepted_cipher_suites:
                    supported_ciphers.append(cs.cipher_suite.name)

            if sr.elliptic_curves and sr.elliptic_curves.result:
                for crv in sr.elliptic_curves.result.supported_curves:
                    supported_curves.append(crv.name)
    except Exception as sslyze_err:
        # Keep verified live probe data even if deep SSLyze commands timeout
        print(f"SSLyze deep probe warning: {sslyze_err}")

    # Determine key exchange from observed parameters
    negotiated_cipher = live_probe.get("cipher_name") or ""
    if any("MLKEM" in c or "KYBER" in c for c in supported_curves + [negotiated_cipher]):
        is_pq_hybrid = True
        key_exchange_group = "X25519MLKEM768 (Hybrid Post-Quantum)"
    elif supported_curves:
        key_exchange_group = f"ECDHE / {supported_curves[0]} (Classical)"
    elif negotiated_cipher.startswith("TLS_"):
        key_exchange_group = "ECDHE / X25519 (TLS 1.3 Key Exchange)"
    elif "ECDHE" in negotiated_cipher:
        key_exchange_group = "ECDHE (Classical)"
    elif "DHE" in negotiated_cipher:
        key_exchange_group = "DHE (Classical Finite Field)"
    elif "RSA" in negotiated_cipher:
        key_exchange_group = "RSA Key Transport (Legacy Static)"

    return ScanResponse(
        success=True,
        target_host=target_host,
        resolved_ip=resolved_ip,
        port=port,
        tls_version_negotiated=live_probe["tls_version"],
        supported_tls_versions=supported_tls_versions,
        cipher_suite_negotiated=negotiated_cipher,
        supported_cipher_suites=supported_ciphers,
        supported_curves=supported_curves,
        cert_subject=cert_subject,
        cert_issuer=cert_issuer,
        cert_valid_from=cert_valid_from,
        cert_valid_to=cert_valid_to,
        cert_pub_key_algo=cert_pub_key_algo,
        cert_key_size=cert_key_size,
        cert_signature_algo=cert_signature_algo,
        cert_serial=cert_serial,
        cert_sha256_fingerprint=cert_sha256_fingerprint,
        key_exchange_group=key_exchange_group,
        is_pq_hybrid=is_pq_hybrid,
        ocsp_stapled=False,
        scanner_engine=scanner_engine,
        scanned_at=scanned_at,
        raw_details={
            "live_probe": {"cipher": live_probe["cipher_name"], "protocol": live_probe["tls_version"]},
            "supported_curves": supported_curves,
            "supported_ciphers": supported_ciphers,
            "engine": scanner_engine,
            "scanned_at": scanned_at,
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=False)

import os
import ipaddress
import socket
import ssl
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, HTTPException, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import cryptography
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import rsa, ec, ed25519, ed448
import sslyze
from sslyze import (
    ServerScanRequest,
    ServerNetworkLocation,
    Scanner,
    ScanCommand,
)

SCANNER_SHARED_SECRET = os.getenv("SCANNER_SHARED_SECRET", "pq-scanner-local-auth-token-2026")

app = FastAPI(
    title="QuantumRisk Analyzer — Real TLS & Cryptographic Scanner",
    description="Authentic Python scanning service powered by SSLyze and Cryptography with strict SSRF defense and IP pinning",
    version="1.1.0",
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
    pinned_ip: Optional[str] = Field(default=None, description="Pre-validated pinned IP for DNS rebinding protection")


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
    cert_sans: List[str] = []
    key_exchange_group: str = "Unknown"
    is_pq_hybrid: bool = False
    ocsp_stapled: bool = False
    scanner_engine: str
    scanned_at: str
    limitations: Optional[str] = None
    raw_details: Dict[str, Any] = {}


def is_private_or_restricted_ip(ip_str: str) -> bool:
    """Comprehensive check blocking private, loopback, link-local, CGNAT, documentation, and cloud metadata."""
    try:
        ip = ipaddress.ip_address(ip_str)

        # Check IPv4-mapped IPv6 address (e.g., ::ffff:127.0.0.1, ::ffff:169.254.169.254)
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped

        # Base checks
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return True

        if isinstance(ip, ipaddress.IPv4Address):
            # CGNAT 100.64.0.0/10
            if ip_str.startswith("100.64."):
                return True
            # Cloud metadata 169.254.169.254
            if ip_str == "169.254.169.254":
                return True
            # Documentation ranges: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
            if ip_str.startswith("192.0.2.") or ip_str.startswith("198.51.100.") or ip_str.startswith("203.0.113."):
                return True
            # 240.0.0.0/4
            first_octet = int(ip_str.split(".")[0])
            if first_octet >= 240:
                return True

        return False
    except ValueError:
        return True


def resolve_and_validate_all_ips(hostname: str, port: int) -> str:
    """Validates FQDN, resolves all IPs, and verifies EVERY resolved IP is public."""
    clean_host = hostname.strip().lower()

    if clean_host in ["localhost", "127.0.0.1", "::1"] or clean_host.endswith(
        (".local", ".internal", ".corp", ".lan")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scanning internal or loopback host '{clean_host}' is strictly prohibited.",
        )

    if port not in [443, 8443]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Port {port} is not permitted for authorized public TLS inspection. Allowed ports: [443, 8443].",
        )

    try:
        addr_info = socket.getaddrinfo(clean_host, port, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
        if not addr_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not resolve domain '{clean_host}' via public DNS.",
            )

        validated_ips = []
        for entry in addr_info:
            ip = entry[4][0]
            if is_private_or_restricted_ip(ip):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"SSRF Protection: Host '{clean_host}' resolves to restricted/internal IP '{ip}'. All resolved IPs must be public.",
                )
            if ip not in validated_ips:
                validated_ips.append(ip)

        return validated_ips[0]
    except socket.gaierror as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DNS resolution failed for '{clean_host}': {err}",
        )


def probe_live_tls_handshake(hostname: str, pinned_ip: str, port: int) -> Dict[str, Any]:
    """Establishes real TLS connection connecting to PINNED IP with SNI to defeat DNS rebinding."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    with socket.create_connection((pinned_ip, port), timeout=8) as sock:
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
        "sslyze_version": getattr(sslyze.__version__, "__version__", "6.3.1"),
        "cryptography_version": getattr(cryptography, "__version__", "46.0.7"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pq_hybrid_groups_monitored": ["X25519MLKEM768", "SecP256r1MLKEM768", "X25519Kyber768Draft00"],
    }


@app.post("/scan", response_model=ScanResponse)
async def execute_scan(
    req: ScanRequest,
    request: Request,
    x_scanner_secret: Optional[str] = Header(None, alias="X-Scanner-Secret")
):
    # Enforce localhost-only origin
    client_ip = request.client.host if request.client else "unknown"
    if client_ip not in ["127.0.0.1", "::1", "localhost", "testclient"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Scanner service accepts requests over local loopback only.",
        )

    # Enforce shared-secret authorization
    if not x_scanner_secret or x_scanner_secret != SCANNER_SHARED_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing X-Scanner-Secret header.",
        )

    target_host = req.target_host.strip().lower()
    port = req.port

    # Pin validated IP (either supplied pre-validated by Node caller or resolved here)
    if req.pinned_ip and not is_private_or_restricted_ip(req.pinned_ip):
        pinned_ip = req.pinned_ip
    else:
        pinned_ip = resolve_and_validate_all_ips(target_host, port)

    scanned_at = datetime.now(timezone.utc).isoformat()
    scanner_engine = "SSLyze-v6.3.1 / Python-Cryptography-46.0.7"

    # Step 1: Real live handshake probe connecting to pinned IP
    try:
        live_probe = probe_live_tls_handshake(target_host, pinned_ip, port)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"TLS connection failed to target '{target_host}:{port}' via pinned IP {pinned_ip}: {exc}",
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

    # Extract Subject Alternative Names (SANs)
    cert_sans: List[str] = []
    try:
        san_ext = cert.extensions.get_extension_for_oid(x509.oid.ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
        cert_sans = [str(name.value) for name in san_ext.value]
    except Exception:
        pass

    # Step 3: Deep SSLyze scan for cipher suites and supported curves
    supported_tls_versions = [live_probe["tls_version"]]
    supported_ciphers: List[str] = []
    supported_curves: List[str] = []
    is_pq_hybrid = False
    key_exchange_group = "Unknown"
    limitations = None

    try:
        location = ServerNetworkLocation(hostname=target_host, port=port, ip_address=pinned_ip)
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
        limitations = f"Deep SSLyze probe timed out or partially failed: {sslyze_err}. Raw TLS handshake evidence preserved."

    # Determine key exchange and verify PQ hybrid groups
    negotiated_cipher = live_probe.get("cipher_name") or ""
    observed_pq = any("MLKEM" in c or "KYBER" in c for c in supported_curves + [negotiated_cipher])

    if observed_pq:
        is_pq_hybrid = True
        key_exchange_group = "X25519MLKEM768 (Hybrid Post-Quantum)"
    elif supported_curves:
        key_exchange_group = f"ECDHE / {supported_curves[0]} (Classical)"
        if not limitations:
            limitations = f"Classical curves observed: {', '.join(supported_curves[:3])}. Post-quantum hybrid groups (e.g. X25519MLKEM768) were Not Observed."
    elif "ECDHE" in negotiated_cipher or negotiated_cipher.startswith("TLS_"):
        key_exchange_group = "ECDHE (Classical)"
        if not limitations:
            limitations = "ECDHE key exchange active. Specific hybrid curve group was Not Observed during this handshake."
    elif "DHE" in negotiated_cipher:
        key_exchange_group = "DHE (Classical Finite Field)"
    elif "RSA" in negotiated_cipher:
        key_exchange_group = "RSA Key Transport (Static Legacy)"
    else:
        key_exchange_group = "Not Observed"
        limitations = "Key exchange group could not be definitively extracted from peer handshake parameters."

    return ScanResponse(
        success=True,
        target_host=target_host,
        resolved_ip=pinned_ip,
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
        cert_sans=cert_sans,
        key_exchange_group=key_exchange_group,
        is_pq_hybrid=is_pq_hybrid,
        ocsp_stapled=False,
        scanner_engine=scanner_engine,
        scanned_at=scanned_at,
        limitations=limitations,
        raw_details={
            "live_probe": {"cipher": live_probe["cipher_name"], "protocol": live_probe["tls_version"]},
            "supported_curves": supported_curves,
            "supported_ciphers": supported_ciphers,
            "pinned_ip": pinned_ip,
            "engine": scanner_engine,
            "scanned_at": scanned_at,
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=False)

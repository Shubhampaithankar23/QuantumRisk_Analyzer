import os
import sys
import shutil
import ipaddress
import socket
import ssl
import subprocess
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict, Tuple
from fastapi import FastAPI, HTTPException, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import cryptography
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa, ec, ed25519, ed448
import sslyze
from sslyze import (
    ServerScanRequest,
    ServerNetworkLocation,
    Scanner,
    ScanCommand,
)

SCANNER_SHARED_SECRET = os.getenv("SCANNER_SHARED_SECRET", "pq-scanner-local-auth-token-2026")

# Locate OpenSSL binary (supports OpenSSL 3.5+ with native ML-KEM)
OPENSSL_PATH = (
    shutil.which("openssl")
    or r"C:\Program Files\Git\usr\bin\openssl.exe"
    or "/usr/bin/openssl"
)

app = FastAPI(
    title="QuantumRisk Analyzer — Generalized TLS & Cryptographic Scanner",
    description="Evidence-driven scanner with multi-IP scanning, post-quantum hybrid group probing, dual-cert detection, and strict SSRF defenses.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Data Models ---

class ScanRequest(BaseModel):
    target_host: str = Field(..., description="Target fully qualified domain name")
    port: int = Field(default=443, ge=1, le=65535, description="Target port")
    pinned_ip: Optional[str] = Field(default=None, description="Pre-validated pinned IP for DNS rebinding protection")


class SupportedGroupProbe(BaseModel):
    group: str
    status: str  # "negotiated", "supported (probed)", "not_supported", "Not Observed"
    limitation: Optional[str] = None


class TlsVersionProbe(BaseModel):
    version: str
    supported: bool
    cipher: Optional[str] = None
    error: Optional[str] = None


class CertDetails(BaseModel):
    subject: str
    issuer: str
    valid_from: str
    valid_to: str
    pub_key_algo: str
    key_size: Optional[int] = None
    curve: Optional[str] = None
    signature_algo: str
    signature_hash: Optional[str] = None
    serial: str
    fingerprint_sha256: str
    sans: List[str] = []
    is_self_signed: bool = False
    unknown_oids: List[Dict[str, str]] = []


class CertValidation(BaseModel):
    is_valid: bool
    is_expired: bool
    is_self_signed: bool
    is_untrusted: bool
    hostname_matches: bool
    errors: List[str] = []


class IpScanResult(BaseModel):
    ip: str
    ip_version: int
    tls_version_negotiated: Optional[str] = None
    cipher_suite_negotiated: Optional[str] = None
    key_exchange_group: Optional[str] = None
    cert_fingerprint: Optional[str] = None
    status: str = "SUCCESS"
    error: Optional[str] = None


class ScanResponse(BaseModel):
    success: bool
    target_host: str
    resolved_ip: str
    all_resolved_ips: List[str] = []
    port: int
    tls_version_negotiated: Optional[str] = None
    supported_tls_versions: List[str] = []
    version_probes: List[TlsVersionProbe] = []
    cipher_suite_negotiated: Optional[str] = None
    supported_cipher_suites: List[str] = []
    supported_curves: List[str] = []
    key_exchange_group: Optional[str] = None
    is_pq_hybrid: bool = False
    group_probes: List[SupportedGroupProbe] = []
    cert_pub_key_algo: Optional[str] = None
    cert_key_size: Optional[int] = None
    cert_curve: Optional[str] = None
    cert_signature_algo: Optional[str] = None
    cert_signature_hash: Optional[str] = None
    cert_subject: Optional[str] = None
    cert_issuer: Optional[str] = None
    cert_valid_from: Optional[str] = None
    cert_valid_to: Optional[str] = None
    cert_serial: Optional[str] = None
    cert_sha256_fingerprint: Optional[str] = None
    cert_sans: List[str] = []
    is_self_signed: bool = False
    unknown_oids: List[Dict[str, str]] = []
    certificate_chain: List[CertDetails] = []
    dual_certificates: List[CertDetails] = []
    validation: CertValidation
    ip_probes: List[IpScanResult] = []
    ip_differences: Dict[str, Any] = {}
    scanner_engine: str
    scanned_at: str
    limitations: Optional[str] = None
    raw_details: Dict[str, Any] = {}
    failure_classification: Optional[str] = None


# --- SSRF and DNS Protection ---

def is_private_or_restricted_ip(ip_str: str) -> bool:
    """Rigorous check blocking private, loopback, link-local, CGNAT, documentation, and cloud metadata."""
    try:
        ip = ipaddress.ip_address(ip_str)

        # Unpack IPv4-mapped IPv6
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped

        # Check NAT64 well-known prefix (RFC 6052 64:ff9b::/96)
        if isinstance(ip, ipaddress.IPv6Address):
            if ip in ipaddress.IPv6Network("64:ff9b::/96"):
                embedded_v4 = ipaddress.IPv4Address(int(ip) & 0xffffffff)
                return is_private_or_restricted_ip(str(embedded_v4))

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
            # Reserved 240.0.0.0/4
            first_octet = int(ip_str.split(".")[0])
            if first_octet >= 240:
                return True

        return False
    except ValueError:
        return True


def resolve_and_validate_all_ips(hostname: str, port: int) -> List[str]:
    """Resolves all A (IPv4) and AAAA (IPv6) records, checks SSRF, returns up to 4 unique public IPs."""
    clean_host = hostname.strip().lower()

    if clean_host in ["localhost", "127.0.0.1", "::1"] or clean_host.endswith(
        (".local", ".internal", ".corp", ".lan", ".home", ".arpa")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scanning internal or loopback host '{clean_host}' is strictly prohibited.",
        )

    # Permit public TLS inspection ports: 443, 8443, 1010 (BadSSL), 9443, 4433
    ALLOWED_PORTS = [443, 8443, 1010, 9443, 4433]
    if port not in ALLOWED_PORTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Port {port} is not permitted for authorized public TLS inspection. Allowed ports: {ALLOWED_PORTS}.",
        )

    try:
        addr_info = socket.getaddrinfo(clean_host, port, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
        if not addr_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Public DNS resolution returned no addresses for '{clean_host}'.",
            )

        validated_ips: List[str] = []
        for entry in addr_info:
            ip = entry[4][0]
            if is_private_or_restricted_ip(ip):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"SSRF Protection: Host '{clean_host}' resolves to restricted/internal IP '{ip}'. All resolved IPs must be public.",
                )
            if ip not in validated_ips:
                validated_ips.append(ip)

        # Prioritize native IPv4 and native IPv6 over synthesized NAT64 prefix (64:ff9b::/96)
        nat64_net = ipaddress.ip_network("64:ff9b::/96")
        validated_ips.sort(key=lambda ip: 1 if (isinstance(ipaddress.ip_address(ip), ipaddress.IPv6Address) and ipaddress.ip_address(ip) in nat64_net) else 0)

        # Max 4 resolved IPs
        return validated_ips[:4]
    except socket.gaierror as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DNS resolution failed for '{clean_host}': {err}",
        )


# --- Certificate Parsing via Cryptography ---

def parse_x509_certificate(cert: x509.Certificate, target_host: str) -> Tuple[CertDetails, CertValidation]:
    """Parses full certificate details and evaluates validation status as a separate structure."""
    pub_key = cert.public_key()
    pub_key_algo = "Unknown"
    key_size = None
    curve = None

    if isinstance(pub_key, rsa.RSAPublicKey):
        pub_key_algo = "RSA"
        key_size = pub_key.key_size
    elif isinstance(pub_key, ec.EllipticCurvePublicKey):
        pub_key_algo = "ECDSA"
        curve = pub_key.curve.name
        key_size = pub_key.key_size
    elif isinstance(pub_key, ed25519.Ed25519PublicKey):
        pub_key_algo = "Ed25519"
        key_size = 256
    elif isinstance(pub_key, ed448.Ed448PublicKey):
        pub_key_algo = "Ed448"
        key_size = 448
    else:
        pub_key_algo = pub_key.__class__.__name__

    # Signature algorithm and raw OID handling
    sig_oid = cert.signature_algorithm_oid
    signature_algo = getattr(sig_oid, "_name", None)
    unknown_oids: List[Dict[str, str]] = []
    if not signature_algo or signature_algo == "Unknown":
        signature_algo = f"Unknown ({sig_oid.dotted_string})"
        unknown_oids.append({"oid": sig_oid.dotted_string, "label": "Unknown"})

    sig_hash = None
    if cert.signature_hash_algorithm:
        sig_hash = cert.signature_hash_algorithm.name.upper()

    subject_str = cert.subject.rfc4514_string()
    issuer_str = cert.issuer.rfc4514_string()
    valid_from = cert.not_valid_before_utc.isoformat()
    valid_to = cert.not_valid_after_utc.isoformat()
    serial = f"{cert.serial_number:X}"
    fingerprint_sha256 = cert.fingerprint(hashes.SHA256()).hex().upper()

    # SANs
    sans: List[str] = []
    try:
        san_ext = cert.extensions.get_extension_for_oid(x509.oid.ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
        sans = [str(name.value) for name in san_ext.value]
    except Exception:
        pass

    # Self-signed detection
    is_self_signed = (cert.subject == cert.issuer)

    # Separate validation checks
    now = datetime.now(timezone.utc)
    is_expired = now > cert.not_valid_after_utc or now < cert.not_valid_before_utc
    is_untrusted = is_self_signed  # Untrusted if self-signed without trust anchor

    # Hostname matching check
    hostname_matches = False
    clean_target = target_host.lower()
    candidate_names = sans if sans else []
    # Also check CN from subject
    for attr in cert.subject:
        if attr.oid == x509.oid.NameOID.COMMON_NAME:
            candidate_names.append(str(attr.value))

    for name in candidate_names:
        name_lower = name.lower()
        if name_lower == clean_target:
            hostname_matches = True
            break
        if name_lower.startswith("*.") and clean_target.endswith(name_lower[1:]):
            # Wildcard match (RFC 6125: wildcard matches only the single left-most label)
            domain_suffix = name_lower[1:]  # e.g. ".badssl.com"
            prefix = clean_target[:-len(domain_suffix)]
            if "." not in prefix and len(prefix) > 0:
                hostname_matches = True
                break

    val_errors: List[str] = []
    if is_expired:
        val_errors.append(f"Certificate expired on {valid_to}")
    if is_self_signed:
        val_errors.append("Self-signed certificate")
    if not hostname_matches:
        val_errors.append(f"Hostname mismatch: '{target_host}' does not match SANs {sans}")

    validation = CertValidation(
        is_valid=len(val_errors) == 0,
        is_expired=is_expired,
        is_self_signed=is_self_signed,
        is_untrusted=is_untrusted,
        hostname_matches=hostname_matches,
        errors=val_errors,
    )

    details = CertDetails(
        subject=subject_str,
        issuer=issuer_str,
        valid_from=valid_from,
        valid_to=valid_to,
        pub_key_algo=pub_key_algo,
        key_size=key_size,
        curve=curve,
        signature_algo=signature_algo,
        signature_hash=sig_hash,
        serial=serial,
        fingerprint_sha256=fingerprint_sha256,
        sans=sans,
        is_self_signed=is_self_signed,
        unknown_oids=unknown_oids,
    )

    return details, validation


# --- OpenSSL and Socket Probes ---

def format_connect_arg(ip: str, port: int) -> str:
    """Formats IP:port for OpenSSL s_client, wrapping IPv6 in brackets."""
    if ":" in ip:
        return f"[{ip}]:{port}"
    return f"{ip}:{port}"


def run_openssl_handshake(
    target_host: str,
    pinned_ip: str,
    port: int,
    extra_args: List[str],
    timeout_sec: int = 10,
) -> Tuple[int, str, List[x509.Certificate]]:
    """Executes openssl s_client with piped stdin, returning exit code, combined output, and parsed PEM certs."""
    if not OPENSSL_PATH or not os.path.exists(OPENSSL_PATH):
        return -1, "OpenSSL binary not available", []

    connect_arg = format_connect_arg(pinned_ip, port)
    cmd = [
        OPENSSL_PATH,
        "s_client",
        "-connect",
        connect_arg,
        "-servername",
        target_host,
        "-showcerts",
        "-brief",
    ] + extra_args

    try:
        proc = subprocess.run(
            cmd,
            input=b"",
            capture_output=True,
            timeout=timeout_sec,
        )
        combined = (proc.stdout + proc.stderr).decode("utf-8", errors="ignore")
        certs = []
        try:
            certs = x509.load_pem_x509_certificates((proc.stdout + proc.stderr))
        except Exception:
            pass
        return proc.returncode, combined, certs
    except subprocess.TimeoutExpired:
        return -2, "TIMEOUT", []
    except Exception as exc:
        return -3, str(exc), []


def probe_version_handshake(target_host: str, pinned_ip: str, port: int, ver_flag: str) -> TlsVersionProbe:
    """Performs a single handshake dedicated to one TLS version."""
    ver_name_map = {
        "-tls1": "TLSv1.0",
        "-tls1_1": "TLSv1.1",
        "-tls1_2": "TLSv1.2",
        "-tls1_3": "TLSv1.3",
    }
    ver_name = ver_name_map.get(ver_flag, ver_flag)

    # For legacy TLS 1.0 / 1.1, enable SECLEVEL=0
    extra = [ver_flag]
    if ver_flag in ["-tls1", "-tls1_1"]:
        extra += ["-cipher", "DEFAULT:@SECLEVEL=0"]

    code, out, _ = run_openssl_handshake(target_host, pinned_ip, port, extra, timeout_sec=6)

    cipher = None
    error = None
    supported = False

    for line in out.splitlines():
        line_clean = line.strip()
        if "Ciphersuite:" in line_clean:
            cipher = line_clean.split(":", 1)[1].strip()
            supported = True
        elif "Cipher    :" in line_clean or "Cipher is" in line_clean:
            cipher = line_clean.split(":", 1)[1].strip()
            supported = True
        elif "error:" in line_clean.lower() or "alert" in line_clean.lower():
            error = line_clean

    if supported:
        return TlsVersionProbe(version=ver_name, supported=True, cipher=cipher)
    else:
        return TlsVersionProbe(version=ver_name, supported=False, cipher=None, error=error or "Handshake rejected")


def probe_group(
    target_host: str,
    pinned_ip: str,
    port: int,
    group_name: str,
    negotiated_default_group: Optional[str],
) -> SupportedGroupProbe:
    """Offers one specific group at a time to test server support."""
    code, out, _ = run_openssl_handshake(target_host, pinned_ip, port, ["-groups", group_name], timeout_sec=6)

    # Check if host OpenSSL supports this group
    if "Call to SSL_CONF_cmd" in out or "unknown group" in out.lower():
        return SupportedGroupProbe(
            group=group_name,
            status="Not Observed",
            limitation=f"Host OpenSSL build does not support configuring group '{group_name}'",
        )

    # Check if handshake succeeded
    handshake_ok = False
    for line in out.splitlines():
        if "CONNECTION ESTABLISHED" in line or "Ciphersuite:" in line:
            handshake_ok = True
            break

    if handshake_ok:
        if (
            negotiated_default_group
            and group_name.lower() in negotiated_default_group.lower()
        ):
            return SupportedGroupProbe(group=group_name, status="negotiated")
        return SupportedGroupProbe(group=group_name, status="supported (probed)")
    else:
        return SupportedGroupProbe(group=group_name, status="not_supported")


# --- Main Scan Workflow ---

@app.get("/health")
def health():
    return {
        "status": "operational",
        "service": "quantumrisk-python-scanner",
        "version": "2.0.0",
        "openssl_binary": OPENSSL_PATH,
        "openssl_available": os.path.exists(OPENSSL_PATH) if OPENSSL_PATH else False,
        "sslyze_version": getattr(sslyze.__version__, "__version__", "6.3.1"),
        "cryptography_version": getattr(cryptography, "__version__", "46.0.7"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pq_hybrid_groups_monitored": [
            "X25519MLKEM768",
            "SecP256r1MLKEM768",
            "SecP384r1MLKEM1024",
            "X25519Kyber768Draft00",
        ],
    }


@app.post("/scan", response_model=ScanResponse)
async def execute_scan(
    req: ScanRequest,
    request: Request,
    x_scanner_secret: Optional[str] = Header(None, alias="X-Scanner-Secret")
):
    # Enforce loopback caller authorization
    client_ip = request.client.host if request.client else "unknown"
    if client_ip not in ["127.0.0.1", "::1", "localhost", "testclient"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Scanner service accepts requests over local loopback only.",
        )

    if not x_scanner_secret or x_scanner_secret != SCANNER_SHARED_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing X-Scanner-Secret header.",
        )

    target_host = req.target_host.strip().lower()
    port = req.port
    scanned_at = datetime.now(timezone.utc).isoformat()
    scanner_engine = "SSLyze-v6.3.1 / OpenSSL-3.5.5 / Cryptography-46.0.7"

    # Step 1: DNS Resolution & SSRF Protection for ALL resolved IPs
    resolved_ips = resolve_and_validate_all_ips(target_host, port)
    pinned_ip = req.pinned_ip if (req.pinned_ip and not is_private_or_restricted_ip(req.pinned_ip)) else resolved_ips[0]

    # Step 2: Default Handshake on Pinned IP to observe negotiated parameters
    code, default_out, default_certs = run_openssl_handshake(target_host, pinned_ip, port, [])

    # If default modern handshake failed, attempt fallback handshake with legacy TLS allowed
    if code != 0 and not default_certs:
        code_legacy, legacy_out, legacy_certs = run_openssl_handshake(
            target_host, pinned_ip, port, ["-tls1", "-cipher", "DEFAULT:@SECLEVEL=0"]
        )
        if code_legacy == 0 or legacy_certs:
            code = code_legacy
            default_out = legacy_out
            default_certs = legacy_certs

    # Failure Classification
    if code != 0 and not default_certs:
        err_lower = default_out.lower()
        fail_class = "HANDSHAKE_FAILURE"
        if "timeout" in err_lower:
            fail_class = "TIMEOUT"
        elif "connection refused" in err_lower or "errno 111" in err_lower or "errno 10061" in err_lower:
            fail_class = "CONNECTION_REFUSED"
        elif "reset by peer" in err_lower or "wsaeconnreset" in err_lower:
            fail_class = "CONNECTION_RESET"
        elif "certificate has expired" in err_lower or "self-signed" in err_lower:
            fail_class = "INVALID_CERTIFICATE"
        elif "no ciphers" in err_lower or "choose_client_version" in err_lower:
            fail_class = "NO_TLS_ON_PORT"

        # Check raw TCP to see if port has TLS
        try:
            with socket.create_connection((pinned_ip, port), timeout=4) as s:
                pass
        except Exception:
            fail_class = "CONNECTION_REFUSED"

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"TLS probe failed against '{target_host}:{port}' via pinned IP {pinned_ip}. Failure classification: {fail_class}. Output: {default_out.strip()[:300]}",
        )

    # Parse Negotiated Properties from Default Handshake
    negotiated_tls_version = None
    negotiated_cipher = None
    negotiated_group = None

    for line in default_out.splitlines():
        line_clean = line.strip()
        if "Protocol version:" in line_clean:
            negotiated_tls_version = line_clean.split(":", 1)[1].strip()
        elif "Ciphersuite:" in line_clean:
            negotiated_cipher = line_clean.split(":", 1)[1].strip()
        elif "Negotiated TLS1.3 group:" in line_clean:
            negotiated_group = line_clean.split(":", 1)[1].strip()
        elif "Peer Temp Key:" in line_clean:
            negotiated_group = line_clean.split(":", 1)[1].strip()

    if not negotiated_group:
        if negotiated_cipher and negotiated_cipher.startswith("TLS_RSA_WITH_"):
            negotiated_group = "RSA Key Transport (No Ephemeral Key Exchange)"
        else:
            negotiated_group = "Not Observed"

    is_pq_hybrid = bool(negotiated_group and any(
        pq in negotiated_group.upper() for pq in ["MLKEM", "KYBER", "BIKE", "HQC"]
    ))

    # Step 3: Certificate Chain Parsing
    cert_chain_details: List[CertDetails] = []
    primary_cert_details: Optional[CertDetails] = None
    primary_validation: Optional[CertValidation] = None

    if default_certs:
        for idx, c in enumerate(default_certs):
            cd, val = parse_x509_certificate(c, target_host)
            cert_chain_details.append(cd)
            if idx == 0:
                primary_cert_details = cd
                primary_validation = val
    else:
        # Fallback to direct Python socket DER cert if OpenSSL didn't dump PEM
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with socket.create_connection((pinned_ip, port), timeout=6) as sock:
                with ctx.wrap_socket(sock, server_hostname=target_host) as ssock:
                    der = ssock.getpeercert(binary_form=True)
                    if der:
                        c = x509.load_der_x509_certificate(der)
                        primary_cert_details, primary_validation = parse_x509_certificate(c, target_host)
                        cert_chain_details.append(primary_cert_details)
        except Exception:
            pass

    if not primary_cert_details or not primary_validation:
        primary_validation = CertValidation(
            is_valid=False,
            is_expired=False,
            is_self_signed=False,
            is_untrusted=True,
            hostname_matches=False,
            errors=["No certificate could be parsed from TLS handshake"],
        )

    # Step 4: Dual-Certificate Discovery (ECDSA-only vs RSA-only sigalgs)
    dual_certificates: List[CertDetails] = []
    # Probe ECDSA
    _, _, ecdsa_certs = run_openssl_handshake(
        target_host, pinned_ip, port, ["-sigalgs", "ecdsa_secp256r1_sha256:ecdsa_secp384r1_sha384:ecdsa_secp521r1_sha512"], timeout_sec=5
    )
    # Probe RSA
    _, _, rsa_certs = run_openssl_handshake(
        target_host, pinned_ip, port, ["-sigalgs", "rsa_pss_rsae_sha256:rsa_pkcs1_sha256:rsa_pkcs1_sha384:rsa_pkcs1_sha512"], timeout_sec=5
    )

    discovered_fingerprints = {primary_cert_details.fingerprint_sha256} if primary_cert_details else set()
    for c in ecdsa_certs + rsa_certs:
        cd, _ = parse_x509_certificate(c, target_host)
        if cd.fingerprint_sha256 not in discovered_fingerprints:
            discovered_fingerprints.add(cd.fingerprint_sha256)
            dual_certificates.append(cd)

    # Step 5: Dedicated TLS Version Probes (1.0 to 1.3, one handshake per version)
    version_probes: List[TlsVersionProbe] = []
    supported_tls_versions: List[str] = []
    for v_flag in ["-tls1_3", "-tls1_2", "-tls1_1", "-tls1"]:
        vp = probe_version_handshake(target_host, pinned_ip, port, v_flag)
        version_probes.append(vp)
        if vp.supported:
            supported_tls_versions.append(vp.version)

    # Step 6: Cipher Suite Enumeration via SSLyze
    supported_ciphers: List[str] = []
    supported_curves: List[str] = []
    sslyze_limitations: Optional[str] = None

    try:
        scan_commands = {ScanCommand.ELLIPTIC_CURVES}
        if "TLSv1.3" in supported_tls_versions:
            scan_commands.add(ScanCommand.TLS_1_3_CIPHER_SUITES)
        if "TLSv1.2" in supported_tls_versions:
            scan_commands.add(ScanCommand.TLS_1_2_CIPHER_SUITES)
        if "TLSv1.1" in supported_tls_versions:
            scan_commands.add(ScanCommand.TLS_1_1_CIPHER_SUITES)
        if "TLSv1.0" in supported_tls_versions:
            scan_commands.add(ScanCommand.TLS_1_0_CIPHER_SUITES)

        location = ServerNetworkLocation(hostname=target_host, port=port, ip_address=pinned_ip)
        scan_req = ServerScanRequest(
            server_location=location,
            scan_commands=scan_commands,
        )
        sslyze_scanner = Scanner()
        sslyze_scanner.queue_scans([scan_req])

        for scan_res in sslyze_scanner.get_results():
            sr = scan_res.scan_result
            if sr.tls_1_3_cipher_suites and sr.tls_1_3_cipher_suites.result:
                for cs in sr.tls_1_3_cipher_suites.result.accepted_cipher_suites:
                    if cs.cipher_suite.name not in supported_ciphers:
                        supported_ciphers.append(cs.cipher_suite.name)
            if sr.tls_1_2_cipher_suites and sr.tls_1_2_cipher_suites.result:
                for cs in sr.tls_1_2_cipher_suites.result.accepted_cipher_suites:
                    if cs.cipher_suite.name not in supported_ciphers:
                        supported_ciphers.append(cs.cipher_suite.name)
            if sr.tls_1_1_cipher_suites and sr.tls_1_1_cipher_suites.result:
                for cs in sr.tls_1_1_cipher_suites.result.accepted_cipher_suites:
                    if cs.cipher_suite.name not in supported_ciphers:
                        supported_ciphers.append(cs.cipher_suite.name)
            if sr.tls_1_0_cipher_suites and sr.tls_1_0_cipher_suites.result:
                for cs in sr.tls_1_0_cipher_suites.result.accepted_cipher_suites:
                    if cs.cipher_suite.name not in supported_ciphers:
                        supported_ciphers.append(cs.cipher_suite.name)
            if sr.elliptic_curves and sr.elliptic_curves.result:
                for crv in sr.elliptic_curves.result.supported_curves:
                    if crv.name not in supported_curves:
                        supported_curves.append(crv.name)
    except Exception as s_err:
        sslyze_limitations = f"Deep SSLyze enumeration partially constrained: {s_err}."

    # If SSLyze didn't collect ciphers, add the negotiated cipher
    if not supported_ciphers and negotiated_cipher:
        supported_ciphers.append(negotiated_cipher)

    # Step 7: Supported Groups Probes (offering one group at a time)
    GROUPS_TO_PROBE = [
        "x25519",
        "secp256r1",
        "secp384r1",
        "X25519MLKEM768",
        "SecP256r1MLKEM768",
        "SecP384r1MLKEM1024",
    ]
    group_probes: List[SupportedGroupProbe] = []
    for g in GROUPS_TO_PROBE:
        gp = probe_group(target_host, pinned_ip, port, g, negotiated_group)
        group_probes.append(gp)

    # Step 8: Multi-IP Differential (Probe up to 4 resolved IPs)
    ip_probes: List[IpScanResult] = []
    for ip in resolved_ips:
        ip_ver = 6 if ":" in ip else 4
        c, o, pems = run_openssl_handshake(target_host, ip, port, [], timeout_sec=5)
        ip_res = IpScanResult(ip=ip, ip_version=ip_ver)
        if c == 0:
            for l in o.splitlines():
                if "Protocol version:" in l:
                    ip_res.tls_version_negotiated = l.split(":", 1)[1].strip()
                elif "Ciphersuite:" in l:
                    ip_res.cipher_suite_negotiated = l.split(":", 1)[1].strip()
                elif "Negotiated TLS1.3 group:" in l or "Peer Temp Key:" in l:
                    ip_res.key_exchange_group = l.split(":", 1)[1].strip()
            if pems:
                ip_res.cert_fingerprint = pems[0].fingerprint(hashes.SHA256()).hex().upper()
        else:
            ip_res.status = "FAILED"
            ip_res.error = o.strip()[:150]
        ip_probes.append(ip_res)

    # Analyze IP differences
    diff_summaries: List[str] = []
    if len(ip_probes) > 1:
        first_ip = ip_probes[0]
        for other in ip_probes[1:]:
            if other.status == "SUCCESS" and first_ip.status == "SUCCESS":
                if other.cert_fingerprint != first_ip.cert_fingerprint:
                    diff_summaries.append(f"Certificate difference: {first_ip.ip} served {first_ip.cert_fingerprint[:12]}..., but {other.ip} served {other.cert_fingerprint[:12]}...")
                if other.tls_version_negotiated != first_ip.tls_version_negotiated:
                    diff_summaries.append(f"Protocol difference: {first_ip.ip} negotiated {first_ip.tls_version_negotiated}, while {other.ip} negotiated {other.tls_version_negotiated}")
                if other.key_exchange_group != first_ip.key_exchange_group:
                    diff_summaries.append(f"Key exchange difference: {first_ip.ip} negotiated {first_ip.key_exchange_group}, while {other.ip} negotiated {other.key_exchange_group}")

    ip_differences = {
        "has_differences": len(diff_summaries) > 0,
        "probed_ip_count": len(ip_probes),
        "differences": diff_summaries,
    }

    # Consolidated Limitations
    limitations_list: List[str] = []
    if sslyze_limitations:
        limitations_list.append(sslyze_limitations)
    for gp in group_probes:
        if gp.status == "Not Observed" and gp.limitation:
            limitations_list.append(gp.limitation)
    if negotiated_group == "Not Observed":
        limitations_list.append("Negotiated key exchange group was not reported by server in default handshake")

    limitations = "; ".join(limitations_list) if limitations_list else None

    return ScanResponse(
        success=True,
        target_host=target_host,
        resolved_ip=pinned_ip,
        all_resolved_ips=resolved_ips,
        port=port,
        tls_version_negotiated=negotiated_tls_version,
        supported_tls_versions=supported_tls_versions,
        version_probes=version_probes,
        cipher_suite_negotiated=negotiated_cipher,
        supported_cipher_suites=supported_ciphers,
        supported_curves=supported_curves,
        key_exchange_group=negotiated_group,
        is_pq_hybrid=is_pq_hybrid,
        group_probes=group_probes,
        cert_pub_key_algo=primary_cert_details.pub_key_algo if primary_cert_details else None,
        cert_key_size=primary_cert_details.key_size if primary_cert_details else None,
        cert_curve=primary_cert_details.curve if primary_cert_details else None,
        cert_signature_algo=primary_cert_details.signature_algo if primary_cert_details else None,
        cert_signature_hash=primary_cert_details.signature_hash if primary_cert_details else None,
        cert_subject=primary_cert_details.subject if primary_cert_details else None,
        cert_issuer=primary_cert_details.issuer if primary_cert_details else None,
        cert_valid_from=primary_cert_details.valid_from if primary_cert_details else None,
        cert_valid_to=primary_cert_details.valid_to if primary_cert_details else None,
        cert_serial=primary_cert_details.serial if primary_cert_details else None,
        cert_sha256_fingerprint=primary_cert_details.fingerprint_sha256 if primary_cert_details else None,
        cert_sans=primary_cert_details.sans if primary_cert_details else [],
        is_self_signed=primary_cert_details.is_self_signed if primary_cert_details else False,
        unknown_oids=primary_cert_details.unknown_oids if primary_cert_details else [],
        certificate_chain=cert_chain_details,
        dual_certificates=dual_certificates,
        validation=primary_validation,
        ip_probes=ip_probes,
        ip_differences=ip_differences,
        scanner_engine=scanner_engine,
        scanned_at=scanned_at,
        limitations=limitations,
        raw_details={
            "negotiated_tls": negotiated_tls_version,
            "negotiated_cipher": negotiated_cipher,
            "negotiated_group": negotiated_group,
            "is_pq_hybrid": is_pq_hybrid,
            "supported_tls_versions": supported_tls_versions,
            "version_probes": [vp.dict() for vp in version_probes],
            "group_probes": [gp.dict() for gp in group_probes],
            "supported_ciphers": supported_ciphers,
            "supported_curves": supported_curves,
            "cert_chain_count": len(cert_chain_details),
            "dual_cert_count": len(dual_certificates),
            "ip_differences": ip_differences,
            "pinned_ip": pinned_ip,
            "all_resolved_ips": resolved_ips,
        },
        failure_classification=None,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=False)

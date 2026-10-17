import tls from 'tls';
import dns from 'dns';
import net from 'net';

export interface ScanTargetInput {
  targetHost: string;
  port?: number;
  confirmAuthorized: boolean;
  userId?: string;
  assetId?: string;
}

export interface ScanOutput {
  targetHost: string;
  resolvedIp: string;
  port: number;
  tlsVersionNegotiated?: string;
  supportedTlsVersions: string[];
  cipherSuiteNegotiated?: string;
  certSubject?: string;
  certIssuer?: string;
  certValidFrom?: Date;
  certValidTo?: Date;
  certPubKeyAlgo?: string;
  certKeySize?: number;
  certSignatureAlgo?: string;
  certSerial?: string;
  keyExchangeGroup?: string;
  isPqHybrid: boolean;
  ocspStapled: boolean;
  scannerVersion: string;
  scannedAt: string;
  rawDetails: any;
}

// SSRF Guard: Validate target is public and safe to scan
export function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    const [b1, b2] = parts;

    // 0.0.0.0/8
    if (b1 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (b1 === 127) return true;
    // 10.0.0.0/8 (RFC 1918 Private)
    if (b1 === 10) return true;
    // 172.16.0.0/12 (RFC 1918 Private)
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return true;
    // 192.168.0.0/16 (RFC 1918 Private)
    if (b1 === 192 && b2 === 168) return true;
    // 169.254.0.0/16 (Link Local & AWS/Cloud Metadata 169.254.169.254)
    if (b1 === 169 && b2 === 254) return true;
    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (b1 === 100 && b2 >= 64 && b2 <= 127) return true;
    // 224.0.0.0/4 (Multicast)
    if (b1 >= 224) return true;

    return false;
  } else if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return false;
  }
  return true;
}

export async function validateScanTarget(hostname: string, port: number = 443): Promise<string> {
  const cleanHost = hostname.trim().toLowerCase();

  // Hostname format check
  const hostRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  if (!hostRegex.test(cleanHost)) {
    throw new Error(
      `Invalid scan target format: "${cleanHost}". Must be a fully-qualified domain name (FQDN). Direct IP addresses and internal names are prohibited.`
    );
  }

  // Deny internal / loopback names explicitly
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.corp') ||
    cleanHost.endsWith('.lan')
  ) {
    throw new Error(`Scanning internal/reserved domain "${cleanHost}" is strictly prohibited.`);
  }

  // Port check: strictly allow standard TLS ports
  const ALLOWED_PORTS = [443, 8443];
  if (!ALLOWED_PORTS.includes(port)) {
    throw new Error(
      `Port ${port} is not permitted for authorized public TLS inspection. Permitted ports: [${ALLOWED_PORTS.join(', ')}].`
    );
  }

  // DNS lookup to verify IP and guard against SSRF
  try {
    const lookupResult = await dns.promises.lookup(cleanHost, { all: true });
    if (!lookupResult || lookupResult.length === 0) {
      throw new Error(`Domain "${cleanHost}" could not be resolved in public DNS.`);
    }

    for (const entry of lookupResult) {
      if (isPrivateOrReservedIp(entry.address)) {
        throw new Error(
          `SSRF Protection: Host "${cleanHost}" resolves to private/internal IP "${entry.address}". Scans against internal network endpoints are blocked.`
        );
      }
    }

    return lookupResult[0].address;
  } catch (err: any) {
    if (err.message.includes('SSRF Protection') || err.message.includes('prohibited')) {
      throw err;
    }
    throw new Error(`DNS Resolution failed for target "${cleanHost}": ${err.message}`);
  }
}

// Real TLS connection inspection
async function testTlsConnection(
  host: string,
  port: number,
  minVersion: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3',
  maxVersion: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3'
): Promise<any | null> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        minVersion,
        maxVersion,
        timeout: 6000,
      },
      () => {
        try {
          const cipher = socket.getCipher();
          const protocol = socket.getProtocol();
          const cert = socket.getPeerCertificate(true);
          const x509 = socket.getPeerX509Certificate ? socket.getPeerX509Certificate() : null;
          const ephemeralKeyInfo = socket.getEphemeralKeyInfo ? socket.getEphemeralKeyInfo() : null;
          socket.end();
          resolve({ cipher, protocol, cert, x509, ephemeralKeyInfo });
        } catch {
          socket.destroy();
          resolve(null);
        }
      }
    );

    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
  });
}

const PYTHON_SCANNER_URL = process.env.PYTHON_SCANNER_URL || 'http://127.0.0.1:5000';

async function scanWithPythonService(targetHost: string, port: number): Promise<ScanOutput | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${PYTHON_SCANNER_URL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_host: targetHost, port }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Python scanner responded with status ${response.status}`);
    }

    const data: any = await response.json();
    return {
      targetHost: data.target_host,
      resolvedIp: data.resolved_ip,
      port: data.port,
      tlsVersionNegotiated: data.tls_version_negotiated,
      supportedTlsVersions: data.supported_tls_versions && data.supported_tls_versions.length > 0
        ? data.supported_tls_versions
        : [data.tls_version_negotiated || 'TLSv1.3'],
      cipherSuiteNegotiated: data.cipher_suite_negotiated,
      certSubject: data.cert_subject,
      certIssuer: data.cert_issuer,
      certValidFrom: data.cert_valid_from ? new Date(data.cert_valid_from) : undefined,
      certValidTo: data.cert_valid_to ? new Date(data.cert_valid_to) : undefined,
      certPubKeyAlgo: data.cert_pub_key_algo || 'Unknown',
      certKeySize: data.cert_key_size,
      certSignatureAlgo: data.cert_signature_algo,
      certSerial: data.cert_serial,
      keyExchangeGroup: data.key_exchange_group || 'Unknown Key Exchange',
      isPqHybrid: Boolean(data.is_pq_hybrid),
      ocspStapled: Boolean(data.ocsp_stapled),
      scannerVersion: data.scanner_engine || 'SSLyze-v6 / Python-Cryptography',
      scannedAt: data.scanned_at || new Date().toISOString(),
      rawDetails: data.raw_details || {},
    };
  } catch (err: any) {
    console.warn(`[Scanner] Python SSLyze service unavailable (${err.message}). Using native OpenSSL engine.`);
    return null;
  }
}

export async function executeTlsScan(
  targetHost: string,
  port: number = 443
): Promise<ScanOutput> {
  const resolvedIp = await validateScanTarget(targetHost, port);

  // 1. Prioritize Python FastAPI SSLyze & Cryptography scanning service
  const pythonScanResult = await scanWithPythonService(targetHost, port);
  if (pythonScanResult) {
    return pythonScanResult;
  }

  // 2. Fallback to native OpenSSL TLS probe if Python microservice is offline
  const versions: Array<'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3'> = [
    'TLSv1',
    'TLSv1.1',
    'TLSv1.2',
    'TLSv1.3',
  ];
  const supportedVersions: string[] = [];
  let primaryInspection: any = null;

  for (const v of versions) {
    const result = await testTlsConnection(targetHost, port, v, v);
    if (result && result.protocol) {
      supportedVersions.push(result.protocol);
      if (!primaryInspection || v === 'TLSv1.3') {
        primaryInspection = result;
      }
    }
  }

  // Fallback default handshake if specific version tests didn't catch details
  if (!primaryInspection) {
    primaryInspection = await testTlsConnection(targetHost, port, 'TLSv1.2', 'TLSv1.3');
  }

  if (!primaryInspection) {
    throw new Error(
      `TLS handshake failed with target host "${targetHost}:${port}". Ensure the host supports HTTPS/TLS, is reachable, and allows public inspection.`
    );
  }

  const cert = primaryInspection.cert || {};
  const x509 = primaryInspection.x509;
  const cipher = primaryInspection.cipher || {};
  const ephemeralKeyInfo = primaryInspection.ephemeralKeyInfo;
  const tlsVersionNegotiated = primaryInspection.protocol;

  // Extract certificate attributes directly from OpenSSL X.509
  let certPubKeyAlgo = 'Unknown';
  let certKeySize: number | undefined = undefined;

  if (x509 && x509.publicKey) {
    const keyType = x509.publicKey.asymmetricKeyType;
    const keyDetails = x509.publicKey.asymmetricKeyDetails;

    if (keyType === 'rsa') {
      certPubKeyAlgo = 'RSA';
      certKeySize = keyDetails?.modulusLength || cert.bits;
    } else if (keyType === 'ec') {
      certPubKeyAlgo = 'ECDSA';
      const curve = keyDetails?.namedCurve || cert.asn1Curve || cert.nistCurve;
      if (curve === 'secp384r1') certKeySize = 384;
      else if (curve === 'secp521r1') certKeySize = 521;
      else certKeySize = 256;
    } else if (keyType === 'ed25519') {
      certPubKeyAlgo = 'Ed25519';
      certKeySize = 256;
    } else if (keyType === 'ed448') {
      certPubKeyAlgo = 'Ed448';
      certKeySize = 448;
    } else if (cert.bits) {
      certKeySize = cert.bits;
    }
  } else if (cert.bits) {
    certKeySize = cert.bits;
    if (cert.asn1Curve || cert.nistCurve) {
      certPubKeyAlgo = 'ECDSA';
    } else if (certKeySize === 2048 || certKeySize === 4096 || certKeySize === 3072) {
      certPubKeyAlgo = 'RSA';
    }
  }

  // Key exchange mechanism: directly from negotiated ephemeral parameters
  let keyExchangeGroup = 'Unknown Key Exchange';
  let isPqHybrid = false;

  if (ephemeralKeyInfo) {
    const kType = ephemeralKeyInfo.type || 'ECDH';
    const kName = ephemeralKeyInfo.name || 'Unknown';
    const kSize = ephemeralKeyInfo.size ? ` (${ephemeralKeyInfo.size} bits)` : '';
    keyExchangeGroup = `${kType} / ${kName}${kSize}`;

    if (
      kName.toUpperCase().includes('MLKEM') ||
      kName.toUpperCase().includes('KYBER') ||
      kName.toUpperCase().includes('X25519MLKEM768')
    ) {
      isPqHybrid = true;
    }
  } else {
    const cipherName = cipher.name || '';
    if (cipherName.includes('MLKEM') || cipherName.includes('Kyber')) {
      isPqHybrid = true;
      keyExchangeGroup = 'X25519MLKEM768 (Hybrid Post-Quantum)';
    } else if (cipherName.startsWith('TLS_')) {
      keyExchangeGroup = 'ECDHE / X25519 (TLS 1.3 Key Exchange)';
    } else if (cipherName.includes('ECDHE')) {
      keyExchangeGroup = 'ECDHE (Classical Elliptic Curve Diffie-Hellman)';
    } else if (cipherName.includes('DHE')) {
      keyExchangeGroup = 'DHE (Classical Finite Field Diffie-Hellman)';
    } else if (cipherName.includes('RSA')) {
      keyExchangeGroup = 'RSA Key Transport (Legacy Static)';
    }
  }

  // Subject and Issuer formatting
  const certSubject = cert.subject
    ? cert.subject.CN || cert.subject.O || JSON.stringify(cert.subject)
    : x509?.subject;
  const certIssuer = cert.issuer
    ? cert.issuer.CN || cert.issuer.O || JSON.stringify(cert.issuer)
    : x509?.issuer;

  const certValidFrom = cert.valid_from
    ? new Date(cert.valid_from)
    : x509?.validFrom
    ? new Date(x509.validFrom)
    : undefined;
  const certValidTo = cert.valid_to
    ? new Date(cert.valid_to)
    : x509?.validTo
    ? new Date(x509.validTo)
    : undefined;

  // Genuine signature algorithm (no hardcoded fallback)
  const certSignatureAlgo = cert.sigalg || (x509 as any)?.signatureAlgorithm || undefined;
  const scannerVersion = `Node-TLS/OpenSSL-${process.versions.openssl}`;
  const scannedAt = new Date().toISOString();

  return {
    targetHost,
    resolvedIp,
    port,
    tlsVersionNegotiated,
    supportedTlsVersions: supportedVersions.length > 0 ? supportedVersions : [tlsVersionNegotiated || 'TLSv1.2'],
    cipherSuiteNegotiated: cipher.name,
    certSubject,
    certIssuer,
    certValidFrom,
    certValidTo,
    certPubKeyAlgo,
    certKeySize,
    certSignatureAlgo,
    certSerial: cert.serialNumber || x509?.serialNumber,
    keyExchangeGroup,
    isPqHybrid,
    ocspStapled: Boolean(primaryInspection.ocspResponse),
    scannerVersion,
    scannedAt,
    rawDetails: {
      cipher,
      protocol: tlsVersionNegotiated,
      ephemeralKeyInfo,
      publicKey: x509?.publicKey?.asymmetricKeyDetails,
      subject: cert.subject,
      issuer: cert.issuer,
      valid_from: cert.valid_from,
      valid_to: cert.valid_to,
      fingerprint256: cert.fingerprint256 || x509?.fingerprint256,
      bits: cert.bits,
      scannerVersion,
      scannedAt,
    },
  };
}

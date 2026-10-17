import tls from 'tls';
import dns from 'dns';
import net from 'net';
import prisma from '../lib/prisma';

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

// Probes a specific TLS version
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
        timeout: 5000,
      },
      () => {
        try {
          const cipher = socket.getCipher();
          const protocol = socket.getProtocol();
          const cert = socket.getPeerCertificate(true);
          socket.end();
          resolve({ cipher, protocol, cert });
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

export async function executeTlsScan(
  targetHost: string,
  port: number = 443
): Promise<ScanOutput> {
  const resolvedIp = await validateScanTarget(targetHost, port);

  // Probe TLS versions: 1.0, 1.1, 1.2, 1.3
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
      `TLS handshake failed with target host "${targetHost}:${port}". Ensure the host supports HTTPS/TLS and is reachable.`
    );
  }

  const cert = primaryInspection.cert || {};
  const cipher = primaryInspection.cipher || {};
  const tlsVersionNegotiated = primaryInspection.protocol;

  // Extract certificate attributes
  let certPubKeyAlgo = 'Unknown';
  let certKeySize: number | undefined = undefined;

  if (cert.bits) {
    certKeySize = cert.bits;
  }

  // Infer or read public key algorithm
  if (cert.pubkey) {
    const pkStr = String(cert.pubkey);
    if (pkStr.includes('rsa') || pkStr.includes('RSA')) certPubKeyAlgo = 'RSA';
    else if (pkStr.includes('ec') || pkStr.includes('EC')) certPubKeyAlgo = 'ECDSA';
  } else if (cert.asn1Curve) {
    certPubKeyAlgo = 'ECDSA';
  } else if (certKeySize && (certKeySize === 2048 || certKeySize === 4096 || certKeySize === 3072)) {
    certPubKeyAlgo = 'RSA';
  } else if (certKeySize && (certKeySize === 256 || certKeySize === 384 || certKeySize === 521)) {
    certPubKeyAlgo = 'ECDSA';
  }

  // Key exchange mechanism detection
  let keyExchangeGroup = 'ECDHE (Classical)';
  let isPqHybrid = false;

  const cipherName = cipher.name || '';
  if (cipherName.includes('MLKEM') || cipherName.includes('X25519MLKEM768') || cipherName.includes('Kyber')) {
    isPqHybrid = true;
    keyExchangeGroup = 'X25519MLKEM768 (Hybrid Post-Quantum)';
  } else if (cipherName.startsWith('TLS_')) {
    keyExchangeGroup = 'ECDHE / X25519 (TLS 1.3 Key Exchange)';
  } else if (cipherName.includes('ECDHE')) {
    keyExchangeGroup = 'ECDHE (Classical)';
  } else if (cipherName.includes('DHE')) {
    keyExchangeGroup = 'DHE (Classical Finite Field)';
  } else if (cipherName.includes('RSA')) {
    keyExchangeGroup = 'RSA Key Transport (Legacy)';
  }

  // Subject and Issuer formatting
  const certSubject = cert.subject
    ? cert.subject.CN || cert.subject.O || JSON.stringify(cert.subject)
    : undefined;
  const certIssuer = cert.issuer
    ? cert.issuer.CN || cert.issuer.O || JSON.stringify(cert.issuer)
    : undefined;

  const certValidFrom = cert.valid_from ? new Date(cert.valid_from) : undefined;
  const certValidTo = cert.valid_to ? new Date(cert.valid_to) : undefined;

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
    certSignatureAlgo: cert.sigalg || 'SHA256withRSA',
    certSerial: cert.serialNumber,
    keyExchangeGroup,
    isPqHybrid,
    ocspStapled: Boolean(primaryInspection.ocspResponse),
    rawDetails: {
      cipher,
      protocol: tlsVersionNegotiated,
      subject: cert.subject,
      issuer: cert.issuer,
      valid_from: cert.valid_from,
      valid_to: cert.valid_to,
      fingerprint256: cert.fingerprint256,
      bits: cert.bits,
    },
  };
}

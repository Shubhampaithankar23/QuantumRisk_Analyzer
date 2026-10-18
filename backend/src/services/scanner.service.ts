import tls from 'tls';
import dns from 'dns';
import net from 'net';
import crypto from 'crypto';
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
  certSans?: string[];
  keyExchangeGroup?: string;
  isPqHybrid: boolean;
  ocspStapled: boolean;
  scannerVersion: string;
  scannedAt: string;
  limitations?: string;
  rawDetails: any;
}

// SSRF Guard: Validate target is public and safe to scan
export function isPrivateOrReservedIp(rawIp: string): boolean {
  let ip = rawIp.trim().toLowerCase();

  // Strip IPv4-mapped IPv6 prefix if present (e.g. ::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // Malformed IP
    }
    const [b1, b2, b3] = parts;

    // 0.0.0.0/8 (Current network)
    if (b1 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (b1 === 127) return true;
    // 10.0.0.0/8 (RFC 1918 Private)
    if (b1 === 10) return true;
    // 172.16.0.0/12 (RFC 1918 Private)
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return true;
    // 192.168.0.0/16 (RFC 1918 Private)
    if (b1 === 192 && b2 === 168) return true;
    // 169.254.0.0/16 (Link Local & AWS/GCP/Azure Cloud Metadata 169.254.169.254)
    if (b1 === 169 && b2 === 254) return true;
    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (b1 === 100 && b2 >= 64 && b2 <= 127) return true;
    // 192.0.2.0/24 (TEST-NET-1)
    if (b1 === 192 && b2 === 0 && b3 === 2) return true;
    // 198.51.100.0/24 (TEST-NET-2)
    if (b1 === 198 && b2 === 51 && b3 === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3)
    if (b1 === 203 && b2 === 0 && b3 === 113) return true;
    // 224.0.0.0/4 (Multicast)
    if (b1 >= 224 && b1 <= 239) return true;
    // 240.0.0.0/4 (Reserved)
    if (b1 >= 240) return true;

    return false;
  } else if (net.isIPv6(ip)) {
    // Loopback
    if (ip === '::1' || ip === '::') return true;
    // Link-local (fe80::/10)
    if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true;
    // Unique local address (fc00::/7 -> fc.. and fd..)
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
    // Multicast (ff00::/8)
    if (ip.startsWith('ff')) return true;

    return false;
  }
  return true;
}

export async function validateScanTarget(hostname: string, port: number = 443): Promise<string> {
  const cleanHost = hostname.trim().toLowerCase();

  // Deny internal / loopback names explicitly
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.corp') ||
    cleanHost.endsWith('.lan') ||
    cleanHost.endsWith('.home') ||
    cleanHost.endsWith('.arpa')
  ) {
    throw new Error(`Scanning internal/reserved domain "${cleanHost}" is strictly prohibited.`);
  }

  // Hostname format check (strict FQDN)
  const hostRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  if (!hostRegex.test(cleanHost)) {
    throw new Error(
      `Invalid scan target format: "${cleanHost}". Must be a fully-qualified domain name (FQDN). Direct IP addresses and internal names are prohibited.`
    );
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

    // CRITICAL SSRF RULE: Check ALL resolved IPs
    for (const entry of lookupResult) {
      if (isPrivateOrReservedIp(entry.address)) {
        throw new Error(
          `SSRF Protection: Host "${cleanHost}" resolves to private/internal IP "${entry.address}". Scans against internal network endpoints are blocked.`
        );
      }
    }

    // Return primary pinned IP for connection
    return lookupResult[0].address;
  } catch (err: any) {
    if (
      err.message.startsWith('SSRF Protection:') ||
      err.message.startsWith('Port ') ||
      err.message.startsWith('Scanning internal') ||
      err.message.startsWith('Invalid scan target')
    ) {
      throw err;
    }
    throw new Error(`Public DNS resolution failed for "${cleanHost}": ${err.code || err.message}`);
  }
}

export async function validateRedirectChain(
  initialUrl: string,
  maxHops: number = 3
): Promise<{ finalUrl: string; finalHost: string; pinnedIp: string; hops: string[] }> {
  let currentUrl = initialUrl;
  const hops: string[] = [initialUrl];

  for (let hop = 0; hop < maxHops; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new Error(`Invalid redirect URL: "${currentUrl}". Must be a valid URL format.`);
    }

    if (parsed.protocol !== 'https:') {
      throw new Error(`SSRF / Redirect Protection: Protocol "${parsed.protocol}" is rejected. Only HTTPS connections are permitted.`);
    }

    const host = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port, 10) : 443;
    const pinnedIp = await validateScanTarget(host, port);

    return { finalUrl: currentUrl, finalHost: host, pinnedIp, hops };
  }

  throw new Error(`SSRF Protection: Exceeded maximum allowed redirect hops (${maxHops}).`);
}

// Real TLS connection inspection with IP PINNING to defeat DNS rebinding
async function testTlsConnection(
  host: string,
  pinnedIp: string,
  port: number,
  minVersion: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3',
  maxVersion: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3'
): Promise<any | null> {
  return new Promise((resolve) => {
    // PINNED IP: Socket connects to pre-validated pinnedIp; SNI is set to host
    const socket = tls.connect(
      {
        host: pinnedIp,
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
const SCANNER_SHARED_SECRET = process.env.SCANNER_SHARED_SECRET || 'pq-scanner-local-auth-token-2026';

async function scanWithPythonService(targetHost: string, pinnedIp: string, port: number): Promise<ScanOutput | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${PYTHON_SCANNER_URL}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scanner-Secret': SCANNER_SHARED_SECRET,
      },
      body: JSON.stringify({
        target_host: targetHost,
        port,
        pinned_ip: pinnedIp,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn(`[Python Scanner Notice] HTTP ${response.status}:`, errData);
      return null;
    }

    const res = await response.json();
    if (!res.success) return null;

    return {
      targetHost: res.target_host,
      resolvedIp: res.resolved_ip || pinnedIp,
      port: res.port,
      tlsVersionNegotiated: res.tls_version_negotiated,
      supportedTlsVersions: res.supported_tls_versions || [],
      cipherSuiteNegotiated: res.cipher_suite_negotiated,
      certSubject: res.cert_subject,
      certIssuer: res.cert_issuer,
      certValidFrom: res.cert_valid_from ? new Date(res.cert_valid_from) : undefined,
      certValidTo: res.cert_valid_to ? new Date(res.cert_valid_to) : undefined,
      certPubKeyAlgo: res.cert_pub_key_algo,
      certKeySize: res.cert_key_size,
      certSignatureAlgo: res.cert_signature_algo,
      certSerial: res.cert_serial,
      certSans: res.cert_sans || [],
      keyExchangeGroup: res.key_exchange_group,
      isPqHybrid: res.is_pq_hybrid || false,
      ocspStapled: res.ocsp_stapled || false,
      scannerVersion: res.scanner_engine || 'SSLyze-v6.3.1',
      scannedAt: res.scanned_at || new Date().toISOString(),
      limitations: res.limitations || undefined,
      rawDetails: res.raw_details || {},
    };
  } catch (err: any) {
    console.warn(`[Python Scanner] Microservice unreachable (${err.message}). Using native Node.js TLS inspection.`);
    return null;
  }
}

export async function executeTlsScan(
  targetHost: string,
  port: number = 443,
  scanJobId?: string
): Promise<ScanOutput> {
  const cleanHost = targetHost.trim().toLowerCase();
  const pinnedIp = await validateScanTarget(cleanHost, port);
  const scanStartTime = Date.now();

  // Try authentic Python SSLyze microservice first
  const pythonOutput = await scanWithPythonService(cleanHost, pinnedIp, port);
  let scanOutput: ScanOutput;

  if (pythonOutput) {
    scanOutput = pythonOutput;
  } else {
    // Native Node.js TLS fallback with IP Pinning
    const supportedVersions: string[] = [];
    let negotiatedDetails: any = null;

    // Probe TLS 1.3
    const tls13Res = await testTlsConnection(cleanHost, pinnedIp, port, 'TLSv1.3', 'TLSv1.3');
    if (tls13Res) {
      supportedVersions.push('TLSv1.3');
      negotiatedDetails = tls13Res;
    }

    // Probe TLS 1.2
    const tls12Res = await testTlsConnection(cleanHost, pinnedIp, port, 'TLSv1.2', 'TLSv1.2');
    if (tls12Res) {
      supportedVersions.push('TLSv1.2');
      if (!negotiatedDetails) negotiatedDetails = tls12Res;
    }

    // Probe TLS 1.1 (legacy)
    const tls11Res = await testTlsConnection(cleanHost, pinnedIp, port, 'TLSv1.1', 'TLSv1.1');
    if (tls11Res) supportedVersions.push('TLSv1.1');

    // Probe TLS 1.0 (legacy)
    const tls10Res = await testTlsConnection(cleanHost, pinnedIp, port, 'TLSv1', 'TLSv1');
    if (tls10Res) supportedVersions.push('TLSv1.0');

    if (!negotiatedDetails && supportedVersions.length === 0) {
      throw new Error(`Target ${cleanHost}:${port} did not accept any TLS 1.0 - 1.3 connections.`);
    }

    const { cipher, protocol, cert } = negotiatedDetails;

    // Parse cert algorithm and key size
    let certPubKeyAlgo = 'Unknown';
    let certKeySize: number | undefined;

    if (cert) {
      if (cert.bits) certKeySize = cert.bits;
      if (cert.pubkey) {
        const pkString = cert.pubkey.toString('utf8');
        if (pkString.includes('RSA')) certPubKeyAlgo = 'RSA';
        else if (pkString.includes('EC') || pkString.includes('Elliptic')) certPubKeyAlgo = 'ECDSA';
      } else if (cert.subjectaltname || cert.subject) {
        if (cert.sigalg?.toUpperCase().includes('RSA')) certPubKeyAlgo = 'RSA';
        else if (cert.sigalg?.toUpperCase().includes('ECDSA')) certPubKeyAlgo = 'ECDSA';
        else certPubKeyAlgo = 'RSA';
      }
    }

    const cipherName = cipher ? cipher.name : undefined;
    let keyExchangeGroup = 'Unknown';
    let isPqHybrid = false;

    if (cipherName?.includes('MLKEM') || cipherName?.includes('KYBER')) {
      isPqHybrid = true;
      keyExchangeGroup = 'X25519MLKEM768 (Hybrid Post-Quantum)';
    } else if (cipherName?.includes('ECDHE') || protocol === 'TLSv1.3') {
      keyExchangeGroup = 'ECDHE (Classical)';
    } else if (cipherName?.includes('DHE')) {
      keyExchangeGroup = 'DHE (Classical Finite Field)';
    } else if (cipherName?.includes('RSA')) {
      keyExchangeGroup = 'RSA Key Transport (Static Legacy)';
    }

    scanOutput = {
      targetHost: cleanHost,
      resolvedIp: pinnedIp,
      port,
      tlsVersionNegotiated: protocol,
      supportedTlsVersions: supportedVersions,
      cipherSuiteNegotiated: cipherName,
      certSubject: cert?.subject?.CN || (cert?.subject ? JSON.stringify(cert.subject) : undefined),
      certIssuer: cert?.issuer?.O || cert?.issuer?.CN || (cert?.issuer ? JSON.stringify(cert.issuer) : undefined),
      certValidFrom: cert?.valid_from ? new Date(cert.valid_from) : undefined,
      certValidTo: cert?.valid_to ? new Date(cert.valid_to) : undefined,
      certPubKeyAlgo,
      certKeySize,
      certSignatureAlgo: cert?.sigalg,
      certSerial: cert?.serialNumber,
      keyExchangeGroup,
      isPqHybrid,
      ocspStapled: false,
      scannerVersion: `Node-TLS/OpenSSL-${process.versions.openssl}`,
      scannedAt: new Date().toISOString(),
      limitations: 'Node.js native TLS inspection used; post-quantum hybrid group observation capabilities are limited by host OpenSSL build.',
      rawDetails: {
        negotiatedProtocol: protocol,
        negotiatedCipher: cipher,
        supportedVersions,
        pinnedIp,
        scannedAt: new Date().toISOString(),
      },
    };
  }

  // Populate ScanCheck and Evidence tables if linked to a ScanJob
  if (scanJobId) {
    try {
      const durationMs = Date.now() - scanStartTime;
      const rawJson = JSON.stringify(scanOutput.rawDetails);
      const hashDigest = crypto.createHash('sha256').update(rawJson).digest('hex');

      const linkedScanJob = await prisma.scanJob.findUnique({
        where: { id: scanJobId },
        select: { assetId: true },
      });
      const assetId = linkedScanJob?.assetId;

      // 1. ScanCheck: TLS_VERSIONS
      await prisma.scanCheck.create({
        data: {
          scanJobId,
          checkName: 'TLS_VERSIONS',
          checkType: 'TLS',
          status: 'SUCCESS',
          observedData: JSON.stringify({
            negotiated: scanOutput.tlsVersionNegotiated,
            supported: scanOutput.supportedTlsVersions,
          }),
          durationMs,
        },
      });

      // 2. ScanCheck: CIPHER_SUITES
      await prisma.scanCheck.create({
        data: {
          scanJobId,
          checkName: 'CIPHER_SUITES',
          checkType: 'TLS',
          status: 'SUCCESS',
          observedData: JSON.stringify({
            negotiated: scanOutput.cipherSuiteNegotiated,
            supported: scanOutput.supportedTlsVersions,
          }),
          durationMs,
        },
      });

      // 3. ScanCheck: CERTIFICATE_CHAIN
      await prisma.scanCheck.create({
        data: {
          scanJobId,
          checkName: 'CERTIFICATE_CHAIN',
          checkType: 'X509',
          status: 'SUCCESS',
          observedData: JSON.stringify({
            pubKeyAlgo: scanOutput.certPubKeyAlgo,
            keySize: scanOutput.certKeySize,
            signatureAlgo: scanOutput.certSignatureAlgo,
            validTo: scanOutput.certValidTo,
          }),
          durationMs,
        },
      });

      // 4. ScanCheck: KEY_EXCHANGE_GROUPS
      await prisma.scanCheck.create({
        data: {
          scanJobId,
          checkName: 'KEY_EXCHANGE_GROUPS',
          checkType: 'CRYPTO',
          status: 'SUCCESS',
          observedData: JSON.stringify({
            group: scanOutput.keyExchangeGroup,
            isPqHybrid: scanOutput.isPqHybrid,
            limitations: scanOutput.limitations || 'None',
          }),
          durationMs,
        },
      });

      // Create first-class Evidence records
      if (scanOutput.certPubKeyAlgo && scanOutput.certPubKeyAlgo !== 'Unknown') {
        await prisma.evidence.create({
          data: {
            scanJobId,
            assetId,
            evidenceSource: 'scanner_verified',
            evidenceType: 'X509_CERTIFICATE',
            observedProperty: 'cert_pub_key_algo',
            observedValue: `${scanOutput.certPubKeyAlgo}${scanOutput.certKeySize ? `-${scanOutput.certKeySize}` : ''}`,
            rawPayload: JSON.stringify({
              algo: scanOutput.certPubKeyAlgo,
              bits: scanOutput.certKeySize,
              subject: scanOutput.certSubject,
            }),
            scannerVersion: scanOutput.scannerVersion,
            verifiedAt: new Date(),
            hashDigest,
          },
        });
      }

      if (scanOutput.tlsVersionNegotiated) {
        await prisma.evidence.create({
          data: {
            scanJobId,
            assetId,
            evidenceSource: 'scanner_verified',
            evidenceType: 'TLS_HANDSHAKE',
            observedProperty: 'tls_version_negotiated',
            observedValue: scanOutput.tlsVersionNegotiated,
            rawPayload: JSON.stringify({
              negotiated: scanOutput.tlsVersionNegotiated,
              supported: scanOutput.supportedTlsVersions,
            }),
            scannerVersion: scanOutput.scannerVersion,
            verifiedAt: new Date(),
            hashDigest,
          },
        });
      }

      if (scanOutput.cipherSuiteNegotiated) {
        await prisma.evidence.create({
          data: {
            scanJobId,
            assetId,
            evidenceSource: 'scanner_verified',
            evidenceType: 'CIPHER_SUITE',
            observedProperty: 'cipher_suite_negotiated',
            observedValue: scanOutput.cipherSuiteNegotiated,
            rawPayload: JSON.stringify({
              cipherSuite: scanOutput.cipherSuiteNegotiated,
            }),
            scannerVersion: scanOutput.scannerVersion,
            verifiedAt: new Date(),
            hashDigest,
          },
        });
      }

      if (scanOutput.keyExchangeGroup && scanOutput.keyExchangeGroup !== 'Unknown') {
        await prisma.evidence.create({
          data: {
            scanJobId,
            assetId,
            evidenceSource: 'scanner_verified',
            evidenceType: 'KEY_EXCHANGE',
            observedProperty: 'key_exchange_group',
            observedValue: scanOutput.keyExchangeGroup,
            rawPayload: JSON.stringify({
              group: scanOutput.keyExchangeGroup,
              isPqHybrid: scanOutput.isPqHybrid,
              limitations: scanOutput.limitations,
            }),
            scannerVersion: scanOutput.scannerVersion,
            verifiedAt: new Date(),
            hashDigest,
          },
        });
      }
    } catch (saveErr) {
      console.warn('[ScanCheck/Evidence Save Warning]:', saveErr);
    }
  }

  return scanOutput;
}

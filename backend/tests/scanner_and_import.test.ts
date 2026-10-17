import { isPrivateOrReservedIp, validateScanTarget } from '../src/services/scanner.service';
import { normalizeAssetType, normalizeSensitivity } from '../src/services/import.service';

describe('SSRF Protection & Target Validation', () => {
  it('should identify private RFC1918 and loopback IPv4 addresses', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.1.5')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.31.255.254')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true); // Cloud metadata
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false); // Public
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false); // Public
  });

  it('should reject localhost and internal names immediately', async () => {
    await expect(validateScanTarget('localhost')).rejects.toThrow();
    await expect(validateScanTarget('internal.corp')).rejects.toThrow();
    await expect(validateScanTarget('127.0.0.1')).rejects.toThrow();
  });

  it('should reject unauthorized ports', async () => {
    await expect(validateScanTarget('example.com', 22)).rejects.toThrow(/Port 22 is not permitted/);
    await expect(validateScanTarget('example.com', 80)).rejects.toThrow(/Port 80 is not permitted/);
  });
});

describe('Bulk Import Normalization', () => {
  it('should correctly normalize asset categories', () => {
    expect(normalizeAssetType('web application')).toBe('WEBSITE');
    expect(normalizeAssetType('database server')).toBe('DATABASE');
    expect(normalizeAssetType('ssl certificate')).toBe('DIGITAL_CERTIFICATE');
    expect(normalizeAssetType('s3 archive backup')).toBe('STORAGE_BACKUP');
    expect(normalizeAssetType('rest api')).toBe('APPLICATION');
  });

  it('should correctly normalize sensitivity ratings', () => {
    expect(normalizeSensitivity('hipaa regulated')).toBe('REGULATED');
    expect(normalizeSensitivity('secret / classified')).toBe('HIGHLY_SENSITIVE');
    expect(normalizeSensitivity('confidential')).toBe('CONFIDENTIAL');
    expect(normalizeSensitivity('internal only')).toBe('INTERNAL');
    expect(normalizeSensitivity('public website')).toBe('PUBLIC');
  });
});

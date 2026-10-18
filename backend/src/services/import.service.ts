import { Readable } from 'stream';
import csvParser from 'csv-parser';
import * as xlsx from 'xlsx';
import prisma from '../lib/prisma';

export interface ParsedAssetItem {
  name: string;
  identifier: string;
  assetType: string;
  dataSensitivity: string;
  knownAlgorithms?: string;
  tlsVersion?: string;
  port: number;
  environment: string;
  notes?: string;
  sourceFile: string;
  sourceFormat: string;
  rowNumber: number;
  isDuplicate?: boolean;
  isValid: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  items: ParsedAssetItem[];
}

const VALID_ASSET_TYPES = [
  'WEBSITE',
  'SERVER',
  'APPLICATION',
  'DATABASE',
  'DIGITAL_CERTIFICATE',
  'STORAGE_BACKUP',
];

const VALID_SENSITIVITY = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'HIGHLY_SENSITIVE',
  'REGULATED',
];

export function normalizeAssetType(raw?: string): string {
  if (!raw) return 'SERVER';
  const val = raw.trim().toUpperCase().replace(/[\s-_]/g, '_');
  if (val.includes('WEB') || val.includes('SITE') || val.includes('PORTAL')) return 'WEBSITE';
  if (val.includes('CERT')) return 'DIGITAL_CERTIFICATE';
  if (val.includes('DATA') || val.includes('SQL') || val.includes('DB')) return 'DATABASE';
  if (val.includes('STORE') || val.includes('BACKUP') || val.includes('ARCHIVE') || val.includes('S3')) return 'STORAGE_BACKUP';
  if (val.includes('APP') || val.includes('API') || val.includes('SERVICE')) return 'APPLICATION';
  if (VALID_ASSET_TYPES.includes(val)) return val;
  return 'SERVER';
}

export function normalizeSensitivity(raw?: string): string {
  if (!raw) return 'CONFIDENTIAL';
  const val = raw.trim().toUpperCase();
  if (val.includes('HIGH') || val.includes('SECRET')) return 'HIGHLY_SENSITIVE';
  if (val.includes('REG') || val.includes('FERPA') || val.includes('HIPAA') || val.includes('PCI')) return 'REGULATED';
  if (val.includes('PUB')) return 'PUBLIC';
  if (val.includes('INT')) return 'INTERNAL';
  if (VALID_SENSITIVITY.includes(val)) return val;
  return 'CONFIDENTIAL';
}

export async function parseCsvBuffer(buffer: Buffer, filename: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(buffer);
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

export function parseXlsxBuffer(buffer: Buffer): any[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  return xlsx.utils.sheet_to_json(worksheet);
}

export function parseJsonBuffer(buffer: Buffer): any[] {
  try {
    const text = buffer.toString('utf-8');
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.assets && Array.isArray(parsed.assets)) return parsed.assets;
    if (parsed.items && Array.isArray(parsed.items)) return parsed.items;
    return [parsed];
  } catch (err: any) {
    throw new Error(`Invalid JSON file content: ${err.message}`);
  }
}

export async function processFileForPreview(
  file: Express.Multer.File
): Promise<ParsedAssetItem[]> {
  const filename = file.originalname;
  const ext = filename.split('.').pop()?.toLowerCase();
  let rawRows: any[] = [];

  if (ext === 'csv') {
    rawRows = await parseCsvBuffer(file.buffer, filename);
  } else if (ext === 'xlsx' || ext === 'xls') {
    rawRows = parseXlsxBuffer(file.buffer);
  } else if (ext === 'json') {
    rawRows = parseJsonBuffer(file.buffer);
  } else {
    throw new Error(`Unsupported file format: .${ext}. Only CSV, XLSX, and JSON are supported.`);
  }

  // Fetch existing asset identifiers to flag duplicates
  const existingAssets = await prisma.asset.findMany({
    select: { identifier: true },
  });
  const existingSet = new Set(existingAssets.map((a) => a.identifier.toLowerCase().trim()));
  const batchSet = new Set<string>();

  const items: ParsedAssetItem[] = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 1;
    const errors: string[] = [];

    // Case-insensitive key lookup helper
    const getVal = (...keys: string[]) => {
      for (const k of keys) {
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase().replace(/[-_\s]/g, '') === k.toLowerCase().replace(/[-_\s]/g, '')) {
            const v = row[rowKey];
            if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
          }
        }
      }
      return undefined;
    };

    const name = getVal('name', 'assetname', 'systemname', 'title');
    const identifier = getVal('identifier', 'hostname', 'host', 'url', 'domain', 'ip', 'address');
    const rawType = getVal('assettype', 'type', 'category');
    const rawSensitivity = getVal('datasensitivity', 'sensitivity', 'classification');
    const rawAlgo = getVal('knownalgorithms', 'algorithms', 'algorithm', 'crypto', 'ciphers');
    const tlsVersion = getVal('tlsversion', 'tls', 'ssl');
    const rawPort = getVal('port');
    const rawEnv = getVal('environment', 'env');
    const notes = getVal('notes', 'description', 'comments');

    if (!name || name.trim() === '') {
      errors.push('Missing required asset name');
    }

    if (!identifier || identifier.trim() === '') {
      errors.push('Missing required hostname or identifier');
    }

    const cleanIdentifier = (identifier || '').toLowerCase().trim();
    let isDuplicate = false;
    if (cleanIdentifier) {
      if (existingSet.has(cleanIdentifier) || batchSet.has(cleanIdentifier)) {
        isDuplicate = true;
      }
      batchSet.add(cleanIdentifier);
    }

    let port = 443;
    if (rawPort !== undefined && rawPort !== null && String(rawPort).trim() !== '') {
      const parsedPort = parseInt(String(rawPort).trim(), 10);
      if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        errors.push(`Invalid port number "${rawPort}" (must be an integer between 1 and 65535)`);
      } else {
        port = parsedPort;
      }
    }

    const assetType = normalizeAssetType(rawType);
    const dataSensitivity = normalizeSensitivity(rawSensitivity);

    items.push({
      name: name || `(Unspecified Row ${rowNum})`,
      identifier: identifier || `unknown-host-${rowNum}`,
      assetType,
      dataSensitivity,
      knownAlgorithms: rawAlgo ? rawAlgo : undefined,
      tlsVersion: tlsVersion || undefined,
      port,
      environment: rawEnv ? rawEnv.toUpperCase() : 'PRODUCTION',
      notes,
      sourceFile: filename,
      sourceFormat: ext?.toUpperCase() || 'UNKNOWN',
      rowNumber: rowNum,
      isDuplicate,
      isValid: errors.length === 0,
      errors,
    });
  });

  return items;
}

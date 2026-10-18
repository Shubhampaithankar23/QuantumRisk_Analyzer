import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import {
  processFileForPreview,
  ParsedAssetItem,
  ImportPreviewResult,
} from '../services/import.service';

export const previewFiles = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded. Please upload one or more CSV, XLSX, or JSON files.',
      });
    }

    const allItems: ParsedAssetItem[] = [];

    for (const file of files) {
      const items = await processFileForPreview(file);
      allItems.push(...items);
    }

    const validRecords = allItems.filter((i) => i.isValid && !i.isDuplicate).length;
    const invalidRecords = allItems.filter((i) => !i.isValid).length;
    const duplicateRecords = allItems.filter((i) => i.isDuplicate).length;

    const result: ImportPreviewResult = {
      totalRecords: allItems.length,
      validRecords,
      invalidRecords,
      duplicateRecords,
      items: allItems,
    };

    res.status(200).json({
      success: true,
      data: result,
      message: `Parsed ${files.length} file(s) with ${allItems.length} total records.`,
    });
  } catch (error: any) {
    console.error('File preview error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to parse upload file(s)',
    });
  }
};

const executeImportSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      identifier: z.string(),
      assetType: z.string(),
      dataSensitivity: z.string(),
      knownAlgorithms: z.string().optional(),
      tlsVersion: z.string().optional(),
      port: z.number().default(443),
      environment: z.string().default('PRODUCTION'),
      notes: z.string().optional(),
      sourceFile: z.string().default('bulk_import'),
      sourceFormat: z.string().default('CSV'),
      rowNumber: z.number().default(1),
    })
  ),
  skipDuplicates: z.boolean().default(true),
});

export const executeImport = async (req: Request, res: Response) => {
  try {
    const { items, skipDuplicates } = executeImportSchema.parse(req.body);

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided for import' });
    }

    let institution = await prisma.institution.findFirst();
    if (!institution) {
      institution = await prisma.institution.create({
        data: {
          name: 'Apex University of Science & Technology',
          domain: 'apex.edu',
        },
      });
    }

    const sourceFormat = items[0]?.sourceFormat || 'CSV';
    const filename = items[0]?.sourceFile || 'batch_import';

    // Create ImportJob record
    const importJob = await prisma.importJob.create({
      data: {
        institutionId: institution.id,
        filename,
        fileFormat: sourceFormat,
        totalRows: items.length,
        status: 'PROCESSING',
      },
    });

    let importedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    // Fetch existing identifiers
    const existingAssets = await prisma.asset.findMany({
      where: { institutionId: institution.id },
      select: { identifier: true },
    });
    const existingSet = new Set(existingAssets.map((a) => a.identifier.toLowerCase().trim()));

    for (const item of items) {
      const cleanId = item.identifier.toLowerCase().trim();

      if (existingSet.has(cleanId)) {
        duplicateCount++;
        if (skipDuplicates) {
          await prisma.importError.create({
            data: {
              importJobId: importJob.id,
              rowNumber: item.rowNumber,
              rawData: JSON.stringify(item),
              errorMessage: `Duplicate identifier "${item.identifier}" skipped.`,
            },
          });
          continue;
        }
      }

      try {
        const infoSource = `IMPORT_${item.sourceFormat.toUpperCase()}` as any;
        const knownAlgoString = item.knownAlgorithms
          ? typeof item.knownAlgorithms === 'string'
            ? item.knownAlgorithms
            : JSON.stringify(item.knownAlgorithms)
          : null;

        const newAsset = await prisma.asset.create({
          data: {
            name: item.name,
            identifier: item.identifier,
            assetType: item.assetType,
            institutionId: institution.id,
            dataSensitivity: item.dataSensitivity,
            knownAlgorithms: knownAlgoString,
            informationSource: ['IMPORT_CSV', 'IMPORT_XLSX', 'IMPORT_JSON'].includes(infoSource)
              ? infoSource
              : 'IMPORT_CSV',
            assessmentStatus: 'PENDING',
            tlsVersion: item.tlsVersion || null,
            port: item.port || 443,
            environment: item.environment || 'PRODUCTION',
            notes: item.notes ? `${item.notes} (Source: ${item.sourceFile})` : `Imported from ${item.sourceFile}`,
          },
        });

        // Create Evidence records for imported algorithms with strict 'imported' provenance
        if (knownAlgoString) {
          try {
            const parsedAlgos = JSON.parse(knownAlgoString);
            const algoList = Array.isArray(parsedAlgos) ? parsedAlgos : [parsedAlgos];
            for (const a of algoList) {
              const algoVal = typeof a === 'string' ? a : a.algorithm || a.name || String(a);
              const purposeVal = typeof a === 'object' && a.purpose ? a.purpose : 'UNKNOWN';
              await prisma.evidence.create({
                data: {
                  assetId: newAsset.id,
                  evidenceSource: 'imported',
                  evidenceType: 'INVENTORY_RECORD',
                  observedProperty: purposeVal.toLowerCase(),
                  observedValue: algoVal,
                  rawPayload: JSON.stringify({ item, algorithm: a }),
                  hashDigest: crypto.createHash('sha256').update(algoVal).digest('hex'),
                },
              });
            }
          } catch {
            const algos = knownAlgoString.split(',').map((s) => s.trim()).filter(Boolean);
            for (const a of algos) {
              await prisma.evidence.create({
                data: {
                  assetId: newAsset.id,
                  evidenceSource: 'imported',
                  evidenceType: 'INVENTORY_RECORD',
                  observedProperty: 'algorithm',
                  observedValue: a,
                  rawPayload: JSON.stringify({ item, algorithm: a }),
                  hashDigest: crypto.createHash('sha256').update(a).digest('hex'),
                },
              });
            }
          }
        }

        existingSet.add(cleanId);
        importedCount++;
      } catch (err: any) {
        failedCount++;
        await prisma.importError.create({
          data: {
            importJobId: importJob.id,
            rowNumber: item.rowNumber,
            rawData: JSON.stringify(item),
            errorMessage: err.message || 'Database insert error',
          },
        });
      }
    }

    // Finalize import job
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        importedRows: importedCount,
        duplicateRows: duplicateCount,
        failedRows: failedCount,
        status: failedCount > 0 && importedCount === 0 ? 'FAILED' : 'COMPLETED',
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.id || null,
        institutionId: institution.id,
        action: 'IMPORT_EXECUTED',
        entityType: 'ImportJob',
        entityId: importJob.id,
        details: JSON.stringify({
          filename,
          total: items.length,
          imported: importedCount,
          duplicates: duplicateCount,
          failed: failedCount,
        }),
        ipAddress: req.ip || req.socket.remoteAddress || null,
      },
    });

    res.status(200).json({
      success: true,
      message: `Import completed: ${importedCount} assets imported, ${duplicateCount} duplicate(s) handled, ${failedCount} failure(s).`,
      data: {
        importJobId: importJob.id,
        total: items.length,
        imported: importedCount,
        duplicates: duplicateCount,
        failed: failedCount,
      },
    });
  } catch (error: any) {
    console.error('Execute import error:', error);
    res.status(500).json({ success: false, message: 'Failed to execute import', error: error.message });
  }
};

export const getImportHistory = async (req: Request, res: Response) => {
  try {
    const jobs = await prisma.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        errors: {
          take: 10,
        },
      },
    });

    res.status(200).json({ success: true, data: jobs });
  } catch (error: any) {
    console.error('Failed to get import history:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve import history', error: error.message });
  }
};

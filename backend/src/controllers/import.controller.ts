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
      name: z.string().min(1, 'Name is required'),
      identifier: z.string().min(1, 'Identifier is required'),
      assetType: z.string().default('WEBSITE'),
      dataSensitivity: z.string().nullish().default('CONFIDENTIAL'),
      knownAlgorithms: z.any().optional(),
      tlsVersion: z.string().nullish(),
      port: z.coerce.number().default(443),
      environment: z.string().nullish().default('PRODUCTION'),
      notes: z.string().nullish(),
      sourceFile: z.string().nullish().default('bulk_import'),
      sourceFormat: z.string().nullish().default('CSV'),
      rowNumber: z.coerce.number().default(1),
    })
  ),
  skipDuplicates: z.boolean().default(true),
});

export const executeImport = async (req: Request, res: Response) => {
  // Enforce server request timeout of 60s
  req.setTimeout(60000);
  res.setTimeout(60000);

  try {
    const parseResult = executeImportSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issueDetails = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${issueDetails}`,
        details: parseResult.error.errors,
      });
    }

    const { items, skipDuplicates } = parseResult.data;

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'No items provided for import.',
        data: { saved: [], skipped: [], errors: [] },
      });
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

    const saved: Array<{ id: string; name: string; identifier: string; rowNumber: number }> = [];
    const skipped: Array<{ rowNumber: number; identifier: string; reason: string }> = [];
    const errors: Array<{ rowNumber: number; identifier: string; error: string }> = [];

    // Fetch existing identifiers for deduplication
    const existingAssets = await prisma.asset.findMany({
      where: { institutionId: institution.id },
      select: { identifier: true },
    });
    const existingSet = new Set(existingAssets.map((a) => a.identifier.toLowerCase().trim()));

    // Process each row in its own try/catch: one bad row never crashes the import
    for (const item of items) {
      const cleanId = item.identifier.toLowerCase().trim();

      // Check unique constraint / duplicate
      if (existingSet.has(cleanId)) {
        skipped.push({
          rowNumber: item.rowNumber,
          identifier: item.identifier,
          reason: `Duplicate identifier "${item.identifier}" already exists.`,
        });
        continue;
      }

      try {
        const infoSource = `IMPORT_${(item.sourceFormat || 'CSV').toUpperCase()}` as any;
        const validSource = ['IMPORT_CSV', 'IMPORT_XLSX', 'IMPORT_JSON'].includes(infoSource)
          ? infoSource
          : 'IMPORT_CSV';

        const knownAlgoString = item.knownAlgorithms
          ? typeof item.knownAlgorithms === 'string'
            ? item.knownAlgorithms
            : JSON.stringify(item.knownAlgorithms)
          : null;

        // Perform asset creation and evidence creation atomically for this row
        const newAsset = await prisma.$transaction(
          async (tx) => {
            const asset = await tx.asset.create({
              data: {
                name: item.name,
                identifier: item.identifier,
                assetType: item.assetType,
                institutionId: institution!.id,
                dataSensitivity: item.dataSensitivity || 'CONFIDENTIAL',
                knownAlgorithms: knownAlgoString,
                informationSource: validSource,
                assessmentStatus: 'PENDING',
                tlsVersion: item.tlsVersion || null,
                port: item.port || 443,
                environment: item.environment || 'PRODUCTION',
                notes: item.notes
                  ? `${item.notes} (Source: ${item.sourceFile || 'import'})`
                  : `Imported from ${item.sourceFile || 'import'}`,
              },
            });

            // Base Evidence record with strict 'imported' provenance
            await tx.evidence.create({
              data: {
                assetId: asset.id,
                evidenceSource: 'imported',
                evidenceType: 'INVENTORY_RECORD',
                observedProperty: 'asset_inventory',
                observedValue: `${item.assetType}:${item.name}`,
                rawPayload: JSON.stringify(item),
                hashDigest: crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex'),
              },
            });

            // Create Evidence records with strict 'imported' provenance
            if (knownAlgoString) {
              try {
                const parsedAlgos = JSON.parse(knownAlgoString);
                const algoList = Array.isArray(parsedAlgos) ? parsedAlgos : [parsedAlgos];
                for (const a of algoList) {
                  const algoVal = typeof a === 'string' ? a : a.algorithm || a.name || String(a);
                  const purposeVal =
                    typeof a === 'object' && a.purpose ? a.purpose : 'UNKNOWN';
                  await tx.evidence.create({
                    data: {
                      assetId: asset.id,
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
                  await tx.evidence.create({
                    data: {
                      assetId: asset.id,
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

            return asset;
          },
          { timeout: 15000 }
        );

        existingSet.add(cleanId);
        saved.push({
          id: newAsset.id,
          name: newAsset.name,
          identifier: newAsset.identifier,
          rowNumber: item.rowNumber,
        });
      } catch (rowErr: any) {
        // Unique constraint error (P2002) handled as skipped row with clear message
        if (
          rowErr.code === 'P2002' ||
          rowErr.message?.includes('Unique constraint') ||
          rowErr.message?.includes('UNIQUE')
        ) {
          skipped.push({
            rowNumber: item.rowNumber,
            identifier: item.identifier,
            reason: `Unique constraint violated: "${item.identifier}" already exists.`,
          });
        } else {
          errors.push({
            rowNumber: item.rowNumber,
            identifier: item.identifier,
            error: rowErr.message || 'Database insert error',
          });
        }
      }
    }

    // Record import errors in database if any
    for (const errRow of errors) {
      await prisma.importError
        .create({
          data: {
            importJobId: importJob.id,
            rowNumber: errRow.rowNumber,
            rawData: JSON.stringify({ identifier: errRow.identifier }),
            errorMessage: errRow.error,
          },
        })
        .catch(() => {});
    }

    // Finalize import job record
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        importedRows: saved.length,
        duplicateRows: skipped.length,
        failedRows: errors.length,
        status: errors.length > 0 && saved.length === 0 ? 'FAILED' : 'COMPLETED',
      },
    });

    // Record audit log
    await prisma.auditLog
      .create({
        data: {
          userId: (req as any).user?.id || null,
          institutionId: institution.id,
          action: 'IMPORT_EXECUTED',
          entityType: 'ImportJob',
          entityId: importJob.id,
          details: JSON.stringify({
            filename,
            total: items.length,
            savedCount: saved.length,
            skippedCount: skipped.length,
            errorCount: errors.length,
          }),
          ipAddress: req.ip || req.socket.remoteAddress || null,
        },
      })
      .catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Import processed: ${saved.length} saved, ${skipped.length} skipped, ${errors.length} error(s).`,
      data: {
        importJobId: importJob.id,
        total: items.length,
        imported: saved.length,
        duplicates: skipped.length,
        failed: errors.length,
        saved,
        skipped,
        errors,
      },
    });
  } catch (globalError: any) {
    console.error('Execute import global error:', globalError);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: globalError.message || 'Fatal error during import execution',
      details: globalError.stack || null,
    });
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

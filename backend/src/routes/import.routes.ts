import { Router } from 'express';
import multer from 'multer';
import {
  previewFiles,
  executeImport,
  getImportHistory,
} from '../controllers/import.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max file size
    files: 10, // Max 10 files per request
  },
});

router.post('/imports/preview', authenticateToken, requireRole(['ADMIN']), upload.array('files', 10), previewFiles);
router.post('/import/preview', authenticateToken, requireRole(['ADMIN']), upload.array('files', 10), previewFiles);
router.post('/imports/execute', authenticateToken, requireRole(['ADMIN']), executeImport);
router.post('/import/commit', authenticateToken, requireRole(['ADMIN']), executeImport);
router.post('/imports/commit', authenticateToken, requireRole(['ADMIN']), executeImport);
router.get('/imports/history', authenticateToken, requireRole(['ADMIN', 'ANALYST', 'VIEWER']), getImportHistory);
router.get('/import/history', authenticateToken, requireRole(['ADMIN', 'ANALYST', 'VIEWER']), getImportHistory);

export default router;
